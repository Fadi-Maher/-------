// @vitest-environment jsdom
import React from "react";
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
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  isEnglish: true,
  statusResult: {} as Record<string, unknown>,
  listResult: {} as Record<string, unknown>,
  submit: vi.fn(),
  review: vi.fn(),
  statusRefetch: vi.fn(),
  listRefetch: vi.fn(),
  applicationsInvalidate: vi.fn(),
  staffInvalidate: vi.fn(),
  staffCreate: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  exportXlsx: vi.fn(),
  exportPending: false,
  download: vi.fn(),
}));
vi.mock("@/lib/downloadFile", () => ({ downloadBase64File: mocks.download }));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: mocks.isEnglish ? "en" : "ar",
    isEnglish: mocks.isEnglish,
  }),
}));
vi.mock("@/components/AgentDocumentUploader", () => ({ AgentDocumentUploader: () => null }));
vi.mock("@/components/AgentApplicationDocumentReview", () => ({ AgentApplicationDocumentReview: () => null }));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    agentApplications: {
      status: { useQuery: () => mocks.statusResult },
      submit: {
        useMutation: () => ({ mutateAsync: mocks.submit, isPending: false }),
      },
      list: { useQuery: () => mocks.listResult },
      review: {
        useMutation: () => ({ mutateAsync: mocks.review, isPending: false }),
      },
      exportXlsx: {
        useMutation: () => ({ mutateAsync: mocks.exportXlsx, isPending: mocks.exportPending }),
      },
    },
    staffAccounts: {
      create: {
        useMutation: () => ({
          mutateAsync: mocks.staffCreate,
          isPending: false,
        }),
      },
    },
    useUtils: () => ({
      agentApplications: { list: { invalidate: mocks.applicationsInvalidate } },
      staffAccounts: { list: { invalidate: mocks.staffInvalidate } },
    }),
  },
}));

import { AgentApplicationsPanel } from "./components/AgentApplicationsPanel";
import { AgentJoinForm } from "./components/AgentJoinForm";

const h = React.createElement;

const pendingApplication = {
  id: 41,
  reference: "AG-0041",
  phone: "0500000004",
  fullName: "Amina Agent",
  email: "amina@example.test",
  city: "Riyadh",
  specialty: "Government services",
  experienceYears: 7,
  notes: "Available on weekdays",
  status: "pending" as const,
  reviewNote: null,
  createdAt: 1_710_000_000_000,
  reviewedAt: null,
  reviewedByUserId: null,
  activatedStaffAccountId: null,
};

function queryResult(data: unknown) {
  return {
    data,
    isLoading: false,
    isError: false,
    isFetching: false,
    error: null,
    refetch: mocks.listRefetch,
  };
}

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: () => document.body,
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isEnglish = true;
  mocks.statusRefetch.mockResolvedValue(undefined);
  mocks.listRefetch.mockResolvedValue(undefined);
  mocks.applicationsInvalidate.mockResolvedValue(undefined);
  mocks.staffInvalidate.mockResolvedValue(undefined);
  mocks.statusResult = {
    data: { hasActiveAgent: false, application: null },
    isLoading: false,
    isError: false,
    error: null,
    refetch: mocks.statusRefetch,
  };
  mocks.listResult = queryResult([pendingApplication]);
  mocks.exportPending = false;
});

afterEach(cleanup);

