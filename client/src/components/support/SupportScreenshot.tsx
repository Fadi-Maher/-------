import { useState } from "react";
import { ImageIcon, Loader2, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
export function SupportScreenshot({
  id,
  token,
  owner = false,
  isEnglish = false,
}: {
  id: string;
  token?: string;
  owner?: boolean;
  isEnglish?: boolean;
}) {
  return owner ? (
    <OwnerScreenshot id={id} isEnglish={isEnglish} />
  ) : token ? (
    <CustomerScreenshot id={id} token={token} isEnglish={isEnglish} />
  ) : null;
}
function OwnerScreenshot({
  id,
  isEnglish,
}: {
  id: string;
  isEnglish: boolean;
}) {
  const query = trpc.orderSupport.admin.image.useQuery(
    { id },
    { retry: false, staleTime: 5 * 60_000 }
  );
  return (
    <ImageFrame
      isEnglish={isEnglish}
      data={query.data}
      loading={query.isLoading}
      error={query.isError}
      retry={() => void query.refetch()}
    />
  );
}
function CustomerScreenshot({
  id,
  token,
  isEnglish,
}: {
  id: string;
  token: string;
  isEnglish: boolean;
}) {
  const query = trpc.orderSupport.image.useQuery(
    { id, token },
    { retry: false, staleTime: 5 * 60_000 }
  );
  return (
    <ImageFrame
      isEnglish={isEnglish}
      data={query.data}
      loading={query.isLoading}
      error={query.isError}
      retry={() => void query.refetch()}
    />
  );
}
function ImageFrame({
  isEnglish: en,
  data,
  loading,
  error,
  retry,
}: {
  isEnglish: boolean;
  data?: { mimeType: string; dataBase64: string };
  loading: boolean;
  error: boolean;
  retry: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const t = (ar: string, english: string) => (en ? english : ar);
  const src = data ? `data:${data.mimeType};base64,${data.dataBase64}` : "";
  return (
    <figure className="support-screenshot mx-auto max-w-lg rounded-2xl border border-border bg-background/50 p-3">
      <figcaption className="mb-3 flex items-center gap-2 text-xs font-bold">
        <ImageIcon className="h-4 w-4 text-primary" />
        {t(
          "لقطة المشكلة المرفقة مع التصعيد",
          "Issue screenshot attached to escalation"
        )}
      </figcaption>
      {loading ? (
        <p
          role="status"
          className="flex items-center gap-2 p-4 text-xs text-muted-foreground"
        >
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
          {t("تحميل الصورة المحمية…", "Loading protected image…")}
        </p>
      ) : error || !data ? (
        <div role="alert" className="text-xs text-destructive">
          <p>
            {t(
              "تعذر تحميل الصورة، أو انتهت صلاحيتها.",
              "Could not load the image, or access has expired."
            )}
          </p>
          <button
            type="button"
            onClick={retry}
            className="mt-2 inline-flex min-h-10 items-center gap-1 underline"
          >
            <RefreshCw className="h-3 w-3" />
            {t("إعادة المحاولة", "Retry")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label={t("تكبير لقطة المشكلة", "Enlarge issue screenshot")}
          className="block w-full rounded-xl border border-border bg-white p-2 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <img
            src={src}
            alt={t(
              "الصورة التي أرفقها العميل لشرح المشكلة",
              "Customer screenshot describing the issue"
            )}
            className="mx-auto max-h-44 max-w-full object-contain"
          />
          <span className="mt-2 block text-[10px] text-primary">
            {t(
              "اضغط للتكبير · وصول محمي",
              "Click to enlarge · protected access"
            )}
          </span>
        </button>
      )}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent dir={en ? "ltr" : "rtl"} className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("لقطة المشكلة", "Issue screenshot")}</DialogTitle>
          </DialogHeader>
          <img
            src={src}
            alt={t("لقطة المشكلة بالحجم الأكبر", "Enlarged issue screenshot")}
            className="mx-auto max-h-[70dvh] max-w-full object-contain"
          />
        </DialogContent>
      </Dialog>
    </figure>
  );
}
