import { PublicFooter } from "@/components/PublicFooter";
import { PublicHeader } from "@/components/PublicHeader";
import { useLanguage } from "@/contexts/LanguageContext";
import { AlertTriangle, CheckCircle2, CircleDollarSign, RotateCcw, XCircle } from "lucide-react";

export default function RefundAndCancellation() {
  const { isEnglish } = useLanguage();
  const copy = isEnglish ? {
    title: "Refund and Cancellation Policy",
    intro: "This policy explains how a Maalamati Care request may be cancelled or changed and how a refund is assessed when a payment has been made to a service provider or through an official payment channel introduced in the future.",
    updated: "Last updated: 30 August 2026",
    warningTitle: "Working draft — legal review required",
    warning: "This is an AI-prepared working draft, not formal legal advice. A qualified Saudi attorney should review it before final adoption.",
    noPayments: "Maalamati Care does not currently process electronic payments inside the platform. Any off-platform payment remains subject to the agreed quotation, the provider's lawful obligations, and applicable Saudi law.",
    stage: "Request stage", cancellation: "Cancellation or change", refund: "Refund treatment",
    rows: [
      ["Before accepting a quotation", "The customer may cancel the request or allow the quotation period to expire.", "No Maalamati Care service amount is due. Any separately paid third-party fee is handled under that party's rules."],
      ["After acceptance, before work starts", "Contact support and the selected provider immediately.", "A refund should cover the unperformed service, less documented actual or non-refundable third-party costs disclosed in the quotation."],
      ["After work starts", "Cancellation is reviewed according to completed work and commitments already incurred.", "Any approved refund is limited to the unperformed portion after documented work and disclosed external fees."],
      ["After completion or delivery", "The request cannot normally be cancelled; a service-quality or delivery concern may be raised instead.", "No automatic refund. A substantiated incomplete or materially non-conforming service is reviewed case by case."],
      ["Provider cancellation", "The customer may choose another eligible provider when the workflow permits.", "Amounts received for an unperformed service should be returned through the original lawful payment channel, subject to disclosed third-party fees."],
    ],
    sections: [
      ["1. Request cancellation", "A customer may request cancellation from the request record or through Contact & Support. Cancellation is not complete until its status is confirmed in the platform or by support. A provider may not continue chargeable work after confirmed cancellation except to secure completed work, return documents, or meet a legal obligation."],
      ["2. Changing a service", "A material change in scope, documents, urgency, or required deliverables may require a revised quotation and completion time. The customer must approve the revised terms before the additional work starts."],
      ["3. How to request a refund", "Provide the verified mobile number, request reference, cancellation reason, proof of payment, and any relevant messages or deliverables through Contact & Support. Do not send bank-card credentials, verification codes, or unnecessary identity documents."],
      ["4. Review and return method", "Maalamati Care or the provider may request evidence of completed work or external costs. If a refund is approved for a future official in-platform payment, it is returned to the original payment method; bank or payment-provider processing time may apply. Off-platform refunds must be completed by the party that received the funds."],
      ["5. Non-refundable amounts", "Government fees, third-party fees, completed custom work, delivered digital documents, urgent work already performed, and costs clearly disclosed as non-refundable may be excluded to the extent permitted by law. No exclusion overrides a mandatory consumer right."],
      ["6. Delays and customer non-response", "A refund may be reduced where delay or failure results from inaccurate information, missing documents, customer non-response, or a government or third-party decision outside the provider's reasonable control. The provider must document completed work and relevant costs."],
      ["7. Disputes and consumer rights", "Start by contacting Maalamati Care support for an amicable review. This policy does not limit any right or remedy that cannot be waived under the laws of the Kingdom of Saudi Arabia."],
      ["8. Updates and contact", "Material changes are shown with a revised date. Questions or requests may be submitted through the Maalamati Care Contact & Support page. Operator: Streak Express, Commercial Registration 7051197981."],
    ],
  } : {
    title: "سياسة الاسترداد والإلغاء",
    intro: "توضح هذه السياسة كيفية إلغاء طلب معاملاتي كير أو تعديله، وآلية تقييم الاسترداد عندما يكون العميل قد دفع مبلغًا لمقدم الخدمة أو عبر مسار دفع رسمي قد يُضاف مستقبلًا.",
    updated: "آخر تحديث: 30 أغسطس 2026",
    warningTitle: "مسودة للاعتماد بعد المراجعة القانونية",
    warning: "هذه مسودة أعدها نظام ذكاء اصطناعي وليست استشارة قانونية رسمية؛ يجب أن يراجعها محامٍ سعودي مؤهل قبل الاعتماد النهائي.",
    noPayments: "لا تعالج معاملاتي كير المدفوعات الإلكترونية داخل المنصة حاليًا. يخضع أي مبلغ يُدفع خارج المنصة للعرض المتفق عليه والتزامات مقدم الخدمة النظامية والأنظمة السعودية النافذة.",
    stage: "مرحلة الطلب", cancellation: "الإلغاء أو التعديل", refund: "معالجة الاسترداد",
    rows: [
      ["قبل اعتماد عرض السعر", "يستطيع العميل إلغاء الطلب أو ترك مهلة العروض تنتهي.", "لا يستحق مبلغ خدمة لمعاملاتي كير. وأي رسوم دفعت لطرف خارجي مستقل تخضع لشروط ذلك الطرف."],
      ["بعد اعتماد العرض وقبل بدء العمل", "يتواصل العميل فورًا مع الدعم ومقدم الخدمة المختار.", "يشمل الاسترداد الجزء غير المنفذ بعد خصم التكلفة الفعلية الموثقة أو رسوم الأطراف الخارجية غير القابلة للاسترداد والمعلنة في العرض."],
      ["بعد بدء العمل", "تُراجع إمكانية الإلغاء بحسب ما أُنجز والالتزامات التي تحملها مقدم الخدمة.", "يقتصر الاسترداد المعتمد على الجزء غير المنفذ بعد احتساب العمل الموثق والرسوم الخارجية المعلنة."],
      ["بعد اكتمال الخدمة أو التسليم", "لا يُلغى الطلب عادة، ويمكن رفع ملاحظة على جودة الخدمة أو اكتمال التسليم.", "لا يوجد استرداد تلقائي، وتُراجع الخدمة الناقصة أو المخالفة جوهريًا لما تم الاتفاق عليه حسب كل حالة."],
      ["إلغاء مقدم الخدمة", "يمكن للعميل اختيار مقدم خدمة مؤهل آخر متى سمح مسار الطلب.", "يُعاد ما تم تحصيله عن الجزء غير المنفذ عبر وسيلة الدفع النظامية الأصلية، مع مراعاة الرسوم الخارجية المعلنة."],
    ],
    sections: [
      ["1. إلغاء الطلب", "يمكن للعميل طلب الإلغاء من سجل الطلب أو عبر صفحة تواصل ودعم. لا يصبح الإلغاء نافذًا حتى تظهر حالته في المنصة أو يؤكده الدعم. ولا يجوز لمقدم الخدمة مواصلة عمل بمقابل بعد تأكيد الإلغاء إلا لحفظ ما أُنجز أو إعادة المستندات أو تنفيذ التزام نظامي."],
      ["2. تعديل الخدمة", "قد يتطلب التغيير الجوهري في نطاق العمل أو المستندات أو الاستعجال أو المخرجات عرض سعر ومدة إنجاز محدثين. يجب على العميل اعتماد الشروط المحدثة قبل بدء العمل الإضافي."],
      ["3. طريقة طلب الاسترداد", "يرسل العميل رقم الجوال الموثق ورقم الطلب وسبب الإلغاء وإثبات الدفع وأي رسائل أو مخرجات مرتبطة عبر صفحة تواصل ودعم. يجب عدم إرسال بيانات البطاقة البنكية أو رموز التحقق أو مستندات هوية غير لازمة."],
      ["4. المراجعة وطريقة إعادة المبلغ", "يجوز طلب إثبات للعمل المنجز أو التكلفة الخارجية. إذا اعتُمد استرداد لدفعة مستقبلية عبر مسار رسمي داخل المنصة، يعاد المبلغ إلى وسيلة الدفع الأصلية وقد تستغرق المعالجة مدة يحددها البنك أو مزود الدفع. أما المبلغ المدفوع خارج المنصة فيعيده الطرف الذي استلمه."],
      ["5. المبالغ غير القابلة للاسترداد", "قد تُستثنى الرسوم الحكومية ورسوم الأطراف الخارجية والعمل المخصص المكتمل والمستندات الرقمية المسلمة والعمل العاجل الذي نُفذ والتكاليف الموضحة مسبقًا على أنها غير قابلة للاسترداد، وذلك في الحدود التي تسمح بها الأنظمة. ولا يلغي أي استثناء حقًا إلزاميًا للمستهلك."],
      ["6. التأخير وعدم استجابة العميل", "قد ينخفض الاسترداد إذا كان التأخير أو تعذر الإنجاز ناتجًا عن معلومات غير صحيحة أو نقص المستندات أو عدم استجابة العميل أو قرار جهة حكومية أو طرف خارجي خارج السيطرة المعقولة لمقدم الخدمة، مع التزام مقدم الخدمة بتوثيق العمل والتكاليف."],
      ["7. النزاعات وحقوق المستهلك", "يبدأ التعامل مع الاعتراض بالتواصل مع دعم معاملاتي كير لمحاولة الحل وديًا. لا تحد هذه السياسة من أي حق أو وسيلة انتصاف لا يجوز التنازل عنها وفق أنظمة المملكة العربية السعودية."],
      ["8. التحديثات والتواصل", "يظهر تاريخ جديد عند إجراء تعديل جوهري على السياسة. تُرسل الأسئلة وطلبات الإلغاء والاسترداد عبر صفحة تواصل ودعم في معاملاتي كير. الجهة المشغلة: شركة ستريك إكسبريس، السجل التجاري 7051197981."],
    ],
  };

  return <div className="public-flat min-h-screen overflow-x-hidden bg-[#f5f9ff] text-[#102a43]" dir={isEnglish ? "ltr" : "rtl"}>
    <PublicHeader onChooseService={() => window.location.assign("/#request")} />
    <main>
      <section className="relative overflow-hidden border-b border-[#dce8f6] bg-[#eaf7ff] py-14 sm:py-20"><span className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[#ccecff]/60" /><span className="absolute -bottom-20 left-[12%] h-52 w-52 rotate-12 rounded-[4rem] bg-[#a9ead4]/25" /><div className="container relative"><span className="inline-flex items-center gap-2 rounded-full bg-white/85 px-4 py-2 text-xs font-black text-[#0878f9]"><RotateCcw className="h-4 w-4" />{isEnglish ? "Customer rights" : "حقوق المستخدم"}</span><h1 className="font-display mt-5 max-w-4xl text-4xl font-black leading-[1.25] tracking-[-0.075em] sm:text-6xl">{copy.title}</h1><p className="mt-6 max-w-3xl text-base leading-8 text-[#526d85] sm:text-lg">{copy.intro}</p><span className="mt-5 inline-flex rounded-full border border-[#cfe1f1] bg-white/75 px-3 py-1.5 text-xs font-bold text-[#60778f]">{copy.updated}</span></div></section>
      <section className="py-10 sm:py-14"><div className="container max-w-6xl"><div className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-[#f0d9a4] bg-[#fff9e9] p-5 text-[#6f5318]"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><h2 className="text-sm font-black">{copy.warningTitle}</h2><p className="mt-2 text-sm leading-7">{copy.warning}</p></div></div></div><div className="rounded-2xl border border-[#bfe0fa] bg-[#edf8ff] p-5 text-[#31516e]"><div className="flex items-start gap-3"><CircleDollarSign className="mt-0.5 h-5 w-5 shrink-0 text-[#0878f9]" /><p className="text-sm font-bold leading-7">{copy.noPayments}</p></div></div></div>
        <div className="mt-7 overflow-hidden rounded-3xl border border-[#dce8f6] bg-white shadow-[0_12px_28px_rgba(28,104,182,.06)]"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-start text-sm"><thead className="bg-[#0878f9] text-white"><tr><th className="px-5 py-4 text-start font-black">{copy.stage}</th><th className="px-5 py-4 text-start font-black">{copy.cancellation}</th><th className="px-5 py-4 text-start font-black">{copy.refund}</th></tr></thead><tbody>{copy.rows.map((row, index) => <tr key={row[0]} className={index % 2 ? "bg-[#f8fbff]" : "bg-white"}>{row.map((cell, cellIndex) => <td key={cell} className={`border-t border-[#e7eff8] px-5 py-4 align-top leading-7 ${cellIndex === 0 ? "font-black text-[#17334f]" : "text-[#526d85]"}`}>{cell}</td>)}</tr>)}</tbody></table></div></div>
        <div className="mt-7 grid gap-5 md:grid-cols-2">{copy.sections.map(([title, body], index) => <article key={title} className="rounded-3xl border border-[#dce8f6] bg-white p-6 shadow-[0_10px_24px_rgba(28,104,182,.05)]"><div className="flex items-start gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${index === 0 ? "bg-[#fff1f3] text-[#b83c4a]" : "bg-[#eaf3ff] text-[#0878f9]"}`}>{index === 0 ? <XCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}</span><div><h2 className="font-display text-xl font-black tracking-[-0.04em] text-[#17334f]">{title}</h2><p className="mt-3 text-sm leading-8 text-[#526d85]">{body}</p></div></div></article>)}</div>
      </div></section>
    </main>
    <PublicFooter />
  </div>;
}
