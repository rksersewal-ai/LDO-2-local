import os
import tempfile
import time
import json
from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import SimpleTestCase, override_settings
from django.utils import timezone
from django_celery_beat.models import PeriodicTask
from rest_framework.test import APITestCase

from documents.indexing import DocumentIndexOrchestrator
from documents.models import (
    CrawlJob,
    DocumentMetadataAssertion,
    DocumentOcrEntity,
    DuplicateDecision,
    IndexedSource,
    IndexedSourceFileState,
)
from documents.services import CrawlJobService, IndexedSourceService
from documents.tasks import run_indexed_source_crawl
from edms_api.models import (
    Approval,
    Baseline,
    BaselineItem,
    ChangeNotice,
    ChangeRequest,
    Document,
    PlDocumentLink,
    PlItem,
    OcrJob,
    SupervisorDocumentReview,
    WorkRecord,
)
from edms_api.ocr_service import OcrResult, extract_text as ocr_extract_text
from shared.models import DomainEvent, ReportJob
from shared.permissions import PermissionService
from shared.services import ReportJobService
from work.models import WorkRecordExportJob
from config_mgmt.services import BomService


class ModularApiSmokeTests(APITestCase):
    def _success_data(self, response):
        self.assertEqual(response.data["status"], "success")
        return response.data["data"]

    def _success_meta(self, response):
        self.assertEqual(response.data["status"], "success")
        return response.data.get("meta", {})

    def _create_temp_dir(self):
        temp_dir_obj = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir_obj.cleanup)
        return temp_dir_obj.name

    def setUp(self):
        self.user = User.objects.create_user(
            username="tester",
            password="pass12345",
            is_staff=True,
            is_superuser=True,
        )
        self.client.force_authenticate(self.user)
        self.pl_item = PlItem.objects.create(
            id="12345678", name="Smoke PL", description="PL for tests"
        )
        self.document = Document.objects.create(
            id="DOC-T-001",
            name="Smoke Document",
            description="Document for tests",
            type="PDF",
            status="Draft",
            file=SimpleUploadedFile("doc.txt", b"hello world"),
        )
        self.approval = Approval.objects.create(
            id="APPROVAL-001",
            entity_type="document",
            entity_id=self.document.id,
            requested_by=self.user,
        )
        self.pl_item.design_supervisor = "tester"
        self.pl_item.save(update_fields=["design_supervisor"])

    def test_login_endpoint_returns_expected_payload(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(
            "/api/v1/auth/login/",
            {"username": "tester", "password": "pass12345"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        payload = self._success_data(response)
        self.assertIn("access", payload)
        self.assertIn("refresh", payload)
        self.assertEqual(payload["user"]["username"], "tester")

    def test_versioned_and_legacy_routes_both_respond(self):
        for path in [
            "/api/v1/pl-items/",
            "/api/pl-items/",
            "/api/v1/pl-items/12345678/",
            "/api/pl-items/12345678/",
            "/api/v1/search/?q=Smoke&scope=ALL",
            "/api/search/?q=Smoke&scope=ALL",
            "/api/v1/audit/log/",
            "/api/audit/log/",
        ]:
            response = self.client.get(path)
            self.assertEqual(response.status_code, 200, path)

    def test_link_document_publishes_domain_event(self):
        response = self.client.post(
            "/api/v1/pl-items/12345678/documents/link/",
            {"document_id": self.document.id, "link_role": "GENERAL"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(
            DomainEvent.objects.filter(
                event_type="PlLinkedToDocument",
                aggregate_type="PlItem",
                aggregate_id="12345678",
            ).exists()
        )

    def test_document_ingest_endpoint_creates_real_document_and_preview_metadata(self):
        response = self.client.post(
            "/api/v1/documents/ingest/",
            {
                "file": SimpleUploadedFile(
                    "ingest-spec.txt", b"Brake rigging specification draft"
                ),
                "name": "Brake Rigging Specification",
                "category": "Specification",
                "doc_type": "Specification",
                "revision_label": "A.0",
                "linked_pl": self.pl_item.id,
                "ocr_requested": "false",
                "tags": json.dumps(["Specification", "Brake"]),
                "template_id": "TPL-001",
                "template_fields": json.dumps({"Origin": "Template"}),
            },
        )

        self.assertEqual(response.status_code, 201)
        document_id = response.data["document"]["id"]
        created = Document.objects.get(id=document_id)
        self.assertEqual(created.name, "Brake Rigging Specification")
        self.assertEqual(created.type, "Other")
        self.assertEqual(created.status, "In Review")
        self.assertEqual(created.linked_pl, self.pl_item.id)
        self.assertEqual(created.ocr_status, "Not Started")
        self.assertEqual(created.search_metadata["ingest"]["revision_label"], "A.0")
        self.assertEqual(response.data["document"]["revision_label"], "A.0")
        self.assertTrue(
            DomainEvent.objects.filter(
                event_type="DocumentRegistered",
                aggregate_type="Document",
                aggregate_id=document_id,
            ).exists()
        )

    def test_ocr_job_processes_text_document_and_persists_entities(self):
        document = Document.objects.create(
            id="DOC-OCR-001",
            name="OCR Plaintext Input",
            description="Contains business identifiers",
            type="Other",
            status="Draft",
            category="Specification",
            linked_pl=self.pl_item.id,
            file=SimpleUploadedFile(
                "ocr-source.txt",
                b"Invoice INV-2026-0042 for loco WAG9-30245 linked to PL 12345678 and drawing DWG-AXLE-778.",
            ),
        )

        response = self.client.post(
            "/api/v1/ocr/jobs/",
            {"document_id": document.id},
            format="json",
        )
        self.assertIn(response.status_code, {200, 201})

        job = OcrJob.objects.get(document=document)
        result_response = self.client.get(f"/api/v1/ocr/results/{document.id}/")
        self.assertEqual(result_response.status_code, 200)

        job.refresh_from_db()
        document.refresh_from_db()
        self.assertEqual(job.status, "Completed")
        self.assertEqual(document.ocr_status, "Completed")
        self.assertIn("INV-2026-0042", document.extracted_text)
        self.assertEqual(document.ocr_pages.count(), 1)
        self.assertGreaterEqual(document.ocr_entities.count(), 4)
        self.assertEqual(result_response.data["page_count"], 1)
        self.assertGreaterEqual(result_response.data["entity_count"], 4)
        self.assertEqual(result_response.data["engine"], "plaintext")
        self.assertTrue(
            DomainEvent.objects.filter(
                event_type="OcrJobCompleted",
                aggregate_type="OcrJob",
                aggregate_id=str(job.id),
            ).exists()
        )

    def test_uploading_new_document_version_rebuilds_ocr_output(self):
        document = Document.objects.create(
            id="DOC-OCR-002",
            name="Versioned OCR Document",
            description="Original OCR content",
            type="Other",
            status="Draft",
            category="Specification",
            linked_pl=self.pl_item.id,
            file=SimpleUploadedFile(
                "version-1.txt", b"Invoice INV-2026-0001 linked to PL 12345678"
            ),
        )

        first_job_response = self.client.post(
            "/api/v1/ocr/jobs/", {"document_id": document.id}, format="json"
        )
        self.assertIn(first_job_response.status_code, {200, 201})
        document.refresh_from_db()
        self.assertIn("INV-2026-0001", document.extracted_text)

        version_response = self.client.post(
            f"/api/v1/documents/{document.id}/versions/",
            {
                "file": SimpleUploadedFile(
                    "version-2.txt",
                    b"Invoice INV-2026-0002 linked to drawing DWG-AXLE-999",
                )
            },
        )
        self.assertEqual(version_response.status_code, 201)

        document.refresh_from_db()
        self.assertEqual(document.revision, 2)
        self.assertEqual(document.ocr_status, "Completed")
        self.assertIn("INV-2026-0002", document.extracted_text)
        self.assertNotIn("INV-2026-0001", document.extracted_text)
        self.assertTrue(
            document.ocr_entities.filter(entity_value="INV-2026-0002").exists()
        )
        self.assertTrue(
            DomainEvent.objects.filter(
                event_type="OcrJobQueued",
                aggregate_type="OcrJob",
            ).exists()
        )

    @patch("documents.tasks.index_single_document.delay")
    @patch("documents.indexing.DocumentIndexOrchestrator.index_document")
    def test_uploading_new_document_version_indexing_fallback(
        self, mock_index_document, mock_delay
    ):
        document = Document.objects.create(
            id="DOC-FALLBACK-001",
            name="Version Fallback Document",
            description="Test fallback on exception",
            type="Other",
            status="Draft",
            category="Specification",
            linked_pl=self.pl_item.id,
            file=SimpleUploadedFile("version-1.txt", b"Initial version content"),
        )

        mock_delay.side_effect = Exception("Celery is down")

        version_response = self.client.post(
            f"/api/v1/documents/{document.id}/versions/",
            {"file": SimpleUploadedFile("version-2.txt", b"New version content")},
        )
        self.assertEqual(version_response.status_code, 201)

        document.refresh_from_db()
        self.assertEqual(document.revision, 2)

        mock_delay.assert_called_once_with(str(document.id))
        mock_index_document.assert_any_call(document, force_hashes=True)

    def test_create_work_record_and_export_job(self):
        response = self.client.post(
            "/api/v1/work-records/",
            {
                "date": "2026-03-20",
                "closingDate": "2026-03-22",
                "workCategory": "DRAWING",
                "workType": "Drawing Amendment",
                "description": "Updated a drawing package",
                "eOfficeNumber": "CLW/TEST/2026/0001",
                "plNumber": "12345678",
                "status": "SUBMITTED",
                "targetDays": 5,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(WorkRecord.objects.count(), 1)
        self.assertTrue(
            DomainEvent.objects.filter(
                event_type="WorkRecordLogged",
                aggregate_type="WorkRecord",
            ).exists()
        )

        export_response = self.client.post(
            "/api/v1/work-records/export-jobs/",
            {"format": "xlsx", "filters": {"status": "OPEN"}},
            format="json",
        )
        self.assertEqual(export_response.status_code, 202)
        self.assertEqual(WorkRecordExportJob.objects.count(), 1)

    def test_report_job_create_list_detail_and_retry(self):
        create_response = self.client.post(
            "/api/v1/report-jobs/",
            {
                "report_type": "document-status-summary",
                "format": "xlsx",
                "filters": {"date_from": "2026-03-01", "date_to": "2026-03-31"},
                "parameters": {"scope": "documents"},
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, 202)
        create_payload = self._success_data(create_response)
        job_id = create_payload["id"]
        self.assertEqual(create_payload["status"], "QUEUED")
        self.assertTrue(
            DomainEvent.objects.filter(
                event_type="ReportJobQueued",
                aggregate_type="ReportJob",
                aggregate_id=str(job_id),
            ).exists()
        )

        list_response = self.client.get(
            "/api/v1/report-jobs/?status=QUEUED&report_type=document-status-summary&export_format=xlsx"
        )
        self.assertEqual(list_response.status_code, 200)
        list_payload = self._success_data(list_response)
        list_meta = self._success_meta(list_response)
        self.assertEqual(list_meta["total"], 1)
        self.assertEqual(list_payload["results"][0]["id"], str(job_id))
        self.assertFalse(list_payload["results"][0]["download_ready"])
        self.assertFalse(list_payload["results"][0]["can_retry"])

        detail_response = self.client.get(f"/api/v1/report-jobs/{job_id}/")
        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(
            self._success_data(detail_response)["report_type"],
            "document-status-summary",
        )

        job = ReportJob.objects.get(pk=job_id)
        ReportJobService.mark_failed(
            job, error_message="Synthetic worker failure for retry test"
        )
        retry_response = self.client.post(
            f"/api/v1/report-jobs/{job_id}/retry/", format="json"
        )
        self.assertEqual(retry_response.status_code, 202)
        self.assertEqual(self._success_data(retry_response)["status"], "QUEUED")
        self.assertTrue(
            DomainEvent.objects.filter(
                event_type="ReportJobRetried",
                aggregate_type="ReportJob",
                aggregate_id=str(job_id),
            ).exists()
        )

    def test_report_job_scope_is_limited_for_non_admin_users(self):
        regular_user = User.objects.create_user(
            username="report-user", password="pass12345"
        )
        another_user = User.objects.create_user(
            username="other-report-user", password="pass12345"
        )
        own_job = ReportJobService.create(
            report_type="ocr-processing-report", export_format="csv", user=regular_user
        )
        other_job = ReportJobService.create(
            report_type="approval-cycle-time-analysis",
            export_format="xlsx",
            user=another_user,
        )

        self.client.force_authenticate(regular_user)
        list_response = self.client.get("/api/v1/report-jobs/")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(self._success_meta(list_response)["total"], 1)
        self.assertEqual(
            self._success_data(list_response)["results"][0]["id"], str(own_job.id)
        )

        detail_response = self.client.get(f"/api/v1/report-jobs/{other_job.id}/")
        self.assertEqual(detail_response.status_code, 404)

    def test_approval_action_publishes_domain_event(self):
        response = self.client.post(
            "/api/v1/approvals/APPROVAL-001/approve/",
            {"comment": "Approved in test"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.approval.refresh_from_db()
        self.assertEqual(self.approval.status, "Approved")
        self.assertTrue(
            DomainEvent.objects.filter(
                event_type="ApprovalGranted",
                aggregate_type="Approval",
                aggregate_id="APPROVAL-001",
            ).exists()
        )

    def test_inbox_items_include_preview_document_metadata_for_actionable_records(self):
        PlDocumentLink.objects.create(
            pl_item=self.pl_item, document=self.document, link_role="GENERAL"
        )

        change_request = ChangeRequest.objects.create(
            pl_item=self.pl_item,
            title="Review brake drawing update",
            requested_by=self.user,
        )
        change_request.submit()
        change_request.save()

        change_notice = ChangeNotice.objects.create(
            change_request=change_request,
            notice_number="CN-0001",
            title="Brake drawing notice",
            issued_by=self.user,
        )
        change_notice.issue()
        change_notice.save()

        DuplicateDecision.objects.create(
            group_key="G-0001",
            decision="MERGE",
            master_document=self.document,
            candidate_documents=[self.document.id],
            candidate_count=1,
            decided_by=self.user,
            decided_at=timezone.now(),
        )

        response = self.client.get("/api/v1/inbox/")
        self.assertEqual(response.status_code, 200)

        items = self._success_data(response)["items"]
        approval_item = next(item for item in items if item["type"] == "approval")
        change_request_item = next(
            item for item in items if item["type"] == "change_request"
        )
        change_notice_item = next(
            item for item in items if item["type"] == "change_notice"
        )
        dedup_item = next(item for item in items if item["type"] == "dedup_review")

        self.assertEqual(
            approval_item["payload"]["preview_document_id"], self.document.id
        )
        self.assertEqual(
            change_request_item["payload"]["preview_document_id"], self.document.id
        )
        self.assertEqual(
            change_notice_item["payload"]["preview_document_id"], self.document.id
        )
        self.assertEqual(dedup_item["payload"]["preview_document_id"], self.document.id)

    def _setup_supervisor_review(
        self, old_id, new_id, name, old_filename, new_filename, old_content, new_content
    ):
        previous = Document.objects.create(
            id=old_id,
            name=name,
            description="Older revision",
            type="PDF",
            status="Approved",
            revision=1,
            category="Drawing",
            linked_pl=self.pl_item.id,
            file=SimpleUploadedFile(old_filename, old_content),
        )
        PlDocumentLink.objects.create(
            pl_item=self.pl_item, document=previous, link_role="GENERAL"
        )

        latest = Document.objects.create(
            id=new_id,
            name=name,
            description="Latest revision",
            type="PDF",
            status="In Review",
            revision=2,
            category="Drawing",
            linked_pl=self.pl_item.id,
            file=SimpleUploadedFile(new_filename, new_content),
        )

        response = self.client.post(
            f"/api/v1/pl-items/{self.pl_item.id}/documents/link/",
            {"document_id": latest.id, "link_role": "GENERAL"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)

        review = SupervisorDocumentReview.objects.get(
            pl_item=self.pl_item, latest_document=latest, status="PENDING"
        )
        return previous, latest, review

    def test_supervisor_document_review_created_and_approved(self):
        previous, latest, review = self._setup_supervisor_review(
            "DOC-T-OLD",
            "DOC-T-NEW",
            "Brake Drawing Pack",
            "old.txt",
            "new.txt",
            b"old",
            b"new",
        )

        list_response = self.client.get("/api/v1/supervisor-document-reviews/")
        self.assertEqual(list_response.status_code, 200)
        payload = list_response.data
        if isinstance(payload, list):
            self.assertEqual(len(payload), 1)
        else:
            results = payload.get("results", [])
            self.assertEqual(payload.get("count", len(results)), 1)
            self.assertEqual(len(results), 1)

        approve_response = self.client.post(
            f"/api/v1/supervisor-document-reviews/{review.id}/approve/",
            {"notes": "Revision accepted"},
            format="json",
        )
        self.assertEqual(approve_response.status_code, 200)

        review.refresh_from_db()
        previous.refresh_from_db()
        self.assertEqual(review.status, "APPROVED")
        self.assertEqual(previous.status, "Obsolete")
        self.assertTrue(
            DomainEvent.objects.filter(
                event_type="DesignSupervisorApprovedDocumentChange",
                aggregate_type="SupervisorDocumentReview",
                aggregate_id=str(review.id),
            ).exists()
        )

    def test_supervisor_document_review_can_be_bypassed(self):
        previous, latest, review = self._setup_supervisor_review(
            "DOC-T-OL2",
            "DOC-T-NE2",
            "Cooling Layout Sheet",
            "old2.txt",
            "new2.txt",
            b"old2",
            b"new2",
        )

        bypass_response = self.client.post(
            f"/api/v1/supervisor-document-reviews/{review.id}/bypass/",
            {"bypass_reason": "Temporary hold requested by design office"},
            format="json",
        )
        self.assertEqual(bypass_response.status_code, 200)

        review.refresh_from_db()
        self.assertEqual(review.status, "BYPASSED")
        self.assertEqual(
            review.bypass_reason, "Temporary hold requested by design office"
        )
        self.assertTrue(
            DomainEvent.objects.filter(
                event_type="DesignSupervisorBypassedDocumentChange",
                aggregate_type="SupervisorDocumentReview",
                aggregate_id=str(review.id),
            ).exists()
        )

    def test_document_search_auto_indexes_local_metadata_patterns(self):
        document = Document.objects.create(
            id="DOC-T-SRCH",
            name="Invoice INV-2026-0042 for WAG9-30245",
            description="Routing package for loco WAG9-30245 and PL 12345678",
            type="PDF",
            status="Approved",
            category="Vendor Docs",
            linked_pl="12345678",
            extracted_text="Invoice INV-2026-0042 references DWG-AXLE-778 and CLW/MECH/2026/0042.",
            file=SimpleUploadedFile("search.txt", b"searchable payload"),
        )

        document.refresh_from_db()
        patterns = document.search_metadata.get("patterns", {})
        self.assertIn("INV-2026-0042", patterns.get("invoice_numbers", []))
        self.assertIn("WAG9-30245", patterns.get("loco_numbers", []))
        self.assertIn("12345678", patterns.get("pl_numbers", []))
        self.assertIn("DWG-AXLE-778", patterns.get("drawing_numbers", []))

        response = self.client.get("/api/v1/search/?q=WAG9-30245&scope=DOCUMENTS")
        self.assertEqual(response.status_code, 200)
        documents = self._success_data(response)["documents"]
        self.assertTrue(any(result["id"] == document.id for result in documents))

    def test_shared_folder_indexing_marks_older_duplicate_and_search_filters_it(self):
        temp_dir = self._create_temp_dir()
        older_path = os.path.join(temp_dir, "shared_duplicate_older.pdf")
        newer_path = os.path.join(temp_dir, "shared_duplicate_newer.pdf")
        payload = b"duplicate payload for network share indexing"

        with open(older_path, "wb") as handle:
            handle.write(payload)
        with open(newer_path, "wb") as handle:
            handle.write(payload)

        now = time.time()
        os.utime(older_path, (now - 7200, now - 7200))
        os.utime(newer_path, (now, now))

        call_command("index_shared_documents", temp_dir)

        older_document = Document.objects.get(external_file_path=older_path)
        newer_document = Document.objects.get(external_file_path=newer_path)

        older_document.refresh_from_db()
        newer_document.refresh_from_db()

        self.assertEqual(newer_document.source_system, "NETWORK_SHARE")
        self.assertTrue(newer_document.fingerprint_3x64k)
        self.assertEqual(newer_document.duplicate_status, "MASTER")
        self.assertEqual(older_document.duplicate_status, "DUPLICATE")
        self.assertEqual(older_document.duplicate_of_id, newer_document.id)

        include_response = self.client.get(
            "/api/v1/search/?q=shared_duplicate&scope=DOCUMENTS&duplicates=include"
        )
        self.assertEqual(include_response.status_code, 200)
        include_docs = [doc for doc in self._success_data(include_response)["documents"] if doc["name"].startswith("shared_duplicate")]
        self.assertEqual(len(include_docs), 2)

        exclude_response = self.client.get(
            "/api/v1/search/?q=shared_duplicate&scope=DOCUMENTS&duplicates=exclude"
        )
        self.assertEqual(exclude_response.status_code, 200)
        exclude_documents = self._success_data(exclude_response)["documents"]
        exclude_docs = [doc for doc in exclude_documents if doc["name"].startswith("shared_duplicate")]
        self.assertEqual(len(exclude_docs), 1)
        self.assertEqual(exclude_documents[0]["id"], newer_document.id)

        only_response = self.client.get(
            "/api/v1/search/?q=shared_duplicate&scope=DOCUMENTS&duplicates=only"
        )
        self.assertEqual(only_response.status_code, 200)
        only_documents = self._success_data(only_response)["documents"]
        self.assertEqual(len(only_documents), 1)
        self.assertEqual(only_documents[0]["id"], older_document.id)

    def test_document_search_backend_applies_status_and_date_filters(self):
        old_document = Document.objects.create(
            id="DOC-T-OLD",
            name="Status Filter Drawing",
            description="Approved legacy drawing package",
            type="PDF",
            status="Approved",
            category="Drawing",
            file=SimpleUploadedFile("old.txt", b"old payload"),
        )
        recent_document = Document.objects.create(
            id="DOC-T-NEW",
            name="Status Filter Drawing",
            description="Obsolete recent drawing package",
            type="PDF",
            status="Obsolete",
            category="Drawing",
            file=SimpleUploadedFile("recent.txt", b"recent payload"),
        )
        stale_timestamp = timezone.now() - timedelta(days=45)
        Document.objects.filter(pk=old_document.pk).update(
            updated_at=stale_timestamp, created_at=stale_timestamp
        )

        approved_response = self.client.get(
            "/api/v1/search/?q=Status%20Filter&scope=DOCUMENTS&status=Approved"
        )
        self.assertEqual(approved_response.status_code, 200)
        approved_documents = self._success_data(approved_response)["documents"]
        self.assertEqual([item["id"] for item in approved_documents], [old_document.id])

        recent_response = self.client.get(
            "/api/v1/search/?q=Status%20Filter&scope=DOCUMENTS&date_range=30d"
        )
        self.assertEqual(recent_response.status_code, 200)
        recent_documents = self._success_data(recent_response)["documents"]
        # Only check if recent_document is present, as other tests might create documents matching the date range
        recent_ids = [item["id"] for item in recent_documents]
        self.assertIn(recent_document.id, recent_ids)
        self.assertNotIn(old_document.id, recent_ids)

    def test_document_search_ranks_master_ahead_of_duplicate_for_same_query(self):
        temp_dir = self._create_temp_dir()
        older_path = os.path.join(temp_dir, "ranking_duplicate_older.pdf")
        newer_path = os.path.join(temp_dir, "ranking_duplicate_newer.pdf")
        payload = b"ranking duplicate payload"

        with open(older_path, "wb") as handle:
            handle.write(payload)
        with open(newer_path, "wb") as handle:
            handle.write(payload)

        now = time.time()
        os.utime(older_path, (now - 7200, now - 7200))
        os.utime(newer_path, (now, now))

        call_command("index_shared_documents", temp_dir)

        response = self.client.get(
            "/api/v1/search/?q=ranking_duplicate&scope=DOCUMENTS&duplicates=include"
        )
        self.assertEqual(response.status_code, 200)
        documents = self._success_data(response)["documents"]

        ranking_docs = [doc for doc in documents if doc["name"].startswith("ranking_duplicate")]
        self.assertEqual(len(ranking_docs), 2)
        self.assertEqual(ranking_docs[0]["duplicate_status"], "MASTER")
        self.assertEqual(ranking_docs[1]["duplicate_status"], "DUPLICATE")

    def test_reindex_creates_governed_entities_and_assertions(self):
        document = Document.objects.create(
            id="DOC-META-001",
            name="DWG-AXLE-990 master package for PL 12345678",
            description="Drawing package linked to PL 12345678",
            type="PDF",
            status="Draft",
            category="Drawing",
            linked_pl="12345678",
            file=SimpleUploadedFile("meta.txt", b"metadata payload"),
        )

        indexed = DocumentIndexOrchestrator.index_document(document, force_hashes=False)

        entities = DocumentOcrEntity.objects.filter(
            document=indexed, source_engine="regex-indexer"
        )
        assertions = DocumentMetadataAssertion.objects.filter(
            document=indexed, source="machine"
        )

        self.assertTrue(
            entities.filter(
                entity_type="PL_NUMBER", normalized_value="12345678"
            ).exists()
        )
        self.assertTrue(entities.filter(entity_type="DRAWING_NUMBER").exists())
        self.assertTrue(
            assertions.filter(
                field_key="linked_pl", normalized_value="12345678"
            ).exists()
        )
        self.assertTrue(assertions.filter(field_key="drawing_number").exists())

        entities_response = self.client.get(
            f"/api/v1/documents/{document.id}/entities/"
        )
        self.assertEqual(entities_response.status_code, 200)
        self.assertGreaterEqual(len(entities_response.data), 2)

    def test_approved_assertion_contributes_to_search_match_context(self):
        document = Document.objects.create(
            id="DOC-META-002",
            name="Loose upload package",
            description="Unstructured document",
            type="PDF",
            status="Draft",
            category="Specification",
            file=SimpleUploadedFile("search-meta.txt", b"search metadata payload"),
        )
        assertion = DocumentMetadataAssertion.objects.create(
            document=document,
            field_key="drawing_number",
            value="DRG-SEARCH-123",
            normalized_value="DRG-SEARCH-123",
            source="manual",
            status="APPROVED",
            approved_by=self.user,
            approved_at=timezone.now(),
        )

        DocumentIndexOrchestrator.index_document(document, force_hashes=False)

        response = self.client.get("/api/v1/search/?q=DRG-SEARCH-123&scope=DOCUMENTS")
        self.assertEqual(response.status_code, 200)
        documents = self._success_data(response)["documents"]
        self.assertEqual(documents[0]["id"], document.id)
        self.assertIn("approved_assertion", documents[0]["match_reasons"])
        self.assertEqual(
            documents[0]["matched_assertions"][0]["field_key"], assertion.field_key
        )

    def test_family_key_keeps_same_hash_different_drawings_out_of_duplicate_state(self):
        temp_dir = self._create_temp_dir()
        first_path = os.path.join(temp_dir, "DWG-AXLE-778.pdf")
        second_path = os.path.join(temp_dir, "DWG-BOGIE-991.pdf")
        payload = b"same-content-different-families"

        with open(first_path, "wb") as handle:
            handle.write(payload)
        with open(second_path, "wb") as handle:
            handle.write(payload)

        call_command("index_shared_documents", temp_dir)

        first_document = Document.objects.get(external_file_path=first_path)
        second_document = Document.objects.get(external_file_path=second_path)

        self.assertEqual(first_document.duplicate_status, "UNIQUE")
        self.assertEqual(second_document.duplicate_status, "UNIQUE")
        self.assertNotEqual(
            first_document.document_family_key, second_document.document_family_key
        )
        self.assertTrue(
            first_document.document_family_key.startswith("drawing_numbers:")
        )
        self.assertTrue(
            second_document.document_family_key.startswith("drawing_numbers:")
        )

        dedup_response = self.client.get("/api/v1/deduplication/groups/")
        self.assertEqual(dedup_response.status_code, 200)
        self.assertEqual(len(dedup_response.data), 0)

    def test_family_key_stays_stable_across_drawing_revision_variants(self):
        temp_dir = self._create_temp_dir()
        older_path = os.path.join(temp_dir, "DWG-AXLE-778_revA.pdf")
        newer_path = os.path.join(temp_dir, "DWG-AXLE-778_revB.pdf")
        payload = b"same-content-same-family"

        with open(older_path, "wb") as handle:
            handle.write(payload)
        with open(newer_path, "wb") as handle:
            handle.write(payload)

        now = time.time()
        os.utime(older_path, (now - 7200, now - 7200))
        os.utime(newer_path, (now, now))

        call_command("index_shared_documents", temp_dir)

        older_document = Document.objects.get(external_file_path=older_path)
        newer_document = Document.objects.get(external_file_path=newer_path)

        self.assertEqual(
            older_document.document_family_key, newer_document.document_family_key
        )
        self.assertEqual(newer_document.duplicate_status, "MASTER")
        self.assertEqual(older_document.duplicate_status, "DUPLICATE")
        self.assertEqual(older_document.duplicate_of_id, newer_document.id)

    def test_change_request_release_creates_baseline_and_links_current_release(self):
        create_response = self.client.post(
            "/api/v1/change-requests/",
            {
                "pl_item": self.pl_item.id,
                "title": "Add baseline for brake assembly",
                "description": "Initial change package for PL release",
                "impact_summary": "Release the first controlled baseline.",
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)
        change_request_id = create_response.data["id"]

        submit_response = self.client.post(
            f"/api/v1/change-requests/{change_request_id}/submit/", {}, format="json"
        )
        self.assertEqual(submit_response.status_code, 200)
        approve_response = self.client.post(
            f"/api/v1/change-requests/{change_request_id}/approve/",
            {"notes": "Approved"},
            format="json",
        )
        self.assertEqual(approve_response.status_code, 200)

        release_response = self.client.post(
            f"/api/v1/pl-items/{self.pl_item.id}/baselines/release/",
            {
                "title": "Brake assembly release",
                "summary": "Controlled baseline release for test",
                "change_request": change_request_id,
            },
            format="json",
        )
        self.assertEqual(release_response.status_code, 201)
        self.assertTrue(
            Baseline.objects.filter(pl_item=self.pl_item, status="RELEASED").exists()
        )
        baseline = Baseline.objects.get(pl_item=self.pl_item, status="RELEASED")
        self.pl_item.refresh_from_db()
        self.assertEqual(self.pl_item.current_released_baseline_id, baseline.id)
        self.assertTrue(BaselineItem.objects.filter(baseline=baseline).exists())

    def test_indexed_source_schedule_uses_queue_task_and_disables_when_inactive(self):
        temp_dir = self._create_temp_dir()
        source = IndexedSource.objects.create(
            name="Schedule Source",
            root_path=temp_dir,
            is_active=True,
            watch_enabled=False,
            scan_interval_minutes=15,
        )
        schedule_name = f"edms:crawl-source:{source.id}"
        task = PeriodicTask.objects.get(name=schedule_name)
        self.assertEqual(task.task, "documents.tasks.queue_indexed_source_crawl")
        self.assertTrue(task.enabled)

        source.is_active = False
        source.save(update_fields=["is_active"])
        task.refresh_from_db()
        self.assertFalse(task.enabled)

    def test_run_indexed_source_crawl_accepts_source_id(self):
        temp_dir = self._create_temp_dir()
        shared_file = os.path.join(temp_dir, "index-me.pdf")
        with open(shared_file, "wb") as handle:
            handle.write(b"network share payload")

        source = IndexedSource.objects.create(
            name="Indexed Share",
            root_path=temp_dir,
            is_active=True,
            watch_enabled=True,
            scan_interval_minutes=10,
        )

        run_indexed_source_crawl(str(source.id))

        job = CrawlJob.objects.get(source=source)
        self.assertEqual(job.status, "COMPLETED")
        self.assertEqual(job.indexed_count, 1)

    def test_indexed_source_file_state_tracks_missing_files(self):
        temp_dir = self._create_temp_dir()
        shared_file = os.path.join(temp_dir, "tracked.pdf")
        with open(shared_file, "wb") as handle:
            handle.write(b"tracked payload")

        source = IndexedSource.objects.create(
            name="Tracked Share",
            root_path=temp_dir,
            is_active=True,
            watch_enabled=False,
        )

        initial_job = CrawlJobService.create_job(source)
        CrawlJobService.run_job(initial_job)

        state = IndexedSourceFileState.objects.get(source=source)
        self.assertEqual(state.status, "ACTIVE")
        self.assertTrue(state.document_id)

        os.remove(shared_file)

        followup_job = CrawlJobService.create_job(source)
        CrawlJobService.run_job(followup_job)

        state.refresh_from_db()
        self.assertEqual(state.status, "MISSING")
        self.assertIsNotNone(state.missing_since)

        document = Document.objects.get(pk=state.document_id)
        source_index = document.search_metadata.get("source_index", {})
        self.assertEqual(source_index.get("source_state"), "MISSING")
        self.assertEqual(source_index.get("relative_path"), "tracked.pdf")

    def test_indexed_source_file_state_tracks_failures_per_file(self):
        temp_dir = self._create_temp_dir()
        shared_file = os.path.join(temp_dir, "broken.pdf")
        with open(shared_file, "wb") as handle:
            handle.write(b"broken payload")

        source = IndexedSource.objects.create(
            name="Broken Share",
            root_path=temp_dir,
            is_active=True,
            watch_enabled=False,
        )

        with patch(
            "documents.services._DocumentIndexingBatchService.index_paths_bulk",
            side_effect=RuntimeError("boom_bulk"),
        ):
            with patch(
                "documents.services._DocumentIndexingBatchService.index_path",
                side_effect=RuntimeError("boom"),
            ):
                job = CrawlJobService.create_job(source)
                CrawlJobService.run_job(job)

        state = IndexedSourceFileState.objects.get(
            source=source, relative_path="broken.pdf"
        )
        self.assertEqual(state.status, "FAILED")
        self.assertEqual(state.failure_count, 1)
        self.assertEqual(state.last_error, "boom")

        job = CrawlJob.objects.get(pk=job.pk)
        self.assertEqual(job.status, "FAILED")
        self.assertEqual(job.failed_count, 1)

    def test_indexed_source_move_relinks_existing_document_state(self):
        temp_dir = self._create_temp_dir()
        original_path = os.path.join(temp_dir, "original.pdf")
        moved_path = os.path.join(temp_dir, "renamed.pdf")
        with open(original_path, "wb") as handle:
            handle.write(b"renamed payload")

        source = IndexedSource.objects.create(
            name="Move Share",
            root_path=temp_dir,
            is_active=True,
            watch_enabled=True,
        )

        initial_job = CrawlJobService.create_job(source)
        CrawlJobService.run_job(initial_job)

        state = IndexedSourceFileState.objects.get(
            source=source, relative_path="original.pdf"
        )
        document = Document.objects.get(pk=state.document_id)
        original_document_id = document.id

        os.rename(original_path, moved_path)

        move_parameters = {
            "trigger": "moved",
            "paths": [moved_path],
            "old_path": original_path,
            "new_path": moved_path,
        }
        move_job = CrawlJobService.create_job(source, parameters=move_parameters)
        CrawlJobService.run_job(move_job)

        state.refresh_from_db()
        document.refresh_from_db()

        self.assertEqual(state.relative_path, "renamed.pdf")
        self.assertEqual(state.status, "ACTIVE")
        self.assertEqual(str(document.id), str(original_document_id))
        self.assertEqual(document.external_file_path, moved_path)
        self.assertEqual(
            Document.objects.filter(indexed_source_states__source=source)
            .distinct()
            .count(),
            1,
        )
        source_index = document.search_metadata.get("source_index", {})
        self.assertEqual(source_index.get("relative_path"), "renamed.pdf")
        self.assertEqual(source_index.get("source_state"), "ACTIVE")

    @override_settings(
        EDMS_HASH_BACKFILL_INTERVAL_MINUTES=30,
        EDMS_HASH_BACKFILL_BATCH_SIZE=123,
        EDMS_HASH_BACKFILL_FORCE_FULL_HASH=True,
    )
    def test_hash_backfill_schedule_uses_runtime_settings(self):
        IndexedSourceService.ensure_hash_backfill_schedule()
        task = PeriodicTask.objects.get(
            name=IndexedSourceService.HASH_BACKFILL_SCHEDULE_NAME
        )
        self.assertEqual(task.task, "documents.tasks.queue_hash_backfill_job")
        self.assertTrue(task.enabled)
        payload = json.loads(task.kwargs)
        self.assertEqual(payload["batch_size"], 123)
        self.assertTrue(payload["force_full_hash"])

    def test_bom_service_update_raises_validation_error_on_save(self):
        serializer = MagicMock()
        serializer.instance.parent = self.pl_item
        serializer.save.side_effect = DjangoValidationError(
            {"field": ["Invalid value"]}
        )

        request = MagicMock()
        request.user = self.user
        request.META = {}

        with self.assertRaises(ValidationError):
            BomService.update(serializer, request)

    def test_bom_tree_max_depth_validation(self):
        invalid_response = self.client.get(
            f"/api/v1/pl-items/{self.pl_item.id}/bom-tree/?max_depth=invalid"
        )
        self.assertEqual(invalid_response.status_code, 400)
        self.assertEqual(
            invalid_response.data["detail"], "max_depth must be an integer"
        )

        valid_response = self.client.get(
            f"/api/v1/pl-items/{self.pl_item.id}/bom-tree/?max_depth=10"
        )
        self.assertEqual(valid_response.status_code, 200)

    def test_bom_compare_reports_added_line_between_baselines(self):
        child = PlItem.objects.create(
            id="87654321", name="Child PL", description="Child item"
        )
        add_response = self.client.post(
            f"/api/v1/pl-items/{self.pl_item.id}/bom/lines/",
            {
                "parent": self.pl_item.id,
                "child": child.id,
                "find_number": "10",
                "line_order": 0,
                "quantity": "1",
                "unit_of_measure": "EA",
            },
            format="json",
        )
        self.assertEqual(add_response.status_code, 201)

        baseline_one = self.client.post(
            f"/api/v1/pl-items/{self.pl_item.id}/baselines/release/",
            {"title": "Baseline 1"},
            format="json",
        )
        self.assertEqual(baseline_one.status_code, 201)

        extra_child = PlItem.objects.create(
            id="87654322", name="Extra Child PL", description="Second child item"
        )
        self.client.post(
            f"/api/v1/pl-items/{self.pl_item.id}/bom/lines/",
            {
                "parent": self.pl_item.id,
                "child": extra_child.id,
                "find_number": "20",
                "line_order": 1,
                "quantity": "2",
                "unit_of_measure": "EA",
            },
            format="json",
        )

        baseline_two = self.client.post(
            f"/api/v1/pl-items/{self.pl_item.id}/baselines/release/",
            {"title": "Baseline 2"},
            format="json",
        )
        self.assertEqual(baseline_two.status_code, 201)

        compare_response = self.client.get(
            f"/api/v1/baselines/compare/?left={baseline_one.data['id']}&right={baseline_two.data['id']}"
        )
        self.assertEqual(compare_response.status_code, 200)
        self.assertGreaterEqual(compare_response.data["summary"]["added"], 1)

    def test_object_permission_backfill_command_grants_legacy_access(self):
        legacy_user = User.objects.create_user(
            username="legacy-user",
            password="pass12345",
            first_name="Legacy",
            last_name="Owner",
        )
        legacy_doc = Document.objects.create(
            id="DOC-LEGACY-001",
            name="Legacy Drawing",
            description="Document created before guardian grants existed",
            type="PDF",
            status="Approved",
            author=legacy_user,
            file=SimpleUploadedFile("legacy.txt", b"legacy"),
        )
        legacy_work = WorkRecord.objects.create(
            id="WORK-LEGACY-001",
            description="Legacy work item",
            work_category="DRAWING",
            work_type="Legacy Update",
            status="OPEN",
            date="2026-03-20",
            user_name=legacy_user,
        )
        legacy_pl = PlItem.objects.create(
            id="23456789",
            name="Legacy PL",
            description="Legacy PL item",
            design_supervisor="legacy-user",
        )

        self.assertFalse(
            PermissionService.scope_queryset(
                Document.objects.all(), legacy_user, "view_document"
            )
            .filter(pk=legacy_doc.pk)
            .exists()
        )
        self.assertFalse(
            PermissionService.scope_queryset(
                WorkRecord.objects.all(), legacy_user, "view_workrecord"
            )
            .filter(pk=legacy_work.pk)
            .exists()
        )
        self.assertFalse(
            PermissionService.scope_queryset(
                PlItem.objects.all(), legacy_user, "view_plitem"
            )
            .filter(pk=legacy_pl.pk)
            .exists()
        )

        call_command("backfill_object_permissions")

        self.assertTrue(
            PermissionService.scope_queryset(
                Document.objects.all(), legacy_user, "view_document"
            )
            .filter(pk=legacy_doc.pk)
            .exists()
        )
        self.assertTrue(
            PermissionService.scope_queryset(
                WorkRecord.objects.all(), legacy_user, "view_workrecord"
            )
            .filter(pk=legacy_work.pk)
            .exists()
        )
        self.assertTrue(
            PermissionService.scope_queryset(
                PlItem.objects.all(), legacy_user, "view_plitem"
            )
            .filter(pk=legacy_pl.pk)
            .exists()
        )

    def test_crawl_job_handles_exception_during_run(self):
        source = IndexedSource.objects.create(
            name="Test Exception Source",
            root_path="/tmp",
            is_active=True,
            watch_enabled=False,
        )
        job = CrawlJobService.create_job(source)

        with patch("documents.services.Path.rglob") as mock_rglob:
            mock_rglob.side_effect = Exception("Test crawl failure")

            with self.assertRaises(Exception) as context:
                CrawlJobService.run_job(job)

            self.assertEqual(str(context.exception), "Test crawl failure")

        self.assertEqual(job.status, "FAILED")
        self.assertEqual(job.error_message, "Test crawl failure")

    def test_hash_backfill_job_handles_exception_during_run(self):
        from documents.services import HashBackfillJobService

        source = IndexedSource.objects.create(
            name="Test Backfill Source",
            root_path="/tmp",
            is_active=True,
            watch_enabled=False,
        )
        job = HashBackfillJobService.create_job(source=source)

        with patch("documents.services.Document.objects.filter") as mock_filter:
            mock_filter.side_effect = Exception("Test backfill failure")

            with self.assertRaises(Exception) as context:
                HashBackfillJobService.run_job(job)

            self.assertEqual(str(context.exception), "Test backfill failure")

        self.assertEqual(job.status, "FAILED")
        self.assertEqual(job.error_message, "Test backfill failure")

    def test_document_admin_views_are_guardian_scoped_for_regular_users(self):
        regular_user = User.objects.create_user(
            username="doc-admin-user", password="pass12345"
        )
        other_user = User.objects.create_user(
            username="other-doc-admin-user", password="pass12345"
        )

        source = IndexedSource.objects.create(
            name="Visible Source", root_path="C:/visible", created_by=regular_user
        )
        hidden_source = IndexedSource.objects.create(
            name="Hidden Source", root_path="C:/hidden", created_by=other_user
        )
        crawl_job = CrawlJob.objects.create(source=source, requested_by=regular_user)
        CrawlJob.objects.create(source=hidden_source, requested_by=other_user)

        PermissionService.grant_default_object_permissions(source, regular_user)
        PermissionService.grant_default_object_permissions(crawl_job, regular_user)

        self.client.force_authenticate(regular_user)

        source_response = self.client.get("/api/v1/indexing/sources/")
        self.assertEqual(source_response.status_code, 200)
        self.assertEqual(source_response.data["total"], 1)
        self.assertEqual(source_response.data["results"][0]["id"], str(source.id))

        crawl_response = self.client.get("/api/v1/indexing/crawl-jobs/")
        self.assertEqual(crawl_response.status_code, 200)
        self.assertEqual(crawl_response.data["total"], 1)
        self.assertEqual(crawl_response.data["results"][0]["id"], str(crawl_job.id))


class ExtractTextUtilityTests(SimpleTestCase):
    @patch("edms_api.ocr_service.get_ocr_service")
    def test_extract_text_success(self, mock_get_service):
        mock_service = MagicMock()
        mock_service.extract_text.return_value = OcrResult(
            text="extracted text",
            confidence=0.95,
            engine="test_engine",
        )
        mock_get_service.return_value = mock_service

        text, confidence, engine, error = ocr_extract_text("dummy/path.pdf")

        mock_service.extract_text.assert_called_once_with("dummy/path.pdf")
        self.assertEqual(text, "extracted text")
        self.assertEqual(confidence, 0.95)
        self.assertEqual(engine, "test_engine")
        self.assertIsNone(error)

    @patch("edms_api.ocr_service.get_ocr_service")
    def test_extract_text_error(self, mock_get_service):
        mock_service = MagicMock()
        mock_service.extract_text.return_value = OcrResult(
            text="",
            confidence=0.0,
            engine="test_engine",
            error="some error",
        )
        mock_get_service.return_value = mock_service

        text, confidence, engine, error = ocr_extract_text("dummy/path.pdf")

        self.assertEqual(text, "")
        self.assertEqual(confidence, 0.0)
        self.assertEqual(engine, "test_engine")
        self.assertEqual(error, "some error")


class InitialRunAdminApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="initial-run-admin",
            password="pass12345",
            is_staff=True,
            is_superuser=True,
        )
        self.client.force_authenticate(self.user)
        self.temp_dir_obj = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir_obj.cleanup)
        self.source = IndexedSource.objects.create(
            name="Share A",
            root_path=self.temp_dir_obj.name,
            source_system="NETWORK_SHARE",
            is_active=True,
            created_by=self.user,
        )

    def test_initial_run_summary_reports_backlog(self):
        indexed_document = Document.objects.create(
            id="DOC-INITIAL-001",
            name="Indexed Source Document",
            type="Other",
            status="Approved",
            revision=1,
            author=self.user,
            file=SimpleUploadedFile("indexed.txt", b"indexed"),
            source_system="NETWORK_SHARE",
            external_file_path=os.path.join(self.temp_dir_obj.name, "indexed.txt"),
            fingerprint_3x64k="hash-1",
            file_hash="full-hash-1",
            duplicate_status="MASTER",
            duplicate_group_key="full:7:full-hash-1",
            ocr_status="Completed",
            search_indexed_at=timezone.now(),
        )
        IndexedSourceFileState.objects.create(
            source=self.source,
            relative_path="indexed.txt",
            absolute_path=indexed_document.external_file_path,
            document=indexed_document,
            status="ACTIVE",
        )

        pending_doc = Document.objects.create(
            id="DOC-INITIAL-002",
            name="Needs Dedup and OCR",
            type="Other",
            status="Approved",
            revision=1,
            author=self.user,
            file=SimpleUploadedFile("pending.txt", b"pending"),
            source_system="NETWORK_SHARE",
            external_file_path=os.path.join(self.temp_dir_obj.name, "pending.txt"),
            fingerprint_3x64k="hash-2",
            file_hash="",
            duplicate_group_key="",
            ocr_status="Not Started",
        )
        Document.objects.filter(pk=pending_doc.pk).update(
            fingerprint_3x64k="hash-2",
            file_hash="",
            duplicate_group_key="",
            duplicate_status="UNIQUE",
            ocr_status="Not Started",
        )

        missing_hash_doc = Document.objects.create(
            id="DOC-INITIAL-003",
            name="Needs Sparse Hash",
            type="Other",
            status="Approved",
            revision=1,
            author=self.user,
            file=SimpleUploadedFile("missing-hash.txt", b"missing"),
            source_system="NETWORK_SHARE",
            external_file_path=os.path.join(self.temp_dir_obj.name, "missing-hash.txt"),
            fingerprint_3x64k="",
            file_hash="",
            duplicate_group_key="",
            ocr_status="Failed",
        )
        Document.objects.filter(pk=missing_hash_doc.pk).update(
            fingerprint_3x64k="",
            file_hash="",
            duplicate_group_key="",
            duplicate_status="UNIQUE",
            ocr_status="Failed",
        )

        response = self.client.get("/api/v1/admin/initial-run/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "success")
        payload = response.data["data"]
        self.assertEqual(payload["documents"]["pending_ocr"], 2)
        self.assertEqual(payload["documents"]["pending_dedup"], 1)
        self.assertEqual(payload["documents"]["missing_sparse_hash"], 1)
        self.assertEqual(payload["sources"]["active_sources"], 1)
        self.assertEqual(payload["sources"]["tracked_files"], 1)

    @patch("documents.tasks.run_indexed_source_crawl.delay")
    def test_initial_run_action_creates_skip_indexed_crawl_job(self, mock_delay):
        response = self.client.post(
            "/api/v1/admin/initial-run/actions/",
            {
                "action": "index_sources",
                "skip_indexed": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data["status"], "success")
        job = CrawlJob.objects.get(source=self.source)
        self.assertEqual(job.parameters["trigger"], "initial_run")
        self.assertTrue(job.parameters["skip_indexed"])
        mock_delay.assert_called_once_with(str(job.id), force_full_hash=False)
