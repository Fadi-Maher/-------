import { describe, expect, it } from "vitest";
import { createInitialState, processMessage, startConversation, type EngineInput, type EngineState } from "../../shared/leadBot/engine";
import { isQuestionLike } from "../../shared/leadBot/understanding";
import { BASIC_KNOWLEDGE } from "./knowledgeSeed";
import { answerFromKnowledge, keyTokens, matchKnowledge, type KnowledgeEntry } from "./providers";
import { DEFAULT_LEAD_BOT_SETTINGS, toEngineSettings } from "./settings";

const entries: KnowledgeEntry[] = BASIC_KNOWLEDGE.map((entry, index) => ({
  id: index + 1,
  questionAr: entry.questionAr,
  answerAr: entry.answerAr,
  questionEn: entry.questionEn,
  answerEn: entry.answerEn,
}));
const byQuestion = (questionAr: string) => entries.find((entry) => entry.questionAr === questionAr)!.id;
const settings = toEngineSettings(DEFAULT_LEAD_BOT_SETTINGS, "966530204050", Date.UTC(2026, 9, 18, 8, 0));

function stateAfter(inputs: EngineInput[], lang: "ar" | "en" = "ar"): EngineState {
  let state = startConversation(createInitialState(lang), settings).state;
  for (const input of inputs) state = processMessage(state, input, settings).state;
  return state;
}

/** Same decision the service makes: deterministic match first, then the engine. */
function turn(state: EngineState, text: string) {
  return processMessage(state, { text, knowledgeMatch: Boolean(matchKnowledge(text, entries)) }, settings);
}

describe("basic knowledge content", () => {
  it("has bilingual, unique and router-valid entries without sensitive data", () => {
    expect(BASIC_KNOWLEDGE.length).toBe(15);
    const questions = new Set(BASIC_KNOWLEDGE.map((entry) => entry.questionAr));
    expect(questions.size).toBe(BASIC_KNOWLEDGE.length);
    expect(new Set(BASIC_KNOWLEDGE.map((entry) => entry.sortOrder)).size).toBe(BASIC_KNOWLEDGE.length);
    for (const entry of BASIC_KNOWLEDGE) {
      expect(entry.questionAr.length).toBeLessThanOrEqual(500);
      expect(entry.answerAr.length).toBeLessThanOrEqual(4000);
      expect(entry.questionEn.trim().length).toBeGreaterThan(2);
      expect(entry.answerEn.trim().length).toBeGreaterThan(2);
      // No national ID / iqama numbers (10 digits starting with 1 or 2) or card numbers.
      expect(`${entry.answerAr} ${entry.answerEn}`).not.toMatch(/\b[12]\d{9}\b|\b\d{13,19}\b/);
    }
  });

  it("matches every entry from its own Arabic and English question", () => {
    for (const entry of entries) {
      expect(matchKnowledge(entry.questionAr, entries)?.entry.id).toBe(entry.id);
      expect(matchKnowledge(entry.questionEn!, entries)?.entry.id).toBe(entry.id);
    }
  });

  it("folds everyday wording to the same topic", () => {
    expect(keyTokens("كم ياخذ وقت")).toEqual(keyTokens("كم تستغرق المدة"));
    expect(keyTokens("How do I pay")).toContain("دفع");
  });
});

