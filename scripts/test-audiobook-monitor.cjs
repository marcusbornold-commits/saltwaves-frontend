const assert=require('node:assert/strict');
const ts=require('typescript'),fs=require('node:fs'),vm=require('node:vm');
const code=ts.transpile(fs.readFileSync('lib/audiobook-monitor-checks.ts','utf8'),{module:ts.ModuleKind.CommonJS});
const moduleStub={exports:{}};vm.runInNewContext(code,{exports:moduleStub.exports,fetch,AbortSignal});
const {healthIssues,checkMiniService,miniServiceIssue}=moduleStub.exports;
const now=Date.now(),at=new Date(now).toISOString();
const good={workerAgeSeconds:3,diskFreeBytes:10*1024**3,cleanupAgeSeconds:30,cleanupFailed:false,queued:0,running:0,oldestQueuedAgeSeconds:0,recentErrors:0};
assert.equal(healthIssues(good,at,now).length,0);
assert.equal(healthIssues(null,null,now).length,1);
assert.equal(healthIssues(good,new Date(now-301000).toISOString(),now).length,1);
assert.equal(healthIssues({...good,running:1,queued:5,oldestQueuedAgeSeconds:7200},at,now).length,0,'Long running book must not be treated as stuck');
assert.equal(healthIssues({...good,queued:1,oldestQueuedAgeSeconds:601},at,now).length,1);
assert.equal(healthIssues({...good,workerAgeSeconds:70,diskFreeBytes:1024,cleanupFailed:true,recentErrors:3},at,now).length,4);
console.log('6 monitor scenarios passed');

(async()=>{
  assert.equal(miniServiceIssue(true, null, null, now), null);
  assert.match(miniServiceIssue(false, good, at, now), /Anslutningen/);
  assert.match(miniServiceIssue(false, good, new Date(now-301000).toISOString(), now), /livstecken.*saknas/);
  assert.match(miniServiceIssue(false, {...good,workerAgeSeconds:70}, at, now), /livstecken.*saknas/);
  let calls=0;
  const recovered=await checkMiniService('https://example.test/health',async()=>{
    if (++calls===1) throw Object.assign(new Error('private detail'),{name:'TimeoutError'});
    return new Response(JSON.stringify({ok:true}));
  });
  assert.equal(recovered.ok,true);
  assert.equal(calls,2);
  assert.equal(recovered.attempts[0].error,'timeout');
  assert.ok(!JSON.stringify(recovered).includes('private detail'));
  const failed=await checkMiniService('https://example.test/health',async()=>new Response('bad gateway',{status:502}));
  assert.equal(failed.ok,false);
  assert.equal(failed.attempts.length,2);
  assert.equal(failed.attempts[1].status,502);
  for (const body of ['invalid', 'null', '{"ok":false}', '{"ok":"true"}']) {
    const result=await checkMiniService('https://example.test/health',async()=>new Response(body));
    assert.equal(result.ok,false);
    assert.equal(result.attempts.length,2);
  }
  const healthy=await checkMiniService('https://example.test/health',async()=>new Response('{"ok":true}'));
  assert.equal(healthy.attempts.length,1);
  console.log('Retry, diagnostic privacy and service classification scenarios passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
