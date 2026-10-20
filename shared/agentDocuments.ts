/** Public, non-sensitive contract for agent-application identity documents. */
export const AGENT_DOCUMENT_KINDS = ["national_id", "work_license"] as const;

export type AgentDocumentKind = (typeof AGENT_DOCUMENT_KINDS)[number];

export const AGENT_DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;
export const AGENT_DOCUMENT_DRAFT_TTL_MS = 30 * 60_000;
export const AGENT_DOCUMENT_UPLOAD_WINDOW_MS = 60 * 60_000;
export const AGENT_DOCUMENT_MAX_UPLOADS_PER_WINDOW = 10;
export const AGENT_DOCUMENT_MAX_ACTIVE_DRAFTS = 2;

/**
 * This is deliberately the complete public/admin metadata shape. It never
 * contains phone, applicationId, storageKey, object URL, encryption material,
 * or the document bytes.
 */
export type AgentApplicationDocumentMetadata = {
  id: string;
  kind: AgentDocumentKind;
  fileName: string;
  mimeType: "application/pdf" | "image/png" | "image/jpeg";
  size: number;
  createdAt: number;
};

export type AgentApplicationDocumentUpload = {
  kind: AgentDocumentKind;
  fileName: string;
  mimeType: AgentApplicationDocumentMetadata["mimeType"];
  /** Optional client-side byte count; when present it must exactly match. */
  size?: number;
  /** Canonical, padded base64 without a data-URL prefix or whitespace. */
  base64: string;
};
