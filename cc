#!/usr/bin/env node
import fs from 'node:fs/promises'
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
} from './agent-api.mjs'
import { startMcpStdioServer } from './mcp.mjs'

function isCliFlagToken(token) {
 return typeof token === 'string' && token.startsWith('--') && token.length > 2 && !/^\s/.test(token.slice(2))
}

function parseCliArgs(argv) {
 const positional = []
 const flags = {}
 for (let i = 0; i < argv.length; i++) {
  const token = String(argv[i])
  if (isCliFlagToken(token)) {
   const eqIdx = token.indexOf('=')
   if (eqIdx !== -1) {
    const k = token.slice(2, eqIdx)
    const v = token.slice(eqIdx + 1)
    flags[k] = v
   }
   else {
    const k = token.slice(2)
    const next = argv[i + 1]
    if (next !== undefined && !isCliFlagToken(String(next))) {
     flags[k] = String(next)
     i += 1
    }
    else {
     flags[k] = true
    }
   }
  }
  else {
   positional.push(token)
  }
 }
 return { positional, flags }
}

async function notifyRunningServer(serverOrigin, eventPayload) {
 try {
  await fetch(`${serverOrigin}/api/agent/notify`, {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify(eventPayload),
  })
 }
 catch {
  // Server notification is best-effort
 }
}

function printHelp() {
 console.log(`Civil Command Agent & Operator CLI (./cc)

Usage:
  ./cc sessions
  ./cc session [sessionIdOrName]
  ./cc lanes [--session <idOrName>]
  ./cc lane <laneIdOrTitle> [--session <idOrName>]
  ./cc eval <laneIdOrTitle> [--session <idOrName>] [--apply-exports] [--http-get <path>]
  ./cc create-lane <title> [line1] [line2...] [--session <idOrName>] [--package <pkgId>]
  ./cc set-line <laneIdOrTitle> <lineNumberOrLineId> <text> [--session <idOrName>]
  ./cc append-line <laneIdOrTitle> <text> [--session <idOrName>]
  ./cc insert-line <laneIdOrTitle> <lineNumber> <text> [--session <idOrName>]
  ./cc delete-line <laneIdOrTitle> <lineNumberOrLineId> [--session <idOrName>]
  ./cc replace-script <laneIdOrTitle> --file <jsonLinesPath> [--session <idOrName>]
  ./cc set-input <laneIdOrTitle> <name> <type> [secretValue] [--session <idOrName>]
  ./cc delete-input <laneIdOrTitle> <name> [--session <idOrName>]
  ./cc create-table <laneIdOrTitle> <tableName> <jsonColumns> [--session <idOrName>]
  ./cc add-row <laneIdOrTitle> <tableNameOrId> <jsonValues> [--session <idOrName>]
  ./cc update-row <laneIdOrTitle> <tableNameOrId> <rowId> <jsonValues> [--session <idOrName>]
  ./cc delete-row <laneIdOrTitle> <tableNameOrId> <rowId> [--session <idOrName>]
  ./cc deployments [--ping] [--session <idOrName>]
  ./cc mcp

Global Flags:
  --session <idOrName>   Target session by ID or name (defaults to most recently updated session)
  --dir <basePath>       Explicit data directory basePath override
  --url <dataUrl>        Custom KV endpoint (default: ${DEFAULT_AGENT_DATA_URL})
`)
}

async function main() {
 const { positional, flags } = parseCliArgs(process.argv.slice(2))
 const cmd = (positional[0] || 'help').toLowerCase()

 if (cmd === 'help' || cmd === '-h' || flags.help) {
  printHelp()
  return
 }

 const baseUrl = typeof flags.url === 'string' && flags.url.trim()
  ? flags.url.trim()
  : (process.env.CC_DATA_URL || DEFAULT_AGENT_DATA_URL)
 const serverOrigin = new URL(baseUrl).origin

 if (cmd === 'mcp') {
  startMcpStdioServer({ baseUrl })
  return
 }

 const rootKv = resolveAgentRootKv({ baseUrl })
 const sessionId = typeof flags.session === 'string' ? flags.session : ''
 const dataDir = typeof flags.dir === 'string' ? flags.dir : undefined

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
  const out = await agentEvalLane(rootKv, {
   sessionId,
   dataDir,
   laneId: laneQuery,
   applyExports,
   httpRequest,
  })
  if (out.ok) {
   await notifyRunningServer(serverOrigin, {
    type: 'lane-updated',
    laneId: out.laneId,
    action: 'eval',
   })
  }
  console.log(JSON.stringify(out, null, 2))
  if (!out.ok) process.exitCode = 1
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
   await notifyRunningServer(serverOrigin, {
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
   await notifyRunningServer(serverOrigin, {
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
   await notifyRunningServer(serverOrigin, {
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
   await notifyRunningServer(serverOrigin, {
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
   await notifyRunningServer(serverOrigin, {
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
   await notifyRunningServer(serverOrigin, {
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
   await notifyRunningServer(serverOrigin, {
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
  const out = await agentMutateLaneTable(rootKv, {
   sessionId,
   dataDir,
   laneId: laneQuery,
   action: 'add-row',
   table: tableQuery,
   rowId: typeof flags.row === 'string' ? flags.row : undefined,
   values,
  })
  if (out.ok) {
   await notifyRunningServer(serverOrigin, {
    type: 'lane-updated',
    laneId: out.laneId,
    action: 'add-row',
   })
  }
  console.log(JSON.stringify(out, null, 2))
  if (!out.ok) process.exitCode = 1
  return
 }

 if (cmd === 'update-row') {
  const laneQuery = positional[1] || ''
  const tableQuery = positional[2] || ''
  const rowId = positional[3] || ''
  const rawJson = positional.slice(4).join(' ') || '{}'
  const values = JSON.parse(rawJson)
  const out = await agentMutateLaneTable(rootKv, {
   sessionId,
   dataDir,
   laneId: laneQuery,
   action: 'update-row',
   table: tableQuery,
   rowId,
   values,
  })
  if (out.ok) {
   await notifyRunningServer(serverOrigin, {
    type: 'lane-updated',
    laneId: out.laneId,
    action: 'update-row',
   })
  }
  console.log(JSON.stringify(out, null, 2))
  if (!out.ok) process.exitCode = 1
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
   await notifyRunningServer(serverOrigin, {
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
   await notifyRunningServer(serverOrigin, {
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
   await notifyRunningServer(serverOrigin, {
    type: 'lane-updated',
    laneId: out.laneId,
    action: 'create-table',
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
  const out = await agentMutateLaneTable(rootKv, {
   sessionId,
   dataDir,
   laneId: laneQuery,
   action: 'delete-row',
   table: tableQuery,
   rowId,
  })
  if (out.ok) {
   await notifyRunningServer(serverOrigin, {
    type: 'lane-updated',
    laneId: out.laneId,
    action: 'delete-row',
   })
  }
  console.log(JSON.stringify(out, null, 2))
  if (!out.ok) process.exitCode = 1
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
