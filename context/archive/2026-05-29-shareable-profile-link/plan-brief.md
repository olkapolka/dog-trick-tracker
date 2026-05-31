# Shareable Profile Link Enhancement — Plan Brief

> Full plan: [context/changes/shareable-profile-link/plan.md](context/changes/shareable-profile-link/plan.md)  
> Research: [context/changes/shareable-profile-link/research.md](context/changes/shareable-profile-link/research.md)

## What & Why

Enhance the existing profile link sharing feature (FR-005) by adding QR code generation and email sharing options. Currently users can only copy their profile link via a single button. This plan adds a modal with three sharing methods — copy to clipboard, display QR code for scanning, and email via mailto: link — giving users multiple convenient ways to share their dog's profile with friends and family.

## Starting Point

The copy-to-clipboard functionality already exists in [ProfileDisplay.astro:158-187](src/components/profile/ProfileDisplay.astro#L158-L187). It uses native `navigator.clipboard.writeText()` and provides visual feedback by changing button text for 2 seconds. The button appears only when viewing your own profile (`isOwnProfile={true}`). The codebase has no modal implementation, no QR library, but has `lucide-react` icons and `sonner` toast notifications available.

## Desired End State

Users visiting their own profile see a "Share Profile" button. Clicking it opens an accessible modal presenting three sharing options with clear icons: Copy Link (with toast confirmation), Show QR Code (for scanning), and Email (opens mailto: link). The modal dismisses via ESC, click-outside, or X button. All actions provide immediate feedback through toast notifications. The implementation follows React 19 patterns with exact dependency versioning per project policy.

## Key Decisions Made

| Decision             | Choice                       | Why (1 sentence)                                                                                                | Source   |
| -------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------- | -------- |
| UI pattern           | Modal with all options       | Discoverable, shows all three methods at once, follows standard share UX patterns                               | Plan     |
| QR library           | qrcode.react 4.1.0           | React-native API, 2.5M weekly downloads, exact version matches project policy                                   | Plan     |
| Email mechanism      | mailto: link                 | Zero backend complexity, works everywhere, user controls recipients                                             | Plan     |
| QR download          | Scan only, no download       | Simpler UI, QR is primarily for mobile scanning use case                                                        | Plan     |
| Modal close behavior | ESC / click-outside / X      | Standard modal UX, matches user expectations                                                                    | Plan     |
| User feedback        | Sonner toast notifications   | Non-disruptive, library already configured, better UX than button text change                                   | Plan     |
| Modal library        | @radix-ui/react-dialog 1.1.4 | Fits with existing @radix-ui/react-slot, battle-tested accessibility (ARIA, focus trap), matches shadcn pattern | Plan     |
| Scope                | Copy/QR/Email only           | Complete focused scope, can add social sharing later if needed                                                  | Plan     |
| URL format           | /user/username (client-side) | Already implemented and working, follows REST conventions                                                       | Research |

## Scope

**In scope:**

- Install `@radix-ui/react-dialog` and `qrcode.react` with exact versions
- Create ShareModal React component with three sharing methods
- Replace existing copy button with modal trigger
- Implement copy-to-clipboard with toast feedback
- Display QR code encoding profile URL
- Email sharing via mailto: link
- Accessible modal (keyboard nav, focus trap, ARIA attributes)
- Mobile and desktop responsive design

**Out of scope:**

- Social share buttons (Twitter, Facebook, WhatsApp)
- Share analytics or tracking
- QR code download functionality
- Web Share API integration
- Custom email form with backend
- Server-side URL construction changes

## Architecture / Approach

Build a new `ShareModal.tsx` React component using Radix UI Dialog primitives for accessibility. The modal contains three sections with lucide-react icons: Copy (triggers clipboard API + toast), QR (renders with qrcode.react), Email (mailto: link). Import into ProfileDisplay.astro with `client:load` directive, replacing the existing copy button at lines 158-187. Remove old clipboard script. Modal receives `profileUrl` and `username` props, constructs email subject/body, and handles all user interaction client-side.

## Phases at a Glance

| Phase           | What it delivers                                                  | Key risk                                           |
| --------------- | ----------------------------------------------------------------- | -------------------------------------------------- |
| 1. Dependencies | qrcode.react and @radix-ui/react-dialog added with exact versions | Version conflicts (mitigated by exact pinning)     |
| 2. ShareModal   | Complete modal component with Copy/QR/Email                       | Accessibility gaps (mitigated by Radix primitives) |
| 3. Integration  | Modal replaces existing button in ProfileDisplay                  | Breaking current copy functionality during swap    |
| 4. Polish       | Accessibility audit, responsive design, cross-browser testing     | Mobile layout issues or keyboard nav gaps          |

**Prerequisites:** Node 22+ (per AGENTS.md), clean npm install, dev server running  
**Estimated effort:** ~2-3 focused sessions across 4 incremental phases

## Open Risks & Assumptions

- **Clipboard API requires HTTPS** in production - dev (localhost) works without it, but production deployment on Cloudflare Workers should have TLS enabled
- **QR scanning success** depends on code size and contrast - testing with actual phone cameras is critical
- **mailto: link behavior** varies by OS/browser - some users may not have email clients configured
- **Mobile touch targets** in modal must meet 44px minimum for accessibility - verify on real devices
- **Radix Dialog focus trap** should work out-of-box but needs keyboard-only testing to confirm

## Success Criteria (Summary)

- User can open share modal from their own profile page
- All three sharing methods work: Copy (with toast), QR (scannable), Email (opens pre-filled)
- Modal is fully keyboard accessible (Tab navigation, ESC to close)
- Works on mobile and desktop viewports without layout issues
- No regressions to existing profile display functionality
