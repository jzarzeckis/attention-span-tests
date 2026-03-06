## Codebase Patterns
- Use `@/components/ui/*` for shadcn components (path alias `@/*` -> `./src/*`)
- CSS: `styles/globals.css` has shadcn theme vars, `src/index.css` imports it and adds app-level styles
- Navigation uses React state with a `Screen` discriminated union type in `src/types.ts`
- Test list defined as `TEST_LIST` const array in `src/types.ts`
- Screens live in `src/screens/` directory
- `build.ts` has pre-existing typecheck errors (not from our code) — ignore them
- Build output goes to `dist/`, deployed to Vercel as static site
- `vercel.json` has SPA rewrite rule for client-side routing
- Test components live in `src/tests/`, export `onComplete` with typed result interface
- TestScreen dispatches to test components via `test.id` match
- sessionStorage key pattern: `{testId}-result` (e.g., `sart-result`)

## 2026-03-06 - US-001
- Implemented mobile-first app shell with Landing, Test, and Results screens
- Added screen navigation via React state (discriminated union pattern)
- Added progress indicator (shadcn Progress + "Test X of 6" text) on test screens
- Cleaned up template code (removed Bun logo, API tester references from main flow)
- Files changed: `src/App.tsx`, `src/index.html`, `src/index.css`, `src/types.ts`, `src/screens/LandingScreen.tsx`, `src/screens/TestScreen.tsx`, `src/screens/ResultsScreen.tsx`, `src/components/ui/progress.tsx` (added via shadcn)
- **Learnings for future iterations:**
  - The project was scaffolded from a Bun + React template with shadcn already configured
  - `src/APITester.tsx`, `src/logo.svg`, `src/react.svg` are template leftovers (still in repo, just not imported by App.tsx)
  - TestScreen currently shows placeholders — each test story (US-002 through US-007) needs to replace these with real test implementations
  - Results screens (US-008, US-009) will read from sessionStorage
---

## 2026-03-06 - US-002
- Implemented SART (Sustained Attention to Response Task) with full Robertson et al. 1997 protocol
- SARTTest component in `src/tests/SARTTest.tsx` with instruction, practice, ready, running, and done phases
- 225 trials (25 cycles × 9 digits), ~1150ms per trial, target digit = 3
- 9-trial practice round with feedback before full test
- Records: commission errors, omission errors, mean RT, RT coefficient of variation
- Results stored in sessionStorage as `sart-result` key
- TestScreen updated to render SARTTest when `test.id === "sart"`, other tests still show placeholders
- Files changed: `src/tests/SARTTest.tsx` (new), `src/screens/TestScreen.tsx`
- **Learnings for future iterations:**
  - Test components live in `src/tests/` directory, export an `onComplete` callback with typed results
  - TestScreen dispatches to test components via `test.id` switch, each test handles its own phases internally
  - sessionStorage key pattern: `{testId}-result` (e.g., `sart-result`)
  - Use `!` non-null assertions for array indexing where bounds are already checked by earlier guards
---

## 2026-03-06 - US-003
- Implemented Focus Duration Test that measures how long users sustain attention on a slowly revealing text passage
- FocusDurationTest component in `src/tests/FocusDurationTest.tsx` with instruction, running, urged, and done phases
- Text reveals word-by-word at ~280ms interval (~214 wpm reading pace), 8 paragraphs of ocean-themed content
- "I want to skip" button (destructive variant) sticky at bottom during reading
- Timer hidden during test, shown only after user presses skip (avoids anchoring)
- After skip urge: user chooses "I'll keep going" or "Stop here" — both paths record results
- Records: timeToFirstSkipUrge (ms), continuedAfterUrge (bool), totalTimeFocused (ms)
- Results stored in sessionStorage as `focus-result` key
- Files changed: `src/tests/FocusDurationTest.tsx` (new), `src/screens/TestScreen.tsx`
- **Learnings for future iterations:**
  - React fiber traversal trick: use `__reactContainer` key (not `__reactFiber`) on root element to access fiber tree for testing
  - The FocusDurationTest saves to sessionStorage both in the component AND in TestScreen's handler — could deduplicate in future, but both work
  - `data-testid` attributes on key buttons make Playwright testing much easier
---
