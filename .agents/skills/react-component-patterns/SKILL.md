---
name: react-component-patterns
description: >-
  Use this skill when writing or refactoring React components (buttons, cards,
  forms, dialogs, lists, dashboards, layouts). Defines component API conventions,
  variants with cva, composition patterns, accessibility requirements and
  reference implementations to copy from.
---

# React Component Patterns

## 1. Component API conventions

- Function components, named exports, props typed with `interface XxxProps`.
- Extend native props: `React.ComponentProps<"button">` so `className`, `aria-*`, events pass through.
- Always merge classes last: `className={cn(base, variants, className)}`.
- Visual variants via `cva` (`variant`, `size`), never via boolean soup (`isBig`, `isRed`).
- `asChild` (Radix `Slot`) when a component must render as a link/other element.
- Keep components presentational; data fetching lives in hooks (`useQueue()`), passed in as props.
- Max ~150 lines per file. Split into sub-components when exceeded.

Reference: [button.tsx](./examples/button.tsx) (cva + asChild + loading state).

## 2. Composition over configuration

Prefer compound components to giant prop lists:

```tsx
<StatCard>
  <StatCard.Label>Ca đang chờ</StatCard.Label>
  <StatCard.Value>12</StatCard.Value>
  <StatCard.Trend direction="up">+3 so với hôm qua</StatCard.Trend>
</StatCard>
```

Reference: [stat-card.tsx](./examples/stat-card.tsx).

## 3. Every data view handles 4 states

`loading` → skeleton matching final layout · `empty` → icon + one sentence + CTA ·
`error` → message + retry button · `success`. Never ship only the happy path.
Reference: [async-list.tsx](./examples/async-list.tsx).

## 4. Forms

- Label above input, helper/error text below (`text-sm`, error in `text-destructive`).
- Use `react-hook-form` + `zod` for anything over 2 fields.
- Submit button shows loading state and is disabled while pending; never clear the form on error.
- Inputs `h-10` (desktop) / `h-12` (touch/kiosk), full width in single-column forms.

## 5. Accessibility (non-negotiable)

- Use semantic elements (`button`, `nav`, `main`, `ul/li`, `table`) before ARIA.
- Icon-only buttons need `aria-label`; decorative icons get `aria-hidden`.
- Dialogs/menus/popovers: use shadcn/Radix primitives (focus trap, Esc, return focus).
- Touch targets ≥ 44×44px; color is never the only signal (add icon/text).
- Live updating regions (queue, transcription result) use `aria-live="polite"`.

## 6. Layout recipes

- **App shell:** sticky header (`h-16 border-b bg-background/80 backdrop-blur`) + sidebar (`w-64`, collapsible) + `main` scroll area.
- **Dashboard:** KPI row `grid gap-6 sm:grid-cols-2 lg:grid-cols-4`, then content `grid gap-6 lg:grid-cols-3` (2/3 main + 1/3 side).
- **Split workspace (kiosk):** `grid lg:grid-cols-[1.2fr_1fr] gap-6 h-[calc(100dvh-4rem)]`.
- Responsive: design mobile first, verify at 375 / 768 / 1280 px.

