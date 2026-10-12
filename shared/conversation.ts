export type ConversationFilter = "all" | "incoming" | "outgoing";
export type ConversationMode = "customer" | "team";
export function isOwnConversationMessage(senderType: string, mode: ConversationMode) {
  return mode === "customer" ? senderType === "customer" : senderType === "agent" || senderType === "employee";
}
export function matchesConversationFilter(senderType: string, mode: ConversationMode, filter: ConversationFilter) {
  if (filter === "all") return true;
  if (senderType === "system") return false;
  const own = isOwnConversationMessage(senderType, mode);
  return filter === "outgoing" ? own : !own;
}
export const isConversationClosed = (status?: string) => status === "completed";
