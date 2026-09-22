const assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript'), vm = require('node:vm');
const secret = 'x'.repeat(48);
let scenario={}, touched=[];
function from(table) {
  const q={}; let operation='read', id;
  for (const method of ['select','is','order','limit','abortSignal','single','maybeSingle']) q[method]=()=>q;
  q.eq=(key,value)=>{if(key==='id')id=value;return q;};
  q.upsert=row=>{operation='write';id=row.id;scenario.probeId=row.data.probeId;return q;};
  q.then=(resolve,reject)=>{
    touched.push({table,operation,id});
    let data;
    if (table==='audiobook_monitor_health') data={data:{probeId:scenario.probeId}};
    if (table==='audiobook_monitor_state') data={checked_at:new Date(Date.now()-(scenario.stale?20*60000:0)).toISOString()};
    if (table==='audiobook_monitor_notifications') data=scenario.pending?[{created_at:new Date(Date.now()-20*60000).toISOString()}]:[];
    return Promise.resolve({data,error:scenario.fail?new Error('private database detail'):null}).then(resolve,reject);
  };
  return q;
}
const moduleStub={exports:{}};
const code=ts.transpile(fs.readFileSync('app/api/audiobook/monitor/probe/route.ts','utf8'),{module:ts.ModuleKind.CommonJS});
vm.runInNewContext(code,{exports:moduleStub.exports,Buffer,Response,AbortSignal,process:{env:{AUDIOBOOK_MONITOR_PROBE_SECRET:secret,AUDIOBOOK_MONITOR_ENABLED:'true'}},require:name=>{
  if(name==='node:crypto')return require(name);
  if(name.includes('storage-admin'))return {getAudiobookStorage:()=>({from}),audiobookStorageUrl:()=>({url:'https://xuxqrkposxrvhwvwjroc.supabase.co'})};
  if(name.includes('monitor-checks'))return {retryMonitorOperation:op=>op()};
  throw Error(name);
}});
(async()=>{
  let response=await moduleStub.exports.GET(new Request('https://test/'));
  assert.equal(response.status,401);assert.equal(touched.length,0);
  const request=()=>new Request('https://test/',{headers:{authorization:'Bearer '+secret}});
  response=await moduleStub.exports.GET(request());
  assert.equal(response.status,200);assert.equal((await response.json()).ok,true);
  assert.deepEqual(touched.filter(x=>x.operation==='write'),[{table:'audiobook_monitor_health',operation:'write',id:'reserve-probe'}]);
  for(const [input,error] of [[{fail:true},'database_unavailable'],[{stale:true},'cron_stale'],[{pending:true},'notification_delivery_stalled']]){
    scenario=input;response=await moduleStub.exports.GET(request());assert.equal(response.status,503);assert.equal((await response.json()).error,error);
  }
  console.log('Reserve probe auth, isolated write/read, DB failure, stale cron and pending mail scenarios passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
