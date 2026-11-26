#!/usr/bin/env node
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'
import {
 DEFAULT_AGENT_DATA_URL,
 handleMcpJsonRpc,
 resolveAgentRootKv,
} from './agent-api.mjs'

export function startMcpStdioServer(options = {}) {
 const input = options.input || process.stdin
 const output = options.output || process.stdout
 const baseUrl = options.baseUrl || process.env.CC_DATA_URL || DEFAULT_AGENT_DATA_URL
 const rootKv = resolveAgentRootKv(options.rootKv || { baseUrl })

 const rl = readline.createInterface({
  input,
  terminal: false,
 })

 rl.on('line', async rawLine => {
  const trimmed = String(rawLine || '').trim()
  if (!trimmed) {
   return
  }
  let parsed
  try {
   parsed = JSON.parse(trimmed)
  }
  catch {
   output.write(`${JSON.stringify({
    jsonrpc: '2.0',
    id: null,
    error: { code: -32700, message: 'Parse error' },
   })}\n`)
   return
  }

  if (Array.isArray(parsed)) {
   const responses = (await Promise.all(parsed.map(msg => handleMcpJsonRpc(rootKv, msg)))).filter(Boolean)
   if (responses.length > 0) {
    output.write(`${JSON.stringify(responses)}\n`)
   }
   return
  }

  const response = await handleMcpJsonRpc(rootKv, parsed)
  if (response !== null) {
   output.write(`${JSON.stringify(response)}\n`)
  }
 })

 return { rl, rootKv }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
 startMcpStdioServer()
}
