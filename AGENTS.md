# AGENTS.md — Civil Command & FieldScript Guide

This repository uses **FieldScript** (`*.fs`), a small custom S-expression-like scripting language parsed and executed by [field.mjs](field.mjs).

## Repository Map

- [field.mjs](field.mjs) — FieldScript parser (`parse`), lexically-scoped async runtime (`field`), code transport (`send`, `createTransport`, `serializeTransportPacket`, `deserializeTransportPacket`, `isTransportPacket`, `isDomElement`, `runTransportedScripts`), line-by-line notebook runner (`runLines`, `formatValue`), lane tab & path URL routing helpers (`LANE_TABS`, `DEFAULT_LANE_TAB`, `normalizeLaneTab`, `parseLanePath`, `formatLanePath`, `normalizeLanePath`, `parseLaneRouteSegment`, `parseLaneRoutes`, `formatLaneRouteSegment`, `formatLaneRoutes`), lane rail, scrollbar & viewport scroll helpers (`LANE_MINIMIZE_SIDES`, `normalizeLaneMinimizeSide`, `getLaneInitial`, `LANE_SCROLL_LEFT_MARGIN`, `LANE_SCROLL_RIGHT_MARGIN`, `computeLaneScrollLeft`, `DEFAULT_SCROLLBAR_COLOR`, `resolveScrollbarColor`, `seedPreferencesScrollbarRecords`, `seedPreferencesScrollbarSource`), primitive input type helpers (`PRIMITIVE_TYPES`, `defaultValueForType`, `normalizePrimitiveType`), structured Data table helpers (`DATA_COLUMN_TYPES`, `DATA_CONSTRAINT_TYPES`, `DEFAULT_FIXED_DECIMALS`, `DEFAULT_ROW_PICKER_PAGE_SIZE`, `MIN_COLUMN_WIDTH`, `MAX_COLUMN_WIDTH`, `normalizeColumnWidth`, `normalizeFixedDecimals`, `normalizeColumnConstraint`, `findWorkflowDefaultColumns`, `normalizeDataColumnType`, `parseColumnType`, `formatColumnType`, `defaultDataValue`, `parseCellValue`, `formatCellInputValue`, `coerceDataValue`, `checkColumnChangeImpact`, `parseStoredTables`, `buildTablesScope`, `dataValuesEqual`, `resolveRowValueSpec`, `resolveRowTarget`, `lookupRowDisplay`, `fetchRowOptionsPage`, `filterRowOptions`, `resolveWorkflowTarget`, `getWorkflowCellState`), scope browser introspection (`describeValue`, `listScopeEntries`, `filterScopeEntries`, `resolveScopeColumns`, `resolveScopePath`), and cross-lane import / idle helpers (`parseImportLine`, `formatImportLine`, `extractLaneExports`, `resolveImportValue`, `createIdleTracker`, `hasImportCycle`).
- [field.test.mjs](field.test.mjs) — Unit and integration tests (`node --test field.test.mjs`).
- [index.html](index.html) — Entry page; declares PWA manifest/icon metadata, defaults `:root` `scrollbar-color` to `#383838 transparent` (inheriting across page, tables, controls, and Lane Output unless overridden, with `@supports not` WebKit fallback), registers `/sw.js`, initializes `field({ ... })` with runtime/data/scope/transport helpers from [field.mjs](field.mjs) and split KV/session/package helpers from [storage.mjs](storage.mjs), and loads `/src/main.fs`.
- [manifest.webmanifest](manifest.webmanifest) — PWA Web App Manifest (`Civil Command`, standalone display, `#000000` theme/background, standard & maskable Civil icons).
- [sw.js](sw.js) — Service worker precaching the app shell (including [storage.mjs](storage.mjs) and all `src/*.fs` modules) with network-first static/navigation fallback and pass-through for `/api/` KV traffic.
- [favicon.ico](favicon.ico) & [icons/](icons/) — Civil app icon assets (`favicon.ico`, `icon-192.png`, `icon-512.png`, `icon-maskable-192.png`, `icon-maskable-512.png`, `apple-touch-icon.png`, `icon.svg`).
- [data.mjs](data.mjs) — Namespaced HTTP KV client (`httpKV`) backed by `/api/data?mode=disk`, supporting `root`, `namespace()`, civil-memory `#`-delimited `hashNamespace()` with `/` path hierarchy and `.` segment encoding, and idempotent `delete()` (treating 404 as success).
- [storage.mjs](storage.mjs) — Split KV persistence layer (`<= 1024` UTF-8 bytes per key with transparent `.chunks/<n>` auto-chunking and `-index`/`-pages/<n>` paged ID indexes) structuring tables (`lanes#<laneId>/tables/<tableId>/schema` & `rows/<rowId>`), per-line Source scripts (`lanes#<laneId>/script/<lineId>` with modification timestamps), versioned Sessions with saved open `laneIds`, `forkSession`, `saveSessionVersion`, `createNewSession`, chronological `readSessionHistory` / `formatSessionDuration`, and two-level `localStorage`/`sessionStorage` support (`sessions#<sessionId>/...`), plus Packages (`packages#<packageId>/...` with salted SHA-256 passphrases, `"Default"` package, and `packages#<packageId>/sessions` reverse index for `listPackageSessions` / `listPackageLanes`), with instant on-encounter migration and deletion of legacy `<laneId>.tables`, `<laneId>.script`, and `lanes` keys (`<laneId>.inputs` remains stored together).
- [start](start) — Node HTTP server on `:8080` (proxies `/api/data` to `localhost:3333`, serves `.webmanifest`/`.ico`/`.fs` with proper MIME types and `no-cache` for `sw.js`, SPA fallback to `index.html`).
- [src/main.fs](src/main.fs) — App bootstrap, DOM skeleton (including mounting the left-column Session & Packages summary card below `+ Lane` / `Open`), and event wiring.
- [src/lane-control.fs](src/lane-control.fs) — Lane management module (`mount`, `mount-locked`, `add`, `open`, `open-after`, `move-lane-after`, `scroll-lane-into-view`, `reload`, `close`, `rename`, `minimize`, `restore`, `set-width`, `apply-lane-width`, `attach-lane-resizer`, `remember-path`, `set-path`, `configure`, `clear`, `sync`, `init`, `update-url`, session & package management with structural draft versioning and URL-redirecting session switches `init-session`, `ensure-session`, `new-session`, `switch-session`, `save-session-draft`, `fork-session`, `abandon-session-draft`, `recompute-session-dirty`, `mount-workspace-summary`, `sync-workspace-summary`, `new-tab-session`, `switch-tab-session`, `return-to-browser-session`, `promote-tab-session`, `switch-browser-session`, `rename-session`, `create-package`, `open-package`, `close-package`, `set-active-package`, `move-lane-package`, package-scoped catalog `load-catalog`, `register`, `list-known`, shared `lane-modal`, `confirm-modal`, `row-picker-modal`, `session-modal`, `line-info-modal`, `rails`, global system-wide preferences lane management `load-preferences-lane`, `set-preferences-lane`, `create-preferences-lane`, `open-preferences-lane`, `apply-preferences`, plus access-controlled cross-lane idle state coordination `get-lane-final-state`, `notify-lane-idle`, `pick-import`, `pick-lane`, `refresh-lane-labels`).
- [src/lane-rails.fs](src/lane-rails.fs) — Always-open fixed left and right side rails (`32px`, `#383838`, always on top of workspace and modals) hosting `26px` single-initial buttons for minimized lanes with a floating non-interactive live hover preview and click-to-restore behavior, plus an always-open fixed `16px` top rail (`#383838`, 5 centered `12px` icon buttons with 1px border for toggling root `<html>` fullscreen with an inverting 4-corners SVG icon, opening the `lane-modal.fs` Open Lane dialog via a search icon, opening a dedicated Sessions dropdown with unsaved-draft indicator, Save/Fork/Abandon chips, 1-click switcher, and History link, opening a dedicated Packages dropdown with the stacked-layers icon for included packages and Package Page access, and opening a wrench Preferences dropdown to view/open/set/create the global preferences lane).
- [src/lane-notebook.fs](src/lane-notebook.fs) — Per-lane tabbed notebook UI (`Source`, `Input`, `Scope`, `Data`, `View`), numbered code lines (with clickable line numbers for individual line edit mode via a vertically resizable auto-sized `<textarea>`, automatic `<textarea>` rendering + height-matched output scaling for multiline lines, and a hover info button opening `lane-line-info-modal.fs` with line ID and modification timestamp) and cross-lane import picker lines (`+` / `+ Import` / `×` / `Enter`), live top-to-bottom JSON previews, idle tracking (`when-idle`, `is-running`, `has-run`), split per-line KV persistence via [storage.mjs](storage.mjs) (with instant migration from legacy `script`), URL & remembered per-lane path routing (`/<id>` for home `Source`, `/<id>;<tab>` for `Input`/`Scope`/`Data`/`View`), run gating (runs Source on `Source`, `Scope`, and `View`, skips on `Input` and `Data`), and mounting `lane-output.fs` below the lane (`View` hides notebook panels and shows only the output browser).
- [src/lane-line-info-modal.fs](src/lane-line-info-modal.fs) — Modal dialog opened by each Source line's hover info button showing line number, line ID, and formatted modification timestamp + ISO string (or `"Unknown"` for migrated/untracked lines).
- [src/lane-session-modal.fs](src/lane-session-modal.fs) — Dedicated Sessions modal (`open-switch-session` Session Switcher & Manager with collapsible Advanced Tab vs. Browser controls, and full-screen `open-history` Session History Page showing chronological activation times and 1-click switching).
- [src/lane-package-modal.fs](src/lane-package-modal.fs) — Dedicated Packages modal (`open-create-package`, `open-unlock-package`, and full-screen `open-packages` Package Page listing all sessions with each package open + package lanes).
- [src/lane-output.fs](src/lane-output.fs) — Per-lane mini "browser" window (`Lane Output`) mounted below the lane; appears when a lane emits `send` packets or when the `View` tab is active (with an empty-state placeholder if no scripts are sent yet), deserializes and runs all transported scripts in FieldScript in browser context (`document`, `window`, `output`), appends returned DOM elements to its viewport, displays browser errors, and provides a `↻` reload button.
- [src/lane-inputs.fs](src/lane-inputs.fs) — Per-lane `Input` tab table of assumed primitive scope variables (`string`, `number`, `boolean`, `null`, `undefined`) persisted under `inputs` and seeded into lane execution scope.
- [src/lane-scope.fs](src/lane-scope.fs) — Per-lane `Scope` tab multi-column Miller-column browser of everything reachable via `get` in the final total scope (also embedded inside the cross-lane import picker), featuring FieldScript type previews (`object`, `list{N}`, `will` with leading doc comments, `map{N}`, `set{N}`, `bytes{N}`, `promise`, `error`, `fn`), a live name filter bar with match counts and `Enter`/`Esc` keyboard shortcuts, a `proto` toggle for inherited prototype properties, and a one-click `Copy` `$path` button.
- [src/lane-data.fs](src/lane-data.fs) — Per-lane `Data` tab for defining multiple structured tables with typed columns (`integer`, `decimal`, `fixed` with configurable decimal places defaulting to 2 that edits as `xxx.xx` and stores scaled integers `xxxxx`, `text` with optional `Workflow` constraint configured via `+ constraint` mapping a lane table's `From`/`To` transition columns and rendering state-driven dropdowns with red error highlighting for invalid values, `boolean`, `date`, `datetime`, `url`, `email`, `json`, `row` linked to a lane table's link column and optional display column, and `lane` storing a selected lane ID picked via the full-screen `lane-modal.fs` picker, each optionally multiple `[]`), editing typed rows inline (opening `lane-row-picker-modal.fs` on edit for `row` cells while joining display labels on render, and splitting selected `lane` cells into an ID chooser button and an open-to-right button with an up-and-to-the-right arrow icon that opens/moves the target lane immediately after the current lane), persisting schemas and individual rows as separate split KV keys via [storage.mjs](storage.mjs) (with instant migration from legacy `tables` and syncing remembered `data/<tablename>` lane path), seeding named tables into lane scope, and confirming all destructive actions via `confirm-modal.fs`.
- [src/lane-row-picker-modal.fs](src/lane-row-picker-modal.fs) — Searchable, async paginated modal picker opened when editing a `row` cell; loads options page-by-page only on edit/scroll/load-more and scans ahead on demand only when filtering requires more matches.
- [src/confirm-modal.fs](src/confirm-modal.fs) — Reusable confirmation modal dialog for destructive actions (column/table/row/item deletion, clear rows, and lossy schema type/multiplicity changes).
- [src/lane-import-modal.fs](src/lane-import-modal.fs) — Modal picker for cross-lane import lines; selects another lane, waits until idle, supports importing the entire lane (`Whole lane`, empty path) or browsing its final state via embedded `lane-scope.fs` to pick a specific value, and assigns the default or custom variable name.
- [src/lane-modal.fs](src/lane-modal.fs) — Full-screen modal for browsing and filtering accessible lanes across the active session's open packages (with package filter pills, `+ Package` / `Open Pkg` shortcuts, and per-lane package badges), supporting both Open/Close management (`open`) and selecting or clearing a lane ID (`open-picker`).
- [src/lane-config-modal.fs](src/lane-config-modal.fs) — Modal dialog opened by each lane's SVG gear button for configuring lane settings (Title, Width in px with auto-width Reset, remembered Path with default-view Reset, and Package selector, plus Cancel / Save changes).

