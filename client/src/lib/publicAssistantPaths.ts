/**
 * Pages where the floating site assistant must not appear: owner, team, agent
 * and customer workspaces, plus their login pages. Everything else is public.
 */
export const PRIVATE_ASSISTANT_PATH_PREFIXES = [
  "/dashboard",
  "/employees",
  "/agents",
  "/audit",
  "/customers",
  "/settings",
  "/owner-login",
  "/team-login",
  "/agent-dashboard",
  "/employee-dashboard",
  "/team-request",
  "/sales-assistant",
  "/support-inbox",
] as const;
/**
 * Public pages that already show their own full-page chat (the request support
 * assistant). The floating sales launcher would cover their message box.
 */
export const DEDICATED_ASSISTANT_PAGES = ["/support"] as const;

export function isPublicAssistantPath(pathname: string) {
  const path = (pathname || "/").split(/[?#]/)[0] || "/";
  if (DEDICATED_ASSISTANT_PAGES.some((page) => path === page || path.startsWith(`${page}/`))) return false;
  return !PRIVATE_ASSISTANT_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
