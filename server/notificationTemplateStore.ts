import type { MySqlDatabase } from "drizzle-orm/mysql-core";
import { notificationTemplates } from "../drizzle/schema";
import {
  isNotificationTemplateKey,
  renderNotificationTemplate,
  type LocalizedVariables,
  type NotificationTemplateKey,
  type NotificationTemplateText,
} from "../shared/notificationTemplates";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NotificationExecutor = MySqlDatabase<any, any, any, any>;

const CACHE_TTL_MS = 30_000;
let cache: { overrides: Map<NotificationTemplateKey, NotificationTemplateText>; expiresAt: number } | null = null;

export function invalidateNotificationTemplateCache() {
  cache = null;
}

async function loadOverrides(executor: NotificationExecutor) {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.overrides;
  const rows = await executor
    .select({
      templateKey: notificationTemplates.templateKey,
      titleAr: notificationTemplates.titleAr,
      messageAr: notificationTemplates.messageAr,
      titleEn: notificationTemplates.titleEn,
      messageEn: notificationTemplates.messageEn,
    })
    .from(notificationTemplates);
  const overrides = new Map<NotificationTemplateKey, NotificationTemplateText>();
  rows.forEach((row) => {
    if (!isNotificationTemplateKey(row.templateKey)) return;
    overrides.set(row.templateKey, { titleAr: row.titleAr, messageAr: row.messageAr, titleEn: row.titleEn, messageEn: row.messageEn });
  });
  cache = { overrides, expiresAt: now + CACHE_TTL_MS };
  return overrides;
}

/**
 * Renders an automatic notification with the owner's saved wording when available.
 * Any failure while reading saved templates falls back to the built-in text, so a template
 * problem can never block the business action that triggers the notification.
 */
export async function buildNotificationContent(executor: NotificationExecutor, key: NotificationTemplateKey, variables: LocalizedVariables = {}) {
  let override: NotificationTemplateText | undefined;
  try {
    override = (await loadOverrides(executor)).get(key);
  } catch (error) {
    console.warn("[Notifications] Using default template text:", error instanceof Error ? error.message : error);
  }
  return renderNotificationTemplate(key, variables, override);
}
