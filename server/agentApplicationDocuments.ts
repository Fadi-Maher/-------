import { TRPCError } from "@trpc/server";
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  ne,
} from "drizzle-orm";
import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
  randomUUID,
} from "node:crypto";
import {
  agentApplicationDocuments,
  agentApplications,
  phoneOtpChallenges,
} from "../drizzle/schema";
import {
  AGENT_DOCUMENT_DRAFT_TTL_MS,
  AGENT_DOCUMENT_KINDS,
  AGENT_DOCUMENT_MAX_ACTIVE_DRAFTS,
  AGENT_DOCUMENT_MAX_BYTES,
  AGENT_DOCUMENT_MAX_UPLOADS_PER_WINDOW,
  AGENT_DOCUMENT_UPLOAD_WINDOW_MS,
  type AgentApplicationDocumentMetadata,
  type AgentApplicationDocumentUpload,
  type AgentDocumentKind,
} from "../shared/agentDocuments";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { storageGetSignedUrl, storagePut } from "./storage";

const ENCRYPTION_PURPOSE = "agent-application-document-v1";
const NONCE_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const ENVELOPE_BYTES = NONCE_BYTES + AUTH_TAG_BYTES;
const DOWNLOAD_TIMEOUT_MS = 8_000;
const MIME_TYPES = new Set<AgentApplicationDocumentUpload["mimeType"]>([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);
const EXTENSIONS: Record<AgentApplicationDocumentUpload["mimeType"], readonly string[]> = {
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
};

/** These records contain private storage data and must never cross an RPC boundary. */
type StoredDocument = {
  id: string;
  phone: string;
  applicationId: number | null;
  kind: AgentDocumentKind;
  fileName: string;
  mimeType: AgentApplicationDocumentUpload["mimeType"];
  size: number;
  storageKey: string;
  createdAt: number;
};

type EncryptionBinding = Pick<StoredDocument, "id" | "phone" | "kind">;
type Transaction = any; // Drizzle transaction type is intentionally not exported by this app's DB wrapper.

function badRequest(message: string): TRPCError {
  return new TRPCError({ code: "BAD_REQUEST", message });
}

function conflict(message: string): TRPCError {
  return new TRPCError({ code: "CONFLICT", message });
}

function metadata(document: Pick<StoredDocument, "id" | "kind" | "fileName" | "mimeType" | "size" | "createdAt">): AgentApplicationDocumentMetadata {
  return {
    id: document.id,
    kind: document.kind,
    fileName: document.fileName,
    mimeType: document.mimeType,
    size: Number(document.size),
    createdAt: Number(document.createdAt),
  };
}

function encryptionSecret(): Buffer {
  // ENV.cookieSecret maps to JWT_SECRET in this application. The direct fallback
  // supports an explicitly injected JWT_SECRET in server-only test/deploy setups.
  const secret = ENV.cookieSecret || process.env.JWT_SECRET;
  if (!secret) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "إعداد تشفير المستندات غير متاح.",
    });
  }
  return Buffer.from(secret, "utf8");
}

function documentKey(documentId: string): Buffer {
  return Buffer.from(
    hkdfSync(
      "sha256",
      encryptionSecret(),
      Buffer.from(ENCRYPTION_PURPOSE, "utf8"),
      Buffer.from(`${ENCRYPTION_PURPOSE}:${documentId}`, "utf8"),
      32,
    ),
  );
}

function documentAad(binding: EncryptionBinding): Buffer {
  return Buffer.from(
    `${ENCRYPTION_PURPOSE}\u0000${binding.id}\u0000${binding.phone}\u0000${binding.kind}`,
    "utf8",
  );
}

/** AES-256-GCM envelope: 12-byte nonce || 16-byte tag || ciphertext. */
export function encryptAgentApplicationDocument(
  plaintext: Buffer,
  binding: EncryptionBinding,
): Buffer {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv("aes-256-gcm", documentKey(binding.id), nonce);
  cipher.setAAD(documentAad(binding));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]);
}

