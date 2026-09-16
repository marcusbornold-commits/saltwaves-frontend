const ts=require('typescript'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{
 const source=ts.transpileModule(fs.readFileSync('lib/audiobook-invite.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const m={exports:{}};new Function('require','module','exports',source)(require,m,m.exports);
 const {readInvite,redeemInvite}=m.exports;
 process.env.AUDIOBOOK_ENABLED='true';process.env.AUDIOBOOK_INVITE_SECRET='test-secret-'.repeat(5);process.env.AUDIOBOOK_INVITE_EXPIRES=new Date(Date.now()+86400000).toISOString();
 const secret=process.env.AUDIOBOOK_INVITE_SECRET;
 assert.equal(await redeemInvite('wrong'),null);
 const a=await redeemInvite(secret),b=await redeemInvite(secret);
 assert.ok(a);assert.notEqual(await readInvite(a.value),await readInvite(b.value));
 assert.equal(await readInvite((await redeemInvite(secret,a.value)).value),await readInvite(a.value));
 assert.equal(await readInvite(a.value+'tampered'),null);
 process.env.AUDIOBOOK_INVITE_SECRET='rotated-secret-'.repeat(5);assert.equal(await readInvite(a.value),null);
 process.env.AUDIOBOOK_INVITE_SECRET=secret;process.env.AUDIOBOOK_INVITE_EXPIRES=new Date(Date.now()-1000).toISOString();assert.equal(await readInvite(a.value),null);assert.equal(await redeemInvite(secret),null);
 console.log('PASS: invalid token, distinct owners, stable owner, tampering, revocation, expiry');
})();
