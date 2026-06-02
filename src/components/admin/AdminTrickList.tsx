import { useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import type { Tables } from "@/lib/database.types";
import TrickFormModal from "@/components/admin/TrickFormModal";

type Trick = Tables<"tricks">;

interface AdminTrickListProps {
  initialTricks: Trick[];
}

interface ListResponse {
  tricks: Trick[];
}

const fetcher = async (url: string): Promise<ListResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch trick list");
  }
  return response.json() as Promise<ListResponse>;
};

function difficultyBadgeClass(difficulty: Trick["difficulty"]) {
  switch (difficulty) {
    case "beginner":
      return "bg-emerald-400/20 text-emerald-200 border-emerald-300/40";
    case "intermediate":
      return "bg-amber-400/20 text-amber-100 border-amber-300/40";
    case "advanced":
      return "bg-rose-400/20 text-rose-100 border-rose-300/40";
    default:
      return "bg-white/10 text-white border-white/20";
  }
}

async function postWithId(endpoint: string, id: string): Promise<void> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "Request failed");
  }
}

export default function AdminTrickList({ initialTricks }: AdminTrickListProps) {
  const { data, mutate, isLoading } = useSWR("/api/admin/tricks/list", fetcher, {
    fallbackData: { tricks: initialTricks },
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editingTrick, setEditingTrick] = useState<Trick | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const tricks = useMemo(() => data.tricks, [data]);

  const handleRefresh = async () => {
    await mutate();
  };

  const handleDelete = (trick: Trick) => {
    toast.warning(`Delete ${trick.name}?`, {
      description: "The trick will be soft-deleted and hidden from users.",
      action: {
        label: "Confirm",
        onClick: () => {
          void (async () => {
            setPendingActionId(trick.id);
            try {
              await postWithId("/api/admin/tricks/delete", trick.id);
              toast.success("Trick marked as deleted.");
              await handleRefresh();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Delete failed");
            } finally {
              setPendingActionId(null);
            }
          })();
        },
      },
    });
  };

  const handleRestore = async (trick: Trick) => {
    setPendingActionId(trick.id);
    try {
      await postWithId("/api/admin/tricks/restore", trick.id);
      toast.success("Trick restored.");
      await handleRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Restore failed");
    } finally {
      setPendingActionId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-blue-100/70">Manage trick catalog entries and soft-delete state.</p>
        <button
          type="button"
          onClick={() => {
            setCreateOpen(true);
          }}
          className="rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:from-purple-600 hover:to-blue-600"
        >
          Create Trick
        </button>
      </div>

      <div className="space-y-3 md:hidden">
        {tricks.map((trick) => {
          const isDeleted = trick.deleted_at !== null;
          const busy = pendingActionId === trick.id;

          return (
            <article key={trick.id} className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-white">{trick.name}</h3>
                  <p className="mt-1 text-sm break-all text-blue-100/80">/{trick.slug}</p>
                </div>
                <span
                  className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold uppercase ${difficultyBadgeClass(trick.difficulty)}`}
                >
                  {trick.difficulty}
                </span>
              </div>

              <div className="mt-3">
                <span
                  className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${
                    isDeleted
                      ? "border-red-300/40 bg-red-400/20 text-red-100"
                      : "border-emerald-300/40 bg-emerald-400/20 text-emerald-100"
                  }`}
                >
                  {isDeleted ? "Deleted" : "Active"}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingTrick(trick);
                  }}
                  className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/10"
                  disabled={busy}
                >
                  Edit
                </button>
                {isDeleted ? (
                  <button
                    type="button"
                    onClick={() => {
                      void handleRestore(trick);
                    }}
                    className="rounded-md border border-emerald-300/40 bg-emerald-400/20 px-3 py-1.5 text-xs font-medium text-emerald-100 transition-colors hover:bg-emerald-400/30"
                    disabled={busy}
                  >
                    Restore
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      handleDelete(trick);
                    }}
                    className="rounded-md border border-red-300/40 bg-red-400/20 px-3 py-1.5 text-xs font-medium text-red-100 transition-colors hover:bg-red-400/30"
                    disabled={busy}
                  >
                    Delete
                  </button>
                )}
              </div>
            </article>
          );
        })}

        {!isLoading && tricks.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-center text-blue-100/70 backdrop-blur-md">
            No tricks found.
          </div>
        ) : null}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur-md md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-white/5 text-blue-100/80">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Slug</th>
                <th className="px-4 py-3 font-semibold">Difficulty</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tricks.map((trick) => {
                const isDeleted = trick.deleted_at !== null;
                const busy = pendingActionId === trick.id;

                return (
                  <tr key={trick.id} className="border-t border-white/10 text-white/90">
                    <td className="px-4 py-3 font-medium">{trick.name}</td>
                    <td className="px-4 py-3 text-blue-100/80">{trick.slug}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold uppercase ${difficultyBadgeClass(trick.difficulty)}`}
                      >
                        {trick.difficulty}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${
                          isDeleted
                            ? "border-red-300/40 bg-red-400/20 text-red-100"
                            : "border-emerald-300/40 bg-emerald-400/20 text-emerald-100"
                        }`}
                      >
                        {isDeleted ? "Deleted" : "Active"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTrick(trick);
                          }}
                          className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/10"
                          disabled={busy}
                        >
                          Edit
                        </button>
                        {isDeleted ? (
                          <button
                            type="button"
                            onClick={() => {
                              void handleRestore(trick);
                            }}
                            className="rounded-md border border-emerald-300/40 bg-emerald-400/20 px-3 py-1.5 text-xs font-medium text-emerald-100 transition-colors hover:bg-emerald-400/30"
                            disabled={busy}
                          >
                            Restore
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              handleDelete(trick);
                            }}
                            className="rounded-md border border-red-300/40 bg-red-400/20 px-3 py-1.5 text-xs font-medium text-red-100 transition-colors hover:bg-red-400/30"
                            disabled={busy}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && tricks.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-blue-100/70" colSpan={5}>
                    No tricks found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <TrickFormModal
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={async () => {
          await handleRefresh();
        }}
      />

      <TrickFormModal
        key={editingTrick?.id ?? "edit-none"}
        mode="edit"
        trick={editingTrick ?? undefined}
        open={editingTrick !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setEditingTrick(null);
          }
        }}
        onSuccess={async () => {
          await handleRefresh();
          setEditingTrick(null);
        }}
      />
    </div>
  );
}