export function decryptAgentApplicationDocument(
  envelope: Buffer,
  binding: EncryptionBinding,
): Buffer {
  if (envelope.length <= ENVELOPE_BYTES || envelope.length > AGENT_DOCUMENT_MAX_BYTES + ENVELOPE_BYTES) {
    throw new Error("Invalid encrypted document envelope");
  }
  const nonce = envelope.subarray(0, NONCE_BYTES);
  const tag = envelope.subarray(NONCE_BYTES, ENVELOPE_BYTES);
  const ciphertext = envelope.subarray(ENVELOPE_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", documentKey(binding.id), nonce);
  decipher.setAAD(documentAad(binding));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function isCanonicalBase64(value: string): boolean {
  if (value.length === 0 || value.length % 4 !== 0) return false;
  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
}

function decodeBase64(value: string): Buffer {
  // Buffer.from is permissive, so syntax and canonical round-trip checks are both
  // mandatory before it is allowed to allocate/decode a client string.
  if (!isCanonicalBase64(value)) {
    throw badRequest("ترميز الملف غير صالح.");
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.length === 0 || bytes.toString("base64") !== value) {
    throw badRequest("ترميز الملف غير صالح.");
  }
  return bytes;
}

function assertSafeFileName(fileName: string): void {
  // Names never affect object keys, but reject separators, controls, and bidi
  // format controls so metadata cannot disguise an extension or a path.
  const hasUnsafeUnicode = Array.from(fileName).some(character => {
    const code = character.codePointAt(0) ?? 0;
    return (
      (code >= 0x200b && code <= 0x200f) ||
      (code >= 0x202a && code <= 0x202e) ||
      code === 0x061c ||
      code === 0x2066 ||
      code === 0x2067 ||
      code === 0x2068 ||
      code === 0x2069
    );
  });
  if (
    fileName.length === 0 ||
    fileName.length > 160 ||
    fileName !== fileName.trim() ||
    /[\u0000-\u001f\u007f]/.test(fileName) ||
    /[\\/]/.test(fileName) ||
    fileName.includes("..") ||
    hasUnsafeUnicode ||
    !/^[A-Za-z0-9\u0621-\u06ff][A-Za-z0-9\u0621-\u06ff _().-]*$/.test(fileName)
  ) {
    throw badRequest("اسم الملف غير صالح.");
  }
}

function assertExtension(fileName: string, mimeType: AgentApplicationDocumentUpload["mimeType"]): void {
  const lower = fileName.toLocaleLowerCase("en-US");
  if (!EXTENSIONS[mimeType].some(extension => lower.endsWith(extension))) {
    throw badRequest("امتداد الملف لا يطابق نوعه المعلن.");
  }
}

function crc32(bytes: Buffer, start: number, end: number): number {
  let value = 0xffffffff;
  for (let index = start; index < end; index += 1) {
    value ^= bytes[index]!;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
    }
  }
  return (value ^ 0xffffffff) >>> 0;
}

function isValidPng(bytes: Buffer): boolean {
  const signature = "89504e470d0a1a0a";
  if (bytes.length < 45 || bytes.subarray(0, 8).toString("hex") !== signature) return false;

  let offset = 8;
  let chunks = 0;
  let sawIhdr = false;
  let sawIdat = false;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) return false;
    const length = bytes.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const crcStart = dataEnd;
    const end = crcStart + 4;
    if (dataEnd < dataStart || end > bytes.length || ++chunks > 4_000) return false;

    const type = bytes.subarray(typeStart, dataStart).toString("ascii");
    if (!/^[A-Za-z]{4}$/.test(type)) return false;
    if (bytes.readUInt32BE(crcStart) !== crc32(bytes, typeStart, dataEnd)) return false;

    if (!sawIhdr) {
      if (type !== "IHDR" || length !== 13) return false;
      const width = bytes.readUInt32BE(dataStart);
      const height = bytes.readUInt32BE(dataStart + 4);
      if (width === 0 || height === 0 || width > 20_000 || height > 20_000) return false;
      sawIhdr = true;
    } else if (type === "IHDR") {
      return false;
    }
    if (type === "IDAT") sawIdat = true;
    if (type === "IEND") return length === 0 && sawIdat && end === bytes.length;
    offset = end;
  }
  return false;
}

function isStandaloneJpegMarker(marker: number): boolean {
  return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
}

function isSofMarker(marker: number): boolean {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  );
}