## Code Style & Testing

- **No absolute filesystem paths in committed files**: never write machine-specific paths (e.g., `/home/...`, `file:///...`) in `AGENTS.md`, docs, code, or tests — always use repo-relative paths (`.well-known/` is excluded from git for local machine-specific files).
- JavaScript (`.mjs`): 1-space indentation, no semicolons, native ESM.
- FieldScript (`.fs`): 1-space indentation for nested blocks; keep spaces inside delimiters (`{ a }`, `[ cmd ]`, `( ... )`) for readability.
- Run tests with:
  ```bash
  node --test field.test.mjs
  ```

---

## FieldScript Syntax (`*.fs`)

### 1. Blocks, Lists, and Sigils

| Syntax | Meaning | Compiled AST |
| --- | --- | --- |
| `[ cmd arg1 arg2 ]` | Eager command call (or grouped single `@` expression like `[ !fn a ]`) | `['@', 'cmd', arg1, arg2]` |
| `( stmt1 stmt2 )` | Deferred async function (`will`), returns last non-comment expression | `['@', 'will', stmt1, stmt2]` |
| `{ a b c }` | List literal (JS `Array`) | `['a', 'b', 'c']` |
| `; cmd arg1 arg2` | Eager **autoblock** (shorthand for `[ ... ]`) | `['@', 'cmd', arg1, arg2]` |
| `: stmt` | Deferred **autoblock** (shorthand for `( ... )`) | `['@', 'will', stmt]` |
| `!a.b arg1 arg2` | **Invoke autoblock** (shorthand for `; invoke { arg1 arg2 } a b`) | `['@', 'invoke', [arg1, arg2], 'a', 'b']` |
| `$name` / `$a.b.c` | Variable / property read shorthand (`[ get a b c ]`) | `['@', 'get', 'a', 'b', 'c']` |
| `-- comment text` | Line comment preserved as a no-op AST node | `['@', 'comment', 'comment text']` |

