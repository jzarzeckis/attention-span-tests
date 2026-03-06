## Codebase Patterns
- `vercel.json` has SPA rewrite rule for client-side routing
- `@/*` aliases map to `./src/*` (see tsconfig.json paths)
- shadcn components live in `src/components/ui/`, `src/lib/utils.ts` has the `cn` helper
- Screen state managed in `App.tsx` using the `Screen` union type from `src/types.ts`
- build.ts has pre-existing TS errors (not from our code); typecheck passes for src/

## 2026-03-06 - US-004
- What was implemented: Stroop Color-Word Test with 3 conditions: (1) word reading in black ink, (2) color naming (rectangles), (3) incongruent Stroop. Each condition has 20 trials; 3-trial practice with feedback before condition 3. Records accuracy + meanRT per condition and interferenceScore (C3 meanRT - C2 meanRT) saved to sessionStorage as "stroop". TestScreen now routes "stroop" to StroopTest.
- Files changed: src/screens/tests/StroopTest.tsx (new), src/screens/TestScreen.tsx (updated)
- **Learnings for future iterations:**
  - Color buttons using shadcn `<Button>` with custom `className` (e.g. `bg-red-500 hover:bg-red-600 text-white`) — tailwind-merge in `cn()` correctly overrides the default variant bg classes
  - For user-input-driven trials (vs timer-driven like SART), stale closure risk is lower since there's no recursive setTimeout; only one short feedback-delay timer
  - `inkColor: null` = black ink (condition 1), `inkColor: Color` = colored ink (condition 3); `word: null` = show rectangle (condition 2)
  - Capture `isLast = nextIdx >= stimuli.length` as a local variable before setTimeout to avoid stale `stimuli.length` in callback
---

## 2026-03-06 - US-003
- What was implemented: Focus Duration Test with a slowly-revealing 18-sentence passage (one sentence every 5s). User can press "I want to skip" at any time; they're then prompted to continue or stop. Timer hidden during test, shown only on completion screen. Results (firstSkipUrgeTime, choseToStop, totalTime) saved to sessionStorage as "focus". TestScreen now routes to FocusDurationTest for the "focus" test ID.
- Files changed: src/screens/tests/FocusDurationTest.tsx (new), src/screens/TestScreen.tsx (updated)
- **Learnings for future iterations:**
  - For interval-based reveals with pause/resume, track revealed count in both state and a ref (ref for callbacks, state for render)
  - `setInterval` stored in `useRef<ReturnType<typeof setInterval> | undefined>(undefined)` — clear and restart for pause/resume logic
  - Keep `phaseRef` in sync with `setPhase()` for all state transitions accessed in callbacks
  - The "I want to skip" button only appears if not fully revealed; once fully revealed, show "I finished reading" instead
---

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
