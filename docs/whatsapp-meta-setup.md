# إعداد رسائل واتساب لستريك إكسبريس

يعتمد التكامل على **WhatsApp Business Cloud API من Meta**. ترسل الرسائل من الخادم فقط عبر `POST /{PHONE_NUMBER_ID}/messages` باستخدام رمز وصول مخصص للحساب. يحتاج العميل إلى الموافقة الصريحة على استلام الرسائل قبل الإرسال، وتُلزم Meta باستخدام **قالب معتمد** للرسائل التي تُرسل خارج نافذة خدمة العملاء البالغة 24 ساعة.

## قالب رسالة مقترح

أنشئ في WhatsApp Manager قالبًا من فئة **Utility** بالاسم `streak_request_update` واللغة `ar` بالنص الآتي:

> أهلًا {{1}}، تم تحديث طلبك لدى ستريك إكسبريس.
> رقم الطلب: {{2}}
> الحالة: {{3}}
> متابعة الطلب: {{4}}

يمكن للتكامل إرسال رابط المرفق في رسالة إضافية بعد رسالة القالب. لا يرسل النظام رسالة إلى عميل ما لم يكن قد وافق على استلام إشعارات واتساب.

## بيانات الربط المطلوبة

| المتغير | المصدر |
|---|---|
| `META_WA_ACCESS_TOKEN` | Meta for Developers → System User / WhatsApp API |
| `META_WA_PHONE_NUMBER_ID` | App Dashboard → WhatsApp → API Setup |
| `META_WA_TEMPLATE_NAME` | اسم القالب المعتمد في WhatsApp Manager |
| `META_WA_TEMPLATE_LANGUAGE` | رمز لغة القالب، مثل `ar` |

## مراجع رسمية

- [إرسال رسائل WhatsApp عبر Cloud API](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages)
- [أساسيات قوالب WhatsApp](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview)
- [نظرة عامة على WhatsApp Business Platform](https://developers.facebook.com/documentation/business-messaging/whatsapp/about-the-platform)
