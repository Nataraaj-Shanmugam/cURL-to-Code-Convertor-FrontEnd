# CurlCraft Assured — Design Review TODO

All items from `DESIGN_REVIEW.md` have been implemented.

## Completed

### Phase 1 — Design System Fixes
- Error colors use `bg-destructive/10 text-destructive` tokens
- Badge colors use `bg-accent`/`text-destructive` tokens
- NavBar active indicator uses `translate-y` (no magic numbers)
- Theme toggle has Sun/Moon rotate+scale CSS transition

### Phase 2 — Framer Motion & Animations
- `framer-motion` installed
- Page route transitions via `AnimatePresence` in `App.tsx`
- Scroll-triggered reveals (`FadeInSection`) on Home sections
- Parse button loading spinner (`Loader2` + `animate-spin`)
- Copy-to-clipboard slide animation in CodeGenerationDialog

### Phase 3 — Layout & Composition
- Asymmetric hero with terminal preview on right + gradient mesh blob
- "How It Works" horizontal stepper with connecting lines + arrows
- Editor accordion sections have colored left borders + icons

### Phase 4 — Atmosphere & Polish
- Noise texture overlay (`.bg-noise`) on hero
- Gradient mesh blob behind hero
- Feature card hover: `scale-[1.02]` + border color shift

### Prior Work
- Custom typography (DM Sans + JetBrains Mono)
- Dark mode refinement (deeper blacks, better contrast)
- Playground terminal-style textarea with macOS chrome
- Background grid pattern on all pages
- Mobile hamburger menu, branded footer
- Editor toolbar grouped with dividers
- Example cURL commands as empty state