### 2. Autoblock Rules (`;`, `:`, and `!`)

`;`, `:`, and `!` open an autoblock that automatically closes at:
1. **End of line (`\n`)**, **comma (`,`)**, or **EOF** — flushes the pending word and closes *all* open autoblocks up to the nearest non-autoblock container (`{`, `[`, `(`, or root).
2. **End of parent block (`}`, `]`, `)`)** — flushes the pending word first, then closes *all* open autoblocks up to that closing bracket.
3. **Inline `-- ` comment** — flushes open autoblocks on the line first, then appends the `['@', 'comment', ...]` node to the enclosing block.

**Idiomatic autoblock patterns:**
- Left-to-right method and function calls with `!`:
  ```fs
  !element.setAttribute data-lane-id $id
  !scope.clear-next
  ; to title-el !document.createElement div
  ; to lane !scope.mount $id $title $lane-data
  ; set [ !data.get session ] state session
  ```
- **Use `:` whenever the last block of a block or line is a single-statement `( will )`** — it automatically closes at `}`, `]`, `)`, `,`, or `\n`:
  ```fs
  ; to element [ match
   { $created.header : $created.header }
   { true : $created }
  ]
  ; to body-el [ match
   { $created.body : $created.body }
   { true : null }
  ]
  ; condition { propertyIsGreaterThanOrEqual 0 lane-idx } : !scope.lanes.splice $lane-idx 1
  !close-btn.addEventListener click : !scope.close $id
  ```
  Remember that `:` wraps its contents in `will` just like `( ... )`, so commands inside `:` still use `;` or `!` (e.g. `{ true : ; add $a $b }`, `{ $body : !body.remove }`). Use explicit `( ... )` when the deferred body has multiple statements or spans multiple lines (unless its single expression is itself an explicit multiline block like `: { ... }`).
