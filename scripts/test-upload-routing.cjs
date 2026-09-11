// Targeted offline regression: paid uploads must not depend on Mini availability.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../lib/backend-health.ts'),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
async function run(transport) {
  const calls=[];
  const context={exports:{},require,process:{env:{NEXT_PUBLIC_API_URL:'https://offline-mini.invalid'}},AbortController,setTimeout,clearTimeout,
    fetch:async(url)=>{calls.push(url);if(url==='/api/queue/health')return {ok:true,json:async()=>({transport})};throw new Error('Mini offline');}};
  vm.runInNewContext(code,context);
  return {result:await context.exports.checkBackendHealth(),calls};
}
(async()=>{
 const paid=await run('storage');assert.equal(paid.result,'up');assert.equal(paid.calls.length,1);
 const free=await run('mini');assert.equal(free.result,'down');assert.equal(free.calls.length,2);
 console.log('PASS: paid path stays available with Mini offline; Free retains Mini health dependency');
})().catch(error=>{console.error(error);process.exitCode=1;});
