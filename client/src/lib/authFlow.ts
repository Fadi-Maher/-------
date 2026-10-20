import { toast } from "sonner";

export type AuthIntent = "signin" | "signup";
export type AuthAudience = "choose" | "customer" | "agent";
export type AuthenticatedActor = { role: "customer" | "agent"; name: string; isNew?: boolean };
export type AuthModalRequest = { intent: AuthIntent; audience?: AuthAudience; trigger?: HTMLElement | null };
export const AUTH_MODAL_OPEN_EVENT = "maalamati:open-auth-modal";
export const AUTH_COMPLETED_EVENT = "maalamati:auth-completed";

export function openAuthModal(request: AuthModalRequest = { intent: "signin" }) {
  window.dispatchEvent(new CustomEvent<AuthModalRequest>(AUTH_MODAL_OPEN_EVENT, { detail: request }));
}

export function getAuthenticatedWorkspace(role: AuthenticatedActor["role"]): "/customer-account" | "/agent-dashboard" {
  if (role === "customer") return "/customer-account";
  if (role === "agent") return "/agent-dashboard";
  throw new Error("Unsupported authenticated account role");
}

// Call only after server verification and session persistence/refresh succeeded.
// The selected UI tab never grants a role or replaces the server's permissions.
export function finishSignIn(actor: AuthenticatedActor, isEnglish: boolean, navigate: (path: string) => void) {
  const destination = getAuthenticatedWorkspace(actor.role);
  window.dispatchEvent(new Event(AUTH_COMPLETED_EVENT));
  toast.success(isEnglish ? `Welcome${actor.isNew ? " to Maalamati Care" : " back"}, ${actor.name}` : `${actor.isNew ? "أهلًا بك في معاملاتي كير" : "مرحبًا بعودتك"}، ${actor.name}`, {
    description: actor.role === "agent" ? (isEnglish ? "Your agent workspace is ready." : "لوحة المعقب جاهزة لك.") : (isEnglish ? "Your customer dashboard is ready." : "لوحة حسابك وطلباتك جاهزة لك."),
  });
  navigate(destination);
}
