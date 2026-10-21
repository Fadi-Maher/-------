export type PublicRequestSubmission =
  | { mode: "saved"; reference: string }
  | { mode: "verify" };

/**
 * Live site: demo phone codes are disabled, so an anonymous request is saved
 * directly through the public create endpoint and no customer session is issued.
 * Development keeps the explicit demo verification step before saving.
 */
export async function submitPublicRequest<Draft>(
  draft: Draft,
  deps: {
    isProduction: boolean;
    create: (draft: Draft) => Promise<{ reference: string }>;
  }
): Promise<PublicRequestSubmission> {
  if (!deps.isProduction) return { mode: "verify" };
  const created = await deps.create(draft);
  return { mode: "saved", reference: created.reference };
}
