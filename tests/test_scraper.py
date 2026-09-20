import importlib.util
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'docker'))
import server
import fotocasa_scraper as fotocasa

class WorkerTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {'SCRAPER_API_KEY':'fixture-worker','SUPABASE_URL':'https://fixture.invalid','SCRAPER_SECRET':'fixture-webhook'}, clear=False)
        self.env.start();self.addCleanup(self.env.stop)
        server.jobs.clear();self.client=server.app.test_client()
        self.headers={'Authorization':'Bearer fixture-worker'}
    def test_unauthenticated_requests_cannot_start_or_read_jobs(self):
        self.assertEqual(self.client.post('/scrape', json={}).status_code,401)
        self.assertEqual(self.client.get('/jobs').status_code,401)
        self.assertEqual(self.client.get('/health').status_code,200)
    def test_empty_configuration_is_closed(self):
        with patch.dict(os.environ, {'SCRAPER_API_KEY':''}):
            self.assertEqual(self.client.get('/jobs').status_code,503)
    def test_invalid_portal_location_and_limits(self):
        for extra in [{'portal':'bad'},{'ubicacion':'https://localhost/'},{'max_pages':-1},{'max_pages':0},{'max_pages':51},{'max_pages':True}]:
            data={'portal':'fotocasa','ubicacion':'madrid-capital','max_pages':3,**extra}
            self.assertEqual(self.client.post('/scrape',json=data,headers=self.headers).status_code,400)
    def test_worker_uses_configured_webhook_and_requested_city(self):
        with patch.object(server,'Thread') as thread:
            result=self.client.post('/scrape',json={'portal':'fotocasa','ubicacion':'madrid-capital','webhook_url':'http://127.0.0.1/','webhook_auth':'attacker'},headers=self.headers)
            self.assertEqual(result.status_code,202)
            args=thread.call_args.kwargs['args']
            self.assertEqual(args[3],'https://fixture.invalid/functions/v1/scraping-service')
            self.assertEqual(args[4],'fixture-webhook');self.assertEqual(args[-1],'madrid-capital')
    def test_worker_caps_concurrent_jobs(self):
        server.jobs.update({'a':{'status':'pending'},'b':{'status':'running'}})
        self.assertEqual(self.client.post('/scrape',json={'portal':'pisos','ubicacion':'murcia'},headers=self.headers).status_code,429)
    def test_location_lookup_does_not_fallback_to_murcia(self):
        session=Mock();session.get.return_value.json.return_value={}
        with self.assertRaises(ValueError):fotocasa.get_combined_ids(session,'madrid-capital')
        session.get.return_value.raise_for_status.side_effect=RuntimeError('503')
        with self.assertRaises(RuntimeError):fotocasa.get_combined_ids(session,'madrid-capital')
    def test_unrecognized_response_is_not_empty_success(self):
        self.assertEqual(fotocasa.normalize_items({'realEstates':[]}),[])
        with self.assertRaises(ValueError):fotocasa.normalize_items({'error':'format changed'})
    def test_failed_ingestion_propagates(self):
        response=Mock();response.json.return_value={'success':False}
        with patch.object(server.requests,'post',return_value=response):
            with self.assertRaises(RuntimeError):server.send_to_webhook('job','pisos',[{}],'https://fixture.invalid','secret')
        with patch.object(fotocasa.requests,'post',return_value=response):
            with self.assertRaises(RuntimeError):fotocasa.send_page_to_webhook([{'id':1}],'https://fixture.invalid','secret')

if __name__=='__main__':unittest.main()
