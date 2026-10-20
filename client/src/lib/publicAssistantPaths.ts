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
] as const;

export function isPublicAssistantPath(pathname: string) {
  const path = (pathname || "/").split(/[?#]/)[0] || "/";
  return !PRIVATE_ASSISTANT_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
