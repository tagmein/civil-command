#!/usr/bin/env node
import fs from 'node:fs/promises'
import readline from 'node:readline'
import { Writable } from 'node:stream'
import {
 DEFAULT_AGENT_DATA_URL,
 agentConfigureLane,
 agentCreateLane,
 agentEvalLane,
 agentGetLane,
 agentGetSession,
 agentListDeployments,
 agentListSessions,
 agentMutateLaneInput,
 agentMutateLaneScript,
 agentMutateLaneTable,
 resolveAgentRootKv,
 unlockPackagesForExport,
} from './agent-api.mjs'
import { resolveAgentRemoteOptions } from './agent-remote.mjs'
import { SESSION_TOKEN_HEADER } from './data.mjs'
import { startMcpStdioServer } from './mcp.mjs'
import { openPackageInSession } from './storage.mjs'

function isCliFlagToken(token) {
 return typeof token === 'string' && token.startsWith('--') && token.length > 2 && !/^\s/.test(token.slice(2))
}

function setFlag(flags, key, value) {
 if (Object.hasOwn(flags, key)) {
  flags[key] = Array.isArray(flags[key]) ? [...flags[key], value] : [flags[key], value]
 }
 else {
  flags[key] = value
 }
}

function parseCliArgs(argv) {
 const positional = []
 const flags = {}
 for (let i = 0; i < argv.length; i++) {
  const token = String(argv[i])
  if (isCliFlagToken(token)) {
   const eqIdx = token.indexOf('=')
   if (eqIdx !== -1) {
    setFlag(flags, token.slice(2, eqIdx), token.slice(eqIdx + 1))
   }
   else {
    const k = token.slice(2)
    const next = argv[i + 1]
    if (next !== undefined && !isCliFlagToken(String(next))) {
     setFlag(flags, k, String(next))
     i += 1
    }
    else {
     setFlag(flags, k, true)
    }
   }
  }
  else {
   positional.push(token)
  }
 }
 return { positional, flags }
}

async function notifyRunningServer(serverOrigin, rootKv, eventPayload, headers = {}) {
 try {
  let tok = rootKv && typeof rootKv.getSessionToken === 'function' ? rootKv.getSessionToken() : ''
  if (!tok && rootKv && typeof rootKv.fetchVaultApi === 'function') {
   const boot = await rootKv.fetchVaultApi('session', { method: 'POST', body: {} }).catch(() => null)
   tok = boot && boot.data && typeof boot.data.token === 'string' ? boot.data.token.trim() : ''
  }
  const reqHeaders = { 'Content-Type': 'application/json', ...headers }
  if (tok && !Object.hasOwn(reqHeaders, SESSION_TOKEN_HEADER) && !Object.hasOwn(reqHeaders, SESSION_TOKEN_HEADER.toLowerCase())) {
   reqHeaders[SESSION_TOKEN_HEADER] = tok
  }
  await fetch(`${serverOrigin}/api/agent/notify`, {
   method: 'POST',
   headers: reqHeaders,
   body: JSON.stringify(eventPayload),
  })
 }
 catch {
  // Server notification is best-effort
 }
}

function promptLineStderr(question) {
 return new Promise(resolve => {
  const rl = readline.createInterface({
   input: process.stdin,
   output: process.stderr,
   terminal: Boolean(process.stdin.isTTY),
  })
  let settled = false
  rl.once('close', () => {
   if (!settled) {
    settled = true
    resolve('')
   }
  })
  rl.question(question, answer => {
   if (!settled) {
    settled = true
    rl.close()
    resolve(answer)
   }
  })
 })
}

function promptSecretStderr(question) {
 return new Promise(resolve => {
  let muted = false
  const mutedOut = new Writable({
   write(chunk, encoding, callback) {
    if (!muted) {
     process.stderr.write(chunk, encoding)
    }
    callback()
   },
  })
  const rl = readline.createInterface({
   input: process.stdin,
   output: mutedOut,
   terminal: Boolean(process.stdin.isTTY),
  })
  let settled = false
  rl.once('close', () => {
   if (!settled) {
    settled = true
    process.stderr.write('\n')
    resolve('')
   }
  })
  process.stderr.write(question)
  muted = true
  rl.question('', answer => {
   muted = false
   if (!settled) {
    settled = true
    process.stderr.write('\n')
    rl.close()
    resolve(answer)
   }
  })
 })
}

