# AGENTS.md — Civil Command & FieldScript Guide

This repository uses **FieldScript** (`*.fs`), a small custom S-expression-like scripting language parsed and executed by [field.mjs](field.mjs).

## Repository Map

- [field.mjs](field.mjs) — FieldScript parser & syntax validator (`parse`, `VALID_FIELD_COMMANDS`, `validateFieldScriptAst`, `validateFieldScriptLine`, `isParseableFieldScriptLine`, `validateFieldScriptLines`), lexically-scoped async runtime (`field`), code transport (`send`, `createTransport`, `serializeTransportPacket`, `deserializeTransportPacket`, `isTransportPacket`, `isDomElement`, `runTransportedScripts`), line-by-line notebook runner (`runLines`, `formatValue`), lane tab & path URL routing helpers (`LANE_TABS`, `DEFAULT_LANE_TAB`, `normalizeLaneTab`, `parseLanePath`, `formatLanePath`, `normalizeLanePath`, `parseLaneRouteSegment`, `parseLaneRoutes`, `formatLaneRouteSegment`, `formatLaneRoutes`), lane rail, modal bounds, scrollbar & viewport scroll helpers (`MIN_LANE_WIDTH`, `MIN_LANE_MODAL_WIDTH`, `MIN_LANE_MODAL_HEIGHT`, `normalizeLaneWidth`, `resolveLaneRenderedWidth`, `LANE_MINIMIZE_SIDES`, `normalizeLaneMinimizeSide`, `getLaneInitial`, `LANE_SCROLL_LEFT_MARGIN`, `LANE_SCROLL_RIGHT_MARGIN`, `LANE_SCROLL_TOP_MARGIN`, `LANE_SCROLL_BOTTOM_MARGIN`, `computeLaneScrollLeft`, `computeLaneScrollTop`, `DEFAULT_SCROLLBAR_COLOR`, `resolveScrollbarColor`, `seedPreferencesScrollbarRecords`, `seedPreferencesScrollbarSource`), top-rail clock, layout, IANA timezone & zoned datetime helpers (`isValidTimeZone`, `getBrowserTimeZone`, `listKnownBrowserTimeZones`, `extractTimezoneNames`, `normalizeClockHourFormat`, `normalizeClockShowSeconds`, `buildTopRailTimezoneOptions`, `resolveActiveClockTimezone`, `filterTimezoneOptions`, `formatTopRailClock`, `TOP_RAIL_BUILTIN_IDS`, `resolveTopRailElementId`, `normalizeTopRailOrder`, `normalizeTopRailHidden`, `resolveTopRailLayout`, `zonedWallClockToUtcMs`, `formatTimestampWithZone`, `resolveClockDisplayOptions`, `formatDatetimePlaceholder`, `formatDatetimeLocalInTimeZone`, `parseDatetimeInTimeZone`), primitive & secret input type helpers (`PRIMITIVE_TYPES`, `SECRET_MASK`, `defaultValueForType`, `normalizePrimitiveType`, `createMaskedSecretValue`, `isMaskedSecretValue`, `redactSecretText`, `redactSecretValue`), structured Data table helpers (`DATA_COLUMN_TYPES`, `DATA_CONSTRAINT_TYPES`, `DEFAULT_FIXED_DECIMALS`, `DEFAULT_ROW_PICKER_PAGE_SIZE`, `MIN_COLUMN_WIDTH`, `MAX_COLUMN_WIDTH`, `normalizeColumnWidth`, `normalizeFixedDecimals`, `normalizeColumnConstraint`, `findWorkflowDefaultColumns`, `normalizeDataColumnType`, `parseColumnType`, `formatColumnType`, `defaultDataValue`, `parseCellValue`, `formatCellInputValue`, `isDataCellValueEmpty`, `coerceDataValue`, `checkColumnChangeImpact`, `parseStoredTables`, `buildTablesScope`, `syncTableRowsInMemory`, `dataValuesEqual`, `rowFilterValuesMatch`, `resolveRowValueSpec`, `resolveRowTarget`, `lookupRowDisplay`, `fetchRowOptionsPage`, `filterRowOptions`, `resolveWorkflowTarget`, `getWorkflowCellState`, `resolveInboundSubtables`, `getInboundSubtableRowsForParent`), scope browser introspection (`describeValue`, `listScopeEntries`, `filterScopeEntries`, `resolveScopeColumns`, `resolveScopePath`), and cross-lane import / export / idle helpers (`parseImportLine`, `formatImportLine`, `parseExportLine`, `formatExportLine`, `extractLaneExports`, `resolveImportValue`, `createIdleTracker`, `hasImportCycle`).
- [field.fixtures.mjs](field.fixtures.mjs) — Shared test harness, 512 MB heap/RSS watchdog, preloaded `.fs` sources, and `DATA_RUNTIME_ENV` exports for all test suites.
- [field.test.mjs](field.test.mjs) & `field.*.test.mjs` (`field.lanes.test.mjs`, `field.data.test.mjs`, `field.rails.test.mjs`, `field.sessions.test.mjs`, `field.deploy.test.mjs`, `field.story.test.mjs`, `field.remote.test.mjs`) — Focused unit and integration test suites (`./test` runs all suites; `./test field.<suite>.test.mjs` runs one suite).
- [index.html](index.html) — Entry page; declares PWA manifest/icon metadata, defaults `:root` `scrollbar-color` to `#383838 transparent` (inheriting across page, tables, controls, and Lane Output unless overridden, with `@supports not` WebKit fallback), registers `/sw.js`, initializes `field({ ... })` with runtime/data/scope/transport helpers from [field.mjs](field.mjs) and split KV/session/package helpers from [storage.mjs](storage.mjs), and loads `/src/main.fs`.
- [manifest.webmanifest](manifest.webmanifest) — PWA Web App Manifest (`Civil Command`, standalone display, `#000000` theme/background, standard & maskable Civil icons).
- [sw.js](sw.js) — Service worker precaching the app shell (including [storage.mjs](storage.mjs) and all `src/*.fs` modules) with network-first static/navigation fallback and pass-through for `/api/` KV traffic.
- [favicon.ico](favicon.ico) & [icons/](icons/) — Civil app icon assets (`favicon.ico`, `icon-192.png`, `icon-512.png`, `icon-maskable-192.png`, `icon-maskable-512.png`, `apple-touch-icon.png`, `icon.svg`).
- [data.mjs](data.mjs) — Namespaced HTTP KV client (`httpKV`) backed by `/api/data?mode=disk` with optional auth/custom request headers, per-session `modeOptions.disk.basePath` routing (`buildDataUrl`, `normalizeDataDir`, `formatDataDirLabel`, switchable root `data` router with immutable `defaultRoot`, cached `withBasePath`/`setBasePath`, `root`, `namespace()`, civil-memory `#`-delimited `hashNamespace()` with `/` path hierarchy and `.` segment encoding, and idempotent `delete()` treating 404 as success), browser filesystem API helpers (`fetchFsRoots`, `fetchFsList`, `createFsDir`), remote deployment API helpers (`testRemoteCivilMemory`, `syncLaneToRemoteCivilMemory`, `proxyDeployRequest`, `startDeployTerminalSession`, `killDeployTerminalSession`), and live agent SSE subscription (`subscribeAgentEvents`).
- [agent-api.mjs](agent-api.mjs) — Agent & MCP orchestration module powering `/api/agent/*` (`sessions`, `session`, `lane`, `lane/configure`, `lane/eval`, `lane/script`, `lane/table`, `lane/input`, `deployments`, `notify`, and SSE `events`) and `/api/mcp` (JSON-RPC 2.0 MCP tools `cc_list_sessions`, `cc_get_session`, `cc_get_lane`, `cc_eval_lane`, `cc_create_lane`, `cc_update_script`, `cc_mutate_table`, `cc_list_deployments`, and `civil://sessions` resources).
- [mcp.mjs](mcp.mjs) — Zero-dependency stdio MCP server (`startMcpStdioServer`) wrapping [agent-api.mjs](agent-api.mjs) for MCP-native harnesses.
- [cc](cc) — Fast operator & agent CLI (`./cc sessions`, `./cc session`, `./cc lanes`, `./cc lane`, `./cc eval`, `./cc create-lane`, `./cc configure-lane`, `./cc set-line`, `./cc append-line`, `./cc insert-line`, `./cc delete-line`, `./cc replace-script`, `./cc set-input`, `./cc delete-input`, `./cc create-table`, `./cc add-row`, `./cc update-row`, `./cc delete-row`, `./cc deployments --ping`, `./cc mcp`) with automatic live browser reload notifications and remote-host support via `--host` / `--url` plus Basic, Bearer, or custom headers.
- [agent-remote.mjs](agent-remote.mjs) — Shared remote-host option resolution for `cc` and the stdio MCP server: CLI/env precedence, URL-embedded credentials, Basic/Bearer header construction, and custom `--header` values.
- [fs-api.mjs](fs-api.mjs) — Server-side filesystem discovery & folder management module powering `/api/fs/roots` (`listDisks`, `parseProcMounts`, `unescapeMountPath`), `/api/fs/list` (`listDirectories`, `buildBreadcrumbs`, including hidden dotfolders and `~` expansion), and `/api/fs/mkdir` (`createDirectory`).
- [lane-http.mjs](lane-http.mjs) — Shared HTTP API runtime & mock simulator for deployed and local lanes (`buildRequestObject`, `resolveRequestIp`, `createResponseHelper`, `detectLaneHandlers`, `extractLastLaneValue`, `normalizeHttpResult`, `executeLaneHttpRequest`, `simulateLaneRequest`).
- [lane-server.mjs](lane-server.mjs) — Zero-dependency standalone deployed lane HTTP microservice (`createLaneHttpServer`, `formatRequestLogLine`, `resolveRequestIp`, `normalizeCivilMemoryBaseUrl`, `/_cc/health`, `/_cc/reload`) backed by `civil-memory` (`mode=disk&modeOptions.disk.basePath`) with hybrid handler registration + fallback GET expression evaluation, realtime per-request stdout/journal logging (`[civil-lane:<slug>] <METHOD> <path> -> <status> (<ms>ms) ip=<ip>`), and optional `includeImports`.
- [pty-terminal.mjs](pty-terminal.mjs) — Pure Node.js RFC 6455 WebSocket upgrade/framing (`acceptWebSocket`, `encodeWsFrame`, `parseWsFrames`) and Python 3 `pty.fork()` bridge (`spawnPty`, `createTerminalManager`) for interactive SSH sessions.
- [deploy-api.mjs](deploy-api.mjs) — Remote SSH/systemd/Nginx/`civil-memory` deployment orchestration API powering `/api/deploy/*` and `/api/deploy/terminal/ws` (`validateSshTarget`, `shellQuote`, `generateInstallCivilMemoryScript`, `generateDeployScript`, `generateUndeployScript`, `generateServiceActionScript`, `generateLocalControlMasterRunner`, `handleDeployApiRequest`, `handleDeployUpgrade`).
- [terminal-ui.mjs](terminal-ui.mjs) — Zero-dependency browser ANSI/VT terminal emulator (`createTerminalBuffer`, `encodeKeyEventToVt`, `extractSentinelEvents`, `NEW_LOG_HIGHLIGHT_HOLD_MS`, `NEW_LOG_HIGHLIGHT_FADE_MS`, `NEW_LOG_HIGHLIGHT_TOTAL_MS`, `computeNewLogHighlightAlpha`, `formatNewLogHighlightBg`, `mountTerminalView`, including live new-log background highlighting after `__CC_LOGS_FOLLOW__` that holds for 30s and linearly fades out over the following 30s).
- [storage.mjs](storage.mjs) — Split KV persistence layer (`<= 1024` UTF-8 bytes per key with transparent `.chunks/<n>` auto-chunking and `-index`/`-pages/<n>` paged ID indexes) structuring tables (`lanes#<laneId>/tables/<tableId>/schema` & `rows/<rowId>`), parseable-guaranteed per-line Source scripts (`lanes#<laneId>/script/<lineId>` validated via `validateFieldScriptLine` / `validateFieldScriptLines` before any KV write, with modification timestamps, Civil-Command-only `setBy` export-origin metadata via `normalizeLineSetBy` and `clearTargetLaneLineSetBy` excluded from deployment bundles and baselines, and `localStorage` rejected-draft helpers `LANE_SOURCE_DRAFTS_STORAGE_PREFIX`, `laneSourceDraftsStorageKey`, `loadLaneSourceDrafts`, `listLaneSourceDrafts`, `saveLaneSourceDraft`, `clearLaneSourceDraft`, `clearAllLaneSourceDrafts`), versioned Sessions with two-tier KV routing (`defaultRoot` registry + per-session `basePath` workspace KV, permanent `dataDir` / `dataDirConfirmed` tracking, `setSessionDataDir`, saved open `laneIds`, session-persisted `tableDisplayOptions` via `normalizeSessionTableDisplayOptions` and `sessionTableDisplayOptionsEqual`, `forkSession`, `saveSessionVersion`, `createNewSession`, chronological `readSessionHistory` / `formatSessionDuration`, and two-level `localStorage`/`sessionStorage` support `sessions#<sessionId>/...`), Packages (`packages#<packageId>/...` with salted SHA-256 passphrases, `"Default"` package, and `packages#<packageId>/sessions` reverse index), SSH server profiles, lane deployment records (supporting multiple known deployments per lane via `buildDeploymentId` and `loadLaneDeployments`), `civil-memory` sync bundling (`loadDeployServers`, `saveDeployServer`, `deleteDeployServer`, `loadDeployments`, `loadLaneDeployments`, `loadLaneDeployment`, `saveLaneDeployment`, `deleteLaneDeployment`, `saveDeployedLaneScript`, `loadDeployedLaneScript`, `diffLaneScripts`, `getLaneDeployStatus`, `setTargetLaneLine`, `clearTargetLaneLineSetBy`, `allocateNextPort`, `collectLaneSyncBundle`, `writeLaneSyncBundleToKv`), and agent session/lane inspection helpers (`formatAgentContext`, `formatAgentPrompt`, `inspectSessionForAgent`).
- [story.mjs](story.mjs) — Per-lane Story history engine persisting immutable run snapshots under `stories#<laneId>/...` with a 4-tier hierarchical time index (`idx/root`, `idx/y/<YYYY>`, `idx/m/<YYYY-MM>`, `idx/d/<YYYY-MM-DD>`), compact run cards (`r/<YYYY-MM-DD>/<runId>` with inline detail when `<= 940` bytes and split `d/<YYYY-MM-DD>/<runId>/io` & `out` keys otherwise), input/import/export/output/final-value snapshotting with secret redaction (`captureStoryEnvInputs`, `createStoryRunRecorder`, `trackStoryImportCall`, `trackStoryExportLineCall`, `trackStoryExportTableCall`, `buildStoryRunSnapshot`, `appendLaneStory`, `recordLaneStoryFromRun`), paginated cursor & range querying (`queryLaneStories`, `loadLaneStoryDetail`), and timezone-aware timeline bucket classification (`classifyStoryHeading`, `formatStoryEntryTime`, `loadLaneStoryBuckets`).
- [start](start) — Node HTTP & WebSocket server on `:8080` (handles `/api/fs/*` via [fs-api.mjs](fs-api.mjs), `/api/deploy/*` + `/api/deploy/terminal/ws` via [deploy-api.mjs](deploy-api.mjs), `/api/agent/*` + `/api/mcp` via [agent-api.mjs](agent-api.mjs), proxies `/api/data` to `localhost:3333`, serves `.webmanifest`/`.ico`/`.fs` with proper MIME types and `no-cache` for `sw.js`, SPA fallback to `index.html`).
- [scripts/service--install](scripts/service--install), [scripts/service--start](scripts/service--start), [scripts/service--restart](scripts/service--restart), [scripts/service--stop](scripts/service--stop), & [scripts/service--logs](scripts/service--logs) — User-level systemd service installer (with `loginctl enable-linger` boot auto-start and `civil-memory.service` ordering), lifecycle controls, and live journald log tailing.
- [src/main.fs](src/main.fs) — App bootstrap, DOM skeleton (including mounting the left-column Session & Packages summary card below `+ Lane` / `Open`), and event wiring.
- [src/lane-control.fs](src/lane-control.fs) — Lane management module (`mount`, `mount-locked`, `add`, `open`, `open-after`, `move-lane-after`, `scroll-lane-into-view`, `locate-lane`, `locate`, `highlight-lane`, `clear-lane-highlight`, `reload`, `close`, `rename`, `minimize`, `restore`, `enter-lane-fullscreen`, `exit-lane-fullscreen`, `toggle-lane-fullscreen`, `set-width`, `apply-lane-width`, `attach-lane-resizer`, `remember-path`, `set-path`, `configure`, `clear`, `sync`, `init`, `update-url`, per-lane modal mounting and minimum-dimension expansion for normal, fullscreen, and pinned/floating lane frames `resolve-lane`, `get-lane-modal-host`, `recompute-lane-modal-bounds`, `mount-lane-modal`, `unmount-lane-modal`, `close-lane-modals`, session & package management with structural draft versioning, mandatory permanent `dataDir` selection/confirmation flows, and URL-redirecting session switches `init-session`, `ensure-session`, `prompt-new-session`, `confirm-session-data-dir`, `new-session`, `switch-session`, `save-session-draft`, `fork-session`, `abandon-session-draft`, `recompute-session-dirty`, `begin-session-status-pending`, `end-session-status-pending`, `is-session-navigation-blocked`, `mount-workspace-summary`, `sync-workspace-summary`, `format-agent-context`, `format-agent-prompt`, `copy-agent-context`, `new-tab-session`, `switch-tab-session`, `return-to-browser-session`, `promote-tab-session`, `switch-browser-session`, `rename-session`, `create-package`, `open-package`, `close-package`, `set-active-package`, `move-lane-package`, package-scoped catalog `load-catalog`, `register`, `list-known`, shared `lane-modal`, `confirm-modal`, `row-picker-modal`, `session-modal`, `package-modal`, `dir-modal`, `line-info-modal`, `rails`, global system-wide preferences lane, top-rail chip sync & timezone clock management `load-preferences-lane`, `load-clock-timezone`, `set-clock-timezone`, `set-clock-hour-format`, `set-clock-show-seconds`, `get-clock-display-options`, `refresh-clock-displays`, `get-preferences-timezones`, `sync-preferences-timezones`, `refresh-preferences-from-storage`, `open-preferences-timezones-view`, `set-preferences-lane`, `create-preferences-lane`, `open-preferences-lane`, `apply-preferences`, `run-preferences-lane-now`, `find-preferences-chip-row`, `get-top-rail-chip-row`, `sync-top-rail-chip`, plus access-controlled cross-lane idle state coordination `get-lane-final-state`, `notify-lane-idle`, `pick-import`, `pick-lane`, `refresh-lane-labels`).
- [src/lane-dir-modal.fs](src/lane-dir-modal.fs) — Real computer directory picker modal (`open-create`, `open-confirm`) backed by `/api/fs/*` for browsing computer folders, attached disks/locations, hidden dotfolders, and creating subfolders to permanently bind a session's `dataDir` or explicitly confirm `Default`.
- [src/lane-rails.fs](src/lane-rails.fs) — Always-open fixed left and right side rails (`32px`, `#383838`, always on top of workspace and modals) hosting `26px` single-initial buttons for minimized lanes with a floating live hover preview, click-to-pin/unpin interactive popover lane mode, and a floating restore arrow button anchored directly beside the rail button over the popover area (to the right of left-rail buttons and to the left of right-rail buttons, enabling instantly on rail-button hover, fading out between 25s and 30s, hiding completely at 30s, and re-enabling instantly whenever hovering the original rail button), plus an always-open fixed `16px` top rail (`#383838`, centered `12px` icon buttons with 1px border for toggling root `<html>` fullscreen with an inverting 4-corners SVG icon, opening the `lane-modal.fs` Open Lane dialog via a search icon, opening a dedicated Sessions dropdown with active directory badge, unsaved-draft indicator, Save/Fork/Abandon chips, 1-click switcher showing session directories, History link, and `Copy session info for agent`, opening a dedicated Packages dropdown with the stacked-layers icon for included packages and Package Page access, opening the `lane-servers-modal.fs` Servers & Deployments dialog, and opening a wrench Preferences dropdown to view/open/set/create the global preferences lane, followed by `interface.rails.top.elements` chips that open an anchored popover dropdown on click showing `<$chip.title>`, `Last synced: <date and time>` (formatted using the active timezone with short zone label and `12h` / `24h` clock hour format preference), `Sync now` for immediate per-chip refresh, and `Copy` to copy the chip row as JSON, and finally a live clock chip on the far right of all chips that opens a popover with `12h` / `24h` and `Show seconds` toggles above `Filter timezones…` and a searchable, selectable timezone list backed by `preferences.timezones`, allowing only Browser timezone and `UTC` when none are configured; all top-rail items — built-in icons, `interface.rails.top.elements` chips, and the live clock — honor `interface.rails.top.order` and `interface.rails.top.hidden` via `set-top-layout` / `apply-top-layout`).
- [src/lane-notebook.fs](src/lane-notebook.fs) — Per-lane tabbed notebook UI (`Story`, `Source`, `Input`, `Scope`, `Data`, `View`, `Server`), numbered code lines (with clickable line numbers for individual line edit mode via a vertically resizable auto-sized `<textarea>`, automatic `<textarea>` rendering + height-matched output scaling for multiline lines, live FieldScript syntax gating that blocks unparseable lines from saving to KV while storing rejected drafts in `localStorage` and rendering inline `.lane-line-draft` recovery bars with `Edit draft` and `Discard`, a hover info button opening `lane-line-info-modal.fs` with line ID, modification timestamp, and optional `Set By` origin link, and a Civil-Command-only `← Set by <Lane> · L<num> ↗` button on lines overwritten by another lane's export that restores/opens the source lane and highlights the setting line via `navigate-to-lane-line` and `highlight-line`), cross-lane import picker lines (`+` / `+ Import` / `×` / `Enter`), and cross-lane export lines (`+ Export`, with `↗` and clickable status pills to navigate to and highlight target lines), live top-to-bottom JSON previews, idle tracking (`when-idle`, `is-running`, `has-run`), split per-line KV persistence via [storage.mjs](storage.mjs) (with instant migration from legacy `script`), URL & remembered per-lane path routing (`/<id>` for home `Source`, `/<id>;<tab>` for `Story`/`Input`/`Scope`/`Data`/`View`/`Server`), run gating (runs Source on `Source`, `Scope`, `View`, and `Server`, skips on `Story`, `Input`, and `Data`), and mounting `lane-output.fs` below the lane (`View` hides notebook panels and shows only the output browser, while `Story` suppresses inline output).
- [src/lane-story.fs](src/lane-story.fs) — Per-lane `Story` tab timeline UI displaying timezone-aware chronological run history (`Today`, `Yesterday`, `<Month> <Ordinal>`, `Last year`, `Archives`) with lazy detail expansion (Inputs, Imported from lanes, Exported to lanes, Final Value, Source Run Output), bucket/date-range `Jump to...` popover, `↑ Latest` reset, infinite cursor scroll pagination (`Load older runs`), and live append/dirty refresh on new runs.
- [src/lane-line-info-modal.fs](src/lane-line-info-modal.fs) — Modal dialog opened by each Source line's hover info button showing line number, line ID, formatted modification timestamp + ISO string (or `"Unknown"` for migrated/untracked lines), optional clickable `Set By` origin link when set by another lane's export, and a `Copy Info` button for copying line-level agent context.
- [src/lane-session-modal.fs](src/lane-session-modal.fs) — Dedicated Sessions modal (`open-switch-session` Session Switcher & Manager displaying each session's permanent data directory, `Copy Info` for agent context, and collapsible Advanced Tab vs. Browser controls, and full-screen `open-history` Session History Page showing chronological activation times, chosen directories, and 1-click switching).
- [src/lane-package-modal.fs](src/lane-package-modal.fs) — Dedicated Packages modal (`open-create-package`, `open-unlock-package`, and full-screen `open-packages` Package Page listing all sessions with each package open + package lanes).
- [src/lane-output.fs](src/lane-output.fs) — Per-lane mini "browser" window mounted below the lane (titled with the lane's title in both the internal mock browser bar and floating window); appears when a lane emits `send` packets or when the `View` tab is active (with an empty-state placeholder if no scripts are sent yet), deserializes and runs all transported scripts in FieldScript in browser context (`document`, `window`, `Intl`, `output`, and self-scoped `extraEnv` helpers `syncTable`, `readTable`, `setSelfLine`, `getSelfLines`, `getSelfMeta`, `setSelfFeatures`, `openLaneTab`, `getClockTimezone`, `setClockTimezone`, `getClockHourFormat`, `setClockHourFormat`, `getClockShowSeconds`, and `setClockShowSeconds` for persisting updates to the lane's own Data tables, Source lines, features, and active preferences without tearing down the live `View` DOM), appends returned DOM elements to its viewport, displays browser errors, provides a `↻` reload button, and includes a popout icon button to the right of reload that floats the output app in a new window (updating live on refresh, displaying a top-right pop-in button with no extra header chrome in the floating window, and showing an `"Attach output window"` button in the lane while floating to recall it home).
- [src/lane-inputs.fs](src/lane-inputs.fs) — Per-lane `Input` tab table of assumed primitive scope variables (`string`, `number`, `boolean`, `null`, `undefined`, and set-once `secret` inputs encrypted on disk with AES-256-GCM via `setLaneSecret` / `resolveLaneSecret` / `deleteLaneSecret` that cannot be revealed in the UI, line previews, or `Scope` browser) persisted under `inputs` and seeded into lane execution scope.
- [src/lane-scope.fs](src/lane-scope.fs) — Per-lane `Scope` tab multi-column Miller-column browser of everything reachable via `get` in the final total scope (also embedded inside the cross-lane import picker), featuring FieldScript type previews (`object`, `list{N}`, `will` with leading doc comments, `map{N}`, `set{N}`, `bytes{N}`, `promise`, `error`, `fn`), a live name filter bar with match counts and `Enter`/`Esc` keyboard shortcuts, a `proto` toggle for inherited prototype properties, and a one-click `Copy` `$path` button.
- [src/lane-data.fs](src/lane-data.fs) — Per-lane `Data` tab for defining multiple structured tables with typed columns (`integer`, `decimal`, `fixed` with configurable decimal places defaulting to 2 that edits as `xxx.xx` and stores scaled integers `xxxxx`, `text` with optional `Workflow` constraint configured via `+ constraint` mapping a lane table's `From`/`To` transition columns and rendering state-driven dropdowns with red error highlighting for invalid values, `boolean`, `date` with dimmed unset `mm/dd/yyyy` state, `datetime` formatted and edited in the active selected timezone with short zone label and `12h`/`24h` preference plus a native calendar picker button, `url`, `email`, `json`, `row` linked to a lane table's link column, optional display column, and optional `Filter` below `Display` (`Filter where <linked.column> is|contains <this.column>`, using `contains` when the linked filter column is `multiple` `[]`, with two side-by-side dropdowns that filter `lane-row-picker-modal.fs` options by the current row's value and highlight out-of-filter selections with a red `(invalid)` error state), with `"Select <column name>…"` blank placeholder without looking up blank identifiers, and `lane` storing a selected lane ID picked via the full-screen `lane-modal.fs` picker, each optionally multiple `[]` with full-width resizable item chips, a filter input above the chips to search matches, batch multiselect `Apply` / `Cancel` modals when clicking `+` on any selectable `multiple` column (`lane[]`, `row[]`, or `text(workflow)[]`), and a table cell max-height that scrolls after ~10 items tall, and optionally `Required` `*` with red highlighting on required cells missing a value), a table display options row right above the table header for toggling show/hide of inbound subtables in the same lane that reference the active table (persisted on the session as `tableDisplayOptions`, marking the session unsaved when toggled, adding a left indent column to the left of the `#` row number column without disturbing row numbers, positioning each group's expand/collapse caret under the parent `#` row number column, and hiding the redundant linking column in the indented subtable view), editing typed rows inline (opening `lane-row-picker-modal.fs` on edit for `row` cells while joining display labels on render, and splitting selected `lane` cells into an ID chooser button and an open-to-right button with an up-and-to-the-right arrow icon that opens/moves the target lane immediately after the current lane), housing table-level destructive actions (`Clear rows` and `Delete table`) inside a vertically centered `⋯` table actions menu button that opens `confirm-modal.fs` with mandatory explicit checkbox agreement before enabling the destructive red action button, persisting schemas and individual rows as separate split KV keys via [storage.mjs](storage.mjs) (with instant migration from legacy `tables` and syncing remembered `data/<tablename>` lane path), seeding named tables into lane scope, and confirming all destructive actions via `confirm-modal.fs`.
- [src/lane-row-picker-modal.fs](src/lane-row-picker-modal.fs) — Searchable, async paginated modal picker opened when editing a `row` cell (or `row[]` / `text(workflow)[]` multiselect cell with `Selected (N)` chips, toggleable options, and `Cancel` / `Apply`); renders a collapsible blank `+ Add` row option at the top of the list that expands in place into a full new-row editor for the linked table (including inline multiselect `Apply` / `Cancel` for nested selectable `[]` columns, only saving when `Save` is pressed, which persists the new row and selects it or adds it to the multiselect draft), loads options page-by-page only on edit/scroll/load-more, and scans ahead on demand only when filtering requires more matches.
- [src/confirm-modal.fs](src/confirm-modal.fs) — Reusable confirmation modal dialog for destructive actions (column/table/row/item deletion, clear rows, and lossy schema type/multiplicity changes), supporting mandatory explicit agreement checkboxes (`require-agreement` / `agreement-label`) that keep the final destructive red confirm button disabled until checked.
- [src/lane-import-modal.fs](src/lane-import-modal.fs) — Modal picker for cross-lane import lines; selects another lane, waits until idle, supports importing the entire lane (`Whole lane`, empty path) or browsing its final state via embedded `lane-scope.fs` to pick a specific value, and assigns the default or custom variable name.
- [src/lane-export-modal.fs](src/lane-export-modal.fs) — Modal picker for cross-lane Export to Lane lines (`+ Export`, `exportLaneLine` / `setLaneLine`); selects one or more target `{ laneId, lineId }` lines across accessible lanes and specifies a FieldScript expression whose evaluated output overwrites those target lines.
- [src/lane-export-deploy-modal.fs](src/lane-export-deploy-modal.fs) — Multi-lane deployment modal opened from Export to Lane Source lines' `Deploy` button; previews diffs against cached deployed scripts (`diffLaneScripts`) and streams sequential deployments via `/api/deploy/terminal/start` and [terminal-ui.mjs](terminal-ui.mjs).
- [src/lane-modal.fs](src/lane-modal.fs) — Full-screen modal for browsing and filtering accessible lanes across the active session's open packages (with package filter pills, `+ Package` / `Open Pkg` shortcuts, and per-lane package badges), supporting Open/Close/Locate management (`open`, with a green `Locate` button to the right of `Close` on already-open lanes that floats and pins minimized sidebar lanes or scrolls to and highlights main-area lanes), single lane selection (`open-picker`), and multiselect lane editing with `Selected (N)` chips and `Cancel` / `Apply` (`open-picker` with `multiple: true`).
- [src/lane-config-modal.fs](src/lane-config-modal.fs) — Modal dialog opened by each lane's SVG gear button for configuring lane settings (Title, Width in px with auto-width Reset, remembered Path with default-view Reset, Package selector, Features including `HTTP Server`, and `Copy Info` for agent context, plus Cancel / Save changes).
- [src/lane-server.fs](src/lane-server.fs) — Per-lane `Server` tab view (enabled via Configure Lane -> Features -> `HTTP Server`) providing Mock & Live HTTP request testing (with a `Deployment` dropdown disabled in `Mock (Local)` mode and enabled in `Live (Deployed)` mode to choose among known deployments), a `Deployments` table between HTTP Request Tester and Remote Deployment (with a `Test` button that executes `GET /` via the HTTP Request Tester to display full response details while showing `Pass`/`Fail` in the cell, and a row `×` button that confirms removal via `confirm-modal.fs`), mandatory `civil-memory` verification/install & lane sync gating, and Nginx/systemd/Let's Encrypt remote deployment controls.
- [src/lane-servers-modal.fs](src/lane-servers-modal.fs) — Full-screen **Servers & Deployments** manager modal opened from the top-rail server icon (SSH target profiles, interactive shell, `civil-memory` setup, and deployed service registry).
- [src/lane-terminal-modal.fs](src/lane-terminal-modal.fs) — Interactive SSH PTY terminal modal powered by [terminal-ui.mjs](terminal-ui.mjs) (with `Ctrl+C`, `Copy Log`, `Clear`, `Kill`, and `Close` controls) for viewing live server logs and answering SSH, `sudo`, and `certbot` prompts live in the browser.

## Code Style & Testing

- **No absolute filesystem paths in committed files**: never write machine-specific paths (e.g., `/home/...`, `file:///...`) in `AGENTS.md`, docs, code, or tests — always use repo-relative paths (`.well-known/` is excluded from git for local machine-specific files).
- JavaScript (`.mjs`): 1-space indentation, no semicolons, native ESM.
- FieldScript (`.fs`): 1-space indentation for nested blocks; keep spaces inside delimiters (`{ a }`, `[ cmd ]`, `( ... )`) for readability.
- Run tests with a 512 MB V8 heap cap:
  ```bash
  ./test
  # single suite: ./test field.rails.test.mjs
  # or: node --max-old-space-size=512 --test --test-concurrency=4 field.test.mjs field.*.test.mjs
  ```

---

## Agent Guide: Inspecting & Mutating Live Sessions & Lanes (`./cc`, `/api/agent/*`, & MCP)

When a user asks you to inspect, evaluate, or modify a session or lane on the running app (`http://localhost:8080`), **use `./cc` (or `/api/agent/*` / `/api/mcp`) first** — it automatically handles Civil Command's two-tier KV routing (`defaultRoot` session registry → per-session `basePath` workspace KV), `<= 1024`-byte chunking, paged ID indexes, `fixed` decimal scaling, and broadcasts a live SSE reload event (`/api/agent/events`) so open browser tabs update immediately.

### 1. Fast CLI (`./cc`) — Preferred for Bash Agents

`./cc` accepts lane **titles** (e.g. `Inbox`, `Beacon`, `Ledger`) or lane **UUIDs**, and session **names** (e.g. `North`, `East`) or session **UUIDs** (defaulting to the most recently updated session if `--session` is omitted):

```bash
# List all sessions & their permanent data directories
./cc sessions

# Inspect a session (open packages, open lanes, catalog, and formatted agent context)
./cc session North

# Inspect a lane by title or ID (script lines with lineIds, tables with namedRows, and deploy diff status)
./cc lane Inbox --session East
./cc lane Ledger --session North

# Evaluate a lane headlessly (runs FieldScript with Data tables, inputs & cross-lane imports; returns per-line previews, final scope, logs, and optional HTTP simulation)
./cc eval Ledger --session North
./cc eval Beacon --session North --http-get /balance

# Edit a lane's Source script (preserves lineIds for !exportLaneLine and triggers live browser reload)
./cc set-line Inbox 1 "; to vin done" --session East
./cc append-line Inbox "; to priority 1" --session East
./cc insert-line Inbox 2 "-- note" --session East
./cc delete-line Inbox 2 --session East

# Mutate a lane's Data table by column name (automatically scales fixed decimals like "19.95" -> 1995)
./cc add-row Ledger accounts '{"name":"Savings","balance":"250.00","prepaid":"0.00"}' --session North
./cc update-row Ledger accounts <rowId> '{"balance":"300.00"}' --session North
./cc delete-row Ledger accounts <rowId> --session North

# Check all deployments, script diffs vs. deployed baseline, and ping live /_cc/health endpoints
./cc deployments --ping
```

Every command also works against a **remote host** (including `./cc mcp`):

```bash
export CC_USER='agent@example.com' CC_PASSWORD='secret'
./cc sessions --host https://civil.example.com
./cc lane 'Bench 1' --host https://civil.example.com --session Scratch
./cc eval 'Bench 1' --host https://civil.example.com --session Scratch
```

`--host` targets the origin's `/api/data`; pass `--url` for an explicit KV endpoint. Basic auth comes from `--user` / `--password` (or `CC_USER` / `CC_PASSWORD`), Bearer auth from `--token` / `CC_TOKEN`, and additional headers from repeatable `--header 'Name: value'`. Credentials may also be embedded as `https://user:pass@host`; they are stripped before the URL is used in requests or error messages.

### 2. Localhost HTTP API (`/api/agent/*`) & MCP (`/api/mcp` or `./cc mcp`)

- **HTTP Endpoints on `:8080`**:
  - `GET /api/agent/sessions`
  - `GET /api/agent/session?session=<idOrName>`
  - `GET /api/agent/lane?session=<idOrName>&lane=<idOrTitle>`
  - `POST /api/agent/lane` (`{ sessionId, title, lines, packageId }`)
  - `POST /api/agent/lane/configure` (`{ sessionId, laneId, title, width, path, minimized, features }`)
  - `POST /api/agent/lane/eval` (`{ sessionId, laneId, inputs, applyExports, httpRequest }`)
  - `POST /api/agent/lane/script` (`{ sessionId, laneId, action: 'set-line'|'append-line'|'insert-line'|'delete-line'|'replace-script', lineNumber, lineId, text, lines }`)
  - `POST /api/agent/lane/table` (`{ sessionId, laneId, action: 'create-table'|'delete-table'|'add-column'|'add-row'|'upsert-row'|'update-row'|'delete-row'|'clear-rows', table, rowId, values, columns }`)
  - `GET /api/agent/deployments?ping=true`
  - `GET /api/agent/events` (SSE stream emitting `lane-updated` / `lane-created` events to live-reload mounted lanes in the browser)
- **MCP Server**:
  - **Stdio**: `./cc mcp` or `node mcp.mjs`
  - **Streamable HTTP JSON-RPC 2.0**: `POST http://localhost:8080/api/mcp`
  - **Tools**: `cc_list_sessions`, `cc_get_session`, `cc_get_lane`, `cc_eval_lane`, `cc_create_lane`, `cc_update_script`, `cc_mutate_table`, `cc_list_deployments`.

### 3. User "Copy Info" Shortcuts in the UI

Users can copy a ready-to-paste `Read @AGENTS.md and use ./cc to inspect my workspace:` prompt wrapping the `Civil Command Agent Context` block (with Session-level, Lane-level, or Line-level context patterns) and a trailing `Task: ` prompt line with one click from:
- Any Source line's hover info (**Line Info**) modal → **`Copy Info`** button (Line level: `Session`, `Data Directory (basePath)`, `Open Packages`, `Lane`, `Lane Package`, `Lane Path`, `Line`, `Line ID`, `Line Source`, `Line Modified`, optional `Line Set By`, and `Route`)
- Any lane header's top-right primary button group → icon-only **Copy lane info** button (left of the minimize buttons) (Lane level: `Session`, `Data Directory (basePath)`, `Open Packages`, `Lane`, `Lane Package`, `Lane Path`, and `Route`)
- Any lane's gear (**Configure Lane**) modal → **`Copy Info`** button (Lane level)
- Left workspace **Session** card → **`Copy Info`** button (Session level: `Session`, `Data Directory (basePath)`, `Open Packages`, `Open Lanes`, and `Route`)
- **Sessions** modal (`Open / switch session…`) → **`Copy Info`** button next to Current Session (Session level)
- Top rail **Sessions** dropdown → **`Copy session info for agent`** (Session level)

### 4. Best Practice: Use Many Small Source Lines (Not One Giant Line)

When writing or updating a lane's `Source` script (including complex data pipelines or interactive `; send ( ... )` `View` UIs):
- **Keep each Source line small (`<= ~850–900` bytes of text)** instead of packing a large block into one giant multiline line. Each Source line record (`{ id, text, updatedAt }`) is persisted under `lanes#<laneId>/script/<lineId>` with a `<= 1024` UTF-8 byte per-key limit; keeping lines small avoids multi-key `.chunks/<n>` splitting, speeds up `./cc` updates, and keeps the notebook UI clean and readable.
- **Pre-compute serializable data across small Source lines**: break data indexing, lookup maps, sorted lists, and stats into separate small lines. Any serializable variables in lane scope are automatically snapshotted into `bindings` when `; send ( ... )` is called.
- **Split large `View` UIs across many small `; send ( ... )` lines**: `runTransportedScripts` executes sent packets sequentially against a shared `browserState` object (persisting top-level browser variables like `; to gh ; object` and modular methods like `; to gh.makeBadge ( ... )` or `; to gh.renderHeader ( ... )` across subsequent `; send ( ... )` lines) and appends any packet's returned DOM element to `output`.

### 5. Parseable-Only Lane Source Guarantee & `localStorage` Rejected Drafts

All saved Lane Source code across Civil Command is **guaranteed to be parseable FieldScript** without syntax errors:
- **Strict parse & AST syntax validation ([field.mjs](field.mjs))**: `parse()` and `validateFieldScriptLine()` / `validateFieldScriptLines()` reject any line with unterminated `'...'` strings, unclosed or mismatched `{}` / `[]` / `()` blocks, empty `!` / `;` / `:` / `[]` blocks, invalid command names in `; <cmd>` or `[ <cmd> ... ]` (e.g. writing `; console.log 'hi'` instead of `!console.log 'hi'`, even inside deferred `( ... )` or `; send ( ... )` blocks), missing required command arguments (e.g. incomplete `; to x` or `; set 1`), or non-trailing `...rest` destructuring patterns.
- **Each Source line must parse as a complete unit**: because `runLines` parses each Source line independently (`parse(\`${source}\n\`)`), never split an opening `(`, `[`, `{`, or `'...'` across two separate Source rows — keep multiline blocks self-contained within a single Source line (or break logic into separate complete small lines).
- **Enforced at every persistence boundary ([storage.mjs](storage.mjs), [agent-api.mjs](agent-api.mjs), [cc](cc))**: `saveScriptLine`, `saveScriptLinesAndIndex`, `saveLaneScript`, `setTargetLaneLine` (including cross-lane `!exportLaneLine` / `!setLaneLine`), `./cc` (`create-lane`, `set-line`, `append-line`, `insert-line`), `/api/agent/lane*`, and MCP tools (`cc_create_lane`, `cc_update_script`) reject unparseable FieldScript with `syntaxError: true` and exact line/column error details before writing anything to KV.
- **Rejected unsaved drafts in `localStorage` ([src/lane-notebook.fs](src/lane-notebook.fs))**: when a user edits a Source line (or triggers a browser cross-lane export) with a FieldScript syntax error, KV retains the last valid parseable line while the rejected draft is stored in `localStorage` under `civil-command.source-drafts[:<dataDir>]:<laneId>`. When reopening or reloading the lane later, the valid saved script executes cleanly while an inline `.lane-line-draft` banner displays the rejected draft with **`Edit draft`** (loads the draft into the line editor to fix and save) and **`Discard`** (removes the draft from `localStorage`). Fixing the syntax error automatically saves the line to KV and clears the draft.

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
- **`!` invokes methods/functions only; it never assigns properties.** Use `set` (value-first) or `to` (target-first) for DOM, style, and state property writes:
  ```fs
  ; set 'Bench: alpha-beta-gamma' card.textContent
  ; set left element.style.textAlign
  ; to scope.lanes {}
  ```
  `!card.textContent '…'` compiles to `invoke` and fails at runtime with `… is not a function` because `textContent` is a string property, not a method. Headless `eval` queues `send` packets without executing them, so this mistake only surfaces when the packet runs in the browser `View` output.
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
- `object [{ key value } | key ...]`
  - Returns a fresh `{}` populated from `{ key value }` pair lists and/or bare `key` shorthand tokens (`object a b c` is shorthand for `object { a $a } { b $b } { c $c }`):
    ```fs
    ; to scope ; object { lanes {} } { lane-ids {} } { by-id ; object }
    ; to summary ; object balance debt state
    ```
  - Throws `TypeError` for invalid arguments.
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
