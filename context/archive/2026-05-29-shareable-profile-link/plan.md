# Shareable Profile Link Enhancement Implementation Plan

## Overview

Enhance the existing profile link sharing feature by adding QR code generation and email sharing options. Replace the current single "Copy profile link" button with a share modal that presents three sharing methods: copy to clipboard, display QR code for scanning, and email sharing via mailto: link. This provides users with multiple convenient ways to share their dog's profile with friends and family.

**Scope Note**: PRD FR-005 ("User can generate and copy their own profile link") is already fully implemented via copy-to-clipboard button in ProfileDisplay (research.md Option A confirmed). This plan intentionally enhances beyond the must-have to improve sharing UX with QR and email options — adding value while roadmap permits polish on a core social feature before moving to follow relationships (S-04).

## Current State Analysis

**Existing Implementation:**

- Copy-to-clipboard button exists in [ProfileDisplay.astro:158-187](src/components/profile/ProfileDisplay.astro#L158-L187)
- Uses native `navigator.clipboard.writeText()` API
- Constructs URL as `${window.location.origin}/user/${loginName}`
- Visual feedback via button text change ("✓ Link copied!" for 2 seconds)
- Only visible when `isOwnProfile={true}`
- Button positioned at bottom of profile card

**Technology Stack:**

- React 19.2.6 with TypeScript 5.9.3
- Astro 6.3.1 with SSR
- Exact version pinning (no ^ or ~ prefixes)
- `lucide-react` 1.14.0 available for icons
- `sonner` 2.0.7 configured for toast notifications
- `@radix-ui/react-slot` 1.1.2 present (shadcn/ui pattern)
- No modal/dialog library installed
- No QR code library installed

**Component Patterns:**

- React components use `client:load` directive in .astro files
- Props via TypeScript interfaces, default exports
- Local state with `useState`, no Context used
- Button component available at [src/components/ui/button.tsx](src/components/ui/button.tsx)

### Key Discoveries:

- No existing modal implementation anywhere in codebase
- ProfileDisplay already uses `isOwnProfile` prop pattern effectively
- Toast system (sonner) available but not currently used for clipboard feedback
- Exact version pinning is a project rule (from [lessons.md](context/foundation/lessons.md))

## Desired End State

Users visiting their own profile see a "Share Profile" button that opens an accessible modal with three sharing options clearly presented:

1. **Copy Link** - Copies `{origin}/user/{username}` to clipboard with toast confirmation
2. **Show QR Code** - Displays QR code encoding the profile URL for scanning
3. **Email** - Opens user's email client with pre-filled message containing profile link

The modal is dismissible via click-outside, ESC key, or X button. All actions provide immediate feedback through toast notifications. The implementation follows established React component patterns and accessibility best practices.

## What We're NOT Doing

- Social share buttons (Twitter, Facebook, WhatsApp) - can be added later if needed
- Share analytics or tracking - privacy-focused, no backend tracking
- QR code download functionality - QR is for scanning only per user decision
- Web Share API integration - keeping implementation simple with mailto: links
- Custom email form with backend - avoiding email service complexity
- Server-side URL construction - client-side generation with `window.location.origin` works well

## Implementation Approach

Build a new React component (`ShareModal.tsx`) using Radix UI Dialog primitives for accessibility. Install two new dependencies (`@radix-ui/react-dialog`, `qrcode.react`) with exact versions. The modal replaces the existing copy button and handles all three sharing methods. Use sonner toast for feedback instead of button text changes. Maintain the `isOwnProfile` conditional rendering pattern.

## Phase 1: Add Dependencies

### Overview

Install the QR code library and Radix Dialog primitives with exact versions per project convention.

### Changes Required:

#### 1. Package Dependencies

**File**: `package.json`

**Intent**: Add `qrcode.react` for QR generation and `@radix-ui/react-dialog` for accessible modal primitives. Use exact versioning (no ^ or ~) to match project policy from lessons.md. **Update**: qrcode.react@4.2.0 required for React 19 compatibility (4.1.0 only supports React ≤18).

**Contract**: Add to `dependencies` object:

```json
"@radix-ui/react-dialog": "1.1.4",
"qrcode.react": "4.2.0"
```

### Success Criteria:

#### Automated Verification:

- Dependencies install cleanly: `npm install`
- No version conflicts in package-lock.json
- Type checking passes: `npm run typecheck`

#### Manual Verification:

- Verify exact versions appear in package.json (no ^ or ~ prefixes)
- Check package-lock.json shows expected resolved versions

---

## Phase 2: Create ShareModal Component

### Overview

Build the React modal component with Radix Dialog primitives. Include all three sharing methods (Copy, QR, Email) with proper UI structure, icons, and accessibility attributes.

### Changes Required:

#### 1. ShareModal React Component

**File**: `src/components/profile/ShareModal.tsx`

**Intent**: Create modal component accepting `profileUrl` and `username` props. Use Radix Dialog for overlay, content, close button. Include three action sections with lucide-react icons. Implement copy-to-clipboard, QR rendering with qrcode.react, and mailto: link construction. Show sonner toast on copy/email actions. Wrap clipboard call in try/catch and show error toast on failure.

**Contract**: Component signature:

```typescript
interface ShareModalProps {
  profileUrl: string;
  username: string;
}
export default function ShareModal({ profileUrl, username }: ShareModalProps): JSX.Element;
```

Radix Dialog structure: `Dialog.Root` > `Dialog.Portal` > `Dialog.Overlay` + `Dialog.Content`. Content contains three sections (Copy, QR, Email) with appropriate ARIA labels. Email href format: `mailto:?subject={subject}&body={body}`. Clipboard write: wrap `navigator.clipboard.writeText()` in try/catch, call `toast.error("Failed to copy link")` on failure (matches PhotoUpload error pattern).

**Intent**: Use Tailwind classes matching existing profile card styling (cosmic background, glass-morphism, purple/blue gradients). Modal content should center on screen with dark overlay.

**Contract**: Overlay: `fixed inset-0 bg-black/50 backdrop-blur-sm`. Content: `fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-cosmic p-8 max-w-md w-full`. Interactive elements (Copy button, Email button, close X): minimum h-11 (44px) for WCAG 2.1 Level AAA touch target compliance (guideline 2.5.5).

#### 2. Export from Component Directory

**File**: `src/components/profile/ShareModal.tsx`

**Intent**: Make ShareModal importable in ProfileDisplay.

**Contract**: Use default export following established pattern (SignInForm, PhotoUpload, CreateProfileForm all use default exports).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Component builds without errors: `npm run build`
- Copy button shows error toast when clipboard API fails or is unavailable

#### Manual Verification:

- Modal renders with proper overlay and centered content
- All three sections (Copy, QR, Email) are visible
- Icons from lucide-react display correctly
- Modal is dismissible via ESC key
- Modal is dismissible via click outside
- Modal is dismissible via X button
- QR code renders and encodes correct URL
- Copy button triggers clipboard write
- Email button opens mailto: link correctly

---

## Phase 3: Integrate into ProfileDisplay

### Overview

Replace the existing "Copy profile link" button implementation with the new ShareModal. Wire up the modal trigger, construct profile URL, and remove old clipboard script.

### Changes Required:

#### 1. Import ShareModal

**File**: `src/components/profile/ProfileDisplay.astro`

**Intent**: Import ShareModal component at top of file.

**Contract**: Add import: `import ShareModal from "./ShareModal";`

#### 2. Replace Button with Modal Trigger

**File**: `src/components/profile/ProfileDisplay.astro`

**Intent**: Replace the existing button conditional block (lines 158-172) and script block (lines 176-195) with ShareModal component using `client:load` directive. Pass `profileUrl` constructed server-side and `login_name` from props.

**Contract**: Replace current button and script with:

```astro
{
  isOwnProfile && (
    <ShareModal
      profileUrl={`${Astro.url.origin}/user/${profile.login_name}`}
      username={profile.login_name}
      client:load
    />
  )
}
```

Note: Server constructs full URL; ShareModal receives and uses the `profileUrl` prop directly (no client-side reconstruction).

#### 3. Remove Old Script Block

**File**: `src/components/profile/ProfileDisplay.astro`

**Intent**: Delete the `<script define:vars={...}>` block (lines 176-195) since clipboard functionality moves into ShareModal.

**Contract**: Remove script block entirely - no longer needed.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- "Share Profile" button appears on own profile page
- Button does NOT appear on other users' profiles
- Clicking button opens modal
- Modal displays all three sharing options
- Copy link works and shows toast
- QR code displays correct URL
- Email link opens with correct content
- Modal closes properly (ESC, click outside, X button)
- No console errors
- Previous "Copy profile link" button is gone

---

## Phase 4: Polish & Accessibility

### Overview

Verify accessibility attributes, keyboard navigation, focus management, and cross-browser compatibility. Test on mobile and desktop viewports.

### Changes Required:

#### 1. Accessibility Audit

**File**: `src/components/profile/ShareModal.tsx`

**Intent**: Verify Radix Dialog provides proper ARIA attributes (`aria-modal`, `aria-labelledby`, `aria-describedby`), focus trap, and focus restoration on close. Ensure all interactive elements are keyboard accessible.

**Contract**: Radix Dialog handles most accessibility automatically - verify with browser dev tools and keyboard-only navigation.

#### 2. Responsive Design Check

**File**: `src/components/profile/ShareModal.tsx`

**Intent**: Ensure modal displays properly on mobile viewports. QR code should scale appropriately. Buttons should be touch-friendly (min 44px tap target).

**Contract**: Test modal at 375px (mobile) and 768px (tablet) widths. Adjust `max-w-md` or padding if content overflows.

### Success Criteria:

#### Automated Verification:

- Linting passes (including a11y rules): `npm run lint`

#### Manual Verification:

- Tab navigation works through all modal elements
- ESC key closes modal
- Focus returns to trigger button on close
- Screen reader announces modal opening (test with VoiceOver/NVDA if available)
- Modal content fits mobile screens (375px width)
- Touch targets are adequately sized on mobile
- Copy/Email actions work on mobile browsers
- QR code scans successfully with phone camera app
- Works in Chrome, Safari, Firefox
- No visual regressions in existing profile display

---

## Testing Strategy

### Unit Tests:

This project has no test suite configured yet (per README.md). Manual testing is the verification path.

### Manual Testing Steps:

1. **Own Profile**:
   - Navigate to `/profile` while logged in
   - Verify "Share Profile" button appears
   - Click button, modal should open
   - Test each sharing method:
     - Copy: Click, verify toast, paste into text editor to confirm URL
     - QR: Scan with phone camera, verify navigates to correct profile
     - Email: Click, verify mailto: opens with subject and body containing profile URL
   - Test modal dismissal:
     - Click outside modal (on overlay) - should close
     - Press ESC key - should close
     - Click X button - should close

2. **Other User's Profile**:
   - Navigate to `/user/[someone-else]` while logged in
   - Verify "Share Profile" button does NOT appear
   - Verify "← Back to Dashboard" link appears instead

3. **Mobile Testing**:
   - Open `/profile` on mobile device (or mobile viewport in dev tools)
   - Modal should be centered and readable
   - Buttons should be touch-friendly
   - Copy and Email should work on mobile browsers
   - QR code should be scannable

4. **Keyboard Navigation**:
   - Tab through modal elements - focus should cycle within modal
   - ESC should close modal
   - Focus should return to trigger button on close

5. **Cross-Browser**:
   - Test in Chrome, Safari, Firefox
   - Verify clipboard API works (https required in production)
   - Verify mailto: links open correctly

### Edge Cases to Test:

- Very long usernames (does URL still construct correctly?)
- Clipboard API failure (older browsers) - should show toast error
- Modal interaction during slow network (QR should still render client-side)
- Rapid open/close (no memory leaks or duplicate renders)

## Performance Considerations

- QR code generation happens client-side, minimal overhead
- Radix Dialog ~15KB gzipped, qrcode.react ~45KB gzipped - acceptable for enhanced sharing UX
- Modal renders only when opened (lazy via React state), not on initial page load
- No network requests for sharing actions (all client-side)

## Migration Notes

No data migration needed. This is a pure UI enhancement. The URL format (`/user/{username}`) remains unchanged, so any previously shared links continue to work.

Existing copy-to-clipboard functionality is replaced but delivers same core capability. Users may notice improved UX (toast feedback, additional sharing options).

## References

- Related research: [context/changes/shareable-profile-link/research.md](context/changes/shareable-profile-link/research.md)
- Current implementation: [src/components/profile/ProfileDisplay.astro:158-187](src/components/profile/ProfileDisplay.astro#L158-L187)
- Button component pattern: [src/components/ui/button.tsx](src/components/ui/button.tsx)
- React component examples: [src/components/auth/SignInForm.tsx](src/components/auth/SignInForm.tsx), [src/components/profile/PhotoUpload.tsx](src/components/profile/PhotoUpload.tsx)
- Exact version policy: [context/foundation/lessons.md](context/foundation/lessons.md)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Add Dependencies

#### Automated

- [x] 1.1 Dependencies install cleanly: `npm install` — 49bb926
- [x] 1.2 No version conflicts in package-lock.json — 49bb926
- [x] 1.3 Type checking passes: `npm run typecheck` — 49bb926

#### Manual

- [x] 1.4 Verify exact versions appear in package.json (no ^ or ~ prefixes) — 4814eb4
- [x] 1.5 Check package-lock.json shows expected resolved versions — 4814eb4

### Phase 2: Create ShareModal Component

#### Automated

- [x] 2.1 Type checking passes: `npm run typecheck` — 190e948
- [x] 2.2 Linting passes: `npm run lint` — 190e948
- [x] 2.3 Component builds without errors: `npm run build` — 190e948

#### Manual

- [x] 2.4 Modal renders with proper overlay and centered content — 190e948
- [x] 2.5 All three sections (Copy, QR, Email) are visible — 190e948
- [x] 2.6 Icons from lucide-react display correctly — 190e948
- [x] 2.7 Modal is dismissible via ESC key — 190e948
- [x] 2.8 Modal is dismissible via click outside — 190e948
- [x] 2.9 Modal is dismissible via X button — 190e948
- [x] 2.10 QR code renders and encodes correct URL — 190e948
- [x] 2.11 Copy button triggers clipboard write — 190e948
- [x] 2.12 Email button opens mailto: link correctly — 190e948

### Phase 3: Integrate into ProfileDisplay

#### Automated

- [x] 3.1 Type checking passes: `npm run typecheck` — 8869c4c
- [x] 3.2 Linting passes: `npm run lint` — 8869c4c
- [x] 3.3 Build succeeds: `npm run build` — 8869c4c

#### Manual

- [x] 3.4 "Share Profile" button appears on own profile page — 8869c4c
- [x] 3.5 Button does NOT appear on other users' profiles — 8869c4c
- [x] 3.6 Clicking button opens modal — 8869c4c
- [x] 3.7 Modal displays all three sharing options — 8869c4c
- [x] 3.8 Copy link works and shows toast — 8869c4c
- [x] 3.9 QR code displays correct URL — 8869c4c
- [x] 3.10 Email link opens with correct content — 8869c4c
- [x] 3.11 Modal closes properly (ESC, click outside, X button) — 8869c4c
- [x] 3.12 No console errors — 8869c4c
- [x] 3.13 Previous "Copy profile link" button is gone — 8869c4c

### Phase 4: Polish & Accessibility

#### Automated

- [x] 4.1 Linting passes (including a11y rules): `npm run lint` — 4814eb4

#### Manual

- [x] 4.2 Tab navigation works through all modal elements — 4814eb4
- [x] 4.3 ESC key closes modal — 4814eb4
- [x] 4.4 Focus returns to trigger button on close — 4814eb4
- [x] 4.5 Screen reader announces modal opening (test with VoiceOver/NVDA if available) — 4814eb4
- [x] 4.6 Modal content fits mobile screens (375px width) — 4814eb4
- [x] 4.7 Touch targets are adequately sized on mobile — 4814eb4
- [x] 4.8 Copy/Email actions work on mobile browsers — 4814eb4
- [x] 4.9 QR code scans successfully with phone camera app — 4814eb4
- [x] 4.10 Works in Chrome, Safari, Firefox — 4814eb4
- [x] 4.11 No visual regressions in existing profile display — 4814eb4
