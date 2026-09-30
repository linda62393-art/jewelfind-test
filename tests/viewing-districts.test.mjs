import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const source = readFileSync(new URL('../src/configs/viewing.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const { viewingDistricts } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
const migration = readFileSync(new URL('../supabase/migrations/202609300001_districts_and_manual_notifications.sql', import.meta.url), 'utf8')
test('all 41 distinct district choices are accepted by the database service-area list', () => {
  assert.equal(viewingDistricts['台北市'].length, 12)
  assert.equal(viewingDistricts['新北市'].length, 29)
  const districts = Object.entries(viewingDistricts).flatMap(([city, items]) => items.map(district => city + district))
  assert.equal(new Set(districts).size, 41)
  for (const district of districts) assert.ok(migration.includes(`('${district}')`), `${district} missing from service regions`)
})
