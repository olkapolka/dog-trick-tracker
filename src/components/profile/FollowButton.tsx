import { useState } from "react";
import { toast } from "sonner";

interface FollowButtonProps {
  followingId: string;
  initialIsFollowing: boolean;
  isAuthenticated: boolean;
  currentPath: string;
}

export function FollowButton({ followingId, initialIsFollowing, isAuthenticated, currentPath }: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (!isAuthenticated) {
      window.location.href = `/auth/signin?returnTo=${encodeURIComponent(currentPath)}`;
      return;
    }

    // Optimistic update
    const previousState = isFollowing;
    setIsFollowing(!isFollowing);
    setIsLoading(true);

    try {
      const endpoint = isFollowing ? "/api/unfollow" : "/api/follow";
      const method = isFollowing ? "DELETE" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ followingId }),
      });

      if (!response.ok) {
        // Rollback on error
        setIsFollowing(previousState);
        const errorData = (await response.json()) as { error?: string };
        toast.error(errorData.error ?? "Something went wrong");
        return;
      }

      // Show success toast
      if (!previousState) {
        toast.success("Now following!");
      } else {
        toast.success("Unfollowed");
      }
    } catch (_error) {
      // Rollback on network error
      setIsFollowing(previousState);
      toast.error("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`group w-full rounded-lg px-4 py-2 text-center text-sm font-medium transition-colors disabled:opacity-50 ${
        isFollowing
          ? "border-2 border-white/40 bg-transparent text-blue-100 hover:border-white/60 hover:text-purple-300"
          : "bg-purple-500 text-white hover:bg-purple-600"
      }`}
    >
      {isLoading ? (
        "..."
      ) : isFollowing ? (
        <span>
          <span className="group-hover:hidden">Following</span>
          <span className="hidden group-hover:inline">Unfollow</span>
        </span>
      ) : (
        "Follow"
      )}
    </button>
  );
}
