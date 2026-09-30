import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const code = ts.transpileModule(readFileSync(new URL('../src/services/aftercare.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const { feedbackFields } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
test('purchase update clears reasons from earlier non-purchase and preserves zero budget',()=>{
  const f=new FormData(); f.set('outcome','purchased'); f.append('reasons','over_budget'); f.set('budget_min','0'); f.set('feedback_note','  客戶意見  ')
  const v=feedbackFields(f); assert.deepEqual(v.reasons,[]); assert.equal(v.budget_min,0); assert.equal(v.budget_max,null); assert.equal(v.note,'客戶意見')
})
test('non-purchase captures multiple reasons and numeric budget independently from original preference',()=>{
  const f=new FormData(); f.set('outcome','not_purchased'); f.append('reasons','style'); f.append('reasons','over_budget'); f.set('budget_min','10000'); f.set('budget_max','30000'); f.set('contact_preference','recommend'); f.set('viewed_on','2026-09-30')
  assert.deepEqual(feedbackFields(f),{viewed_on:'2026-09-30',outcome:'not_purchased',reasons:['style','over_budget'],budget_min:10000,budget_max:30000,contact_preference:'recommend',note:'',wanted_product:''})
})

test('six short feedback choices capture willingness and recommendation consent',()=>{
  const f=new FormData(); f.set('feedback_choice','over_budget'); f.set('budget_max','25000'); f.set('wanted_product','  珍珠耳環  ');
  const v=feedbackFields(f); assert.equal(v.outcome,'not_purchased'); assert.deepEqual(v.reasons,['over_budget']); assert.equal(v.budget_max,25000); assert.equal(v.wanted_product,'珍珠耳環'); assert.equal(v.contact_preference,'none');
  f.set('allow_recommend','on'); assert.equal(feedbackFields(f).contact_preference,'recommend');
})
