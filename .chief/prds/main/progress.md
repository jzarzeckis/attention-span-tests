## 2026-03-06 - US-011
- What was implemented: Session Progress Persistence. On app load, `hasAnyProgress()` checks sessionStorage for any stored test results. If found, LandingScreen shows "Continue where you left off" and "Start over" buttons instead of "Start Test". `getResumeIndex()` finds the first test without saved results to resume from (or goes to results if all are done). Starting over calls `sessionStorage.removeItem` for each test ID.
- Files changed: src/App.tsx (updated — added getResumeIndex, hasAnyProgress, handleContinue, handleRestart clears storage), src/screens/LandingScreen.tsx (updated — added hasProgress, onContinue, onStartOver props)
- **Learnings for future iterations:**
  - Tests already saved results to sessionStorage by test ID (sart, focus, stroop, pvt, delay, gonogo) — no changes needed to individual test components
  - `handleRestart` in App.tsx already called `setScreen({ type: "landing" })` but didn't clear sessionStorage — add the clear loop there
  - `prd.json` may have `"inProgress": true` set by the orchestrator — always remove it when marking `passes: true`
---

## 2026-03-06 - US-009
- What was implemented: Detailed Scientific Results. Each test gets a Collapsible card (expand/collapse via ChevronDown/Up icon). Expanded content shows: deviation status badge, your exact metrics, baseline norm text. Inner "Learn more" Collapsible shows what the test measures, why it matters, and a study citation with DOI link (opens in new tab). Created `src/components/ui/collapsible.tsx` wrapping `@radix-ui/react-collapsible`. All data from sessionStorage, no network calls.
- Files changed: src/components/ui/collapsible.tsx (new), src/screens/ResultsScreen.tsx (updated — added TestDetail.learnMore field, TestDetailCard component, replaced simple card list)
- **Learnings for future iterations:**
  - `@radix-ui/react-collapsible` is already installed as a transitive dep — create `src/components/ui/collapsible.tsx` as a thin re-export wrapper (Root → Collapsible, CollapsibleTrigger, CollapsibleContent)
  - `prd.json` may have both `"passes": false` AND `"inProgress": true` — remove `inProgress` entirely when marking passes: true
  - Nested Collapsibles work fine (outer per-test, inner "learn more") — just use separate `useState` for each open state
  - Use `CollapsibleTrigger asChild` with `<CardHeader>` for clickable headers; use `asChild` with `<Button>` for trigger buttons
---

## 2026-03-06 - US-008
- What was implemented: Brain Age Results Score screen. Reads all 6 test results from sessionStorage and calculates a composite 0-100 score. Each test is scored individually (SART: commission rate; Focus: first-skip-urge time; Stroop: interference score; PVT: median RT + lapse rate; Delay: log-scale k parameter; GoNoGo: commission rate) then averaged. Score drives: animated progress gauge (requestAnimationFrame ease-out), Badge variant (green/yellow/red), label, and playful summary. "See detailed results" toggle shows per-test Cards with Progress bars, metric strings, and baseline references.
- Files changed: src/screens/ResultsScreen.tsx (full rewrite)
- **Learnings for future iterations:**
  - Animated number via `requestAnimationFrame` + `useRef` for start timestamp + ease-out-quad formula; clean up with `cancelAnimationFrame` in useEffect return
  - Badge color-coding: "default" (primary = green-tinted), "secondary" (muted = yellow-ish), "destructive" (red) — map score tiers to these variants
  - scoreLinear handles both "lower is better" and "higher is better" by checking which threshold is larger
  - For delay discounting k parameter, use log-scale scoring (`Math.log10(k)`) since k spans orders of magnitude
  - The "See detailed results" toggle is just `useState` bool for US-008; US-009 will replace with full accordion
  - `prd.json` may have `"inProgress": true` — remove it when setting `passes: true`
---

## Codebase Patterns
- `vercel.json` has SPA rewrite rule for client-side routing
- `@/*` aliases map to `./src/*` (see tsconfig.json paths)
- shadcn components live in `src/components/ui/`, `src/lib/utils.ts` has the `cn` helper
- Screen state managed in `App.tsx` using the `Screen` union type from `src/types.ts`
- build.ts has pre-existing TS errors (not from our code); typecheck passes for src/

