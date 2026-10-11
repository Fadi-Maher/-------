import { Clock3 } from "lucide-react";

export function formatRemainingTime(deadline: Date | string | null | undefined, nowMs: number, isEnglish: boolean) {
  if (!deadline) return isEnglish ? "No deadline" : "دون مهلة";
  const remaining = new Date(deadline).getTime() - nowMs;
  if (remaining <= 0) return isEnglish ? "Deadline ended" : "انتهت المهلة";
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.max(0, Math.floor((remaining % 3_600_000) / 60_000));
  return hours ? `${hours}${isEnglish ? "h" : " س"} ${minutes}${isEnglish ? "m" : " د"}` : `${minutes} ${isEnglish ? "minutes" : "دقيقة"}`;
}

export function deadlineTone(deadline: Date | string | null | undefined, nowMs: number) {
  if (!deadline) return "border-[#dce8f6] bg-[#f5f8fb] text-[#60778f]";
  const remaining = new Date(deadline).getTime() - nowMs;
  if (remaining <= 0) return "border-[#e1e6eb] bg-[#f4f5f6] text-[#66727e]";
  if (remaining <= 30 * 60_000) return "border-[#ffc6cc] bg-[#fff0f2] text-[#bd2638]";
  if (remaining <= 2 * 60 * 60_000) return "border-[#f4d492] bg-[#fff8e8] text-[#916000]";
  return "border-[#bfe7c5] bg-[#f0fbf1] text-[#28743a]";
}

export function DeadlineIndicator({ deadline, nowMs, label, isEnglish, compact = false }: { deadline: Date | string | null | undefined; nowMs: number; label?: string; isEnglish: boolean; compact?: boolean }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full border font-extrabold ${compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"} ${deadlineTone(deadline, nowMs)}`}><Clock3 className="h-3.5 w-3.5" />{label ? `${label}: ` : ""}{formatRemainingTime(deadline, nowMs, isEnglish)}</span>;
}
