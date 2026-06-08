export type PageState = "ready" | "empty" | "error";

export function resolveDashboardState(options: {
  profileError: boolean;
  scoreError: boolean;
  catalogError: boolean;
  catalogCount: number;
}): PageState {
  if (options.profileError || options.scoreError || options.catalogError) {
    return "error";
  }

  if (options.catalogCount === 0) {
    return "empty";
  }

  return "ready";
}

export function resolveProfileState(options: {
  profileError: boolean;
  scoreError: boolean;
  userTricksError: boolean;
  trickCount: number;
}): PageState {
  if (options.profileError || options.scoreError || options.userTricksError) {
    return "error";
  }

  if (options.trickCount === 0) {
    return "empty";
  }

  return "ready";
}

export function resolveFriendsState(options: {
  followingError: boolean;
  followersError: boolean;
  profilesError: boolean;
  followingCount: number;
  followersCount: number;
}): PageState {
  if (options.followingError || options.followersError || options.profilesError) {
    return "error";
  }

  if (options.followingCount === 0 && options.followersCount === 0) {
    return "empty";
  }

  return "ready";
}
