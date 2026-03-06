## Codebase Patterns
- `vercel.json` has SPA rewrite rule for client-side routing
- `@/*` aliases map to `./src/*` (see tsconfig.json paths)
- shadcn components live in `src/components/ui/`, `src/lib/utils.ts` has the `cn` helper
- Screen state managed in `App.tsx` using the `Screen` union type from `src/types.ts`
- build.ts has pre-existing TS errors (not from our code); typecheck passes for src/

## 2026-03-06 - US-002
- What was implemented: Full SART test with instruction screen, 9-trial practice round (with per-trial correct/error feedback via Badge), 225-trial main test (25 shuffled cycles of digits 1-9, 250ms stimulus / 900ms ISI = 1150ms SOA), and results saved to sessionStorage (commissionErrors, omissionErrors, meanRT, rtCV). TestScreen now routes to SARTTest for the "sart" test ID; all other tests remain placeholders.
- Files changed: src/screens/tests/SARTTest.tsx (new), src/screens/TestScreen.tsx (updated)
- **Learnings for future iterations:**
  - Use `useRef` for all mutable trial state accessed inside `setTimeout` callbacks to avoid stale closures
  - Store the recursive trial runner as `runTrialRef.current = (idx) => {...}` — reassigning on every render means setTimeout callbacks always get the latest function
  - `useRef<T | undefined>(undefined)` is required instead of `useRef<T>()` to satisfy TypeScript (useRef requires an initial value argument)
  - `activeTimers.current.forEach((t) => clearTimeout(t))` — must use arrow wrapper, not `forEach(clearTimeout)` directly (TS arity mismatch)
  - Shuffle with explicit `const temp = a[i] as T` instead of destructuring swap to avoid TS generic inference errors
  - `seq[idx] as number` is safe after `idx < seq.length` guard but TypeScript won't infer it
---

## 2026-03-06 - US-001
- What was implemented: App shell with Landing, Test, and Results screens; shadcn Button, Card, Progress, Badge components; navigation state via Screen union type; mobile-first layout
- Files changed: src/App.tsx, src/lib/utils.ts, src/components/ui/{button,card,progress,badge}.tsx, src/screens/{LandingScreen,TestScreen,ResultsScreen}.tsx
- **Learnings for future iterations:**
  - build.ts has pre-existing TypeScript errors — ignore when checking src/ files
  - Progress component uses `@radix-ui/react-progress` (already in package.json)
  - types.ts already had TEST_LIST and Screen type — use them
---
