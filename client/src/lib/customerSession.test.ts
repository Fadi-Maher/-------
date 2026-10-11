import { describe, expect, it } from "vitest";
import { readCustomerSession, requiredFieldMessage, saveCustomerSession } from "./customerSession";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("customer session helpers", () => {
  it("persists and restores a complete customer session", () => {
    const storage = memoryStorage();
    saveCustomerSession({ name: "أحمد", phone: "0530204050", accessToken: "signed-token-value" }, storage);
    expect(readCustomerSession(storage)).toEqual({ name: "أحمد", phone: "0530204050", accessToken: "signed-token-value" });
  });

  it("does not restore an incomplete session", () => {
    const storage = memoryStorage();
    storage.setItem("maalamati_customer_name", "أحمد");
    expect(readCustomerSession(storage)).toBeNull();
  });

  it("returns localized required-field messages", () => {
    expect(requiredFieldMessage(false)).toBe("يرجى تعبئة هذا الحقل.");
    expect(requiredFieldMessage(false, "tel")).toBe("يرجى إدخال رقم جوال صحيح.");
    expect(requiredFieldMessage(true)).toBe("Please complete this field.");
  });
});