async function handleLockedExportFallback({
 rootKv,
 notify,
 isInteractive,
 targetSessionId,
 dataDir,
 laneId,
 laneTitle,
 lockedPackages,
 pendingExports,
 retryEval,
}) {
 if (isInteractive && targetSessionId) {
  process.stderr.write('\nExport writes require opening target package(s) in this session:\n')
  for (const pkg of lockedPackages) {
   const label = pkg.packageName && pkg.packageName !== pkg.packageId
    ? `${pkg.packageName} (${pkg.packageId})`
    : pkg.packageId
   const kind = pkg.hasPassphrase ? 'passphrase-protected' : 'closed (no passphrase)'
   process.stderr.write(`  - ${label} [${kind}]\n`)
  }
  const unlockRes = await unlockPackagesForExport(rootKv, {
   sessionId: targetSessionId,
   lockedPackages,
   promptConfirmOpen: async pkg => {
    const label = pkg.packageName && pkg.packageName !== pkg.packageId
     ? `${pkg.packageName} (${pkg.packageId})`
     : pkg.packageId
    const stepPrefix = pkg.stepTotal > 1 ? `[${pkg.stepIndex}/${pkg.stepTotal}] ` : ''
    const ans = await promptLineStderr(`${stepPrefix}Open package "${label}" for writing? [y/N]: `)
    return /^(?:y|yes)$/i.test(String(ans || '').trim())
   },
   promptPassphrase: async (pkg, attempt, lastError) => {
    if (lastError) {
     process.stderr.write(`${lastError}\n`)
    }
    const label = pkg.packageName && pkg.packageName !== pkg.packageId
     ? `${pkg.packageName} (${pkg.packageId})`
     : pkg.packageId
    const stepPrefix = pkg.stepTotal > 1 ? `[${pkg.stepIndex}/${pkg.stepTotal}] ` : ''
    return promptSecretStderr(`${stepPrefix}Enter passphrase to unlock package "${label}" (empty to cancel): `)
   },
   onPackageOpened: async pkg => {
    await notify({
     type: 'package-opened',
     sessionId: targetSessionId,
     dataDir: dataDir || null,
     packageId: pkg.packageId,
    })
   },
  })
  if (unlockRes && unlockRes.ok) {
   const retried = await retryEval()
   return { handled: true, unlocked: true, retried }
  }
  return { handled: true, unlocked: false, unlockRes }
 }
 await notify({
  type: 'export-unlock-required',
  sessionId: targetSessionId || null,
  dataDir: dataDir || null,
  laneId: laneId || null,
  laneTitle: laneTitle || '',
  lockedPackages,
  pendingExports,
 })
 return { handled: false, unlocked: false }
}

