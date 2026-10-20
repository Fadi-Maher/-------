import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

// Fake only the staff-account lookup: no rows are written to shared tables.
const staffRows = vi.hoisted(() => ({ value: [] as Array<{ fullName: string | null }> }));
vi.mock("../db", async (importOriginal) => {
  const original = await importOriginal<typeof import("../db")>();
  const fakeDb = { select: () => ({ from: () => ({ where: () => ({ limit: async () => staffRows.value }) }) }) };
  return { ...original, getDb: vi.fn(async () => fakeDb) };
});

import { appRouter } from "../routers";
import { DEFAULT_LEAD_BOT_SETTINGS } from "./settings";
import { requireStaff, resolveStaffRole } from "./staff";

function caller(user: TrpcContext["user"]) {
  return appRouter.createCaller({
    user,
    req: { headers: {}, ip: "203.0.113.90" } as unknown as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  });
}

function sessionUser(role: "admin" | "user" | "employee" | "agent", id: number) {
  return {
    id,
    openId: `leadbot-roles-${role}-${id}`,
    name: `${role} ${id}`,
    email: null,
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } as TrpcContext["user"];
}

const settingsInput = {
  enabled: DEFAULT_LEAD_BOT_SETTINGS.enabled,
  aiAssist: false,
  offerHumanToHotLeads: true,
  autoEscalateAfterFallbacks: 2,
  workingDays: [0, 1, 2, 3, 4],
  workStartHour: 9,
  workEndHour: 18,
  responseSlaAr: "خلال 30 دقيقة",
  responseSlaEn: "Within 30 minutes",
  whatsappNumber: "",
  services: [],
};

beforeEach(() => {
  staffRows.value = [];
});

describe("sales assistant roles (server-side)", () => {
  it("owner: admin session gets full access without a staff lookup", async () => {
    expect(await resolveStaffRole({ id: 1, role: "admin", name: "المالك" })).toEqual({ role: "owner", name: "المالك" });
  });

  it("sales employee: active staff account gets the dashboard but never the settings", async () => {
    staffRows.value = [{ fullName: "موظفة المبيعات" }];
    const employee = sessionUser("employee", 4101);
    expect(await requireStaff(employee)).toEqual({ role: "staff", name: "موظفة المبيعات" });
    await expect(requireStaff(employee, { ownerOnly: true })).rejects.toMatchObject({ code: "FORBIDDEN", message: "owner_only" });
    expect(await caller(employee).leadBot.staff.access()).toEqual({ role: "staff", name: "موظفة المبيعات" });
    await expect(caller(employee).leadBot.staff.getSettings()).rejects.toMatchObject({ code: "FORBIDDEN", message: "owner_only" });
    await expect(caller(employee).leadBot.staff.saveSettings(settingsInput)).rejects.toMatchObject({ code: "FORBIDDEN", message: "owner_only" });
  });

  it("employee without an active sales account, agents, customers and visitors are refused", async () => {
    await expect(requireStaff(sessionUser("employee", 4102))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller(sessionUser("agent", 4103)).leadBot.staff.list({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller(sessionUser("user", 4104)).leadBot.staff.list({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller(sessionUser("agent", 4103)).leadBot.staff.saveSettings(settingsInput)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller(null).leadBot.staff.list({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller(null).leadBot.staff.getSettings()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(await caller(sessionUser("agent", 4103)).leadBot.staff.access()).toEqual({ role: null, name: null });
  });
});