- Defining multi-statement deferred functions on a property:
  ```fs
  ; to scope.init (
   -- Subscribes to popstate and performs initial URL sync
   !window.addEventListener popstate $scope.sync
   !scope.sync
  )
  ```
  Because `(` is not an autoblock, newlines inside `( ... )` do not close the outer `; to`.
- Explicit `[ ... ]` is used when another argument follows a call on the same line (`; set [ !data.get @1 ] state @1`, `!fn [ !box.double 4 ] next`) or when a single command spans multiple lines (`; to lane [ object\n { id $id }\n]`).

### 3. Tokens, Strings, Numbers, and Comments

- **Variable & property shorthand (`$name`, `$a.b.c`)**: Bare tokens starting with `$` split on `.` and compile to `['@', 'get', ...segments]`. Works for state reads, nested properties (`$scope.lanes.length`), `$argv` / `$argv.0` / `$argv.length`, return values (`$lane`, `$scope`), and `=` patterns (`$@1`, `$scope.@1`).
- **Bare words** are strings by default (`div`, `#202020`, `13px`, `/`, `popstate`, `lane-control--add`, `--color-primary`).
- **Single-quoted strings** `'...'` always stay literal strings (never interpreted as `$var`, booleans, `null`, `=`, or numbers), preserve spaces, support `\\`, `\'`, `\n`, `\t`, and emit `""` for `''`.
- **Numbers**: Any bare numeric literal that round-trips cleanly through `Number` (`0`, `1`, `-42`, `3.14`, `0.65`) parses as a JS `number`. Leading-zero tokens (`007`), CSS units (`10px`), hex colors (`#202020`), and integers beyond safe JS precision stay strings.
- **Reserved literals**: `true`, `false`, `null`, `undefined`.
- **Comments (`--`)**: `--` followed by whitespace or EOL starts a comment to end of line and emits `['@', 'comment', text]` as a no-op AST node (preserved for metaprogramming/doc generation, and ignored when determining a block's return value). Words containing `--` (`lane-control--add`) or starting with `--` followed by non-whitespace (`--color-primary`) are not treated as comments.

### 4. Pattern / Macro Expansion (`=`)

`=` defines a compile-time expansion template ending at the first newline outside any inner `( ... )`, `{ ... }`, or `[ ... ]` block (so templates can contain multiline blocks, while data rows remain flat whitespace-separated lines). The template is applied to every following data line until a bare `=` resets it:
- `@1`, `@2`, … substitute the 1st, 2nd, … whitespace-separated token of each data line (`@0` is the full token array), including inside dot-paths (`scope.@1`, `$scope.@1`).
- `@N+` splices tokens from index `N` to the end of the line (including in `!@2+.appendChild`).

```fs
= ; to @1 !document.createElement @2
 table table
 tableHead thead
=
= !@2+.appendChild $@1
 tableHead table
 table document body
=
```

---

## Runtime Model & Keywords

All commands are methods on a lexically-scoped `field` scope (`me`) in [field.mjs](field.mjs). Evaluation is **async and sequential**.

### Scoping & Return Values

- **Last-expression return**: `( ... )` (`will`), `run()`, and `load()` evaluate statements sequentially and return the value of the **last non-comment statement** (no `.pop()` needed).
- **Lexical per-module & per-call scopes**:
  - `load` runs each loaded module in a fresh child scope (`Object.create(parentState)`), so module-level variables (like `scope`) don't leak into the caller while still inheriting parent globals (`document`, `window`, `data`, etc.).
  - Every `will` invocation runs in a fresh per-call child scope (`Object.create(lexicalState)`) with its own `argv`, so local bindings don't collide across modules or concurrent async calls. Shared mutable state lives on objects like `scope`.
  - Inline `condition`, `match`, and `while` `( ... )` blocks share the enclosing function's scope and `argv` (so assignments inside a branch or `while` loop update the enclosing function's locals).
