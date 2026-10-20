import { LEAD_SERVICE_IDS, type LeadServiceId } from "@shared/leadBot/catalog";

/**
 * The sales assistant links to `/?service=<id>#request`. The home request form
 * has generic categories, so each assistant service maps to the closest one.
 */
export const LEAD_SERVICE_TO_REQUEST_SUBCATEGORY: Record<LeadServiceId, string> = {
  commercial_registration: "وثائق ومستندات أعمال",
  company_formation: "تأسيس وتطوير الأعمال",
  municipal_license: "خدمات إدارية وتشغيلية",
  labor_qiwa: "خدمات إدارية وتشغيلية",
  residency_visas: "خدمات إدارية وتشغيلية",
  legal_najiz: "وثائق ومستندات أعمال",
  zakat_tax: "خدمات إدارية وتشغيلية",
  other: "استشارة أو طلب مخصص",
};

/** Read `?service=` from the URL; unknown or missing values return null. */
export function requestPrefillFromSearch(search: string): { service: LeadServiceId; subcategory: string } | null {
  let value: string | null = null;
  try {
    value = new URLSearchParams(search).get("service");
  } catch {
    return null;
  }
  if (!value || !(LEAD_SERVICE_IDS as readonly string[]).includes(value)) return null;
  const service = value as LeadServiceId;
  return { service, subcategory: LEAD_SERVICE_TO_REQUEST_SUBCATEGORY[service] };
}
