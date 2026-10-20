import { APP_BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { useState } from "react";

const OPTIMIZED_SRCSET = `${APP_BRAND.icon128Webp} 128w, ${APP_BRAND.icon192Webp} 192w, ${APP_BRAND.icon512} 512w`;
const ORIGINAL_SRCSET = `${APP_BRAND.icon192} 1x, ${APP_BRAND.icon512} 2x`;

export function BrandMark({
  className,
  isEnglish = false,
  decorative = true,
  sizes = "48px",
}: {
  className?: string;
  isEnglish?: boolean;
  decorative?: boolean;
  /** Rendered CSS width so the browser can pick the lightest sharp file. */
  sizes?: string;
}) {
  // If the lightweight copy cannot load, fall back to the original PNG icons.
  const [useOriginal, setUseOriginal] = useState(false);
  return (
    <img
      src={useOriginal ? APP_BRAND.icon192 : APP_BRAND.icon192Webp}
      srcSet={useOriginal ? ORIGINAL_SRCSET : OPTIMIZED_SRCSET}
      sizes={useOriginal ? undefined : sizes}
      width={192}
      height={192}
      decoding="async"
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
      onError={() => setUseOriginal(true)}
    />
  );
}
