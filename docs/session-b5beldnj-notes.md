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
