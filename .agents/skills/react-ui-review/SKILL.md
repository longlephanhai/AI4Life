---
name: react-ui-review
description: >-
  Use this skill after building or changing a React UI, or when the user asks
  to review/critique/improve how a page looks. Runs a visual QA loop: start the
  dev server, screenshot at multiple viewports with the chrome-devtools MCP,
  score against a rubric, fix, and repeat.
---

# React UI Review Loop

Never declare a UI "done" without looking at it.

## 1. Run it

1. `npm run build` → must pass with no TS errors/warnings.
2. Start the dev server as a background daemon: `npm run dev -- --port 5173`.

## 2. Capture (chrome-devtools MCP)

For each key route:
1. `new_page` / `navigate_page` → `http://localhost:5173/<route>`.
2. `resize_page` to **375×812**, **768×1024**, **1440×900**; `take_screenshot` at each.
3. `list_console_messages` → zero errors and zero React key/hydration warnings.
4. Interact with the primary flow (`click`, `fill`, `press_key` Tab) and screenshot hover/focus/loading/empty/error states.
5. Optional: `lighthouse_audit` (accessibility ≥ 95).

## 3. Score (1–5 each, fix anything < 4)

| Criterion | What "5" looks like |
| :-- | :-- |
| Hierarchy | One obvious focal point and primary action per screen; clear H1 → section → detail. |
| Alignment & rhythm | Everything sits on a grid; consistent gaps from the spacing scale. |
| Typography | ≤ 2 families, consistent scale, comfortable line length, no orphans in headings. |
| Color | Tokens only, 60/30/10, status colors only for status, contrast passes. |
| States | Loading, empty, error, disabled, hover, focus all designed. |
| Responsiveness | No horizontal scroll at 375px; touch targets ≥ 44px; layout adapts, not just shrinks. |
| Motion | Purposeful, < 400ms, no jank, reduced-motion respected. |
| Craft | No overflow/clipping, icons aligned to text baseline, consistent radii & shadows. |

## 4. Report

Give the user: screenshots (embed in an artifact), scores table, and the list of
fixes applied. Iterate until all criteria ≥ 4.

