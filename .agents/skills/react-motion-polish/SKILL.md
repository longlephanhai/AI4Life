---
name: react-motion-polish
description: >-
  Use this skill when adding animation, transitions, hover/press feedback,
  skeleton loaders, toasts or page transitions to a React UI, or when a
  working UI needs to "feel premium". Covers the motion library, timing
  tokens, and a polish checklist.
---

# React Motion & Polish

Motion should explain change (where did this come from / go to), not decorate.

## 1. Timing tokens

| Use | Duration | Easing |
| :-- | :-- | :-- |
| Hover, color, focus | 150ms | `ease-out` |
| Press (scale 0.98) | 100ms | `ease-out` |
| Enter (fade + 8px slide) | 200–250ms | `ease-out-expo` / spring |
| Exit | 150ms (faster than enter) | `ease-in` |
| Layout / reorder | spring `{ stiffness: 400, damping: 32 }` | — |

Never animate longer than 400ms in UI flows. Animate only `transform` and `opacity`
(plus `background-color` for hover). Respect `prefers-reduced-motion` (`useReducedMotion()`).

## 2. motion recipes (`import { motion, AnimatePresence } from "motion/react"`)

```tsx
// Enter for cards / list items (stagger via delay: i * 0.04, cap at ~8 items)
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}
  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
/>

// Live list (queue, notifications): new items slide in, others reflow smoothly
<AnimatePresence initial={false}>
  {items.map((it) => (
    <motion.li key={it.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} />
  ))}
</AnimatePresence>

// Animated tab / segmented control indicator
{active && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-md bg-background shadow-sm" />}
```

Number changes (counters, confidence %): animate with `useSpring` + `useTransform`, keep `tabular-nums`.

## 3. Polish checklist (run before calling a screen done)

- [ ] Hover + `active:scale-[0.98]` on every clickable element; cursor-pointer on custom clickables.
- [ ] Visible `focus-visible` ring (keyboard Tab through the whole screen).
- [ ] Skeletons match the final layout dimensions (no layout shift when data arrives).
- [ ] Optimistic UI or instant feedback (< 100ms) on every action; toast for async results (`sonner`).
- [ ] Empty and error states designed, not default text.
- [ ] Long text truncates (`truncate` / `line-clamp-2`) with `title` tooltip; numbers don't jump width.
- [ ] Images/video have fixed aspect ratio (`aspect-video`) and a placeholder background.
- [ ] Scroll containers have `overscroll-contain`; sticky headers have a backdrop blur + border.
- [ ] Destructive actions require confirmation (AlertDialog) and are visually separated.
- [ ] Dark mode checked if enabled.
- [ ] Reduced motion: page still fully usable with animations off.

