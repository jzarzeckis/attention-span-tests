## Codebase Patterns
- `vercel.json` has SPA rewrite rule for client-side routing
- `@/*` aliases map to `./src/*` (see tsconfig.json paths)
- shadcn components live in `src/components/ui/`, `src/lib/utils.ts` has the `cn` helper
- Screen state managed in `App.tsx` using the `Screen` union type from `src/types.ts`
- build.ts has pre-existing TS errors (not from our code); typecheck passes for src/

## 2026-03-06 - US-001
- What was implemented: App shell with Landing, Test, and Results screens; shadcn Button, Card, Progress, Badge components; navigation state via Screen union type; mobile-first layout
- Files changed: src/App.tsx, src/lib/utils.ts, src/components/ui/{button,card,progress,badge}.tsx, src/screens/{LandingScreen,TestScreen,ResultsScreen}.tsx
- **Learnings for future iterations:**
  - build.ts has pre-existing TypeScript errors — ignore when checking src/ files
  - Progress component uses `@radix-ui/react-progress` (already in package.json)
  - types.ts already had TEST_LIST and Screen type — use them
---