/** Rejects JPEGs with malformed segments or bytes appended after the EOI marker. */
function isValidJpeg(bytes: Buffer): boolean {
  if (bytes.length < 8 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return false;
  let offset = 2;
  let sawSof = false;
  let sawSos = false;

  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) return false;
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === undefined || marker === 0x00) return false;
    if (marker === 0xd9) return sawSof && sawSos && offset === bytes.length;
    if (marker === 0xd8 || isStandaloneJpegMarker(marker)) continue;
    if (offset + 2 > bytes.length) return false;
    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return false;
    const dataStart = offset + 2;
    const segmentEnd = offset + segmentLength;
    if (isSofMarker(marker)) {
      if (segmentLength < 8 || bytes.readUInt16BE(dataStart + 1) === 0 || bytes.readUInt16BE(dataStart + 3) === 0) return false;
      sawSof = true;
    }
    offset = segmentEnd;
    if (marker !== 0xda) continue;
    sawSos = true;

    // Entropy-coded data is allowed only until a legal marker.  Stuffed 0xFF00
    // and restart markers remain part of the scan; any next segment is parsed by
    // the outer loop.  This also requires EOI to be the final bytes.
    while (offset < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const markerStart = offset;
      while (bytes[offset] === 0xff) offset += 1;
      const next = bytes[offset];
      if (next === undefined) return false;
      if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) {
        offset += 1;
        continue;
      }
      if (next === 0xd9) return sawSof && offset + 1 === bytes.length;
      offset = markerStart;
      break;
    }
  }
  return false;
}

function isValidPdf(bytes: Buffer): boolean {
  if (bytes.length < 10 || bytes.subarray(0, 5).toString("ascii") !== "%PDF-") return false;
  const eof = bytes.lastIndexOf(Buffer.from("%%EOF", "ascii"));
  if (eof < 0) return false;
  for (let index = eof + 5; index < bytes.length; index += 1) {
    const value = bytes[index]!;
    if (value !== 0x09 && value !== 0x0a && value !== 0x0c && value !== 0x0d && value !== 0x20) return false;
  }
  return true;
}

function assertMagic(bytes: Buffer, mimeType: AgentApplicationDocumentUpload["mimeType"]): void {
  const valid =
    mimeType === "application/pdf"
      ? isValidPdf(bytes)
      : mimeType === "image/png"
        ? isValidPng(bytes)
        : isValidJpeg(bytes);
  if (!valid) {
    throw badRequest("محتوى الملف لا يطابق نوعه المسموح. تُقبل PDF وPNG وJPEG السليمة فقط.");
  }
}

/**
 * Validates all client-controlled bytes before storage is contacted.  Full PNG
 * and JPEG framing, PDF EOF placement, extension/MIME agreement, and strict
 * canonical base64 collectively reject SVG, HTML, executables, and appended
 * polyglot payloads.
 */
export function validateAgentApplicationDocumentUpload(
  input: AgentApplicationDocumentUpload,
): { bytes: Buffer; upload: AgentApplicationDocumentUpload } {
  if (!AGENT_DOCUMENT_KINDS.includes(input.kind)) throw badRequest("نوع المستند غير صالح.");
  if (!MIME_TYPES.has(input.mimeType)) throw badRequest("نوع الملف غير مدعوم.");
  assertSafeFileName(input.fileName);
  assertExtension(input.fileName, input.mimeType);

  // Base64 expands by at most 4/3. Reject grossly oversized strings before decode.
  if (input.base64.length > Math.ceil(AGENT_DOCUMENT_MAX_BYTES / 3) * 4) {
    throw badRequest("يجب ألا يتجاوز حجم المستند 5 ميجابايت.");
  }
  const bytes = decodeBase64(input.base64);
  if (bytes.length > AGENT_DOCUMENT_MAX_BYTES) {
    throw badRequest("يجب ألا يتجاوز حجم المستند 5 ميجابايت.");
  }
  if (input.size !== undefined && input.size !== bytes.length) {
    throw badRequest("حجم المستند المعلن لا يطابق محتواه.");
  }
  assertMagic(bytes, input.mimeType);
  return { bytes, upload: { ...input, size: bytes.length } };
}

function documentStorageKey(id: string): string {
  // storagePut adds its own random suffix. Neither the original name nor any
  // applicant identifier appears in the object key.
  return `agent-application-documents/${id}.bin`;
}

/** In-process fallback when a test/dev database has no verified OTP row. */
const localPhoneUploadTails = new Map<string, Promise<void>>();

async function serialiseLocalPhoneUpload<T>(phone: string, work: () => Promise<T>): Promise<T> {
  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  const previous = localPhoneUploadTails.get(phone) ?? Promise.resolve();
  const tail = previous.then(() => gate);
  localPhoneUploadTails.set(phone, tail);
  await previous;
  try {
    return await work();
  } finally {
    release();
    if (localPhoneUploadTails.get(phone) === tail) localPhoneUploadTails.delete(phone);
  }
}

