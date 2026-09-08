import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capability, validCapability, validateUpload, inputBucket, QueueError } from '../lib/queue-validation';
import { PLAN_LIMITS } from '../lib/access-limits';
const good={filename:'episode.wav',size:1024,email:'test@example.com',mic_type:'unknown',duration_seconds:60};
for (const [name,body] of Object.entries({traversal:{filename:'../episode.wav'},separator:{filename:'C:\\episode.wav'},html:{filename:'test.html'},empty:{size:0},float:{size:1.5},nan:{duration_seconds:NaN},negative:{duration_seconds:-1},infinite:{duration_seconds:Infinity},badEmail:{email:'not-an-email'},injection:{mic_type:'unknown; rm'}})) {
 test('rejects '+name,()=>assert.throws(()=>validateUpload({...good,...body},PLAN_LIMITS.free),QueueError));
}
test('free upload cannot use paid size limit',()=>assert.throws(()=>validateUpload({...good,size:201*1024*1024},PLAN_LIMITS.free),{code:'file_too_large'}));
test('existing paid size limits and duration limits are preserved',()=>{
 assert.equal(validateUpload({...good,size:1000*1024*1024,duration_seconds:180*60},PLAN_LIMITS.creator).size,1000*1024*1024);
 assert.throws(()=>validateUpload({...good,duration_seconds:181*60},PLAN_LIMITS.creator),{code:'episode_too_long'});
 assert.equal(validateUpload({...good,duration_seconds:300*60},PLAN_LIMITS.studio).duration,18000);
});
test('a token only authorizes its job and key',()=>{
 const id='bbd00d75-0709-4fdc-9284-bd8d29239d83', key='test-secret';
 const token=capability(id,key);
 assert(validCapability(id,token,key));
 assert(!validCapability('8f54aa55-df59-49a7-a5f4-7f68ef7b1d95',token,key));
 assert(!validCapability(id,token,'other-key'));
 for(const bad of ['',token+'0','zz'.repeat(32),'../'+id]) assert(!validCapability(id,bad,key));
});
test('input buckets enforce each plan class independently of output files',()=>{
 assert.equal(inputBucket('free'),'podmaster-input-free');
 for(const plan of ['creator','founding','studio']) assert.equal(inputBucket(plan),'podmaster-input-paid');
});
