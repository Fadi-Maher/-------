import { cn } from "@/lib/utils";
import { Bot } from "lucide-react";
import { useEffect, useState } from "react";

// The original portrait is copied unchanged into this project's managed storage.
export const ASSISTANT_AVATAR_URL =
  "/manus-storage/maalamati-assistant-avatar-original_dac6bf34.webp";

type AssistantAvatarProps = {
  src?: string;
  className?: string;
};

export function AssistantAvatar({
  src = ASSISTANT_AVATAR_URL,
  className,
}: AssistantAvatarProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed) {
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

  return (
    <img
      src={src}
      alt=""
      draggable={false}
      data-testid="assistant-avatar-image"
      className={cn("h-full w-full object-cover", className)}
      onError={() => setFailed(true)}
    />
  );
}