/**
 * A verified OTP row is a durable per-phone lock row in production. The empty
 * unique-key lookup is still issued with FOR UPDATE for test/dev fallback, and
 * the local queue prevents concurrent mock/no-row uploads from exceeding quota.
 */
async function lockPhoneUpload(tx: Transaction, phone: string): Promise<void> {
  await tx
    .select({ id: phoneOtpChallenges.id })
    .from(phoneOtpChallenges)
    .where(eq(phoneOtpChallenges.phone, phone))
    .limit(1)
    .for("update");
}

function assertFreshDraft(document: StoredDocument, now: number): void {
  if (Number(document.createdAt) < now - AGENT_DOCUMENT_DRAFT_TTL_MS) {
    throw conflict("انتهت صلاحية مسودة المستند. ارفع المستند مرة أخرى.");
  }
}

function assertDistinctKinds(documents: readonly Pick<StoredDocument, "kind">[]): void {
  if (documents.length > AGENT_DOCUMENT_MAX_ACTIVE_DRAFTS || new Set(documents.map(document => document.kind)).size !== documents.length) {
    throw conflict("يمكن إرفاق مستند واحد فقط من كل نوع وبحد أقصى مستندين.");
  }
}

/** Stores an encrypted, opaque object and returns safe metadata only. */
export async function uploadAgentApplicationDocument(
  phone: string,
  rawInput: AgentApplicationDocumentUpload,
  now = Date.now(),
): Promise<AgentApplicationDocumentMetadata> {
  const { bytes, upload } = validateAgentApplicationDocumentUpload(rawInput);
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const id = randomUUID();

  return serialiseLocalPhoneUpload(phone, () =>
    db.transaction(async (tx: Transaction) => {
      await lockPhoneUpload(tx, phone);
      const documents = await tx
        .select()
        .from(agentApplicationDocuments)
        .where(eq(agentApplicationDocuments.phone, phone))
        .for("update");
      const activeDrafts = documents.filter(
        (document: StoredDocument) =>
          document.applicationId === null &&
          document.storageKey !== "" &&
          Number(document.createdAt) >= now - AGENT_DOCUMENT_DRAFT_TTL_MS,
      ) as StoredDocument[];
      const uploadsInWindow = documents.filter(
        (document: StoredDocument) => Number(document.createdAt) >= now - AGENT_DOCUMENT_UPLOAD_WINDOW_MS,
      ).length;

      if (uploadsInWindow >= AGENT_DOCUMENT_MAX_UPLOADS_PER_WINDOW) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "تم بلوغ الحد المؤقت لرفع المستندات. حاول بعد ساعة.",
        });
      }
      if (activeDrafts.some(document => document.kind === upload.kind)) {
        throw conflict("يوجد بالفعل مستند مسودة من هذا النوع. احذفه أولًا قبل رفع بديل.");
      }
      if (activeDrafts.length >= AGENT_DOCUMENT_MAX_ACTIVE_DRAFTS) {
        throw conflict("يمكن الاحتفاظ بمسودتي مستندات فقط في الوقت نفسه.");
      }

      const encrypted = encryptAgentApplicationDocument(bytes, { id, phone, kind: upload.kind });
      const stored = await storagePut(
        documentStorageKey(id),
        encrypted,
        "application/octet-stream",
      );
      const row: StoredDocument = {
        id,
        phone,
        applicationId: null,
        kind: upload.kind,
        fileName: upload.fileName,
        mimeType: upload.mimeType,
        size: bytes.length,
        storageKey: stored.key,
        createdAt: now,
      };
      await tx.insert(agentApplicationDocuments).values(row);
      return metadata(row);
    }),
  );
}

/**
 * Public-ticket-scoped removal. Keep a keyless tombstone for the hourly quota;
 * it has no storage reference, is invisible to every list, and cannot attach.
 */
