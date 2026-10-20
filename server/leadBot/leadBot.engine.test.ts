import { describe, expect, it } from "vitest";
import { createInitialState, processMessage, startConversation, type EngineInput, type EngineState } from "../../shared/leadBot/engine";
import { gradeForScore, scoreLead } from "../../shared/leadBot/scoring";
import { maskPhone, maskPhonesInText, moderateMessage, parseSaudiMobile, phoneSearchDigits, redactSensitive } from "../../shared/leadBot/text";
import { requestPrefillFromSearch } from "../../client/src/lib/leadBotRequestPrefill";
import { redactForAi } from "./providers";
import { detectIntent, extractSlots, parseQuickReply } from "../../shared/leadBot/understanding";
import { DEFAULT_LEAD_BOT_SETTINGS, isWithinWorkingHours, toEngineSettings, validateSettingsInput } from "./settings";

// Sunday 11:00 Riyadh (inside the default Sun–Thu 09:00–18:00 window).
const WORK_TIME = Date.UTC(2026, 9, 18, 8, 0);
// Friday 11:00 Riyadh (outside working days).
const OFF_TIME = Date.UTC(2026, 9, 16, 8, 0);
const settings = toEngineSettings(DEFAULT_LEAD_BOT_SETTINGS, "966530204050", WORK_TIME);

function run(inputs: EngineInput[], lang: "ar" | "en" = "ar", engineSettings = settings) {
  let state: EngineState = startConversation(createInitialState(lang), engineSettings).state;
  let last = processMessage(state, inputs[0], engineSettings);
  state = last.state;
  for (const input of inputs.slice(1)) {
    last = processMessage(state, input, engineSettings);
    state = last.state;
  }
  return last;
}

const QUALIFY_AR: EngineInput[] = [
  { text: "أبغى سجل تجاري لمؤسستي في الرياض بشكل عاجل" },
  { quickReply: "vol:many" },
  { quickReply: "bud:gt2000" },
  { text: "سارة" },
  { text: "٠٥٠٠٠٠٠١٠١" },
  { quickReply: "time:now" },
  { quickReply: "consent:yes" },
];

describe("leadBot text: phones, masking and moderation", () => {
  it("normalises Saudi mobiles in every common format, including Arabic digits", () => {
    expect(parseSaudiMobile("0551234567")).toBe("0551234567");
    expect(parseSaudiMobile("+966 55 123 4567")).toBe("0551234567");
    expect(parseSaudiMobile("00966551234567")).toBe("0551234567");
    expect(parseSaudiMobile("551234567")).toBe("0551234567");
    expect(parseSaudiMobile("٠٥٥١٢٣٤٥٦٧")).toBe("0551234567");
    expect(parseSaudiMobile("0451234567")).toBeNull();
    expect(parseSaudiMobile("12345")).toBeNull();
    expect(phoneSearchDigits("٠٥٠٠")).toBe("0500");
    expect(maskPhone("0551234567")).toBe("055****567");
  });

  it("masks national/iqama IDs, IBANs, Luhn-valid cards and secrets but keeps mobiles", () => {
    const id = redactSensitive("رقم هويتي 1012345678 وإقامتي 2123456789");
    expect(id.text).not.toMatch(/1012345678|2123456789/);
    expect(id.kinds).toContain("national_id");
    const iban = redactSensitive("الآيبان SA03 8000 0000 6080 1016 7519");
    expect(iban.text).toContain("[IBAN محجوب]");
    const card = redactSensitive("بطاقتي 4111 1111 1111 1111");
    expect(card.kinds).toContain("card");
    expect(card.text).not.toContain("4111 1111");
    expect(redactSensitive("طلب رقم 1234 5678 9012 3456").kinds).not.toContain("card");
    const secrets = redactSensitive("كلمة المرور: abc123 and my OTP is 482913");
    expect(secrets.kinds).toEqual(["secret"]);
    expect(secrets.text).not.toMatch(/abc123|482913/);
    expect(redactSensitive("جوالي 0500000101").text).toContain("0500000101");
  });

  it("blocks empty, too-long and abusive messages", () => {
    expect(moderateMessage("   ").reason).toBe("empty");
    expect(moderateMessage("ا".repeat(801)).reason).toBe("too_long");
    expect(moderateMessage("انت غبي").blocked).toBe(true);
    expect(moderateMessage("You are an idiot").blocked).toBe(true);
    expect(moderateMessage("أبغى سجل تجاري").blocked).toBe(false);
  });
});

