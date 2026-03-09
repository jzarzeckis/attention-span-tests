
Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

**Follow TDD (Test-Driven Development) for new features.** Write tests first, then implement.

Run tests with `bun test`. Tests live in `src/__tests__/` and use:
- `bun:test` for test runner (imports: `test`, `expect`, `describe`, `beforeEach`, `afterEach`, `jest`)
- `@testing-library/react` for component tests (`render`, `screen`, `fireEvent`, `act`, `cleanup`)
- `@testing-library/jest-dom/jest-globals` for DOM matchers (via `src/test-setup.ts` preload)
- `happy-dom` for DOM environment (via `@happy-dom/global-registrator`)

### Test conventions
- **Always use fake timers** (`jest.useFakeTimers()` / `jest.advanceTimersByTime()`) — the app is timer-heavy
- Call `cleanup()` in `afterEach` of every component test file
- For SART/GoNoGo tap tests, use `fireEvent.keyDown(document, { code: "Space" })` — native `addEventListener("mousedown")` handlers don't fire with `fireEvent.mouseDown` in happy-dom
- `performance.now()` does not advance with fake timers, so RT values will be ~0 in tests. Assert `>= 0` for RT fields, not `> 0`
- Test behavioral scoring (user action → resulting stats) not just UI flow
- For Stroop, detect correct answer by checking stimulus element class names (ink color) or text content (word)

### Test structure
- `src/__tests__/*Test.test.tsx` — component UI flow tests (instructions, countdown, phase transitions)
- `src/__tests__/*Scoring.test.tsx` — behavioral scoring tests (tap patterns → commission/omission errors, RT, accuracy)
- `src/__tests__/scoring.test.ts` — pure scoring function tests (scoreLinear, calculateScores, compositeScore, getRank)
- `src/__tests__/shareUtils.test.ts` — URL sharing round-trip tests
- `src/__tests__/screens.test.tsx` — screen component tests (Landing, Questionnaire, TestScreen, Results)
- `src/__tests__/App.test.tsx` — integration tests (navigation, share FAB, continue/restart)

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

## Components
Do not re-invent the wheel when creating components - make the app as idiomatic with [shadcn](./shad_llms.txt) components as possible!


HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.