export async function removeAgentApplicationDocumentDraft(
  phone: string,
  documentId: string,
): Promise<{ success: true }> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.transaction(async (tx: Transaction) => {
    const document = (await tx
      .select()
      .from(agentApplicationDocuments)
      .where(and(
        eq(agentApplicationDocuments.id, documentId),
        eq(agentApplicationDocuments.phone, phone),
        ne(agentApplicationDocuments.storageKey, ""),
      ))
      .limit(1)
      .for("update"))[0] as StoredDocument | undefined;
    if (!document) {
      throw new TRPCError({ code: "NOT_FOUND", message: "مسودة المستند غير موجودة." });
    }
    if (document.applicationId !== null) {
      throw conflict("لا يمكن حذف مستند تم إرفاقه بطلب الانضمام.");
    }
    await tx
      .update(agentApplicationDocuments)
      .set({ storageKey: "" })
      .where(and(
        eq(agentApplicationDocuments.id, documentId),
        eq(agentApplicationDocuments.phone, phone),
        isNull(agentApplicationDocuments.applicationId),
        ne(agentApplicationDocuments.storageKey, ""),
      ));
  });
  return { success: true };
}

/** Safe, fresh draft metadata for the holder of the verified phone ticket only. */
export async function listAgentApplicationDocumentDrafts(
  phone: string,
  now = Date.now(),
): Promise<AgentApplicationDocumentMetadata[]> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = (await db
    .select({
      id: agentApplicationDocuments.id,
      kind: agentApplicationDocuments.kind,
      fileName: agentApplicationDocuments.fileName,
      mimeType: agentApplicationDocuments.mimeType,
      size: agentApplicationDocuments.size,
      createdAt: agentApplicationDocuments.createdAt,
    })
    .from(agentApplicationDocuments)
    .where(and(
      eq(agentApplicationDocuments.phone, phone),
      isNull(agentApplicationDocuments.applicationId),
      ne(agentApplicationDocuments.storageKey, ""),
      gte(agentApplicationDocuments.createdAt, now - AGENT_DOCUMENT_DRAFT_TTL_MS),
    ))
    .orderBy(desc(agentApplicationDocuments.createdAt), desc(agentApplicationDocuments.id))) as StoredDocument[];
  return rows.map(metadata);
}

/**
 * Call this inside the same transaction that creates/returns a joining
 * application. It never replaces or detaches already linked documents.
 */
export async function attachDocuments(
  tx: Transaction,
  phone: string,
  applicationId: number,
  documentIds: readonly string[],
  now = Date.now(),
): Promise<AgentApplicationDocumentMetadata[]> {
  if (!Number.isInteger(applicationId) || applicationId <= 0) throw badRequest("معرّف طلب الانضمام غير صالح.");
  if (documentIds.length > AGENT_DOCUMENT_MAX_ACTIVE_DRAFTS || new Set(documentIds).size !== documentIds.length || documentIds.some(id => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) {
    throw badRequest("معرّفات المستندات غير صالحة.");
  }

  const application = (await tx
    .select({ id: agentApplications.id, phone: agentApplications.phone, status: agentApplications.status })
    .from(agentApplications)
    .where(eq(agentApplications.id, applicationId))
    .limit(1)
    .for("update"))[0] as { id: number; phone: string; status: "pending" | "approved" | "rejected" } | undefined;
  if (!application || application.phone !== phone) {
    throw new TRPCError({ code: "NOT_FOUND", message: "طلب الانضمام غير موجود." });
  }

  const existing = (await tx
    .select()
    .from(agentApplicationDocuments)
    .where(eq(agentApplicationDocuments.applicationId, applicationId))
    .for("update")) as StoredDocument[];
  const requested = documentIds.length
    ? ((await tx
      .select()
      .from(agentApplicationDocuments)
      .where(and(
        eq(agentApplicationDocuments.phone, phone),
        ne(agentApplicationDocuments.storageKey, ""),
        inArray(agentApplicationDocuments.id, [...documentIds]),
      ))
      .for("update")) as StoredDocument[])
    : [];
  if (requested.length !== documentIds.length) {
    throw new TRPCError({ code: "NOT_FOUND", message: "أحد مستندات المسودة غير موجود." });
  }

  // A retry of an already submitted document set is safely idempotent, even if
  // the application has since been reviewed; it performs no new write.
  if (requested.every(document => document.applicationId === applicationId)) {
    assertDistinctKinds(requested);
    return requested.map(metadata);
  }
  if (application.status !== "pending") {
    throw conflict("لا يمكن إرفاق مستندات بطلب تمت مراجعته.");
  }
  if (requested.some(document => document.applicationId !== null)) {
    throw conflict("لا يمكن نقل مستند مرتبط بطلب آخر.");
  }
  requested.forEach(document => assertFreshDraft(document, now));

  const combined = new Map<string, StoredDocument>();
  [...existing, ...requested].forEach(document => combined.set(document.id, document));
  const combinedDocuments = Array.from(combined.values());
  assertDistinctKinds(combinedDocuments);

  if (requested.length) {
    await tx
      .update(agentApplicationDocuments)
      .set({ applicationId })
      .where(and(
        eq(agentApplicationDocuments.phone, phone),
        isNull(agentApplicationDocuments.applicationId),
        inArray(agentApplicationDocuments.id, requested.map(document => document.id)),
      ));
  }
  return combinedDocuments.map(metadata);
}

/**
 * Safe linked-document metadata for use only from an admin-authorized call
 * path. It intentionally omits applicationId too, so callers should invoke it
 * per application when they need to associate a result with its parent.
 */
export async function listDocumentsForApplication(
  applicationIds?: readonly number[],
): Promise<AgentApplicationDocumentMetadata[]> {
  if (applicationIds && (applicationIds.length > 100 || applicationIds.some(id => !Number.isInteger(id) || id <= 0))) {
    throw badRequest("معرّفات طلبات الانضمام غير صالحة.");
  }
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const conditions = [isNotNull(agentApplicationDocuments.applicationId)];
  if (applicationIds?.length) conditions.push(inArray(agentApplicationDocuments.applicationId, [...applicationIds]));
  if (applicationIds && applicationIds.length === 0) return [];
  const rows = (await db
    .select({
      id: agentApplicationDocuments.id,
      kind: agentApplicationDocuments.kind,
      fileName: agentApplicationDocuments.fileName,
      mimeType: agentApplicationDocuments.mimeType,
      size: agentApplicationDocuments.size,
      createdAt: agentApplicationDocuments.createdAt,
    })
    .from(agentApplicationDocuments)
    .where(and(...conditions))
    .orderBy(desc(agentApplicationDocuments.createdAt), desc(agentApplicationDocuments.id))) as StoredDocument[];
  return rows.map(metadata);
}

async function readBoundedBody(response: Response, maximumBytes: number): Promise<Buffer> {
  const rawLength = response.headers.get("content-length");
  if (rawLength !== null && (!/^\d+$/.test(rawLength) || Number(rawLength) > maximumBytes)) {
    throw new Error("Encrypted object exceeds the allowed length");
  }
  if (!response.body) throw new Error("Storage response has no body");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      received += value.byteLength;
      if (received > maximumBytes) throw new Error("Encrypted object exceeds the allowed length");
      chunks.push(value);
    }
  } finally {
    if (received > maximumBytes) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  return Buffer.concat(chunks, received);
}

