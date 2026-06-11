"""
Compatibility view façade.

The active implementations live in the modular apps:
- shared
- documents
- config_mgmt
- work

This module re-exports the public view classes so older imports keep working
while the backend internally follows the modular-monolith layout.
"""

from documents.views import DocumentViewSet, OcrJobViewSet, OcrResultView
from shared.views import (
    AuditLogViewSet,
    DashboardStatsView,
    HealthStatusView,
    LoginView,
    LogoutView,
    SearchHistoryView,
    SearchView,
)
from work.views import ApprovalViewSet, CaseViewSet, WorkRecordExportJobCreateView, WorkRecordViewSet

__all__ = [
    'ApprovalViewSet',
    'AuditLogViewSet',
    'CaseViewSet',
    'DashboardStatsView',
    'DocumentViewSet',
    'HealthStatusView',
    'LoginView',
    'LogoutView',
    'OcrJobViewSet',
    'OcrResultView',
    'SearchHistoryView',
    'SearchView',
    'WorkRecordExportJobCreateView',
    'WorkRecordViewSet',
]
