import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import {
  getPhoneAccounts,
  getPhoneProfile,
  savePhoneProfile,
  type PhoneProfileRole,
} from "./phoneProfileDb";
import { verifyPhoneLoginTicket } from "./phoneLoginTicket";

const verificationToken = z.string().min(1).max(500);
const role = z.enum(["customer", "agent"]);
const profileFields = {
  fullName: z.string().trim().min(2).max(160),
  email: z
    .string()
    .trim()
    .min(3)
    .max(320)
    .email("البريد الإلكتروني غير صالح.")
    .transform(value => value.toLowerCase()),
} as const;

export const phoneProfileRouter = router({
  accounts: publicProcedure
    .input(z.object({ verificationToken }))
    .query(({ input }) => {
      // Only the OTP-signed ticket identifies the phone; nothing is created or linked.
      const phone = verifyPhoneLoginTicket(input.verificationToken);
      return getPhoneAccounts(phone);
    }),
  get: publicProcedure
    .input(z.object({ verificationToken, role }))
    .query(({ input }) => {
      // The short-lived, signed ticket is the sole source of phone identity.
      const phone = verifyPhoneLoginTicket(input.verificationToken);
      return getPhoneProfile(phone, input.role as PhoneProfileRole);
    }),

  save: publicProcedure
    .input(
      z.object({
        verificationToken,
        role,
        ...profileFields,
        // The service rejects false/missing acceptance only when it is creating a customer.
        acceptedTerms: z.boolean().optional(),
      })
    )
    .mutation(({ input }) => {
      // Never trust a browser supplied phone or an OAuth session to select the record.
      const phone = verifyPhoneLoginTicket(input.verificationToken);
      return savePhoneProfile(phone, {
        role: input.role as PhoneProfileRole,
        fullName: input.fullName,
        email: input.email,
        acceptedTerms: input.acceptedTerms,
      });
    }),
});
