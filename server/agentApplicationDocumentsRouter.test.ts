import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  verifyTicket: vi.fn(),
  upload: vi.fn(),
  drafts: vi.fn(),
  removeDraft: vi.fn(),
  list: vi.fn(),
  download: vi.fn(),
}));

vi.mock("./phoneLoginTicket", () => ({
  verifyPhoneLoginTicket: mocks.verifyTicket,
}));
vi.mock("./agentApplicationDocuments", () => ({
  uploadAgentApplicationDocument: mocks.upload,
  listAgentApplicationDocumentDrafts: mocks.drafts,
  removeAgentApplicationDocumentDraft: mocks.removeDraft,
  listDocumentsForApplication: mocks.list,
  downloadAgentApplicationDocument: mocks.download,
}));

import { agentDocumentsRouter } from "./agentApplicationDocumentsRouter";

const phone = "0500000000";
const documentId = "11111111-1111-4111-8111-111111111111";
const safeMetadata = {
  id: documentId,
  kind: "national_id" as const,
  fileName: "demo.pdf",
  mimeType: "application/pdf" as const,
  size: 48,
  createdAt: 1,
};

function context(role: "admin" | "agent" | "employee" | "user" | null): TrpcContext {
  return {
    user: role
      ? {
          id: 1,
          role,
          openId: `agent-documents-${role}`,
          name: "Unit Test",
          email: null,
          loginMethod: "test",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        }
      : null,
    req: {} as TrpcContext["req"],
    res: { setHeader: vi.fn() } as unknown as TrpcContext["res"],
  };
}

const uploadInput = () => ({
  verificationToken: "valid-ticket",
  consent: true as const,
  kind: "national_id" as const,
  fileName: "demo.pdf",
  mimeType: "application/pdf" as const,
  base64: "JVBERi0xLjcKJSVkZW1vCiUlRU9GCg==",
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verifyTicket.mockReturnValue(phone);
  mocks.upload.mockResolvedValue(safeMetadata);
  mocks.drafts.mockResolvedValue([safeMetadata]);
  mocks.removeDraft.mockResolvedValue({ success: true });
  mocks.list.mockResolvedValue([safeMetadata]);
  mocks.download.mockResolvedValue({ fileName: "demo.pdf", mimeType: "application/pdf", base64: "ZGVtby1vbmx5" });
});

describe("agentDocuments router", () => {
  it("requires explicit consent and derives ownership only from the verification ticket", async () => {
    const caller = agentDocumentsRouter.createCaller(context(null));
    await expect(caller.upload({ ...uploadInput(), consent: false })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.verifyTicket).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();

    await expect(caller.upload({ ...uploadInput(), phone: "0599999999" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.verifyTicket).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();

    await expect(caller.upload(uploadInput())).resolves.toEqual(safeMetadata);
    expect(mocks.verifyTicket).toHaveBeenCalledWith("valid-ticket");
    expect(mocks.upload).toHaveBeenCalledWith(phone, {
      kind: "national_id",
      fileName: "demo.pdf",
      mimeType: "application/pdf",
      size: undefined,
      base64: "JVBERi0xLjcKJSVkZW1vCiUlRU9GCg==",
    });
  });

  it("does not reach draft/document operations when ticket verification fails", async () => {
    mocks.verifyTicket.mockImplementation(() => {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    });
    const caller = agentDocumentsRouter.createCaller(context(null));
    await expect(caller.drafts({ verificationToken: "invalid" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.removeDraft({ verificationToken: "invalid", documentId })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.drafts).not.toHaveBeenCalled();
    expect(mocks.removeDraft).not.toHaveBeenCalled();
  });

  it("allows ticket-scoped draft recovery/removal but never a public download", async () => {
    const caller = agentDocumentsRouter.createCaller(context(null));
    await expect(caller.drafts({ verificationToken: "valid-ticket" })).resolves.toEqual([safeMetadata]);
    await expect(caller.removeDraft({ verificationToken: "valid-ticket", documentId })).resolves.toEqual({ success: true });
    expect(mocks.drafts).toHaveBeenCalledWith(phone);
    expect(mocks.removeDraft).toHaveBeenCalledWith(phone, documentId);

    await expect((caller as any).download({ documentId })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it.each([null, "user", "agent", "employee"] as const)("prevents %s from linked metadata and bytes", async role => {
    const caller = agentDocumentsRouter.createCaller(context(role));
    const expected = role ? "FORBIDDEN" : "UNAUTHORIZED";
    await expect(caller.list({ applicationId: 7 })).rejects.toMatchObject({ code: expected });
    await expect(caller.download({ documentId })).rejects.toMatchObject({ code: expected });
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it("permits only admins to retrieve linked metadata and server-decoded bytes", async () => {
    const adminContext = context("admin");
    const setHeader = vi.spyOn(adminContext.res as any, "setHeader");
    const caller = agentDocumentsRouter.createCaller(adminContext);
    await expect(caller.list({ applicationId: 7 })).resolves.toEqual([safeMetadata]);
    await expect(caller.download({ documentId })).resolves.toEqual({
      fileName: "demo.pdf",
      mimeType: "application/pdf",
      base64: "ZGVtby1vbmx5",
    });
    expect(mocks.list).toHaveBeenCalledWith([7]);
    expect(mocks.download).toHaveBeenCalledWith(documentId);
    expect(setHeader).toHaveBeenCalledWith("Cache-Control", "no-store, private");
  });
});
