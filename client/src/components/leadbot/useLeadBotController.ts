/**
 * Conversation controller for the Maalamati Care sales assistant widget.
 * Ported from the approved reference controller, adapted to the site's tRPC
 * contract (numeric message ids, `afterId` polling) and to the storage-consent
 * rule: nothing is sent to the server before the visitor agrees to saving.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Lang } from "@shared/leadBot/catalog";
import type { BotActionType } from "@shared/leadBot/engine";
import type { ConversationView, DisabledView, PublicHandoff, PublicMessage, TurnView } from "../../../../server/leadBot/service";

export const LEAD_BOT_TOKEN_KEY = "mm-leadbot-token";
export const LEAD_BOT_CONSENT_KEY = "mm-leadbot-consent";
const POLL_INTERVAL_MS = 4000;

export type SendPayload = { clientId: string; text?: string; quickReply?: string; label?: string };
export type PollResult = { stage: TurnView["stage"]; locked: boolean; handoff: PublicHandoff | null; messages: PublicMessage[] };

export type LeadBotTransport = {
  config(): Promise<{ enabled: boolean; whatsappNumber: string | null }>;
  start(input: { token?: string | null; lang: Lang; pagePath?: string | null; consentToStore?: boolean }): Promise<ConversationView | DisabledView>;
  restart(input: { token: string; lang: Lang }): Promise<ConversationView | DisabledView>;
  send(input: SendPayload & { token: string }): Promise<TurnView>;
  poll(input: { token: string; afterId: number }): Promise<PollResult>;
  track(input: { token: string; action: BotActionType }): Promise<unknown>;
};

export type UiMessage = Omit<PublicMessage, "id"> & {
  id: number | string;
  localStatus?: "sending" | "failed";
  retryPayload?: SendPayload;
};

export type LeadBotStatus = "idle" | "loading" | "consent" | "declined" | "disabled" | "ready" | "error";
export type LeadBotErrorKind = "rate_limited" | "not_found" | "forbidden" | "network" | "unknown";
export type LeadBotError = { kind: LeadBotErrorKind; scope: "start" | "send" | "poll" };

export function classifyLeadBotError(error: unknown): LeadBotErrorKind {
  const value = error as { data?: { code?: string }; code?: string; message?: string } | null;
  const code = value?.data?.code ?? value?.code;
  if (code === "TOO_MANY_REQUESTS") return "rate_limited";
  if (code === "NOT_FOUND") return "not_found";
  if (code === "FORBIDDEN") return "forbidden";
  const cause = (error as { cause?: unknown } | null)?.cause;
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  if (offline || error instanceof TypeError || cause instanceof TypeError || /failed to fetch|network ?error|load failed/i.test(value?.message ?? "")) return "network";
  return "unknown";
}

function isConsentRequired(error: unknown) {
  const value = error as { message?: string } | null;
  return value?.message === "consent_required";
}

function newClientId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `c-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Merge server messages into the list without duplicates, ordered by time. */
export function mergeMessages(current: UiMessage[], incoming: PublicMessage[]): UiMessage[] {
  const known = new Set(current.map((message) => message.id));
  const fresh = incoming.filter((message) => !known.has(message.id));
  if (!fresh.length) return current;
  return [...current, ...fresh].sort((a, b) => a.createdAt - b.createdAt);
}

function lastServerId(messages: UiMessage[]) {
  let max = 0;
  for (const message of messages) if (typeof message.id === "number" && message.id > max) max = message.id;
  return max;
}

function readStorage(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(key: string, value: string | null) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* storage unavailable: the chat still works for this page view */
  }
}