- **Function AST & source-mapped errors**:
  - Compiled `will` functions expose their statement AST on `.ast` (e.g. `$fn.ast`), including `['@', 'comment', text]` nodes for runtime documentation/metaprogramming.
  - `parse(text, filename)` attaches source locations (`filename`, `line`, `col`, `sourceLine`) to AST nodes via a `WeakMap` (`load` passes `scriptPath` automatically). Runtime errors preserve their original error class (`TypeError`, etc.), append `(<filename>:<line>:<col>: <source>)`, and attach `err.fieldLocation`.

### State & Assignment

- `get <root> [prop ...]` — Reads from `argv` (when root is `argv`) or `state[root]`, walking nested properties safely. Supports dot-paths in the root argument (`get scope.lanes.length`).
- `to <target...> <value>` — Assigns `<value>` to a bare variable on the current scope (`; to id ...`) or to a nested property path (supports both dot-paths `; to scope.lanes {}` and mixed dynamic keys `; to scope.by-id $id $lane`, where dynamic segments are never dot-split), and returns `<value>`.
- `set <value> <target...>` — Same semantics as `to`, value-first (`; set left element.style.textAlign`), returning `<value>`.
- **List destructuring** (both `to` and `set`):
  - Flat: `; to { id title lane-data } $argv`
  - Nested: `; to { a { b c } } { one { two three } }`
  - Scoped target: `; to scope.nested { id title } $argv`
  - Skip slots with `null` / `undefined`: `; to { null second } $argv`
  - Trailing rest binding: `; to { head ...tail } $argv`