async function handleTableRowWithTrigger({
 rootKv,
 notify,
 isInteractive,
 sessionId,
 dataDir,
 laneQuery,
 action,
 tableQuery,
 rowId,
 values,
 rowFlags,
 column,
 flag,
 rowFlag,
}) {
 const out = await agentMutateLaneTable(rootKv, {
  sessionId,
  dataDir,
  laneId: laneQuery,
  action,
  table: tableQuery,
  rowId: rowId || rowFlag,
  values,
  ...(rowFlags ? { flags: rowFlags } : {}),
  ...(column !== undefined ? { column } : {}),
  ...(flag !== undefined ? { flag } : {}),
 })
 if (out.ok && out.triggeredEval && out.triggeredEval.requiresPackageUnlock && Array.isArray(out.triggeredEval.lockedPackages) && out.triggeredEval.lockedPackages.length > 0) {
  const sess = await agentGetSession(rootKv, { sessionId, dataDir }).catch(() => null)
  const targetSessionId = (sess && sess.activeSession && sess.activeSession.id) || sessionId
  const effectiveDir = (sess && sess.dataDir) || dataDir
  const unlockAttempt = await handleLockedExportFallback({
   rootKv,
   notify,
   isInteractive,
   targetSessionId,
   dataDir: effectiveDir,
   laneId: out.laneId,
   laneTitle: out.laneId,
   lockedPackages: out.triggeredEval.lockedPackages,
   pendingExports: out.triggeredEval.pendingExports,
   retryEval: () => agentEvalLane(rootKv, {
    sessionId: targetSessionId,
    dataDir: effectiveDir,
    laneId: out.laneId,
    applyExports: true,
    tableChange: {
     tableId: out.tableId,
     tableName: out.tableName || tableQuery,
     rowId: (out.row && out.row.id) || out.deletedRowId || rowId || '',
     action,
    },
   }),
  })
  if (unlockAttempt.unlocked && unlockAttempt.retried) {
   const retried = unlockAttempt.retried
   out.triggeredEval = {
    ok: retried.ok,
    errorCount: retried.errorCount,
    requiresPackageUnlock: Boolean(retried.requiresPackageUnlock),
    lockedPackages: Array.isArray(retried.lockedPackages) ? retried.lockedPackages : [],
    pendingExports: Array.isArray(retried.pendingExports) ? retried.pendingExports : [],
    error: retried.error || null,
   }
   if (retried.ok && Array.isArray(retried.changedExportLaneIds)) {
    for (const tgtId of retried.changedExportLaneIds) {
     await notify({
      type: 'lane-updated',
      sessionId: targetSessionId || null,
      dataDir: effectiveDir || null,
      laneId: tgtId,
      action: 'export-line',
     })
    }
   }
  }
  else if (unlockAttempt.unlockRes && unlockAttempt.unlockRes.error) {
   out.triggeredEval = { ...out.triggeredEval, unlockError: unlockAttempt.unlockRes.error }
  }
 }
 if (out.ok) {
  await notify({
   type: 'lane-updated',
   laneId: out.laneId,
   action,
  })
  if (out.ownerLaneId) {
   await notify({
    type: 'lane-updated',
    laneId: out.ownerLaneId,
    action,
   })
  }
 }
 console.log(JSON.stringify(out, null, 2))
 if (!out.ok || (out.triggeredEval && out.triggeredEval.requiresPackageUnlock)) process.exitCode = 1
}