async function fetchEncryptedDocument(storageKey: string, maximumBytes: number): Promise<Buffer> {
  const url = await storageGetSignedUrl(storageKey);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Storage fetch failed (${response.status})`);
    return await readBoundedBody(response, maximumBytes);
  } finally {
    clearTimeout(timer);
  }
}

/** Admin-only service used by the adminProcedure router endpoint below. */
export async function downloadAgentApplicationDocument(
  documentId: string,
): Promise<{ fileName: string; mimeType: AgentApplicationDocumentUpload["mimeType"]; base64: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const document = (await db
    .select()
    .from(agentApplicationDocuments)
    .where(and(
      eq(agentApplicationDocuments.id, documentId),
      isNotNull(agentApplicationDocuments.applicationId),
      ne(agentApplicationDocuments.storageKey, ""),
    ))
    .limit(1))[0] as StoredDocument | undefined;
  if (!document) {
    throw new TRPCError({ code: "NOT_FOUND", message: "المستند غير موجود أو لم يُرفق بطلب." });
  }

  try {
    const envelope = await fetchEncryptedDocument(document.storageKey, Number(document.size) + ENVELOPE_BYTES);
    const plaintext = decryptAgentApplicationDocument(envelope, document);
    if (plaintext.length !== Number(document.size) || plaintext.length > AGENT_DOCUMENT_MAX_BYTES) {
      throw new Error("Decrypted size did not match metadata");
    }
    // Defence in depth: a corrupt row/object is never forwarded to an admin's browser.
    assertMagic(plaintext, document.mimeType);
    return {
      fileName: document.fileName,
      mimeType: document.mimeType,
      base64: plaintext.toString("base64"),
    };
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    console.error("[Agent documents] secure download failed", error instanceof Error ? error.message : "unknown error");
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر تنزيل المستند بأمان." });
  }
}

/** Test-only visibility into the local fallback queue; not exported from any RPC route. */
export function resetAgentDocumentUploadLocksForTest(): void {
  localPhoneUploadTails.clear();
}
