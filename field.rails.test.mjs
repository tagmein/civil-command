import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {
 DATA_RUNTIME_ENV,
 DEFAULT_SCROLLBAR_COLOR,
 LANE_MINIMIZE_SIDES,
 PRIMITIVE_TYPES,
 appendLaneStory,
 buildTopRailTimezoneOptions,
 createIdleTracker,
 defaultValueForType,
 dirModalSource,
 exportDeployModalSource,
 exportModalSource,
 extractTimezoneNames,
 field,
 filterTimezoneOptions,
 formatAgentContext,
 formatAgentPrompt,
 formatCellInputValue,
 formatDatetimeLocalInTimeZone,
 formatDatetimePlaceholder,
 formatImportLine,
 formatLineTimestamp,
 formatStoryEntryTime,
 formatTopRailClock,
 getBrowserTimeZone,
 getLaneInitial,
 hasImportCycle,
 isValidTimeZone,
 laneServerSource,
 laneServersModalSource,
 laneStorySource,
 laneTerminalModalSource,
 lineInfoModalSource,
 listKnownBrowserTimeZones,
 normalizeClockHourFormat,
 normalizeClockShowSeconds,
 normalizeLaneMinimizeSide,
 normalizePrimitiveType,
 normalizeTopRailHidden,
 normalizeTopRailOrder,
 packageModalSource,
 parse,
 parseCellValue,
 parseDatetimeInTimeZone,
 parseImportLine,
 resolveActiveClockTimezone,
 resolveImportValue,
 resolveScopeColumns,
 resolveScrollbarColor,
 resolveTopRailElementId,
 resolveTopRailLayout,
 TOP_RAIL_BUILTIN_IDS,
 runLines,
 runTransportedScripts,
 saveLaneScript,
 seedPreferencesScrollbarRecords,
 seedPreferencesScrollbarSource,
 sessionModalSource,
 zonedWallClockToUtcMs,
} from './field.fixtures.mjs'

