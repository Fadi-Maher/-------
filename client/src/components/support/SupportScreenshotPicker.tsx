import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SUPPORT_IMAGE_MAX_BYTES,
  SUPPORT_IMAGE_TYPES,
} from "@shared/supportSharing";
export type SelectedSupportImage = { id: string; file: File };
export function SupportScreenshotPicker({
  isEnglish: en,
  value,
  onChange,
  disabled,
}: {
  isEnglish: boolean;
  value: SelectedSupportImage | null;
  onChange: (value: SelectedSupportImage | null) => void;
  disabled: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const t = (ar: string, english: string) => (en ? english : ar);
  useEffect(() => {
    if (!value) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(value.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="rounded-2xl border border-border bg-background/50 p-4"
    >
      <h3 id={`${id}-heading`} className="text-xs font-bold">
        {t(
          "أوضح المشكلة بلقطة شاشة (اختياري)",
          "Explain the issue with a screenshot (optional)"
        )}
      </h3>
      <input
        ref={input}
        id={`${id}-file`}
        className="sr-only"
        type="file"
        accept={SUPPORT_IMAGE_TYPES.join(",")}
        disabled={disabled}
        aria-label={t("اختيار صورة المشكلة", "Choose an issue screenshot")}
        onChange={event => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          if (
            !(SUPPORT_IMAGE_TYPES as readonly string[]).includes(file.type) ||
            file.size === 0 ||
            file.size > SUPPORT_IMAGE_MAX_BYTES
          ) {
            setError(
              t(
                "اختر PNG أو JPEG أو WebP حتى3MB.",
                "Choose a PNG, JPEG or WebP image up to3MB."
              )
            );
            return;
          }
          setError("");
          onChange({ id: crypto.randomUUID(), file });
        }}
      />
      {value ? (
        <div className="mt-3 rounded-xl border border-border bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-[11px] font-semibold">
              {value.file.name}
            </p>
            <button
              type="button"
              disabled={disabled}
              aria-label={t("إزالة الصورة", "Remove screenshot")}
              onClick={() => {
                setError("");
                onChange(null);
              }}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {preview ? (
            <img
              src={preview}
              alt={t(
                "معاينة محلية للصورة قبل إرسالها",
                "Local screenshot preview before sending"
              )}
              className="mx-auto max-h-40 max-w-full rounded-lg object-contain"
            />
          ) : null}
          <p className="mt-2 text-[10px] text-muted-foreground">
            {t(
              "لم تُرفع بعد؛ تُرسل فقط عند تأكيد التصعيد.",
              "Not uploaded yet; sent only when you confirm escalation."
            )}
          </p>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => input.current?.click()}
          className="mt-3 h-11 gap-2 rounded-xl"
        >
          <ImagePlus className="h-4 w-4" />
          {t("إرفاق صورة أو لقطة شاشة", "Attach an image or screenshot")}
        </Button>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-xs leading-6 text-destructive">
          {error}
        </p>
      ) : null}
      <p className="mt-3 flex gap-2 text-[10px] leading-6 text-muted-foreground">
        <ShieldCheck className="mt-1 h-3 w-3 shrink-0" />
        {t(
          "أخفِ الهوية والجوال والأرقام السرية من الصورة بنفسك. حجب النص لا ينقّح الصور. بعد الموافقة نزيل بياناتها الوصفية ونشفّرها، ولا نرسلها إلى ذكاء اصطناعي.",
          "Hide IDs, mobile numbers and secret codes yourself. Text redaction does not redact images. After consent we remove metadata and encrypt the image; it is not sent to AI."
        )}
      </p>
    </section>
  );
}
export function readSupportImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? "").split(",")[1];
      value ? resolve(value) : reject(new Error("تعذر قراءة الصورة."));
    };
    reader.onerror = () =>
      reject(new Error("تعذر قراءة الصورة؛ أعد اختيارها أو تابع دونها."));
    reader.readAsDataURL(file);
  });
}
