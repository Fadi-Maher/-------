export const WELCOME_STORAGE_KEY = "maalamati-care-welcome-v1";

export function shouldShowWelcome(
  location: Pick<Location, "pathname" | "hash">,
  storage?: Pick<Storage, "getItem">
): boolean {
  if (location.pathname !== "/" || location.hash !== "") return false;
  try {
    return storage?.getItem(WELCOME_STORAGE_KEY) !== "seen";
  } catch {
    return true;
  }
}

export function markWelcomeSeen(storage?: Pick<Storage, "setItem">): void {
  try {
    storage?.setItem(WELCOME_STORAGE_KEY, "seen");
  } catch {
    /* Continue normally when storage is unavailable. */
  }
}

export function browserWelcomeStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
