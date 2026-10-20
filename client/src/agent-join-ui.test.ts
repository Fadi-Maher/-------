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
    const search = screen.getByRole("textbox", {
      name: "Search by name or mobile number",
    });
    await user.type(search, "Amina");
    expect(screen.getByText("Amina Agent")).toBeTruthy();
    expect(screen.queryByText("Zayd Agent")).toBeNull();
    await user.clear(search);
    await user.type(search, "٠٥٠٠٠٠٠٠٤٢");
    expect(screen.getByText("Zayd Agent")).toBeTruthy();
    expect(screen.queryByText("Amina Agent")).toBeNull();
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