- `object [{ key value } ...]`
  - Returns a fresh `{}` populated from any `{ key value }` pair lists:
    ```fs
    ; to scope ; object { lanes {} } { lane-ids {} } { by-id ; object }
    ```
  - Throws `TypeError` for non-pair arguments.
- `assign <target> [source ...]`
  - Mutates `<target>` (a dot-path string resolved via `get`, or an evaluated object) and returns it.
  - Each `source` may be a `{ key value }` pair list, a plain object (merged via `Object.assign`), or `null`/`undefined` (skipped):
    ```fs
    ; assign element.style { textAlign left } { verticalAlign top } { padding '0.25em 0.75em' }
    ; assign element.style $baseStyles { padding '1em' }
    ```

### Invocation & Control Flow

- `invoke <argsList> <targetPath...>` (and `!target.path arg1 arg2` shorthand)
  - Calls `fn(...args)` or `obj[method](...args)` preserving `this = obj`. Supports dot-paths on the first target segment, evaluated function targets (`!$fn arg`), and evaluated receiver objects.
- `tap <targetPath...>`
  - Shorthand for `invoke {} <targetPath...>` (zero-arg call; kept alongside `!target.path`).
- `will` (`( ... )` or `:`) — Async function with its own per-call scope and `argv`, exposing `.ast` and returning the last non-comment expression.
- `condition <predicateList> <deferredBlock>` — Evaluates `me[pred[0]](...pred.slice(1))`; if truthy, runs `<deferredBlock>` (reusing the enclosing scope when inline).
- `match { cond : expr } ...` / `match { cond ( will ) } ...`
  - Evaluates `{ condition ( will ) }` arms lazily in order and returns the result of the first arm whose condition is truthy (or `undefined` if none match). Prefer `{ cond : expr }` for single-statement arms.
  - Conditions may be values (`$stored-title`, `true`), command expressions (`[ !check $x ]`), predicate lists (`{ propertyIs 0 n }`), or deferred `( ... )` blocks. Inline arms share the enclosing scope and `$argv`.
- `each <iterable> <deferredBlock>`
  - Iterates any JS iterable sequentially, awaiting `fn(item, index)` (with `$argv` = `{ item index }`) and returning the last iteration's value.
- `while <cond> <deferredBlock>`
  - Re-evaluates `<cond>` (predicate list `{ ... }`, expression `[ ... ]`, `$var`, or deferred `( ... )`) before each iteration, executes `<deferredBlock>` (sharing the enclosing scope when inline), and returns the last iteration's value.
