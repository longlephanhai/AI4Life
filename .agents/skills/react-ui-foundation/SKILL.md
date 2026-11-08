---
name: react-ui-foundation
description: >-
  Use this skill when creating a new React frontend or adding React UI to an
  existing project. Defines the standard stack (Vite + React + TypeScript +
  Tailwind CSS v4 + shadcn/ui + lucide-react + motion), folder structure, and a
  scaffold script. Activate before writing the first React component in a project.
---

# React UI Foundation

The baseline every React UI in this workspace starts from. Pair with:
- `react-design-system` → tokens, colors, typography
- `react-component-patterns` → how to write components
- `react-motion-polish` → states, animation, micro-interactions
- `react-ui-review` → visual QA before declaring done
- `frontend-design` → product-specific visual direction (SignBridge AI)

## 1. Stack (do not deviate without reason)

| Concern | Choice |
| :-- | :-- |
| Build | Vite + React 19 + TypeScript (strict) |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` (CSS-first `@theme`, no `tailwind.config.js`) |
| Primitives | shadcn/ui (Radix-based, code copied into `src/components/ui`) |
| Variants | `class-variance-authority` + `clsx` + `tailwind-merge` (`cn()` helper) |
| Icons | `lucide-react` (one icon set only) |
| Motion | `motion` (`import { motion } from "motion/react"`) |
| Data fetching | `@tanstack/react-query` when calling an API |
| Fonts | `@fontsource-variable/*` (self-hosted, no Google Fonts CDN) |

## 2. Scaffold

Run [scaffold.sh](./scripts/scaffold.sh) with the target directory:

```bash
bash .agents/skills/react-ui-foundation/scripts/scaffold.sh frontend
```

It creates the Vite app, installs the stack, wires Tailwind, the `@/` alias,
the `cn()` helper and copies the design tokens from
`react-design-system/resources/tokens.css` into `src/index.css`.
Then run `npx shadcn@latest init` (choose "Neutral", CSS variables = yes) and
add primitives as needed: `npx shadcn@latest add button card dialog input badge`.

**Verify:** `npm run build` passes with zero TS errors and `npm run dev` renders.

## 3. Folder structure

```text
src/
├── app/                # App shell, routes, providers (QueryClient, Theme)
├── components/
│   ├── ui/             # shadcn primitives – edit freely, they are ours
│   └── <domain>/       # Feature components (e.g. kiosk/, doctor/)
├── hooks/              # useXxx hooks, one per file
├── lib/                # cn(), api client, formatters
├── styles/             # extra CSS if needed (keep minimal)
└── index.css           # Tailwind import + @theme tokens
```

## 4. Hard rules

- No inline `style={{}}` except for truly dynamic values (e.g. progress width).
- No hard-coded hex colors in JSX – only token classes (`bg-primary`, `text-muted-foreground`).
- No arbitrary spacing like `mt-[13px]`; stay on the 4px scale.
- One component per file, named export, file name = `kebab-case.tsx`.
- Every interactive element must be keyboard reachable and have a visible focus ring.
- Backend calls go through `src/lib/api.ts`; base URL from `import.meta.env.VITE_API_URL`.

