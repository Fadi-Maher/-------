import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.JWT_SECRET = "agent-document-unit-test-secret-only";
});

const storage = vi.hoisted(() => ({
  put: vi.fn(),
  signedUrl: vi.fn(),
}));
vi.mock("./storage", () => ({
  storagePut: storage.put,
  storageGetSignedUrl: storage.signedUrl,
}));

import {
  decryptAgentApplicationDocument,
  encryptAgentApplicationDocument,
  validateAgentApplicationDocumentUpload,
} from "./agentApplicationDocuments";

const samplePdf = Buffer.from(
  "%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF\n",
  "ascii",
);
const validUpload = () => ({
  kind: "national_id" as const,
  fileName: "demo-sample.pdf",
  mimeType: "application/pdf" as const,
  size: samplePdf.length,
  base64: samplePdf.toString("base64"),
});
const binding = {
  id: "11111111-1111-4111-8111-111111111111",
  phone: "0500000000",
  kind: "national_id" as const,
};

describe("agent application document validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts a structurally valid small demo PDF before storage is involved", () => {
    const result = validateAgentApplicationDocumentUpload(validUpload());
    expect(result.bytes).toEqual(samplePdf);
    expect(result.upload.size).toBe(samplePdf.length);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it.each([
    ["data URL", { ...validUpload(), base64: `data:application/pdf;base64,${samplePdf.toString("base64")}` }],
    ["whitespace in base64", { ...validUpload(), base64: `${samplePdf.toString("base64")}\n` }],
    ["declared size mismatch", { ...validUpload(), size: samplePdf.length + 1 }],
    ["path filename", { ...validUpload(), fileName: "../demo.pdf" }],
    ["MIME/extension mismatch", { ...validUpload(), fileName: "demo.png" }],
    ["HTML masquerading as PDF", { ...validUpload(), base64: Buffer.from("<!doctype html><html>not a PDF</html>").toString("base64") }],
  ])("rejects %s without calling storage", (_name, input) => {
    expect(() => validateAgentApplicationDocumentUpload(input)).toThrow();
    expect(storage.put).not.toHaveBeenCalled();
  });

  it("uses AES-GCM with the document binding as authenticated data", () => {
    const encrypted = encryptAgentApplicationDocument(samplePdf, binding);
    expect(encrypted).not.toEqual(samplePdf);
    expect(encrypted.subarray(0, 12)).not.toEqual(Buffer.alloc(12));
    expect(decryptAgentApplicationDocument(encrypted, binding)).toEqual(samplePdf);
    expect(() => decryptAgentApplicationDocument(encrypted, { ...binding, kind: "work_license" })).toThrow();
    expect(storage.put).not.toHaveBeenCalled();
  });
});