## 2026-03-06 - US-007
- What was implemented: Go/No-Go Task with 100 trials (80 Go/green + 20 No-Go/red). Stimulus visible 500ms, ISI 1000ms. On stimulus timeout without tap, omission recorded for Go trials. On tap during No-Go stimulus, commission error recorded. Records commissionErrors, commissionErrorRate, omissionErrors, omissionErrorRate, meanRT (from Go hits only), rtCV (SD/mean), saved to sessionStorage as "gonogo". TestScreen now routes "gonogo" to GoNoGoTest. Fixed TS error from all TEST_LIST IDs being handled (else branch becomes `never`) by casting `test` in the PlaceholderTest fallback.
- Files changed: src/screens/tests/GoNoGoTest.tsx (new), src/screens/TestScreen.tsx (updated)
- **Learnings for future iterations:**
  - When all TEST_LIST ids are handled in if-chains, TypeScript narrows `test` to `never` in the else branch — cast with `(test as { name: string } | undefined)?.name` to keep the PlaceholderTest fallback compiling
  - For timer-based stimulus with user response: clear `stimulusTimerRef` on tap (before recording) and set `stimulusVisibleRef.current = false` to prevent the timeout callback from also firing and double-counting
  - `runNextTrial` is self-referential but called only via setTimeout — to avoid stale closure, exclude from deps with eslint-disable comment (same pattern as PVT)
  - meanRT should only include Go-hit reaction times, not commission-error taps on No-Go stimuli
---

## 2026-03-06 - US-006
- What was implemented: Delay Discounting Task with adaptive bisection staircase. Tests 5 delays (1, 7, 30, 180, 365 days) × 5 rounds each = 25 total binary choices. For each delay, bisects the immediate reward amount ($1-$99 vs $100 delayed) to find the indifference point. Calculates k per delay via hyperbolic model (k = (A/V - 1) / D), reports medianK across all delays. Results saved to sessionStorage as "delay". TestScreen now routes "delay" to DelayDiscountingTest.
- Files changed: src/screens/tests/DelayDiscountingTest.tsx (new), src/screens/TestScreen.tsx (updated)
- **Learnings for future iterations:**
  - Bisection staircase doesn't need timers or refs — it's purely user-driven, so useState is sufficient (no stale closure risk)
  - Immediately after each choice, lo/hi/round/delayIndex all update synchronously via setState; track cross-boundary state (last indifference point) via local variables before calling setters
  - Card components as `<button>` wrappers work well for large tappable choices; use `hover:bg-accent` and `hover:border-primary` for visual feedback
  - prd.json may have `"inProgress": true` added by the orchestrator; when updating passes, remove that field too
---

## 2026-03-06 - US-005
- What was implemented: Psychomotor Vigilance Task (PVT) with 30 trials. A red circle appears at random ISI (2-10s); user taps it as fast as possible. Records medianRT, meanRT, lapses (RT>500ms), falseStarts, saved to sessionStorage as "pvt". The stimulus shows a live elapsed-ms counter while visible. False starts flash "Too early!" feedback. TestScreen now routes "pvt" to PVTTest.
- Files changed: src/screens/tests/PVTTest.tsx (new), src/screens/TestScreen.tsx (updated)
- **Learnings for future iterations:**
  - For waiting→active→next-trial flow, keep `stimulusVisibleRef` in sync with `setStimulusVisible()` — tap handler reads the ref, not state
  - `scheduleNextStimulus` and `finishTrial` are interdependent; avoid circular deps by putting scheduleNextStimulus call inside finishTrial body (not in its deps array) with `// eslint-disable-line`
  - Live elapsed counter: use `setInterval` with `performance.now() - stimulusStartRef.current`; clear in finishTrial and in the cleanup effect
  - prd.json may have `"inProgress": true` added by the orchestrator — edit just that line, don't rewrite the whole file
---

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