- `try <deferredBlock> <onErrorBlock>`
  - Runs `<deferredBlock>` (sharing the enclosing scope when inline) and catches both synchronous throws and async Promise rejections, invoking `<onErrorBlock>` with `$argv` = `{ err }` (or returning `<onErrorBlock>` if not a function).
- `and <predList1> <predList2> ...` — Bitwise-ANDs predicate list evaluations.
- `ternary <cond> <whenTrue> <whenFalse>` — Eager ternary (`cond ? whenTrue : whenFalse`).
- `comment ...` — No-op AST node (also created by `-- ...`).

### Predicates

Comparison value comes **first**, then state path (space- or dot-separated):
- `propertyIs`, `propertyIsLessThan`, `propertyIsGreaterThan`, `propertyIsLessThanOrEqual`, `propertyIsGreaterThanOrEqual`

### Arithmetic

- `add <a> <b>`, `subtract <a> <b>`, `multiply <a> <b>`, `divide <a> <b>`, `modulus <a> <b>`

### Modules, Code Transport & Execution

- `send <deferredBlock|packet> [args...]` — Serializes a deferred `( ... )` block's `.ast` (plus optional JSON-serializable `args` as `$argv` and a snapshot of serializable server-scope `bindings`, excluding server globals like `data`/`console`) into a JSON code-transport packet queued on the runtime's `transport` without executing the block on the server lane.
- `load <scriptPath> [vars]` — Fetches, parses, templates (`template#key`), and runs a `.fs` file in a child module scope, returning its last non-comment value.
- `run`, `compile`, `evalBlock`, `template` — Programmatic entry points on the `field()` object.
- `runLines(lines, { filename, initialState, transport })` & `formatValue(value)` — Exported notebook evaluator from [field.mjs](field.mjs); parses each line with standard FieldScript syntax (`parse(\`${source}\n\`, filename, i)`) so commands require `;`, `!`, or `[ ... ]` (bare multi-token lines like `set foo bar` evaluate as data lists `["set","foo","bar"]` without invoking `set`), returning per-line `{ index, lineNumber, source, value, preview, error, isEmpty, isComment }`, final `state`, and `sent` transport packets.
- `runTransportedScripts(packets, { document, window, console, output, isCancelled })` — Deserializes transported JSON packets and executes each script sequentially in a browser-context `field()` runtime; if the last non-comment expression returned by a script is a DOM element (`isDomElement`), it is appended to `output`.

---

## Established Design Patterns

1. **Module Export via `scope`**:
   Initialize `; to scope ; object ...`, attach methods with `; to scope.method ( ... )`, and end with `$scope`. Callers import directly:
   ```fs
   ; to lane-control ; load /src/lane-control.fs
   ```

2. **Destructure `$argv` First**:
   ```fs
   ; to { id title lane-data } $argv
   ```
   Every call gets its own isolated local scope and `argv`, so plain descriptive names (`id`, `title`, `lane`) are safe without module prefixes.

3. **Prefer `each` / `while` and `match` for Loops & Branching**:
   - Use `while` when mutating a collection or counter in place (see `clear` in [lane-control.fs](src/lane-control.fs#L144-L155)):
     ```fs
     ; while { propertyIsGreaterThan 0 scope.lanes.length } (
      ; to removing !scope.lanes.pop
      !removing.element.remove
     )
     ```
   - Use `each` for iterating an iterable with `$argv` = `{ item index }` (see `sync` in [lane-control.fs](src/lane-control.fs#L156-L166)):
     ```fs
     ; each $pending-ids (
      ; to { next-id } $argv
      !scope.open $next-id
     )
     ```
   - Use `[ match { cond : expr } { true ( ... ) } ]` for lazy multi-branch selection and fallback values, preferring `:` for single-statement arms (see `mount` and `open` in [lane-control.fs](src/lane-control.fs#L33-L40) and [lane-control.fs](src/lane-control.fs#L120-L143)).

4. **Document Blocks with `--`**:
   Place `-- ...` comments inside `( ... )` bodies or above definitions; they remain in the AST as `['@', 'comment', text]` nodes accessible via `$fn.ast` without affecting runtime behavior or return values.
