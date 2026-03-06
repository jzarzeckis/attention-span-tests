## Codebase Patterns
- Use `@/components/ui/*` for shadcn components (path alias `@/*` -> `./src/*`)
- CSS: `styles/globals.css` has shadcn theme vars, `src/index.css` imports it and adds app-level styles
- Navigation uses React state with a `Screen` discriminated union type in `src/types.ts`
- Test list defined as `TEST_LIST` const array in `src/types.ts`
- Screens live in `src/screens/` directory
- `build.ts` has pre-existing typecheck errors (not from our code) — ignore them
- Build output goes to `dist/`, deployed to Vercel as static site
- `vercel.json` has SPA rewrite rule for client-side routing

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