describe("knowledge matching with colloquial and English questions", () => {
  const cases: Array<[string, string]> = [
    ["ابي اعرف كيف ادفع", "كيف أدفع؟"],
    ["طريقة الدفع", "كيف أدفع؟"],
    ["كم ياخذ وقت؟", "كم تستغرق مدة الإنجاز؟"],
    ["متى يخلص طلبي؟", "كم تستغرق مدة الإنجاز؟"],
    ["أقدر ألغي طلبي؟", "هل يمكنني إلغاء طلبي؟"],
    ["كيف استرجع فلوسي", "كيف أطلب استرداد مبلغ؟"],
    ["وين ألقى المرفقات؟", "هل تظهر المرفقات في صفحة التتبع؟"],
    ["هل المعقب يشوف رقمي؟", "هل يرى مقدم الخدمة رقم جوالي؟"],
    ["انتم جهة رسمية؟", "هل معاملاتي كير جهة حكومية؟"],
    ["مين صاحب المنصة", "من الجهة التي تدير معاملاتي كير؟"],
    ["رقم الدعم", "كيف أتواصل مع الدعم؟"],
    ["كيف تشتغل العروض؟", "كيف تعمل عروض الأسعار؟"],
    ["How long does it take?", "كم تستغرق مدة الإنجاز؟"],
    ["I want a refund", "كيف أطلب استرداد مبلغ؟"],
    ["Can the agent see my phone number?", "هل يرى مقدم الخدمة رقم جوالي؟"],
    ["Who runs Maalamati Care?", "من الجهة التي تدير معاملاتي كير؟"],
  ];
  it.each(cases)("«%s» → «%s»", (question, expected) => {
    expect(matchKnowledge(question, entries)?.entry.id).toBe(byQuestion(expected));
  });

  it("does not guess for topics it does not cover", () => {
    expect(matchKnowledge("هل عندكم ضمان؟", entries)).toBeNull();
    expect(matchKnowledge("مرحبا", entries)).toBeNull();
    expect(matchKnowledge("سارة", entries)).toBeNull();
  });

  it("answers in the visitor's language without calling AI", async () => {
    const listKnowledge = async () => entries;
    expect(await answerFromKnowledge("How do I pay?", "en", { listKnowledge, aiAssist: false })).toContain("does not currently process payments");
    expect(await answerFromKnowledge("كيف ادفع", "ar", { listKnowledge, aiAssist: false })).toContain("لا تعالج معاملاتي كير المدفوعات");
  });
});

describe("knowledge answers inside the conversation", () => {
  it("answers a vague «I want to know…» question instead of starting a request", () => {
    const result = turn(stateAfter([]), "ابي اعرف كيف ادفع");
    expect(result.needsFaqAnswer).toBe(true);
    expect(result.state.stage).toBe("welcome");
  });

  it("still starts qualification when the message carries request data", () => {
    const result = processMessage(stateAfter([]), { text: "أبغى سجل تجاري لمؤسستي في الرياض", knowledgeMatch: true }, settings);
    expect(result.needsFaqAnswer).toBe(false);
    expect(result.state.stage).toBe("qualifying");
    expect(result.state.slots.city).toBe("riyadh");
  });

  it("answers mid-flow, keeps the pending question and never stores the question as a name", () => {
    const beforeName = stateAfter([
      { text: "أبغى سجل تجاري" },
      { quickReply: "type:individual" },
      { quickReply: "urg:week" },
      { quickReply: "bud:500_2000" },
      { quickReply: "city:riyadh" },
    ]);
    expect(beforeName.pending).toBe("name");
    const question = turn(beforeName, "كيف ادفع؟");
    expect(question.needsFaqAnswer).toBe(true);
    expect(question.state.slots.name).toBeUndefined();
    expect(question.state.pending).toBe("name");
    const named = turn(question.state, "سارة");
    expect(named.state.slots.name).toBe("سارة");
  });

  it("does not store a question as a free-text city", () => {
    const beforeCity = stateAfter([
      { text: "أبغى سجل تجاري" },
      { quickReply: "type:individual" },
      { quickReply: "urg:week" },
      { quickReply: "bud:500_2000" },
    ]);
    expect(beforeCity.pending).toBe("city");
    const result = turn(beforeCity, "وين ألقى المرفقات؟");
    expect(result.state.slots.city).toBeUndefined();
    expect(result.needsFaqAnswer).toBe(true);
  });

  it("recognises question-shaped text", () => {
    expect(isQuestionLike("كيف ادفع")).toBe(true);
    expect(isQuestionLike("What is this?")).toBe(true);
    expect(isQuestionLike("هلا")).toBe(false);
    expect(isQuestionLike("كمال الحربي")).toBe(false);
  });
});
