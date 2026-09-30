import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const code=ts.transpileModule(readFileSync(new URL('../src/services/requestOrganizer.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const {organizations,organizeRequest,organizedRequests,progressEvents}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
const storage=new Map(); globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}
test('rename, pin and reversible hiding preserve original receipt and capability',()=>{
 const receipts=[{id:'a',createdAt:'2026-09-29T00:00:00Z',accessToken:'secret-a'},{id:'b',createdAt:'2026-09-30T00:00:00Z',accessToken:'secret-b'}]; const original=structuredClone(receipts);
 assert.equal(organizeRequest('a',{title:'  週年禮物  ',pinned:true}),true);
 assert.deepEqual(organizedRequests(receipts,organizations(),false).map(r=>r.id),['a','b']);
 organizeRequest('a',{hidden:true}); assert.deepEqual(organizedRequests(receipts,organizations(),false).map(r=>r.id),['b']); assert.deepEqual(organizedRequests(receipts,organizations(),true).map(r=>r.id),['a']);
 organizeRequest('a',{hidden:false}); assert.equal(organizations().a.title,'週年禮物'); assert.equal(organizations().a.pinned,true); assert.deepEqual(receipts,original); assert.ok(!JSON.stringify([...storage.values()]).includes('secret'));
})
test('same-request timeline has one submission and sorts newest updates before older ones',()=>{
 const events=[{id:'early',message:'調貨處理',kind:'transferring',occurred_at:'2026-09-30T02:00:00Z'},{id:'late',message:'商品到店',kind:'arrived',occurred_at:'2026-09-30T03:00:00Z'}];
 assert.deepEqual(progressEvents('2026-09-30T01:00:00Z',[...events,events[0]]).map(e=>e.id),['late','early','submitted']);
})
test('blocked browser storage reports failure but retains current-session organization',()=>{
 globalThis.localStorage={getItem(){throw new Error('blocked')},setItem(){throw new Error('blocked')}};
 assert.equal(organizeRequest('c',{hidden:true}),false); assert.equal(organizations().c.hidden,true);
})
