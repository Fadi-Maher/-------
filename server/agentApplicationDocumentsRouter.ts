import { z } from "zod";
import {
  AGENT_DOCUMENT_KINDS,
  AGENT_DOCUMENT_MAX_BYTES,
} from "../shared/agentDocuments";
import {
  downloadAgentApplicationDocument,
  listAgentApplicationDocumentDrafts,
  listDocumentsForApplication,
  removeAgentApplicationDocumentDraft,
  uploadAgentApplicationDocument,
} from "./agentApplicationDocuments";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { verifyPhoneLoginTicket } from "./phoneLoginTicket";

const verificationToken = z.string().min(1).max(500);
const mimeType = z.enum(["application/pdf", "image/png", "image/jpeg"]);
const maxBase64Length = Math.ceil(AGENT_DOCUMENT_MAX_BYTES / 3) * 4;

export const agentDocumentUploadInput = z
  .object({
    verificationToken,
    consent: z.literal(true),
    kind: z.enum(AGENT_DOCUMENT_KINDS),
    fileName: z.string().min(1).max(160),
    mimeType,
    size: z.number().int().positive().max(AGENT_DOCUMENT_MAX_BYTES).optional(),
    base64: z.string().min(4).max(maxBase64Length),
  })
  .strict();

export const agentApplicationDocumentsRouter = router({
  /** A phone-ticket holder can recover only their own still-fresh, unlinked drafts. */
  drafts: publicProcedure
    .input(z.object({ verificationToken }).strict())
    .query(({ input }) =>
      listAgentApplicationDocumentDrafts(verifyPhoneLoginTicket(input.verificationToken)),
    ),

  upload: publicProcedure
    .input(agentDocumentUploadInput)
    .mutation(({ input }) => {
      // The signed ticket, never an input phone field, establishes document ownership.
      const phone = verifyPhoneLoginTicket(input.verificationToken);
      return uploadAgentApplicationDocument(phone, {
        kind: input.kind,
        fileName: input.fileName,
        mimeType: input.mimeType,
        size: input.size,
        base64: input.base64,
      });
    }),

  removeDraft: publicProcedure
    .input(z.object({ verificationToken, documentId: z.string().uuid() }).strict())
    .mutation(({ input }) =>
      removeAgentApplicationDocumentDraft(
        verifyPhoneLoginTicket(input.verificationToken),
        input.documentId,
      ),
    ),

  /** Linked metadata is an admin-only operational view; drafts are never listed here. */
  list: adminProcedure
    .input(z.object({ applicationId: z.number().int().positive() }).strict())
    .query(({ input }) => listDocumentsForApplication([input.applicationId])),

  /** Bytes are fetched, capped, authenticated, decrypted, and base64-encoded server-side. */
  download: adminProcedure
    .input(z.object({ documentId: z.string().uuid() }).strict())
    .mutation(({ ctx, input }) => {
      // Avoid an intermediary/browser cache retaining decrypted identity bytes.
      ctx.res.setHeader("Cache-Control", "no-store, private");
      return downloadAgentApplicationDocument(input.documentId);
    }),
});

/** Short alias retained for callers/tests written before root-router integration. */
export const agentDocumentsRouter = agentApplicationDocumentsRouter;
