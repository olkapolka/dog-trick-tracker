export const PROTECTED_ROUTES = [
  "/dashboard",
  "/profile",
  "/friends",
  "/admin",
  "/api/profile",
  "/api/admin",
  "/api/tricks",
  "/api/follow",
  "/api/unfollow",
];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
}

export function isProfileCreationFlow(pathname: string): boolean {
  return (
    pathname.startsWith("/profile/create") ||
    pathname.startsWith("/api/profile/create") ||
    pathname.startsWith("/api/profile/check-username")
  );
}

export function shouldRedirectToSignIn(pathname: string, hasUser: boolean): boolean {
  return isProtectedPath(pathname) && !hasUser;
}

export function shouldRedirectToProfileCreate(pathname: string, hasUser: boolean, profileExists: boolean): boolean {
  return isProtectedPath(pathname) && hasUser && !isProfileCreationFlow(pathname) && !profileExists;
}

export function resolveSignInRedirect(profileExists: boolean, returnTo: string | null): string {
  if (!profileExists) {
    return "/profile/create";
  }

  return returnTo ?? "/dashboard";
}
