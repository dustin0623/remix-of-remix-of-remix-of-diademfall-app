# Heroes filter: modal instead of inline controls

## What changes

On the Heroes page, the search box, "All rarities" dropdown and "Strongest" dropdown in the
header are replaced by one **Filters** button (same gold button the Marketplace uses, showing a
count of active filters). Clicking it opens the same wooden filter window used by the
Marketplace, with the shared corner close button.

Inside the window:

- **Sort by** and **Hero** side by side on one row (Hero is a name search box, Sort by is a
  dropdown) — matching the Marketplace layout.
- **Rarity** as picture chips: All, Common, Uncommon, Rare, Epic, Legendary, each with its
  rarity emblem.
- **Clear All** and **Apply Filters** at the bottom. Edits are drafts until Apply, so browsing
  the collection isn't disturbed by half-chosen filters.

The same change lands in Test UI's mock Heroes panel so it keeps mirroring the real page. The
in-game Heroes drawer keeps its compact inline controls (it is a narrow side panel).

## Technical details

- Extract the filter window's styling out of `src/styles/marketplace.css` into a new shared
  stylesheet `src/styles/filter-modal.css` with `fm-` prefixed classes (modal frame, title,
  sections, chip row, selects, action buttons). `src/styles/hud.css` gets the shared 9-slice
  wooden frame rule retargeted to `.fm-modal`, and the window body scrolls internally at
  `max-height: calc(100dvh - 96px)` so long filter lists never run off a phone screen while the
  corner close button stays visible.
- `src/components/game/MarketplaceContent.tsx` switches its filter window to those shared
  classes (no visual change — one source of truth for the design).
- `src/components/game/HeroFilters.tsx` gains `HeroFiltersDialog` (trigger button + dialog,
  draft/apply state) alongside the existing inline `HeroFilters`, plus an
  `activeFilterCount(filters)` helper.
- `src/routes/heroes.tsx` and the mock Heroes panel in `src/routes/test-ui.tsx` render
  `HeroFiltersDialog` instead of the inline controls; the "No heroes match these filters"
  empty state keeps its Clear filters button.
- Verify in the preview browser: button opens the window, rarity chip + sort + search apply and
  filter the grid, Clear All resets, corner X closes it, and the header divider/panel layout is
  untouched at 1403×895 and 390×844.