function printHelp() {
 console.log(`Civil Command Agent & Operator CLI (./cc)

Usage:
  ./cc sessions
  ./cc session [sessionIdOrName]
  ./cc lanes [--session <idOrName>]
  ./cc lane <laneIdOrTitle> [--session <idOrName>]
  ./cc eval <laneIdOrTitle> [--session <idOrName>] [--apply-exports] [--no-prompt] [--http-get <path>]
  ./cc open-package <packageId> [--passphrase <pass>] [--set-active] [--session <idOrName>]
  ./cc create-lane <title> [line1] [line2...] [--session <idOrName>] [--package <pkgId>]
  ./cc set-line <laneIdOrTitle> <lineNumberOrLineId> <text> [--session <idOrName>]
  ./cc append-line <laneIdOrTitle> <text> [--session <idOrName>]
  ./cc insert-line <laneIdOrTitle> <lineNumber> <text> [--session <idOrName>]
  ./cc delete-line <laneIdOrTitle> <lineNumberOrLineId> [--session <idOrName>]
  ./cc replace-script <laneIdOrTitle> --file <jsonLinesPath> [--session <idOrName>]
  ./cc set-input <laneIdOrTitle> <name> <type> [secretValue] [--session <idOrName>]
  ./cc delete-input <laneIdOrTitle> <name> [--session <idOrName>]
  ./cc create-table <laneIdOrTitle> <tableName> <jsonColumns> [--session <idOrName>]
  ./cc import-table <laneIdOrTitle> <sourceLaneIdOrTitle> <sourceTableNameOrId> [--mode read-only|read-write] [--as <localName>] [--session <idOrName>]
  ./cc add-row <laneIdOrTitle> <tableNameOrId> <jsonValues> [--flags <jsonFlags>] [--session <idOrName>]
  ./cc update-row <laneIdOrTitle> <tableNameOrId> <rowId> <jsonValues> [--flags <jsonFlags>] [--session <idOrName>]
  ./cc set-flag <laneIdOrTitle> <tableNameOrId> <rowId> <columnNameOrId> <unknown|incorrect|none> [--session <idOrName>]
  ./cc delete-row <laneIdOrTitle> <tableNameOrId> <rowId> [--session <idOrName>]
  ./cc deployments [--ping] [--session <idOrName>]
  ./cc mcp

Remote Host Flags:
  --host <origin>        Remote Civil Command origin (e.g. https://example.com); API is <origin>/api/data
  --url <dataUrl>        Explicit KV endpoint, overriding --host (default: ${DEFAULT_AGENT_DATA_URL})
  --user <username>      HTTP Basic auth username (or CC_USER)
  --password <password>  HTTP Basic auth password (or CC_PASSWORD)
  --token <token>        Bearer token auth, overrides Basic auth (or CC_TOKEN)
  --header 'Name: value' Extra request header; repeatable
  Credentials can also be embedded in --host / --url as https://user:pass@host.
  Environment: CC_HOST, CC_DATA_URL, CC_USER, CC_PASSWORD, CC_TOKEN.

Global Flags:
  --session <idOrName>   Target session by ID or name (defaults to most recently updated session)
  --dir <basePath>       Explicit data directory basePath override
  --no-prompt            Disable interactive TTY prompts and return structured JSON only
`)
}

