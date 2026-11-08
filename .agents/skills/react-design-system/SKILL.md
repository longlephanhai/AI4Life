---
name: react-design-system
description: >-
  Use this skill when choosing colors, typography, spacing, radii, shadows or
  dark mode for a React + Tailwind UI, or when the UI "looks generic/ugly" and
  needs a coherent visual system. Provides a token file (Tailwind v4 @theme)
  and rules for hierarchy, layout rhythm and contrast.
---

# React Design System

Beauty comes from **consistency + restraint**, not decoration. Every visual
decision must map to a token defined in [tokens.css](./resources/tokens.css).

## 1. Tokens first

- Copy [tokens.css](./resources/tokens.css) into `src/index.css` (the scaffold does this).
- Change the brand by editing only `--primary*` and `--accent*` (OKLCH). Don't add
  ad-hoc colors in components.
- Semantic names only: `background, foreground, card, muted, primary, accent,
  destructive, success, warning, border, ring`. Never `bg-blue-500` in feature code.
- Dark mode: tokens are redefined under `.dark`; components never use `dark:` for colors.

## 2. Typography scale

| Role | Class | Notes |
| :-- | :-- | :-- |
| Display | `font-display text-4xl md:text-5xl font-bold tracking-tight` | max once per screen |
| H1 | `font-display text-3xl font-semibold tracking-tight` | |
| H2 | `text-xl font-semibold` | section titles |
| Body | `text-base leading-relaxed` | 16px min; kiosk → `text-lg` |
| Meta | `text-sm text-muted-foreground` | timestamps, helper text |
| Label | `text-xs font-medium uppercase tracking-wider text-muted-foreground` | sparingly |

Use `tabular-nums` for numbers that update (counters, queue numbers, %).
Max line length for prose: `max-w-prose`.

## 3. Spacing & layout rhythm

- 4px base scale. Allowed gaps: `gap-2 / 3 / 4 / 6 / 8 / 12`.
- Inside a card: `p-6`, between cards: `gap-6`, between sections: `py-12 md:py-16`.
- Group related items tightly, separate groups widely (proximity > borders).
- Prefer whitespace or a subtle background shift over adding borders/dividers.
- Layout primitives: `flex` for 1D, `grid` for 2D; container `mx-auto max-w-7xl px-4 md:px-8`.

## 4. Surfaces, radius, elevation

- Radius: one scale from `--radius` (`rounded-md` controls, `rounded-xl` cards, `rounded-full` pills/avatars).
- Elevation levels: flat (`border`) → raised (`shadow-sm`) → floating (`shadow-lg`, dialogs/popovers). No more than 3.
- Cards: `bg-card border border-border/60 shadow-sm rounded-xl`.
- Glass effect only on overlays above imagery/video: `bg-background/70 backdrop-blur-md`.

## 5. Color usage rules

- 60/30/10: neutral surfaces / secondary text & borders / primary accent.
- Only **one** primary CTA per view; others are `secondary`, `outline` or `ghost`.
- Status colors (destructive/success/warning) only communicate status, never decoration.
- Text contrast ≥ 4.5:1 (body) and ≥ 3:1 (large text/icons). Check muted text on muted backgrounds.
- Gradients: subtle and tonal (same hue, ±lightness). Avoid purple→blue "AI" gradients.

## 6. Anti-patterns (reject on sight)

- Everything centered; identical 3-card feature grid; emoji as icons.
- More than 2 font families or more than 4 font weights.
- Gray text on colored backgrounds; borders + shadows + background on the same element.
- Random icon sizes – use `size-4` inline, `size-5` buttons, `size-6` feature icons.