describe("leadBot understanding", () => {
  it("detects intents in priority order (human before pricing)", () => {
    expect(detectIntent("أبي أكلم موظف عن السعر").intent).toBe("talk_to_human");
    expect(detectIntent("كم السعر").intent).toBe("pricing");
    expect(detectIntent("ابغى اتابع طلبي").intent).toBe("track_request");
    expect(detectIntent("أبي أصير معقب").intent).toBe("become_agent");
    expect(detectIntent("How much does it cost?").intent).toBe("pricing");
  });

  it("extracts several slots from one sentence", () => {
    expect(extractSlots("أبغى سجل تجاري لمؤسستي في الرياض بشكل عاجل", null).slots).toEqual({
      service: "commercial_registration",
      customerType: "business",
      urgency: "urgent",
      city: "riyadh",
    });
    const phone = extractSlots("رقمي ٠٥٠٠٠٠٠١٠١", "phone");
    expect(phone.slots.phone).toBe("0500000101");
    expect(extractSlots("رقمي 12345", "phone").invalidPhone).toBe(true);
  });

  it("parses quick replies strictly", () => {
    expect(parseQuickReply("svc:commercial_registration")).toEqual({ kind: "slot", slots: { service: "commercial_registration" } });
    expect(parseQuickReply("edit:city")).toEqual({ kind: "edit", slot: "city" });
    expect(parseQuickReply("intent:pricing")).toEqual({ kind: "intent", intent: "pricing" });
    expect(parseQuickReply("svc:not_a_service")).toBeNull();
    expect(parseQuickReply("edit:password")).toBeNull();
    expect(parseQuickReply("<script>")).toBeNull();
  });
});

describe("leadBot scoring", () => {
  it("grades with the 70/45 thresholds", () => {
    expect(gradeForScore(70)).toBe("hot");
    expect(gradeForScore(69)).toBe("warm");
    expect(gradeForScore(45)).toBe("warm");
    expect(gradeForScore(44)).toBe("cold");
  });

  it("scores a business, urgent, high-volume lead as hot with a capped explainable breakdown", () => {
    const score = scoreLead({ service: "commercial_registration", customerType: "business", urgency: "urgent", volume: "many", budget: "gt2000", phone: "0500000101", contactTime: "now" });
    expect(score.grade).toBe("hot");
    expect(score.score).toBe(100);
    expect(score.breakdown.map((item) => item.key)).toEqual(expect.arrayContaining(["business", "urgent", "many", "gt2000", "service", "phone", "now"]));
  });

  it("scores an exploring individual as cold", () => {
    expect(scoreLead({ customerType: "individual", urgency: "exploring", volume: "single", budget: "lt500" }).grade).toBe("cold");
  });
});

describe("leadBot engine conversation", () => {
  it("starts with a greeting and the main menu", () => {
    const start = startConversation(createInitialState("ar"), settings);
    expect(start.state.stage).toBe("welcome");
    expect(start.replies.at(-1)?.quickReplies?.map((option) => option.value)).toContain("intent:talk_to_human");
  });

  it("qualifies a lead, asks for consent, shows a review and only then marks it ready", () => {
    const review = run(QUALIFY_AR);
    expect(review.state.stage).toBe("review");
    expect(review.leadReady).toBe(false);
    expect(review.replies.at(-1)?.summary?.map((item) => item.key)).toEqual(expect.arrayContaining(["service", "city", "name", "phone"]));
    expect(review.replies.at(-1)?.quickReplies?.map((option) => option.value)).toEqual(["confirm", "intent:edit"]);
    const done = run([...QUALIFY_AR, { quickReply: "confirm" }]);
    expect(done.state.stage).toBe("completed");
    expect(done.leadReady).toBe(true);
    expect(done.score.grade).toBe("hot");
    expect(done.events.map((event) => event.type)).toContain("lead_qualified");
    const actions = done.replies.flatMap((reply) => reply.actions ?? []);
    expect(actions.find((action) => action.type === "open_request_form")?.href).toBe("/?service=commercial_registration#request");
    expect(actions.find((action) => action.type === "whatsapp")?.href).toBe("https://wa.me/966530204050");
  });

  it("never stores contact data when the visitor declines consent", () => {
    const declined = run([...QUALIFY_AR.slice(0, -1), { quickReply: "consent:no" }]);
    expect(declined.leadReady).toBe(false);
    expect(declined.events.map((event) => event.type)).toContain("consent_declined");
    expect(declined.state.slots.phone).toBeUndefined();
  });

  it("escalates immediately when a human is requested, and masks typed IDs", () => {
    const human = run([{ text: "أبي أكلم موظف" }]);
    expect(human.state.stage).toBe("escalated");
    expect(human.escalate?.reason).toBe("requested");
    const masked = run([{ text: "رقم هويتي 1012345678 وكلمة المرور abc123" }]);
    expect(masked.storedUserText).toBe("رقم هويتي [رقم هوية محجوب] وكلمة المرور [بيانات سرية محجوبة]");
    expect(masked.events.map((event) => event.type)).toContain("sensitive_masked");
  });

  it("closes the conversation after three abusive messages", () => {
    const result = run([{ text: "انت غبي" }, { text: "انت غبي" }, { text: "انت غبي" }]);
    expect(result.state.stage).toBe("closed");
    expect(result.state.strikes).toBe(3);
  });

  it("works in English", () => {
    const english = run([{ text: "I need a commercial registration for my company in Riyadh, urgent" }], "en");
    expect(english.state.slots.service).toBe("commercial_registration");
    expect(english.replies.every((reply) => !/[\u0600-\u06FF]/.test(reply.text))).toBe(true);
  });
});

