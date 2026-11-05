# ملاحظات جلسة b5beldnj — 2026-10-22

## التحقق من النطاق العام بعد نشر المستخدم للنسخة 5b16ae07 (02:02 بتوقيت السعودية)
- https://maamalati.manus.space/api/health -> 200 JSON {"status":"ok","service":"maalamati-care"}, cache-control no-store
- /api/ready -> 200 {"status":"ready","database":"connected"}
- phoneAuth.config -> {"mode":"disabled","realMessagesSent":false}
- phoneAuth.requestCode -> PRECONDITION_FAILED؛ requests.track و requests.list دون جلسة -> UNAUTHORIZED
- / /track /owner-login /login /customer-signup /contact -> 200؛ ملف أصل مفقود -> 404
- الترويسات: HSTS (max-age=31536000; includeSubDomains; preload من المنصة)، referrer-policy، nosniff، دون x-powered-by
- رسالة المنصة: Deployment successful؛ النطاقات maamalati-upvugiuu.manus.space و maamalati.manus.space

## خلل مكتشف (من تعديلي السابق)
نموذج الطلب في الصفحة الرئيسية (HomeArabic وHomeEnglish في client/src/pages/Home.tsx) كان يستدعي requests.verifyPhoneDemo قبل requests.create. هذا المسار صار يرفض في الإنتاج، فتعذر على الزائر غير المسجل إرسال طلب في النسخة المنشورة 5b16ae07. وكنت قد قلت للمستخدم إن نموذج الطلبات «يعمل كالمعتاد»، وهذا كان خطأ.
الإصلاح الجاري: client/src/lib/publicRequestSubmission.ts يحفظ الطلب مباشرة عبر requests.create العام في الإنتاج. لا جلسة عميل، ولا ذكر لرقم مرجعي (قرار المشروع: المتابعة برقم الجوال، ويفرضه content.test.ts). كذلك تتجاهل readCustomerSession جلسات الجوال التجريبية القديمة في الإنتاج.

## بيئة التطوير
نحو الساعة 02:11 رفضت قاعدة البيانات بيانات بيئة التطوير لبضع دقائق (ER_ACCESS_DENIED_ERROR 1045). كانت معاينة التطوير /api/ready -> unavailable، والموقع المنشور متصلًا. فشلت 3 اختبارات تعتمد على قاعدة البيانات بسبب هذا الرفض فقط. عاد الاتصال قرابة 02:15 دون تعديل، فنجح 501 ثم 502 اختبار.

## نتيجة التحقق النهائية
تجربة إرسال من البناء الإنتاجي المحلي برقم 0590417263 وإشعار المالك معطل: حُفظ الطلب SE-MVIQGBVR-BZ0U، ثم حُذف هو وسجل العميل (deletedRequests 1، deletedCustomers 1، المتبقي 0).
نسخة احتياطية من التعديلات: /home/ubuntu/maalamati-backup (tracked.patch و untracked.tar)

## تصميم رسالة التوقف
أعيد كتابة client/src/components/PhoneVerificationUnavailable.tsx بصيغتين: variant dialog/card، وcontext signin/track، وonNavigate. الأيقونات: Smartphone مع شارة LockKeyhole، وShieldCheck وFileCheck2 وSend وHeadset وHouse. شارة «متوقف مؤقتًا» بنقطة motion-safe:animate-ping. AuthModal يستخدم dialog. CustomerAuthForm يستخدم card. TrackRequest صار صفحة كاملة فيها PublicHeader.

## طلب 2026-10-22 03:53 (ترحيب + إجابات المساعد + رسالة تأكيد)
- نسخة احتياطية لقاعدة البيانات: /home/ubuntu/maalamati-backup/assistant-knowledge-before-2026-10-22.json (15 سجلًا من assistant_faqs، وlead_bot_settings، وapp_settings).
- حُدّثت قاعدة البيانات عبر /home/ubuntu/maalamati-faq-update.mjs (نسخة في node_modules/.cache؛ خياران --dry-run و--restore). السجلات: 1050001 (طلب خدمة)، 1050002 (كيف أتابع طلبي؟، وصار سؤاله الإنجليزي "How do I follow up on my request?")، 1050008 (الاسترداد: «رقم الجوال الذي أرسلت به الطلب»)، 1050009 (صار السؤال «أين تُحفظ المرفقات الخاصة بطلبي؟»). حُدّث ملفا server/leadBot/knowledgeSeed.ts وknowledge.test.ts ليطابقاها.
- بقيت دون تعديل: 1050005 و1050014 (تحذيرات من مشاركة الرموز)، و1050012 (الانضمام كمعقّب، يتطلب التحقق بالجوال المتوقف؛ يُذكر للمستخدم)، و1050003 و1050006 (عروض الأسعار، تتطلب الدخول).
- ردود الكود المتبقية: مفتاح مشترك shared/phoneTrackingPause.ts قيمته true دائمًا. التعديلات: trackInfo وBOT_BUTTONS.track وopenTrack في shared/leadBot/strings.ts؛ LEAD_BOT_LINKS.track من /track إلى /contact في server/leadBot/settings.ts؛ ردود tracking (الأسطر 202-204) وfiles (247-249) وnew_request (268-272) والترحيب الإنجليزي (290) في shared/orderSupport.ts؛ تعليمات server/publicAssistant.ts (الأسطر 38-39 وقاعدة الأسئلة الخاصة بالحساب).
- شاشة الترحيب: نصوص client/src/components/BrandWelcome.tsx (الأسطر 46-111: المقدمة والملاحظة الختامية والميزتان 2 و3). تُضاف دالة welcomeCopy إلى client/src/lib/phoneTrackingCopy.ts، مربوطة بوضع الإنتاج.
- رسالة التأكيد: صيغة received في client/src/components/RequestReceivedConfirmation.tsx. تطمئن العميل بأن فريق الدعم سيتواصل معه قريبًا، مع 3 خطوات تقدم. أنماطها .request-confirm* في client/src/index.css.
