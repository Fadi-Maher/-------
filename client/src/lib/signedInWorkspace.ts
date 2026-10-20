import { useAuth } from "@/_core/hooks/useAuth";
import { CUSTOMER_SESSION_EVENT, readCustomerSession, type CustomerSession } from "@/lib/customerSession";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export type SignedInWorkspace = {
  kind: "customer" | "agent" | "employee";
  href: "/customer-account" | "/agent-dashboard" | "/employee-dashboard";
  name: string;
};

type SessionUser = { role?: string | null; name?: string | null } | null | undefined;

/**
 * A visitor who already has a customer, agent or employee session must open that
 * workspace instead of starting another sign-in. The owner (admin) session is
 * intentionally excluded so the owner can still test the public sign-in flow.
 */
export function resolveSignedInWorkspace(user: SessionUser, customer: CustomerSession | null): SignedInWorkspace | null {
  if (user?.role === "agent") return { kind: "agent", href: "/agent-dashboard", name: user.name?.trim() || "" };
  if (user?.role === "employee") return { kind: "employee", href: "/employee-dashboard", name: user.name?.trim() || "" };
  if (customer) return { kind: "customer", href: "/customer-account", name: customer.name };
  return null;
}

function readStoredCustomer() {
  if (typeof window === "undefined") return null;
  try {
    return readCustomerSession(window.localStorage);
  } catch {
    return null;
  }
}

export function useStoredCustomerSession() {
  const [session, setSession] = useState<CustomerSession | null>(() => readStoredCustomer());
  useEffect(() => {
    const refresh = () => setSession(readStoredCustomer());
    refresh();
    window.addEventListener(CUSTOMER_SESSION_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(CUSTOMER_SESSION_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return session;
}

export function useSignedInWorkspace() {
  const { user, loading } = useAuth();
  const customer = useStoredCustomerSession();
  return { workspace: resolveSignedInWorkspace(user, customer), loading };
}

export function workspaceLabel(workspace: SignedInWorkspace, isEnglish: boolean) {
  if (workspace.kind === "agent") return isEnglish ? "Agent workspace" : "بوابة المعقب";
  if (workspace.kind === "employee") return isEnglish ? "Employee workspace" : "بوابة الموظف";
  return isEnglish ? "My requests" : "طلباتي";
}

export function alreadySignedInMessage(workspace: SignedInWorkspace, isEnglish: boolean) {
  const destination = workspaceLabel(workspace, isEnglish);
  return isEnglish
    ? { title: `You're already signed in${workspace.name ? ` as ${workspace.name}` : ""}.`, description: `We opened ${destination}. Sign out first to use another account.` }
    : { title: `أنت مسجّل الدخول بالفعل${workspace.name ? ` باسم ${workspace.name}` : ""}.`, description: `فتحنا لك ${destination}. سجّل الخروج أولًا إذا أردت الدخول بحساب آخر.` };
}

/**
 * Old sign-in pages (/login, /customer-signup, /agent-login) must not offer a second
 * sign-in to someone who is already signed in; they are sent to their workspace.
 */
export function useRedirectSignedInVisitor(isEnglish: boolean) {
  const { workspace } = useSignedInWorkspace();
  const [, navigate] = useLocation();
  const href = workspace?.href;
  useEffect(() => {
    if (!workspace) return;
    const copy = alreadySignedInMessage(workspace, isEnglish);
    toast.info(copy.title, { description: copy.description });
    navigate(workspace.href, { replace: true });
    // Run once per destination, not on every language/name re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href]);
  return workspace;
}