test('Fixed left and right side rails: styles, chevron minimize buttons, 26px initial icons, non-interactive hover preview, vertical placeholder, and in-place restore', async () => {
 // 1. Unit checks for side rail helpers
 assert.deepEqual(LANE_MINIMIZE_SIDES, ['left', 'right'])
 assert.equal(normalizeLaneMinimizeSide('left'), 'left')
 assert.equal(normalizeLaneMinimizeSide(' RIGHT '), 'right')
 assert.equal(normalizeLaneMinimizeSide('center'), null)
 assert.equal(normalizeLaneMinimizeSide(''), null)
 assert.equal(normalizeLaneMinimizeSide(null), null)

 assert.equal(getLaneInitial('Alpha'), 'A')
 assert.equal(getLaneInitial('  beta lane'), 'B')
 assert.equal(getLaneInitial('🚀 Rocket'), '🚀')
 assert.equal(getLaneInitial('', 'lane-9'), 'L')
 assert.equal(getLaneInitial('   ', ''), '?')

 // 2. Verify CSS rules in index.html and sw.js precache
 const indexHtml = await fs.readFile(new URL('./index.html', import.meta.url), 'utf8')
 const swSource = await fs.readFile(new URL('./sw.js', import.meta.url), 'utf8')
 assert.match(swSource, /'\/src\/lane-rails\.fs'/)
 assert.match(indexHtml, /body\s*\{[^}]*margin-right:\s*64px;[^}]*margin-left:\s*64px;/s)
 assert.match(indexHtml, /\.side-rail\s*\{[^}]*background-color:\s*#383838;[^}]*bottom:\s*0;[^}]*box-sizing:\s*border-box;[^}]*position:\s*fixed;[^}]*top:\s*0;[^}]*width:\s*32px;[^}]*z-index:\s*2000;/s)
 assert.match(indexHtml, /\.side-rail--left\s*\{[^}]*border-right:\s*1px solid [^;]+;[^}]*left:\s*0;/s)
 assert.match(indexHtml, /\.side-rail--right\s*\{[^}]*border-left:\s*1px solid [^;]+;[^}]*right:\s*0;/s)
 assert.match(indexHtml, /\.side-rail-icon\s*\{[^}]*background:\s*#ffffff0e;[^}]*border:\s*1px solid #ffffff24;[^}]*box-sizing:\s*border-box;[^}]*height:\s*26px;[^}]*justify-content:\s*center;[^}]*width:\s*26px;/s)
 assert.match(indexHtml, /\.side-rail-icon--pinned[\s\S]*?background:\s*#9ce5ff24;[\s\S]*?border-color:\s*#9ce5ff88;/s)
 assert.match(indexHtml, /\.side-rail-preview\s*\{[^}]*pointer-events:\s*none;[^}]*position:\s*fixed;[^}]*user-select:\s*none;[^}]*z-index:\s*2100;/s)
 assert.match(indexHtml, /\.side-rail-preview--pinned\s*\{[^}]*overflow:\s*auto;[^}]*pointer-events:\s*auto;[^}]*user-select:\s*auto;/s)
 assert.match(indexHtml, /\.side-rail-restore\s*\{[^}]*height:\s*26px;[^}]*opacity:\s*1;[^}]*pointer-events:\s*auto;[^}]*position:\s*fixed;[^}]*transition:\s*none;[^}]*width:\s*26px;[^}]*z-index:\s*2120;/s)
 assert.match(indexHtml, /\.side-rail-restore--fading\s*\{[^}]*opacity:\s*0;[^}]*transition:\s*opacity 5s linear;/s)
 assert.match(indexHtml, /\.side-rail-restore--left\s*\{[^}]*left:\s*34px;/s)
 assert.match(indexHtml, /\.side-rail-restore--right\s*\{[^}]*right:\s*34px;/s)
 assert.match(indexHtml, /\.lane-minimized-title\s*\{[^}]*writing-mode:\s*vertical-rl;/s)

 // 3. Full integration test
 const mainSource = await fs.readFile(new URL('./src/main.fs', import.meta.url), 'utf8')
 const laneSource = await fs.readFile(new URL('./src/lane-control.fs', import.meta.url), 'utf8')
 const notebookSource = await fs.readFile(new URL('./src/lane-notebook.fs', import.meta.url), 'utf8')
 const inputsSource = await fs.readFile(new URL('./src/lane-inputs.fs', import.meta.url), 'utf8')
 const scopeSource = await fs.readFile(new URL('./src/lane-scope.fs', import.meta.url), 'utf8')
 const dataSource = await fs.readFile(new URL('./src/lane-data.fs', import.meta.url), 'utf8')
 const confirmModalSource = await fs.readFile(new URL('./src/confirm-modal.fs', import.meta.url), 'utf8')
 const rowPickerModalSource = await fs.readFile(new URL('./src/lane-row-picker-modal.fs', import.meta.url), 'utf8')
 const outputSource = await fs.readFile(new URL('./src/lane-output.fs', import.meta.url), 'utf8')
 const modalSource = await fs.readFile(new URL('./src/lane-modal.fs', import.meta.url), 'utf8')
 const configModalSource = await fs.readFile(new URL('./src/lane-config-modal.fs', import.meta.url), 'utf8')
 const importModalSource = await fs.readFile(new URL('./src/lane-import-modal.fs', import.meta.url), 'utf8')
 const railsSource = await fs.readFile(new URL('./src/lane-rails.fs', import.meta.url), 'utf8')

 function createMockElement(tag) {
  const styleProps = {}
  const el = {
   tag,
   nodeType: 1,
   style: {
    setProperty(name, value) { styleProps[name] = value; this[name] = value },
    removeProperty(name) { delete styleProps[name]; delete this[name] },
    getPropertyValue(name) { return styleProps[name] || '' },
   },
   attributes: {},
   children: [],
   parentNode: null,
   listeners: {},
   textContent: '',
   innerHTML: '',
   value: '',
   className: '',
   title: '',
   hidden: false,
   disabled: false,
   removed: false,
   rect: { top: 48, height: 300, width: 320 },
   getBoundingClientRect() { return this.rect },
   setAttribute(name, value) { this.attributes[name] = value },
   appendChild(child) {
    if (child.parentNode) {
     const prevIdx = child.parentNode.children.indexOf(child)
     if (prevIdx !== -1) { child.parentNode.children.splice(prevIdx, 1) }
    }
    child.parentNode = this
    child.removed = false
    this.children.push(child)
    return child
   },
   insertBefore(child, ref) {
    if (child.parentNode) {
     const prevIdx = child.parentNode.children.indexOf(child)
     if (prevIdx !== -1) { child.parentNode.children.splice(prevIdx, 1) }
    }
    child.parentNode = this
    child.removed = false
    const idx = this.children.indexOf(ref)
    if (idx === -1) { this.children.push(child) }
    else { this.children.splice(idx, 0, child) }
    return child
   },
   replaceChildren(...nodes) {
    for (const c of this.children.slice()) {
     c.parentNode = null
     c.removed = true
    }
    this.children = []
    for (const n of nodes) { this.appendChild(n) }
   },
   addEventListener(event, handler) { this.listeners[event] = handler },
   focus() {},
   select() {},
   remove() {
    this.removed = true
    if (this.parentNode) {
     const idx = this.parentNode.children.indexOf(this)
     if (idx !== -1) { this.parentNode.children.splice(idx, 1) }
     this.parentNode = null
    }
   },
  }
  return el
 }

 const kv = new Map()
 function createMockKV(prefix = '') {
  const qualify = key => (prefix ? `${prefix}.${key}` : key)
  return {
   namespace(name) { return createMockKV(qualify(name)) },
   async get(key) { return kv.has(qualify(key)) ? kv.get(qualify(key)) : null },
   async set(key, value) { kv.set(qualify(key), value) },
  }
 }

 let uuid = 0
 const origFetch = globalThis.fetch
 globalThis.fetch = async url => {
  if (url === '/src/lane-control.fs') { return { text: async () => laneSource } }
  if (url === '/src/lane-notebook.fs') { return { text: async () => notebookSource } }
  if (url === '/src/lane-inputs.fs') { return { text: async () => inputsSource } }
  if (url === '/src/lane-scope.fs') { return { text: async () => scopeSource } }
  if (url === '/src/lane-data.fs') { return { text: async () => dataSource } }
  if (url === '/src/confirm-modal.fs') { return { text: async () => confirmModalSource } }
  if (url === '/src/lane-row-picker-modal.fs') { return { text: async () => rowPickerModalSource } }
  if (url === '/src/lane-output.fs') { return { text: async () => outputSource } }
  if (url === '/src/lane-modal.fs') { return { text: async () => modalSource } }
  if (url === '/src/lane-config-modal.fs') { return { text: async () => configModalSource } }
  if (url === '/src/lane-import-modal.fs') { return { text: async () => importModalSource } }
  if (url === '/src/lane-rails.fs') { return { text: async () => railsSource } }
  if (url === '/src/lane-line-info-modal.fs') { return { text: async () => lineInfoModalSource } }
  if (url === '/src/lane-export-modal.fs') { return { text: async () => exportModalSource } }
  if (url === '/src/lane-export-deploy-modal.fs') { return { text: async () => exportDeployModalSource } }
  if (url === '/src/lane-server.fs') { return { text: async () => laneServerSource } }
  if (url === '/src/lane-story.fs') { return { text: async () => laneStorySource } }
  if (url === '/src/lane-servers-modal.fs') { return { text: async () => laneServersModalSource } }
  if (url === '/src/lane-terminal-modal.fs') { return { text: async () => laneTerminalModalSource } }
  if (url === '/src/lane-session-modal.fs') { return { text: async () => sessionModalSource } }
  if (url === '/src/lane-package-modal.fs') { return { text: async () => packageModalSource } }
  if (url === '/src/lane-dir-modal.fs') { return { text: async () => dirModalSource } }
  throw new Error(`Unexpected fetch: ${url}`)
 }

 function createRuntime(initialPathname = '/') {
  let nextTimerId = 0
  const timers = new Map()
  const mockWindow = {
   Array,
   Boolean,
   Date,
   JSON,
   Math,
   Number,
   Object,
   Reflect,
   innerHeight: 600,
   decodeURIComponent,
   crypto: { randomUUID: () => `rail-uuid-${++uuid}` },
   history: { pushState(_s, _t, url) { mockWindow.location.pathname = url } },
   location: { pathname: initialPathname, search: '', hash: '' },
   addEventListener() {},
   removeEventListener() {},
   timers,
   setTimeout(fn, delay) {
    const id = ++nextTimerId
    timers.set(id, { id, fn, delay })
    return id
   },
   clearTimeout(id) {
    timers.delete(id)
   },
  }
  const mockBody = createMockElement('body')
  const f = field({
   ...DATA_RUNTIME_ENV,
   console: { log() {} },
   createIdleTracker,
   data: createMockKV(),
   defaultValueForType,
   document: {
    body: mockBody,
    defaultView: mockWindow,
    createElement: createMockElement,
   },
   formatImportLine,
   hasImportCycle,
   normalizePrimitiveType,
   parseImportLine,
   primitiveTypes: PRIMITIVE_TYPES,
   resolveImportValue,
   resolveScopeColumns,
   runLines,
   runTransportedScripts,
  })
  return { f, mockWindow, mockBody }
 }

 try {
  const { f, mockWindow, mockBody } = createRuntime('/')
  await f.run(parse(mainSource, '/src/main.fs'))
  const laneControl = f.state['lane-control']
  const rails = laneControl.rails

  // Both fixed rails are always mounted and open on startup (even with 0 lanes)
  assert.equal(rails['left-rail'].tag, 'aside')
  assert.equal(rails['left-rail'].className, 'side-rail side-rail--left')
  assert.equal(rails['right-rail'].tag, 'aside')
  assert.equal(rails['right-rail'].className, 'side-rail side-rail--right')
  assert.equal(rails['preview-el'].className, 'side-rail-preview')
  assert.equal(rails['preview-el'].hidden, true)
  assert.equal(rails['preview-el'].attributes['aria-hidden'], 'true')
  assert.equal(rails['restore-btn'].className, 'side-rail-restore')
  assert.equal(rails['restore-btn'].hidden, true)
  assert.ok(mockBody.children.includes(rails['left-rail']))
  assert.ok(mockBody.children.includes(rails['right-rail']))
  assert.ok(mockBody.children.includes(rails['preview-el']))
  assert.ok(mockBody.children.includes(rails['restore-btn']))

  // Create 3 lanes: Alpha, Beta (420px wide), Gamma
  await f.state.tableHeadRowAddButton.listeners.click()
  await f.state.tableHeadRowAddButton.listeners.click()
  await f.state.tableHeadRowAddButton.listeners.click()
  const [laneA, laneB, laneC] = f.state.lanes
  await laneControl.rename(laneA.id, 'Alpha')
  await laneControl.rename(laneB.id, 'Beta')
  await laneControl.rename(laneC.id, 'Gamma')
  await laneControl['set-width'](laneB.id, 420)
  laneB.notebook.rows[0]['input-el'].value = '; add 20 22'
  await laneB.notebook.rows[0]['input-el'].listeners.input()
  assert.equal(laneB.notebook.rows[0]['preview-el'].textContent, '42')

  // Verify chevron minimize buttons on lane header
  assert.equal(laneB['min-left-btn'].className, 'lane-min-btn lane-min-btn--left')
  assert.match(laneB['min-left-btn'].innerHTML, /<svg\b[^>]*class="lane-min-icon"/)
  assert.equal(laneB['min-right-btn'].className, 'lane-min-btn lane-min-btn--right')
  assert.match(laneB['min-right-btn'].innerHTML, /<svg\b[^>]*class="lane-min-icon"/)

  // Minimize middle lane Beta to the LEFT rail
  await laneB['min-left-btn'].listeners.click()
  assert.equal(laneB['is-minimized'], true)
  assert.equal(laneB['minimized-side'], 'left')
  assert.equal(kv.get(`${laneB.id}.minimized`), 'left')
  assert.equal(laneB.element.className, 'lane-header lane-header--minimized')
  assert.equal(laneB.body.className, 'lane-body lane-body--minimized')
  assert.equal(laneB.element.style.width, '')
  assert.equal(laneB.body.style.width, '')

  // Position in table & lanes array is preserved with a clickable vertical-text placeholder
  assert.deepEqual(f.state.lanes.map(l => l.id), [laneA.id, laneB.id, laneC.id])
  assert.equal(f.state.tableHeadRow.children[2], laneB.element)
  assert.equal(f.state.tableBodyRow.children[2], laneB.body)
  assert.ok(laneB['minimized-placeholder'])
  assert.equal(laneB['minimized-placeholder'].className, 'lane-minimized-placeholder')
  assert.equal(laneB['minimized-title-el'].className, 'lane-minimized-title')
  assert.equal(laneB['minimized-title-el'].textContent, 'Beta')

  // Left rail has 26px initial icon 'B'
  assert.equal(rails['left-items'].length, 1)
  assert.equal(rails['right-items'].length, 0)
  const betaIcon = rails['left-items'][0]['icon-el']
  assert.equal(betaIcon.className, 'side-rail-icon')
  assert.equal(betaIcon.textContent, 'B')
  assert.equal(betaIcon.title, 'Beta')
  assert.equal(betaIcon.attributes['data-rail-side'], 'left')
  assert.equal(rails['left-rail'].children[0], betaIcon)

  // Hovering left rail icon shows floating preview with live lane DOM, clamped top, and floating restore arrow to the right of the left rail icon
  betaIcon.rect = { top: 450, height: 26, width: 26 }
  rails['preview-el'].rect = { top: 0, height: 300, width: 420 }
  await betaIcon.listeners.mouseenter()
  assert.equal(rails['preview-el'].hidden, false)
  assert.equal(rails['preview-el'].className, 'side-rail-preview side-rail-preview--left')
  assert.equal(rails['preview-el'].style.top, '292px')
  assert.equal(rails['preview-lane'], laneB)
  assert.equal(rails['pinned-lane'], null)
  assert.equal(rails['is-preview-pinned'], false)
  assert.equal(rails['restore-btn'].hidden, false)
  assert.equal(rails['restore-btn'].className, 'side-rail-restore side-rail-restore--left')
  assert.equal(rails['restore-btn'].style.top, '450px')
  assert.equal(rails['restore-btn'].title, 'Restore Beta')
  assert.equal(rails['restore-btn'].attributes['data-lane-id'], laneB.id)
  assert.equal(rails['restore-btn'].attributes['data-rail-side'], 'left')
  assert.ok(rails['preview-header'].children.includes(laneB['header-top']))
  assert.ok(rails['preview-body'].children.includes(laneB.notebook.element))
  assert.equal(rails['preview-header'].style.width, '420px')
  assert.equal(rails['preview-body'].style.width, '420px')

  // Moving cursor from rail icon onto floating restore button keeps preview & restore button open
  await betaIcon.listeners.mouseleave({ relatedTarget: rails['restore-btn'] })
  assert.equal(rails['preview-el'].hidden, false)
  assert.equal(rails['restore-btn'].hidden, false)

  // Mouseleave hides preview and floating restore button and returns live lane DOM back into laneB
  await rails['restore-btn'].listeners.mouseleave({})
  assert.equal(rails['preview-el'].hidden, true)
  assert.equal(rails['restore-btn'].hidden, true)
  assert.equal(rails['preview-lane'], null)
  assert.ok(laneB.element.children.includes(laneB['header-top']))
  assert.ok(laneB.body.children.includes(laneB.notebook.element))

  // Minimize Gamma to the RIGHT rail
  await laneC['min-right-btn'].listeners.click()
  assert.equal(laneC['is-minimized'], true)
  assert.equal(laneC['minimized-side'], 'right')
  assert.equal(rails['right-items'].length, 1)
  const gammaIcon = rails['right-items'][0]['icon-el']
  assert.equal(gammaIcon.textContent, 'G')
  assert.equal(gammaIcon.attributes['data-rail-side'], 'right')
  assert.equal(laneC['minimized-title-el'].textContent, 'Gamma')

  // Hovering right rail icon shows right-anchored preview and floating restore arrow to the left of the right rail icon
  gammaIcon.rect = { top: 120, height: 26, width: 26 }
  await gammaIcon.listeners.mouseenter()
  assert.equal(rails['preview-el'].hidden, false)
  assert.equal(rails['preview-el'].className, 'side-rail-preview side-rail-preview--right')
  assert.equal(rails['restore-btn'].hidden, false)
  assert.equal(rails['restore-btn'].className, 'side-rail-restore side-rail-restore--right')
  assert.equal(rails['restore-btn'].style.top, '120px')
  assert.equal(rails['restore-btn'].title, 'Restore Gamma')
  assert.equal(rails['restore-btn'].attributes['data-rail-side'], 'right')
  await gammaIcon.listeners.mouseleave()
  assert.equal(rails['preview-el'].hidden, true)
  assert.equal(rails['restore-btn'].hidden, true)

  // Renaming Beta -> Zeta while minimized updates both rail initial ('Z') and vertical placeholder ('Zeta')
  await laneControl.rename(laneB.id, 'Zeta')
  assert.equal(betaIcon.textContent, 'Z')
  assert.equal(betaIcon.title, 'Zeta')
  assert.equal(laneB['minimized-title-el'].textContent, 'Zeta')

  // Clicking rail icon pins the popover lane open for quick interaction (instead of immediately restoring)
  await betaIcon.listeners.mouseenter()
  assert.equal(rails['preview-el'].hidden, false)
  await betaIcon.listeners.click()
  assert.equal(laneB['is-minimized'], true)
  assert.equal(rails['is-preview-pinned'], true)
  assert.equal(rails['pinned-lane'], laneB)
  assert.equal(betaIcon.className, 'side-rail-icon side-rail-icon--pinned')
  assert.equal(betaIcon.attributes['aria-pressed'], 'true')
  assert.equal(rails['preview-el'].hidden, false)
  assert.equal(rails['preview-el'].className, 'side-rail-preview side-rail-preview--left side-rail-preview--pinned')
  assert.equal(rails['preview-el'].attributes['aria-hidden'], 'false')
  assert.equal(rails['restore-btn'].hidden, false)
  assert.equal(rails['restore-btn'].className, 'side-rail-restore side-rail-restore--left side-rail-restore--pinned')
  assert.equal(rails['restore-btn'].title, 'Restore Zeta')

  // Mouseleave on rail icon or restore button does NOT close the pinned popover, and hovering another rail icon does not steal it
  await betaIcon.listeners.mouseleave()
  await rails['restore-btn'].listeners.mouseleave({})
  await gammaIcon.listeners.mouseenter()
  assert.equal(rails['preview-el'].hidden, false)
  assert.equal(rails['pinned-lane'], laneB)
  assert.equal(rails['preview-lane'], laneB)

  // Quick interaction inside the pinned popover works on the live notebook DOM
  laneB.notebook.rows[0]['input-el'].value = '; add 50 50'
  await laneB.notebook.rows[0]['input-el'].listeners.input()
  assert.equal(laneB.notebook.rows[0]['preview-el'].textContent, '100')

  // Floating restore arrow button starts fading at 25s (25000ms) and is totally gone at 30s (30000ms),
  // then re-enables instantly when the user mouses over the original button in the rail
  assert.equal(rails['restore-fade-delay'], 25000)
  assert.equal(rails['restore-hide-delay'], 30000)
  const fadeTimer = mockWindow.timers.get(rails['restore-fade-timer'])
  const hideTimer = mockWindow.timers.get(rails['restore-hide-timer'])
  assert.ok(fadeTimer)
  assert.equal(fadeTimer.delay, 25000)
  assert.ok(hideTimer)
  assert.equal(hideTimer.delay, 30000)

  // At 25 seconds: starts fading out over 5s (still visible while fading)
  mockWindow.timers.delete(fadeTimer.id)
  await fadeTimer.fn()
  assert.equal(rails['is-restore-fading'], true)
  assert.equal(rails['is-restore-expired'], false)
  assert.equal(rails['restore-btn'].hidden, false)
  assert.equal(rails['restore-btn'].className, 'side-rail-restore side-rail-restore--left side-rail-restore--pinned side-rail-restore--fading')

  // At 30 seconds: totally gone (hidden) while the pinned popover lane remains open for interaction
  mockWindow.timers.delete(hideTimer.id)
  await hideTimer.fn()
  assert.equal(rails['is-restore-fading'], false)
  assert.equal(rails['is-restore-expired'], true)
  assert.equal(rails['restore-btn'].hidden, true)
  assert.equal(rails['preview-el'].hidden, false)
  assert.equal(rails['is-preview-pinned'], true)

  // Mousing over the original button in the rail instantly re-enables the floating restore arrow button and restarts the 25s/30s timers
  await betaIcon.listeners.mouseenter()
  assert.equal(rails['restore-btn'].hidden, false)
  assert.equal(rails['is-restore-fading'], false)
  assert.equal(rails['is-restore-expired'], false)
  assert.equal(rails['restore-btn'].className, 'side-rail-restore side-rail-restore--left side-rail-restore--pinned')
  assert.ok(mockWindow.timers.has(rails['restore-fade-timer']))
  assert.ok(mockWindow.timers.has(rails['restore-hide-timer']))

  // Clicking the pinned rail icon again unpins and closes the popover while keeping the lane minimized
  await betaIcon.listeners.click()
  assert.equal(rails['is-preview-pinned'], false)
  assert.equal(rails['pinned-lane'], null)
  assert.equal(rails['preview-el'].hidden, true)
  assert.equal(rails['restore-btn'].hidden, true)
  assert.equal(betaIcon.className, 'side-rail-icon')
  assert.equal(betaIcon.attributes['aria-pressed'], 'false')
  assert.equal(laneB['is-minimized'], true)
  assert.equal(rails['left-items'].length, 1)

  // Pinning again and clicking the floating restore arrow button restores the lane in-place with original 420px width
  await betaIcon.listeners.click()
  assert.equal(rails['is-preview-pinned'], true)
  assert.equal(rails['restore-btn'].hidden, false)
  await rails['restore-btn'].listeners.click()
  assert.equal(rails['is-preview-pinned'], false)
  assert.equal(rails['pinned-lane'], null)
  assert.equal(rails['preview-el'].hidden, true)
  assert.equal(rails['restore-btn'].hidden, true)
  assert.equal(rails['left-items'].length, 0)
  assert.equal(laneB['is-minimized'], false)
  assert.equal(laneB['minimized-side'], null)
  assert.equal(laneB['minimized-placeholder'], null)
  assert.equal(kv.get(`${laneB.id}.minimized`), '')
  assert.equal(laneB.element.className, 'lane-header lane-header--sized')
  assert.equal(laneB.element.style.width, '420px')
  assert.equal(laneB.body.className, 'lane-body lane-body--sized')
  assert.equal(laneB.body.style.width, '420px')
  assert.equal(f.state.tableHeadRow.children[2], laneB.element)
  assert.equal(f.state.tableBodyRow.children[2], laneB.body)
  assert.ok(laneB.element.children.includes(laneB['header-top']))
  assert.ok(laneB.body.children.includes(laneB.notebook.element))

  // Clicking the vertical placeholder also unminimizes (restores) Gamma in-place
  await laneC['minimized-placeholder'].listeners.click()
  assert.equal(laneC['is-minimized'], false)
  assert.equal(laneC['minimized-placeholder'], null)
  assert.equal(rails['right-items'].length, 0)
  assert.equal(f.state.tableHeadRow.children[3], laneC.element)
  assert.equal(f.state.tableBodyRow.children[3], laneC.body)

  // Persisted minimized state restores cleanly across full app reload
  await laneA['min-left-btn'].listeners.click()
  await laneC['min-right-btn'].listeners.click()
  const reloaded = createRuntime(mockWindow.location.pathname)
  await reloaded.f.run(parse(mainSource, '/src/main.fs'))
  const [rA, rB, rC] = reloaded.f.state.lanes
  const rRails = reloaded.f.state['lane-control'].rails
  assert.equal(rA['is-minimized'], true)
  assert.equal(rA['minimized-side'], 'left')
  assert.equal(rA['minimized-title-el'].textContent, 'Alpha')
  assert.equal(rRails['left-items'].length, 1)
  assert.equal(rRails['left-items'][0]['icon-el'].textContent, 'A')
  assert.equal(rB['is-minimized'], false)
  assert.equal(rC['is-minimized'], true)
  assert.equal(rC['minimized-side'], 'right')
  assert.equal(rC['minimized-title-el'].textContent, 'Gamma')
  assert.equal(rRails['right-items'].length, 1)
  assert.equal(rRails['right-items'][0]['icon-el'].textContent, 'G')

  // Closing a minimized lane removes its rail icon and clears persisted minimized state
  await reloaded.f.state['lane-control'].close(rC.id)
  assert.equal(rRails['right-items'].length, 0)
  assert.equal(kv.get(`${rC.id}.minimized`), '')
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Fixed 16px top rail: styles, centered 12px icon buttons, root html fullscreen with corner-inverting SVG, and Open Lane search button', async () => {
 const indexHtml = await fs.readFile(new URL('./index.html', import.meta.url), 'utf8')
 assert.match(indexHtml, /:root\s*\{[^}]*padding:\s*calc\(16px \+ 1em\) 1em 1em;/s)
 assert.match(indexHtml, /\.lane-modal-backdrop\s*\{[^}]*padding:\s*calc\(16px \+ 1\.5em\) calc\(32px \+ 1\.5em\) 1\.5em;/s)
 assert.match(indexHtml, /\.top-rail\s*\{[^}]*align-items:\s*center;[^}]*background-color:\s*#383838;[^}]*border-bottom:\s*1px solid #ffffff24;[^}]*box-sizing:\s*border-box;[^}]*height:\s*16px;[^}]*justify-content:\s*center;[^}]*position:\s*fixed;[^}]*top:\s*0;[^}]*z-index:\s*2001;/s)
 assert.match(indexHtml, /\.top-rail-icon\s*\{[^}]*background:\s*#ffffff0e;[^}]*border:\s*1px solid #ffffff24;[^}]*box-sizing:\s*border-box;[^}]*height:\s*12px;[^}]*justify-content:\s*center;[^}]*padding:\s*0;[^}]*width:\s*12px;/s)
 assert.match(indexHtml, /\.side-rail\s*\{[^}]*padding:\s*20px 0 4px;/s)
 assert.match(indexHtml, /\.side-rail-preview\s*\{[^}]*top:\s*24px;/s)

 const mainSource = await fs.readFile(new URL('./src/main.fs', import.meta.url), 'utf8')
 const laneSource = await fs.readFile(new URL('./src/lane-control.fs', import.meta.url), 'utf8')
 const notebookSource = await fs.readFile(new URL('./src/lane-notebook.fs', import.meta.url), 'utf8')
 const inputsSource = await fs.readFile(new URL('./src/lane-inputs.fs', import.meta.url), 'utf8')
 const scopeSource = await fs.readFile(new URL('./src/lane-scope.fs', import.meta.url), 'utf8')
 const dataSource = await fs.readFile(new URL('./src/lane-data.fs', import.meta.url), 'utf8')
 const confirmModalSource = await fs.readFile(new URL('./src/confirm-modal.fs', import.meta.url), 'utf8')
 const rowPickerModalSource = await fs.readFile(new URL('./src/lane-row-picker-modal.fs', import.meta.url), 'utf8')
 const outputSource = await fs.readFile(new URL('./src/lane-output.fs', import.meta.url), 'utf8')
 const modalSource = await fs.readFile(new URL('./src/lane-modal.fs', import.meta.url), 'utf8')
 const configModalSource = await fs.readFile(new URL('./src/lane-config-modal.fs', import.meta.url), 'utf8')
 const importModalSource = await fs.readFile(new URL('./src/lane-import-modal.fs', import.meta.url), 'utf8')
 const railsSource = await fs.readFile(new URL('./src/lane-rails.fs', import.meta.url), 'utf8')

 function createMockElement(tag) {
  const styleProps = {}
  const el = {
   tag,
   nodeType: 1,
   style: {
    setProperty(name, value) { styleProps[name] = value; this[name] = value },
    removeProperty(name) { delete styleProps[name]; delete this[name] },
    getPropertyValue(name) { return styleProps[name] || '' },
   },
   attributes: {},
   children: [],
   parentNode: null,
   listeners: {},
   textContent: '',
   innerHTML: '',
   value: '',
   className: '',
   title: '',
   hidden: false,
   disabled: false,
   removed: false,
   focused: false,
   setAttribute(name, value) { this.attributes[name] = value },
   appendChild(child) {
    if (child.parentNode) {
     const prevIdx = child.parentNode.children.indexOf(child)
     if (prevIdx !== -1) { child.parentNode.children.splice(prevIdx, 1) }
    }
    child.parentNode = this
    child.removed = false
    this.children.push(child)
    return child
   },
   addEventListener(event, handler) { this.listeners[event] = handler },
   focus() { this.focused = true },
   select() {},
   remove() {
    this.removed = true
    if (this.parentNode) {
     const idx = this.parentNode.children.indexOf(this)
     if (idx !== -1) { this.parentNode.children.splice(idx, 1) }
     this.parentNode = null
    }
   },
  }
  return el
 }

 const kv = new Map()
 function createMockKV(prefix = '') {
  const qualify = key => (prefix ? `${prefix}.${key}` : key)
  return {
   namespace(name) { return createMockKV(qualify(name)) },
   async get(key) { return kv.has(qualify(key)) ? kv.get(qualify(key)) : null },
   async set(key, value) { kv.set(qualify(key), value) },
  }
 }

 let uuid = 0
 const origFetch = globalThis.fetch
 globalThis.fetch = async url => {
  if (url === '/src/lane-control.fs') { return { text: async () => laneSource } }
  if (url === '/src/lane-notebook.fs') { return { text: async () => notebookSource } }
  if (url === '/src/lane-inputs.fs') { return { text: async () => inputsSource } }
  if (url === '/src/lane-scope.fs') { return { text: async () => scopeSource } }
  if (url === '/src/lane-data.fs') { return { text: async () => dataSource } }
  if (url === '/src/confirm-modal.fs') { return { text: async () => confirmModalSource } }
  if (url === '/src/lane-row-picker-modal.fs') { return { text: async () => rowPickerModalSource } }
  if (url === '/src/lane-output.fs') { return { text: async () => outputSource } }
  if (url === '/src/lane-modal.fs') { return { text: async () => modalSource } }
  if (url === '/src/lane-config-modal.fs') { return { text: async () => configModalSource } }
  if (url === '/src/lane-import-modal.fs') { return { text: async () => importModalSource } }
  if (url === '/src/lane-rails.fs') { return { text: async () => railsSource } }
  if (url === '/src/lane-line-info-modal.fs') { return { text: async () => lineInfoModalSource } }
  if (url === '/src/lane-export-modal.fs') { return { text: async () => exportModalSource } }
  if (url === '/src/lane-export-deploy-modal.fs') { return { text: async () => exportDeployModalSource } }
  if (url === '/src/lane-server.fs') { return { text: async () => laneServerSource } }
  if (url === '/src/lane-story.fs') { return { text: async () => laneStorySource } }
  if (url === '/src/lane-servers-modal.fs') { return { text: async () => laneServersModalSource } }
  if (url === '/src/lane-terminal-modal.fs') { return { text: async () => laneTerminalModalSource } }
  if (url === '/src/lane-session-modal.fs') { return { text: async () => sessionModalSource } }
  if (url === '/src/lane-package-modal.fs') { return { text: async () => packageModalSource } }
  if (url === '/src/lane-dir-modal.fs') { return { text: async () => dirModalSource } }
  throw new Error(`Unexpected fetch: ${url}`)
 }

 const docListeners = {}
 const mockHtml = createMockElement('html')
 const mockBody = createMockElement('body')
 let requestCalls = 0
 let bodyRequestCalls = 0
 let exitCalls = 0
 let rejectNextFullscreen = false
 mockBody.requestFullscreen = async () => { bodyRequestCalls++ }

 const mockDocument = {
  body: mockBody,
  documentElement: mockHtml,
  fullscreenElement: null,
  createElement: createMockElement,
  addEventListener(event, handler) {
   docListeners[event] ||= []
   docListeners[event].push(handler)
  },
  async exitFullscreen() {
   exitCalls++
   mockDocument.fullscreenElement = null
   for (const handler of docListeners.fullscreenchange || []) {
    await handler()
   }
  },
 }

 mockHtml.requestFullscreen = async function () {
  requestCalls++
  assert.equal(this, mockHtml)
  if (rejectNextFullscreen) {
   rejectNextFullscreen = false
   throw new Error('Fullscreen blocked')
  }
  mockDocument.fullscreenElement = mockHtml
  for (const handler of docListeners.fullscreenchange || []) {
   await handler()
  }
 }

 const mockWindow = {
  Array,
  Boolean,
  Date,
  JSON,
  Math,
  Object,
  Reflect,
  innerHeight: 600,
  decodeURIComponent,
  crypto: { randomUUID: () => `top-rail-uuid-${++uuid}` },
  history: { pushState(_s, _t, url) { mockWindow.location.pathname = url } },
  location: { pathname: '/', search: '', hash: '' },
  addEventListener() {},
  removeEventListener() {},
 }
 mockDocument.defaultView = mockWindow

 const f = field({
  ...DATA_RUNTIME_ENV,
  console: { log() {} },
  createIdleTracker,
  data: createMockKV(),
  defaultValueForType,
  document: mockDocument,
  formatImportLine,
  hasImportCycle,
  normalizePrimitiveType,
  parseImportLine,
  primitiveTypes: PRIMITIVE_TYPES,
  resolveImportValue,
  resolveScopeColumns,
  runLines,
  runTransportedScripts,
 })

 try {
  await f.run(parse(mainSource, '/src/main.fs'))
  const laneControl = f.state['lane-control']
  const rails = laneControl.rails
  const modal = laneControl['lane-modal']

  // Top rail is mounted on body with 6 centered icon buttons followed by the right-hand clock chip
  const topRail = rails['top-rail']
  assert.equal(topRail.tag, 'aside')
  assert.equal(topRail.className, 'top-rail')
  assert.equal(topRail.attributes.role, 'region')
  assert.ok(mockBody.children.includes(topRail))
  assert.equal(topRail.children.length, 7)

  const fsBtn = rails['fullscreen-btn']
  const searchBtn = rails['search-btn']
  const sessionBtn = rails['session-btn']
  const packagesBtn = rails['packages-btn']
  const serversBtn = rails['servers-btn']
  const prefBtn = rails['preferences-btn']
  const clockBtn = rails['clock-btn']
  assert.equal(topRail.children[0], fsBtn)
  assert.equal(topRail.children[1], searchBtn)
  assert.equal(topRail.children[2], sessionBtn)
  assert.equal(topRail.children[3], packagesBtn)
  assert.equal(topRail.children[4], serversBtn)
  assert.equal(topRail.children[5], prefBtn)
  assert.equal(topRail.children[6], clockBtn)
  assert.equal(sessionBtn.className, 'top-rail-icon top-rail-icon--session')
  assert.equal(sessionBtn.textContent, '')
  assert.match(sessionBtn.innerHTML, /class="top-rail-icon-svg top-rail-icon-svg--session"/)
  assert.equal(packagesBtn.className, 'top-rail-icon top-rail-icon--packages')
  assert.equal(packagesBtn.textContent, '')
  assert.match(packagesBtn.innerHTML, /class="top-rail-icon-svg top-rail-icon-svg--packages"/)
  assert.equal(serversBtn.className, 'top-rail-icon top-rail-icon--servers')
  assert.equal(serversBtn.textContent, '')
  assert.match(serversBtn.innerHTML, /class="top-rail-icon-svg top-rail-icon-svg--servers"/)
  assert.equal(prefBtn.className, 'top-rail-icon top-rail-icon--preferences')
  assert.equal(prefBtn.textContent, '')
  assert.match(prefBtn.innerHTML, /class="top-rail-icon-svg top-rail-icon-svg--preferences"/)

  // Initial fullscreen button state: no text, outward 4-corners SVG
  assert.equal(fsBtn.tag, 'button')
  assert.equal(fsBtn.type, 'button')
  assert.equal(fsBtn.className, 'top-rail-icon top-rail-icon--fullscreen')
  assert.equal(fsBtn.textContent, '')
  assert.equal(rails['is-fullscreen'], false)
  assert.equal(fsBtn.attributes['data-fullscreen'], 'false')
  assert.equal(fsBtn.attributes['aria-pressed'], 'false')
  assert.match(fsBtn.innerHTML, /class="top-rail-icon-svg top-rail-icon-svg--fullscreen-enter"/)
  assert.match(fsBtn.innerHTML, /M1\.5 3\.5V1\.5H3\.5M6\.5 1\.5H8\.5V3\.5M8\.5 6\.5V8\.5H6\.5M3\.5 8\.5H1\.5V6\.5/)

  // Clicking fullscreen enters fullscreen on root <html> (documentElement) and inverts all 4 corners
  await fsBtn.listeners.click()
  assert.equal(requestCalls, 1)
  assert.equal(bodyRequestCalls, 0)
  assert.equal(mockDocument.fullscreenElement, mockHtml)
  assert.equal(rails['is-fullscreen'], true)
  assert.equal(fsBtn.textContent, '')
  assert.equal(fsBtn.attributes['data-fullscreen'], 'true')
  assert.equal(fsBtn.attributes['aria-pressed'], 'true')
  assert.match(fsBtn.innerHTML, /class="top-rail-icon-svg top-rail-icon-svg--fullscreen-exit"/)
  assert.match(fsBtn.innerHTML, /M1\.5 3\.5H3\.5V1\.5M6\.5 1\.5V3\.5H8\.5M8\.5 6\.5H6\.5V8\.5M3\.5 8\.5V6\.5H1\.5/)

  // Clicking again exits fullscreen and reverts the 4 corners outward
  await fsBtn.listeners.click()
  assert.equal(exitCalls, 1)
  assert.equal(mockDocument.fullscreenElement, null)
  assert.equal(rails['is-fullscreen'], false)
  assert.equal(fsBtn.attributes['data-fullscreen'], 'false')
  assert.equal(fsBtn.attributes['aria-pressed'], 'false')
  assert.match(fsBtn.innerHTML, /class="top-rail-icon-svg top-rail-icon-svg--fullscreen-enter"/)

  // External fullscreenchange (e.g. Escape key in browser) keeps the icon synced
  mockDocument.fullscreenElement = mockHtml
  for (const handler of docListeners.fullscreenchange || []) { await handler() }
  assert.equal(rails['is-fullscreen'], true)
  assert.match(fsBtn.innerHTML, /class="top-rail-icon-svg top-rail-icon-svg--fullscreen-exit"/)
  mockDocument.fullscreenElement = null
  for (const handler of docListeners.fullscreenchange || []) { await handler() }
  assert.equal(rails['is-fullscreen'], false)
  assert.match(fsBtn.innerHTML, /class="top-rail-icon-svg top-rail-icon-svg--fullscreen-enter"/)

  // Rejected requestFullscreen() promise is handled safely without throwing
  rejectNextFullscreen = true
  await fsBtn.listeners.click()
  assert.equal(requestCalls, 2)
  assert.equal(mockDocument.fullscreenElement, null)
  assert.equal(rails['is-fullscreen'], false)
  assert.match(fsBtn.innerHTML, /class="top-rail-icon-svg top-rail-icon-svg--fullscreen-enter"/)

  // Create and rename a lane, then close it so search modal can show both open and closed lanes
  await f.state.tableHeadRowAddButton.listeners.click()
  await f.state.tableHeadRowAddButton.listeners.click()
  const [lane1, lane2] = f.state.lanes
  await laneControl.rename(lane1.id, 'Alpha')
  await laneControl.rename(lane2.id, 'Beta')
  await laneControl.close(lane2.id)

  // Search button has no text, search SVG, and opens the same Open Lane dialog as Home's Open button
  assert.equal(searchBtn.tag, 'button')
  assert.equal(searchBtn.type, 'button')
  assert.equal(searchBtn.className, 'top-rail-icon top-rail-icon--search')
  assert.equal(searchBtn.textContent, '')
  assert.match(searchBtn.innerHTML, /class="top-rail-icon-svg top-rail-icon-svg--search"/)

  await searchBtn.listeners.click()
  assert.equal(modal['is-open'], true)
  assert.equal(modal.mode, 'open')
  assert.equal(modal['heading-el'].textContent, 'Open Lane')
  assert.equal(modal['clear-btn'].hidden, true)
  assert.equal(modal['count-el'].textContent, '2 lanes')
  assert.ok(mockBody.children.includes(modal.backdrop))
  assert.ok(modal.items.find(it => it.entry.id === lane1.id)['close-btn'])
  assert.ok(modal.items.find(it => it.entry.id === lane2.id)['open-btn'])

  // Opening Beta from the top-rail search dialog mounts Beta and closes the modal
  await modal.items.find(it => it.entry.id === lane2.id)['open-btn'].listeners.click()
  assert.equal(modal['is-open'], false)
  assert.equal(f.state.lanes.length, 2)

  // Verify lane fullscreen CSS in index.html: black background, fixed full screen, z-index covering all rails
  assert.match(indexHtml, /\.lane-fullscreen\s*\{[^}]*background-color:\s*#000000;[^}]*inset:\s*0;[^}]*position:\s*fixed;[^}]*z-index:\s*3000;/s)

  // Enter browser fullscreen via top rail first
  await fsBtn.listeners.click()
  assert.equal(mockDocument.fullscreenElement, mockHtml)
  assert.equal(rails['is-fullscreen'], true)
  const reqCallsBeforeLaneFs = requestCalls
  const exitCallsBeforeLaneFs = exitCalls

  // Click lane1's Fullscreen lane button (to the right of Reload lane)
  const lane1FsBtn = lane1['fullscreen-btn']
  assert.equal(lane1['header-top'].children[5], lane1['reload-btn'])
  assert.equal(lane1['header-top'].children[6], lane1FsBtn)
  assert.equal(lane1['header-top'].children[7], lane1['close-btn'])
  assert.equal(lane1FsBtn.className, 'lane-fullscreen-btn')
  assert.equal(lane1FsBtn.title, 'Fullscreen lane')
  assert.equal(lane1FsBtn.attributes['aria-label'], 'Fullscreen lane')
  assert.equal(lane1FsBtn.attributes['aria-pressed'], 'false')
  assert.equal(lane1FsBtn.attributes['data-fullscreen'], 'false')
  assert.match(lane1FsBtn.innerHTML, /class="lane-fullscreen-icon lane-fullscreen-icon--enter"/)

  await lane1FsBtn.listeners.click()
  // Does not touch browser requestFullscreen / exitFullscreen
  assert.equal(requestCalls, reqCallsBeforeLaneFs)
  assert.equal(exitCalls, exitCallsBeforeLaneFs)
  assert.equal(laneControl['is-lane-fullscreen'], true)
  assert.equal(laneControl['fullscreen-lane'], lane1)
  assert.equal(laneControl['fullscreen-lane-id'], lane1.id)
  assert.equal(lane1['is-fullscreen'], true)
  assert.equal(laneControl['fullscreen-el'].hidden, false)
  assert.equal(laneControl['fullscreen-el'].attributes['aria-hidden'], 'false')
  assert.equal(laneControl['fullscreen-el'].attributes['data-lane-id'], lane1.id)
  assert.equal(lane1FsBtn.className, 'lane-fullscreen-btn lane-fullscreen-btn--active')
  assert.equal(lane1FsBtn.title, 'Exit fullscreen lane')
  assert.equal(lane1FsBtn.attributes['aria-label'], 'Exit fullscreen lane')
  assert.equal(lane1FsBtn.attributes['aria-pressed'], 'true')
  assert.equal(lane1FsBtn.attributes['data-fullscreen'], 'true')
  assert.match(lane1FsBtn.innerHTML, /class="lane-fullscreen-icon lane-fullscreen-icon--exit"/)
  assert.ok(laneControl['fullscreen-header'].children.includes(lane1['header-top']))
  assert.ok(laneControl['fullscreen-body'].children.includes(lane1.notebook.element))

  // While in lane fullscreen, attempting to exit browser fullscreen from top rail is blocked until lane fullscreen is exited first
  await fsBtn.listeners.click()
  assert.equal(exitCalls, exitCallsBeforeLaneFs)
  assert.equal(mockDocument.fullscreenElement, mockHtml)
  assert.equal(rails['is-fullscreen'], true)

  // Reloading a lane while in lane fullscreen keeps it in lane fullscreen
  await lane1['reload-btn'].listeners.click()
  assert.equal(laneControl['is-lane-fullscreen'], true)
  assert.equal(laneControl['fullscreen-lane'], lane1)
  assert.equal(laneControl['fullscreen-el'].hidden, false)
  assert.ok(laneControl['fullscreen-header'].children.includes(lane1['header-top']))
  assert.ok(laneControl['fullscreen-body'].children.includes(lane1.notebook.element))

  // Opening a lane modal while in lane fullscreen mounts it inside fullscreen-body
  await lane1['config-btn'].listeners.click()
  const cfgModal = laneControl['config-modal']
  assert.equal(cfgModal['is-open'], true)
  assert.ok(laneControl['fullscreen-body'].children.includes(cfgModal.backdrop))
  assert.equal(laneControl['fullscreen-el'].attributes['data-modal-open'], 'true')
  await cfgModal['cancel-btn'].listeners.click()
  assert.equal(cfgModal['is-open'], false)
  assert.equal(laneControl['fullscreen-el'].attributes['data-modal-open'], undefined)

  // Exit lane fullscreen first -> returns lane nodes to workspace cells
  await lane1FsBtn.listeners.click()
  assert.equal(laneControl['is-lane-fullscreen'], false)
  assert.equal(laneControl['fullscreen-lane'], null)
  assert.equal(lane1['is-fullscreen'], false)
  assert.equal(laneControl['fullscreen-el'].hidden, true)
  assert.equal(laneControl['fullscreen-el'].attributes['aria-hidden'], 'true')
  assert.equal(lane1FsBtn.className, 'lane-fullscreen-btn')
  assert.equal(lane1FsBtn.title, 'Fullscreen lane')
  assert.equal(lane1FsBtn.attributes['data-fullscreen'], 'false')
  assert.match(lane1FsBtn.innerHTML, /class="lane-fullscreen-icon lane-fullscreen-icon--enter"/)
  assert.ok(lane1.element.children.includes(lane1['header-top']))
  assert.ok(lane1.body.children.includes(lane1.notebook.element))

  // Now top-rail browser fullscreen can be exited
  await fsBtn.listeners.click()
  assert.equal(exitCalls, exitCallsBeforeLaneFs + 1)
  assert.equal(mockDocument.fullscreenElement, null)
  assert.equal(rails['is-fullscreen'], false)
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Top-rail wrench preferences dropdown: create seeded lane, pick existing lane without seeding, live & startup interface.backgroundColor', async () => {
 const indexHtml = await fs.readFile(new URL('./index.html', import.meta.url), 'utf8')
 assert.match(indexHtml, /\.top-rail-menu\s*\{[^}]*position:\s*fixed;[^}]*top:\s*18px;/s)
 assert.ok(
  indexHtml.indexOf('.top-rail-menu.top-rail-menu--chip') > indexHtml.indexOf('.top-rail-menu {'),
  '.top-rail-menu--chip rules must appear after .top-rail-menu so gap/padding are not overridden'
 )

 const mainSource = await fs.readFile(new URL('./src/main.fs', import.meta.url), 'utf8')
 const laneSource = await fs.readFile(new URL('./src/lane-control.fs', import.meta.url), 'utf8')
 const notebookSource = await fs.readFile(new URL('./src/lane-notebook.fs', import.meta.url), 'utf8')
 const inputsSource = await fs.readFile(new URL('./src/lane-inputs.fs', import.meta.url), 'utf8')
 const scopeSource = await fs.readFile(new URL('./src/lane-scope.fs', import.meta.url), 'utf8')
 const dataSource = await fs.readFile(new URL('./src/lane-data.fs', import.meta.url), 'utf8')
 const confirmModalSource = await fs.readFile(new URL('./src/confirm-modal.fs', import.meta.url), 'utf8')
 const rowPickerModalSource = await fs.readFile(new URL('./src/lane-row-picker-modal.fs', import.meta.url), 'utf8')
 const outputSource = await fs.readFile(new URL('./src/lane-output.fs', import.meta.url), 'utf8')
 const modalSource = await fs.readFile(new URL('./src/lane-modal.fs', import.meta.url), 'utf8')
 const configModalSource = await fs.readFile(new URL('./src/lane-config-modal.fs', import.meta.url), 'utf8')
 const importModalSource = await fs.readFile(new URL('./src/lane-import-modal.fs', import.meta.url), 'utf8')
 const railsSource = await fs.readFile(new URL('./src/lane-rails.fs', import.meta.url), 'utf8')

 function createMockElement(tag) {
  const styleProps = {}
  return {
   tag,
   nodeType: 1,
   style: {
    setProperty(name, value) { styleProps[name] = value; this[name] = value },
    removeProperty(name) { delete styleProps[name]; delete this[name] },
    getPropertyValue(name) { return styleProps[name] || '' },
   },
   attributes: {},
   children: [],
   parentNode: null,
   listeners: {},
   textContent: '',
   innerHTML: '',
   value: '',
   className: '',
   title: '',
   hidden: false,
   disabled: false,
   removed: false,
   focused: false,
   rect: { left: 200, width: 12, top: 2, height: 12 },
   getBoundingClientRect() { return this.rect },
   contains(target) {
    if (target === this) { return true }
    return this.children.some(child => typeof child.contains === 'function' && child.contains(target))
   },
   setAttribute(name, value) { this.attributes[name] = value },
   appendChild(child) {
    if (child.parentNode) {
     const prevIdx = child.parentNode.children.indexOf(child)
     if (prevIdx !== -1) { child.parentNode.children.splice(prevIdx, 1) }
    }
    child.parentNode = this
    child.removed = false
    this.children.push(child)
    return child
   },
   insertBefore(child, ref) {
    if (child.parentNode) {
     const prevIdx = child.parentNode.children.indexOf(child)
     if (prevIdx !== -1) { child.parentNode.children.splice(prevIdx, 1) }
    }
    child.parentNode = this
    child.removed = false
    const idx = this.children.indexOf(ref)
    if (idx === -1) { this.children.push(child) }
    else { this.children.splice(idx, 0, child) }
    return child
   },
   addEventListener(event, handler) { this.listeners[event] = handler },
   focus() { this.focused = true },
   select() {},
   remove() {
    this.removed = true
    if (this.parentNode) {
     const idx = this.parentNode.children.indexOf(this)
     if (idx !== -1) { this.parentNode.children.splice(idx, 1) }
     this.parentNode = null
    }
   },
  }
 }

 const kv = new Map()
 function createMockKV(prefix = '') {
  const qualify = key => (prefix ? `${prefix}.${key}` : key)
  return {
   namespace(name) { return createMockKV(qualify(name)) },
   async get(key) { return kv.has(qualify(key)) ? kv.get(qualify(key)) : null },
   async set(key, value) { kv.set(qualify(key), value) },
  }
 }

 let uuid = 0
 const origFetch = globalThis.fetch
 globalThis.fetch = async url => {
  if (url === '/src/lane-control.fs') { return { text: async () => laneSource } }
  if (url === '/src/lane-notebook.fs') { return { text: async () => notebookSource } }
  if (url === '/src/lane-inputs.fs') { return { text: async () => inputsSource } }
  if (url === '/src/lane-scope.fs') { return { text: async () => scopeSource } }
  if (url === '/src/lane-data.fs') { return { text: async () => dataSource } }
  if (url === '/src/confirm-modal.fs') { return { text: async () => confirmModalSource } }
  if (url === '/src/lane-row-picker-modal.fs') { return { text: async () => rowPickerModalSource } }
  if (url === '/src/lane-output.fs') { return { text: async () => outputSource } }
  if (url === '/src/lane-modal.fs') { return { text: async () => modalSource } }
  if (url === '/src/lane-config-modal.fs') { return { text: async () => configModalSource } }
  if (url === '/src/lane-import-modal.fs') { return { text: async () => importModalSource } }
  if (url === '/src/lane-rails.fs') { return { text: async () => railsSource } }
  if (url === '/src/lane-line-info-modal.fs') { return { text: async () => lineInfoModalSource } }
  if (url === '/src/lane-export-modal.fs') { return { text: async () => exportModalSource } }
  if (url === '/src/lane-export-deploy-modal.fs') { return { text: async () => exportDeployModalSource } }
  if (url === '/src/lane-server.fs') { return { text: async () => laneServerSource } }
  if (url === '/src/lane-story.fs') { return { text: async () => laneStorySource } }
  if (url === '/src/lane-servers-modal.fs') { return { text: async () => laneServersModalSource } }
  if (url === '/src/lane-terminal-modal.fs') { return { text: async () => laneTerminalModalSource } }
  if (url === '/src/lane-session-modal.fs') { return { text: async () => sessionModalSource } }
  if (url === '/src/lane-package-modal.fs') { return { text: async () => packageModalSource } }
  if (url === '/src/lane-dir-modal.fs') { return { text: async () => dirModalSource } }
  throw new Error(`Unexpected fetch: ${url}`)
 }

 function createRuntime(initialPathname = '/') {
  const docListeners = {}
  const winListeners = {}
  const mockHtml = createMockElement('html')
  const mockBody = createMockElement('body')
  const mockDocument = {
   body: mockBody,
   documentElement: mockHtml,
   fullscreenElement: null,
   createElement: createMockElement,
   addEventListener(event, handler) {
    docListeners[event] ||= []
    docListeners[event].push(handler)
   },
  }
  const mockWindow = {
   Array,
   Boolean,
   Date,
   JSON,
   Math,
   Number,
   Object,
   Reflect,
   innerHeight: 600,
   decodeURIComponent,
   crypto: { randomUUID: () => `pref-uuid-${++uuid}` },
   history: { pushState(_s, _t, url) { mockWindow.location.pathname = url } },
   location: { pathname: initialPathname, search: '', hash: '' },
   addEventListener(event, handler) {
    winListeners[event] ||= []
    winListeners[event].push(handler)
   },
   removeEventListener() {},
  }
  mockDocument.defaultView = mockWindow
  const dispatchDocEvent = async (event, ev) => {
   for (const handler of docListeners[event] || []) { await handler(ev) }
  }
  const dispatchWinEvent = async (event, ev) => {
   for (const handler of winListeners[event] || []) { await handler(ev) }
  }
  const f = field({
   ...DATA_RUNTIME_ENV,
   console: { log() {} },
   createIdleTracker,
   data: createMockKV(),
   defaultValueForType,
   document: mockDocument,
   formatImportLine,
   hasImportCycle,
   normalizePrimitiveType,
   parseImportLine,
   primitiveTypes: PRIMITIVE_TYPES,
   resolveImportValue,
   resolveScopeColumns,
   runLines,
   runTransportedScripts,
  })
  return { f, mockBody, mockWindow, dispatchDocEvent, dispatchWinEvent }
 }

 try {
  const { f, mockBody, mockWindow, dispatchDocEvent, dispatchWinEvent } = createRuntime('/')
  await f.run(parse(mainSource, '/src/main.fs'))
  const laneControl = f.state['lane-control']
  const rails = laneControl.rails
  const modal = laneControl['lane-modal']

  assert.equal(mockBody.style.backgroundColor, '#202020')
  assert.equal(laneControl['preferences-lane-id'], null)

  // Preferences menu starts closed and mounted on body (not clipped inside top-rail)
  const prefBtn = rails['preferences-btn']
  const prefMenu = rails['preferences-menu']
  assert.ok(mockBody.children.includes(prefMenu))
  assert.equal(prefMenu.hidden, true)
  assert.equal(rails['is-preferences-open'], false)
  assert.equal(rails['preferences-status-el'].textContent, 'No preferences lane set')
  assert.equal(rails['preferences-open-btn'].hidden, true)
  assert.equal(rails['preferences-set-btn'].textContent, 'Set preferences lane')
  assert.equal(rails['preferences-create-btn'].textContent, 'Create preference lane')

  // Clicking wrench opens dropdown centered on wrench; clicking outside or pressing Escape closes it
  await prefBtn.listeners.click({ stopPropagation() {} })
  assert.equal(prefMenu.hidden, false)
  assert.equal(rails['is-preferences-open'], true)
  assert.equal(prefMenu.style.left, '206px')
  assert.equal(prefBtn.attributes['aria-expanded'], 'true')
  await dispatchDocEvent('click', { target: mockBody })
  assert.equal(prefMenu.hidden, true)
  assert.equal(rails['is-preferences-open'], false)

  await prefBtn.listeners.click({ stopPropagation() {} })
  assert.equal(prefMenu.hidden, false)
  await dispatchWinEvent('keydown', { key: 'Escape' })
  assert.equal(prefMenu.hidden, true)

  // Create preference lane -> creates lane, assigns global preferences-lane KV, seeds interface.backgroundColor #202020
  await prefBtn.listeners.click({ stopPropagation() {} })
  await rails['preferences-create-btn'].listeners.click()
  assert.equal(prefMenu.hidden, true)
  assert.equal(f.state.lanes.length, 1)
  const prefLane = f.state.lanes[0]
  assert.equal(prefLane.title, 'Preferences')
  assert.equal(laneControl['preferences-lane-id'], prefLane.id)
  assert.equal(kv.get('preferences-lane'), prefLane.id)
  assert.equal(kv.get(`${prefLane.id}.preferences-lane`), undefined)
  assert.deepEqual(prefLane.notebook.lines, [
   '; to interface ; object',
   '; to interface.backgroundColor #202020',
   '; to interface.scrollbarColor #383838',
  ])
  assert.equal(mockBody.style.backgroundColor, '#202020')
  assert.equal(mockWindow.location.pathname, `/${prefLane.id}`)

  // Editing interface.backgroundColor live updates document.body.style.backgroundColor immediately
  prefLane.notebook.rows[1]['input-el'].value = '; to interface.backgroundColor #1a2b3c'
  await prefLane.notebook.rows[1]['input-el'].listeners.input()
  assert.equal(mockBody.style.backgroundColor, '#1a2b3c')

  // Close preferences lane and simulate full app reload at '/' -> preferences still load & apply on startup
  await laneControl.close(prefLane.id)
  assert.equal(f.state.lanes.length, 0)

  const reloaded = createRuntime('/')
  await reloaded.f.run(parse(mainSource, '/src/main.fs'))
  const rLaneControl = reloaded.f.state['lane-control']
  const rRails = rLaneControl.rails
  const rModal = rLaneControl['lane-modal']
  assert.equal(reloaded.f.state.lanes.length, 0)
  assert.equal(rLaneControl['preferences-lane-id'], prefLane.id)
  assert.equal(reloaded.mockBody.style.backgroundColor, '#1a2b3c')

  // Opening wrench dropdown when preferences lane is set shows its title and "Open preferences lane"
  await rRails['preferences-btn'].listeners.click({ stopPropagation() {} })
  assert.equal(rRails['preferences-status-el'].textContent, 'Preferences: Preferences')
  assert.equal(rRails['preferences-open-btn'].hidden, false)
  assert.equal(rRails['preferences-open-btn'].textContent, 'Open preferences lane')

  // Clicking "Open preferences lane" opens it cleanly
  await rRails['preferences-open-btn'].listeners.click()
  assert.equal(rRails['preferences-menu'].hidden, true)
  assert.equal(reloaded.f.state.lanes.length, 1)
  assert.equal(reloaded.f.state.lanes[0].id, prefLane.id)

  // Create a custom theme lane with its own script, then test "Set preferences lane" picker (MUST NOT seed/overwrite script!)
  await reloaded.f.state.tableHeadRowAddButton.listeners.click()
  const customLane = reloaded.f.state.lanes[1]
  await rLaneControl.rename(customLane.id, 'Ocean Theme')
  customLane.notebook.rows[0]['input-el'].value = '; to interface ; object'
  await customLane.notebook.rows[0]['input-el'].listeners.input()
  await customLane.notebook.rows[0]['input-el'].listeners.keydown({ key: 'Enter', preventDefault() {} })
  customLane.notebook.rows[1]['input-el'].value = '; to interface.backgroundColor #0d1b2a'
  await customLane.notebook.rows[1]['input-el'].listeners.input()

  // Also create an empty lane to ensure switching to it does NOT seed it and resets background to #202020
  await reloaded.f.state.tableHeadRowAddButton.listeners.click()
  const emptyLane = reloaded.f.state.lanes[2]
  await rLaneControl.rename(emptyLane.id, 'Blank Slate')

  // Use "Set preferences lane" -> picks Empty Lane -> does NOT seed Empty Lane, resets body bg to #202020
  await rRails['preferences-btn'].listeners.click({ stopPropagation() {} })
  await rRails['preferences-set-btn'].listeners.click()
  assert.equal(rModal['is-open'], true)
  assert.equal(rModal.mode, 'pick')
  assert.equal(rModal['heading-el'].textContent, 'Set Preferences Lane')
  await rModal.items.find(it => it.entry.id === emptyLane.id)['select-btn'].listeners.click()
  assert.equal(rLaneControl['preferences-lane-id'], emptyLane.id)
  assert.equal(kv.get('preferences-lane'), emptyLane.id)
  assert.deepEqual(emptyLane.notebook.lines, [''])
  assert.equal(reloaded.mockBody.style.backgroundColor, '#202020')

  // Use "Set preferences lane" -> picks Ocean Theme -> applies #0d1b2a without overwriting Ocean Theme's lines
  await rRails['preferences-btn'].listeners.click({ stopPropagation() {} })
  await rRails['preferences-set-btn'].listeners.click()
  await rModal.items.find(it => it.entry.id === customLane.id)['select-btn'].listeners.click()
  assert.equal(rLaneControl['preferences-lane-id'], customLane.id)
  assert.equal(reloaded.mockBody.style.backgroundColor, '#0d1b2a')
  assert.deepEqual(customLane.notebook.lines, [
   '; to interface ; object',
   '; to interface.backgroundColor #0d1b2a',
  ])

  // Clear preferences lane via picker Clear button -> clears global key, resets background to #202020
  await rRails['preferences-btn'].listeners.click({ stopPropagation() {} })
  await rRails['preferences-set-btn'].listeners.click()
  assert.equal(rModal['clear-btn'].hidden, false)
  await rModal['clear-btn'].listeners.click()
  assert.equal(rLaneControl['preferences-lane-id'], null)
  assert.equal(kv.get('preferences-lane'), '')
  assert.equal(reloaded.mockBody.style.backgroundColor, '#202020')
  assert.equal(rRails['preferences-status-el'].textContent, 'No preferences lane set')
  assert.equal(rRails['preferences-open-btn'].hidden, true)

  // interface.rails.top.elements renders chip elements in top-rail and Configure Lane "Run every 30 minutes" schedules a singleton cron
  const activeTimers = new Map()
  let nextTimerId = 1
  reloaded.mockWindow.setInterval = (fn, ms) => {
   const id = `cron-timer-${nextTimerId++}`
   activeTimers.set(id, { fn, ms })
   return id
  }
  reloaded.mockWindow.clearInterval = id => {
   activeTimers.delete(id)
  }

  // Re-assign customLane as preferences lane and set interface.rails.top.elements
  await rLaneControl['set-preferences-lane'](customLane.id)
  await customLane.notebook['add-line']('; to interface.rails ; object')
  await customLane.notebook['add-line']('; to interface.rails.top ; object')
  await customLane.notebook['add-line']("; to interface.rails.top.elements { [ object { text '$9.34' } { color '#40a000' } { title 'balance' } ] [ object { text '$12.50' } { color '#a04000' } ] }")
  assert.equal(rRails['top-elements'].length, 2)
  assert.equal(rRails['top-rail'].children.length, 9)
  assert.equal(rRails['top-rail'].children[8], rRails['clock-btn'])
  assert.equal(rRails['top-elements'][0].className, 'top-rail-chip')
  assert.equal(rRails['top-elements'][0].textContent, '$9.34')
  assert.equal(rRails['top-elements'][0].style.backgroundColor, '#40a000')
  assert.equal(rRails['top-elements'][0].title, 'balance')
  assert.equal(rRails['top-elements'][1].textContent, '$12.50')
  assert.equal(rRails['top-elements'][1].style.backgroundColor, '#a04000')

  // Open Configure Lane modal on customLane and enable "Run every 30 minutes"
  await rLaneControl.configure(customLane.id)
  const cfgModal = rLaneControl['config-modal']
  assert.equal(cfgModal['cron-30m-check'].checked, false)
  cfgModal['cron-30m-check'].checked = true
  await cfgModal.form.listeners.submit({ preventDefault() {} })
  assert.equal(customLane.features.runEvery30Minutes, true)
  assert.equal(activeTimers.size, 1)
  const [firstTimerId, firstTimer] = [...activeTimers.entries()][0]
  assert.equal(firstTimer.ms, 30 * 60 * 1000)

  // Re-syncing cron replaces timer cleanly so only one singleton timer ever exists for the lane
  await rLaneControl['sync-lane-cron'](customLane.id, customLane.features)
  assert.equal(activeTimers.size, 1)
  const [secondTimerId] = [...activeTimers.entries()][0]
  assert.notEqual(secondTimerId, firstTimerId)

  // Singleton execution lock prevents overlapping cron runs if one is already in flight
  rLaneControl['cron-running'][customLane.id] = true
  const skippedRes = await rLaneControl['run-lane-cron'](customLane.id)
  assert.equal(skippedRes.ok, false)
  assert.equal(skippedRes.skipped, true)
  assert.equal(skippedRes.reason, 'already-running')
  rLaneControl['cron-running'][customLane.id] = false

  // Running the cron updates top rail elements when the preferences lane script produces new elements
  customLane.notebook.rows[4]['input-el'].value = "; to interface.rails.top.elements { [ object { text '$19.99' } { color '#40a000' } ] }"
  await customLane.notebook.rows[4]['input-el'].listeners.input()
  const cronRes = await rLaneControl['run-lane-cron'](customLane.id)
  assert.equal(cronRes.ok, true)
  assert.equal(rRails['top-elements'].length, 1)
  assert.equal(rRails['top-elements'][0].textContent, '$19.99')

  // Top-rail chip popover dropdown: clicking a chip shows title, Last synced timestamp, [ Sync now ], and [ Copy ]
  const copiedTexts = []
  reloaded.mockWindow.navigator = {
   clipboard: {
    writeText: async txt => {
     copiedTexts.push(txt)
    },
   },
  }
  let liveBalanceResponse = '250000'
  reloaded.mockWindow.fetch = async url => {
   if (url === 'https://data.nateferrero.com/beacon/balance') {
    return {
     ok: true,
     text: async () => liveBalanceResponse,
    }
   }
   throw new Error(`Unexpected chip fetch: ${url}`)
  }

  // Seed a "chips" table on customLane with title, url, format, color, prefix, value, fetched
  const initialSyncedIso = '2026-11-26T12:00:00.000Z'
  customLane.notebook['data-view'].tables = [
   {
    id: 'tbl-chips',
    name: 'chips',
    columns: [
     { id: 'c-title', name: 'title', type: 'text', multiple: false },
     { id: 'c-url', name: 'url', type: 'text', multiple: false },
     { id: 'c-format', name: 'format', type: 'text', multiple: false },
     { id: 'c-color', name: 'color', type: 'text', multiple: false },
     { id: 'c-prefix', name: 'prefix', type: 'text', multiple: false },
     { id: 'c-value', name: 'value', type: 'text', multiple: false },
     { id: 'c-fetched', name: 'fetched', type: 'datetime', multiple: false },
    ],
    rows: [
     {
      id: 'row-bal',
      values: {
       'c-title': 'Balance',
       'c-url': 'https://data.nateferrero.com/beacon/balance',
       'c-format': 'fixed_2',
       'c-color': '#40a000',
       'c-prefix': '$',
       'c-value': '111249',
       'c-fetched': initialSyncedIso,
      },
     },
    ],
   },
  ]
  await customLane.notebook['data-view'].save()
  customLane.notebook.rows[4]['input-el'].value = "; to chip $chips.0\n; to shouldFetch [ propertyIs '' chip.fetched ]\n; to curVal $chip.value\n; to curFetched $chip.fetched\n; condition { propertyIs true shouldFetch } (\n ; to res !fetch $chip.url\n [ match\n  { $res.ok (\n   ; to txt !res.text\n   ; set $txt curVal\n   ; set '2026-11-26T14:30:00.000Z' curFetched\n   !syncTable chips { [ object { title $chip.title } { url $chip.url } { format $chip.format } { color $chip.color } { prefix $chip.prefix } { value $curVal } { fetched $curFetched } ] } url\n  ) }\n ]\n)\n; to chip $chips.0\n; to interface.rails.top.elements { [ object { text [ ; add $chip.prefix $chip.value ] } { color $chip.color } { title $chip.title } { url $chip.url } { value $chip.value } { format $chip.format } { prefix $chip.prefix } { fetched $chip.fetched } { row $chip } ] }"
  await customLane.notebook.rows[4]['input-el'].listeners.input()

  assert.equal(rRails['top-elements'].length, 1)
  assert.equal(rRails['top-elements'][0].textContent, '$111249')
  assert.equal(rRails['chip-menu'].hidden, true)

  // Click the chip -> opens the popover dropdown below it
  await rRails['top-elements'][0].listeners.click({ stopPropagation() {} })
  assert.equal(rRails['is-chip-menu-open'], true)
  assert.equal(rRails['chip-menu'].hidden, false)
  assert.equal(rRails['chip-menu-title-el'].textContent, 'Balance')
  assert.equal(
   rRails['chip-menu-synced-el'].textContent,
   `Last synced: ${formatLineTimestamp(initialSyncedIso).display}`
  )
  assert.equal(rRails['chip-sync-btn'].textContent, 'Sync now')
  assert.equal(rRails['chip-copy-btn'].textContent, 'Copy')

  // Click [ Copy ] -> copies the chip row as JSON including title, value, and fetched time
  await rRails['chip-copy-btn'].listeners.click({ stopPropagation() {} })
  assert.equal(copiedTexts.length, 1)
  assert.equal(rRails['chip-copy-btn'].textContent, 'Copied!')
  assert.deepEqual(JSON.parse(copiedTexts[0]), {
   title: 'Balance',
   url: 'https://data.nateferrero.com/beacon/balance',
   format: 'fixed_2',
   color: '#40a000',
   prefix: '$',
   value: '111249',
   fetched: initialSyncedIso,
  })

  // Click [ Sync now ] -> forces an immediate sync, updates the chips table and top-rail chip, and refreshes the popover
  await rRails['chip-sync-btn'].listeners.click({ stopPropagation() {} })
  assert.equal(rRails['is-chip-menu-open'], true)
  assert.equal(rRails['chip-menu'].hidden, false)
  assert.equal(rRails['top-elements'][0].textContent, '$250000')
  assert.equal(
   rRails['chip-menu-synced-el'].textContent,
   `Last synced: ${formatLineTimestamp('2026-11-26T14:30:00.000Z').display}`
  )

  // Copy again after Sync now -> copies updated value and sync time
  await rRails['chip-copy-btn'].listeners.click({ stopPropagation() {} })
  assert.equal(copiedTexts.length, 2)
  assert.deepEqual(JSON.parse(copiedTexts[1]), {
   title: 'Balance',
   url: 'https://data.nateferrero.com/beacon/balance',
   format: 'fixed_2',
   color: '#40a000',
   prefix: '$',
   value: '250000',
   fetched: '2026-11-26T14:30:00.000Z',
  })

  // Clicking the active chip again closes the popover
  await rRails['top-elements'][0].listeners.click({ stopPropagation() {} })
  assert.equal(rRails['is-chip-menu-open'], false)
  assert.equal(rRails['chip-menu'].hidden, true)

  // Keyboard Enter opens the popover, failed Sync now preserves previous fetched timestamp, and Escape/outside click closes it
  await rRails['top-elements'][0].listeners.keydown({ key: 'Enter', preventDefault() {}, stopPropagation() {} })
  assert.equal(rRails['is-chip-menu-open'], true)
  reloaded.mockWindow.fetch = async () => ({ ok: false, status: 503, text: async () => '' })
  await rRails['chip-sync-btn'].listeners.click({ stopPropagation() {} })
  assert.equal(rRails['top-elements'][0].textContent, '$250000')
  assert.equal(
   rRails['chip-menu-synced-el'].textContent,
   `Last synced: ${formatLineTimestamp('2026-11-26T14:30:00.000Z').display}`
  )
  await reloaded.dispatchWinEvent('keydown', { key: 'Escape' })
  assert.equal(rRails['is-chip-menu-open'], false)
  assert.equal(rRails['chip-menu'].hidden, true)

  // Sync now also works when the preferences lane is on the Data tab (or closed) via headless stored evaluation, and handles keyword chip titles safely
  customLane.notebook['data-view'].tables[0].rows.push({
   id: 'row-load',
   values: {
    'c-title': 'load',
    'c-url': 'https://data.nateferrero.com/beacon/load',
    'c-format': 'fixed_2',
    'c-color': '#2060a0',
    'c-prefix': '',
    'c-value': '42',
    'c-fetched': initialSyncedIso,
   },
  })
  await customLane.notebook['data-view'].save()
  customLane.notebook.rows[4]['input-el'].value = "; to outEls {}\n; to nextRows {}\n; to hit ; object { ok false }\n; each $chips (\n ; to { chip } $argv\n ; to need [ propertyIs '' chip.fetched ]\n ; to cv $chip.value\n ; to cf $chip.fetched\n ; condition { propertyIs true need } (\n  ; to r !fetch $chip.url\n  ; to t !r.text\n  ; set $t cv\n  ; set '2026-11-26T15:00:00.000Z' cf\n  ; set true hit.ok\n )\n !nextRows.push [ object { title $chip.title } { url $chip.url } { format $chip.format } { color $chip.color } { prefix $chip.prefix } { value $cv } { fetched $cf } ]\n)\n; condition { propertyIs true hit.ok } : !syncTable chips $nextRows url\n; each $chips (\n ; to { chip } $argv\n !outEls.push [ object { text [ ; add $chip.prefix $chip.value ] } { color $chip.color } { title $chip.title } { url $chip.url } { value $chip.value } { format $chip.format } { prefix $chip.prefix } { fetched $chip.fetched } { row $chip } ]\n)\n; to interface.rails.top.elements $outEls"
  await customLane.notebook.rows[4]['input-el'].listeners.input()
  assert.equal(rRails['top-elements'].length, 2)
  assert.equal(rRails['top-elements'][1].textContent, '42')

  // Switch preferences lane to Data tab, open second chip ('load'), and click [ Sync now ] -> only 'load' fetches!
  await customLane.notebook['set-tab']('data')
  const fetchedUrls = []
  reloaded.mockWindow.fetch = async url => {
   fetchedUrls.push(url)
   if (url === 'https://data.nateferrero.com/beacon/load') {
    return { ok: true, text: async () => '99' }
   }
   throw new Error(`Unexpected chip fetch: ${url}`)
  }
  await rRails['top-elements'][1].listeners.click({ stopPropagation() {} })
  assert.equal(rRails['chip-menu-title-el'].textContent, 'load')
  await rRails['chip-sync-btn'].listeners.click({ stopPropagation() {} })
  assert.deepEqual(fetchedUrls, ['https://data.nateferrero.com/beacon/load'])
  assert.equal(rRails['top-elements'][0].textContent, '$250000')
  assert.equal(rRails['top-elements'][1].textContent, '99')
  assert.equal(
   rRails['chip-menu-synced-el'].textContent,
   `Last synced: ${formatLineTimestamp('2026-11-26T15:00:00.000Z').display}`
  )
  // Switching between 24h and 12h updates an open chip popover live and applies when reopening chips
  await rLaneControl['set-clock-hour-format']('24h')
  assert.equal(rRails['is-chip-menu-open'], true)
  assert.equal(
   rRails['chip-menu-synced-el'].textContent,
   `Last synced: ${formatLineTimestamp('2026-11-26T15:00:00.000Z', { hourFormat: '24h' }).display}`
  )
  assert.doesNotMatch(rRails['chip-menu-synced-el'].textContent, /\b(AM|PM)\b/i)

  await reloaded.dispatchDocEvent('click', { target: reloaded.mockBody })
  assert.equal(rRails['is-chip-menu-open'], false)
  await rRails['top-elements'][0].listeners.click({ stopPropagation() {} })
  assert.equal(rRails['is-chip-menu-open'], true)
  assert.equal(
   rRails['chip-menu-synced-el'].textContent,
   `Last synced: ${formatLineTimestamp('2026-11-26T14:30:00.000Z', { hourFormat: '24h' }).display}`
  )
  assert.doesNotMatch(rRails['chip-menu-synced-el'].textContent, /\b(AM|PM)\b/i)

  await rRails['clock-btn'].listeners.click({ stopPropagation() {} })
  await rRails['clock-12h-btn'].listeners.click({ stopPropagation() {} })
  await rRails['top-elements'][0].listeners.click({ stopPropagation() {} })
  assert.equal(rRails['is-chip-menu-open'], true)
  assert.equal(
   rRails['chip-menu-synced-el'].textContent,
   `Last synced: ${formatLineTimestamp('2026-11-26T14:30:00.000Z', { hourFormat: '12h' }).display}`
  )
  assert.match(rRails['chip-menu-synced-el'].textContent, /\b(AM|PM)\b/i)

  await rRails['clock-btn'].listeners.click({ stopPropagation() {} })
  await rRails['clock-24h-btn'].listeners.click({ stopPropagation() {} })
  await rRails['top-elements'][0].listeners.click({ stopPropagation() {} })
  assert.equal(
   rRails['chip-menu-synced-el'].textContent,
   `Last synced: ${formatLineTimestamp('2026-11-26T14:30:00.000Z', { hourFormat: '24h' }).display}`
  )
  assert.doesNotMatch(rRails['chip-menu-synced-el'].textContent, /\b(AM|PM)\b/i)

  await rLaneControl['set-clock-hour-format']('12h')
  assert.equal(
   rRails['chip-menu-synced-el'].textContent,
   `Last synced: ${formatLineTimestamp('2026-11-26T14:30:00.000Z', { hourFormat: '12h' }).display}`
  )

  // Configure America/Los_Angeles in Preferences timezones and select Los Angeles -> popover and Data datetime cells convert and show PST live!
  customLane.notebook['data-view'].tables.push({
   id: 'tbl-tz',
   name: 'timezones',
   columns: [{ id: 'c-name', name: 'name', type: 'text', multiple: false }],
   rows: [{ id: 'row-la', values: { 'c-name': 'America/Los_Angeles' } }],
  })
  await customLane.notebook['data-view'].save()
  await customLane.notebook['data-view']['select-table']('tbl-chips', true)
  await rLaneControl['sync-preferences-timezones']()
  await rLaneControl['set-clock-timezone']('America/Los_Angeles')
  assert.equal(rLaneControl['clock-timezone'], 'America/Los_Angeles')
  assert.equal(rRails['is-chip-menu-open'], true)
  assert.equal(rRails['chip-menu-synced-el'].textContent, 'Last synced: Nov 26, 2026, 06:30:00 AM PST')
  assert.equal(customLane.notebook['data-view']['grid-rows'][0].cells[6]['input-el'].value, 'Nov 26, 2026, 06:30:00 AM PST')
  assert.equal(customLane.notebook['data-view']['grid-rows'][1].cells[6]['input-el'].value, 'Nov 26, 2026, 07:00:00 AM PST')

  await rLaneControl['set-clock-hour-format']('24h')
  assert.equal(rRails['chip-menu-synced-el'].textContent, 'Last synced: Nov 26, 2026, 06:30:00 PST')
  await rRails['top-elements'][1].listeners.click({ stopPropagation() {} })
  assert.equal(rRails['chip-menu-title-el'].textContent, 'load')
  assert.equal(rRails['chip-menu-synced-el'].textContent, 'Last synced: Nov 26, 2026, 07:00:00 PST')
  assert.equal(customLane.notebook['data-view']['grid-rows'][1].cells[6]['input-el'].value, 'Nov 26, 2026, 07:00:00 PST')

  await reloaded.dispatchDocEvent('click', { target: reloaded.mockBody })
  assert.equal(rRails['is-chip-menu-open'], false)
  assert.equal(rRails['chip-menu'].hidden, true)

  // Fallback chip formatter supports json (with format_options.json.path), decimal, integer, and text
  const jsonRootItem = {
   title: 'Track',
   url: 'https://data.nateferrero.com/beacon/state',
   format: 'json',
   prefix: 'Nate is in ',
   format_options: { json: { path: '' } },
   text: '',
  }
  const jsonPathItem = {
   title: 'City',
   url: 'https://data.nateferrero.com/beacon/loc',
   format: 'json',
   prefix: 'City: ',
   format_options: { json: { path: 'geo.city' } },
   text: '',
  }
  const decItem = {
   title: 'Temp',
   url: 'https://data.nateferrero.com/beacon/temp',
   format: 'decimal',
   prefix: '',
   text: '',
  }
  const intItem = {
   title: 'Count',
   url: 'https://data.nateferrero.com/beacon/count',
   format: 'integer',
   prefix: '#',
   text: '',
  }
  const txtItem = {
   title: 'Note',
   url: 'https://data.nateferrero.com/beacon/note',
   format: 'text',
   prefix: 'Status: ',
   text: '',
  }
  rLaneControl.preferences.interface.rails.top.elements = [jsonRootItem, jsonPathItem, decItem, intItem, txtItem]
  reloaded.mockWindow.fetch = async url => {
   if (url.endsWith('/state')) return { ok: true, text: async () => '"MI"' }
   if (url.endsWith('/loc')) return { ok: true, text: async () => '{"geo":{"city":"Detroit"}}' }
   if (url.endsWith('/temp')) return { ok: true, text: async () => '72.5px' }
   if (url.endsWith('/count')) return { ok: true, text: async () => '42.9' }
   if (url.endsWith('/note')) return { ok: true, text: async () => 'ok' }
   throw new Error(`Unexpected chip fetch: ${url}`)
  }
  await rLaneControl['sync-top-rail-chip'](jsonRootItem)
  await rLaneControl['sync-top-rail-chip'](jsonPathItem)
  await rLaneControl['sync-top-rail-chip'](decItem)
  await rLaneControl['sync-top-rail-chip'](intItem)
  await rLaneControl['sync-top-rail-chip'](txtItem)
  assert.equal(jsonRootItem.text, 'Nate is in MI')
  assert.equal(jsonPathItem.text, 'City: Detroit')
  assert.equal(decItem.text, '72.5')
  assert.equal(intItem.text, '#42')
  assert.equal(txtItem.text, 'Status: ok')
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Scrollbar color helpers: resolveScrollbarColor, seedPreferencesScrollbarSource, and seedPreferencesScrollbarRecords', () => {
 assert.equal(DEFAULT_SCROLLBAR_COLOR, '#383838')
 assert.deepEqual(resolveScrollbarColor(null), {
  color: '#383838',
  css: '#383838 transparent',
  thumb: '#383838',
  track: 'transparent',
 })
 assert.deepEqual(resolveScrollbarColor(''), {
  color: '#383838',
  css: '#383838 transparent',
  thumb: '#383838',
  track: 'transparent',
 })
 assert.deepEqual(resolveScrollbarColor('#9ce5ff'), {
  color: '#9ce5ff',
  css: '#9ce5ff transparent',
  thumb: '#9ce5ff',
  track: 'transparent',
 })
 assert.deepEqual(resolveScrollbarColor('rgb(56, 56, 56)'), {
  color: 'rgb(56, 56, 56)',
  css: 'rgb(56, 56, 56) transparent',
  thumb: 'rgb(56, 56, 56)',
  track: 'transparent',
 })
 assert.deepEqual(resolveScrollbarColor('#555555 #181818'), {
  color: '#555555 #181818',
  css: '#555555 #181818',
  thumb: '#555555',
  track: '#181818',
 })
 assert.deepEqual(resolveScrollbarColor('auto'), {
  color: 'auto',
  css: 'auto',
  thumb: '',
  track: '',
 })

 // Seeds scrollbarColor right after existing interface lines while preserving line IDs & updatedAt
 let seq = 0
 const seededExisting = seedPreferencesScrollbarRecords(
  [
   { id: 'ln-1', text: '; to interface ; object', updatedAt: '2026-11-24T10:00:00.000Z' },
   { id: 'ln-2', text: '; to interface.backgroundColor #1a2b3c', updatedAt: '2026-11-24T10:05:00.000Z' },
   { id: 'ln-3', text: '; to extra 42', updatedAt: '2026-11-24T10:10:00.000Z' },
  ],
  '#383838',
  () => `ln-new-${++seq}`
 )
 assert.equal(seededExisting.seeded, true)
 assert.deepEqual(seededExisting.lines, [
  '; to interface ; object',
  '; to interface.backgroundColor #1a2b3c',
  '; to interface.scrollbarColor #383838',
  '; to extra 42',
 ])
 assert.equal(seededExisting.records[0].id, 'ln-1')
 assert.equal(seededExisting.records[0].updatedAt, '2026-11-24T10:00:00.000Z')
 assert.equal(seededExisting.records[1].id, 'ln-2')
 assert.equal(seededExisting.records[1].updatedAt, '2026-11-24T10:05:00.000Z')
 assert.equal(seededExisting.records[2].id, 'ln-new-1')
 assert.equal(seededExisting.records[2].updatedAt, null)
 assert.equal(seededExisting.records[3].id, 'ln-3')

 // Re-running is idempotent
 const secondPass = seedPreferencesScrollbarRecords(seededExisting.records)
 assert.equal(secondPass.seeded, false)
 assert.deepEqual(secondPass.lines, seededExisting.lines)

 // Recognizes set, object literal, assign, and commented scrollbarColor without duplicating
 for (const lines of [
  ['; to interface ; object', '; set #9ce5ff interface.scrollbarColor'],
  ['; to interface [ object { backgroundColor #202020 } { scrollbarColor #444444 } ]'],
  ['; to interface ; object', '; assign interface { scrollbarColor #444444 }'],
  ['; to interface ; object', '-- ; to interface.scrollbarColor #383838'],
 ]) {
  const res = seedPreferencesScrollbarSource(lines)
  assert.equal(res.seeded, false)
  assert.deepEqual(res.lines, lines)
 }

 // Seeds interface object + scrollbarColor into blank lane without leaving an empty leading row
 const seededBlank = seedPreferencesScrollbarSource([''])
 assert.equal(seededBlank.seeded, true)
 assert.deepEqual(seededBlank.lines, [
  '; to interface ; object',
  '; to interface.scrollbarColor #383838',
 ])
})

test('Default #383838 scrollbar styling, live interface.scrollbarColor preference, and seeding on create or opening already-selected preferences lane', async () => {
 const indexHtml = await fs.readFile(new URL('./index.html', import.meta.url), 'utf8')
 assert.match(indexHtml, /:root\s*\{[^}]*--scrollbar-color:\s*#383838 transparent;[^}]*scrollbar-color:\s*var\(--scrollbar-color\);/s)
 assert.match(indexHtml, /@supports not \(scrollbar-color:\s*#383838 transparent\)/)
 assert.match(indexHtml, /\.side-rail\s*\{[^}]*background-color:\s*#383838;/s)

 const mainSource = await fs.readFile(new URL('./src/main.fs', import.meta.url), 'utf8')
 const laneSource = await fs.readFile(new URL('./src/lane-control.fs', import.meta.url), 'utf8')
 const notebookSource = await fs.readFile(new URL('./src/lane-notebook.fs', import.meta.url), 'utf8')
 const inputsSource = await fs.readFile(new URL('./src/lane-inputs.fs', import.meta.url), 'utf8')
 const scopeSource = await fs.readFile(new URL('./src/lane-scope.fs', import.meta.url), 'utf8')
 const dataSource = await fs.readFile(new URL('./src/lane-data.fs', import.meta.url), 'utf8')
 const confirmModalSource = await fs.readFile(new URL('./src/confirm-modal.fs', import.meta.url), 'utf8')
 const rowPickerModalSource = await fs.readFile(new URL('./src/lane-row-picker-modal.fs', import.meta.url), 'utf8')
 const outputSource = await fs.readFile(new URL('./src/lane-output.fs', import.meta.url), 'utf8')
 const modalSource = await fs.readFile(new URL('./src/lane-modal.fs', import.meta.url), 'utf8')
 const configModalSource = await fs.readFile(new URL('./src/lane-config-modal.fs', import.meta.url), 'utf8')
 const importModalSource = await fs.readFile(new URL('./src/lane-import-modal.fs', import.meta.url), 'utf8')
 const railsSource = await fs.readFile(new URL('./src/lane-rails.fs', import.meta.url), 'utf8')

 function createMockElement(tag) {
  const styleProps = {}
  return {
   tag,
   nodeType: 1,
   style: {
    setProperty(name, value) { styleProps[name] = value; this[name] = value },
    removeProperty(name) { delete styleProps[name]; delete this[name] },
    getPropertyValue(name) { return styleProps[name] || '' },
   },
   attributes: {},
   children: [],
   parentNode: null,
   listeners: {},
   textContent: '',
   innerHTML: '',
   value: '',
   className: '',
   title: '',
   hidden: false,
   disabled: false,
   removed: false,
   focused: false,
   rect: { left: 200, width: 12, top: 2, height: 12 },
   getBoundingClientRect() { return this.rect },
   contains(target) {
    if (target === this) { return true }
    return this.children.some(child => typeof child.contains === 'function' && child.contains(target))
   },
   setAttribute(name, value) { this.attributes[name] = value },
   appendChild(child) {
    if (child.parentNode) {
     const prevIdx = child.parentNode.children.indexOf(child)
     if (prevIdx !== -1) { child.parentNode.children.splice(prevIdx, 1) }
    }
    child.parentNode = this
    child.removed = false
    this.children.push(child)
    return child
   },
   insertBefore(child, ref) {
    if (child.parentNode) {
     const prevIdx = child.parentNode.children.indexOf(child)
     if (prevIdx !== -1) { child.parentNode.children.splice(prevIdx, 1) }
    }
    child.parentNode = this
    child.removed = false
    const idx = this.children.indexOf(ref)
    if (idx === -1) { this.children.push(child) }
    else { this.children.splice(idx, 0, child) }
    return child
   },
   addEventListener(event, handler) { this.listeners[event] = handler },
   focus() { this.focused = true },
   select() {},
   remove() {
    this.removed = true
    if (this.parentNode) {
     const idx = this.parentNode.children.indexOf(this)
     if (idx !== -1) { this.parentNode.children.splice(idx, 1) }
     this.parentNode = null
    }
   },
  }
 }

 const kv = new Map()
 function createMockKV(prefix = '') {
  const qualify = key => (prefix ? `${prefix}.${key}` : key)
  return {
   namespace(name) { return createMockKV(qualify(name)) },
   async get(key) { return kv.has(qualify(key)) ? kv.get(qualify(key)) : null },
   async set(key, value) { kv.set(qualify(key), value) },
   async delete(key) { kv.delete(qualify(key)) },
  }
 }

 let uuid = 0
 const origFetch = globalThis.fetch
 globalThis.fetch = async url => {
  if (url === '/src/lane-control.fs') { return { text: async () => laneSource } }
  if (url === '/src/lane-notebook.fs') { return { text: async () => notebookSource } }
  if (url === '/src/lane-inputs.fs') { return { text: async () => inputsSource } }
  if (url === '/src/lane-scope.fs') { return { text: async () => scopeSource } }
  if (url === '/src/lane-data.fs') { return { text: async () => dataSource } }
  if (url === '/src/confirm-modal.fs') { return { text: async () => confirmModalSource } }
  if (url === '/src/lane-row-picker-modal.fs') { return { text: async () => rowPickerModalSource } }
  if (url === '/src/lane-output.fs') { return { text: async () => outputSource } }
  if (url === '/src/lane-modal.fs') { return { text: async () => modalSource } }
  if (url === '/src/lane-config-modal.fs') { return { text: async () => configModalSource } }
  if (url === '/src/lane-import-modal.fs') { return { text: async () => importModalSource } }
  if (url === '/src/lane-rails.fs') { return { text: async () => railsSource } }
  if (url === '/src/lane-line-info-modal.fs') { return { text: async () => lineInfoModalSource } }
  if (url === '/src/lane-export-modal.fs') { return { text: async () => exportModalSource } }
  if (url === '/src/lane-export-deploy-modal.fs') { return { text: async () => exportDeployModalSource } }
  if (url === '/src/lane-server.fs') { return { text: async () => laneServerSource } }
  if (url === '/src/lane-story.fs') { return { text: async () => laneStorySource } }
  if (url === '/src/lane-servers-modal.fs') { return { text: async () => laneServersModalSource } }
  if (url === '/src/lane-terminal-modal.fs') { return { text: async () => laneTerminalModalSource } }
  if (url === '/src/lane-session-modal.fs') { return { text: async () => sessionModalSource } }
  if (url === '/src/lane-package-modal.fs') { return { text: async () => packageModalSource } }
  if (url === '/src/lane-dir-modal.fs') { return { text: async () => dirModalSource } }
  throw new Error(`Unexpected fetch: ${url}`)
 }

 function createRuntime(initialPathname = '/') {
  const mockHtml = createMockElement('html')
  const mockBody = createMockElement('body')
  const mockDocument = {
   body: mockBody,
   documentElement: mockHtml,
   fullscreenElement: null,
   createElement: createMockElement,
   addEventListener() {},
  }
  const mockWindow = {
   Array,
   Boolean,
   Date,
   JSON,
   Math,
   Number,
   Object,
   Reflect,
   innerHeight: 600,
   decodeURIComponent,
   crypto: { randomUUID: () => `sb-uuid-${++uuid}` },
   history: { pushState(_s, _t, url) { mockWindow.location.pathname = url } },
   location: { pathname: initialPathname, search: '', hash: '' },
   addEventListener() {},
   removeEventListener() {},
  }
  mockDocument.defaultView = mockWindow
  const f = field({
   ...DATA_RUNTIME_ENV,
   console: { log() {} },
   createIdleTracker,
   data: createMockKV(),
   defaultValueForType,
   document: mockDocument,
   formatImportLine,
   hasImportCycle,
   normalizePrimitiveType,
   parseImportLine,
   primitiveTypes: PRIMITIVE_TYPES,
   resolveImportValue,
   resolveScopeColumns,
   runLines,
   runTransportedScripts,
  })
  return { f, mockHtml, mockBody, mockWindow }
 }

 try {
  // 1. Pre-existing legacy preferences lane without interface.scrollbarColor in KV
  const rootKv = createMockKV()
  const legacyPrefId = 'legacy-pref-lane'
  await rootKv.set('preferences-lane', legacyPrefId)
  await rootKv.namespace(legacyPrefId).set('title', 'My Prefs')
  await saveLaneScript(
   rootKv,
   rootKv.namespace(legacyPrefId),
   legacyPrefId,
   [
    '; to interface ; object',
    '; to interface.backgroundColor #1b222c',
   ],
   null,
   '2026-11-24T09:00:00.000Z'
  )

  // Startup at '/' applies default #383838 scrollbar color without mutating unmounted lane yet
  const boot = createRuntime('/')
  await boot.f.run(parse(mainSource, '/src/main.fs'))
  const laneControl = boot.f.state['lane-control']
  const rails = laneControl.rails
  assert.equal(boot.mockBody.style.backgroundColor, '#1b222c')
  assert.equal(boot.mockHtml.style.scrollbarColor, '#383838 transparent')
  assert.equal(boot.mockHtml.style.getPropertyValue('--scrollbar-color'), '#383838 transparent')
  assert.equal(boot.mockHtml.style.getPropertyValue('--scrollbar-thumb-color'), '#383838')
  assert.equal(laneControl.preferences.interface.scrollbarColor, '#383838')

  // Opening already-selected preferences lane seeds interface.scrollbarColor #383838 when missing
  await rails['preferences-open-btn'].listeners.click()
  assert.equal(boot.f.state.lanes.length, 1)
  const openedPref = boot.f.state.lanes[0]
  assert.equal(openedPref.id, legacyPrefId)
  assert.deepEqual(openedPref.notebook.lines, [
   '; to interface ; object',
   '; to interface.backgroundColor #1b222c',
   '; to interface.scrollbarColor #383838',
  ])
  assert.equal(openedPref.notebook['line-records'][0].updatedAt, '2026-11-24T09:00:00.000Z')
  assert.equal(openedPref.notebook['line-records'][1].updatedAt, '2026-11-24T09:00:00.000Z')

  // Editing interface.scrollbarColor live updates document.documentElement.style.scrollbarColor (both single color and two-color pair)
  openedPref.notebook.rows[2]['input-el'].value = '; to interface.scrollbarColor #9ce5ff'
  await openedPref.notebook.rows[2]['input-el'].listeners.input()
  assert.equal(boot.mockHtml.style.scrollbarColor, '#9ce5ff transparent')
  assert.equal(boot.mockHtml.style.getPropertyValue('--scrollbar-thumb-color'), '#9ce5ff')
  assert.equal(laneControl.preferences.interface.scrollbarColor, '#9ce5ff')

  openedPref.notebook.rows[2]['input-el'].value = "; to interface.scrollbarColor '#66ccff #101820'"
  await openedPref.notebook.rows[2]['input-el'].listeners.input()
  assert.equal(boot.mockHtml.style.scrollbarColor, '#66ccff #101820')
  assert.equal(boot.mockHtml.style.getPropertyValue('--scrollbar-thumb-color'), '#66ccff')
  assert.equal(boot.mockHtml.style.getPropertyValue('--scrollbar-track-color'), '#101820')

  // Re-opening already-selected preferences lane does NOT duplicate or overwrite custom scrollbarColor
  await laneControl.close(legacyPrefId)
  await laneControl['open-preferences-lane']()
  assert.deepEqual(boot.f.state.lanes[0].notebook.lines, [
   '; to interface ; object',
   '; to interface.backgroundColor #1b222c',
   "; to interface.scrollbarColor '#66ccff #101820'",
  ])

  // Selecting an already-open lane via Set Preferences Lane does NOT seed until opened as selected preferences lane
  const customLane = await laneControl.add()
  customLane.notebook.rows[0]['input-el'].value = '; to interface ; object'
  await customLane.notebook.rows[0]['input-el'].listeners.input()
  await laneControl['set-preferences-lane'](customLane.id)
  assert.deepEqual(customLane.notebook.lines, ['; to interface ; object'])
  assert.equal(boot.mockHtml.style.scrollbarColor, '#383838 transparent')

  // Clicking Open preferences lane on that already-mounted selected preferences lane seeds interface.scrollbarColor
  await laneControl['open-preferences-lane']()
  assert.deepEqual(customLane.notebook.lines, [
   '; to interface ; object',
   '; to interface.scrollbarColor #383838',
  ])
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Timezone & top-rail clock helpers: empty fallback to Browser + UTC, canonical extraction, search filtering, and live formatting', () => {
 assert.equal(isValidTimeZone('UTC'), true)
 assert.equal(isValidTimeZone('America/New_York'), true)
 assert.equal(isValidTimeZone('Asia/Tokyo'), true)
 assert.equal(isValidTimeZone('Not/A_Real_Zone'), false)
 assert.equal(isValidTimeZone(''), false)

 const known = listKnownBrowserTimeZones()
 assert.equal(known[0], 'UTC')
 assert.ok(known.includes('America/New_York'))
 assert.ok(known.includes(getBrowserTimeZone()))

 // Blank rows and invalid names are ignored; canonical names are deduplicated
 const extracted = extractTimezoneNames({
  columns: [{ id: 'c-name', name: 'name', type: 'text' }],
  rows: [
   { id: 'r1', values: { 'c-name': '' } },
   { id: 'r2', values: { 'c-name': '  America/Chicago  ' } },
   { id: 'r3', values: { 'c-name': 'Invalid/Zone' } },
   { id: 'r4', values: { 'c-name': 'Asia/Tokyo' } },
   { id: 'r5', values: { 'c-name': 'America/Chicago' } },
  ],
 })
 assert.deepEqual(extracted, ['America/Chicago', 'Asia/Tokyo'])

 // When preferences.timezones is empty, ONLY Browser timezone and UTC are selectable
 const fixedNow = Date.parse('2026-11-26T16:30:45.000Z')
 const emptyOpts = buildTopRailTimezoneOptions([], { browserTimeZone: 'America/Detroit', now: fixedNow })
 assert.equal(emptyOpts.length, 2)
 assert.equal(emptyOpts[0].value, 'browser')
 assert.equal(emptyOpts[0].timeZone, 'America/Detroit')
 assert.equal(emptyOpts[0].label, 'Browser (America/Detroit)')
 assert.equal(emptyOpts[1].value, 'UTC')
 assert.equal(emptyOpts[1].timeZone, 'UTC')

 // Previously selected custom timezone falls back to Browser when preferences.timezones is empty
 assert.equal(resolveActiveClockTimezone('Asia/Tokyo', emptyOpts).value, 'browser')
 assert.equal(resolveActiveClockTimezone('UTC', emptyOpts).value, 'UTC')

 // With configured timezones, Browser + UTC + deduplicated configured zones are available and searchable
 const fullOpts = buildTopRailTimezoneOptions(['UTC', 'Europe/London', 'America/New_York', 'Asia/Tokyo'], {
  browserTimeZone: 'America/Detroit',
  now: fixedNow,
 })
 assert.deepEqual(
  fullOpts.map(o => o.value),
  ['browser', 'UTC', 'Europe/London', 'America/New_York', 'Asia/Tokyo']
 )
 assert.deepEqual(
  filterTimezoneOptions(fullOpts, 'new york').map(o => o.value),
  ['America/New_York']
 )
 assert.deepEqual(
  filterTimezoneOptions(fullOpts, 'tokyo').map(o => o.value),
  ['Asia/Tokyo']
 )

 const utcFormatted = formatTopRailClock(fixedNow, fullOpts[1], undefined, { hourFormat: '12h', showSeconds: true })
 assert.match(utcFormatted.chipText, /04:30:45/)
 assert.match(utcFormatted.chipText, /PM/i)
 assert.match(utcFormatted.chipText, /UTC/)
 assert.equal(utcFormatted.offset, 'UTC+00:00')
 assert.equal(utcFormatted.hourFormat, '12h')
 assert.equal(utcFormatted.showSeconds, true)

 const utc24NoSec = formatTopRailClock(fixedNow, fullOpts[1], undefined, { hourFormat: '24h', showSeconds: false })
 assert.match(utc24NoSec.chipText, /16:30/)
 assert.doesNotMatch(utc24NoSec.chipText, /45/)
 assert.doesNotMatch(utc24NoSec.chipText, /PM/i)
 assert.equal(utc24NoSec.hourFormat, '24h')
 assert.equal(utc24NoSec.showSeconds, false)

 assert.equal(normalizeClockHourFormat('24h'), '24h')
 assert.equal(normalizeClockHourFormat('12h'), '12h')
 assert.equal(normalizeClockShowSeconds('false'), false)
 assert.equal(normalizeClockShowSeconds('true'), true)

 // formatLineTimestamp backwards compatibility & explicit 12h/24h hourFormat options
 const defaultTs = formatLineTimestamp('2026-11-26T17:15:00.000Z')
 assert.equal(defaultTs.known, true)
 assert.equal(defaultTs.iso, '2026-11-26T17:15:00.000Z')
 assert.ok(defaultTs.display.length > 0)

 const ts24Afternoon = formatLineTimestamp('2026-11-26T17:15:00.000Z', { hourFormat: '24h', timeZone: 'UTC', locale: 'en-US' })
 assert.equal(ts24Afternoon.display, 'Nov 26, 2026, 17:15:00 UTC')

 const ts24Midnight = formatLineTimestamp('2026-11-26T00:15:00.000Z', { hourFormat: '24h', timeZone: 'UTC', locale: 'en-US' })
 assert.equal(ts24Midnight.display, 'Nov 26, 2026, 00:15:00 UTC')

 const ts12Afternoon = formatLineTimestamp('2026-11-26T17:15:00.000Z', { hourFormat: '12h', timeZone: 'UTC', locale: 'en-US' })
 assert.equal(ts12Afternoon.display, 'Nov 26, 2026, 05:15:00 PM UTC')

 const ts12Noon = formatLineTimestamp('2026-11-26T12:15:00.000Z', { hourFormat: '12h', timeZone: 'UTC', locale: 'en-US' })
 assert.equal(ts12Noon.display, 'Nov 26, 2026, 12:15:00 PM UTC')

 const epochMs = Date.parse('2026-11-26T17:15:00.000Z')
 assert.equal(
  formatLineTimestamp(epochMs, { hourFormat: '24h', timeZone: 'UTC', locale: 'en-US' }).display,
  'Nov 26, 2026, 17:15:00 UTC'
 )
 assert.equal(
  formatLineTimestamp(epochMs, { hourFormat: '12h', timeZone: 'UTC', locale: 'en-US' }).display,
  'Nov 26, 2026, 05:15:00 PM UTC'
 )
 assert.equal(
  formatLineTimestamp(epochMs, { hourFormat: '24h', timeZone: 'UTC', locale: 'en-US', showTimeZone: false }).display,
  'Nov 26, 2026, 17:15:00'
 )

 // America/Los_Angeles conversion & short zone label (PST / PDT)
 assert.equal(
  formatLineTimestamp('2026-11-26T17:15:00.016Z', { timeZone: 'America/Los_Angeles', hourFormat: '24h', locale: 'en-US' }).display,
  'Nov 26, 2026, 09:15:00 PST'
 )
 assert.equal(
  formatLineTimestamp('2026-11-26T17:15:00.016Z', { timeZone: 'America/Los_Angeles', hourFormat: '12h', locale: 'en-US' }).display,
  'Nov 26, 2026, 09:15:00 AM PST'
 )
 assert.equal(
  formatLineTimestamp('2026-07-15T16:15:00.000Z', { timeZone: 'America/Los_Angeles', hourFormat: '24h', locale: 'en-US' }).display,
  'Jul 15, 2026, 09:15:00 PDT'
 )

 // zonedWallClockToUtcMs, datetime-local conversion, parsing, placeholders & Data datetime helpers
 const laWallMs = zonedWallClockToUtcMs({ year: 2026, month: 11, day: 26, hour: 9, minute: 15, second: 0 }, 'America/Los_Angeles')
 assert.equal(new Date(laWallMs).toISOString(), '2026-11-26T17:15:00.000Z')
 assert.equal(formatDatetimeLocalInTimeZone('2026-11-26T17:15:00.016Z', 'America/Los_Angeles'), '2026-11-26T09:15:00')
 assert.equal(formatDatetimePlaceholder({ timeZone: 'America/Los_Angeles', hourFormat: '24h' }), 'YYYY-MM-DD HH:mm PST')
 assert.match(formatDatetimePlaceholder({ timeZone: 'America/Los_Angeles', hourFormat: '12h' }), /^YYYY-MM-DD hh:mm AM (PST|PDT)$/)
 assert.equal(
  formatCellInputValue('2026-11-26T17:15:00.016Z', 'datetime', { timeZone: 'America/Los_Angeles', hourFormat: '24h' }),
  'Nov 26, 2026, 09:15:00 PST'
 )
 assert.deepEqual(
  parseCellValue('2026-11-26 09:15:00', 'datetime', { timeZone: 'America/Los_Angeles', hourFormat: '24h' }),
  { ok: true, value: '2026-11-26T17:15:00.000Z', error: null }
 )
 assert.deepEqual(
  parseCellValue('Nov 26, 2026, 09:15:00 AM PST', 'datetime', { timeZone: 'America/Los_Angeles', hourFormat: '12h' }),
  { ok: true, value: '2026-11-26T17:15:00.000Z', error: null }
 )
 assert.deepEqual(
  parseCellValue('2026-11-23T14:30', 'datetime'),
  { ok: true, value: '2026-11-23T14:30', error: null }
 )
 assert.equal(
  parseDatetimeInTimeZone('2026-11-26T10:45:00', { timeZone: 'America/Los_Angeles' }).value,
  '2026-11-26T18:45:00.000Z'
 )
 assert.equal(
  parseDatetimeInTimeZone('Nov 26, 2026, 12:15:00 PM EST', { timeZone: 'America/Los_Angeles' }).value,
  '2026-11-26T17:15:00.000Z'
 )

 // formatStoryEntryTime converts and displays timezone short name
 const laStory24 = formatStoryEntryTime(Date.parse('2026-11-26T17:15:00.000Z'), 'today', {
  timeZone: 'America/Los_Angeles',
  hourFormat: '24h',
  showSeconds: true,
 })
 assert.equal(laStory24, '09:15:00 PST')
 const laStory12 = formatStoryEntryTime(Date.parse('2026-11-26T17:15:00.000Z'), 'today', {
  timeZone: 'America/Los_Angeles',
  hourFormat: '12h',
  showSeconds: true,
 })
 assert.equal(laStory12, '9:15:00 AM PST')
 const laStoryArchive = formatStoryEntryTime(Date.parse('2024-07-15T16:15:00.000Z'), 'archives', {
  timeZone: 'America/Los_Angeles',
  hourFormat: '24h',
  showSeconds: false,
 })
 assert.equal(laStoryArchive, 'Jul 15, 2024 · 09:15 PDT')
})

test('Top-rail clock placement after chips, searchable timezone selector, and Preferences View syncTable integration', async () => {
 const mainSource = await fs.readFile(new URL('./src/main.fs', import.meta.url), 'utf8')
 const laneSource = await fs.readFile(new URL('./src/lane-control.fs', import.meta.url), 'utf8')
 const notebookSource = await fs.readFile(new URL('./src/lane-notebook.fs', import.meta.url), 'utf8')
 const inputsSource = await fs.readFile(new URL('./src/lane-inputs.fs', import.meta.url), 'utf8')
 const scopeSource = await fs.readFile(new URL('./src/lane-scope.fs', import.meta.url), 'utf8')
 const dataSource = await fs.readFile(new URL('./src/lane-data.fs', import.meta.url), 'utf8')
 const confirmModalSource = await fs.readFile(new URL('./src/confirm-modal.fs', import.meta.url), 'utf8')
 const rowPickerModalSource = await fs.readFile(new URL('./src/lane-row-picker-modal.fs', import.meta.url), 'utf8')
 const outputSource = await fs.readFile(new URL('./src/lane-output.fs', import.meta.url), 'utf8')
 const modalSource = await fs.readFile(new URL('./src/lane-modal.fs', import.meta.url), 'utf8')
 const configModalSource = await fs.readFile(new URL('./src/lane-config-modal.fs', import.meta.url), 'utf8')
 const importModalSource = await fs.readFile(new URL('./src/lane-import-modal.fs', import.meta.url), 'utf8')
 const railsSource = await fs.readFile(new URL('./src/lane-rails.fs', import.meta.url), 'utf8')

 function createMockElement(tag) {
  return {
   tag,
   nodeType: 1,
   id: '',
   type: '',
   value: '',
   checked: false,
   disabled: false,
   hidden: false,
   title: '',
   placeholder: '',
   textContent: '',
   innerHTML: '',
   className: '',
   parentNode: null,
   attributes: {},
   style: {
    setProperty(k, v) { this[k] = v },
    removeProperty(k) { delete this[k] },
   },
   children: [],
   listeners: {},
   setAttribute(name, val) { this.attributes[name] = String(val) },
   removeAttribute(name) { delete this.attributes[name] },
   appendChild(child) {
    if (child.parentNode && child.parentNode.children) {
     const idx = child.parentNode.children.indexOf(child)
     if (idx !== -1) child.parentNode.children.splice(idx, 1)
    }
    child.parentNode = this
    this.children.push(child)
    return child
   },
   insertBefore(node, ref) {
    if (node.parentNode && node.parentNode.children) {
     const oldIdx = node.parentNode.children.indexOf(node)
     if (oldIdx !== -1) node.parentNode.children.splice(oldIdx, 1)
    }
    node.parentNode = this
    const refIdx = ref ? this.children.indexOf(ref) : -1
    if (refIdx === -1) this.children.push(node)
    else this.children.splice(refIdx, 0, node)
    return node
   },
   replaceChildren(...nodes) {
    this.children = []
    for (const n of nodes) this.appendChild(n)
   },
   remove() {
    if (this.parentNode && this.parentNode.children) {
     const idx = this.parentNode.children.indexOf(this)
     if (idx !== -1) this.parentNode.children.splice(idx, 1)
     this.parentNode = null
    }
   },
   contains(target) {
    if (target === this) return true
    return this.children.some(c => c.contains && c.contains(target))
   },
   addEventListener(event, handler) { this.listeners[event] = handler },
   focus() {},
   getBoundingClientRect() { return { left: 420, top: 2, width: 88, height: 12 } },
  }
 }

 const kv = new Map()
 function createMockKV(prefix = '') {
  const qualify = key => (prefix ? `${prefix}.${key}` : key)
  return {
   namespace(name) { return createMockKV(qualify(name)) },
   async get(key) { return kv.has(qualify(key)) ? kv.get(qualify(key)) : null },
   async set(key, value) { kv.set(qualify(key), String(value)) },
   async delete(key) { kv.delete(qualify(key)) },
  }
 }
 const rootKv = createMockKV()
 const makeMemStorage = () => {
  const m = new Map()
  return {
   getItem(k) { return m.has(k) ? m.get(k) : null },
   setItem(k, v) { m.set(k, String(v)) },
   removeItem(k) { m.delete(k) },
  }
 }

 let uuid = 0
 const docListeners = {}
 const winListeners = {}
 const mockWindow = {
  Array,
  Boolean,
  Date,
  Intl,
  JSON,
  Math,
  Number,
  Object,
  Reflect,
  String,
  decodeURIComponent,
  innerWidth: 1280,
  localStorage: makeMemStorage(),
  sessionStorage: makeMemStorage(),
  crypto: { randomUUID: () => `clk-uuid-${++uuid}` },
  history: { pushState(_s, _t, url) { mockWindow.location.pathname = url } },
  location: { pathname: '/', search: '', hash: '' },
  addEventListener(event, handler) {
   winListeners[event] ||= []
   winListeners[event].push(handler)
  },
  removeEventListener() {},
 }
 const mockDocument = {
  body: createMockElement('body'),
  documentElement: createMockElement('html'),
  defaultView: mockWindow,
  createElement: createMockElement,
  addEventListener(event, handler) {
   docListeners[event] ||= []
   docListeners[event].push(handler)
  },
 }
 const origFetch = globalThis.fetch
 globalThis.fetch = async url => {
  if (url === '/src/lane-control.fs') return { text: async () => laneSource }
  if (url === '/src/lane-notebook.fs') return { text: async () => notebookSource }
  if (url === '/src/lane-inputs.fs') return { text: async () => inputsSource }
  if (url === '/src/lane-scope.fs') return { text: async () => scopeSource }
  if (url === '/src/lane-data.fs') return { text: async () => dataSource }
  if (url === '/src/confirm-modal.fs') return { text: async () => confirmModalSource }
  if (url === '/src/lane-row-picker-modal.fs') return { text: async () => rowPickerModalSource }
  if (url === '/src/lane-output.fs') return { text: async () => outputSource }
  if (url === '/src/lane-modal.fs') return { text: async () => modalSource }
  if (url === '/src/lane-config-modal.fs') return { text: async () => configModalSource }
  if (url === '/src/lane-import-modal.fs') return { text: async () => importModalSource }
  if (url === '/src/lane-rails.fs') return { text: async () => railsSource }
  if (url === '/src/lane-line-info-modal.fs') return { text: async () => lineInfoModalSource }
  if (url === '/src/lane-export-modal.fs') return { text: async () => exportModalSource }
  if (url === '/src/lane-export-deploy-modal.fs') return { text: async () => exportDeployModalSource }
  if (url === '/src/lane-server.fs') return { text: async () => laneServerSource }
  if (url === '/src/lane-story.fs') return { text: async () => laneStorySource }
  if (url === '/src/lane-servers-modal.fs') return { text: async () => laneServersModalSource }
  if (url === '/src/lane-terminal-modal.fs') return { text: async () => laneTerminalModalSource }
  if (url === '/src/lane-session-modal.fs') return { text: async () => sessionModalSource }
  if (url === '/src/lane-package-modal.fs') return { text: async () => packageModalSource }
  if (url === '/src/lane-dir-modal.fs') return { text: async () => dirModalSource }
  throw new Error(`Unexpected fetch: ${url}`)
 }

 try {
  const f = field({
   ...DATA_RUNTIME_ENV,
   console: { log() {}, error() {}, warn() {} },
   createIdleTracker,
   data: rootKv,
   defaultValueForType,
   document: mockDocument,
   formatImportLine,
   hasImportCycle,
   normalizePrimitiveType,
   normalizeTopRailHidden,
   normalizeTopRailOrder,
   parseImportLine,
   primitiveTypes: PRIMITIVE_TYPES,
   resolveImportValue,
   resolveScopeColumns,
   resolveTopRailElementId,
   resolveTopRailLayout,
   runLines,
   runTransportedScripts,
   window: mockWindow,
  })
  await f.run(parse(mainSource, '/src/main.fs'))

  const lc = f.state['lane-control']
  const rails = lc.rails
  await lc['confirm-session-data-dir']('')

  // 1. Clock chip starts at the far right of top-rail; stays last after chips are added
  const topRail = rails['top-rail']
  const clockBtn = rails['clock-btn']
  assert.equal(topRail.children[topRail.children.length - 1], clockBtn)
  assert.ok(clockBtn.textContent.length > 0)

  const prefLane = await lc['create-preferences-lane']()
  await prefLane.notebook['add-line']('; to interface.rails ; object')
  await prefLane.notebook['add-line']('; to interface.rails.top ; object')
  await prefLane.notebook['add-line']("; to interface.rails.top.elements { [ object { text '$10.00' } { color '#40a000' } ] [ object { text 'MI' } { color '#2266aa' } ] }")
  assert.equal(rails['top-elements'].length, 2)
  assert.equal(topRail.children[6], rails['top-elements'][0])
  assert.equal(topRail.children[7], rails['top-elements'][1])
  assert.equal(topRail.children[8], clockBtn)

  // 2. With an empty timezones table (blank row), opening clock menu only allows Browser and UTC
  prefLane.notebook['data-view'].tables = [
   {
    id: 'tbl-tz',
    name: 'timezones',
    columns: [{ id: 'c-name', name: 'name', type: 'text', multiple: false }],
    rows: [{ id: 'row-blank', values: { 'c-name': '' } }],
   },
  ]
  await prefLane.notebook['data-view'].save()
  await clockBtn.listeners.click({ stopPropagation() {} })
  assert.equal(rails['is-clock-open'], true)
  assert.equal(rails['clock-menu'].hidden, false)
  // Verify 12/24h & Show seconds controls row sits directly above Filter timezones... inside clock-menu
  const menuChildren = rails['clock-menu'].children
  const prefsIdx = menuChildren.indexOf(rails['clock-prefs-el'])
  const searchWrapIdx = menuChildren.findIndex(el => el.children && el.children.includes(rails['clock-search-input']))
  assert.ok(prefsIdx >= 0 && searchWrapIdx > prefsIdx)

  // Toggle 24h and uncheck Show seconds -> keeps popover open, updates clock & persists to KV
  const fixedEveningMs = Date.parse('2026-11-26T21:05:49.000Z')
  await rails['sync-clock'](fixedEveningMs)
  await rails['clock-24h-btn'].listeners.click({ stopPropagation() {} })
  assert.equal(rails['is-clock-open'], true)
  assert.equal(lc['clock-hour-format'], '24h')
  assert.equal(kv.get('clock-hour-format'), '24h')
  assert.match(rails['clock-24h-btn'].className, /top-rail-clock-hour-btn--active/)
  assert.doesNotMatch(rails['clock-12h-btn'].className, /top-rail-clock-hour-btn--active/)

  rails['clock-seconds-check'].checked = false
  await rails['clock-seconds-check'].listeners.change({ stopPropagation() {} })
  assert.equal(rails['is-clock-open'], true)
  assert.equal(lc['clock-show-seconds'], false)
  assert.equal(kv.get('clock-show-seconds'), 'false')

  await rails['sync-clock'](fixedEveningMs)
  assert.doesNotMatch(clockBtn.textContent, /:49/)
  assert.doesNotMatch(clockBtn.textContent, /PM/i)

  // Switch back to 12h + Show seconds and verify
  await rails['clock-12h-btn'].listeners.click({ stopPropagation() {} })
  rails['clock-seconds-check'].checked = true
  await rails['clock-seconds-check'].listeners.change({ stopPropagation() {} })
  await rails['sync-clock'](fixedEveningMs)
  assert.equal(lc['clock-hour-format'], '12h')
  assert.equal(lc['clock-show-seconds'], true)
  assert.match(clockBtn.textContent, /:49/)

  assert.deepEqual(
   rails['clock-option-els'].map(e => e.opt.value),
   ['browser', 'UTC']
  )

  // Select UTC -> persists clock-timezone and updates clock chip text to UTC
  await rails['clock-option-els'][1].btn.listeners.click({ stopPropagation() {} })
  assert.equal(rails['is-clock-open'], false)
  assert.equal(lc['clock-timezone'], 'UTC')
  assert.equal(kv.get('clock-timezone'), 'UTC')
  assert.match(clockBtn.textContent, /UTC/)

  // 3. Preferences View Lane Output can call syncTable('timezones', ...) directly via extraEnv, updating both the table and the top-rail clock options
  await prefLane.notebook['add-line']("; send (\n ; to btn !document.createElement button\n !btn.addEventListener click : !syncTable timezones { [ object { name 'America/New_York' } ] [ object { name 'Asia/Tokyo' } ] } name\n $btn\n)")
  await lc['open-preferences-timezones-view']()
  assert.equal(prefLane.notebook['active-tab'], 'view')
  assert.equal(prefLane.notebook['output-view']['iframe-el'].tag, 'iframe')
  assert.equal(prefLane.notebook['output-view']['iframe-el'].attributes.sandbox, 'allow-scripts')
  const viewAddBtn = prefLane.notebook['output-view']['inline-host'].debugOutputEl.children[0]
  assert.ok(viewAddBtn)
  await viewAddBtn.listeners.click()

  assert.equal(prefLane.notebook['data-view'].tables[0].rows.length, 2)
  assert.deepEqual(lc['preferences-timezones'], ['America/New_York', 'Asia/Tokyo'])

  // Open clock menu again -> now shows Browser, UTC, America/New_York, Asia/Tokyo; filter & select Asia/Tokyo
  await clockBtn.listeners.click({ stopPropagation() {} })
  assert.deepEqual(
   rails['clock-option-els'].map(e => e.opt.value),
   ['browser', 'UTC', 'America/New_York', 'Asia/Tokyo']
  )
  rails['clock-search-input'].value = 'tokyo'
  await rails['clock-search-input'].listeners.input()
  assert.deepEqual(
   rails['clock-option-els'].map(e => e.opt.value),
   ['Asia/Tokyo']
  )
  await rails['clock-search-input'].listeners.keydown({ key: 'Enter', preventDefault() {} })
  assert.equal(lc['clock-timezone'], 'Asia/Tokyo')
  assert.equal(kv.get('clock-timezone'), 'Asia/Tokyo')
  assert.equal(rails['is-clock-open'], false)

  // 4. Preferences View extraEnv helpers: syncTable on chips updates top-rail chips live without destroying View DOM,
  //    setSelfLine updates backgroundColor & scrollbarColor in-place, setSelfFeatures toggles cron, clock helpers sync, and openLaneTab navigates to Data -> chips
  const dv = prefLane.notebook['data-view']
  await prefLane.notebook.tabs.data.listeners.click()
  await dv['add-table']('chips')
  await dv['add-column']('title', 'text', false)
  await dv['add-column']('url', 'text', false)
  await dv['add-column']('color', 'text', false)
  await dv['add-column']('value', 'text', false)

  await prefLane.notebook.tabs.source.listeners.click()
  await prefLane.notebook['set-line-quiet'](
   '; to interface.rails.top.elements',
   "; to els {} , ; each $chips ( ; to { c } $argv , !els.push [ object { title $c.title } { text $c.value } { color $c.color } { url $c.url } { row $c } ] ) , ; to interface.rails.top.elements $els",
   true
  )
  await prefLane.notebook['add-line']("; send (\n ; to panel !document.createElement div\n ; set [ object\n  { syncChips ( ; to { rows } $argv , !syncTable chips $rows title ) }\n  { readChips : !readTable chips }\n  { setLine ( ; to { t v ins } $argv , !setSelfLine $t $v $ins ) }\n  { getLines : !getSelfLines }\n  { getMeta : !getSelfMeta }\n  { setFeats ( ; to { f } $argv , !setSelfFeatures $f ) }\n  { setClockFmt ( ; to { h s tz } $argv , !setClockHourFormat $h , !setClockShowSeconds $s , !setClockTimezone $tz ) }\n  { jumpChips : !openLaneTab data chips }\n ] window.__testPrefApi\n $panel\n)")
  await lc['open-preferences-timezones-view']()
  const liveIframe = prefLane.notebook['output-view']['iframe-el']
  const liveViewportNode = prefLane.notebook['output-view']['inline-host'].debugOutputEl.children[1]
  assert.ok(liveIframe)
  assert.ok(liveViewportNode)
  assert.equal(mockWindow.__testPrefApi, undefined)
  const api = prefLane.notebook['output-view']['inline-host'].debugWindow.__testPrefApi
  assert.ok(api)

  const meta0 = await api.getMeta()
  assert.equal(meta0.id, prefLane.id)
  assert.equal(meta0.isPreferencesLane, true)
  assert.equal(meta0.clockTimezone, 'Asia/Tokyo')

  // Sync chips from View -> updates Data table AND top-rail chips without replacing liveViewportNode
  await api.syncChips([
   { title: 'Balance', url: 'https://example.test/b', color: '#40a000', value: '$100.00' },
   { title: 'Track', url: '', color: '#2266aa', value: 'Nate is in MI' },
  ])
  assert.equal(prefLane.notebook['output-view']['iframe-el'], liveIframe)
  assert.equal(prefLane.notebook['output-view']['inline-host'].debugOutputEl.children[1], liveViewportNode)
  assert.equal(rails['top-chip-items'].length, 2)
  assert.equal(rails['top-chip-items'][0].el.textContent, '$100.00')
  assert.equal(rails['top-chip-items'][1].el.textContent, 'Nate is in MI')

  // Read chips back with _rowId, rename & reorder while preserving exact _rowId
  const readBack = await api.readChips()
  assert.equal(readBack.length, 2)
  assert.ok(readBack[0]._rowId && readBack[1]._rowId)
  await api.syncChips([
   { _rowId: readBack[1]._rowId, title: 'Location', url: '', color: '#2266aa', value: 'Nate is in OH' },
   { _rowId: readBack[0]._rowId, title: 'Net Balance', url: 'https://example.test/b2', color: '#40a000', value: '$250.00' },
  ])
  const readAfter = await api.readChips()
  assert.equal(readAfter[0]._rowId, readBack[1]._rowId)
  assert.equal(readAfter[1]._rowId, readBack[0]._rowId)
  assert.deepEqual(rails['top-chip-items'].map(c => c.el.textContent), ['Nate is in OH', '$250.00'])

  // Update interface.backgroundColor and interface.scrollbarColor in-place via setSelfLine
  const setBgRes = await api.setLine('; to interface.backgroundColor', '; to interface.backgroundColor #0b0e12', true)
  assert.equal(setBgRes.ok, true)
  assert.equal(mockDocument.body.style.backgroundColor, '#0b0e12')
  const setSbRes = await api.setLine('; to interface.scrollbarColor', "; to interface.scrollbarColor '#484848 #141414'", true)
  assert.equal(setSbRes.ok, true)
  assert.equal(mockDocument.documentElement.style.scrollbarColor, '#484848 #141414')
  assert.equal(prefLane.notebook['output-view']['iframe-el'], liveIframe)
  assert.equal(prefLane.notebook['output-view']['inline-host'].debugOutputEl.children[1], liveViewportNode)

  // Toggle runEvery30Minutes and clock preferences via extraEnv
  const nextFeats = await api.setFeats({ httpServer: false, runEvery30Minutes: true })
  assert.equal(nextFeats.runEvery30Minutes, true)
  assert.equal(prefLane.features.runEvery30Minutes, true)
  await api.setClockFmt('24h', false, 'UTC')
  assert.equal(lc['clock-hour-format'], '24h')
  assert.equal(lc['clock-show-seconds'], false)
  assert.equal(lc['clock-timezone'], 'UTC')

  // Verify interface.rails.top.order & interface.rails.top.hidden apply live via setSelfLine without tearing down View DOM
  await clockBtn.listeners.click({ stopPropagation() {} })
  assert.equal(rails['is-clock-open'], true)
  await api.setLine(
   '; to interface.rails.top.order',
   "; to interface.rails.top.order { 'clock' 'chip:Net Balance' 'fullscreen' 'search' 'session' 'packages' 'servers' 'preferences' 'chip:Location' }",
   true
  )
  assert.equal(topRail.children[0], clockBtn)
  assert.equal(topRail.children[1].textContent, '$250.00')
  assert.equal(topRail.children[2], rails['fullscreen-btn'])
  assert.equal(topRail.children[8].textContent, 'Nate is in OH')
  assert.equal(prefLane.notebook['output-view']['iframe-el'], liveIframe)
  assert.equal(prefLane.notebook['output-view']['inline-host'].debugOutputEl.children[1], liveViewportNode)

  await api.setLine(
   '; to interface.rails.top.hidden',
   "; to interface.rails.top.hidden { 'clock' 'servers' 'chip:Location' }",
   true
  )
  assert.equal(clockBtn.hidden, true)
  assert.equal(rails['is-clock-open'], false)
  assert.equal(rails['servers-btn'].hidden, true)
  assert.equal(rails['fullscreen-btn'].hidden, false)
  assert.equal(topRail.children[8].hidden, true)
  assert.equal(topRail.children[1].hidden, false)

  await api.setLine(
   '; to interface.rails.top.hidden',
   '; to interface.rails.top.hidden {}',
   true
  )
  assert.equal(clockBtn.hidden, false)
  assert.equal(rails['servers-btn'].hidden, false)
  assert.equal(topRail.children[8].hidden, false)

  // Jump directly to Data -> chips table
  await api.jumpChips()
  assert.equal(prefLane.notebook['active-tab'], 'data')
  assert.equal(dv['get-active-table']().name, 'chips')
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('Selected timezone (America/Los_Angeles) & 12h/24h across Data datetime/datetime[]/row, Row Picker, Line Info, Session History, Server Sync, and Story', async () => {
 const mainSource = await fs.readFile(new URL('./src/main.fs', import.meta.url), 'utf8')
 const laneSource = await fs.readFile(new URL('./src/lane-control.fs', import.meta.url), 'utf8')
 const notebookSource = await fs.readFile(new URL('./src/lane-notebook.fs', import.meta.url), 'utf8')
 const inputsSource = await fs.readFile(new URL('./src/lane-inputs.fs', import.meta.url), 'utf8')
 const scopeSource = await fs.readFile(new URL('./src/lane-scope.fs', import.meta.url), 'utf8')
 const dataSource = await fs.readFile(new URL('./src/lane-data.fs', import.meta.url), 'utf8')
 const confirmModalSource = await fs.readFile(new URL('./src/confirm-modal.fs', import.meta.url), 'utf8')
 const rowPickerModalSource = await fs.readFile(new URL('./src/lane-row-picker-modal.fs', import.meta.url), 'utf8')
 const outputSource = await fs.readFile(new URL('./src/lane-output.fs', import.meta.url), 'utf8')
 const modalSource = await fs.readFile(new URL('./src/lane-modal.fs', import.meta.url), 'utf8')
 const configModalSource = await fs.readFile(new URL('./src/lane-config-modal.fs', import.meta.url), 'utf8')
 const importModalSource = await fs.readFile(new URL('./src/lane-import-modal.fs', import.meta.url), 'utf8')
 const railsSource = await fs.readFile(new URL('./src/lane-rails.fs', import.meta.url), 'utf8')

 function createMockElement(tag) {
  return {
   tag,
   nodeType: 1,
   style: {},
   attributes: {},
   children: [],
   listeners: {},
   textContent: '',
   innerHTML: '',
   value: '',
   placeholder: '',
   title: '',
   className: '',
   hidden: false,
   disabled: false,
   checked: false,
   setAttribute(k, v) { this.attributes[k] = String(v) },
   getAttribute(k) { return this.attributes[k] ?? null },
   removeAttribute(k) { delete this.attributes[k] },
   appendChild(c) {
    if (c && typeof c === 'object') {
     c.parentNode = this
     this.children.push(c)
    }
    return c
   },
   insertBefore(c, ref) {
    if (c && typeof c === 'object') c.parentNode = this
    const idx = this.children.indexOf(ref)
    if (idx === -1) this.children.push(c)
    else this.children.splice(idx, 0, c)
    return c
   },
   replaceChildren(...nodes) {
    this.children = []
    for (const n of nodes) this.appendChild(n)
   },
   addEventListener(ev, handler) { this.listeners[ev] = handler },
   focus() { this.focused = true },
   select() {},
   remove() {
    this.removed = true
    if (this.parentNode && Array.isArray(this.parentNode.children)) {
     const idx = this.parentNode.children.indexOf(this)
     if (idx !== -1) this.parentNode.children.splice(idx, 1)
     this.parentNode = null
    }
   },
  }
 }

 const kvStore = new Map()
 function makeKv(prefix = '', rootRef = null) {
  const q = k => (prefix ? `${prefix}/${k}` : k)
  const client = {
   get root() { return rootRef || client },
   get defaultRoot() { return rootRef || client },
   withBasePath() { return client.root },
   namespace(name) { return makeKv(q(name), client.root) },
   hashNamespace(name) { return makeKv(q(name), client.root) },
   async get(k) { return kvStore.has(q(k)) ? kvStore.get(q(k)) : null },
   async set(k, v) { kvStore.set(q(k), String(v)) },
   async delete(k) { kvStore.delete(q(k)) },
  }
  return client
 }
 const rootKv = makeKv()

 let uuid = 0
 const localStore = new Map()
 const sessionStore = new Map()
 const copiedTexts = []
 const mockWindow = {
  Array,
  Boolean,
  Date,
  Intl,
  JSON,
  Math,
  Number,
  Object,
  Reflect,
  String,
  decodeURIComponent,
  encodeURIComponent,
  crypto: { randomUUID: () => `tz-e2e-uuid-${++uuid}` },
  navigator: {
   clipboard: {
    writeText: async txt => { copiedTexts.push(String(txt)) },
   },
  },
  localStorage: {
   getItem: k => (localStore.has(k) ? localStore.get(k) : null),
   setItem: (k, v) => localStore.set(k, String(v)),
   removeItem: k => localStore.delete(k),
  },
  sessionStorage: {
   getItem: k => (sessionStore.has(k) ? sessionStore.get(k) : null),
   setItem: (k, v) => sessionStore.set(k, String(v)),
   removeItem: k => sessionStore.delete(k),
  },
  history: {
   pushState(_s, _t, url) { mockWindow.location.pathname = String(url).split('#')[0] || '/' },
   replaceState(_s, _t, url) { mockWindow.location.pathname = String(url).split('#')[0] || '/' },
  },
  location: { pathname: '/', search: '', hash: '' },
  addEventListener() {},
 }
 const mockDocument = {
  body: createMockElement('body'),
  documentElement: createMockElement('html'),
  defaultView: mockWindow,
  createElement: createMockElement,
  addEventListener() {},
 }

 const origFetch = globalThis.fetch
 globalThis.fetch = async url => {
  const map = {
   '/src/main.fs': mainSource,
   '/src/lane-control.fs': laneSource,
   '/src/lane-notebook.fs': notebookSource,
   '/src/lane-inputs.fs': inputsSource,
   '/src/lane-scope.fs': scopeSource,
   '/src/lane-data.fs': dataSource,
   '/src/confirm-modal.fs': confirmModalSource,
   '/src/lane-row-picker-modal.fs': rowPickerModalSource,
   '/src/lane-output.fs': outputSource,
   '/src/lane-modal.fs': modalSource,
   '/src/lane-config-modal.fs': configModalSource,
   '/src/lane-import-modal.fs': importModalSource,
   '/src/lane-export-modal.fs': exportModalSource,
   '/src/lane-export-deploy-modal.fs': exportDeployModalSource,
   '/src/lane-session-modal.fs': sessionModalSource,
   '/src/lane-package-modal.fs': packageModalSource,
   '/src/lane-dir-modal.fs': dirModalSource,
   '/src/lane-line-info-modal.fs': lineInfoModalSource,
   '/src/lane-server.fs': laneServerSource,
   '/src/lane-story.fs': laneStorySource,
   '/src/lane-servers-modal.fs': laneServersModalSource,
   '/src/lane-terminal-modal.fs': laneTerminalModalSource,
   '/src/lane-rails.fs': railsSource,
  }
  if (map[url]) return { text: async () => map[url] }
  throw new Error(`Unexpected fetch: ${url}`)
 }

 try {
  const f = field({
   ...DATA_RUNTIME_ENV,
   console: { log() {} },
   createIdleTracker,
   crypto: mockWindow.crypto,
   data: rootKv,
   defaultValueForType,
   document: mockDocument,
   formatAgentContext,
   formatAgentPrompt,
   formatImportLine,
   hasImportCycle,
   location: mockWindow.location,
   normalizePrimitiveType,
   parseImportLine,
   primitiveTypes: PRIMITIVE_TYPES,
   resolveImportValue,
   resolveScopeColumns,
   runLines,
   runTransportedScripts,
   window: mockWindow,
  })

  await f.run(parse(mainSource, '/src/main.fs'))
  const lc = f.state['lane-control']
  await lc['confirm-session-data-dir']('.civil-tz-e2e-test')

  // 1. Configure Preferences with America/Los_Angeles and select America/Los_Angeles + 24h
  const prefLane = await lc['create-preferences-lane']()
  prefLane.notebook['data-view'].tables = [
   {
    id: 'tbl-tz',
    name: 'timezones',
    columns: [{ id: 'c-name', name: 'name', type: 'text', multiple: false }],
    rows: [
     { id: 'r-la', values: { 'c-name': 'America/Los_Angeles' } },
     { id: 'r-ny', values: { 'c-name': 'America/New_York' } },
    ],
   },
  ]
  await prefLane.notebook['data-view'].save()
  await lc['sync-preferences-timezones']()
  await lc['set-clock-hour-format']('24h')
  await lc['set-clock-timezone']('America/Los_Angeles')
  assert.equal(lc['clock-timezone'], 'America/Los_Angeles')
  assert.equal(lc['clock-hour-format'], '24h')

  // 2. Create a lane with Data tables exercising datetime, datetime[], and row (displaying datetime)
  const lane = await lc.add()
  await lc.rename(lane.id, 'Events')
  await lane.notebook['set-features']({ httpServer: true, runEvery30Minutes: false })

  const sampleIso = '2026-11-26T17:15:00.016Z'
  const dv = lane.notebook['data-view']
  dv.tables = [
   {
    id: 'tbl-events',
    name: 'events',
    columns: [
     { id: 'c-code', name: 'code', type: 'text', multiple: false },
     { id: 'c-at', name: 'at', type: 'datetime', multiple: false },
     { id: 'c-slots', name: 'slots', type: 'datetime', multiple: true },
    ],
    rows: [
     {
      id: 'row-ev-1',
      values: {
       'c-code': 'EV1',
       'c-at': sampleIso,
       'c-slots': ['2026-11-26T15:00:00.000Z'],
      },
     },
    ],
   },
   {
    id: 'tbl-links',
    name: 'links',
    columns: [
     {
      id: 'c-ev',
      name: 'event',
      type: 'row',
      multiple: false,
      refTableId: 'tbl-events',
      refColumnId: 'c-code',
      refDisplayColumnId: 'c-at',
     },
    ],
    rows: [
     {
      id: 'row-lnk-1',
      values: {
       'c-ev': 'EV1',
      },
     },
    ],
   },
  ]
  await dv.save()
  await lane.notebook['set-tab']('data')
  await dv['select-table']('tbl-events', true)

  const atCell = dv['grid-rows'][0].cells[1]
  const slotsCell = dv['grid-rows'][0].cells[2]
  const atInput = atCell['input-el']
  const atNativePicker = atCell['td'].children[0].children[2]
  assert.equal(atInput.value, 'Nov 26, 2026, 09:15:00 PST')
  assert.equal(slotsCell.items[0]['input-el'].value, 'Nov 26, 2026, 07:00:00 PST')

  // Untouched blur preserves millisecond precision .016Z
  await atInput.listeners.blur()
  assert.equal(dv.tables[0].rows[0].values['c-at'], sampleIso)

  // Live switching to 12h and UTC then back to America/Los_Angeles updates open Data cells in place
  await lc['set-clock-hour-format']('12h')
  assert.equal(atInput.value, 'Nov 26, 2026, 09:15:00 AM PST')
  assert.equal(slotsCell.items[0]['input-el'].value, 'Nov 26, 2026, 07:00:00 AM PST')

  await lc['set-clock-timezone']('UTC')
  assert.equal(atInput.value, 'Nov 26, 2026, 05:15:00 PM UTC')
  assert.equal(slotsCell.items[0]['input-el'].value, 'Nov 26, 2026, 03:00:00 PM UTC')

  await lc['set-clock-timezone']('America/Los_Angeles')
  await lc['set-clock-hour-format']('24h')
  assert.equal(atInput.value, 'Nov 26, 2026, 09:15:00 PST')

  // Typing in America/Los_Angeles stores UTC ISO and reformats cleanly on blur
  atInput.value = '2026-11-26 10:45:00'
  await atInput.listeners.input()
  assert.equal(dv.tables[0].rows[0].values['c-at'], '2026-11-26T18:45:00.000Z')
  await atInput.listeners.blur()
  assert.equal(atInput.value, 'Nov 26, 2026, 10:45:00 PST')

  // Changing hidden native datetime-local picker commits in America/Los_Angeles
  atNativePicker.value = '2026-11-26T11:30:00'
  await atNativePicker.listeners.change()
  assert.equal(dv.tables[0].rows[0].values['c-at'], '2026-11-26T19:30:00.000Z')
  assert.equal(atInput.value, 'Nov 26, 2026, 11:30:00 PST')

  // Editing datetime[] item in America/Los_Angeles
  const slotInput = slotsCell.items[0]['input-el']
  slotInput.value = '2026-11-26 08:20:00'
  await slotInput.listeners.input()
  assert.deepEqual(dv.tables[0].rows[0].values['c-slots'], ['2026-11-26T16:20:00.000Z'])
  await slotInput.listeners.blur()
  assert.equal(slotInput.value, 'Nov 26, 2026, 08:20:00 PST')

  // 3. Switch to `links` table -> row cell whose displayColumn is `at` (datetime) shows PST & opens Row Picker with PST + inline + Add
  await dv['select-table']('tbl-links', true)
  const rowCell = dv['grid-rows'][0].cells[0]
  assert.equal(rowCell['display-el'].textContent, 'Nov 26, 2026, 11:30:00 PST')

  await rowCell['trigger-el'].listeners.click({ stopPropagation() {} })
  const rp = dv['row-picker']
  assert.equal(rp['is-open'], true)
  assert.equal(rp['option-items'][0].item.displayText, 'Nov 26, 2026, 11:30:00 PST')
  await rp['add-trigger-btn'].listeners.click()
  const addAtField = rp['add-fields'].find(frec => frec.name === 'at')
  assert.ok(addAtField)
  assert.match(addAtField['input-el'].placeholder, /PST/)

  // Switching to 12h while Row Picker is open refreshes both options & display cell live!
  await lc['set-clock-hour-format']('12h')
  assert.equal(rp['option-items'][0].item.displayText, 'Nov 26, 2026, 11:30:00 AM PST')
  assert.equal(rowCell['display-el'].textContent, 'Nov 26, 2026, 11:30:00 AM PST')
  await rp.close()
  await lc['set-clock-hour-format']('24h')

  // 4. Line Info modal Modified timestamp & Copy Info respect PST and live-refresh
  await lane.notebook['set-tab']('source')
  lane.notebook.rows[0]['input-el'].value = '; to ping 1'
  await lane.notebook.rows[0]['input-el'].listeners.input()
  const lineRec = lane.notebook['line-records'][0]
  lineRec.updatedAt = sampleIso
  lane.notebook.rows[0].record.updatedAt = sampleIso
  await lane.notebook.rows[0]['info-btn'].listeners.click()
  const lim = lc['line-info-modal']
  assert.equal(lim['is-open'], true)
  assert.equal(lim['mod-val-el'].textContent, 'Nov 26, 2026, 09:15:00 PST')
  await lim['copy-info-btn'].listeners.click()
  assert.ok(copiedTexts.some(t => t.includes('Nov 26, 2026, 09:15:00 PST')))
  await lc['set-clock-hour-format']('12h')
  assert.equal(lim['mod-val-el'].textContent, 'Nov 26, 2026, 09:15:00 AM PST')
  await lim.close()
  await lc['set-clock-hour-format']('24h')

  // 5. Session History page respects PST & live-refreshes
  const sm = lc['session-modal']
  await sm['open-history']()
  assert.equal(sm['is-open'], true)
  assert.equal(sm.mode, 'history')
  assert.ok(sm['hist-items'].length >= 1)
  const histTimeEl = sm['hist-items'][0].el.children[0].children[1]
  assert.match(histTimeEl.textContent, /PST/)
  await lc['set-clock-hour-format']('12h')
  assert.match(sm['hist-items'][0].el.children[0].children[1].textContent, /\b(AM|PM)\b PST/)
  await sm.close()
  await lc['set-clock-hour-format']('24h')

  // 6. Server tab Last synced respects PST & live-refreshes
  await lane.notebook['set-tab']('server')
  const srvView = lane.notebook['server-view']
  srvView.deployment = { ...(srvView.deployment || {}), lastSyncedAt: sampleIso }
  srvView['showing-last-synced'] = true
  await srvView['refresh-clock-displays']()
  assert.equal(srvView['sync-meta-el'].textContent, 'Last synced: Nov 26, 2026, 09:15:00 PST')
  await lc['set-clock-hour-format']('12h')
  assert.equal(srvView['sync-meta-el'].textContent, 'Last synced: Nov 26, 2026, 09:15:00 AM PST')
  await lc['set-clock-hour-format']('24h')

  // 7. Story tab entry time shows PST and live-refreshes between 24h, 12h, and UTC
  const fixedNow = Date.parse('2026-11-26T18:00:00.000Z')
  const stView = lane.notebook['story-view']
  stView['now-fn'] = () => fixedNow
  await appendLaneStory(rootKv, lane.data, lane.id, {
   ts: Date.parse(sampleIso),
   trigger: 'manual',
   outcome: {
    results: [{ index: 0, lineNumber: 1, source: '; to ping 1', preview: '1', value: 1 }],
    sent: [],
    state: { ping: 1 },
   },
   lineRecords: [{ id: lineRec.id, text: '; to ping 1' }],
  })
  stView['needs-refresh'] = true
  await lane.notebook['set-tab']('story')
  assert.ok(stView['entry-els'].length >= 1)
  const seededTs = Date.parse(sampleIso)
  const findSeededTimeText = () => {
   const idx = stView.entries.findIndex(e => e.ts === seededTs)
   assert.ok(idx >= 0)
   return stView['entry-els'][idx].children[0].children[1].textContent
  }
  assert.equal(findSeededTimeText(), '09:15:00 PST')

  await lc['set-clock-hour-format']('12h')
  assert.equal(findSeededTimeText(), '9:15:00 AM PST')

  await lc['set-clock-timezone']('UTC')
  assert.equal(findSeededTimeText(), '5:15:00 PM UTC')

  await lc['set-clock-hour-format']('24h')
  assert.equal(findSeededTimeText(), '17:15:00 UTC')

  // Unchanged timezone sync does not spuriously reload the active Story tab
  await lc['set-clock-timezone']('America/Los_Angeles')
  const firstElBeforeSync = stView['entry-els'][0]
  await lc['sync-preferences-timezones']()
  assert.equal(stView['entry-els'][0], firstElBeforeSync)
 }
 finally {
  globalThis.fetch = origFetch
 }
})

test('resolveTopRailLayout & resolveTopRailElementId: canonical IDs, custom order, hidden items, and CSS hidden rules', async () => {
 assert.deepEqual(TOP_RAIL_BUILTIN_IDS, [
  'fullscreen',
  'search',
  'session',
  'packages',
  'servers',
  'preferences',
  'clock',
 ])

 assert.deepEqual(normalizeTopRailOrder([' clock ', 'chip:Balance', 'clock', null, '', 'fullscreen']), [
  'clock',
  'chip:Balance',
  'fullscreen',
 ])
 assert.deepEqual(normalizeTopRailHidden({ clock: true, servers: false, 'chip:Track': 1 }), [
  'clock',
  'chip:Track',
 ])

 const used = new Set()
 assert.equal(resolveTopRailElementId({ title: 'Foo' }, 0, used), 'chip:Foo')
 assert.equal(resolveTopRailElementId({ title: 'Foo' }, 1, used), 'chip:Foo#2')
 assert.equal(resolveTopRailElementId({}, 2, used), 'chip:2')

 const defLayout = resolveTopRailLayout({
  elements: [{ title: 'Balance' }, { title: 'Debt', hidden: true }],
 })
 assert.deepEqual(defLayout.orderedIds, [
  'fullscreen',
  'search',
  'session',
  'packages',
  'servers',
  'preferences',
  'chip:Balance',
  'chip:Debt',
  'clock',
 ])
 assert.deepEqual(defLayout.hiddenIds, ['chip:Debt'])
 assert.equal(defLayout.elementEntries[1].hidden, true)

 // Custom order places new unplaced chips right after the last placed chip
 const customLayout = resolveTopRailLayout({
  elements: [{ title: 'Balance' }, { title: 'Track' }],
  order: ['clock', 'chip:Balance', 'fullscreen'],
  hidden: ['clock', 'preferences'],
 })
 assert.deepEqual(customLayout.orderedIds, [
  'clock',
  'chip:Balance',
  'chip:Track',
  'fullscreen',
  'search',
  'session',
  'packages',
  'servers',
  'preferences',
 ])
 assert.deepEqual(customLayout.hiddenIds, ['clock', 'preferences'])

 // When no chips were placed in custom order, a new chip is inserted directly before clock
 const noChipOrderLayout = resolveTopRailLayout({
  elements: [{ title: 'Balance' }],
  order: ['fullscreen', 'clock', 'servers'],
 })
 assert.deepEqual(noChipOrderLayout.orderedIds, [
  'fullscreen',
  'chip:Balance',
  'clock',
  'servers',
  'search',
  'session',
  'packages',
  'preferences',
 ])

 const indexHtml = await fs.readFile(new URL('./index.html', import.meta.url), 'utf8')
 assert.match(indexHtml, /\.top-rail-menu\[hidden\],\s*\.top-rail-icon\[hidden\],\s*\.top-rail-chip\[hidden\]\s*\{\s*display:\s*none;\s*\}/s)
})