describe("leadBot settings", () => {
  it("computes Riyadh working hours", () => {
    expect(isWithinWorkingHours(DEFAULT_LEAD_BOT_SETTINGS, WORK_TIME)).toBe(true);
    expect(isWithinWorkingHours(DEFAULT_LEAD_BOT_SETTINGS, OFF_TIME)).toBe(false);
  });

  it("rejects invalid settings (no working day, inverted hours)", () => {
    const base = { ...DEFAULT_LEAD_BOT_SETTINGS };
    expect(validateSettingsInput({ ...base, workingDays: [] }).ok).toBe(false);
    expect(validateSettingsInput({ ...base, workStartHour: 18, workEndHour: 9 }).ok).toBe(false);
    expect(validateSettingsInput(base).ok).toBe(true);
  });
});

describe("leadBot privacy helpers", () => {
  it("masks phones inside sentences and redacts everything before AI", () => {
    expect(maskPhonesInText("جوالي ٠٥٥١٢٣٤٥٦٧ شكرًا")).toBe("جوالي 055****567 شكرًا");
    expect(maskPhonesInText("كيف أطلع سجل تجاري")).toBe("كيف أطلع سجل تجاري");
    expect(redactForAi("جوالي ٠٥٥١٢٣٤٥٦٧ وهويتي 1012345678 كيف أطلع سجل تجاري")).toBe("جوالي 055****567 وهويتي [رقم هوية محجوب] كيف أطلع سجل تجاري");
  });
});

describe("leadBot fallback, skip, decline and request-form prefill", () => {
  it("offers a person after two unclear messages (owner default = 2)", () => {
    const once = run([{ text: "قثقثقث" }]);
    expect(once.state.fallbackCount).toBe(1);
    expect(once.replies.at(-1)?.quickReplies?.length).toBeGreaterThan(2);
    const twice = run([{ text: "قثقثقث" }, { text: "زززز" }]);
    expect(twice.replies.at(-1)?.quickReplies?.map((option) => option.value)).toEqual(["intent:talk_to_human", "intent:start_request"]);
  });

  it("allows skipping optional questions only", () => {
    const skippedVolume = run([QUALIFY_AR[0], { text: "تخطي" }]);
    expect(skippedVolume.state.skipped).toContain("volume");
    const askName = run([QUALIFY_AR[0], { quickReply: "vol:many" }, { quickReply: "bud:gt2000" }, { text: "تخطي" }]);
    expect(askName.state.pending).toBe("name");
    expect(askName.state.slots.name).toBeUndefined();
    expect(askName.state.skipped).not.toContain("name");
    const askNameButton = run([QUALIFY_AR[0], { quickReply: "vol:many" }, { quickReply: "bud:gt2000" }, { quickReply: "skip" }]);
    expect(askNameButton.state.pending).toBe("name");
    expect(run([QUALIFY_AR[0], { quickReply: "vol:many" }, { quickReply: "bud:gt2000" }, { text: "هلا" }]).state.slots.name).toBe("هلا");
  });

  it("wipes contact data on decline and offers the request form instead", () => {
    const declined = run([...QUALIFY_AR.slice(0, -1), { quickReply: "consent:no" }]);
    expect(declined.state.slots.name).toBeUndefined();
    expect(declined.state.slots.phone).toBeUndefined();
    expect(declined.replies.flatMap((reply) => reply.actions ?? []).map((action) => action.type)).toContain("open_request_form");
  });

  it("maps assistant services to the home request form categories", () => {
    expect(requestPrefillFromSearch("?service=company_formation")).toEqual({ service: "company_formation", subcategory: "تأسيس وتطوير الأعمال" });
    expect(requestPrefillFromSearch("?service=other")?.subcategory).toBe("استشارة أو طلب مخصص");
    expect(requestPrefillFromSearch("?service=<script>")).toBeNull();
    expect(requestPrefillFromSearch("")).toBeNull();
  });
});