describe("agent membership application UI", () => {
  it("displays the actual pending review count and applicant summary from the list query", () => {
    render(h(AgentApplicationsPanel));

    expect(
      screen.getByRole("heading", { name: "Agent membership applications" })
    ).toBeTruthy();
    expect(screen.getByText("1 Pending review")).toBeTruthy();
    expect(screen.getByText("Amina Agent")).toBeTruthy();
    expect(screen.getByText("AG-0041")).toBeTruthy();
    expect(screen.getByText("Available on weekdays")).toBeTruthy();
  });

  it("filters letters by name rather than matching every phone and accepts Arabic phone digits", async () => {
    mocks.listResult = queryResult([
      pendingApplication,
      {
        ...pendingApplication,
        id: 42,
        reference: "AG-0042",
        fullName: "Zayd Agent",
        phone: "0500000042",
      },
    ]);
    const user = userEvent.setup();
    render(h(AgentApplicationsPanel));
    const search = screen.getByRole("searchbox", {
      name: "Search by mobile number or name",
    });
    await user.type(search, "Amina");
    expect(screen.getByText("Amina Agent")).toBeTruthy();
    expect(screen.queryByText("Zayd Agent")).toBeNull();
    await user.clear(search);
    await user.type(search, "٠٥٠٠٠٠٠٠٤٢");
    expect(screen.getByText("Zayd Agent")).toBeTruthy();
    expect(screen.queryByText("Amina Agent")).toBeNull();
  });

  it("finds an application from +966, 9-digit and Arabic-digit mobile variants and marks the exact match", async () => {
    mocks.listResult = queryResult([
      pendingApplication,
      { ...pendingApplication, id: 42, reference: "AG-0042", fullName: "Zayd Agent", phone: "0551234567" },
    ]);
    const user = userEvent.setup();
    render(h(AgentApplicationsPanel));
    const search = screen.getByRole("searchbox", { name: "Search by mobile number or name" });

    for (const variant of ["+966 55 123 4567", "551234567", "٠٥٥١٢٣٤٥٦٧", "00966551234567"]) {
      await user.clear(search);
      await user.type(search, variant);
      expect(screen.getByText("Zayd Agent")).toBeTruthy();
      expect(screen.queryByText("Amina Agent")).toBeNull();
      expect(screen.getByText("Exact mobile match")).toBeTruthy();
      expect(screen.getByText("Searching by mobile · 1 matching application")).toBeTruthy();
    }
    // The matched digits are highlighted inside the stored number.
    expect(document.querySelector("mark")?.textContent).toBe("0551234567");

    // A partial number still filters, without claiming an exact match.
    await user.clear(search);
    await user.type(search, "0551");
    expect(screen.getByText("Zayd Agent")).toBeTruthy();
    expect(screen.queryByText("Exact mobile match")).toBeNull();
    expect(document.querySelector("mark")?.textContent).toBe("0551");
  });

  it("shows match counts per status and jumps to the status that holds the searched mobile", async () => {
    mocks.listResult = queryResult([
      pendingApplication,
      {
        ...pendingApplication,
        id: 43,
        reference: "AG-0043",
        fullName: "Huda Approved",
        phone: "0567654321",
        status: "approved",
        reviewedAt: 1_710_100_000_000,
      },
    ]);
    const user = userEvent.setup();
    render(h(AgentApplicationsPanel));
    await user.type(screen.getByRole("searchbox", { name: "Search by mobile number or name" }), "0567654321");

    // Default filter is "Pending": no match there, but the approved match is offered.
    expect(screen.queryByText("Huda Approved")).toBeNull();
    expect(screen.getByText("No match in this status. Matches were found in:")).toBeTruthy();
    const filters = screen.getByRole("group", { name: "Application status filter" });
    expect(within(filters).getByRole("button", { name: /Approved\s*1/ })).toBeTruthy();
    expect(within(filters).getByRole("button", { name: /Pending\s*0/ })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Approved (1)" }));
    expect(screen.getByText("Huda Approved")).toBeTruthy();
    expect(within(filters).getByRole("button", { name: /Approved\s*1/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("clears the search with the clear button and the Escape key", async () => {
    mocks.listResult = queryResult([
      pendingApplication,
      { ...pendingApplication, id: 42, reference: "AG-0042", fullName: "Zayd Agent", phone: "0551234567" },
    ]);
    const user = userEvent.setup();
    render(h(AgentApplicationsPanel));
    const search = screen.getByRole("searchbox", { name: "Search by mobile number or name" }) as HTMLInputElement;

    await user.type(search, "0551234567");
    expect(screen.queryByText("Amina Agent")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(search.value).toBe("");
    expect(document.activeElement).toBe(search);
    expect(screen.getByText("Amina Agent")).toBeTruthy();

    await user.type(search, "Zayd");
    await user.keyboard("{Escape}");
    expect(search.value).toBe("");
    expect(screen.getByText("Amina Agent")).toBeTruthy();
    expect(screen.getByText("Zayd Agent")).toBeTruthy();
  });

  it("shows the templated rejection notice with the reason and announces it once on sign-in", () => {
    window.sessionStorage.clear();
    const rejected = {
      ...pendingApplication,
      status: "rejected" as const,
      reviewNote: "Please attach a valid work license.",
      reviewedAt: 1_710_200_000_000,
    };
    mocks.statusResult = {
      data: {
        hasActiveAgent: false,
        application: rejected,
        decisionNotice: {
          status: "rejected",
          type: "agent_application_rejected",
          title: "لم تتم الموافقة على طلب انضمامك",
          message: "نعتذر أمينة، لم تتم الموافقة على طلب الانضمام JOIN-41.",
          titleEn: "Your application was not approved",
          messageEn: "Sorry Amina, application JOIN-41 was not approved. See the reason below.",
        },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: mocks.statusRefetch,
    };
    const { unmount } = render(h(AgentJoinForm, { verificationToken: "verified-token", phone: "0500000004" }));

    const notice = screen.getByRole("status");
    expect(notice.getAttribute("data-decision")).toBe("rejected");
    expect(within(notice).getByRole("heading", { name: "Your application was not approved" })).toBeTruthy();
    expect(within(notice).getByText("Sorry Amina, application JOIN-41 was not approved. See the reason below.")).toBeTruthy();
    expect(within(notice).getByText("Reason for the decision")).toBeTruthy();
    expect(within(notice).getByText("Please attach a valid work license.")).toBeTruthy();
    expect(within(notice).getByText("AG-0041")).toBeTruthy();
    expect(within(notice).getByRole("link", { name: "Contact support" }).getAttribute("href")).toBe("/contact");
    expect(within(notice).getByRole("link", { name: "Joining requirements" }).getAttribute("href")).toBe("/join-as-agent");
    // The applicant cannot re-submit from a rejected application.
    expect(screen.queryByLabelText("Full name")).toBeNull();
    expect(mocks.toastError).toHaveBeenCalledTimes(1);
    expect(mocks.toastError).toHaveBeenCalledWith("Your application was not approved");

    // Re-opening the same session does not announce it again.
    unmount();
    render(h(AgentJoinForm, { verificationToken: "verified-token", phone: "0500000004" }));
    expect(mocks.toastError).toHaveBeenCalledTimes(1);
  });

  it("falls back to the Arabic decision text when no English text is stored", () => {
    window.sessionStorage.clear();
    mocks.isEnglish = false;
    mocks.statusResult = {
      data: {
        hasActiveAgent: false,
        application: { ...pendingApplication, status: "rejected", reviewNote: "السبب", reviewedAt: 1_710_200_000_000 },
        decisionNotice: {
          status: "rejected",
          type: "agent_application_rejected",
          title: "لم تتم الموافقة على طلب انضمامك",
          message: "نعتذر، لم تتم الموافقة.",
          titleEn: null,
          messageEn: null,
        },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: mocks.statusRefetch,
    };
    render(h(AgentJoinForm, { verificationToken: "verified-token", phone: "0500000004" }));
    const notice = screen.getByRole("status");
    expect(notice.getAttribute("dir")).toBe("rtl");
    expect(within(notice).getByRole("heading", { name: "لم تتم الموافقة على طلب انضمامك" })).toBeTruthy();
    expect(within(notice).getByText("سبب القرار")).toBeTruthy();
  });

  it("requires explicit consent before an applicant can submit details", async () => {
    const user = userEvent.setup();
    render(
      h(AgentJoinForm, {
        verificationToken: "verified-token",
        phone: "0500000004",
      })
    );

    await user.type(screen.getByLabelText("Full name"), "Amina Agent");
    await user.type(
      screen.getByLabelText("Email address"),
      "amina@example.test"
    );
    await user.type(screen.getByLabelText("City"), "Riyadh");
    await user.type(screen.getByLabelText("Specialty"), "Government services");
    await user.clear(screen.getByLabelText("Years of experience"));
    await user.type(screen.getByLabelText("Years of experience"), "7");
    fireEvent.submit(screen.getByLabelText("Full name").closest("form")!);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "You must agree"
    );
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it("submits only the reviewed application payload and never creates a staff role before approval", async () => {
    const user = userEvent.setup();
    mocks.submit.mockResolvedValue({ ...pendingApplication });
    render(
      h(AgentJoinForm, {
        verificationToken: "verified-token",
        phone: "0500000004",
      })
    );

    await user.type(screen.getByLabelText("Full name"), "Amina Agent");
    await user.type(
      screen.getByLabelText("Email address"),
      "amina@example.test"
    );
    await user.type(screen.getByLabelText("City"), "Riyadh");
    await user.type(screen.getByLabelText("Specialty"), "Government services");
    await user.click(
      screen.getByRole("checkbox", { name: /I agree to send/i })
    );
    await user.click(
      screen.getByRole("button", { name: "Send application for review" })
    );

    await waitFor(() =>
      expect(mocks.submit).toHaveBeenCalledWith({
        verificationToken: "verified-token",
        fullName: "Amina Agent",
        email: "amina@example.test",
        city: "Riyadh",
        specialty: "Government services",
        experienceYears: 0,
        consent: true,
        documentIds: [],
      })
    );
    expect(mocks.submit.mock.calls[0]?.[0]).not.toHaveProperty("phone");
    expect(mocks.staffCreate).not.toHaveBeenCalled();
    expect(screen.getByText("Application received")).toBeTruthy();
    expect(screen.getByText("AG-0041")).toBeTruthy();
  });

  it("requires a meaningful rejection reason before review and does not mutate otherwise", async () => {
    const user = userEvent.setup();
    render(h(AgentApplicationsPanel));

    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.click(screen.getByRole("button", { name: "Confirm rejection" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "at least 3 characters"
    );
    expect(mocks.review).not.toHaveBeenCalled();
  });

  it("shows approval permissions in the confirmation dialog and sends them only after confirmation", async () => {
    const user = userEvent.setup();
    mocks.review.mockResolvedValue({
      ...pendingApplication,
      status: "approved",
    });
    render(h(AgentApplicationsPanel));

    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(
      screen.getByRole("heading", { name: "Approve and activate this agent?" })
    ).toBeTruthy();
    expect(
      screen
        .getByRole("switch", { name: "View assigned requests" })
        .getAttribute("aria-checked")
    ).toBe("true");
    expect(
      screen
        .getByRole("switch", { name: "Update request status" })
        .getAttribute("aria-checked")
    ).toBe("true");
    expect(
      screen
        .getByRole("switch", { name: "Add customer update" })
        .getAttribute("aria-checked")
    ).toBe("true");
    expect(mocks.review).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Confirm approval and activation" })
    );
    await waitFor(() =>
      expect(mocks.review).toHaveBeenCalledWith({
        id: 41,
        decision: "approved",
        permissions: {
          canViewAssigned: true,
          canUpdateStatus: true,
          canAddCustomerUpdate: true,
        },
      })
    );
    expect(mocks.applicationsInvalidate).toHaveBeenCalledTimes(1);
    expect(mocks.staffInvalidate).toHaveBeenCalledTimes(1);
  });

  it("resets the review form after a successful decision", async () => {
    const user = userEvent.setup();
    mocks.review.mockResolvedValue({
      ...pendingApplication,
      status: "rejected",
      reviewNote: "Not available",
    });
    render(h(AgentApplicationsPanel));

    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.type(
      screen.getByLabelText("Reason for decision"),
      "Not available"
    );
    await user.click(screen.getByRole("button", { name: "Confirm rejection" }));
    await waitFor(() => expect(mocks.review).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await user.click(screen.getByRole("button", { name: "Reject" }));
    expect(
      (screen.getByLabelText("Reason for decision") as HTMLTextAreaElement)
        .value
    ).toBe("");
  });
});

describe("agent applications Excel export", () => {
  const xlsx = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  it("exports exactly the visible search results and confirms with a success toast", async () => {
    mocks.listResult = queryResult([
      pendingApplication,
      { ...pendingApplication, id: 42, reference: "AG-0042", fullName: "Zayd Agent", phone: "0551234567" },
    ]);
    mocks.exportXlsx.mockResolvedValue({ fileName: "maalamati-agent-applications-20261020-1730.xlsx", mimeType: xlsx, base64: "UEsDBA==", count: 1, truncated: false });
    const user = userEvent.setup();
    render(h(AgentApplicationsPanel));
    expect(screen.getByRole("button", { name: "Export 2 visible applications to an Excel file" })).toBeTruthy();
    await user.type(screen.getByRole("searchbox", { name: "Search by mobile number or name" }), "+966 55 123 4567");
    await user.click(screen.getByRole("button", { name: "Export 1 visible application to an Excel file" }));
    await waitFor(() => expect(mocks.download).toHaveBeenCalledWith("UEsDBA==", "maalamati-agent-applications-20261020-1730.xlsx", xlsx));
    expect(mocks.exportXlsx).toHaveBeenCalledWith(
      expect.objectContaining({ query: "+966 55 123 4567", status: "pending", language: "en", timeZone: expect.any(String) })
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Exported 1 application to Excel", {
      description: "The file matches the current search and status filter.",
    });
  });

  it("is disabled when the current view has no applications", async () => {
    const user = userEvent.setup();
    render(h(AgentApplicationsPanel));
    await user.type(screen.getByRole("searchbox", { name: "Search by mobile number or name" }), "0590000000");
    const button = screen.getByRole("button", { name: "No applications to export in this view." });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    await user.click(button);
    expect(mocks.exportXlsx).not.toHaveBeenCalled();
  });

  it("shows an Arabic loading label while exporting and an error toast on failure", async () => {
    mocks.isEnglish = false;
    mocks.exportPending = true;
    const { unmount } = render(h(AgentApplicationsPanel));
    const busy = screen.getByRole("button", { name: "تصدير 1 من الطلبات الظاهرة إلى ملف Excel" });
    expect(busy.textContent).toContain("جارٍ التصدير…");
    expect(busy.getAttribute("aria-busy")).toBe("true");
    expect((busy as HTMLButtonElement).disabled).toBe(true);
    unmount();
    mocks.exportPending = false;
    mocks.exportXlsx.mockRejectedValue(new Error(""));
    const user = userEvent.setup();
    render(h(AgentApplicationsPanel));
    await user.click(screen.getByRole("button", { name: "تصدير 1 من الطلبات الظاهرة إلى ملف Excel" }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("تعذر تصدير الملف. حاول مرة أخرى."));
    expect(mocks.download).not.toHaveBeenCalled();
  });
});
