# خلاصة متطلبات WhatsApp OTP

## مصادر Meta الرسمية التي تمت مراجعتها

- https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates/authentication-templates
- https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview

## النتائج الأساسية

تتطلب رسائل التحقق عبر WhatsApp استخدام Authentication Template، وليس رسالة نصية عادية. يتكون القالب من نص ثابت يتضمن رمز التحقق، ويمكن أن يتضمن تنبيهًا أمنيًا ومدة صلاحية، مع خيارات مثل النسخ أو الملء التلقائي وفق نوع القالب. توضح Meta أيضًا أن رسائل Authentication أصبحت مرتبطة بأمان الجهاز الأساسي، وتُسلّم للمستخدم على جهاز WhatsApp الأساسي.

قوالب WhatsApp هي أصول مرتبطة بحساب WhatsApp Business، ولا يمكن إرسالها خارج نافذة خدمة العملاء إلا كقوالب. يجب إنشاء القالب واعتماده من WhatsApp Manager أو Message Templates API، ثم استخدام اسم القالب واللغة ومكونات القالب عند الإرسال عبر Cloud API. القالب المطلوب لمعاملاتي يجب أن يصنف Authentication وأن يكون له إصدار عربي معتمد، مع نسخة إنجليزية عند الحاجة.

## متطلبات التنفيذ في معاملاتي

يحتاج الربط إلى WhatsApp Business Account، وPhone Number ID، وWhatsApp Business Account ID، ورمز وصول طويل الأجل أو آلية وصول مؤسسية، إضافة إلى اسم قالب Authentication معتمد. يجب حفظ هذه القيم في الخادم فقط، وعدم وضع رمز الوصول في المتصفح. قبل التفعيل النهائي يجب اختبار الأرقام الفعلية والتأكد من موافقة القالب وسياسة الحساب.

## رسالة عربية مقترحة للقالب

رمز التحقق الخاص بك لتسجيل الدخول إلى معاملاتي هو {{1}}. لا تشارك هذا الرمز مع أي شخص. تنتهي صلاحيته خلال 5 دقائق.

هذه صياغة مقترحة للتقديم في WhatsApp Manager وليست ضمانًا لقبول القالب؛ الاعتماد النهائي يتم من Meta.
