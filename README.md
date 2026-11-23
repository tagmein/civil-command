# civil-command

A lightweight, zero-dependency project management, live scripting, and communication workspace built in the browser on **FieldScript** (`*.fs`) — a small custom async S-expression-inspired language.

---

## Features

- **Multi-lane workspace** — Open, create, rename, and close side-by-side lanes inside a floating, auto-expanding workspace wrapper.
- **URL-synced state** — Open lane IDs are reflected directly in the URL pathname (`/<lane-id-1>/<lane-id-2>`), supporting page reloads and browser Back/Forward navigation via `popstate`.
- **Per-lane live FieldScript notebooks** — Every lane contains a numbered, line-by-line FieldScript notebook with:
  - Live top-to-bottom evaluation on every keystroke
  - Inline JSON result previews per line
  - Per-line syntax and runtime error reporting (with filename, line, column, and source snippet)
  - Keyboard-friendly editing (`Enter` inserts a new line below, `+` appends a line, `×` removes a line)
  - Automatic persistence to the lane's KV namespace
- **Open Lane modal** — Browse, filter (by title or UUID), re-open, and close any known lane stored in the persistent KV database (`Escape` or backdrop click to dismiss).
- **Configure Lane modal** — Each lane header has a gear icon aligned with the top controls to edit lane settings (currently editing lane Title with **Cancel** / **Save changes**, persisted to both the lane namespace and the known-lanes catalog).
- **Zero npm dependencies** — Native ES modules in the browser, a tiny Node.js HTTP server (`start`), and a built-in `node:test` test suite.

---

## Quick Start

### Prerequisites

