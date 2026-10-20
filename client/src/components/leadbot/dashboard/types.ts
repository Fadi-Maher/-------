import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../../server/routers";

type Outputs = inferRouterOutputs<AppRouter>["leadBot"]["staff"];
type Inputs = inferRouterInputs<AppRouter>["leadBot"]["staff"];

export type StaffAccess = Outputs["access"];
export type LeadListResult = Outputs["list"];
export type StaffLead = LeadListResult["leads"][number];
export type LeadDetailResult = Outputs["get"];
export type DetailMessage = LeadDetailResult["messages"][number];
export type LeadAnalytics = Outputs["analytics"];
export type LeadBotSettingsView = Outputs["getSettings"];
export type LeadListFiltersInput = Inputs["list"];
export type SettingsInput = Inputs["saveSettings"];
export type AnalyticsRange = Inputs["analytics"]["rangeDays"];
