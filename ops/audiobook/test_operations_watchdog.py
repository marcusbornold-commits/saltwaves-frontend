import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('watchdog', Path(__file__).with_name('operations_watchdog.py'))
w = importlib.util.module_from_spec(spec)
spec.loader.exec_module(w)

class Response:
    def __init__(self, status=200, body=None): self.status_code=status; self.ok=status<400; self.body=body
    def json(self): return self.body

class WatchdogTests(unittest.TestCase):
    def test_incident_survives_restart_and_days(self):
        s={}
        for cycle in range(500):
            w.observe(s,False,'database_unavailable',cycle,cycle*300)
            s=json.loads(json.dumps(s)) # disk restart
        self.assertEqual(len(s['outbox']),1)
        original=s['incident']
        w.observe(s,True,None,500,150000)
        w.observe(s,True,None,500,150001) # same cycle cannot recover
        self.assertEqual(s['incident'],original)
        w.observe(s,True,None,501,150300)
        self.assertIsNone(s['incident'])
        self.assertEqual([e['kind'] for e in s['outbox']],['outage','recovery'])
        for cycle in range(502,505): w.observe(s,False,'database_unavailable',cycle,cycle*300)
        self.assertNotEqual(s['incident'],original)
        self.assertEqual(len(s['outbox']),3)

    def test_transient_failure_never_alerts(self):
        s={}
        for cycle,ok in enumerate([False,False,True,False,True,True]):
            w.observe(s,ok,'database_unavailable',cycle,cycle*300)
        self.assertEqual(s['outbox'],[])

    def test_delivery_retries_same_id_until_confirmed(self):
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'state.json';s={}
            for cycle in range(3):w.observe(s,False,'database_unavailable',cycle,cycle*300)
            keys=[]
            def post(url,**kwargs):
                self.assertEqual(len(json.loads(path.read_text())['outbox']),1)
                keys.append(kwargs['headers']['Idempotency-Key'])
                return Response(503 if len(keys)==1 else 200)
            w.drain(s,path,'secret',post,lambda:1000)
            s=json.loads(path.read_text())
            w.drain(s,path,'secret',post,lambda:1100)
            self.assertEqual(keys[0],keys[1]);self.assertEqual(s['outbox'],[])

    def test_unknown_delivery_not_repeated_after_provider_window(self):
        with tempfile.TemporaryDirectory() as d:
            s={'outbox':[{'id':'x','kind':'outage','first_attempt':1}]}
            w.drain(s,Path(d)/'state.json','secret',lambda *a,**k:self.fail('must not resend'),lambda:24*3600)
            self.assertTrue(s['mail_blocked']);self.assertEqual(len(s['outbox']),1)

    def test_probe_retry_and_safe_error(self):
        calls=[]
        def get(*a,**k):
            calls.append(k)
            return Response(503,{'error':'private secret'}) if len(calls)==1 else Response(200,{'ok':True})
        self.assertEqual(w.probe('secret',get),(True,None))
        self.assertEqual(len(calls),2)
        self.assertFalse(calls[0]['allow_redirects'])
        self.assertEqual(w.probe('secret',lambda *a,**k:Response(503,{'error':'private secret'})),(False,'web_unreachable'))

    def test_transport_repair_requires_three_failures_and_local_health(self):
        s={}
        self.assertFalse(w.tunnel_repair_needed(s,False,True,10000))
        self.assertFalse(w.tunnel_repair_needed(s,False,True,10120))
        self.assertFalse(w.tunnel_repair_needed(s,False,False,10240))
        self.assertTrue(w.tunnel_repair_needed(s,False,True,10360))
        s['last_tunnel_restart']=10360
        self.assertFalse(w.tunnel_repair_needed(s,False,True,10480))
        self.assertFalse(w.tunnel_repair_needed(s,True,True,15000))
        self.assertEqual(s['tunnel_failures'],0)

if __name__=='__main__': unittest.main()
