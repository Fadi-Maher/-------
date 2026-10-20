import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const homePage = readFileSync(new URL("./pages/Home.tsx", import.meta.url), "utf8");
const supportButton = readFileSync(new URL("./components/WhatsAppSupportButton.tsx", import.meta.url), "utf8");
const maalamatiAssistant = readFileSync(new URL("./components/MaalamatiAssistant.tsx", import.meta.url), "utf8");
const assistantAvatar = readFileSync(new URL("./components/AssistantAvatar.tsx", import.meta.url), "utf8");
const publicFooter = readFileSync(new URL("./components/PublicFooter.tsx", import.meta.url), "utf8");
const aboutPage = readFileSync(new URL("./pages/About.tsx", import.meta.url), "utf8");
const contactPage = readFileSync(new URL("./pages/Contact.tsx", import.meta.url), "utf8");
const trackPage = readFileSync(new URL("./pages/TrackRequest.tsx", import.meta.url), "utf8");
const publicHeader = readFileSync(new URL("./components/PublicHeader.tsx", import.meta.url), "utf8");
const customerSignup = ["./pages/CustomerSignup.tsx", "./components/CustomerAuthForm.tsx", "./lib/customerSession.ts"].map(path => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");
const customerAccount = readFileSync(new URL("./pages/CustomerAccount.tsx", import.meta.url), "utf8");
const appRoutes = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const ownerLogin = readFileSync(new URL("./pages/OwnerLogin.tsx", import.meta.url), "utf8");
const requestsDashboard = readFileSync(new URL("./pages/RequestsDashboard.tsx", import.meta.url), "utf8");
const dashboardLayout = readFileSync(new URL("./components/DashboardLayout.tsx", import.meta.url), "utf8");
const employeesDashboard = readFileSync(new URL("./pages/EmployeesDashboard.tsx", import.meta.url), "utf8");
const teamWorkspace = readFileSync(new URL("./pages/TeamWorkspace.tsx", import.meta.url), "utf8");
const teamRequestDetail = readFileSync(new URL("./pages/TeamRequestDetail.tsx", import.meta.url), "utf8");
const auditDashboard = readFileSync(new URL("./pages/AuditDashboard.tsx", import.meta.url), "utf8");
const oauthCallback = readFileSync(new URL("../../server/_core/oauth.ts", import.meta.url), "utf8");
const serverDb = readFileSync(new URL("../../server/db.ts", import.meta.url), "utf8");
// Automatic notification wording lives in editable templates; db.ts selects them by key.
const notificationTemplates = readFileSync(new URL("../../shared/notificationTemplates.ts", import.meta.url), "utf8");
const signedInWorkspace = readFileSync(new URL("./lib/signedInWorkspace.ts", import.meta.url), "utf8");
const customerDetail = readFileSync(new URL("./pages/CustomerDetail.tsx", import.meta.url), "utf8");
const customersDashboard = readFileSync(new URL("./pages/CustomersDashboard.tsx", import.meta.url), "utf8");
const accountPage = readFileSync(new URL("./pages/Account.tsx", import.meta.url), "utf8");
const customerNotificationCenter = readFileSync(new URL("./components/CustomerNotificationCenter.tsx", import.meta.url), "utf8");
const globalStyles = readFileSync(new URL("./index.css", import.meta.url), "utf8");
const unifiedAccessButton = readFileSync(new URL("./components/UnifiedAccessButton.tsx", import.meta.url), "utf8");
const authModal = readFileSync(new URL("./components/AuthModal.tsx", import.meta.url), "utf8");
const completePhoneProfile = readFileSync(new URL("./components/CompletePhoneProfile.tsx", import.meta.url), "utf8");
const phoneProfileRouter = readFileSync(new URL("../../server/phoneProfileRouter.ts", import.meta.url), "utf8");
const agentDocumentsRouter = readFileSync(new URL("../../server/agentApplicationDocumentsRouter.ts", import.meta.url), "utf8");
const agentDocumentsContract = readFileSync(new URL("../../shared/agentDocuments.ts", import.meta.url), "utf8");
const accessLogin = readFileSync(new URL("./pages/AccessLogin.tsx", import.meta.url), "utf8");
const agentLogin = ["./pages/AgentLogin.tsx", "./lib/agentAccessCopy.ts"].map(path => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");
const customerQuotePanel = readFileSync(new URL("./components/CustomerQuotePanel.tsx", import.meta.url), "utf8");
const deadlineIndicator = readFileSync(new URL("./components/DeadlineIndicator.tsx", import.meta.url), "utf8");
const requestConversation = readFileSync(new URL("./components/RequestConversation.tsx", import.meta.url), "utf8");
const requestReviewPanel = readFileSync(new URL("./components/RequestReviewPanel.tsx", import.meta.url), "utf8");
const assistantKnowledge = readFileSync(new URL("./pages/AssistantKnowledge.tsx", import.meta.url), "utf8");
const serverRouters = readFileSync(new URL("../../server/routers.ts", import.meta.url), "utf8");
const databaseSchema = readFileSync(new URL("../../drizzle/schema.ts", import.meta.url), "utf8");
const appShowcase = readFileSync(new URL("./components/AppShowcaseSection.tsx", import.meta.url), "utf8");
const pwaInstall = readFileSync(new URL("./components/PwaInstall.tsx", import.meta.url), "utf8");
const termsPage = readFileSync(new URL("./pages/TermsAndConditions.tsx", import.meta.url), "utf8");
const refundPolicy = readFileSync(new URL("./pages/RefundAndCancellation.tsx", import.meta.url), "utf8");

describe("النصوص العامة لمعاملاتي", () => {
  it("يشرح عروض الأسعار والمقارنة بعد إرسال الطلب بالعربية والإنجليزية", () => {
    expect(homePage).toContain("عند توفر عروض الأسعار ستتمكن من اختيار العرض ومقارنة السعر ومدة الإنجاز.");
    expect(homePage).toContain("When quotes are available, you can compare price and turnaround time.");
  });

  it("يستبدل زر الدعم القديم بالمساعد الذكي ثنائي اللغة مع واتساب داخل النافذة", () => {
    expect(supportButton).toContain("return null");
    expect(maalamatiAssistant).toContain('launcher: "المساعد الذكي"');
    expect(maalamatiAssistant).toContain('launcher: "Smart assistant"');
    expect(maalamatiAssistant).toContain("trpc.assistant.chat.useMutation");
    expect(maalamatiAssistant).toContain("لا تشارك رقم الجوال أو الهوية أو رمز التحقق");
    expect(maalamatiAssistant).toContain("wa.me");
    expect(appRoutes).toContain("<MaalamatiAssistant />");
    expect(maalamatiAssistant.match(/<AssistantAvatar\s*\/>/g)).toHaveLength(2);
    expect(assistantAvatar).toContain("maalamati-assistant-avatar-original_dac6bf34.webp");
    expect(assistantAvatar).toContain('data-testid="assistant-avatar-fallback"');
    expect(maalamatiAssistant).toContain("هل توافق على حفظ هذه المحادثة؟");
    expect(maalamatiAssistant).toContain("Save this conversation?");
    expect(maalamatiAssistant).toContain("المتابعة دون حفظ");
    expect(maalamatiAssistant).toContain("trpc.assistant.consent.useMutation");
    expect(maalamatiAssistant).toContain("trpc.assistant.revokeConsent.useMutation");
  });

  it("يوفر للمالك قاعدة أسئلة وأجوبة محمية ويربطها بالمساعد دون حفظ قبل الموافقة", () => {
    expect(appRoutes).toContain('path={"/settings/assistant"}');
    expect(dashboardLayout).toContain('label: "معرفة المساعد"');
    expect(assistantKnowledge).toContain("trpc.assistant.knowledge.list.useQuery");
    expect(assistantKnowledge).toContain("trpc.assistant.knowledge.create.useMutation");
    expect(assistantKnowledge).toContain("trpc.assistant.knowledge.update.useMutation");
    expect(assistantKnowledge).toContain("trpc.assistant.knowledge.delete.useMutation");
    expect(assistantKnowledge).toContain("لا تضع بيانات عملاء أو أرقام طلبات أو معلومات سرية");
    expect(serverRouters).toContain("consentSessionId");
    expect(serverRouters).toContain("appendAssistantConversationExchange");
    expect(serverRouters).toContain("redactAssistantMessage(lastUserMessage.content)");
    expect(databaseSchema).toContain('mysqlTable("assistant_faqs"');
    expect(databaseSchema).toContain('mysqlTable("assistant_conversation_sessions"');
    expect(databaseSchema).toContain('mysqlTable("assistant_conversation_messages"');
  });

  it("يعرض قسم تطبيق معاملاتي عالي الجودة ويربطه بتثبيت PWA الحقيقي دون شعارات متاجر غير متاحة", () => {
    expect(homePage).toContain("<AppShowcaseSection isEnglish />");
    expect(homePage).toContain("<AppShowcaseSection isEnglish={false} />");
    expect(appShowcase).toContain("معاملتك أسهل مع تطبيق معاملاتي كير");
    expect(appShowcase).toContain("Your transaction is easier with the Maalamati Care app");
    expect(appShowcase).toContain('id="maalamati-app"');
    expect(appShowcase).toContain('aria-label={isEnglish ? "Maalamati Care app preview on a photorealistic modern phone" : "معاينة تطبيق معاملاتي كير على هاتف حديث واقعي"}');
    expect(appShowcase).toContain('<PwaInstall variant="showcase" isEnglish={isEnglish} showPush={false} />');
    expect(pwaInstall).toContain('window.addEventListener("beforeinstallprompt"');
    expect(pwaInstall).toContain("await installPrompt.prompt()");
    expect(pwaInstall).toContain('variant?: "footer" | "showcase"');
    expect(appShowcase).toContain("maalamati-my-requests-demo_0ac8bb82_c4d30924.mp4");
    expect(appShowcase).toContain("maalamati-requests-scene-1_a053dcd8.webp");
    expect(appShowcase).toContain('alt={isEnglish ? "My requests account overview" : "معاينة لوحة حساب طلباتي"}');
    expect(appShowcase).toContain("prefers-reduced-motion: reduce");
    expect(appShowcase).toContain("autoPlay");
    expect(appShowcase).toContain("muted");
    expect(appShowcase).toContain("loop");
    expect(appShowcase).toContain("playsInline");
    expect(appShowcase).toContain('preload="metadata"');
    expect(appShowcase).toContain("onError={() => setVideoUnavailable(true)}");
    expect(appShowcase).toContain('className="absolute inset-0 h-full w-full object-cover"');
    expect(appShowcase).not.toContain("ORANGE_PHONE_URL");
    expect(appShowcase).toContain('data-testid="phone-frame-behind-video"');
    expect(appShowcase).toContain("h-[554px] w-[443px]");
    expect(appShowcase).toContain("sm:h-[658px] sm:w-[527px]");
    expect(appShowcase).toContain("rotate-[0.75deg]");
    expect(appShowcase).toContain("-rotate-[0.75deg]");
    expect(appShowcase).toContain("left-[22.5%] top-[8.5%] z-20");
    expect(appShowcase).toContain("left-[20.2%] top-[6.4%] z-10");
    expect(appShowcase).not.toContain("left-[1.5%] top-[36%] z-20");
    expect(appShowcase).not.toContain("mix-blend-screen");
    expect(appShowcase).not.toContain("App Store");
    expect(appShowcase).not.toContain("Google Play");
    expect(appShowcase).not.toContain("AppGallery");
  });

  it("يوفر صفحة شروط وأحكام أصلية وثنائية اللغة ويربطها بالتذييل والمسار العام", () => {
    expect(appRoutes).toContain('path={"/terms-and-conditions"}');
    expect(appRoutes).toContain("TermsAndConditions");
    expect(publicFooter).toContain('{ label: "الشروط والأحكام", href: "/terms-and-conditions" }');
    expect(publicFooter).toContain('{ label: "Terms and Conditions", href: "/terms-and-conditions" }');
    expect(termsPage).toContain('title: "الشروط والأحكام"');
    expect(termsPage).toContain('title: "Terms and Conditions"');
    expect(termsPage).toContain("عروض الأسعار");
    expect(termsPage).toContain("لا تُعد المنصة جهة حكومية");
    expect(termsPage).toContain("لا تنشئ معاملاتي كير تقييمات وهمية");
    expect(termsPage).toContain("لا يُحفظ سجل المحادثة معه إلا بعد موافقة صريحة");
    expect(termsPage).toContain("أنا نظام ذكاء اصطناعي ولست محاميًا");
    expect(termsPage).toContain("I am an AI system, not a lawyer");
    expect(termsPage).toContain("السجل التجاري 7051197981");
    expect(termsPage).toContain("<PublicHeader");
    expect(termsPage).toContain("<PublicFooter />");
  });

  it("يوفر سياسة استرداد ثنائية اللغة ويفرض موافقة موثقة على العميل الجديد فقط", () => {
    expect(appRoutes).toContain('path={"/refund-and-cancellation"}');
    expect(appRoutes).toContain("RefundAndCancellation");
    expect(publicFooter).toContain('{ label: "الاسترداد والإلغاء", href: "/refund-and-cancellation" }');
    expect(publicFooter).toContain('{ label: "Refund and cancellation", href: "/refund-and-cancellation" }');
    expect(refundPolicy).toContain("سياسة الاسترداد والإلغاء");
    expect(refundPolicy).toContain("Refund and Cancellation Policy");
    expect(refundPolicy).toContain("لا تعالج معاملاتي كير المدفوعات الإلكترونية داخل المنصة حاليًا");
    expect(refundPolicy).toContain("لا تحد هذه السياسة من أي حق");
    expect(customerSignup).toContain("CURRENT_TERMS_VERSION");
    expect(customerSignup).toContain("termsAccepted: true");
    expect(customerSignup).toContain('href="/terms-and-conditions"');
    expect(customerSignup).toContain('href="/refund-and-cancellation"');
    expect(customerSignup).toContain("isBusy || !termsAccepted");
    expect(customerSignup).toContain('if (existing)');
    expect(serverRouters).toContain("termsAccepted: z.literal(true)");
    expect(serverRouters).toContain("termsAcceptedAt: new Date()");
    expect(serverDb).toContain("termsAcceptedAt: input.termsAcceptedAt");
    expect(databaseSchema).toContain('termsAcceptedAt: timestamp("termsAcceptedAt")');
    expect(databaseSchema).toContain('termsVersion: varchar("termsVersion"');
  });

  it("يوحّد صفحات الموقع العامة بترويسة وتذييل وبطاقات دعم مستوحاة بنيويًا من المرجع", () => {
    for (const page of [homePage, aboutPage, contactPage]) {
      expect(page).toContain("PublicFooter");
    }
    expect(aboutPage).toContain("PublicHeader");
    expect(contactPage).toContain("PublicHeader");
    expect(contactPage).toContain("overflow-x-hidden");
    expect(contactPage).toContain('xl:grid-cols-4');
    expect(contactPage).toContain('whatsappTitle: "دعم واتساب"');
    expect(contactPage).toContain('trackTitle: "تتبّع طلبك"');
    expect(contactPage).toContain('requestTitle: "طلب خدمة"');
    expect(contactPage).toContain('accountTitle: "طلباتي"');
    expect(contactPage).toContain("copy.topics.map");
    expect(publicFooter).toContain("السجل التجاري: 7051197981");
    expect(publicFooter).toContain("Commercial Registration: 7051197981");
    expect(publicFooter).toContain("بُني بأيدٍ سعودية");
    expect(publicFooter).toContain("Built with Saudi hands");
    expect(globalStyles).toContain(".saudi-built-badge");
  });

  it("يعزل دخول المالك عن الواجهة العامة ويُبقي صفحته المستقلة", () => {
    expect(publicHeader).not.toContain('href="/owner-login"');
    expect(publicHeader).not.toContain("تسجيل الدخول للمالك");
    expect(appRoutes).toContain('path={"/owner-login"}');
    expect(ownerLogin).toContain("onClick={startLogin}");
    expect(publicHeader).toContain("تسجيل الخروج");
    expect(publicHeader).toContain("UnifiedAccessButton");
    expect(unifiedAccessButton).toContain("bg-[#0668d9]");
    expect(publicHeader).not.toContain('data-auth-trigger="signup"');
  });

  it("يفرض ملفًا شخصيًا بعد OTP والدور لكل عميل أو معقب قبل أي توجيه", () => {
    expect(authModal).toContain('useState<Phase>("phone")');
    expect(authModal).toContain('setPhase("role")');
    expect(authModal).toContain('setPhase("profile")');
    expect(authModal).toContain("utils.phoneProfile.get.fetch");
    expect(authModal).toContain("trpc.phoneProfile.save.useMutation");
    expect(authModal).toContain("<CompletePhoneProfile");
    expect(authModal).toContain("initialProfile={savedProfile");
    expect(authModal).toContain("initialProfile={savedProfile ?? undefined}");
    expect(authModal).toContain('data-account-choice="customer"');
    expect(authModal).toContain('data-account-choice="agent"');
    expect(authModal).not.toContain("findByPhoneAccessToken");
    expect(completePhoneProfile).toContain('role === "customer" && isNewCustomer && !acceptedTerms');
    expect(completePhoneProfile).toContain("emailPattern.test");
    expect(completePhoneProfile).toContain('target="_blank"');
    expect(phoneProfileRouter).toContain("verifyPhoneLoginTicket(input.verificationToken)");
    expect(phoneProfileRouter).not.toContain("input.phone");
  });

  it("يقصر تنزيل مستندات المعقب على الإدارة ويحمي metadata من عناوين التخزين", () => {
    expect(agentDocumentsRouter).toContain("consent: z.literal(true)");
    expect(agentDocumentsRouter).toContain("list: adminProcedure");
    expect(agentDocumentsRouter).toContain("download: adminProcedure");
    expect(agentDocumentsRouter).toContain("no-store, private");
    expect(agentDocumentsContract).toContain("never\n * contains phone, applicationId, storageKey, object URL");
  });

  it("يوفر تسجيل حساب العميل برقم الجوال كمعرّف أساسي", () => {
    expect(appRoutes).toContain('path={"/customer-signup"}');
    expect(unifiedAccessButton).toContain("openAuthModal");
    expect(authModal).toContain("<Dialog");
    expect(customerSignup).toContain("registerWithPhone.useMutation");
    expect(customerSignup).toContain("normalizeSaudiPhone");
    expect(customerSignup).toContain('DEMO_CUSTOMER_OTP = "123456"');
    expect(customerSignup).toContain("رقم الجوال هو المعرّف الأساسي");
    expect(customerSignup).toContain("phone");
    expect(customerSignup).toContain('step, setStep] = useState<"phone" | "verify" | "details">');
    expect(customerSignup).toContain('finishSignIn({ role: "customer"');
    expect(customerSignup).not.toContain('window.setTimeout(() => window.location.assign("/"), 1500)');
    expect(customerSignup).toContain("findByPhoneAccessToken.useMutation");
    expect(customerSignup).toContain("maalamati_customer_name");
    expect(customerSignup).toContain("Existing customers keep their saved details");
    expect(customerSignup).toContain('send: "المتابعة"');
    expect(customerSignup).toContain('send: "Continue"');
    expect(customerSignup).not.toContain("المتابعة إلى التحقق");
    expect(customerSignup).not.toContain("أدخل رقم الجوال أولًا. سنتحقق منه قبل عرض سجل العميل أو إنشاء سجل جديد");
    expect(customerSignup).not.toContain('account: "حساب العميل"');
  });

  it("يظهر اسم العميل المسجل في الهيدر ويتيح خروج جلسة الجوال", () => {
    expect(publicHeader).toContain("maalamati_customer_name");
    expect(publicHeader).toContain("maalamati_customer_access_token");
    // A signed-in visitor sees their account entry instead of a second sign-in.
    expect(publicHeader).toContain("workspace\n      ? { ar: workspaceLabel(workspace, false)");
    expect(signedInWorkspace).toContain('href: "/customer-account"');
    expect(publicHeader).toContain("CustomerAccountMenu");
    expect(publicHeader).toContain("My requests");
    expect(publicHeader).toContain("طلباتي");
  });

  it("يختصر نموذج العميل المسجل ويحفظ الطلب مباشرة داخل حسابه", () => {
    expect(homePage).toContain("useCustomerSession");
    expect(homePage).toContain("trpc.requests.createForCustomer.useMutation");
    expect(homePage).toContain("!customerSession ?");
    expect(homePage).toContain("سيُضاف الطلب مباشرة إلى طلباتك");
    expect(homePage).toContain("إضافة إلى طلباتي");
    expect(homePage).toContain("تمت إضافة الطلب مباشرة إلى حسابك");
  });

  it("يربط حساب العميل بطلباته وردوده ويتيح تسجيل الخروج", () => {
    expect(appRoutes).toContain('path={"/customer-account"}');
    expect(publicHeader).toContain('href="/customer-account"');
    expect(customerAccount).toContain("trackByPhoneVerified.useQuery");
    expect(customerAccount).toContain("My requests");
    expect(customerAccount).toContain("آخر التحديثات");
    expect(customerAccount).toContain("maalamati_customer_access_token");
    expect(customerAccount).toContain("maalamati_customer_name");
  });

  it("يعرض لوحة طلباتي الجديدة بشريط إجراء وتبويبات متجاوبة وبحث وفلاتر حالات", () => {
    expect(customerAccount).toContain('type CustomerTab = "overview" | "requests" | "quotes" | "updates"');
    expect(customerAccount).toContain('newRequest: "إنشاء طلب جديد"');
    expect(customerAccount).toContain('newRequest: "Create a new request"');
    expect(customerAccount).toContain('aria-label={isEnglish ? "Customer account sections" : "أقسام حساب العميل"}');
    expect(customerAccount).toContain('className="-mx-4 mt-5 overflow-x-auto px-4 pb-2 lg:hidden"');
    expect(customerAccount).toContain('role="tabpanel"');
    expect(customerAccount).toContain('id="customer-request-search"');
    expect(customerAccount).toContain("statusTabs.map");
    expect(customerAccount).toContain("requestStatusCounts");
    expect(customerAccount).toContain("CustomerNotificationCenter");
    expect(customerAccount).toContain("CustomerQuotePanel");
    expect(customerAccount).toContain("RequestConversation");
    expect(customerAccount).toContain("RequestReviewPanel");
  });

  it("يضع طلب العميل في انتظار التحقق قبل الحفظ", () => {
    expect(homePage).toContain("normalizeSaudiPhone");
    expect(homePage).toContain("setPendingRequest");
    expect(homePage).toContain("setVerificationOpen(true)");
    expect(homePage).toContain("<DemoRequestOtp isEnglish={false}");
    expect(homePage).toContain("تم حفظ الطلب وإضافة العميل إلى قائمة العملاء.");
    expect(homePage).toContain("Your request has been saved and added to the customer list.");
    expect(homePage).toContain("A demo WhatsApp verification code is ready below. The request is not saved yet.");
    expect(homePage).toContain("اعتماد الطلب بعد التحقق");
    expect(homePage).toContain("أدخل رمز التحقق التجريبي المكون من ست خانات");
  });

  it("يعتمد OTP بزر مستقل من دون نموذج متداخل يعيد إرسال طلب الصفحة", () => {
    expect(homePage).not.toContain('<form onSubmit={verify} className="mt-4 flex flex-col gap-3">');
    expect(homePage).toContain('type="button" onClick={() => { void verify(); }}');
    expect(homePage).toContain("saveCustomerSession");
    expect(homePage).toContain("CUSTOMER_SESSION_EVENT");
  });

  it("يعرض نجاح الطلب ثم ينقل العميل تلقائيًا إلى صفحة طلباته", () => {
    expect(homePage).toContain("RequestSuccessNotice");
    expect(homePage).toContain("تم إنشاء طلبك بنجاح");
    expect(homePage).toContain("Request created successfully");
    expect(homePage).toContain('window.location.assign("/customer-account")');
    expect(homePage).toContain("request-success-progress");
  });

  it("يتتبع الطلبات بالجوال بعد تحقق WhatsApp التجريبي دون الرقم المرجعي", () => {
    expect(trackPage).toContain('get("demo") === "1"');
    expect(trackPage).toContain('const demoOtp = "123456"');
    expect(trackPage).toContain("trackByPhoneVerified.useQuery");
    expect(trackPage).toContain("verifyPhoneDemo.useMutation");
    expect(trackPage).toContain("<InputOTP maxLength={6}");
    expect(trackPage).toContain("InputOTPSlot");
    expect(trackPage).toContain("Verify and view requests");
    expect(trackPage).toContain("تحقق واعرض الطلبات");
    expect(trackPage).toContain("سجل طلباتك");
    expect(trackPage).toContain("otp-shake");
    expect(trackPage).toContain("لم يُرسل هذا الرمز عبر واتساب ولا يُستخدم للتحقق الحقيقي.");
    expect(trackPage).toContain("The code is incorrect. Enter all six digits shown above and try again.");
    expect(trackPage).not.toContain("referenceInput");
  });

  it("يوضح دخول المالك وخروجه من لوحة الإدارة", () => {
    expect(dashboardLayout).toContain('window.location.assign("/owner-login")');
    expect(dashboardLayout).toContain('aria-label="تسجيل الخروج"');
    expect(dashboardLayout).toContain('setLocation("/owner-login")');
  });

  it("يوفر مسار تنقل والطلب السابق والتالي داخل صفحة طلب فريق التشغيل", () => {
    expect(teamRequestDetail).toContain("مسار التنقل");
    expect(teamRequestDetail).toContain("aria-label=");
    expect(teamRequestDetail).toContain("الطلب السابق");
    expect(teamRequestDetail).toContain("الطلب التالي");
    expect(teamRequestDetail).toContain("previousRequest");
    expect(teamRequestDetail).toContain("nextRequest");
    expect(teamRequestDetail).toContain("navigationRequests");
  });

  it("يفعل قسم المعقبين كقسم مستقل مع بوابة تشغيل", () => {
    expect(dashboardLayout).toContain('label: "المعقبين"');
    expect(dashboardLayout).toContain('path: "/agents"');
    expect(dashboardLayout.indexOf('label: "المعقبين"')).toBeLessThan(dashboardLayout.indexOf('label: "العملاء"'));
    expect(appRoutes).toContain('path={"/agent-dashboard"}');
    expect(appRoutes).toContain('path={"/team-request/:requestId"}');
    expect(teamWorkspace).toContain("بوابة المعقبين");
    expect(teamRequestDetail).toContain("trpc.agents.addUpdate.useMutation");
  });

  it("يضيف قسم الموظفين المستقل ويعرض الطلبات الموكلة إليهم", () => {
    expect(appRoutes).toContain('path={"/employees"}');
    expect(dashboardLayout).toContain('label: "الموظفين"');
    expect(dashboardLayout.indexOf('label: "الموظفين"')).toBeLessThan(dashboardLayout.indexOf('label: "العملاء"'));
    expect(employeesDashboard).toContain("حسابات الموظفين");
    expect(employeesDashboard).toContain("trpc.staffAccounts.list.useQuery");
    expect(employeesDashboard).toContain("إضافة موظف");
    expect(employeesDashboard).toContain("حفظ الحساب والصلاحيات");
    expect(appRoutes).toContain('path={"/employee-dashboard"}');
  });

  it("يعرض سجل التدقيق للمالك ويربط تغييرات الفريق", () => {
    expect(dashboardLayout).toContain('label: "سجل التدقيق"');
    expect(appRoutes).toContain('path={"/audit"}');
    expect(auditDashboard).toContain("سجل تدقيق الطلبات");
    expect(auditDashboard).toContain("trpc.audit.list.useQuery");
    expect(auditDashboard).toContain("قبل التغيير");
    expect(auditDashboard).toContain("بعد التغيير");
  });

  it("يوجه حسابات OAuth إلى البوابة المطابقة للدور", () => {
    expect(oauthCallback).toContain('linkedUser?.role === "agent"');
    expect(oauthCallback).toContain('"/agent-dashboard"');
    expect(oauthCallback).toContain('"/employee-dashboard"');
    expect(oauthCallback).toContain('"/dashboard"');
  });

  it("ينبه فريق التشغيل داخل الموقع بتحديث تلقائي خفيف", () => {
    expect(teamWorkspace).toContain("trpc.teamNotifications.list.useQuery");
    expect(teamWorkspace).toContain("refetchInterval: 20_000");
    expect(teamWorkspace).toContain("refetchIntervalInBackground: false");
    expect(teamWorkspace).toContain("unreadCount");
    expect(teamWorkspace).toContain("markAllRead");
    expect(teamWorkspace).toContain("window.setInterval");
    expect(teamWorkspace).toContain("window.clearInterval");
    expect(serverDb).toContain('"team.new_customer_request"');
    expect(notificationTemplates).toContain('type: "new_customer_request"');
    expect(serverDb).toContain("requestId: input.requestId");
    // Phone/email are masked in both languages before the summary enters the template.
    expect(serverDb).toContain('summarize("[بريد محجوب]", "[جوال محجوب]")');
    expect(serverDb).toContain('summarize("[email hidden]", "[phone hidden]")');
    expect(serverDb).toContain("[جوال محجوب]");
    expect(serverDb).toContain("[بريد محجوب]");
    expect(serverDb).not.toContain("وصل طلب جديد إلى معاملاتي وهو بانتظار مراجعة الإدارة وإسناده");
    expect(teamWorkspace).toContain("openedNotificationIds");
    expect(teamWorkspace).toContain("openTeamNotification");
    expect(teamWorkspace).toContain("await markRead.mutateAsync({ notificationId: item.id })");
    expect(teamWorkspace).toContain("if (item.requestId) openRequestPage(item.requestId)");
    expect(teamWorkspace).toContain("!item.isRead && !openedNotificationIds.includes(item.id)");
    expect(serverDb).toContain('"team.request_assigned"');
    expect(notificationTemplates).toContain('type: "request_assigned"');
  });

  it("يخفي إشعارات العميل بعد فتحها وينقل إلى الطلب ويظهر الجرس في الرئيسية للمسجل فقط", () => {
    expect(customerNotificationCenter).toContain("visibleNotifications");
    expect(customerNotificationCenter).toContain("!item.isRead && !dismissedIds.includes(item.id)");
    expect(customerNotificationCenter).toContain("await markRead.mutateAsync");
    expect(customerNotificationCenter).toContain("onOpenRequest(notification.requestId)");
    expect(customerNotificationCenter).toContain("/customer-account?request=");
    expect(homePage).toContain("customerSession ? <CustomerNotificationCenter");
    expect(homePage).toContain("onOpenRequest={(requestId) => window.location.assign(`/customer-account?request=${requestId}`)}");
    expect(customerAccount).toContain("new URLSearchParams(window.location.search).get(\"request\")");
    expect(customerAccount).toContain("setActiveTab");
  });

  it("يتيح سوق عروض لجميع أعضاء الفريق دون كشف اتصال العميل قبل الاختيار", () => {
    const openMarket = serverDb.slice(serverDb.indexOf("export async function listOpenRequestsForTeam"), serverDb.indexOf("export async function upsertRequestQuote"));
    expect(teamWorkspace).toContain("trpc.quotes.openRequests.useQuery");
    expect(teamRequestDetail).toContain("trpc.quotes.submit.useMutation");
    expect(teamRequestDetail).toContain("السعر بالريال");
    expect(teamRequestDetail).toContain("مدة الإنجاز بالأيام");
    expect(teamRequestDetail).toContain("اسم العميل محجوب حتى اعتماد عرضك، وتبقى بيانات التواصل مخفية دائمًا");
    expect(openMarket).not.toContain("requesterName:");
    expect(openMarket).not.toContain("phone:");
  });

  it("يعرض عروض السعر للعميل ويعتمد عرضًا واحدًا ذريًا", () => {
    expect(trackPage).toContain("trpc.quotes.customerList.useQuery");
    expect(trackPage).toContain("trpc.quotes.accept.useMutation");
    expect(customerQuotePanel).toContain("عروض الأسعار");
    expect(customerAccount).toContain("trpc.quotes.customerList.useQuery");
    expect(customerAccount).toContain("CustomerQuotePanel");
    expect(customerQuotePanel).toContain("اعتماد العرض");
    expect(serverDb).toContain("isNull(transactionRequests.quoteSelectedAt)");
    expect(serverDb).toContain("affectedRows");
    expect(serverDb).toContain('"customer.quote_selected"');
    expect(notificationTemplates).toContain('type: "quote_selected"');
    expect(serverDb).toContain("providerAcceptedAt");
    expect(serverDb).toContain('status: "declined"');
  });

  it("يدعم الصوت الاختياري وفلاتر الإشعارات وتنظيف المقروءة", () => {
    expect(teamWorkspace).toContain("maalamati-team-sound");
    expect(teamWorkspace).toContain("playNotificationTone");
    expect(teamWorkspace).toContain("notificationFilter");
    expect(teamWorkspace).toContain("trpc.teamNotifications.delete.useMutation");
    expect(teamWorkspace).toContain("trpc.teamNotifications.clearRead.useMutation");
    expect(serverDb).toContain("deleteTeamNotification");
    expect(serverDb).toContain("clearReadTeamNotifications");
  });

  it("يدعم مهل العروض وقبول مقدم الخدمة وإشعارات العميل وتحديثاته", () => {
    expect(requestsDashboard).toContain("trpc.quotes.setDeadline.useMutation");
    expect(requestsDashboard).toContain("مهلة استقبال العروض");
    expect(teamRequestDetail).toContain("trpc.quotes.withdraw.useMutation");
    expect(teamRequestDetail).toContain("trpc.quotes.providerAccept.useMutation");
    expect(teamRequestDetail).toContain("مهلة قبول الطلب");
    expect(customerQuotePanel).toContain("بانتظار التأكيد");
    expect(customerAccount).toContain("CustomerNotificationCenter");
    expect(customerNotificationCenter).toContain("refetchInterval: 10_000");
    expect(customerNotificationCenter).toContain('item.type === "first_quote_received"');
    expect(customerNotificationCenter).toContain("Your first price quote arrived");
    expect(customerNotificationCenter).toContain("فتح الطلب");
    expect(customerNotificationCenter).toContain("markRead.mutate");
    expect(customerAccount).toContain("onOpenRequest");
    expect(serverDb).toContain('"customer.first_quote_received"');
    expect(notificationTemplates).toContain('type: "first_quote_received"');
    expect(notificationTemplates).toContain('titleAr: "وصل أول عرض سعر"');
    expect(notificationTemplates).toContain('type: "quote_received"');
    expect(notificationTemplates).toContain('type: "provider_acceptance_expired"');
    expect(notificationTemplates).toContain('type: "request_update"');
  });

  it("يرتب طلباتي حسب أحدث عرض ويعرض الشارة والصوت دون رابط سجل المتابعة", () => {
    expect(customerAccount).toContain("orderRequestsByLatestQuote");
    expect(customerAccount).toContain("unreadQuoteRequestIds");
    expect(customerAccount).toContain("عرض جديد");
    expect(customerAccount).toContain("New quote");
    expect(customerAccount).not.toContain("فتح سجل المتابعة");
    expect(customerAccount).not.toContain("Open tracking history");
    expect(customerNotificationCenter).toContain("maalamati_customer_quote_sound");
    expect(customerNotificationCenter).toContain("playQuoteNotificationTone");
    expect(customerNotificationCenter).toContain("/manus-storage/maalamati-quote-alert_818d0073_ab955c73.wav");
    expect(customerNotificationCenter).toContain("new Audio(quoteSoundUrl)");
    expect(customerNotificationCenter).toContain("void audio.play()");
    expect(customerNotificationCenter).toContain('addEventListener("playing"');
    expect(customerNotificationCenter).toContain("audio.currentTime > 0");
    expect(customerNotificationCenter).toContain("1_500");
    expect(customerNotificationCenter).toContain("soundReady");
    expect(customerNotificationCenter).toContain("الصوت جاهز");
    expect(customerNotificationCenter).toContain("previousLatestNotificationId");
    expect(customerNotificationCenter).toContain("latestNotificationId");
    expect(customerNotificationCenter).toContain("تفعيل صوت الإشعارات");
    expect(customerNotificationCenter).toContain("Notification sound is ready for this session");
    expect(customerNotificationCenter).toContain("waitForQuoteToneEnd");
    expect(customerNotificationCenter).toContain("quoteSoundPlayback");
    expect(customerNotificationCenter).toContain("window.setTimeout(resolve, 180)");
    expect(customerNotificationCenter.match(/playQuoteToneOnce\(audio\)/g)?.length).toBe(2);
    expect(customerNotificationCenter).not.toContain("اختبار الصوت");
    expect(customerNotificationCenter).not.toContain("Test sound");
    expect(customerNotificationCenter).toContain("unreadQuoteCount");
    expect(customerNotificationCenter).toContain("quote-bell-alert");
    expect(customerNotificationCenter).toContain("quote-bell-icon");
    expect(globalStyles).toContain("quote-bell-pulse 2.2s");
    expect(globalStyles).toContain("quote-bell-ring 1.9s");
    expect(customerNotificationCenter).toContain("Volume2");
    expect(serverDb).toContain("markCustomerQuoteNotificationsReadForRequest");
  });

  it("يفرز عروض العميل ويصفيها بالسعر والمدة مع مؤشرات زمنية ملونة", () => {
    expect(customerQuotePanel).toContain('sortBy === "price"');
    expect(customerQuotePanel).toContain('sortBy === "duration"');
    expect(customerQuotePanel).toContain("الحد الأعلى للسعر");
    expect(customerQuotePanel).toContain("الحد الأعلى للأيام");
    expect(deadlineIndicator).toContain("bg-[#fff0f2]");
    expect(deadlineIndicator).toContain("remaining <= 30 * 60_000");
    expect(teamRequestDetail).toContain("DeadlineIndicator");
  });

  it("يعرض العروض كبطاقات أفقية ويلخص المقارنة ويرتب المعاملات في صفوف مدمجة", () => {
    expect(customerQuotePanel).toContain("العروض المتاحة");
    expect(customerQuotePanel).toContain("أقل سعر");
    expect(customerQuotePanel).toContain("أسرع إنجاز");
    expect(customerQuotePanel).toContain("lg:grid-cols-[minmax(0,1fr)_150px_190px]");
    expect(customerQuotePanel).toContain("الفرز والتصفية");
    expect(teamWorkspace).toContain("sortedOpenRequests");
    expect(teamWorkspace).toContain("sortedAssignedRequests");
    expect(teamWorkspace).toContain("الأحدث أولًا");
    expect(customerAccount).toContain("expandedRequestId");
    expect(trackPage).toContain("<details key={request.id}");
  });

  it("يعرض أسماء الأطراف المصرح بها فقط دون بيانات التواصل", () => {
    expect(customerQuotePanel).toContain("quote.providerName");
    expect(customerQuotePanel).toContain('quote.providerRole === "agent"');
    expect(customerAccount).toContain("update.senderName");
    expect(requestConversation).toContain("item.senderName");
    expect(teamWorkspace).toContain("meta={request.requesterName}");
    expect(teamWorkspace).not.toContain("request.phone");
    expect(teamRequestDetail).toContain("assignedRequest.requesterName");
    expect(teamRequestDetail).not.toContain("assignedRequest.phone");
    expect(teamRequestDetail).toContain("وتبقى بيانات التواصل مخفية دائمًا");
  });

  it("يضيف محادثة خاصة داخل الطلب المعتمد بين العميل ومقدم الخدمة", () => {
    expect(trackPage).toContain("RequestConversation");
    expect(customerAccount).toContain("RequestConversation");
    expect(teamRequestDetail).toContain("RequestConversation");
    expect(requestConversation).toContain("trpc.conversation.customerSend.useMutation");
    expect(requestConversation).toContain("trpc.conversation.teamSend.useMutation");
    expect(requestConversation).toContain("محادثة خاصة بين العميل ومقدم الخدمة المختار");
    expect(serverDb).toContain("createCustomerRequestComment");
  });

  it("يدعم مرفقات الصور والملفات الآمنة داخل محادثة الطلب", () => {
    expect(requestConversation).toContain("trpc.conversation.customerUpload.useMutation");
    expect(requestConversation).toContain("trpc.conversation.teamUpload.useMutation");
    expect(requestConversation).toContain("MAX_FILE_BYTES");
    expect(requestConversation).toContain(".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx");
    expect(requestConversation).toContain("attachment.mimeType.startsWith");
    expect(serverDb).toContain("createCustomerConversationAttachment");
    expect(serverDb).toContain("createTeamConversationAttachment");
  });

  it("يتيح تقييمًا حقيقيًا واحدًا بعد اكتمال الطلب فقط", () => {
    expect(requestReviewPanel).toContain('status !== "completed"');
    expect(requestReviewPanel).toContain("trpc.reviews.submit.useMutation");
    expect(requestReviewPanel).toContain("Array.from({ length: 5 }");
    expect(trackPage).toContain("RequestReviewPanel");
    expect(customerAccount).toContain("RequestReviewPanel");
    expect(teamRequestDetail).toContain('mode="readonly"');
    expect(requestsDashboard).toContain("request.review.rating");
    expect(serverDb).toContain("createRequestReviewForCustomer");
    expect(serverDb).toContain("تم تقييم هذا الطلب مسبقًا.");
  });

  it("يحوّل الطلبات الجديدة والموكلة إلى أيقونات منبثقة مدمجة", () => {
    expect(teamWorkspace).toContain("HubTrigger");
    expect(teamWorkspace).toContain("title={language.newRequests}");
    expect(teamWorkspace).toContain("طلبات العملاء الجديدة");
    expect(teamWorkspace).toContain("title={language.active}");
    expect(teamWorkspace).toContain('request.status !== "completed"');
    expect(teamWorkspace).toContain('request.status === "completed"');
    expect(teamWorkspace).toContain("CompletedAgentRequests");
    expect(teamWorkspace).toContain("PopoverContent");
    expect(teamWorkspace).toContain("openRequestPage");
    expect(teamWorkspace).toContain("كل طلب يفتح في صفحة مستقلة");
    expect(teamWorkspace).not.toContain("expandedMarketId");
    expect(teamWorkspace).not.toContain("expandedAssignedId");
    expect(teamRequestDetail).toContain("صفحة الطلب");
  });

  it("يوحد الدخول لطالب الخدمة والمعقب ويقصر إنشاء الموظفين على المالك", () => {
    expect(appRoutes).toContain('path={"/login"}');
    expect(appRoutes).toContain('path={"/agent-login"}');
    expect(authModal).toContain('"Customer" : "عميل"');
    expect(authModal).toContain("معقب");
    expect(authModal).not.toContain("href=\"/team-login\"");
    // /agent-login opens the same OTP pop-up and shares its wording; no separate demo login.
    expect(agentLogin).toContain('openAuthModal({ intent: "signin", audience: "agent"');
    expect(agentLogin).toContain("agentAccessCopy(isEnglish)");
    expect(agentLogin).toContain('title: "دخول المعقبين"');
    expect(agentLogin).not.toContain("agentPhoneDemo");
    expect(authModal).toContain("agentCopy.joinNote");
    expect(employeesDashboard).toContain("رقم جوال المعقب");
    expect(employeesDashboard).toContain("الموظفون يضيفهم المالك فقط");
  });

  it("يمنع واجهة الإدارة عن الأدوار غير المالكة", () => {
    expect(dashboardLayout).toContain('user.role !== "admin"');
    expect(dashboardLayout).toContain("هذه اللوحة مخصصة للمالك");
  });

  it("يوحّد نصوص التتبع العامة على رقم الجوال دون الرقم المرجعي", () => {
    const surfaces = [homePage, aboutPage, customerAccount, customerDetail, customersDashboard, accountPage, requestsDashboard];
    const outdatedTrackingCopy = /رقم مرجعي|الرقم المرجعي|رقم المتابعة|Have a reference|reference number|Use your reference|\?reference=/i;
    for (const surface of surfaces) expect(surface).not.toMatch(outdatedTrackingCopy);
    expect(homePage).toContain("استخدم رقم جوالك عند التتبع");
    expect(homePage).toContain("Use your mobile number when tracking");
    expect(trackPage).toContain('get("phone")');
  });

  it("يعرض إحصائيات الطلبات الجديدة والمكتملة ويبحث برقم الجوال في لوحة المالك", () => {
    expect(requestsDashboard).toContain("طلبات جديدة");
    expect(requestsDashboard).toContain("طلبات مكتملة");
    expect(requestsDashboard).toContain('request.status === "received"');
    expect(requestsDashboard).toContain('request.status === "completed"');
    expect(requestsDashboard).toContain("البحث برقم الجوال");
    expect(requestsDashboard).toContain("normalizeDigits(request.phone).includes(normalizedPhone)");
  });

  it("يبقي حقوق النشر باسم الشركة دون وصف إضافي للكيان", () => {
    expect(publicFooter).toContain("© معاملاتي كير 2026. جميع الحقوق محفوظة لشركة ستريك إكسبريس.");
    for (const page of [homePage, aboutPage, contactPage, publicFooter]) {
      expect(page).not.toContain("شركة شخص واحد");
      expect(page).not.toContain("a single-person company");
    }
  });
});
