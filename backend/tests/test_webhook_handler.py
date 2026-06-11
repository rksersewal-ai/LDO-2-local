import socket
from unittest.mock import patch

from django.test import TestCase

from integrations.webhook_handler import is_safe_url, WebhookHandler

class WebhookHandlerTests(TestCase):
    @patch('socket.getaddrinfo')
    def test_safe_urls(self, mock_getaddrinfo):
        # Mock public IP for example.com
        mock_getaddrinfo.return_value = [
            (socket.AF_INET, socket.SOCK_STREAM, 6, '', ('93.184.216.34', 443))
        ]
        self.assertTrue(is_safe_url('https://example.com/webhook'))

        # Test HTTP safe behavior when DEBUG is True (or mocked correctly if in production mode)
        with self.settings(DEBUG=True):
            self.assertTrue(is_safe_url('http://example.com/webhook'))

        with self.settings(DEBUG=False):
            self.assertFalse(is_safe_url('http://example.com/webhook'))

    @patch('socket.getaddrinfo')
    def test_private_ips_blocked(self, mock_getaddrinfo):
        # Mock local IP 127.0.0.1
        mock_getaddrinfo.return_value = [
            (socket.AF_INET, socket.SOCK_STREAM, 6, '', ('127.0.0.1', 80))
        ]
        with self.settings(DEBUG=True):
            self.assertFalse(is_safe_url('http://localhost/webhook'))

        # Mock private IP 10.0.0.1
        mock_getaddrinfo.return_value = [
            (socket.AF_INET, socket.SOCK_STREAM, 6, '', ('10.0.0.1', 80))
        ]
        with self.settings(DEBUG=True):
            self.assertFalse(is_safe_url('http://internal.service.local/webhook'))

        # Mock metadata IP 169.254.169.254
        mock_getaddrinfo.return_value = [
            (socket.AF_INET, socket.SOCK_STREAM, 6, '', ('169.254.169.254', 80))
        ]
        with self.settings(DEBUG=True):
            self.assertFalse(is_safe_url('http://169.254.169.254/latest/meta-data/'))

    def test_unsafe_schemes_blocked(self):
        self.assertFalse(is_safe_url('file:///etc/passwd'))
        self.assertFalse(is_safe_url('ftp://example.com/file'))
        self.assertFalse(is_safe_url('gopher://example.com'))

    @patch('socket.getaddrinfo')
    def test_unresolvable_hostname_blocked(self, mock_getaddrinfo):
        mock_getaddrinfo.side_effect = socket.gaierror
        with self.settings(DEBUG=True):
            self.assertFalse(is_safe_url('http://this-domain-does-not-exist.local/'))

    @patch('integrations.webhook_handler.requests.post')
    @patch('integrations.webhook_handler.is_safe_url')
    def test_dispatch_skips_unsafe_endpoints(self, mock_is_safe_url, mock_post):
        mock_is_safe_url.side_effect = lambda url: url == 'https://safe.example.com'

        result = WebhookHandler.dispatch(
            event_type='test.event',
            payload={},
            endpoints=['https://safe.example.com', 'http://unsafe.local'],
            dry_run=True
        )

        self.assertEqual(result['status'], 'dispatched')
        self.assertEqual(result['results']['https://safe.example.com'], 'dry_run')
        self.assertEqual(result['results']['http://unsafe.local'], 'skipped_unsafe')
        mock_post.assert_not_called()
