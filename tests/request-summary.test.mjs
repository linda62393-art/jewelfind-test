import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const code=ts.transpileModule(readFileSync(new URL('../src/services/requestSummary.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const {requestSummary}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
const date='2026-10-12T10:00:00Z', later='2026-10-12T11:00:00Z'
test('compact cancelled and viewed cards retain event time rather than a later follow-up',()=>{
 for(const [stage,details,label] of [['cancelled',{action:'cancel'},'已取消'],['viewed',{stage:'viewed'},'已看貨']]) {
  const data={stage,notifications:[{kind:'update',details:{},published_at:later},{kind:'update',details,published_at:date}],timeline:[{occurred_at:later}]}
  assert.deepEqual(requestSummary(data,date),{label,occurredAt:date,dateLabel:'狀態更新'})
 }
})
test('a missing completion event does not invent a viewing or cancellation timestamp',()=>{
 assert.equal(requestSummary({stage:'viewed',notifications:[],timeline:[]},date).occurredAt,null)
 assert.equal(requestSummary(null,date).occurredAt,date)
})

test('finished and cancelled statuses move out of the active bucket while arranged viewing remains active',()=>{
 const completed=['cancelled','viewed','purchased','not_purchased','no_show','sold','unavailable']
 return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`).then(({isCompletedRequest})=>{
  for(const stage of completed) assert.equal(isCompletedRequest(stage),true)
  for(const stage of ['new','checking','notified','transferring','in_transit','arrived',undefined]) assert.equal(isCompletedRequest(stage),false)
 })
})