async function main() {
 const { positional, flags } = parseCliArgs(process.argv.slice(2))
 const cmd = (positional[0] || 'help').toLowerCase()

 if (cmd === 'help' || cmd === '-h' || flags.help) {
  printHelp()
  return
 }

 const { baseUrl, headers, serverOrigin } = resolveAgentRemoteOptions(flags, process.env, {
  defaultDataUrl: DEFAULT_AGENT_DATA_URL,
 })

 if (cmd === 'mcp') {
  startMcpStdioServer({ baseUrl, headers })
  return
 }

 const rootKv = resolveAgentRootKv({ baseUrl, headers })
 const notify = eventPayload => notifyRunningServer(serverOrigin, rootKv, eventPayload, headers)
 const sessionId = typeof flags.session === 'string' ? flags.session : ''
 const dataDir = typeof flags.dir === 'string' ? flags.dir : undefined
 const isInteractive = Boolean(process.stdin.isTTY && process.stdout.isTTY && !flags['no-prompt'] && !flags.nonInteractive)

 if (cmd === 'sessions') {
  const out = await agentListSessions(rootKv)
  console.log(JSON.stringify(out, null, 2))
  return
 }

 if (cmd === 'session') {
  const targetSession = positional[1] || sessionId
  const out = await agentGetSession(rootKv, { sessionId: targetSession, dataDir })
  console.log(JSON.stringify(out, null, 2))
  return
 }

 if (cmd === 'lanes' || cmd === 'catalog') {
  const out = await agentGetSession(rootKv, { sessionId, dataDir })
  console.log(JSON.stringify({
   ok: true,
   activeSession: out.activeSession,
   dataDir: out.dataDir,
   openLanes: out.openLanes,
   catalog: out.catalog,
  }, null, 2))
  return
 }

 if (cmd === 'lane') {
  const laneQuery = positional[1] || flags.lane || ''
  const out = await agentGetLane(rootKv, { sessionId, dataDir, laneId: laneQuery })
  console.log(JSON.stringify(out, null, 2))
  if (!out.ok) process.exitCode = 1
  return
 }

 if (cmd === 'eval') {
  const laneQuery = positional[1] || flags.lane || ''
  const applyExports = Boolean(flags['apply-exports'] || flags.applyExports)
  let httpRequest = null
  if (typeof flags['http-get'] === 'string') {
   httpRequest = { method: 'GET', url: flags['http-get'] }
  }
  else if (typeof flags['http-post'] === 'string') {
   let body
   if (typeof flags.body === 'string') {
    try { body = JSON.parse(flags.body) } catch { body = flags.body }
   }
   httpRequest = { method: 'POST', url: flags['http-post'], body }
  }
  let out = await agentEvalLane(rootKv, {
   sessionId,
   dataDir,
   laneId: laneQuery,
   applyExports,
   httpRequest,
  })
  if (!out.ok && out.requiresPackageUnlock && Array.isArray(out.lockedPackages) && out.lockedPackages.length > 0) {
   const targetSessionId = (out.activeSession && out.activeSession.id) || sessionId
   const effectiveDir = out.dataDir || dataDir
   const unlockAttempt = await handleLockedExportFallback({
    rootKv,
    notify,
    isInteractive,
    targetSessionId,
    dataDir: effectiveDir,
    laneId: out.laneId,
    laneTitle: out.title,
    lockedPackages: out.lockedPackages,
    pendingExports: out.pendingExports,
    retryEval: () => agentEvalLane(rootKv, {
     sessionId: targetSessionId,
     dataDir: effectiveDir,
     laneId: laneQuery,
     applyExports: true,
     httpRequest,
    }),
   })
   if (unlockAttempt.unlocked && unlockAttempt.retried) {
    out = unlockAttempt.retried
   }
   else if (unlockAttempt.unlockRes && unlockAttempt.unlockRes.error) {
    out = { ...out, unlockError: unlockAttempt.unlockRes.error }
   }
  }
  if (out.ok) {
   const targetSessionId = (out.activeSession && out.activeSession.id) || sessionId || null
   const effectiveDir = out.dataDir || dataDir || null
   await notify({
    type: 'lane-updated',
    sessionId: targetSessionId,
    dataDir: effectiveDir,
    laneId: out.laneId,
    action: 'eval',
   })
   if (Array.isArray(out.changedExportLaneIds)) {
    for (const tgtId of out.changedExportLaneIds) {
     await notify({
      type: 'lane-updated',
      sessionId: targetSessionId,
      dataDir: effectiveDir,
      laneId: tgtId,
      action: 'export-line',
     })
    }
   }
  }
  console.log(JSON.stringify(out, null, 2))
  if (!out.ok) process.exitCode = 1
  return
 }

 if (cmd === 'open-package') {
  const packageId = positional[1] || flags.package || flags.id || ''
  if (!packageId) {
   console.log(JSON.stringify({ ok: false, error: 'packageId is required' }, null, 2))
   process.exitCode = 1
   return
  }
  const sess = await agentGetSession(rootKv, { sessionId, dataDir })
  const targetSessionId = sess && sess.activeSession && sess.activeSession.id ? sess.activeSession.id : sessionId
  if (!targetSessionId) {
   console.log(JSON.stringify({ ok: false, error: 'No active session found' }, null, 2))
   process.exitCode = 1
   return
  }
  let passphrase = typeof flags.passphrase === 'string' ? flags.passphrase : ''
  const setActive = Boolean(flags['set-active'] || flags.setActive)
  let res = await openPackageInSession(rootKv, targetSessionId, {
   packageId,
   passphrase,
   setActive,
  })
  if (!res.ok && res.needsPassphrase && !passphrase && isInteractive) {
   passphrase = await promptSecretStderr(`Enter passphrase to unlock package "${res.packageName || packageId}": `)
   if (passphrase) {
    res = await openPackageInSession(rootKv, targetSessionId, {
     packageId,
     passphrase,
     setActive,
    })
   }
  }
  if (res.ok) {
   await notify({
    type: 'package-opened',
    sessionId: targetSessionId,
    dataDir: (sess && sess.dataDir) || dataDir || null,
    packageId: res.pkg && res.pkg.id ? res.pkg.id : packageId,
   })
  }
  console.log(JSON.stringify(res, null, 2))
  if (!res.ok) process.exitCode = 1
  return
 }

 if (cmd === 'create-lane') {
  const title = positional[1] || flags.title || 'Untitled Lane'
  const lines = positional.slice(2)
  const out = await agentCreateLane(rootKv, {
   sessionId,
   dataDir,
   title,
   lines: lines.length > 0 ? lines : undefined,
   packageId: typeof flags.package === 'string' ? flags.package : undefined,
  })
  if (out.ok) {
   await notify({
    type: 'lane-created',
    sessionId: sessionId || null,
    laneId: out.laneId,
   })
  }
  console.log(JSON.stringify(out, null, 2))
  if (!out.ok) process.exitCode = 1
  return
 }

 if (cmd === 'configure-lane') {
  const laneQuery = positional[1] || flags.lane || ''
  let features
  if (typeof flags.features === 'string') {
   features = JSON.parse(flags.features)
  }
  else if (flags['http-server'] !== undefined || flags['run-every-30-minutes'] !== undefined || flags['cron-30m'] !== undefined) {
   features = {}
   if (flags['http-server'] !== undefined) {
    features.httpServer = flags['http-server'] !== 'false' && Boolean(flags['http-server'])
   }
   if (flags['run-every-30-minutes'] !== undefined) {
    features.runEvery30Minutes = flags['run-every-30-minutes'] !== 'false' && Boolean(flags['run-every-30-minutes'])
   }
   if (flags['cron-30m'] !== undefined) {
    features.runEvery30Minutes = flags['cron-30m'] !== 'false' && Boolean(flags['cron-30m'])
   }
  }
  const out = await agentConfigureLane(rootKv, {
   sessionId,
   dataDir,
   laneId: laneQuery,
   title: typeof flags.title === 'string' ? flags.title : undefined,
   width: flags.width !== undefined ? flags.width : undefined,
   path: typeof flags.path === 'string' ? flags.path : undefined,
   minimized: typeof flags.minimized === 'string' ? flags.minimized : undefined,
   features,
  })
  if (out.ok && out.lane) {
   await notify({
    type: 'lane-updated',
    laneId: out.lane.id,
    action: 'configure',
   })
  }
  console.log(JSON.stringify(out, null, 2))
  return
 }

 if (cmd === 'set-line' || cmd === 'update-line') {
  const laneQuery = positional[1] || ''
  const lineTarget = positional[2] || ''
  const text = positional.slice(3).join(' ')
  const isLineId = String(lineTarget).startsWith('ln-')
  const out = await agentMutateLaneScript(rootKv, {
   sessionId,
   dataDir,
   laneId: laneQuery,
   action: 'set-line',
   lineId: isLineId ? lineTarget : undefined,
   lineNumber: !isLineId ? Number(lineTarget) : undefined,
   text,
  })
  if (out.ok) {
   await notify({
    type: 'lane-updated',
    laneId: out.laneId,
    action: 'set-line',
   })
  }
  console.log(JSON.stringify(out, null, 2))
  if (!out.ok) process.exitCode = 1
  return
 }

 if (cmd === 'append-line') {
  const laneQuery = positional[1] || ''
  const text = positional.slice(2).join(' ')
  const out = await agentMutateLaneScript(rootKv, {
   sessionId,
   dataDir,
   laneId: laneQuery,
   action: 'append-line',
   text,
  })
  if (out.ok) {
   await notify({
    type: 'lane-updated',
    laneId: out.laneId,
    action: 'append-line',
   })
  }
  console.log(JSON.stringify(out, null, 2))
  if (!out.ok) process.exitCode = 1
  return
 }

 if (cmd === 'insert-line') {
  const laneQuery = positional[1] || ''
  const lineNumber = Number(positional[2])
  const text = positional.slice(3).join(' ')
  const out = await agentMutateLaneScript(rootKv, {
   sessionId,
   dataDir,
   laneId: laneQuery,
   action: 'insert-line',
   lineNumber,
   text,
  })
  if (out.ok) {
   await notify({
    type: 'lane-updated',
    laneId: out.laneId,
    action: 'insert-line',
   })
  }
  console.log(JSON.stringify(out, null, 2))
  if (!out.ok) process.exitCode = 1
  return
 }

 if (cmd === 'delete-line' || cmd === 'remove-line') {
  const laneQuery = positional[1] || ''
  const lineTarget = positional[2] || ''
  const isLineId = String(lineTarget).startsWith('ln-')
  const out = await agentMutateLaneScript(rootKv, {
   sessionId,
   dataDir,
   laneId: laneQuery,
   action: 'delete-line',
   lineId: isLineId ? lineTarget : undefined,
   lineNumber: !isLineId ? Number(lineTarget) : undefined,
  })
  if (out.ok) {
   await notify({
    type: 'lane-updated',
    laneId: out.laneId,
    action: 'delete-line',
   })
  }
  console.log(JSON.stringify(out, null, 2))
  if (!out.ok) process.exitCode = 1
  return
 }

 if (cmd === 'replace-script' || cmd === 'set-script') {
  const laneQuery = positional[1] || flags.lane || ''
  let lines = []
  if (typeof flags.file === 'string' && flags.file.trim()) {
   const rawFile = await fs.readFile(flags.file.trim(), 'utf8')
   const parsed = JSON.parse(rawFile)
   lines = Array.isArray(parsed)
    ? parsed
    : (parsed && Array.isArray(parsed.lines) ? parsed.lines : [])
  }
  else if (positional.length === 3 && positional[2].trim().startsWith('[')) {
   lines = JSON.parse(positional[2])
  }
  else {
   lines = positional.slice(2)
  }
  const out = await agentMutateLaneScript(rootKv, {
   sessionId,
   dataDir,
   laneId: laneQuery,
   action: 'replace-script',
   lines,
  })
  if (out.ok) {
   await notify({
    type: 'lane-updated',
    laneId: out.laneId,
    action: 'replace-script',
   })
  }
  console.log(JSON.stringify(out, null, 2))
  if (!out.ok) process.exitCode = 1
  return
 }

 if (cmd === 'add-row' || cmd === 'upsert-row') {
  const laneQuery = positional[1] || ''
  const tableQuery = positional[2] || ''
  const rawJson = positional.slice(3).join(' ') || '{}'
  const values = JSON.parse(rawJson)
  const rowFlags = typeof flags.flags === 'string' ? JSON.parse(flags.flags) : undefined
  await handleTableRowWithTrigger({
   rootKv,
   notify,
   isInteractive,
   sessionId,
   dataDir,
   laneQuery,
   action: 'add-row',
   tableQuery,
   rowFlag: typeof flags.row === 'string' ? flags.row : undefined,
   values,
   rowFlags,
  })
  return
 }

 if (cmd === 'update-row') {
  const laneQuery = positional[1] || ''
  const tableQuery = positional[2] || ''
  const rowId = positional[3] || ''
  const rawJson = positional.slice(4).join(' ') || '{}'
  const values = JSON.parse(rawJson)
  const rowFlags = typeof flags.flags === 'string' ? JSON.parse(flags.flags) : undefined
  await handleTableRowWithTrigger({
   rootKv,
   notify,
   isInteractive,
   sessionId,
   dataDir,
   laneQuery,
   action: 'update-row',
   tableQuery,
   rowId,
   values,
   rowFlags,
  })
  return
 }

 if (cmd === 'set-flag' || cmd === 'set-cell-flag') {
  const laneQuery = positional[1] || ''
  const tableQuery = positional[2] || ''
  const rowId = positional[3] || ''
  const column = positional[4] || (typeof flags.column === 'string' ? flags.column : '')
  const flag = positional[5] !== undefined ? positional[5] : flags.flag
  await handleTableRowWithTrigger({
   rootKv,
   notify,
   isInteractive,
   sessionId,
   dataDir,
   laneQuery,
   action: 'set-flag',
   tableQuery,
   rowId,
   column,
   flag,
  })
  return
 }

 if (cmd === 'set-input' || cmd === 'add-input' || cmd === 'set-secret') {
  const laneQuery = positional[1] || ''
  const name = positional[2] || ''
  const type = cmd === 'set-secret' ? 'secret' : (positional[3] || 'string')
  const value = cmd === 'set-secret'
   ? (positional.slice(3).join(' ') || flags.value)
   : (positional.slice(4).join(' ') || flags.value)
  const out = await agentMutateLaneInput(rootKv, {
   sessionId,
   dataDir,
   laneId: laneQuery,
   action: 'set-input',
   name,
   type,
   value: value !== undefined && String(value).length > 0 ? String(value) : undefined,
  })
  if (out.ok) {
   await notify({
    type: 'lane-updated',
    laneId: out.laneId,
    action: 'set-input',
   })
  }
  console.log(JSON.stringify(out, null, 2))
  if (!out.ok) process.exitCode = 1
  return
 }

 if (cmd === 'delete-input' || cmd === 'remove-input') {
  const laneQuery = positional[1] || ''
  const name = positional[2] || ''
  const out = await agentMutateLaneInput(rootKv, {
   sessionId,
   dataDir,
   laneId: laneQuery,
   action: 'delete-input',
   name,
  })
  if (out.ok) {
   await notify({
    type: 'lane-updated',
    laneId: out.laneId,
    action: 'delete-input',
   })
  }
  console.log(JSON.stringify(out, null, 2))
  if (!out.ok) process.exitCode = 1
  return
 }

 if (cmd === 'create-table') {
  const laneQuery = positional[1] || ''
  const tableName = positional[2] || 'table_1'
  const rawJson = positional.slice(3).join(' ') || '[]'
  const columns = JSON.parse(rawJson)
  const out = await agentMutateLaneTable(rootKv, {
   sessionId,
   dataDir,
   laneId: laneQuery,
   action: 'create-table',
   tableName,
   columns,
  })
  if (out.ok) {
   await notify({
    type: 'lane-updated',
    laneId: out.laneId,
    action: 'create-table',
   })
  }
  console.log(JSON.stringify(out, null, 2))
  if (!out.ok) process.exitCode = 1
  return
 }

 if (cmd === 'import-table') {
  const laneQuery = positional[1] || ''
  const sourceLane = positional[2] || flags['source-lane'] || flags.sourceLane || ''
  const sourceTable = positional[3] || flags['source-table'] || flags.sourceTable || ''
  const localName = typeof flags.as === 'string'
   ? flags.as
   : (typeof flags.name === 'string' ? flags.name : undefined)
  const out = await agentMutateLaneTable(rootKv, {
   sessionId,
   dataDir,
   laneId: laneQuery,
   action: 'import-table',
   sourceLane,
   sourceTable,
   mode: typeof flags.mode === 'string' ? flags.mode : 'read-only',
   localName,
  })
  if (out.ok) {
   await notify({
    type: 'lane-updated',
    laneId: out.laneId,
    action: 'import-table',
   })
  }
  console.log(JSON.stringify(out, null, 2))
  if (!out.ok) process.exitCode = 1
  return
 }

 if (cmd === 'delete-row') {
  const laneQuery = positional[1] || ''
  const tableQuery = positional[2] || ''
  const rowId = positional[3] || ''
  await handleTableRowWithTrigger({
   rootKv,
   notify,
   isInteractive,
   sessionId,
   dataDir,
   laneQuery,
   action: 'delete-row',
   tableQuery,
   rowId,
  })
  return
 }

 if (cmd === 'deployments') {
  const ping = Boolean(flags.ping)
  const out = await agentListDeployments(rootKv, { sessionId, dataDir, ping })
  console.log(JSON.stringify(out, null, 2))
  return
 }

 console.error(`Unknown command: ${cmd}`)
 printHelp()
 process.exitCode = 1
}

main().catch(err => {
 console.error(JSON.stringify({ ok: false, error: err && err.message ? err.message : String(err) }, null, 2))
 process.exitCode = 1
})
