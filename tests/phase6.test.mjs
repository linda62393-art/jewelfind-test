import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const source = readFileSync(new URL('../supabase/functions/_shared/validation.ts', import.meta.url),'utf8')
const code = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const { validateSubmission } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
test('viewing region is independent of customer residence and original answers', () => {
  const raw = {submissionKey:crypto.randomUUID(), productId:'r-01', viewingRegion:'新北市', preferredTime:'2030-01-01T00:00:00Z', customer:{name:'Test',phone:'0912345678',region:'台中市'},answers:{purpose:'self',category:'ring',materials:['diamond'],budget:'10000-30000',style:'minimal'}}
  const {payload} = validateSubmission(raw,{'r-01':'戒指'})
  assert.equal(payload.region,'台中市'); assert.equal(payload.viewing_region,'新北市'); assert.equal(payload.style,'minimal')
})
