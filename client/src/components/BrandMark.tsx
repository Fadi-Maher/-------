import { APP_BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  isEnglish = false,
  decorative = true,
}: {
  className?: string;
  isEnglish?: boolean;
  decorative?: boolean;
}) {
  return (
    <img
      src={APP_BRAND.icon192}
      srcSet={`${APP_BRAND.icon192} 1x, ${APP_BRAND.icon512} 2x`}
      width={192}
      height={192}
      alt={
        decorative
          ? ""
          : isEnglish
            ? "Maalamati Care app icon"
            : "أيقونة تطبيق معاملاتي كير"
      }
      aria-hidden={decorative || undefined}
      className={cn("h-11 w-11 shrink-0 rounded-2xl object-contain", className)}
      draggable={false}
    />
  );
}
