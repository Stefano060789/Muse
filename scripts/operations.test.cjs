const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync, spawn } = require('node:child_process')
const { DatabaseSync } = require('node:sqlite')
const root = path.resolve(__dirname, '..')
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'muse-operations-'))
const saved = { env: { ...process.env }, fetch: global.fetch, now: Date.now, error: console.error }
let passed = 0
async function check(name, run) { await run(); passed++; console.log(`PASS ${name}`) }
function response() {
  return { code: 200, headers: {}, body: null, setHeader(k,v) { this.headers[k]=v }, status(v) { this.code=v; return this }, json(v) { this.body=v; return this } }
}
async function main() {
  execFileSync(process.execPath, [path.join(root,'node_modules','typescript','bin','tsc'),
    'src/lib/operations.ts','src/lib/storyProvider.ts','src/pages/api/operations.ts','src/pages/api/report-error.ts',
    '--outDir',output,'--rootDir','src','--module','commonjs','--target','es2020','--esModuleInterop','--skipLibCheck','--noEmit','false'], {cwd:root,stdio:'inherit'})
  // Compiled output uses the existing dependencies, without installing anything.
  const Module = require('node:module')
  process.env.NODE_PATH = path.join(root,'node_modules'); Module._initPaths()
  process.env.STORY_STORAGE='sqlite'
  process.env.MUSE_OPERATIONS_SQLITE_PATH=path.join(output,'operations.sqlite')
  process.env.MUSE_AI_DAILY_ATTEMPT_CAP='100'
  process.env.MUSE_OPERATIONS_ACCESS_CODE='fixture-operations-access-code'
  delete process.env.VERCEL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  const ops=require(path.join(output,'lib','operations.js'))
  const store=require(path.join(output,'lib','operationsStore.js'))
  const provider=require(path.join(output,'lib','storyProvider.js'))
  const reports=require(path.join(output,'pages','api','report-error.js')).default
  const status=require(path.join(output,'pages','api','operations.js')).default
  let now=Date.parse('2026-10-14T10:00:00Z')
  Date.now=()=>now
  const events=[]
  console.error=(message)=>events.push(String(message))
  await check('exact 100/day hard cap and 80th-attempt warning, with no provider requests',async()=>{
    for(let i=0;i<100;i++) await ops.reserveAiAttempt()
    await assert.rejects(()=>ops.reserveAiAttempt(),e=>e.status===429)
    assert.equal((await store.operationStatus(ops.aiDayBucket())).used,100)
    const s=await ops.productionOperationStatus()
    assert.equal(s.remaining,0); assert.equal(s.warningAt,80); assert.equal(s.publicBetaReady,false)
    assert.equal(s.alerts.filter(a=>a.event==='ai-budget-warning').length,1)
    assert.equal(s.alerts.filter(a=>a.event==='ai-budget-exhausted').length,1)
    for(let i=0;i<10;i++) await assert.rejects(()=>ops.reserveAiAttempt())
    assert.equal((await store.operationStatus(ops.aiDayBucket())).alerts.length,2)
  })
  await check('UTC reset, lower caps and invalid configuration fail closed',async()=>{
    now+=86400000
    process.env.MUSE_AI_DAILY_ATTEMPT_CAP='2'
    await ops.reserveAiAttempt(); await ops.reserveAiAttempt()
    await assert.rejects(()=>ops.reserveAiAttempt(),e=>e.status===429)
    for(const v of ['101','0','1.5','NaN','-1']) {
      process.env.MUSE_AI_DAILY_ATTEMPT_CAP=v
      await assert.rejects(()=>ops.reserveAiAttempt(),e=>e.status===503)
    }
    process.env.MUSE_AI_DAILY_ATTEMPT_CAP='100'
  })
  await check('failed provider call stays charged; blocked calls never reach provider; bounds apply before spending',async()=>{
    now+=86400000
    process.env.LLM_PROVIDER='GROQ';process.env.LLM_API_KEY='fixture-provider-key';process.env.MUSE_AI_DAILY_ATTEMPT_CAP='1'
    let calls=0
    global.fetch=async()=>{calls++;throw new Error('PRIVATE request prompt and token')}
    await assert.rejects(()=>provider.generateStoryJson('system',{text:'PRIVATE STORY'},100),e=>e.status===503)
    await assert.rejects(()=>provider.generateStoryJson('system',{},100),e=>e.status===429)
    await assert.rejects(()=>provider.generateStoryJson('system',{},9001),e=>e.status===400)
    assert.equal(calls,1)
    assert.ok(events.every(e=>!e.includes('PRIVATE')&&!e.includes('fixture-provider')))
    process.env.MUSE_AI_DAILY_ATTEMPT_CAP='100'
  })
  await check('distributed request and failed-creator throttles ignore spoofed client headers locally',async()=>{
    now+=86400000
    const req={url:'/api/operations',headers:{host:'localhost:3000','x-forwarded-for':'spoof'},socket:{remoteAddress:'client-1'},body:{action:'create'}}
    for(let i=0;i<20;i++) assert.equal(await ops.apiSafety(req,response()),true)
    const res=response();assert.equal(await ops.apiSafety(req,res),false);assert.equal(res.code,429);assert.ok(res.headers['Retry-After'])
    const hostile=response();assert.equal(await ops.apiSafety({...req,headers:{...req.headers,origin:'https://hostile.invalid'}},hostile),false);assert.equal(hostile.code,403)
    const publicReq={headers:{host:'localhost:3000'},socket:{remoteAddress:'client-2'},body:{action:'open'}}
    for(let i=0;i<120;i++) assert.equal(await ops.apiSafety(publicReq,response(),true),true)
    const limited=response();assert.equal(await ops.apiSafety(publicReq,limited,true),false);assert.equal(limited.code,429)
  })
  await check('maintenance pauses story operations without consuming request or AI allowances',async()=>{
    const req={headers:{host:'localhost'},socket:{remoteAddress:'maintenance-client'},body:{action:'create'}}
    const before=(await store.operationStatus(ops.aiDayBucket())).used
    process.env.MUSE_MAINTENANCE_MODE='true'
    let res=response();assert.equal(await ops.apiSafety(req,res),false);assert.equal(res.code,503);assert.equal(res.headers['Retry-After'],'60')
    process.env.MUSE_MAINTENANCE_MODE='invalid'
    res=response();assert.equal(await ops.apiSafety(req,res),false);assert.equal(res.code,503)
    delete process.env.MUSE_MAINTENANCE_MODE
    assert.equal((await store.operationStatus(ops.aiDayBucket())).used,before)
  })
  await check('error reporting accepts fixed codes only, requires same-origin, caps abuse and contains no private fields',async()=>{
    const req={method:'POST',headers:{host:'localhost:3000',origin:'http://localhost:3000'},socket:{remoteAddress:'reporter'},body:{event:'client-render-failure'}}
    let res=response();await reports({...req,body:{...req.body,message:'PRIVATE TOKEN'}},res);assert.equal(res.code,400)
    res=response();await reports({...req,headers:{host:'localhost:3000'}},res);assert.equal(res.code,403)
    res=response();await reports(req,res);assert.equal(res.code,202)
    for(let i=0;i<3;i++) await reports(req,response())
    res=response();await reports(req,res);assert.equal(res.code,429)
    assert.ok(JSON.stringify(await ops.productionOperationStatus()).includes('client-render-failure'))
    assert.ok(!JSON.stringify(await ops.productionOperationStatus()).includes('PRIVATE'))
  })
  await check('operations status is private, no-store and explicitly blocks public readiness',async()=>{
    const req={method:'GET',headers:{host:'localhost:3000'},socket:{remoteAddress:'operator'}}
    let res=response();await status(req,res);assert.equal(res.code,401)
    res=response();await status({...req,headers:{...req.headers,'x-muse-operations-code':process.env.MUSE_OPERATIONS_ACCESS_CODE}},res)
    assert.equal(res.code,200);assert.equal(res.headers['Cache-Control'],'no-store')
    assert.equal(res.body.publicBetaReady,false);assert.ok(res.body.blockers.length>=3)
    assert.ok(!JSON.stringify(res.body).includes(process.env.MUSE_OPERATIONS_ACCESS_CODE))
  })
  await check('independent processes compete atomically for the last daily reservations',async()=>{
    process.env.MUSE_OPERATIONS_SQLITE_PATH=path.join(output,'concurrent.sqlite')
    const code=`const ops=require(${JSON.stringify(path.join(output,'lib','operations.js'))});(async()=>{let accepted=0;for(let i=0;i<60;i++){try{await ops.reserveAiAttempt();accepted++}catch(e){if(e.status!==429)throw e}}console.log(accepted)})().catch(()=>process.exit(1))`
    const run=()=>new Promise((resolve,reject)=>{
      const child=spawn(process.execPath,['-e',code],{env:{...process.env},stdio:['ignore','pipe','pipe']})
      let out='',err='';child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b)
      child.on('error',reject);child.on('close',n=>n===0?resolve(Number(out.trim())):reject(new Error(err)))
    })
    const accepted=await Promise.all([run(),run(),run()])
    assert.equal(accepted.reduce((a,b)=>a+b,0),100)
    const db=new DatabaseSync(process.env.MUSE_OPERATIONS_SQLITE_PATH)
    try {assert.equal(db.prepare("SELECT used FROM muse_operations_counters WHERE bucket LIKE 'ai:%'").get().used,100)}finally{db.close()}
  })
  await check('hosted storage failure blocks paid reservations; migration grants only service-role execution',async()=>{
    process.env.VERCEL='1';process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='fixture-service-key'
    global.fetch=async()=>new Response(JSON.stringify({message:'PRIVATE DATABASE ERROR'}),{status:500,headers:{'Content-Type':'application/json'}})
    await assert.rejects(()=>ops.reserveAiAttempt(),e=>e.status===503)
    assert.ok(events.every(e=>!e.includes('PRIVATE')))
    const sql=fs.readFileSync(path.join(root,'supabase','operations.sql'),'utf8')
    assert.match(sql,/for update/i);assert.match(sql,/enable row level security/i);assert.match(sql,/from public, anon, authenticated/i)
    assert.ok(!sql.includes('action-evidence'))
  })
  console.log(`${passed} operations checks passed; zero real provider requests.`)
}
main().catch(e=>{console.error=saved.error;console.error(e);process.exitCode=1}).finally(()=>{
  process.env=saved.env;global.fetch=saved.fetch;Date.now=saved.now;console.error=saved.error
  fs.rmSync(output,{recursive:true,force:true})
})
