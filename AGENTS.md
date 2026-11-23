# AGENTS.md — Civil Command & FieldScript Guide

This repository uses **FieldScript** (`*.fs`), a small custom S-expression-like scripting language parsed and executed by [field.mjs](field.mjs).

## Repository Map

- [field.mjs](field.mjs) — FieldScript parser (`parse`), lexically-scoped async runtime (`field`), and line-by-line notebook runner (`runLines`, `formatValue`).
- [field.test.mjs](field.test.mjs) — Unit and integration tests (`node --test field.test.mjs`).
- [index.html](index.html) — Entry page; initializes `field({ console, data, document, runLines })` and loads `/src/main.fs`.
- [data.mjs](data.mjs) — Namespaced HTTP KV client (`httpKV`) backed by `/api/data?mode=disk`.
- [start](start) — Node HTTP server on `:8080` (proxies `/api/data` to `localhost:3333`, SPA fallback to `index.html`).
- [src/main.fs](src/main.fs) — App bootstrap, DOM skeleton, and event wiring.
- [src/lane-control.fs](src/lane-control.fs) — Lane management module (`mount`, `add`, `open`, `close`, `clear`, `sync`, `init`, `update-url`, plus persistent known-lanes catalog `load-catalog`, `register`, `list-known`).
- [src/lane-notebook.fs](src/lane-notebook.fs) — Per-lane persistent script notebook UI (numbered lines, `+`/`×`/`Enter` editing, live top-to-bottom JSON previews, KV persistence under `script`).
- [src/lane-modal.fs](src/lane-modal.fs) — Full-screen modal for browsing, filtering, opening, and closing all known lanes from the persistent KV database.

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
- `and <predList1> <predList2> ...` — Bitwise-ANDs predicate list evaluations.
- `ternary <cond> <whenTrue> <whenFalse>` — Eager ternary (`cond ? whenTrue : whenFalse`).
- `comment ...` — No-op AST node (also created by `-- ...`).

### Predicates

Comparison value comes **first**, then state path (space- or dot-separated):
- `propertyIs`, `propertyIsLessThan`, `propertyIsGreaterThan`, `propertyIsLessThanOrEqual`, `propertyIsGreaterThanOrEqual`

### Arithmetic

- `add <a> <b>`, `subtract <a> <b>`, `multiply <a> <b>`, `divide <a> <b>`, `modulus <a> <b>`

### Modules & Execution

- `load <scriptPath> [vars]` — Fetches, parses, templates (`template#key`), and runs a `.fs` file in a child module scope, returning its last non-comment value.
- `run`, `compile`, `evalBlock`, `template` — Programmatic entry points on the `field()` object.
- `runLines(lines, { filename, initialState })` & `formatValue(value)` — Exported notebook evaluator from [field.mjs](field.mjs); runs an array of script lines top-to-bottom in a fresh `field` runtime (supporting bare commands like `to output ; add 3 $input`, bare data lines like `hello world` → `["hello","world"]`, `$output`, `;`, `!`, and `--` comments) and returns per-line `{ index, lineNumber, source, value, preview, error, isEmpty, isComment }` plus final `state`.

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
