import {
 buildTablesScope,
 coerceDataValue,
 defaultDataValue,
 defaultValueForType,
 describeValue,
 listScopeEntries,
 normalizeLaneFeatures,
 normalizeLaneMinimizeSide,
 normalizeLanePath,
 normalizeLaneWidth,
 normalizePrimitiveType,
 parseCellValue,
 parseColumnType,
 parseLaneFeatures,
 resolveImportValue,
 runLines,
 syncTableRowsInMemory,
 validateFieldScriptLine,
 validateFieldScriptLines,
} from './field.mjs'
import { formatDataDirLabel, httpKV, normalizeDataDir } from './data.mjs'
import {
 DEFAULT_PACKAGE_ID,
 addLaneTable,
 addTableRow,
 checkLaneAccess,
 clearTableRows,
 collectLaneSyncBundle,
 computeLaneScriptHash,
 deleteLaneSecret,
 deleteLaneTable,
 deleteTableRow,
 formatAgentContext,
 generateLineId,
 getLaneDeployStatus,
 getLanePackageId,
 inspectSessionForAgent,
 listPackageSessions,
 loadDeployServers,
 loadDeployments,
 loadLaneDeployment,
 loadLaneScript,
 loadLaneTables,
 loadSessionCatalog,
 loadTableUpdates,
 recordTableDeploymentUpdate,
 registerLaneInPackage,
 resolveLaneSecrets,
 resolveRegistryKv,
 resolveSessionKv,
 saveDeployedLaneScript,
 saveLaneDeployment,
 saveLaneScript,
 saveScriptLinesAndIndex,
 saveSessionVersion,
 saveTableRow,
 saveTableSchema,
 saveTableSchemaAndRows,
 setLaneSecret,
 setTargetLaneLine,
} from './storage.mjs'
import { executeLaneResync } from './deploy-api.mjs'
import {
 createResponseHelper,
 detectLaneHandlers,
 simulateLaneRequest,
} from './lane-http.mjs'
import {
 captureStoryEnvInputs,
 createStoryRunRecorder,
 recordLaneStoryFromRun,
 trackStoryExportLineCall,
 trackStoryExportTableCall,
 trackStoryImportCall,
} from './story.mjs'

const MAX_JSON_BODY_BYTES = 4 * 1024 * 1024

export const DEFAULT_AGENT_DATA_URL = 'http://localhost:8080/api/data?mode=disk'

export function createAgentEventHub() {
 const subscribers = new Set()
 let seq = 0
 return {
  subscribe(listener) {
   if (typeof listener !== 'function') {
    return () => {}
   }
   subscribers.add(listener)
   return () => {
    subscribers.delete(listener)
   }
  },
  emit(event = {}) {
   const payload = {
    id: ++seq,
    timestamp: new Date().toISOString(),
    ...event,
   }
   for (const listener of Array.from(subscribers)) {
    try {
     listener(payload)
    }
    catch {
     // ignore subscriber error
    }
   }
   return payload
  },
  count() {
   return subscribers.size
  },
 }
}

export const defaultAgentEventHub = createAgentEventHub()

export function resolveAgentRootKv(rootKvOrOptions = null) {
 if (rootKvOrOptions && typeof rootKvOrOptions.get === 'function' && typeof rootKvOrOptions.set === 'function') {
  return rootKvOrOptions
 }
 const opts = rootKvOrOptions && typeof rootKvOrOptions === 'object' ? rootKvOrOptions : {}
 const baseUrl = opts.baseUrl || DEFAULT_AGENT_DATA_URL
 return httpKV({
  baseUrl,
  basePath: opts.basePath || null,
  switchable: true,
  headers: opts.headers || null,
 })
}

export function formatTableWithNamedRows(table) {
 if (!table || typeof table !== 'object') {
  return null
 }
 const columns = Array.isArray(table.columns) ? table.columns : []
 const rows = Array.isArray(table.rows) ? table.rows : []
 const namedRows = rows.map(row => {
  const values = row && row.values && typeof row.values === 'object' ? row.values : {}
  const record = { _rowId: row && row.id ? String(row.id) : '' }
  for (const col of columns) {
   if (!col || !col.id) {
    continue
   }
   const key = col.name && String(col.name).trim() ? String(col.name).trim() : String(col.id)
   record[key] = Object.hasOwn(values, col.id) ? values[col.id] : defaultDataValue(col, col.multiple)
  }
  return record
 })
 return {
  id: String(table.id || ''),
  name: String(table.name || ''),
  columns,
  rowCount: rows.length,
  rows,
  namedRows,
 }
}

export async function agentListSessions(rootKv, options = {}) {
 const kv = resolveAgentRootKv(rootKv)
 const registryKv = resolveRegistryKv(kv)
 const res = await listPackageSessions(registryKv, options.packageId || DEFAULT_PACKAGE_ID)
 const sessions = Array.isArray(res && res.sessions) ? res.sessions : []
 return {
  ok: true,
  packageId: res.packageId || DEFAULT_PACKAGE_ID,
  count: sessions.length,
  activeSession: sessions[0] || null,
  sessions,
 }
}

export async function agentResolveSessionAndLane(rootKv, options = {}) {
 const kv = resolveAgentRootKv(rootKv)
 const opts = options && typeof options === 'object' ? options : {}
 const baseInfo = await inspectSessionForAgent(kv, {
  sessionId: opts.sessionId,
  dataDir: opts.dataDir,
 })
 const sessionKv = resolveSessionKv(kv, baseInfo.dataDir)
 const catalog = Array.isArray(baseInfo.catalog) ? baseInfo.catalog : []

 const rawQuery = opts.laneId !== undefined && opts.laneId !== null
  ? String(opts.laneId).trim()
  : (opts.lane !== undefined && opts.lane !== null ? String(opts.lane).trim() : '')

 let resolvedLaneId = ''
 if (rawQuery) {
  const exactId = catalog.find(item => item && item.id === rawQuery)
  if (exactId) {
   resolvedLaneId = exactId.id
  }
  else {
   const lower = rawQuery.toLowerCase()
   const exactTitle = catalog.find(item => item && String(item.title || '').trim().toLowerCase() === lower)
   if (exactTitle) {
    resolvedLaneId = exactTitle.id
   }
   else {
    const prefixMatch = catalog.find(item =>
     item && (
      String(item.id || '').toLowerCase().startsWith(lower) ||
      String(item.title || '').trim().toLowerCase().includes(lower)
     )
    )
    resolvedLaneId = prefixMatch ? prefixMatch.id : rawQuery
   }
  }
 }

 return {
  rootKv: kv,
  registryKv: resolveRegistryKv(kv),
  sessionKv,
  sessions: baseInfo.sessions,
  activeSession: baseInfo.activeSession,
  dataDir: baseInfo.dataDir,
  openPackages: baseInfo.openPackages,
  openPackageIds: baseInfo.openPackageIds,
  catalog,
  laneId: resolvedLaneId,
 }
}

export async function agentGetSession(rootKv, options = {}) {
 const resolved = await agentResolveSessionAndLane(rootKv, options)
 const active = resolved.activeSession
 const openLaneIds = active && Array.isArray(active.laneIds) ? active.laneIds : []
 const catalogById = new Map(resolved.catalog.map(item => [item.id, item]))
 const openLanes = openLaneIds.map(id => catalogById.get(id) || { id, title: id, packageId: DEFAULT_PACKAGE_ID })
 const contextText = formatAgentContext({
  sessionId: active ? active.id : '',
  sessionName: active ? active.name : '',
  dataDir: resolved.dataDir,
  dataDirConfirmed: active ? active.dataDirConfirmed : Boolean(resolved.dataDir),
  openPackages: resolved.openPackages,
  openPackageIds: resolved.openPackageIds,
  activePackageId: active ? active.activePackageId : '',
  openLanes,
  pathname: active ? active.pathname : '/',
 })
 return {
  ok: true,
  activeSession: active,
  dataDir: resolved.dataDir,
  dataDirLabel: formatDataDirLabel(resolved.dataDir, active ? active.dataDirConfirmed : Boolean(resolved.dataDir)),
  openPackages: resolved.openPackages,
  openPackageIds: resolved.openPackageIds,
  openLanes,
  catalog: resolved.catalog,
  sessions: resolved.sessions,
  agentContext: contextText,
 }
}

export async function agentGetLane(rootKv, options = {}) {
 const resolved = await agentResolveSessionAndLane(rootKv, options)
 if (!resolved.laneId) {
  return {
   ok: false,
   error: 'laneId or lane title is required',
   activeSession: resolved.activeSession,
   dataDir: resolved.dataDir,
   catalog: resolved.catalog,
  }
 }
 const inspected = await inspectSessionForAgent(resolved.rootKv, {
  sessionId: resolved.activeSession ? resolved.activeSession.id : options.sessionId,
  dataDir: resolved.dataDir,
  laneId: resolved.laneId,
 })
 const lane = inspected.lane
 if (!lane) {
  return {
   ok: false,
   error: `Lane "${resolved.laneId}" could not be loaded`,
  }
 }
 const deployStatus = await getLaneDeployStatus(resolved.registryKv, resolved.sessionKv, resolved.laneId)
 const parsedFeatures = parseLaneFeatures(lane.features)
 const rawTables = Array.isArray(lane.tables) ? lane.tables : []
 const formattedTables = await Promise.all(
  rawTables.map(async tbl => {
   const formatted = formatTableWithNamedRows(tbl)
   if (!formatted) {
    return null
   }
   const updates = await loadTableUpdates(resolved.sessionKv, resolved.sessionKv.namespace(lane.id), lane.id, tbl.id)
   return {
    ...formatted,
    updates,
   }
  })
 )
 const cleanFormattedTables = formattedTables.filter(Boolean)
 const active = resolved.activeSession
 const contextText = formatAgentContext({
  sessionId: active ? active.id : '',
  sessionName: active ? active.name : '',
  dataDir: resolved.dataDir,
  dataDirConfirmed: active ? active.dataDirConfirmed : Boolean(resolved.dataDir),
  openPackages: resolved.openPackages,
  openPackageIds: resolved.openPackageIds,
  activePackageId: active ? active.activePackageId : '',
  laneId: lane.id,
  laneTitle: lane.title,
  lanePackageId: lane.packageId,
  lanePath: lane.path,
  pathname: active ? active.pathname : '/',
 })
 return {
  ok: true,
  activeSession: active,
  dataDir: resolved.dataDir,
  lane: {
   ...lane,
   featuresParsed: parsedFeatures,
   tables: cleanFormattedTables,
  },
  deployStatus,
  agentContext: contextText,
 }
}

