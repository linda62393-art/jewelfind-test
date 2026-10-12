import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const config = ts.transpileModule(readFileSync(new URL('../src/configs/viewing.ts', import.meta.url),'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const configUrl = `data:text/javascript;base64,${Buffer.from(config).toString('base64')}`
let code = ts.transpileModule(readFileSync(new URL('../src/services/appointmentChanges.ts', import.meta.url),'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
code = code.replace("'../configs/viewing'", JSON.stringify(configUrl))
const { appointmentTime } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
const now = Date.parse('2026-10-12T12:10:00+08:00')
test('rescheduling uses Taiwan time and the same available hours and half-hour slots', () => {
  assert.equal(appointmentTime('2026-10-13', '09', '00', now), '2026-10-13T09:00:00+08:00')
  assert.equal(appointmentTime('2026-10-13', '23', '30', now), '2026-10-13T23:30:00+08:00')
})
test('past times, impossible dates, midnight and arbitrary minutes are rejected', () => {
  for (const args of [['2026-10-12','12','00'],['2026-02-30','12','30'],['2026-10-13','08','30'],['2026-10-13','00','00'],['2026-10-13','12','15'],['','12','30']]) assert.throws(() => appointmentTime(...args, now))
})
