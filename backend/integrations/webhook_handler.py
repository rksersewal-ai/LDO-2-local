"""
Webhook Handler
Dispatches EDMS domain events to external systems via HTTP webhooks.
"""
import hashlib
import hmac
import ipaddress
import json
import logging
import os
import socket
import time
import urllib.parse
from typing import Any, Dict, List, Optional

from django.conf import settings

logger = logging.getLogger(__name__)

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

# ─── Supported event types ────────────────────────────────────────────────────
DOCUMENT_UPLOADED = "document.uploaded"
DOCUMENT_UPDATED = "document.updated"
DOCUMENT_ARCHIVED = "document.archived"
OCR_COMPLETE = "ocr.complete"
WORK_RECORD_CREATED = "work_record.created"
WORK_RECORD_APPROVED = "work_record.approved"
APPROVAL_REQUESTED = "approval.requested"


def _sign_payload(secret: str, payload: bytes) -> str:
    """HMAC-SHA256 signature for payload verification."""
    return hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()


def is_safe_url(url: str) -> bool:
    """
    Validates a URL to prevent Server-Side Request Forgery (SSRF).
    Blocks non-HTTP(S) schemes, private/internal IPs, loopback, and metadata endpoints.
    """
    try:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in ("http", "https"):
            logger.warning("Blocked webhook URL with unsafe scheme: %s", url)
            return False

        # In production (DEBUG=False), you might want to enforce HTTPS:
        if not getattr(settings, "DEBUG", True) and parsed.scheme != "https":
            logger.warning("Blocked HTTP webhook URL in production mode: %s", url)
            return False

        if not parsed.hostname:
            return False

        # Resolve hostname to IPs to check against private/internal ranges
        try:
            addrinfo = socket.getaddrinfo(parsed.hostname, None)
        except socket.gaierror:
            logger.warning("Blocked webhook URL with unresolvable hostname: %s", url)
            return False

        for info in addrinfo:
            ip_str = info[4][0]
            ip_obj = ipaddress.ip_address(ip_str)

            if (
                ip_obj.is_private
                or ip_obj.is_loopback
                or ip_obj.is_link_local
                or ip_obj.is_multicast
                or ip_obj.is_reserved
                or ip_obj.is_unspecified
            ):
                logger.warning(
                    "Blocked webhook URL resolving to unsafe IP (%s): %s", ip_str, url
                )
                return False

        return True
    except Exception as exc:
        logger.warning("Error validating webhook URL %s: %s", url, exc)
        return False


class WebhookHandler:
    """Dispatches events to registered webhook endpoints."""

    MAX_RETRIES = 3
    RETRY_DELAYS = [1, 5, 15]  # seconds

    @staticmethod
    def dispatch(
        event_type: str,
        payload: Dict[str, Any],
        endpoints: Optional[List[str]] = None,
        secret: Optional[str] = None,
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        """
        Send event to all registered endpoints.
        Returns a summary of success/failure per endpoint.
        """
        if not REQUESTS_AVAILABLE:
            logger.warning("requests library not installed — webhooks disabled")
            return {"status": "skipped", "reason": "requests not installed"}

        # Fall back to env-configured endpoints
        if endpoints is None:
            env_endpoints = os.getenv("WEBHOOK_ENDPOINTS", "")
            endpoints = [e.strip() for e in env_endpoints.split(",") if e.strip()]

        if not endpoints:
            return {"status": "skipped", "reason": "no endpoints configured"}

        body = json.dumps(
            {"event": event_type, "data": payload, "timestamp": int(time.time())},
            default=str,
        ).encode()

        headers = {
            "Content-Type": "application/json",
            "X-EDMS-Event": event_type,
        }
        if secret:
            headers["X-EDMS-Signature"] = _sign_payload(secret, body)

        results: Dict[str, Any] = {}
        for url in endpoints:
            if not is_safe_url(url):
                logger.warning("Skipping unsafe webhook endpoint: %s", url)
                results[url] = "skipped_unsafe"
                continue

            if dry_run:
                logger.info("[DRY RUN] Would POST %s to %s", event_type, url)
                results[url] = "dry_run"
                continue

            success = False
            for attempt, delay in enumerate(WebhookHandler.RETRY_DELAYS):
                try:
                    response = requests.post(
                        url, data=body, headers=headers, timeout=10, allow_redirects=False
                    )

                    if response.is_redirect:
                        logger.warning("Webhook %s → %s returned redirect (%s), which is not followed to prevent SSRF", event_type, url, response.status_code)
                        # We don't consider redirects successful to prevent SSRF bypasses

                    elif response.ok:
                        logger.info("Webhook dispatched: %s → %s [%s]", event_type, url, response.status_code)
                        success = True
                        break
                    logger.warning(
                        "Webhook %s → %s returned %s (attempt %d)",
                        event_type, url, response.status_code, attempt + 1,
                    )
                except Exception as exc:
                    logger.error(
                        "Webhook %s → %s failed (attempt %d): %s",
                        event_type, url, attempt + 1, exc,
                    )
                if attempt < len(WebhookHandler.RETRY_DELAYS) - 1:
                    time.sleep(delay)

            results[url] = "ok" if success else "failed"

        return {"status": "dispatched", "results": results}