export function useLeadBotController(options: { transport: LeadBotTransport; lang: Lang; pagePath: string | null; pollIntervalMs?: number }) {
  const { transport, lang, pagePath } = options;
  const pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS;
  const [status, setStatus] = useState<LeadBotStatus>("idle");
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [stage, setStage] = useState<TurnView["stage"] | null>(null);
  const [step, setStep] = useState<TurnView["step"]>(null);
  const [locked, setLocked] = useState(false);
  const [handoff, setHandoff] = useState<PublicHandoff | null>(null);
  const [awaitingReply, setAwaitingReply] = useState(false);
  const [error, setError] = useState<LeadBotError | null>(null);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [resumed, setResumed] = useState(false);
  const [unread, setUnread] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const flushingRef = useRef(false);
  const messagesRef = useRef<UiMessage[]>([]);
  const isOpenRef = useRef(false);
  const langRef = useRef(lang);
  const statusRef = useRef<LeadBotStatus>(status);
  messagesRef.current = messages;
  isOpenRef.current = isOpen;
  statusRef.current = status;

  const applyView = useCallback((view: ConversationView, extra: UiMessage[] = [], markResumed = view.resumed) => {
    tokenRef.current = view.token;
    writeStorage(LEAD_BOT_TOKEN_KEY, view.token);
    setMessages(extra.length ? [...view.messages, ...extra] : view.messages);
    setStage(view.stage);
    setStep(view.step);
    setLocked(view.locked);
    setHandoff(view.handoff);
    setResumed(markResumed);
    setStatus("ready");
    setError(null);
  }, []);

  const applyDisabled = useCallback((view: DisabledView) => {
    setWhatsappNumber(view.whatsappNumber);
    setStatus("disabled");
  }, []);

  const begin = useCallback(
    async (consentToStore: boolean) => {
      setStatus("loading");
      setError(null);
      const token = tokenRef.current ?? readStorage(LEAD_BOT_TOKEN_KEY);
      try {
        if (!token && !consentToStore) {
          const config = await transport.config();
          setWhatsappNumber(config.whatsappNumber);
          setStatus(config.enabled ? "consent" : "disabled");
          return;
        }
        const view = await transport.start({ token, lang: langRef.current, pagePath, consentToStore: consentToStore || undefined });
        if (view.disabled) applyDisabled(view);
        else applyView(view);
      } catch (cause) {
        if (isConsentRequired(cause)) {
          writeStorage(LEAD_BOT_CONSENT_KEY, null);
          tokenRef.current = null;
          writeStorage(LEAD_BOT_TOKEN_KEY, null);
          setStatus("consent");
          return;
        }
        setStatus("error");
        setError({ kind: classifyLeadBotError(cause), scope: "start" });
      }
    },
    [transport, pagePath, applyView, applyDisabled],
  );

  const start = useCallback(() => begin(readStorage(LEAD_BOT_CONSENT_KEY) === "1"), [begin]);

  const acceptConsent = useCallback(() => {
    writeStorage(LEAD_BOT_CONSENT_KEY, "1");
    return begin(true);
  }, [begin]);

  const declineConsent = useCallback(() => setStatus("declined"), []);

  const open = useCallback(() => {
    setIsOpen(true);
    setUnread(0);
    if (statusRef.current === "idle" || statusRef.current === "error") void start();
  }, [start]);

  const close = useCallback(() => setIsOpen(false), []);

  // Keep the conversation language in sync with the site language.
  useEffect(() => {
    if (langRef.current === lang) return;
    langRef.current = lang;
    const token = tokenRef.current;
    if (!token || status !== "ready") return;
    transport
      .start({ token, lang, pagePath })
      .then((view) => {
        if (!view.disabled) applyView(view, messagesRef.current.filter((message) => message.localStatus === "failed"), false);
      })
      .catch(() => {
        /* language sync is best effort */
      });
  }, [lang, status, transport, pagePath, applyView]);

  const deliver = useCallback(
    async (payload: SendPayload, localId: string): Promise<boolean> => {
      const token = tokenRef.current;
      if (!token) return false;
      busyRef.current = true;
      setAwaitingReply(true);
      setError(null);
      try {
        const turn = await transport.send({ ...payload, token });
        setMessages((current) => mergeMessages(current.filter((message) => message.id !== localId), turn.messages));
        setStage(turn.stage);
        setStep(turn.step);
        setLocked(turn.locked);
        setHandoff(turn.handoff);
        setResumed(false);
        return true;
      } catch (cause) {
        const kind = classifyLeadBotError(cause);
        setMessages((current) => current.map((message) => (message.id === localId ? { ...message, localStatus: "failed" } : message)));
        if (kind === "not_found") {
          tokenRef.current = null;
          writeStorage(LEAD_BOT_TOKEN_KEY, null);
          try {
            const view = await transport.start({ lang: langRef.current, pagePath, consentToStore: true });
            if (view.disabled) applyDisabled(view);
            else {
              const pending = messagesRef.current
                .filter((message) => message.localStatus === "failed" || message.id === localId)
                .map((message) => ({ ...message, localStatus: "failed" as const }));
              applyView(view, pending, false);
            }
            setError({ kind: "not_found", scope: "send" });
          } catch (startError) {
            setStatus("error");
            setError({ kind: classifyLeadBotError(startError), scope: "start" });
          }
        } else {
          if (kind === "forbidden") setLocked(true);
          setError({ kind, scope: "send" });
        }
        return false;
      } finally {
        busyRef.current = false;
        setAwaitingReply(false);
      }
    },
    [transport, pagePath, applyView, applyDisabled],
  );

  const send = useCallback(
    async (input: { text?: string; quickReply?: string; label?: string }) => {
      // Failed messages form a queue: nothing new is sent before it is emptied, so the order stays intact.
      if (busyRef.current || flushingRef.current || status !== "ready" || locked) return false;
      if (messagesRef.current.some((message) => message.localStatus === "failed")) return false;
      const text = input.text?.trim();
      if (!text && !input.quickReply) return false;
      const clientId = newClientId();
      const localId = `local-${clientId}`;
      const payload: SendPayload = { clientId, text, quickReply: input.quickReply, label: input.label };
      setMessages((current) => [
        ...current,
        { id: localId, clientId, role: "user", text: input.label ?? text ?? "", reply: null, authorName: null, createdAt: Date.now(), localStatus: "sending", retryPayload: payload },
      ]);
      await deliver(payload, localId);
      return true;
    },
    [deliver, status, locked],
  );

  /** Re-send every failed message in its original order (same clientId, so the server replays duplicates). */
  const flushFailed = useCallback(async () => {
    if (flushingRef.current || busyRef.current) return;
    flushingRef.current = true;
    const attempted = new Set<string | number>();
    try {
      for (;;) {
        const next = messagesRef.current.find((item) => item.localStatus === "failed" && item.retryPayload && !attempted.has(item.id));
        if (!next || typeof next.id !== "string" || !next.retryPayload) break;
        if (typeof navigator !== "undefined" && !navigator.onLine) break;
        attempted.add(next.id);
        const id = next.id;
        setMessages((current) => current.map((item) => (item.id === id ? { ...item, localStatus: "sending" } : item)));
        const delivered = await deliver(next.retryPayload, id);
        if (!delivered) break;
      }
    } finally {
      flushingRef.current = false;
    }
  }, [deliver]);

  const retry = useCallback(async (_id?: string | number) => flushFailed(), [flushFailed]);

  const discard = useCallback((id: string | number) => {
    setMessages((current) => current.filter((message) => message.id !== id));
  }, []);

  const restart = useCallback(async () => {
    const token = tokenRef.current;
    setStatus("loading");
    setAwaitingReply(false);
    try {
      const view = token ? await transport.restart({ token, lang: langRef.current }) : await transport.start({ lang: langRef.current, pagePath, consentToStore: true });
      if (view.disabled) applyDisabled(view);
      else applyView(view, [], false);
    } catch (cause) {
      const kind = classifyLeadBotError(cause);
      if (kind === "not_found") {
        tokenRef.current = null;
        writeStorage(LEAD_BOT_TOKEN_KEY, null);
        await begin(true);
        return;
      }
      setStatus(kind === "forbidden" ? "ready" : "error");
      setError({ kind, scope: "start" });
    }
  }, [transport, pagePath, applyView, applyDisabled, begin]);

  const trackAction = useCallback(
    (action: BotActionType) => {
      const token = tokenRef.current;
      if (token) transport.track({ token, action }).catch(() => undefined);
    },
    [transport],
  );

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      void flushFailed();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [flushFailed]);

  const escalated = (!!handoff && handoff.status !== "resolved") || stage === "escalated";
  useEffect(() => {
    if (!escalated || status !== "ready") return;
    let cancelled = false;
    const tick = async () => {
      const token = tokenRef.current;
      if (!token || cancelled || document.visibilityState === "hidden") return;
      try {
        const result = await transport.poll({ token, afterId: lastServerId(messagesRef.current) });
        if (cancelled) return;
        if (result.messages.length) {
          setMessages((current) => mergeMessages(current, result.messages));
          if (!isOpenRef.current) setUnread((count) => count + result.messages.filter((message) => message.role === "agent").length);
        }
        setHandoff(result.handoff);
        setLocked(result.locked);
        setStage(result.stage);
        setError((current) => (current?.scope === "poll" ? null : current));
        if (result.handoff?.status === "resolved") {
          const view = await transport.start({ token, lang: langRef.current, pagePath });
          if (!cancelled && !view.disabled) applyView(view, [], false);
        }
      } catch (cause) {
        if (!cancelled) setError({ kind: classifyLeadBotError(cause), scope: "poll" });
      }
    };
    const timer = window.setInterval(tick, pollIntervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [escalated, status, transport, pollIntervalMs, pagePath, applyView]);

  const lastBotIndex = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) if (messages[index].role !== "user") return index;
    return -1;
  }, [messages]);

  const inputHint = useMemo(() => {
    if (lastBotIndex < 0) return "text" as const;
    return messages[lastBotIndex].reply?.inputHint ?? ("text" as const);
  }, [messages, lastBotIndex]);

  return {
    status,
    messages,
    stage,
    step,
    locked,
    handoff,
    escalated,
    awaitingReply,
    error,
    online,
    resumed,
    unread,
    isOpen,
    whatsappNumber,
    lastBotIndex,
    inputHint,
    failedCount: messages.filter((message) => message.localStatus === "failed").length,
    open,
    close,
    start,
    acceptConsent,
    declineConsent,
    send,
    retry,
    discard,
    restart,
    trackAction,
    clearError: () => setError(null),
  };
}

export type LeadBotController = ReturnType<typeof useLeadBotController>;
