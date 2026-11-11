# Game UI/UX review

Reviewed against the running `/test-ui` preview, using production presentation components with mock adapters. The existing art, economy, wallet validation and game simulation are preserved.

## Findings and changes

| Finding | Improvement |
| --- | --- |
| A full-screen rotation dialog blocked every page on portrait phones and tablets. | Portrait users can browse all pages. Only the mine displays a rotation notice; the existing simulation still pauses in portrait. |
| Narrow navigation could hide destinations in a horizontal scroller. | Four category controls remain visible in a fixed dock through 1100px: Play (Play, House), Heroes (Heroes, Shop, Fusion), Market and Leaderboard. Wide landscape phones use a compact header row. The visual mobile label “Ranks” retains the accessible name “Leaderboard”. |
| Navigation, secondary copy and selectors were small or dim. | Brighter navigation labels, larger supporting text, larger selectors, and larger common action controls. Keyboard users have a Skip to content link and visible form focus indicators. |
| Mine and House boards could exceed the available height on landscape phones. | Both boards size from the actual content viewport, preserve their 41:25 ratio and keep their action buttons visible. Deploy and Rest have visible labels. |
| Leaderboard required sideways scrolling on phones. | Mobile rows show heroes and XP beneath the player name, retaining Rank, Player and Score columns. Desktop retains all five columns. Pagination is unchanged. |
| Small dialogs and collection actions were awkward to tap. | Larger filter chips, selectors, close controls and hero actions; narrower filter dialogs leave room for the frame and close button. Bodies retain vertical scrolling. |
| Wallet history link fell into the 65px emblem column on mobile. | The history link spans both overview columns. Profile editing and supporting layouts also wrap on narrow screens. |

## Browser verification

The seven main destinations (Play, Heroes, House, Shop, Fusion, Market, Leaderboard) were checked at 320×568, 390×844, 768×1024, 1024×768, 1440×900, 1920×1080, 667×375 and 844×390. After the board sizing correction, both boards were additionally checked at 360×640, 600×800, 601×800, 767×1024, 768×1024, 900×700, 901×700, 1100×800, 1101×800, 1440×900, 568×320, 640×360, 667×375 and 844×390. Navigation targets stayed in bounds; neither board overflowed or extended below the content row.

Profile, Wallet and History were checked at 320×568, 390×844, 768×1024, 1440×900 and 844×390 without horizontal page overflow. Phone filters, hero action popovers, audio settings and withdrawal review were exercised. The landing page, sign-in dialog and wiki were inspected on a 320px phone preview. No real wallet operation was submitted.

These are browser viewport checks, not physical-device or cross-browser certification. Device safe-area padding, dynamic viewport units and reduced-motion support are retained. Touch devices get 16px form text to avoid automatic form zoom.

## Code checks

- Production build passed.
- TypeScript `tsc --noEmit` passed.
- Full test run: 292 passed, 34 skipped, one failed because `AUTH_CHALLENGE_SECRET` was absent. The affected four-test auth suite passed when rerun with a process-local test-only secret: 293 distinct passing tests overall. No production credentials or configuration were changed.
- Windows sandbox temporary-file rename errors were resolved by using an ignored workspace-local test temporary directory.
- Database-dependent suites remain skipped without their configured database.

Screenshots are in [ui-review](./ui-review/).

## Grouped navigation follow-up

Following the Splinterlands category-menu reference, Play now contains Play and House; Heroes contains Heroes, Shop and Fusion. Market and Leaderboard retain direct navigation. The same header serves authenticated routes and Test UI. Menu items retain their emblem indices, live links or explicit preview callbacks, and unavailable preview destinations remain disabled.

Radix dropdowns provide click/tap, arrow-key selection, Escape dismissal and focus restoration. Mouse hover has a short opening delay and a closing grace period across the gap to the menu. Pointer departure only dismisses menus opened by hover, preserving keyboard and touch operation. The parent category stays highlighted on child pages, and the current child has a check mark.

Both menus were checked at 320×568, 390×844, 768×1024, 1100×800, 1101×800, 1440×900, 667×375 and 844×390. All menus remained inside the viewport; menus opened above the bottom dock and below the desktop/landscape header. All five grouped destinations were exercised, including keyboard selection and Escape. Route checks and TypeScript passed; the production build passed.
