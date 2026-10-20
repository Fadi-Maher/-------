import { cn } from "@/lib/utils";
import { Bot } from "lucide-react";
import { useEffect, useState } from "react";

// The original portrait is copied unchanged into this project's managed storage.
export const ASSISTANT_AVATAR_URL =
  "/manus-storage/maalamati-assistant-avatar-original_dac6bf34.webp";
// Downscaled copies of the same portrait for the small round avatar (shown at ~40-56px).
export const ASSISTANT_AVATAR_SMALL_URL = "/manus-storage/maalamati-assistant-avatar-128_e393c492.webp";
export const ASSISTANT_AVATAR_MEDIUM_URL = "/manus-storage/maalamati-assistant-avatar-256_0aa583c7.webp";
const OPTIMIZED_SRCSET = `${ASSISTANT_AVATAR_SMALL_URL} 128w, ${ASSISTANT_AVATAR_MEDIUM_URL} 256w`;

type AssistantAvatarProps = {
  src?: string;
  className?: string;
};

type Stage = "optimized" | "original" | "failed";

export function AssistantAvatar({ src, className }: AssistantAvatarProps) {
  // Custom sources skip the small copies; the default tries the small copies, then the original, then an icon.
  const [stage, setStage] = useState<Stage>(src ? "original" : "optimized");

  useEffect(() => {
    setStage(src ? "original" : "optimized");
  }, [src]);

  if (stage === "failed") {
    return (
      <span
        aria-hidden="true"
        data-testid="assistant-avatar-fallback"
        className={cn(
          "grid h-full w-full place-items-center bg-white text-[#0878f9]",
          className,
        )}
      >
        <Bot className="h-6 w-6" />
      </span>
    );
  }

  const optimized = stage === "optimized";
  return (
    <img
      key={stage}
      src={optimized ? ASSISTANT_AVATAR_MEDIUM_URL : (src ?? ASSISTANT_AVATAR_URL)}
      srcSet={optimized ? OPTIMIZED_SRCSET : undefined}
      sizes={optimized ? "56px" : undefined}
      width={256}
      height={256}
      decoding="async"
      alt=""
      draggable={false}
      data-testid="assistant-avatar-image"
      className={cn("h-full w-full object-cover", className)}
      onError={() => setStage(current => (current === "optimized" ? "original" : "failed"))}
    />
  );
}
