import importlib.util,json,tempfile,sqlite3,unittest,os
from pathlib import Path
from unittest.mock import patch,Mock
spec=importlib.util.spec_from_file_location('sync',Path(__file__).with_name('audiobook_job_sync.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Tests(unittest.TestCase):
 def job(self):
  media={'before':{'analysis':{'integratedLufs':-40,'truePeakDb':-17,'lra':7,'plr':23,'durationSec':300},'noiseFloorDb':-70},'after':{'analysis':{'integratedLufs':-18,'truePeakDb':-3.2,'lra':5,'plr':14.8,'durationSec':300},'noiseFloorDb':-58}}
  return dict(id='a'*32,owner='test-owner',filename='<script>.wav',mode='preview',target=-18,state='done',created=1,updated=2,expires=9999999999,media=json.dumps(media),preview_start=60,preview_duration=300)
 def test_report_real_qc_and_escape(self):
  job=self.job();r=m.report_for(job)
  self.assertEqual([v['outcome'] for v in r['rows']],['OK','OK','—','—','UTANFÖR','—'])
  self.assertEqual(r['after']['signalNoiseDb'],40)
  self.assertNotIn('<script>',m.html_report(job,r));self.assertIn('&lt;script&gt;',m.html_report(job,r))
 def test_validation_has_no_after(self):
  j=self.job();j['mode']='validate';j['media']=json.dumps({'before':json.loads(j['media'])['before']})
  r=m.report_for(j);self.assertIsNone(r['after']);self.assertEqual(r['rows'][0]['outcome'],'UTANFÖR')
 def test_expiry_removes_sensitive_fields(self):
  r=m.record(self.job(),10000000000)
  for key in ['file_name','user_id','report','report_storage_path','error_message']:self.assertIsNone(r[key])
  self.assertEqual(r['status'],'expired')
 def test_failure_retry_and_dedup(self):
  with tempfile.TemporaryDirectory() as td,patch.object(m,'DATA',Path(td)),patch.object(m,'publish_health'),patch.dict(os.environ,{'AUDIOBOOK_STORAGE_URL':'https://xuxqrkposxrvhwvwjroc.supabase.co','AUDIOBOOK_STORAGE_SERVICE_ROLE_KEY':'test'}):
   j=self.job()
   with sqlite3.connect(Path(td)/'jobs.sqlite') as db:
    db.execute('create table jobs ('+','.join(k for k in j)+')');db.execute('insert into jobs values ('+','.join('?' for k in j)+')',list(j.values()))
   with patch.object(m.requests,'post',side_effect=RuntimeError('offline')):
    with self.assertRaises(RuntimeError):m.sync()
   response=Mock();response.raise_for_status.return_value=None
   with patch.object(m.requests,'post',return_value=response) as post:
    self.assertEqual(m.sync()['synced'],1);self.assertEqual(post.call_count,2)
    self.assertEqual(m.sync()['synced'],0);self.assertEqual(post.call_count,2)
if __name__=='__main__':unittest.main()
