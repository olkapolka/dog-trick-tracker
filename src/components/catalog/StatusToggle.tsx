import { useState } from "react";
import { Star, Clock, Check } from "lucide-react";
import useSWRMutation from "swr/mutation";
import { toast } from "sonner";
import type { Enums } from "@/lib/database.types";

interface Props {
  trickId: string;
  initialStatus: Enums<"trick_status"> | null;
}

async function updateStatus(
  url: string,
  { arg }: { arg: { trickId: string; status: Enums<"trick_status"> } },
): Promise<{ success: boolean }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || "Failed to update status");
  }
  return res.json() as Promise<{ success: boolean }>;
}

export default function StatusToggle({ trickId, initialStatus }: Props) {
  const [optimisticStatus, setOptimisticStatus] = useState<Enums<"trick_status"> | null>(initialStatus);

  const { trigger, isMutating} = useSWRMutation("/api/tricks/status", updateStatus);

  async function handleStatusClick(newStatus: Enums<"trick_status">) {
    // Optimistic update
    const previousStatus = optimisticStatus;
    setOptimisticStatus(newStatus);

    try {
      await trigger({ trickId, status: newStatus });
    } catch (err) {
      // Rollback on error
      setOptimisticStatus(previousStatus);
      const errorMessage = err instanceof Error ? err.message : "Network error - please try again";
      toast.error(`Failed to update status: ${errorMessage}`);
    }
  }

  const buttonClass = (status: Enums<"trick_status">) => {
    const isActive = optimisticStatus === status;
    const baseClass = "flex h-11 w-11 items-center justify-center rounded-lg border transition-all disabled:opacity-50";
    if (isActive) {
      return `${baseClass} border-purple-400 bg-purple-400/20 text-purple-300`;
    }
    return `${baseClass} border-white/10 bg-white/5 text-blue-100/60 hover:border-white/20 hover:bg-white/10 hover:text-white`;
  };

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => {
          void handleStatusClick("favorite");
        }}
        disabled={isMutating}
        className={buttonClass("favorite")}
        aria-label="Mark as favorite"
        title="Favorite"
      >
        <Star className={`size-5 ${optimisticStatus === "favorite" ? "fill-current" : ""}`} />
      </button>
      <button
        type="button"
        onClick={() => {
          void handleStatusClick("in-progress");
        }}
        disabled={isMutating}
        className={buttonClass("in-progress")}
        aria-label="Mark as in progress"
        title="In Progress"
      >
        <Clock className="size-5" />
      </button>
      <button
        type="button"
        onClick={() => {
          void handleStatusClick("finished");
        }}
        disabled={isMutating}
        className={buttonClass("finished")}
        aria-label="Mark as finished"
        title="Finished"
      >
        <Check className={`size-5 ${optimisticStatus === "finished" ? "stroke-[3]" : ""}`} />
      </button>
    </div>
  );
}
