// @vitest-environment jsdom
import React, { createElement as h } from "react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const ID = "fd71f5e5-5f56-4d8e-8224-f499e8c28683";
const meta = {
  id: ID,
  kind: "national_id" as const,
  fileName: "sample-id.pdf",
  mimeType: "application/pdf" as const,
  size: 14,
  createdAt: 1710000000000,
};
const mocks = vi.hoisted(() => ({
  drafts: {} as Record<string, unknown>,
  list: {} as Record<string, unknown>,
  applicationStatus: {} as Record<string, unknown>,
  upload: vi.fn(),
  removeDraft: vi.fn(),
  download: vi.fn(),
  draftsRefetch: vi.fn(),
  listRefetch: vi.fn(),
}));
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ isEnglish: true, language: "en" }),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    agentApplications: {
      status: { useQuery: () => mocks.applicationStatus },
      submit: {
        useMutation: () => ({
          mutateAsync: vi.fn(),
          isPending: false,
          isSuccess: false,
        }),
      },
    },
    agentDocuments: {
      drafts: { useQuery: () => mocks.drafts },
      upload: { useMutation: () => ({ mutateAsync: mocks.upload }) },
      removeDraft: { useMutation: () => ({ mutateAsync: mocks.removeDraft }) },
      list: { useQuery: () => mocks.list },
      download: { useMutation: () => ({ mutateAsync: mocks.download }) },
    },
  },
}));
import { AgentDocumentUploader } from "./components/AgentDocumentUploader";
import { AgentApplicationDocumentReview } from "./components/AgentApplicationDocumentReview";
import { AgentJoinForm } from "./components/AgentJoinForm";
const query = (data: unknown, refetch: ReturnType<typeof vi.fn>) => ({
  data,
  isLoading: false,
  isError: false,
  isFetching: false,
  error: null,
  refetch,
});
beforeAll(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal(
    "atob",
    vi.fn(() => "abc")
  );
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:document"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
  HTMLAnchorElement.prototype.click = vi.fn();
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.draftsRefetch.mockResolvedValue(undefined);
  mocks.listRefetch.mockResolvedValue(undefined);
  mocks.drafts = query([], mocks.draftsRefetch);
  mocks.applicationStatus = query(
    { hasActiveAgent: false, application: null },
    mocks.listRefetch
  );
  mocks.list = query([meta], mocks.listRefetch);
  mocks.upload.mockResolvedValue(meta);
  mocks.removeDraft.mockResolvedValue({ success: true });
  mocks.download.mockResolvedValue({
    fileName: meta.fileName,
    mimeType: meta.mimeType,
    base64: "YWJj",
  });
});
afterEach(cleanup);
describe("agent document UI", () => {
  it("keeps the pending status card and document consent mounted when draft IDs update", async () => {
    const user = userEvent.setup();
    mocks.applicationStatus = query(
      {
        hasActiveAgent: false,
        application: {
          id: 91,
          reference: "JOIN-91",
          phone: "0500000098",
          fullName: "QA Agent",
          email: "qa@example.invalid",
          city: "QA",
          specialty: "QA",
          experienceYears: 0,
          status: "pending",
          createdAt: Date.now(),
          reviewNote: null,
          reviewedAt: null,
        },
      },
      mocks.listRefetch
    );
    const { rerender } = render(
      h(AgentJoinForm, { phone: "0500000098", verificationToken: "ticket" })
    );
    const consent = screen.getByRole("checkbox");
    await user.click(consent);
    mocks.drafts = query([meta], mocks.draftsRefetch);
    rerender(
      h(AgentJoinForm, { phone: "0500000098", verificationToken: "ticket" })
    );
    await screen.findByText(meta.fileName);
    expect(screen.getByRole("checkbox")).toBe(consent);
    expect(consent.getAttribute("data-state")).toBe("checked");
    expect(screen.getByText("JOIN-91")).toBeTruthy();
  });

  it("uses ticket-scoped draft metadata and reports metadata IDs to the parent", () => {
    mocks.drafts = query([meta], mocks.draftsRefetch);
    const change = vi.fn();
    render(
      h(AgentDocumentUploader, {
        verificationToken: "ticket",
        onDocumentsChange: change,
      })
    );
    expect(screen.getByText(meta.fileName)).toBeTruthy();
    expect(change).toHaveBeenLastCalledWith([ID]);
  });
  it("requires consent and rejects invalid MIME types and sizes before upload", async () => {
    const user = userEvent.setup();
    render(
      h(AgentDocumentUploader, {
        verificationToken: "ticket",
        onDocumentsChange: vi.fn(),
      })
    );
    const input = document.querySelector(
      "input[type=file]"
    ) as HTMLInputElement;
    expect(input.disabled).toBe(true);
    await user.click(screen.getByRole("checkbox"));
    fireEvent.change(input, {
      target: { files: [new File(["x"], "bad.txt", { type: "text/plain" })] },
    });
    expect(screen.getByRole("alert").textContent).toContain(
      "Only PDF, PNG and JPG"
    );
    fireEvent.change(input, {
      target: {
        files: [
          new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.pdf", {
            type: "application/pdf",
          }),
        ],
      },
    });
    expect(screen.getByRole("alert").textContent).toContain("up to 5 MB");
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("uploads a consented allowed document once while pending and refetches metadata", async () => {
    const user = userEvent.setup();
    let resolve!: (value: unknown) => void;
    mocks.upload.mockImplementationOnce(
      () =>
        new Promise(r => {
          resolve = r;
        })
    );
    render(
      h(AgentDocumentUploader, {
        verificationToken: "ticket",
        onDocumentsChange: vi.fn(),
      })
    );
    await user.click(screen.getByRole("checkbox"));
    const input = document.querySelector(
      "input[type=file]"
    ) as HTMLInputElement;
    const file = new File(["demo"], "id.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file], value: "" } });
    fireEvent.change(input, { target: { files: [file], value: "" } });
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(1));
    expect(mocks.upload).toHaveBeenCalledWith({
      verificationToken: "ticket",
      kind: "national_id",
      fileName: "id.pdf",
      mimeType: "application/pdf",
      base64: "ZGVtbw==",
      consent: true,
    });
    resolve(meta);
    await waitFor(() => expect(mocks.draftsRefetch).toHaveBeenCalledTimes(1));
  });
  it("offers retry after a failed drafts query without uploading", async () => {
    mocks.drafts = { ...query([], mocks.draftsRefetch), isError: true };
    const user = userEvent.setup();
    render(
      h(AgentDocumentUploader, {
        verificationToken: "ticket",
        onDocumentsChange: vi.fn(),
      })
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Could not load document drafts"
    );
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.draftsRefetch).toHaveBeenCalledTimes(1);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("uses the admin application list and converts a base64 download to a Blob link without a raw storage URL", async () => {
    render(h(AgentApplicationDocumentReview, { applicationId: 41 }));
    expect(
      screen.getByRole("region", { name: "Applicant documents" })
    ).toBeTruthy();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Download sample-id.pdf" }));
    await waitFor(() =>
      expect(mocks.download).toHaveBeenCalledWith({ documentId: ID })
    );
    expect(atob).toHaveBeenCalledWith("YWJj");
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(mocks.list.data)).not.toContain("storageUrl");
  });
  it("allows an administrator to retry an error without leaking a URL", async () => {
    mocks.download.mockRejectedValueOnce(new Error("download unavailable"));
    const user = userEvent.setup();
    render(h(AgentApplicationDocumentReview, { applicationId: 41 }));
    const download = screen.getByRole("button", {
      name: "Download sample-id.pdf",
    });
    await user.click(download);
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "download unavailable"
      )
    );
    await user.click(download);
    await waitFor(() => expect(mocks.download).toHaveBeenCalledTimes(2));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });
});