const EVAL_EXCLUDED_SCOPE_KEYS = new Set([
 'Array',
 'Date',
 'JSON',
 'Math',
 'Number',
 'argv',
 'console',
 'data',
 'deployLane',
 'document',
 'exportLaneLine',
 'fetch',
 'importLane',
 'respond',
 'resyncLane',
 'setLaneLine',
 'syncLaneTable',
 'syncTable',
 'tableChange',
 'window',
])

export async function agentEvalLane(rootKv, options = {}) {
 const resolved = await agentResolveSessionAndLane(rootKv, options)
 if (!resolved.laneId) {
  return { ok: false, error: 'laneId or lane title is required' }
 }
 const sessionKv = resolved.sessionKv
 const openPackageIds = resolved.openPackageIds
 const applyExports = Boolean(options.applyExports)
 const eventHub = options.eventHub || defaultAgentEventHub
 const logs = []

 const mockConsole = {
  log(...args) { logs.push({ level: 'log', message: args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ') }) },
  info(...args) { logs.push({ level: 'info', message: args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ') }) },
  warn(...args) { logs.push({ level: 'warn', message: args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ') }) },
  error(...args) { logs.push({ level: 'error', message: args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ') }) },
 }

 const evalCache = new Map()

 async function evaluateLaneById(targetId, stack = new Set(), isRoot = false) {
  const cleanId = String(targetId || '').trim()
  if (!cleanId) {
   return { ok: false, state: null, error: 'No target lane selected' }
  }
  if (stack.has(cleanId)) {
   return { ok: false, state: null, error: 'Circular lane import detected' }
  }
  if (!isRoot && openPackageIds && openPackageIds.length > 0) {
   const access = await checkLaneAccess(sessionKv, openPackageIds, cleanId)
   if (!access.allowed) {
    return { ok: false, state: null, error: 'Access denied: lane belongs to a locked package' }
   }
  }
  if (!isRoot && evalCache.has(cleanId)) {
   return evalCache.get(cleanId)
  }

  const nextStack = new Set(stack)
  nextStack.add(cleanId)

  const laneData = sessionKv.namespace(cleanId)
  const [title, inputsRaw, scriptLoaded, tables] = await Promise.all([
   laneData.get('title'),
   laneData.get('inputs'),
   loadLaneScript(sessionKv, laneData, cleanId, null),
   loadLaneTables(sessionKv, laneData, cleanId),
  ])

  let inputs = []
  if (typeof inputsRaw === 'string' && inputsRaw.trim().startsWith('[')) {
   try {
    const parsed = JSON.parse(inputsRaw)
    if (Array.isArray(parsed)) {
     inputs = parsed
    }
   }
   catch {
    inputs = []
   }
  }

  const inputOverrides = isRoot && options.inputs && typeof options.inputs === 'object' ? options.inputs : null
  const scriptRecords = Array.isArray(scriptLoaded && scriptLoaded.records) ? scriptLoaded.records : []
  const lines = isRoot && Array.isArray(options.lines)
   ? options.lines.map(String)
   : scriptRecords.map(r => (r && r.text !== undefined && r.text !== null ? String(r.text) : ''))
  const lineContext = { index: null, lineNumber: null, lineId: '' }
  const trigger = options.trigger
   ? String(options.trigger)
   : (options.tableChange ? 'table-change' : 'agent')
  const storyRecorder = isRoot && options.recordStory !== false
   ? createStoryRunRecorder({ laneId: cleanId, trigger })
   : null
  const env = {
   console: mockConsole,
   data: laneData,
   Math,
   Number,
   JSON,
   Date,
   Array,
   fetch: (...args) => (typeof globalThis.fetch === 'function' ? globalThis.fetch(...args) : null),
   respond: createResponseHelper(),
   syncTable: async (tblQuery, records, keyCol) => {
    const res = syncTableRowsInMemory(tables, tblQuery, records, keyCol)
    if (res.ok && res.table) {
     Object.assign(env, buildTablesScope(tables))
     await saveTableSchemaAndRows(sessionKv, laneData, cleanId, res.table)
     eventHub.emit({
      type: 'lane-updated',
      sessionId: resolved.activeSession ? resolved.activeSession.id : null,
      dataDir: resolved.dataDir,
      laneId: cleanId,
      action: 'sync-table',
      tableId: res.table.id,
     })
    }
    return res
   },
   syncLaneTable: async (targetLaneId, tblQuery, records, keyCol) => {
    const cleanTarget = String(targetLaneId || '').trim()
    const cleanTbl = String(tblQuery || '').trim()
    if (!cleanTarget) {
     const errRes = { ok: false, changed: false, count: 0, error: 'Target lane ID is required' }
     if (storyRecorder) {
      trackStoryExportTableCall({
       recorder: storyRecorder,
       lineContext,
       targetLaneId: cleanTarget,
       laneTitle: cleanTarget,
       tableName: cleanTbl,
       records,
       result: errRes,
      })
     }
     return errRes
    }
    if (!cleanTbl) {
     const errRes = { ok: false, changed: false, count: 0, error: 'Target table name or ID is required' }
     if (storyRecorder) {
      trackStoryExportTableCall({
       recorder: storyRecorder,
       lineContext,
       targetLaneId: cleanTarget,
       laneTitle: cleanTarget,
       tableName: cleanTbl,
       records,
       result: errRes,
      })
     }
     return errRes
    }
    if (openPackageIds && openPackageIds.length > 0) {
     const access = await checkLaneAccess(sessionKv, openPackageIds, cleanTarget)
     if (!access.allowed) {
      const errRes = { ok: false, changed: false, laneId: cleanTarget, count: 0, error: 'Access denied: lane belongs to a locked package' }
      if (storyRecorder) {
       trackStoryExportTableCall({
        recorder: storyRecorder,
        lineContext,
        targetLaneId: cleanTarget,
        laneTitle: cleanTarget,
        tableName: cleanTbl,
        records,
        result: errRes,
       })
      }
      return errRes
     }
    }
    const targetData = sessionKv.namespace(cleanTarget)
    const targetTables = await loadLaneTables(sessionKv, targetData, cleanTarget)
    const res = syncTableRowsInMemory(targetTables, cleanTbl, records, keyCol)
    if (res.ok && res.table) {
     await saveTableSchemaAndRows(sessionKv, targetData, cleanTarget, res.table)
     evalCache.delete(cleanTarget)
     eventHub.emit({
      type: 'lane-updated',
      sessionId: resolved.activeSession ? resolved.activeSession.id : null,
      dataDir: resolved.dataDir,
      laneId: cleanTarget,
      action: 'sync-lane-table',
      tableId: res.table.id,
     })
    }
    const outRes = { ...res, laneId: cleanTarget }
    if (storyRecorder) {
     const targetTitleRaw = await targetData.get('title')
     const laneTitle = targetTitleRaw ? String(targetTitleRaw).trim() : cleanTarget
     trackStoryExportTableCall({
      recorder: storyRecorder,
      lineContext,
      targetLaneId: cleanTarget,
      laneTitle,
      tableName: cleanTbl,
      records,
      result: outRes,
     })
    }
    return outRes
   },
   deployLane: async (targetLaneId, deployOpts = null) => {
    const cleanTarget = String(targetLaneId || '').trim()
    if (!cleanTarget) {
     return { ok: false, status: 'error', error: 'Target lane ID is required' }
    }
    if (openPackageIds && openPackageIds.length > 0) {
     const access = await checkLaneAccess(sessionKv, openPackageIds, cleanTarget)
     if (!access.allowed) {
      return { ok: false, status: 'error', laneId: cleanTarget, error: 'Access denied: lane belongs to a locked package' }
     }
    }
    const optsObj = deployOpts && typeof deployOpts === 'object' ? deployOpts : {}
    const tableChange = isRoot && options.tableChange && typeof options.tableChange === 'object' ? options.tableChange : null
    const tableQuery = optsObj.tableId || optsObj.table || optsObj.tableName || (tableChange ? (tableChange.tableId || tableChange.tableName) : '')
    const srcTable = tableQuery ? findTableByIdOrName(tables, tableQuery) : (tables[0] || null)
    if (tableChange && (optsObj.table || optsObj.tableId || optsObj.tableName) && srcTable) {
     const matchesChangedTable = tableChange.tableId === srcTable.id ||
      (tableChange.tableName && String(tableChange.tableName).toLowerCase() === String(srcTable.name || '').toLowerCase())
     if (!matchesChangedTable && optsObj.changed === false && !optsObj.force) {
      return { ok: true, skipped: true, status: 'up-to-date', laneId: cleanTarget }
     }
    }
    const [dep, servers, targetTitle] = await Promise.all([
     loadLaneDeployment(resolved.registryKv, cleanTarget),
     loadDeployServers(resolved.registryKv),
     sessionKv.namespace(cleanTarget).get('title'),
    ])
    const srv = dep && dep.serverId ? (servers.find(s => s && s.id === dep.serverId) || null) : null
    const resolvedTitle = (targetTitle && String(targetTitle).trim()) || (dep && dep.title) || cleanTarget
    const bundle = await collectLaneSyncBundle(sessionKv, cleanTarget, {
     includeImports: Boolean(dep && dep.includeImports),
     openPackageIds,
    })
    const resyncRes = await executeLaneResync({
     laneId: cleanTarget,
     deployment: dep,
     server: srv,
     bundle,
    })
    const nowIso = (resyncRes && resyncRes.deployedAt) || new Date().toISOString()
    if (resyncRes.ok) {
     const snapRecs = bundle.lanes[0] && Array.isArray(bundle.lanes[0].records) ? bundle.lanes[0].records : []
     await saveDeployedLaneScript(resolved.registryKv, cleanTarget, snapRecs, nowIso)
     if (dep) {
      await saveLaneDeployment(resolved.registryKv, {
       ...dep,
       lastSyncedAt: nowIso,
       lastDeployedAt: nowIso,
       lastSyncLaneIds: bundle.lanes.map(l => l.id),
       publicUrl: resyncRes.publicUrl || dep.publicUrl || '',
      })
     }
    }
    const recCount = optsObj.recordCount !== undefined && optsObj.recordCount !== null
     ? Number(optsObj.recordCount)
     : null
    const countLabel = Number.isFinite(recCount)
     ? `${recCount} public ${recCount === 1 ? 'item' : 'items'}`
     : 'records'
    const srvLabel = srv && srv.name ? ` to ${srv.name}` : ''
    const summaryText = optsObj.summary
     ? String(optsObj.summary)
     : (resyncRes.ok
      ? `Synced ${countLabel} & deployed${srvLabel}`
      : `Deploy failed: ${resyncRes.error || 'Unknown error'}`)
    const triggerLabel = (tableChange && tableChange.action)
     ? String(tableChange.action)
     : (optsObj.trigger ? String(optsObj.trigger) : 'Record change')
    const updateEntry = {
     id: generateLineId(null).replace(/^ln-/, 'upd-'),
     tableId: srcTable ? srcTable.id : '',
     tableName: srcTable ? srcTable.name : String(tableQuery || ''),
     targetLaneId: cleanTarget,
     targetLaneTitle: resolvedTitle,
     status: resyncRes.ok ? 'deployed' : 'error',
     ok: Boolean(resyncRes.ok),
     slug: (dep && dep.slug) || resyncRes.slug || '',
     serverName: (srv && srv.name) || '',
     publicUrl: resyncRes.publicUrl || (dep && dep.publicUrl) || '',
     recordCount: Number.isFinite(recCount) ? recCount : null,
     trigger: triggerLabel,
     summary: summaryText,
     triggeredAt: nowIso,
     deployedAt: nowIso,
     error: resyncRes.ok ? null : (resyncRes.error || 'Deploy failed'),
    }
    if (srcTable && srcTable.id) {
     await recordTableDeploymentUpdate(sessionKv, laneData, cleanId, srcTable.id, updateEntry)
     eventHub.emit({
      type: 'lane-updated',
      sessionId: resolved.activeSession ? resolved.activeSession.id : null,
      dataDir: resolved.dataDir,
      laneId: cleanId,
      action: 'table-deployment-update',
      tableId: srcTable.id,
     })
    }
    eventHub.emit({
     type: 'lane-updated',
     sessionId: resolved.activeSession ? resolved.activeSession.id : null,
     dataDir: resolved.dataDir,
     laneId: cleanTarget,
     action: 'deploy-lane',
    })
    return updateEntry
   },
   importLane: async (nestedId, ...nestedPath) => {
    const invokeImport = async () => {
     const nestedRes = await evaluateLaneById(nestedId, nextStack, false)
     return resolveImportValue(nestedRes, nestedPath)
    }
    if (!storyRecorder) {
     return invokeImport()
    }
    const cleanNestedId = String(nestedId || '').trim()
    const nestedTitleRaw = cleanNestedId ? await sessionKv.namespace(cleanNestedId).get('title') : ''
    const laneTitle = nestedTitleRaw ? String(nestedTitleRaw).trim() : cleanNestedId
    return trackStoryImportCall({
     recorder: storyRecorder,
     lineContext,
     lines,
     targetId: nestedId,
     path: nestedPath,
     laneTitle,
     invokeImport,
    })
   },
   exportLaneLine: async (targets, valueExpr) => {
    const targetList = Array.isArray(targets) ? targets : []
    const text = valueExpr === null || valueExpr === undefined ? '' : String(valueExpr)
    const results = []
    let changedCount = 0
    for (const pair of targetList) {
     if (!Array.isArray(pair) || pair.length < 2) {
      continue
     }
     const [tLaneId, tLineId] = pair
     if (applyExports) {
      const writeRes = await setTargetLaneLine(sessionKv, tLaneId, tLineId, text, null)
      if (writeRes.changed) {
       changedCount += 1
       eventHub.emit({
        type: 'lane-updated',
        sessionId: resolved.activeSession ? resolved.activeSession.id : null,
        dataDir: resolved.dataDir,
        laneId: String(tLaneId),
        action: 'export-line',
       })
      }
      results.push(writeRes)
     }
     else {
      results.push({
       ok: true,
       readonly: true,
       laneId: String(tLaneId),
       lineId: String(tLineId),
       text,
      })
     }
    }
    const expRes = {
     ok: true,
     readonly: !applyExports,
     content: text,
     changedCount,
     targets: results,
    }
    if (storyRecorder) {
     trackStoryExportLineCall({
      recorder: storyRecorder,
      lineContext,
      lines,
      result: expRes,
     })
    }
    return expRes
   },
  }
  env.setLaneLine = env.exportLaneLine
  env.resyncLane = env.deployLane
  env.tableChange = isRoot && options.tableChange ? options.tableChange : null

  const resolvedSecrets = await resolveLaneSecrets(sessionKv, laneData, cleanId, inputs)
  const secretNames = [...resolvedSecrets.secretNames]
  const secretSetNames = new Set(resolvedSecrets.secretSetNames)
  const secretValues = [...resolvedSecrets.secretValues]

  for (const entry of inputs) {
   if (!entry || typeof entry !== 'object') {
    continue
   }
   const name = String(entry.name || '').trim()
   if (!name) {
    continue
   }
   const type = normalizePrimitiveType(entry.type)
   if (type === 'secret') {
    if (inputOverrides && Object.hasOwn(inputOverrides, name)) {
     const overrideVal = inputOverrides[name] === null || inputOverrides[name] === undefined ? '' : String(inputOverrides[name])
     env[name] = overrideVal
     if (overrideVal.length > 0) {
      secretSetNames.add(name)
      secretValues.push(overrideVal)
     }
    }
    else {
     env[name] = Object.hasOwn(resolvedSecrets.values, name) ? resolvedSecrets.values[name] : ''
    }
    continue
   }
   env[name] = inputOverrides && Object.hasOwn(inputOverrides, name)
    ? inputOverrides[name]
    : defaultValueForType(type)
  }
  if (inputOverrides) {
   for (const [k, v] of Object.entries(inputOverrides)) {
    if (k && !Object.hasOwn(env, k)) {
     env[k] = v
    }
   }
  }

  Object.assign(env, buildTablesScope(tables))

  const secretSetNamesArr = [...secretSetNames]
  if (secretNames.length > 0) {
   env.__secretNames = secretNames
   env.__secretSetNames = secretSetNamesArr
   env.__secretValues = secretValues
  }
  const capturedInputs = storyRecorder ? captureStoryEnvInputs(inputs, env) : null

  const outcome = await runLines(lines, {
   filename: cleanId,
   initialState: env,
   secretNames,
   secretSetNames: secretSetNamesArr,
   secretValues,
   lineContext,
   lineRecords: scriptRecords,
  })

  if (storyRecorder) {
   await recordLaneStoryFromRun(
    sessionKv,
    laneData,
    cleanId,
    storyRecorder,
    capturedInputs,
    outcome,
    scriptRecords,
    { trigger }
   )
   eventHub.emit({
    type: 'lane-story-added',
    sessionId: resolved.activeSession ? resolved.activeSession.id : null,
    dataDir: resolved.dataDir,
    laneId: cleanId,
   })
  }

  const res = {
   ok: true,
   laneId: cleanId,
   title: title === null || title === undefined ? '' : String(title),
   records: scriptRecords,
   lines,
   tables,
   outcome,
   state: outcome.state,
   error: null,
  }
  if (!isRoot) {
   evalCache.set(cleanId, res)
  }
  return res
 }

 const evaluated = await evaluateLaneById(resolved.laneId, new Set(), true)
 if (!evaluated.ok) {
  return evaluated
 }

 const { outcome } = evaluated
 const lineResults = outcome.results.map((r, idx) => ({
  index: r.index,
  lineNumber: r.lineNumber,
  lineId: evaluated.records[idx] ? evaluated.records[idx].id : null,
  source: r.source,
  preview: r.preview,
  error: r.error ? (r.error.message || String(r.error)) : null,
  isEmpty: r.isEmpty,
  isComment: r.isComment,
 }))

 const scopeEntries = listScopeEntries(outcome.state, { isRoot: true })
  .filter(entry => !EVAL_EXCLUDED_SCOPE_KEYS.has(entry.key))
  .map(entry => {
   let jsonValue = undefined
   try {
    jsonValue = JSON.parse(JSON.stringify(entry.value))
   }
   catch {
    jsonValue = undefined
   }
   return {
    key: entry.key,
    type: entry.type,
    summary: entry.summary,
    detail: entry.detail,
    value: jsonValue,
   }
  })

 const handlers = detectLaneHandlers(outcome.state)
 let httpSimulation = null
 if (options.httpRequest && typeof options.httpRequest === 'object') {
  const simReq = options.httpRequest
  httpSimulation = await simulateLaneRequest({
   lines: evaluated.lines,
   tables: evaluated.tables,
   laneId: evaluated.laneId,
   laneData: sessionKv.namespace(evaluated.laneId),
   cachedState: outcome.state,
   req: {
    method: simReq.method || 'GET',
    url: simReq.url || simReq.path || '/',
    path: simReq.path || simReq.url || '/',
    headers: simReq.headers || {},
    body: simReq.body,
   },
  })
 }

 return {
  ok: true,
  activeSession: resolved.activeSession,
  dataDir: resolved.dataDir,
  laneId: evaluated.laneId,
  title: evaluated.title,
  lineCount: lineResults.length,
  errorCount: lineResults.filter(l => l.error).length,
  lines: lineResults,
  scope: scopeEntries,
  sentPacketsCount: Array.isArray(outcome.sent) ? outcome.sent.length : 0,
  sentPackets: (Array.isArray(outcome.sent) ? outcome.sent : []).map(pkt => ({
   index: pkt.index,
   lineNumber: pkt.lineNumber,
   args: pkt.args,
   bindingKeys: Object.keys(pkt.bindings || {}),
  })),
  handlers,
  httpSimulation,
  logs,
 }
}

export async function agentCreateLane(rootKv, options = {}) {
 const resolved = await agentResolveSessionAndLane(rootKv, options)
 const sessionKv = resolved.sessionKv
 const active = resolved.activeSession
 const eventHub = options.eventHub || defaultAgentEventHub
 const laneId = options.id && String(options.id).trim()
  ? String(options.id).trim()
  : (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function'
   ? globalThis.crypto.randomUUID()
   : `lane-${Date.now()}`)
 const title = options.title && String(options.title).trim()
  ? String(options.title).trim()
  : 'Untitled Lane'
 const packageId = options.packageId && String(options.packageId).trim()
  ? String(options.packageId).trim()
  : (active && active.activePackageId ? active.activePackageId : DEFAULT_PACKAGE_ID)

 const initialLines = Array.isArray(options.lines) ? options.lines.map(String) : ['']
 const validation = validateFieldScriptLines(initialLines, { filename: laneId })
 if (!validation.ok) {
  return {
   ok: false,
   syntaxError: true,
   error: `Cannot create lane "${title}" with unparseable FieldScript: ${validation.error}`,
   errors: validation.errors,
  }
 }

 const laneData = sessionKv.namespace(laneId)
 await laneData.set('title', title)
 if (options.width !== undefined && options.width !== null) {
  const normW = normalizeLaneWidth(options.width)
  await laneData.set('width', normW === null ? '' : String(normW))
 }
 if (options.path !== undefined && options.path !== null) {
  const normP = normalizeLanePath(options.path)
  await laneData.set('path', normP || '')
 }
 if (options.features && typeof options.features === 'object') {
  await laneData.set('features', JSON.stringify(normalizeLaneFeatures(options.features)))
 }
 const records = await saveLaneScript(sessionKv, laneData, laneId, initialLines, null)
 await registerLaneInPackage(sessionKv, laneId, title, packageId)

 if (options.openInSession !== false && active && active.id) {
  const nextLaneIds = Array.isArray(active.laneIds) ? [...active.laneIds] : []
  if (!nextLaneIds.includes(laneId)) {
   nextLaneIds.push(laneId)
   const basePathname = typeof active.pathname === 'string' && active.pathname.trim() && active.pathname.trim() !== '/'
    ? active.pathname.trim().replace(/\/+$/, '')
    : ''
   const nextPathname = basePathname ? `${basePathname}/${laneId}` : undefined
   await saveSessionVersion(resolved.rootKv, null, active.id, {
    laneIds: nextLaneIds,
    pathname: nextPathname,
    openPackageIds: resolved.openPackageIds,
    activePackageId: active.activePackageId || packageId,
    incrementVersion: false,
   })
  }
 }

 eventHub.emit({
  type: 'lane-created',
  sessionId: active ? active.id : null,
  dataDir: resolved.dataDir,
  laneId,
  title,
  packageId,
 })

 return {
  ok: true,
  laneId,
  title,
  packageId,
  records,
 }
}

export async function agentConfigureLane(rootKv, options = {}) {
 const resolved = await agentResolveSessionAndLane(rootKv, options)
 if (!resolved.laneId) {
  return { ok: false, error: 'laneId or lane title is required' }
 }
 const laneId = resolved.laneId
 const sessionKv = resolved.sessionKv
 const laneData = sessionKv.namespace(laneId)
 const eventHub = options.eventHub || defaultAgentEventHub

 if (options.title !== undefined && options.title !== null) {
  const nextTitle = String(options.title).trim() || laneId
  await laneData.set('title', nextTitle)
  const pkgId = await getLanePackageId(sessionKv, laneId)
  await registerLaneInPackage(sessionKv, laneId, nextTitle, pkgId)
 }
 if (options.width !== undefined) {
  const normW = normalizeLaneWidth(options.width)
  await laneData.set('width', normW === null ? '' : String(normW))
 }
 if (options.path !== undefined) {
  const normP = normalizeLanePath(options.path)
  await laneData.set('path', normP || '')
 }
 if (options.minimized !== undefined) {
  const side = normalizeLaneMinimizeSide(options.minimized)
  await laneData.set('minimized', side || '')
 }
 if (options.features && typeof options.features === 'object') {
  const curRaw = await laneData.get('features')
  const curFeatures = parseLaneFeatures(curRaw)
  const merged = normalizeLaneFeatures({ ...curFeatures, ...options.features })
  await laneData.set('features', JSON.stringify(merged))
 }

 eventHub.emit({
  type: 'lane-updated',
  sessionId: resolved.activeSession ? resolved.activeSession.id : null,
  dataDir: resolved.dataDir,
  laneId,
  action: 'configure',
 })

 return agentGetLane(resolved.rootKv, {
  sessionId: resolved.activeSession ? resolved.activeSession.id : options.sessionId,
  dataDir: resolved.dataDir,
  laneId,
 })
}

export async function agentMutateLaneScript(rootKv, options = {}) {
 const resolved = await agentResolveSessionAndLane(rootKv, options)
 if (!resolved.laneId) {
  return { ok: false, error: 'laneId or lane title is required' }
 }
 const laneId = resolved.laneId
 const sessionKv = resolved.sessionKv
 const laneData = sessionKv.namespace(laneId)
 const eventHub = options.eventHub || defaultAgentEventHub
 const action = String(options.action || 'set-line').trim().toLowerCase()

 const loaded = await loadLaneScript(sessionKv, laneData, laneId, null)
 const records = Array.isArray(loaded && loaded.records) ? [...loaded.records] : []
 const now = new Date().toISOString()

 if (action === 'set-line' || action === 'update-line') {
  let targetLineId = options.lineId ? String(options.lineId).trim() : ''
  if (!targetLineId && options.lineNumber !== undefined && options.lineNumber !== null) {
   const num = Number(options.lineNumber)
   if (Number.isInteger(num) && num >= 1 && num <= records.length) {
    targetLineId = records[num - 1].id
   }
  }
  if (!targetLineId) {
   return { ok: false, error: `Valid lineId or lineNumber (1..${records.length}) is required` }
  }
  const res = await setTargetLaneLine(sessionKv, laneId, targetLineId, options.text ?? '', null)
  if (res.ok) {
   eventHub.emit({
    type: 'lane-updated',
    sessionId: resolved.activeSession ? resolved.activeSession.id : null,
    dataDir: resolved.dataDir,
    laneId,
    action: 'set-line',
    lineId: targetLineId,
   })
  }
  return res
 }

 if (action === 'append-line' || action === 'insert-line') {
  let insertIdx = records.length
  if (action === 'insert-line' && options.lineNumber !== undefined && options.lineNumber !== null) {
   const num = Number(options.lineNumber)
   if (Number.isInteger(num) && num >= 1) {
    insertIdx = Math.min(num - 1, records.length)
   }
  }
  const textStr = options.text === null || options.text === undefined ? '' : String(options.text)
  const check = validateFieldScriptLine(textStr, { filename: laneId, lineIndex: insertIdx })
  if (!check.ok) {
   return {
    ok: false,
    syntaxError: true,
    syntaxErrorDetail: check.error,
    error: `Cannot save unparseable FieldScript in lane "${laneId}" line ${insertIdx + 1}: ${check.error}`,
    laneId,
    lineNumber: insertIdx + 1,
   }
  }
  const newRec = {
   id: options.lineId && String(options.lineId).trim() ? String(options.lineId).trim() : generateLineId(null),
   text: textStr,
   updatedAt: now,
  }
  records.splice(insertIdx, 0, newRec)
  const allIds = records.map(r => r.id)
  await saveScriptLinesAndIndex(sessionKv, laneData, laneId, [newRec], allIds, [], now)
  eventHub.emit({
   type: 'lane-updated',
   sessionId: resolved.activeSession ? resolved.activeSession.id : null,
   dataDir: resolved.dataDir,
   laneId,
   action,
   lineId: newRec.id,
  })
  return {
   ok: true,
   laneId,
   lineId: newRec.id,
   lineNumber: insertIdx + 1,
   text: newRec.text,
   records,
  }
 }

 if (action === 'delete-line' || action === 'remove-line') {
  let targetIdx = -1
  if (options.lineId) {
   const cleanLineId = String(options.lineId).trim()
   targetIdx = records.findIndex(r => r && r.id === cleanLineId)
  }
  else if (options.lineNumber !== undefined && options.lineNumber !== null) {
   const num = Number(options.lineNumber)
   if (Number.isInteger(num) && num >= 1 && num <= records.length) {
    targetIdx = num - 1
   }
  }
  if (targetIdx === -1) {
   return { ok: false, error: 'Target line not found for deletion' }
  }
  const [removed] = records.splice(targetIdx, 1)
  const dirty = []
  if (records.length === 0) {
   const blank = { id: generateLineId(null), text: '', updatedAt: now }
   records.push(blank)
   dirty.push(blank)
  }
  const allIds = records.map(r => r.id)
  await saveScriptLinesAndIndex(sessionKv, laneData, laneId, dirty, allIds, [removed.id], now)
  eventHub.emit({
   type: 'lane-updated',
   sessionId: resolved.activeSession ? resolved.activeSession.id : null,
   dataDir: resolved.dataDir,
   laneId,
   action: 'delete-line',
   lineId: removed.id,
  })
  return {
   ok: true,
   laneId,
   removedLineId: removed.id,
   removedLineNumber: targetIdx + 1,
   records,
  }
 }

 if (action === 'replace-script' || action === 'set-script') {
  const rawLines = Array.isArray(options.lines)
   ? options.lines
   : (typeof options.script === 'string' ? options.script.split('\n') : [])
  const nextRecords = rawLines.map((item, idx) => {
   if (item && typeof item === 'object') {
    return {
     id: item.id || (records[idx] ? records[idx].id : generateLineId(null)),
     text: item.text === null || item.text === undefined ? '' : String(item.text),
     updatedAt: now,
    }
   }
   const existing = records[idx]
   const text = item === null || item === undefined ? '' : String(item)
   const unchanged = existing && existing.text === text
   return {
    id: existing ? existing.id : generateLineId(null),
    text,
    updatedAt: unchanged ? existing.updatedAt : now,
   }
  })
  if (nextRecords.length === 0) {
   nextRecords.push({
    id: records[0] ? records[0].id : generateLineId(null),
    text: '',
    updatedAt: now,
   })
  }
  const validation = validateFieldScriptLines(nextRecords, { filename: laneId })
  if (!validation.ok) {
   return {
    ok: false,
    syntaxError: true,
    error: `Cannot save unparseable FieldScript in lane "${laneId}": ${validation.error}`,
    errors: validation.errors,
    laneId,
   }
  }
  const saved = await saveLaneScript(sessionKv, laneData, laneId, nextRecords, null, now)
  eventHub.emit({
   type: 'lane-updated',
   sessionId: resolved.activeSession ? resolved.activeSession.id : null,
   dataDir: resolved.dataDir,
   laneId,
   action: 'replace-script',
  })
  return {
   ok: true,
   laneId,
   records: saved,
  }
 }

 return { ok: false, error: `Unknown script action: "${action}"` }
}

function findTableByIdOrName(tables, query) {
 const clean = String(query || '').trim()
 if (!clean) {
  return null
 }
 const exactId = tables.find(t => t && t.id === clean)
 if (exactId) {
  return exactId
 }
 const lower = clean.toLowerCase()
 return tables.find(t => t && String(t.name || '').trim().toLowerCase() === lower) || null
}

function findColumnByIdOrName(columns, query) {
 const clean = String(query || '').trim()
 if (!clean) {
  return null
 }
 const exactId = columns.find(c => c && c.id === clean)
 if (exactId) {
  return exactId
 }
 const lower = clean.toLowerCase()
 return columns.find(c => c && String(c.name || '').trim().toLowerCase() === lower) || null
}

function coerceAgentCellValue(rawVal, col, allTables) {
 const parsedType = parseColumnType(col)
 if (typeof rawVal === 'string' && (parsedType.type === 'fixed' || parsedType.type === 'integer' || parsedType.type === 'decimal' || parsedType.type === 'boolean')) {
  const parsed = parseCellValue(rawVal, parsedType, allTables)
  if (parsed.ok) {
   return parsed.value
  }
 }
 return coerceDataValue(rawVal, parsedType, parsedType.multiple, null, allTables)
}

export async function agentMutateLaneTable(rootKv, options = {}) {
 const resolved = await agentResolveSessionAndLane(rootKv, options)
 if (!resolved.laneId) {
  return { ok: false, error: 'laneId or lane title is required' }
 }
 const laneId = resolved.laneId
 const sessionKv = resolved.sessionKv
 const laneData = sessionKv.namespace(laneId)
 const eventHub = options.eventHub || defaultAgentEventHub
 const action = String(options.action || 'upsert-row').trim().toLowerCase()
 const tables = await loadLaneTables(sessionKv, laneData, laneId)

 if (action === 'create-table' || action === 'add-table') {
  const tableName = String(options.tableName || options.table || 'table_1').trim()
  const tableId = options.tableId && String(options.tableId).trim()
   ? String(options.tableId).trim()
   : `tbl-${globalThis.crypto && globalThis.crypto.randomUUID ? globalThis.crypto.randomUUID() : Date.now()}`
  const rawCols = Array.isArray(options.columns) ? options.columns : []
  const columns = rawCols.map((c, idx) => {
   const colId = c && c.id ? String(c.id) : `col-${Date.now()}-${idx + 1}`
   const parsed = parseColumnType(c || { type: 'text' })
   const col = {
    id: colId,
    name: c && c.name ? String(c.name).trim() : `col_${idx + 1}`,
    type: parsed.type,
    multiple: parsed.multiple,
   }
   if (parsed.type === 'fixed') {
    col.decimals = parsed.decimals
   }
   if (c && c.required === true) {
    col.required = true
   }
   return col
  })
  const newTable = { id: tableId, name: tableName, columns, rows: [] }
  tables.push(newTable)
  await addLaneTable(sessionKv, laneData, laneId, newTable, tables.map(t => t.id))
  eventHub.emit({
   type: 'lane-updated',
   sessionId: resolved.activeSession ? resolved.activeSession.id : null,
   dataDir: resolved.dataDir,
   laneId,
   action: 'create-table',
   tableId,
  })
  return { ok: true, laneId, table: formatTableWithNamedRows(newTable) }
 }

 const tableQuery = options.tableId || options.tableName || options.table
 const table = findTableByIdOrName(tables, tableQuery)
 if (!table) {
  return { ok: false, error: `Table "${tableQuery || ''}" not found in lane "${laneId}"` }
 }

 if (action === 'delete-table') {
  const remaining = tables.filter(t => t.id !== table.id).map(t => t.id)
  await deleteLaneTable(sessionKv, laneData, laneId, table, remaining)
  eventHub.emit({
   type: 'lane-updated',
   sessionId: resolved.activeSession ? resolved.activeSession.id : null,
   dataDir: resolved.dataDir,
   laneId,
   action: 'delete-table',
   tableId: table.id,
  })
  return { ok: true, laneId, deletedTableId: table.id }
 }

 if (action === 'add-column') {
  const colSpec = options.column && typeof options.column === 'object' ? options.column : options
  const colId = colSpec.columnId || colSpec.id || `col-${globalThis.crypto && globalThis.crypto.randomUUID ? globalThis.crypto.randomUUID() : Date.now()}`
  const parsed = parseColumnType(colSpec)
  const newCol = {
   id: String(colId),
   name: String(colSpec.columnName || colSpec.name || `col_${table.columns.length + 1}`).trim(),
   type: parsed.type,
   multiple: parsed.multiple,
  }
  if (parsed.type === 'fixed') {
   newCol.decimals = parsed.decimals
  }
  if (colSpec.required === true) {
   newCol.required = true
  }
  table.columns.push(newCol)
  await saveTableSchema(sessionKv, laneData, laneId, table)
  eventHub.emit({
   type: 'lane-updated',
   sessionId: resolved.activeSession ? resolved.activeSession.id : null,
   dataDir: resolved.dataDir,
   laneId,
   action: 'add-column',
   tableId: table.id,
  })
  return { ok: true, laneId, table: formatTableWithNamedRows(table), column: newCol }
 }

 if (action === 'add-row' || action === 'upsert-row' || action === 'update-row') {
  const rawValues = options.values && typeof options.values === 'object' ? options.values : {}
  const targetRowId = options.rowId ? String(options.rowId).trim() : ''
  let existingRow = targetRowId ? table.rows.find(r => r && r.id === targetRowId) : null

  if (!existingRow && action === 'update-row') {
   return { ok: false, error: `Row "${targetRowId}" not found in table "${table.name}"` }
  }

  const isNew = !existingRow
  const rowId = existingRow
   ? existingRow.id
   : (targetRowId || `row-${globalThis.crypto && globalThis.crypto.randomUUID ? globalThis.crypto.randomUUID() : Date.now()}`)

  const nextValues = existingRow ? { ...existingRow.values } : {}
  if (isNew) {
   for (const col of table.columns) {
    nextValues[col.id] = defaultDataValue(col, col.multiple)
   }
  }
  for (const [key, val] of Object.entries(rawValues)) {
   const col = findColumnByIdOrName(table.columns, key)
   if (!col) {
    continue
   }
   nextValues[col.id] = coerceAgentCellValue(val, col, tables)
  }

  const rowRecord = { id: rowId, values: nextValues }
  if (isNew) {
   table.rows.push(rowRecord)
   await addTableRow(sessionKv, laneData, laneId, table.id, rowRecord, table.rows.map(r => r.id))
  }
  else {
   existingRow.values = nextValues
   await saveTableRow(sessionKv, laneData, laneId, table.id, existingRow)
  }

  let triggeredEval = null
  const scriptLoaded = await loadLaneScript(sessionKv, laneData, laneId, null)
  const hasTriggerScript = Array.isArray(scriptLoaded && scriptLoaded.records) &&
   scriptLoaded.records.some(r => r && typeof r.text === 'string' && /\b(?:syncLaneTable|deployLane|resyncLane|exportLaneLine|setLaneLine)\b/.test(r.text))
  if (hasTriggerScript && options.runScriptOnTableChange !== false) {
   triggeredEval = await agentEvalLane(resolved.rootKv, {
    sessionId: resolved.activeSession ? resolved.activeSession.id : options.sessionId,
    dataDir: resolved.dataDir,
    laneId,
    applyExports: true,
    eventHub,
    tableChange: {
     tableId: table.id,
     tableName: table.name,
     rowId,
     action: isNew ? 'add-row' : 'update-row',
    },
   })
  }

  eventHub.emit({
   type: 'lane-updated',
   sessionId: resolved.activeSession ? resolved.activeSession.id : null,
   dataDir: resolved.dataDir,
   laneId,
   action: isNew ? 'add-row' : 'update-row',
   tableId: table.id,
   rowId,
  })
  const updates = await loadTableUpdates(sessionKv, laneData, laneId, table.id)
  return {
   ok: true,
   laneId,
   tableId: table.id,
   tableName: table.name,
   isNew,
   row: rowRecord,
   table: { ...formatTableWithNamedRows(table), updates },
   triggeredEval: triggeredEval ? { ok: triggeredEval.ok, errorCount: triggeredEval.errorCount } : null,
  }
 }

 if (action === 'delete-row') {
  const rowId = String(options.rowId || '').trim()
  const idx = table.rows.findIndex(r => r && r.id === rowId)
  if (idx === -1) {
   return { ok: false, error: `Row "${rowId}" not found in table "${table.name}"` }
  }
  table.rows.splice(idx, 1)
  await deleteTableRow(sessionKv, laneData, laneId, table.id, rowId, table.rows.map(r => r.id))
  const scriptLoaded = await loadLaneScript(sessionKv, laneData, laneId, null)
  const hasTriggerScript = Array.isArray(scriptLoaded && scriptLoaded.records) &&
   scriptLoaded.records.some(r => r && typeof r.text === 'string' && /\b(?:syncLaneTable|deployLane|resyncLane|exportLaneLine|setLaneLine)\b/.test(r.text))
  if (hasTriggerScript && options.runScriptOnTableChange !== false) {
   await agentEvalLane(resolved.rootKv, {
    sessionId: resolved.activeSession ? resolved.activeSession.id : options.sessionId,
    dataDir: resolved.dataDir,
    laneId,
    applyExports: true,
    eventHub,
    tableChange: {
     tableId: table.id,
     tableName: table.name,
     rowId,
     action: 'delete-row',
    },
   })
  }
  eventHub.emit({
   type: 'lane-updated',
   sessionId: resolved.activeSession ? resolved.activeSession.id : null,
   dataDir: resolved.dataDir,
   laneId,
   action: 'delete-row',
   tableId: table.id,
   rowId,
  })
  return { ok: true, laneId, tableId: table.id, deletedRowId: rowId }
 }

 if (action === 'clear-rows') {
  const removedIds = table.rows.map(r => r.id)
  table.rows = []
  await clearTableRows(sessionKv, laneData, laneId, table.id, removedIds)
  const scriptLoaded = await loadLaneScript(sessionKv, laneData, laneId, null)
  const hasTriggerScript = Array.isArray(scriptLoaded && scriptLoaded.records) &&
   scriptLoaded.records.some(r => r && typeof r.text === 'string' && /\b(?:syncLaneTable|deployLane|resyncLane|exportLaneLine|setLaneLine)\b/.test(r.text))
  if (hasTriggerScript && options.runScriptOnTableChange !== false) {
   await agentEvalLane(resolved.rootKv, {
    sessionId: resolved.activeSession ? resolved.activeSession.id : options.sessionId,
    dataDir: resolved.dataDir,
    laneId,
    applyExports: true,
    eventHub,
    tableChange: {
     tableId: table.id,
     tableName: table.name,
     rowId: '',
     action: 'clear-rows',
    },
   })
  }
  eventHub.emit({
   type: 'lane-updated',
   sessionId: resolved.activeSession ? resolved.activeSession.id : null,
   dataDir: resolved.dataDir,
   laneId,
   action: 'clear-rows',
   tableId: table.id,
  })
  return { ok: true, laneId, tableId: table.id, clearedCount: removedIds.length }
 }

 return { ok: false, error: `Unknown table action: "${action}"` }
}

export async function agentMutateLaneInput(rootKv, options = {}) {
 const resolved = await agentResolveSessionAndLane(rootKv, options)
 if (!resolved.laneId) {
  return { ok: false, error: 'laneId or lane title is required' }
 }
 const laneId = resolved.laneId
 const sessionKv = resolved.sessionKv
 const laneData = sessionKv.namespace(laneId)
 const eventHub = options.eventHub || defaultAgentEventHub
 const action = String(options.action || 'set-input').trim().toLowerCase()
 const cleanName = String(options.name || '').trim()
 if (!cleanName) {
  return { ok: false, error: 'Input variable name is required' }
 }

 const rawInputs = await laneData.get('inputs')
 let inputs = []
 if (typeof rawInputs === 'string' && rawInputs.trim().startsWith('[')) {
  try {
   const parsed = JSON.parse(rawInputs)
   if (Array.isArray(parsed)) {
    inputs = parsed.filter(item => item && typeof item === 'object')
   }
  }
  catch {
   inputs = []
  }
 }

 const existingIdx = inputs.findIndex(item => String(item.name || '').trim() === cleanName)
 const existing = existingIdx >= 0 ? inputs[existingIdx] : null

 if (action === 'delete-input' || action === 'remove-input') {
  if (existingIdx === -1) {
   return { ok: false, error: `Input "${cleanName}" not found in lane "${laneId}"` }
  }
  const [removed] = inputs.splice(existingIdx, 1)
  if (removed && removed.type === 'secret' && removed.secretId) {
   await deleteLaneSecret(sessionKv, laneData, laneId, removed.secretId)
  }
  await laneData.set('inputs', JSON.stringify(inputs))
  eventHub.emit({
   type: 'lane-updated',
   sessionId: resolved.activeSession ? resolved.activeSession.id : null,
   dataDir: resolved.dataDir,
   laneId,
   action: 'delete-input',
   inputName: cleanName,
  })
  return { ok: true, laneId, deletedName: cleanName, inputs }
 }

 if (action === 'set-input' || action === 'add-input' || action === 'set-secret') {
  const cleanType = action === 'set-secret'
   ? 'secret'
   : normalizePrimitiveType(options.type || (existing ? existing.type : 'string'))

  if (existing && existing.type === 'secret' && existing.secretSet === true) {
   if (cleanType !== 'secret') {
    return {
     ok: false,
     alreadySet: true,
     error: 'Cannot change type of an already-set secret input (set once, cannot reveal). Delete the input first.',
    }
   }
   if (options.value !== undefined && options.value !== null && String(options.value).length > 0) {
    return {
     ok: false,
     alreadySet: true,
     error: 'Secret input is already set (set once, cannot reveal or overwrite). Remove the input first to replace it.',
    }
   }
  }

  let nextEntry = { name: cleanName, type: cleanType }
  if (cleanType === 'secret') {
   const hasValue = options.value !== undefined && options.value !== null && String(options.value).length > 0
   if (hasValue) {
    const secRes = await setLaneSecret(
     sessionKv,
     laneData,
     laneId,
     cleanName,
     String(options.value),
     existing && existing.secretId ? existing.secretId : ''
    )
    if (!secRes.ok) {
     return secRes
    }
    nextEntry = {
     name: cleanName,
     type: 'secret',
     secretId: secRes.secretId,
     secretSet: true,
    }
   }
   else if (existing && existing.type === 'secret' && existing.secretSet === true) {
    nextEntry = {
     name: cleanName,
     type: 'secret',
     secretId: existing.secretId || '',
     secretSet: true,
    }
   }
  }

  if (existingIdx >= 0) {
   inputs[existingIdx] = nextEntry
  }
  else {
   inputs.push(nextEntry)
  }
  await laneData.set('inputs', JSON.stringify(inputs))
  eventHub.emit({
   type: 'lane-updated',
   sessionId: resolved.activeSession ? resolved.activeSession.id : null,
   dataDir: resolved.dataDir,
   laneId,
   action: 'set-input',
   inputName: cleanName,
  })
  return {
   ok: true,
   laneId,
   input: nextEntry,
   inputs,
  }
 }

 return { ok: false, error: `Unknown input action: "${action}"` }
}

export async function agentListDeployments(rootKv, options = {}) {
 const resolved = await agentResolveSessionAndLane(rootKv, options)
 const registryKv = resolved.registryKv
 const sessionKv = resolved.sessionKv
 const ping = Boolean(options.ping)

 const [servers, deployments] = await Promise.all([
  loadDeployServers(registryKv),
  loadDeployments(registryKv),
 ])

 const serverById = new Map((Array.isArray(servers) ? servers : []).map(s => [s.id, s]))
 const enriched = await Promise.all(
  (Array.isArray(deployments) ? deployments : []).map(async dep => {
   const status = await getLaneDeployStatus(registryKv, sessionKv, dep.laneId)
   const server = serverById.get(dep.serverId) || null
   let liveHealth = null
   if (ping && dep.publicUrl) {
    const healthUrl = `${String(dep.publicUrl).replace(/\/+$/, '')}/_cc/health`
    try {
     const res = await fetch(healthUrl)
     const text = await res.text()
     let body = text
     try {
      body = JSON.parse(text)
     }
     catch {}
     liveHealth = {
      ok: res.ok,
      status: res.status,
      url: healthUrl,
      body,
     }
    }
    catch (err) {
     liveHealth = {
      ok: false,
      status: 0,
      url: healthUrl,
      error: err && err.message ? err.message : String(err),
     }
    }
   }
   const expectedScriptHash = computeLaneScriptHash(status.currentRecords)
   const healthBody = liveHealth && liveHealth.body && typeof liveHealth.body === 'object' ? liveHealth.body : null
   const liveScriptHash = healthBody && typeof healthBody.scriptHash === 'string' ? healthBody.scriptHash : null
   const liveRevision = healthBody && typeof healthBody.revision === 'string' ? healthBody.revision : null
   const liveCodeMatches = liveScriptHash ? (liveScriptHash === expectedScriptHash) : null
   return {
    ...dep,
    serverName: server ? server.name : '',
    serverHost: server ? server.host : '',
    deployStatus: status.status,
    hasChanges: status.hasChanges,
    changedLinesCount: status.diff && Array.isArray(status.diff.changedLines) ? status.diff.changedLines.length : 0,
    diff: status.diff,
    expectedScriptHash,
    liveScriptHash,
    liveRevision,
    liveCodeMatches,
    liveHealth,
   }
  })
 )

 return {
  ok: true,
  activeSession: resolved.activeSession,
  dataDir: resolved.dataDir,
  servers: Array.isArray(servers) ? servers : [],
  deployments: enriched,
 }
}

// ---------- MCP JSON-RPC 2.0 Tool Definitions & Dispatcher ----------

export const MCP_SERVER_INFO = {
 name: 'civil-command',
 version: '1.0.0',
}

export const MCP_TOOLS = [
 {
  name: 'cc_list_sessions',
  description: 'List all Civil Command sessions from the defaultRoot registry with their permanent dataDir, version, and lane/package counts.',
  inputSchema: {
   type: 'object',
   properties: {},
  },
 },
 {
  name: 'cc_get_session',
  description: 'Get full details for a Civil Command session (by ID, name, or omitting sessionId for the most recent session), including open packages, open lanes, and catalog.',
  inputSchema: {
   type: 'object',
   properties: {
    sessionId: { type: 'string', description: 'Optional session ID or session name (defaults to most recently updated session)' },
    dataDir: { type: 'string', description: 'Optional explicit dataDir basePath override' },
   },
  },
 },
 {
  name: 'cc_get_lane',
  description: 'Inspect a Civil Command lane by ID or title within a session. Returns title, path, package, inputs, script records/lines, structured tables with namedRows, and deployment diff status.',
  inputSchema: {
   type: 'object',
   properties: {
    laneId: { type: 'string', description: 'Lane ID or lane title (e.g. "Inbox", "Ledger", or UUID)' },
    sessionId: { type: 'string', description: 'Optional session ID or name' },
    dataDir: { type: 'string', description: 'Optional explicit dataDir basePath override' },
   },
   required: ['laneId'],
  },
 },
 {
  name: 'cc_eval_lane',
  description: 'Evaluate a lane headlessly using FieldScript runLines (resolving Data tables, inputs, and cross-lane importLane calls). Returns per-line previews/errors, final scope entries, sent UI packet count, detected HTTP handlers, and optional HTTP request simulation.',
  inputSchema: {
   type: 'object',
   properties: {
    laneId: { type: 'string', description: 'Lane ID or lane title' },
    sessionId: { type: 'string', description: 'Optional session ID or name' },
    dataDir: { type: 'string', description: 'Optional explicit dataDir override' },
    inputs: { type: 'object', description: 'Optional input variable overrides' },
    applyExports: { type: 'boolean', description: 'If true, actually execute !exportLaneLine writes to target lanes (default false)' },
    httpRequest: {
     type: 'object',
     description: 'Optional HTTP request to simulate against the lane (e.g. { method: "GET", url: "/balance" })',
     properties: {
      method: { type: 'string' },
      url: { type: 'string' },
      headers: { type: 'object' },
      body: {},
     },
    },
   },
   required: ['laneId'],
  },
 },
 {
  name: 'cc_create_lane',
  description: 'Create a new lane in the session, optionally seeding script lines and opening it in the session route.',
  inputSchema: {
   type: 'object',
   properties: {
    title: { type: 'string', description: 'Lane title' },
    lines: { type: 'array', items: { type: 'string' }, description: 'Initial FieldScript lines' },
    packageId: { type: 'string', description: 'Target package ID (defaults to session active package)' },
    sessionId: { type: 'string', description: 'Optional session ID or name' },
    openInSession: { type: 'boolean', description: 'Whether to append the lane to the session open lanes (default true)' },
   },
   required: ['title'],
  },
 },
 {
  name: 'cc_update_script',
  description: 'Modify a lane script: set-line (by lineNumber or lineId), append-line, insert-line, delete-line, or replace-script (preserving existing lineIds). Broadcasts a live reload event to open browsers.',
  inputSchema: {
   type: 'object',
   properties: {
    laneId: { type: 'string', description: 'Lane ID or title' },
    sessionId: { type: 'string', description: 'Optional session ID or name' },
    action: {
     type: 'string',
     enum: ['set-line', 'append-line', 'insert-line', 'delete-line', 'replace-script'],
     description: 'Script mutation action',
    },
    lineNumber: { type: 'number', description: '1-based line number (for set-line, insert-line, delete-line)' },
    lineId: { type: 'string', description: 'Line ID (e.g. ln-...) for set-line or delete-line' },
    text: { type: 'string', description: 'FieldScript line text (for set-line, append-line, insert-line)' },
    lines: { type: 'array', items: { type: 'string' }, description: 'Full array of FieldScript lines (for replace-script)' },
   },
   required: ['laneId', 'action'],
  },
 },
 {
  name: 'cc_mutate_table',
  description: 'Create/delete tables or add/update/delete rows and columns in a lane Data table by column name or ID (automatically scaling fixed decimals). Broadcasts a live reload event to open browsers.',
  inputSchema: {
   type: 'object',
   properties: {
    laneId: { type: 'string', description: 'Lane ID or title' },
    sessionId: { type: 'string', description: 'Optional session ID or name' },
    action: {
     type: 'string',
     enum: ['create-table', 'delete-table', 'add-column', 'add-row', 'upsert-row', 'update-row', 'delete-row', 'clear-rows'],
    },
    table: { type: 'string', description: 'Table name or table ID' },
    rowId: { type: 'string', description: 'Row ID (for update-row, upsert-row, delete-row)' },
    values: { type: 'object', description: 'Row values keyed by column name or column ID' },
    columns: { type: 'array', description: 'Columns array when creating a table' },
    column: { type: 'object', description: 'Column definition when action is add-column' },
   },
   required: ['laneId', 'action'],
  },
 },
 {
  name: 'cc_list_deployments',
  description: 'List all configured SSH servers and lane deployments with script diff status (up-to-date vs needs-deploy) and optional live /_cc/health check.',
  inputSchema: {
   type: 'object',
   properties: {
    sessionId: { type: 'string', description: 'Optional session ID or name' },
    ping: { type: 'boolean', description: 'If true, fetch /_cc/health on each deployment publicUrl' },
   },
  },
 },
]

export async function callMcpTool(rootKv, name, args = {}, options = {}) {
 const cleanArgs = args && typeof args === 'object' ? args : {}
 const mergedOpts = { ...cleanArgs, ...options }
 switch (name) {
  case 'cc_list_sessions':
   return agentListSessions(rootKv, mergedOpts)
  case 'cc_get_session':
   return agentGetSession(rootKv, mergedOpts)
  case 'cc_get_lane':
   return agentGetLane(rootKv, mergedOpts)
  case 'cc_eval_lane':
   return agentEvalLane(rootKv, mergedOpts)
  case 'cc_create_lane':
   return agentCreateLane(rootKv, mergedOpts)
  case 'cc_update_script':
   return agentMutateLaneScript(rootKv, mergedOpts)
  case 'cc_mutate_table':
   return agentMutateLaneTable(rootKv, mergedOpts)
  case 'cc_list_deployments':
   return agentListDeployments(rootKv, mergedOpts)
  default:
   throw new Error(`Unknown MCP tool: ${name}`)
 }
}

export async function handleMcpJsonRpc(rootKv, message, options = {}) {
 if (!message || typeof message !== 'object') {
  return {
   jsonrpc: '2.0',
   id: null,
   error: { code: -32600, message: 'Invalid Request' },
  }
 }
 const { id, method, params } = message
 if (!method || typeof method !== 'string') {
  return {
   jsonrpc: '2.0',
   id: id ?? null,
   error: { code: -32600, message: 'Missing method' },
  }
 }

 // Notifications (no id) produce null response
 if (id === undefined) {
  return null
 }

 try {
  if (method === 'initialize') {
   return {
    jsonrpc: '2.0',
    id,
    result: {
     protocolVersion: (params && params.protocolVersion) || '2024-11-05',
     capabilities: {
      tools: {},
      resources: {},
     },
     serverInfo: MCP_SERVER_INFO,
    },
   }
  }

  if (method === 'ping') {
   return { jsonrpc: '2.0', id, result: {} }
  }

  if (method === 'tools/list') {
   return {
    jsonrpc: '2.0',
    id,
    result: { tools: MCP_TOOLS },
   }
  }

  if (method === 'tools/call') {
   const toolName = params && params.name ? String(params.name) : ''
   const toolArgs = (params && params.arguments) || {}
   try {
    const result = await callMcpTool(rootKv, toolName, toolArgs, options)
    return {
     jsonrpc: '2.0',
     id,
     result: {
      content: [
       {
        type: 'text',
        text: JSON.stringify(result, null, 2),
       },
      ],
      structuredContent: result,
      isError: result && result.ok === false,
     },
    }
   }
   catch (toolErr) {
    return {
     jsonrpc: '2.0',
     id,
     result: {
      content: [
       {
        type: 'text',
        text: JSON.stringify({ ok: false, error: toolErr.message || String(toolErr) }, null, 2),
       },
      ],
      isError: true,
     },
    }
   }
  }

  if (method === 'resources/list') {
   const sessList = await agentListSessions(rootKv)
   const resources = [
    {
     uri: 'civil://sessions',
     name: 'Civil Command Sessions',
     mimeType: 'application/json',
     description: 'All registered Civil Command sessions and their permanent data directories',
    },
    ...sessList.sessions.map(s => ({
     uri: `civil://sessions/${encodeURIComponent(s.id)}`,
     name: `Session: ${s.name} (${s.id})`,
     mimeType: 'application/json',
     description: `Data directory: ${s.dataDir || 'Default'} · ${s.laneCount} lane(s)`,
    })),
   ]
   return {
    jsonrpc: '2.0',
    id,
    result: { resources },
   }
  }

  if (method === 'resources/read') {
   const uri = params && params.uri ? String(params.uri) : ''
   if (uri === 'civil://sessions') {
    const data = await agentListSessions(rootKv)
    return {
     jsonrpc: '2.0',
     id,
     result: {
      contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(data, null, 2) }],
     },
    }
   }
   if (uri.startsWith('civil://sessions/')) {
    const sessionId = decodeURIComponent(uri.slice('civil://sessions/'.length))
    const data = await agentGetSession(rootKv, { sessionId })
    return {
     jsonrpc: '2.0',
     id,
     result: {
      contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(data, null, 2) }],
     },
    }
   }
   return {
    jsonrpc: '2.0',
    id,
    error: { code: -32602, message: `Unknown resource URI: ${uri}` },
   }
  }

  return {
   jsonrpc: '2.0',
   id,
   error: { code: -32601, message: `Method not found: ${method}` },
  }
 }
 catch (err) {
  return {
   jsonrpc: '2.0',
   id,
   error: { code: -32603, message: err && err.message ? err.message : 'Internal error' },
  }
 }
}

// ---------- HTTP Handler for /api/agent/* and /api/mcp ----------

function sendJson(res, status, payload) {
 const body = JSON.stringify(payload)
 res.writeHead(status, {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
 })
 res.end(body)
}

function readJsonBody(req) {
 return new Promise((resolve, reject) => {
  const chunks = []
  let total = 0
  let settled = false
  req.on('data', chunk => {
   if (settled) {
    return
   }
   const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
   total += buf.length
   if (total > MAX_JSON_BODY_BYTES) {
    settled = true
    const err = new Error('Request body too large')
    err.status = 413
    reject(err)
    return
   }
   chunks.push(buf)
  })
  req.on('end', () => {
   if (settled) {
    return
   }
   settled = true
   const text = Buffer.concat(chunks).toString('utf8').trim()
   if (!text) {
    resolve({})
    return
   }
   try {
    resolve(JSON.parse(text))
   }
   catch {
    const err = new Error('Invalid JSON body')
    err.status = 400
    reject(err)
   }
  })
  req.on('error', err => {
   if (!settled) {
    settled = true
    reject(err)
   }
  })
 })
}

export async function handleAgentApiRequest(req, res, opts = {}) {
 const url = new URL(req.url || '/', 'http://localhost')
 const pathname = url.pathname
 const rootKv = resolveAgentRootKv(opts.rootKv || {
  baseUrl: opts.baseUrl || DEFAULT_AGENT_DATA_URL,
 })
 const eventHub = opts.eventHub || defaultAgentEventHub

 // Server-Sent Events stream for real-time browser reload on agent mutations
 if (pathname === '/api/agent/events' && req.method === 'GET') {
  res.writeHead(200, {
   'Content-Type': 'text/event-stream; charset=utf-8',
   'Cache-Control': 'no-cache, no-transform',
   Connection: 'keep-alive',
  })
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`)
  const unsubscribe = eventHub.subscribe(event => {
   res.write(`data: ${JSON.stringify(event)}\n\n`)
  })
  req.on('close', () => {
   unsubscribe()
  })
  return
 }

 // Streamable HTTP MCP JSON-RPC endpoint
 if (pathname === '/api/mcp') {
  if (req.method === 'GET') {
   return sendJson(res, 200, {
    ok: true,
    server: MCP_SERVER_INFO,
    tools: MCP_TOOLS,
   })
  }
  if (req.method !== 'POST') {
   return sendJson(res, 405, { ok: false, error: 'Method not allowed' })
  }
  try {
   const body = await readJsonBody(req)
   if (Array.isArray(body)) {
    const responses = (await Promise.all(body.map(msg => handleMcpJsonRpc(rootKv, msg, { eventHub })))).filter(Boolean)
    return sendJson(res, 200, responses)
   }
   const rpcRes = await handleMcpJsonRpc(rootKv, body, { eventHub })
   if (rpcRes === null) {
    res.writeHead(202)
    res.end()
    return
   }
   return sendJson(res, 200, rpcRes)
  }
  catch (err) {
   return sendJson(res, err.status || 400, {
    jsonrpc: '2.0',
    id: null,
    error: { code: -32700, message: err.message || 'Parse error' },
   })
  }
 }

 try {
  if (pathname === '/api/agent/sessions' && req.method === 'GET') {
   const packageId = url.searchParams.get('packageId') || DEFAULT_PACKAGE_ID
   const out = await agentListSessions(rootKv, { packageId })
   return sendJson(res, 200, out)
  }

  if (pathname === '/api/agent/session' && req.method === 'GET') {
   const sessionId = url.searchParams.get('sessionId') || url.searchParams.get('session') || ''
   const dataDir = url.searchParams.get('dataDir') || undefined
   const out = await agentGetSession(rootKv, { sessionId, dataDir })
   return sendJson(res, 200, out)
  }

  if (pathname === '/api/agent/lane' && req.method === 'GET') {
   const sessionId = url.searchParams.get('sessionId') || url.searchParams.get('session') || ''
   const dataDir = url.searchParams.get('dataDir') || undefined
   const laneId = url.searchParams.get('laneId') || url.searchParams.get('lane') || ''
   const out = await agentGetLane(rootKv, { sessionId, dataDir, laneId })
   return sendJson(res, out.ok ? 200 : 404, out)
  }

  if (pathname === '/api/agent/lane' && req.method === 'POST') {
   const body = await readJsonBody(req)
   const out = await agentCreateLane(rootKv, { ...body, eventHub })
   return sendJson(res, out.ok ? 200 : 400, out)
  }

  if (pathname === '/api/agent/lane/configure' && req.method === 'POST') {
   const body = await readJsonBody(req)
   const out = await agentConfigureLane(rootKv, { ...body, eventHub })
   return sendJson(res, out.ok ? 200 : 400, out)
  }

  if (pathname === '/api/agent/lane/eval' && (req.method === 'POST' || req.method === 'GET')) {
   const body = req.method === 'POST'
    ? await readJsonBody(req)
    : {
     sessionId: url.searchParams.get('sessionId') || url.searchParams.get('session') || '',
     dataDir: url.searchParams.get('dataDir') || undefined,
     laneId: url.searchParams.get('laneId') || url.searchParams.get('lane') || '',
     applyExports: url.searchParams.get('applyExports') === 'true',
    }
   const out = await agentEvalLane(rootKv, { ...body, eventHub })
   return sendJson(res, out.ok ? 200 : 400, out)
  }

  if (pathname === '/api/agent/lane/script' && req.method === 'POST') {
   const body = await readJsonBody(req)
   const out = await agentMutateLaneScript(rootKv, { ...body, eventHub })
   return sendJson(res, out.ok ? 200 : 400, out)
  }

  if (pathname === '/api/agent/lane/table' && req.method === 'POST') {
   const body = await readJsonBody(req)
   const out = await agentMutateLaneTable(rootKv, { ...body, eventHub })
   return sendJson(res, out.ok ? 200 : 400, out)
  }

  if (pathname === '/api/agent/lane/input' && req.method === 'POST') {
   const body = await readJsonBody(req)
   const out = await agentMutateLaneInput(rootKv, { ...body, eventHub })
   return sendJson(res, out.ok ? 200 : 400, out)
  }

  if (pathname === '/api/agent/deployments' && req.method === 'GET') {
   const sessionId = url.searchParams.get('sessionId') || url.searchParams.get('session') || ''
   const dataDir = url.searchParams.get('dataDir') || undefined
   const ping = url.searchParams.get('ping') === 'true' || url.searchParams.get('ping') === '1'
   const out = await agentListDeployments(rootKv, { sessionId, dataDir, ping })
   return sendJson(res, 200, out)
  }

  if (pathname === '/api/agent/notify' && req.method === 'POST') {
   const body = await readJsonBody(req)
   const emitted = eventHub.emit({
    type: body.type || 'lane-updated',
    sessionId: body.sessionId || null,
    dataDir: body.dataDir || null,
    laneId: body.laneId || null,
    action: body.action || 'external',
   })
   return sendJson(res, 200, { ok: true, event: emitted })
  }

  return sendJson(res, 404, { ok: false, error: `Unknown agent endpoint: ${pathname}` })
 }
 catch (err) {
  return sendJson(res, err.status || 500, {
   ok: false,
   error: err && err.message ? err.message : 'Agent API error',
  })
 }
}
