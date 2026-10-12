import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { customers } from "../drizzle/schema";
import { CURRENT_TERMS_VERSION } from "../shared/legal";
import { getDb } from "./db";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const context = { user: null, req: {}, res: {} } as TrpcContext;

describe("التسجيل بالجوال في قاعدة النسخة المستقلة", () => {
  it("ينشئ العميل بعد التحقق والموافقة ويعيد الحساب ذاته عند الدخول مجددًا", async () => {
    const caller = appRouter.createCaller(context);
    const db = await getDb();
    expect(db).not.toBeNull();
    const phone = "059" + String(Date.now()).slice(-7);
    const fullName = `اختبار تسجيل مؤقت ${Date.now()}`;
    let customerId: number | undefined;
    try {
      const verified = await caller.requests.verifyPhoneDemo({ phone, code: "123456" });
      expect(await caller.customers.findByPhoneAccessToken({ accessToken: verified.accessToken })).toBeNull();
      await expect(caller.customers.registerWithPhone({ fullName, phone, email: "registration-test@example.invalid", accessToken: verified.accessToken, termsAccepted: false as true, termsVersion: CURRENT_TERMS_VERSION })).rejects.toThrow();
      const customer = await caller.customers.registerWithPhone({ fullName, phone, email: "registration-test@example.invalid", accessToken: verified.accessToken, termsAccepted: true, termsVersion: CURRENT_TERMS_VERSION });
      customerId = customer.id;
      expect(customer).toMatchObject({ fullName, phone, termsVersion: CURRENT_TERMS_VERSION });
      expect(customer.termsAcceptedAt).not.toBeNull();
      const nextLogin = await caller.requests.verifyPhoneDemo({ phone, code: "123456" });
      expect(nextLogin.customerName).toBe(fullName);
      const existing = await caller.customers.findByPhoneAccessToken({ accessToken: nextLogin.accessToken });
      expect(existing?.id).toBe(customerId);
    } finally {
      if (customerId) await db!.delete(customers).where(and(eq(customers.id, customerId), eq(customers.fullName, fullName)));
    }
  }, 20_000);
});