- **Node.js** (v18+ recommended, with native ESM and `node:test`)
- A local KV HTTP service listening on `http://localhost:3333` for `/api/data` persistence (see [Persistence & Backend API](#persistence--backend-api))

### Run the App

```bash
./start
# or:
node start
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

### Run the Tests

```bash
node --test field.test.mjs
```

---

## Architecture & Repository Map

| Path | Role |
| --- | --- |
| [index.html](index.html) | App entry point, dark workspace & modal CSS, initializes `field({ console, data, document, runLines })` and loads `/src/main.fs`. |
| [start](start) | Zero-dependency Node.js HTTP server on `:8080`; serves static files, proxies `/api/data` to `http://localhost:3333/`, and falls back to `index.html` for SPA lane routes. |
| [field.mjs](field.mjs) | FieldScript parser (`parse`), lexically-scoped async runtime (`field`), and line-by-line notebook runner (`runLines`, `formatValue`). |
| [data.mjs](data.mjs) | Namespaced HTTP key-value client (`httpKV`) backed by `/api/data?mode=disk`. |
| [src/main.fs](src/main.fs) | Application bootstrap, base DOM table skeleton, `+ Lane` / `Open` controls, and module wiring. |
| [src/lane-control.fs](src/lane-control.fs) | Lane lifecycle manager (`mount`, `add`, `open`, `close`, `rename`, `configure`, `clear`, `sync`, `init`, `update-url`) and persistent known-lanes catalog (`load-catalog`, `register`, `list-known`). |
| [src/lane-notebook.fs](src/lane-notebook.fs) | Per-lane persistent FieldScript notebook UI, live evaluator, renumbering, and KV save/restore. |
| [src/lane-modal.fs](src/lane-modal.fs) | Full-screen **Open Lane** modal for searching, opening, and closing saved lanes. |
| [src/lane-config-modal.fs](src/lane-config-modal.fs) | **Configure Lane** modal dialog opened by each lane's SVG gear button. |
| [field.test.mjs](field.test.mjs) | Unit and end-to-end integration tests covering the parser, runtime, notebook evaluator, and all `.fs` modules. |
| [AGENTS.md](AGENTS.md) | Detailed FieldScript syntax reference, runtime semantics, and repository coding conventions. |

### Bootstrap Flow

1. [index.html](index.html) imports `field` and `runLines` from [field.mjs](field.mjs) and `data` from [data.mjs](data.mjs), then calls `main.load('/src/main.fs')`.
2. [src/main.fs](src/main.fs) builds the table layout (`+ Lane`, `Open`, lane header row, and lane body row), loads [src/lane-control.fs](src/lane-control.fs) and [src/lane-modal.fs](src/lane-modal.fs), and calls `!lane-control.init`.
3. [src/lane-control.fs](src/lane-control.fs) loads [src/lane-notebook.fs](src/lane-notebook.fs) and [src/lane-config-modal.fs](src/lane-config-modal.fs), subscribes to `popstate`, and mounts every lane ID present in `location.pathname`.
4. Each mounted lane loads its saved `title` and `script` lines from KV and immediately evaluates its notebook top-to-bottom.

---

## Persistence & Backend API

[data.mjs](data.mjs) exposes a namespaced HTTP KV client (`httpKV`) targeting `/api/data?mode=disk`. Requests are proxied by [start](start) to `http://localhost:3333/` with `/api/data` stripped from the path:

| Operation | HTTP Request | Behavior |
| --- | --- | --- |
| `get(key)` | `GET /api/data?mode=disk&key=<qualified>` | Returns response text, or `null` on HTTP `404`. |
| `set(key, value)` | `POST /api/data?mode=disk&key=<qualified>` | Persists string body under `<qualified>`. |
| `delete(key)` | `DELETE /api/data?mode=disk&key=<qualified>` | Deletes `<qualified>`. |
| `namespace(name)` | *(client-side)* | Returns a child KV client qualifying keys as `<prefix>.<key>`. |

### KV Key Schema

| Key | Format | Description |
| --- | --- | --- |
| `session` | string | Session value read during app bootstrap. |
| `lanes` | JSON object (`{ [id]: { id, title } }`) | Persistent catalog of all known lanes shown in the **Open Lane** modal. |
| `<lane-id>.title` | string | Display title for a specific lane. |
| `<lane-id>.script` | JSON array of strings | Saved lines of the lane's FieldScript notebook. |

### URL Routing

- Open lanes are stored in the URL path as `/<lane-id-1>/<lane-id-2>/...`.
- Adding, opening, or closing a lane calls `history.pushState` via `lane-control.update-url`.
- Closing a lane removes it from the current view and URL while preserving its `<lane-id>.*` data and `lanes` catalog entry so it can be re-opened anytime from the **Open** modal.

---

## FieldScript Quick Reference

FieldScript (`*.fs`) is a small, async, lexically-scoped scripting language implemented in [field.mjs](field.mjs). For the full specification, see [AGENTS.md](AGENTS.md).

### Core Syntax

| Syntax | Meaning | Example |
| --- | --- | --- |
| `; cmd args...` | Eager autoblock command (closes at `\n`, `,`, `}`, `]`, `)`, or `-- `) | `; to count ; add $count 1` |
| `[ cmd args... ]` | Explicit eager command block (for inline sub-expressions or multiline calls) | `; set [ !data.get session ] state session` |
| `!obj.method args...` | Invoke autoblock (calls `obj.method(...args)` preserving `this`) | `!firstName.concat ' ' $lastName` |
| `( stmt1 stmt2 )` | Deferred async function (`will`), returns last non-comment expression | `; to greet ( ; to { name } $argv ; add 'Hi ' $name )` |
| `: expr` | Deferred autoblock shorthand for a trailing single-statement `( will )` | `{ $existing : $existing }` |
| `{ a b c }` | List literal (JS `Array`) | `{ alpha beta gamma }` |
| `$name` / `$a.b.c` | Variable or nested property lookup (`[ get a b c ]`) | `$scope.lanes.length`, `$argv.0` |
| `'...'` | Literal string (preserves spaces; supports `\\`, `\'`, `\n`, `\t`) | `'Hello, world'` |
| `-- text` | Line comment preserved in AST as a no-op node | `-- Updates browser URL` |
| `= template` | Compile-time line-expansion macro (`@1`, `@2`, `@N+`) terminated by bare `=` | See [src/main.fs](src/main.fs) |

### Notebook Examples

Inside a lane notebook, each input line is parsed with standard FieldScript syntax (each line provides the trailing `\n`):

```fs
; to firstName Ada
; to lastName Lovelace
!firstName.concat ' ' $lastName
```

Preview output by line:
1. `"Ada"`
2. `"Lovelace"`
3. `"Ada Lovelace"`

Bare multi-token lines without a leading `;`, `!`, or `[ ... ]` evaluate as JSON data arrays rather than invoking commands:

```fs
set foo bar
```

Preview output: `["set","foo","bar"]` (does **not** invoke `set`).

Each notebook runs top-to-bottom in a fresh runtime seeded with `console`, `data` (the lane's own KV namespace), `Math`, `JSON`, and `Date`:

```fs
; to input 5
; to output ; add 3 $input
!Math.max 2 $output
; object { input $input } { output $output }
```

### Runtime Highlights

- **Lexical scoping**: Loaded modules run in fresh child scopes (`Object.create(parentState)`), and every `will` function call gets its own isolated scope and `$argv` — preventing variable collisions across modules or concurrent `async` calls.
- **Destructuring**: `to` and `set` support flat, nested, slot-skipping (`null`/`undefined`), and trailing `...rest` list destructuring (e.g. `; to { id title } $argv`).
- **Control flow**: `match` (lazy branch evaluation), `condition`, `each` (async sequential iteration over any iterable), `while`, `and`, and `ternary`.
- **Objects & mutation**: `object { k v } ...` creates fresh objects; `assign target { k v } $obj ...` merges pairs and objects onto a target.
- **Introspection & error locations**: Compiled `will` functions expose their AST (including `--` comments) on `.ast`, and runtime errors include `(filename:line:col: source)` plus `err.fieldLocation`.

---

## Development & Code Style

- **JavaScript (`.mjs`)**: 1-space indentation, no semicolons, native ESM.
- **FieldScript (`.fs`)**: 1-space indentation for nested blocks; spaces inside delimiters (`{ a }`, `[ cmd ]`, `( ... )`); prefer `:` for single-statement trailing `( will )` blocks.
- **Paths**: Never commit machine-specific absolute filesystem paths; always use repo-relative paths.
- **Tests**: Run `node --test field.test.mjs` after changes. The suite covers parser edge cases, scoping, async concurrency, `runLines`, and full mock-DOM integration tests for all `.fs` modules.

---

## License

[MIT](LICENSE) © 2025 TagMeIn
