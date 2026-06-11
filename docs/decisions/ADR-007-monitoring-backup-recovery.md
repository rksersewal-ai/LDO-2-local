# ADR-007: Monitoring, Backup, and Recovery Strategy

**Date:** June 2026  
**Status:** Proposed  
**Deciders:** Principal Engineer, DevOps Lead, Backend Lead  
**Technical Area:** Observability, Backup, and Disaster Recovery

---

## Context

LDO-2 is an engineering-document intelligence platform deployed on industrial LANs. Production readiness (10/10) requires comprehensive observability (know when something is wrong before users report it), automated backups (provable recoverability), and tested disaster recovery procedures (verified RTO/RPO targets).

The system manages 6 lakh engineering documents with compliance requirements for 15-year retention. Data loss is unacceptable. The monitoring stack must be self-hosted (LAN deployment, no cloud telemetry services).

## Problem

Current observability is minimal:

1. **No metrics collection**: No Prometheus, no dashboards, no historical data for capacity planning
2. **No centralized logging**: Structured logger exists (`backend/shared/`) but logs are container stdout only
3. **No alerting**: Failures detected only when users report issues
4. **No frontend error tracking**: Unhandled exceptions in the browser are invisible to operators
5. **No backup verification**: No automated backup exists; no proof of recoverability
6. **No performance baselines**: Cannot detect degradation because there is no historical comparison
7. **No SLO tracking**: Cannot measure uptime or latency against targets

## Current Implementation

- Backend has a structured logger with correlation IDs (`backend/shared/exceptions.py`)
- Health check endpoint exists at `/api/v1/health/status/` (`backend/shared/views.py`)
- Frontend has `ErrorBoundary.tsx` catching React render errors (displays to user, not reported)
- Docker Compose runs all services with stdout/stderr logging (Docker default log driver)
- No Prometheus, Grafana, Loki, or Alertmanager configured
- No backup automation or verification
- CI pipeline includes security scan but no observability integration
- Redis is deployed (potential metrics source but not instrumented)

## Options Considered

### Option A: Prometheus + Grafana + Loki + Alertmanager (Recommended)

Deploy the full Prometheus observability stack: Prometheus for metrics, Grafana for dashboards, Loki for log aggregation, Alertmanager for notifications. Add automated backup with verification.

### Option B: Datadog / New Relic (Cloud APM)

Use a cloud-hosted APM solution for metrics, logs, and alerting.

### Option C: ELK Stack (Elasticsearch + Logstash + Kibana)

Deploy ELK for centralized logging with Kibana dashboards.

### Option D: Minimal Custom Solution

Build custom health check dashboard with Django views and cron-based alerting.

## Recommended Decision

**Option A: Prometheus + Grafana + Loki + Alertmanager, deployed as part of the Docker Compose stack.**

Architecture:

```
Application Layer:
  Django (django-prometheus) -> Prometheus (scrape /metrics)
  Celery (flower + prometheus exporter) -> Prometheus
  PostgreSQL (pg_exporter) -> Prometheus
  Redis (redis_exporter) -> Prometheus
  Nginx (nginx-prometheus-exporter) -> Prometheus
  Frontend (web-vitals reporter) -> Django metrics endpoint -> Prometheus

Observability Layer:
  Prometheus (time-series DB) -> Grafana (dashboards + alerting)
  All containers -> Loki (log aggregation) -> Grafana (log viewer)
  Alertmanager -> Slack/Email/PagerDuty

Backup Layer:
  pg_basebackup + WAL archiving -> Backup NAS
  File storage rsync -> Backup NAS
  Weekly automated restore test -> Alert on failure
```

Backup strategy:
- Full database backup: Daily at 02:00 (pg_basebackup with WAL archiving for PITR)
- File storage backup: Daily incremental (rsync to backup NAS)
- Backup verification: Weekly automated restore test (Saturday 02:00)
- Retention: 30 daily, 12 weekly, 24 monthly, 15 yearly

## Why This Decision is Best

1. **Self-hosted**: Runs entirely on LAN. No internet dependency. No telemetry data leaving the network.
2. **Industry standard**: Prometheus + Grafana is the de facto standard for container monitoring. Extensive community dashboards, exporters, and documentation.
3. **Low resource footprint**: Prometheus uses 2-4GB RAM for our scale. Grafana uses 256MB. Loki uses 1-2GB. Total: ~8GB dedicated.
4. **Pull-based collection**: Prometheus scrapes metrics endpoints. No agent installation on application containers. Non-invasive.
5. **Powerful querying**: PromQL enables complex alerting rules (e.g., "error rate >1% for 5 minutes AND on production").
6. **Unified view**: Grafana provides single pane of glass for metrics (Prometheus), logs (Loki), and custom dashboards.
7. **Proven backup integration**: pgBackRest and WAL-G are battle-tested PostgreSQL backup tools with Prometheus metrics.
8. **Alert routing**: Alertmanager supports escalation policies, silencing, and multi-channel notification (email, Slack, PagerDuty).
9. **Open source**: All components are open source (Apache 2.0 / AGPL for Grafana). Meets ADR-008 criteria.
10. **Correlation**: Loki labels match Prometheus labels. Jump from a spike in error rate dashboard to the exact log lines that caused it.

## Why Alternatives are Rejected or Deferred

### Option B (Datadog/New Relic) - Rejected

- **Cloud dependency**: Requires internet access. Incompatible with air-gapped industrial LANs.
- **Cost**: Datadog charges $15-23/host/month for infrastructure monitoring + $12-27/million log events. Significant ongoing cost.
- **Data sovereignty**: Telemetry data (including error messages containing document names) leaves the network. May violate security policies.
- **Vendor lock-in**: Custom metrics format and query language. Migration is expensive.
- **Latency**: Alert detection delayed by telemetry upload latency (5-30 seconds additional).

### Option C (ELK Stack) - Rejected

- **Resource intensive**: Elasticsearch requires 8-16GB RAM for production. Logstash adds another 2-4GB. Kibana adds 1GB. Total: 12-20GB just for logging.
- **Operational complexity**: Elasticsearch cluster management (index lifecycle, shard management, upgrades) is a full-time job at scale.
- **No metrics native**: ELK is log-focused. Adding metrics requires Metricbeat + index templates. Less natural than Prometheus.
- **Overkill for logging**: Loki provides 90% of ELK's log querying at 10% of the resource cost by not indexing log content (only labels).
- **Duplicate infrastructure**: If we also need Prometheus for metrics (which we do), running ELK alongside doubles the observability stack.

### Option D (Minimal Custom Solution) - Rejected

- **No historical data**: Custom dashboards show current state only. Cannot compare to yesterday/last week.
- **No alerting at scale**: Cron-based checks are fragile and hard to maintain as rules grow.
- **No log aggregation**: Container logs are ephemeral. Once container restarts, logs are lost.
- **Build vs. buy**: Building a monitoring system is weeks of work. Prometheus + Grafana deploy in hours.
- **No industry support**: Custom solutions lack community dashboards, best practices, and troubleshooting guides.

## Impact on Current App

### New Infrastructure Components (Docker Compose)
- `prometheus` - Metrics collection (port 9090, management VLAN only)
- `grafana` - Dashboards and alerting (port 3000, management VLAN only)
- `loki` - Log aggregation (port 3100, internal only)
- `alertmanager` - Alert routing (port 9093, internal only)
- `node-exporter` - Host metrics (CPU, RAM, disk)
- `postgres-exporter` - PostgreSQL metrics
- `redis-exporter` - Redis metrics
- `nginx-exporter` - Nginx metrics

### Application Changes
- Backend: Add `django-prometheus` middleware for request metrics
- Backend: Add custom metrics (OCR queue depth, document count, search latency)
- Backend: Configure Loki logging driver (or Promtail sidecar)
- Frontend: Add web-vitals reporting endpoint (LCP, FID, CLS)
- Frontend: Add error boundary reporting to backend metrics endpoint
- Health check: Expand `/api/v1/health/status/` to include dependency checks

### New Configuration Files
- `deploy/prometheus/prometheus.yml` - Scrape targets and rules
- `deploy/prometheus/alerts.yml` - Alert rules
- `deploy/grafana/dashboards/` - Pre-built dashboard JSON files
- `deploy/grafana/provisioning/` - Datasource and dashboard provisioning
- `deploy/loki/loki-config.yml` - Loki configuration
- `deploy/alertmanager/alertmanager.yml` - Alert routing configuration
- `deploy/backup/backup.sh` - Backup script with verification
- `deploy/backup/restore.sh` - Restore script
- `deploy/backup/verify.sh` - Automated restore verification

### Backup Infrastructure
- Dedicated backup volume (separate NAS or second disk)
- pgBackRest for PostgreSQL backup with WAL archiving
- rsync for file storage backup
- Celery periodic task for backup verification
- Prometheus metrics for backup age and status

## Migration Strategy

1. **Phase 1** (Week 1): Deploy Prometheus + Grafana + node-exporter. Basic host monitoring live.
2. **Phase 2** (Week 2): Add postgres-exporter, redis-exporter, nginx-exporter. Database and infrastructure dashboards.
3. **Phase 3** (Week 3): Add django-prometheus. Application metrics (request latency, error rate, active users).
4. **Phase 4** (Week 4): Deploy Loki. Configure Docker log driver. Centralized logging live.
5. **Phase 5** (Week 5): Configure Alertmanager. Define alert rules. Connect to Slack/email.
6. **Phase 6** (Week 6): Implement automated backup with pgBackRest. Daily backups running.
7. **Phase 7** (Week 7): Add backup verification. Weekly automated restore test.
8. **Phase 8** (Week 8): Add frontend metrics (web-vitals, error reporting). Full stack observability.

## Rollback Strategy

1. **Monitoring stack**: Remove monitoring services from docker-compose.yml. Application continues running without observability. Risk: blind to issues.
2. **django-prometheus**: Remove middleware from settings.py. No impact on application functionality.
3. **Loki logging**: Revert Docker log driver to default json-file. Logs still visible via `docker logs`.
4. **Alertmanager**: Disable alert routing. Grafana can still show dashboards without alerting.
5. **Backup**: Never roll back backup. Adjust schedule or retention if storage is constrained.
6. **Recovery time**: <5 minutes per component. Monitoring removal has no application impact.

## Performance Impact

| Metric | Impact | Notes |
|--------|--------|-------|
| Request latency overhead | +1-2ms per request | django-prometheus middleware cost |
| CPU overhead (Prometheus scraping) | <2% | Scrape every 15 seconds; efficient metric export |
| Memory (monitoring stack) | 6-10GB dedicated | Prometheus (4GB), Grafana (512MB), Loki (2GB), exporters (512MB) |
| Disk (metrics retention) | 20-50GB per month | 15-day retention default; configurable |
| Disk (logs retention) | 10-30GB per month | 30-day retention; compressed by Loki |
| Network overhead | Negligible | Internal scraping on Docker network |
| Backup impact on DB | <5% CPU during pg_basebackup | Runs at 02:00 during low activity |
| Backup storage | 50-100GB (database) + incremental file sync | Separate volume; does not impact application storage |

## Security Impact

- **Access control**: Grafana and Prometheus dashboards restricted to management VLAN. Not accessible from user workstations.
- **Credential exposure**: Prometheus scrape configs must not expose database passwords. Use environment variables.
- **Metric sensitivity**: Some metrics may reveal business information (document counts, user activity). Restrict dashboard access.
- **Log sanitization**: Ensure Loki does not index PII from request bodies. Log correlation IDs, not request payloads.
- **Alertmanager**: Alert notifications may contain system details. Use secure channels (encrypted email, private Slack channels).
- **Backup encryption**: All backup data encrypted at rest (GPG). Encryption keys stored separately from backup media.
- **Restore security**: Restore operations require admin authentication. Logged in audit trail.

## Operational Complexity

| Aspect | Complexity | Mitigation |
|--------|-----------|------------|
| Initial deployment | Medium (many components) | Docker Compose handles; provisioning scripts automate |
| Dashboard maintenance | Low (community dashboards) | Import pre-built dashboards; customize as needed |
| Alert tuning | Medium (initial false positives) | Start with conservative thresholds; tune over 30 days |
| Storage management | Low (automated retention) | Prometheus and Loki handle retention automatically |
| Upgrade procedure | Low (container updates) | Pin versions; update quarterly |
| Backup monitoring | Low (self-monitoring) | Prometheus alert on backup age >26 hours |
| Restore testing | Low (automated weekly) | Script runs autonomously; alerts on failure |
| Incident response | Medium (new workflows) | Documented runbook linking alerts to dashboards to actions |

## Acceptance Tests

1. **Metrics collection**: Deploy stack. Verify Prometheus shows all targets as "UP" (Django, PostgreSQL, Redis, Nginx).
2. **Dashboard rendering**: Open Grafana. Verify pre-built dashboards render with real data (request rate, latency histogram, error rate).
3. **Alert firing**: Simulate high error rate (return 500 from test endpoint). Verify alert fires within 5 minutes. Verify notification delivered.
4. **Log aggregation**: Generate log entries in Django. Query in Grafana/Loki. Verify logs appear within 5 seconds with correct labels.
5. **Correlation**: Generate error in Django. Find corresponding Prometheus metric spike. Navigate to Loki logs for that time range. Verify correlation ID present.
6. **Backup execution**: Trigger manual backup. Verify pg_basebackup completes. Verify file backup completes. Verify backup age metric updates.
7. **Backup verification**: Run automated restore test. Verify restore succeeds on a separate PostgreSQL instance. Verify data integrity.
8. **Backup age alert**: Stop backup script. Wait 27 hours (simulate). Verify alert fires for stale backup.
9. **Frontend metrics**: Load application. Navigate pages. Verify web-vitals metrics appear in Prometheus (LCP, FID, CLS).
10. **Resource monitoring**: Verify node-exporter shows host CPU, memory, disk metrics. Verify capacity alerts configured.
11. **Retention**: Verify Prometheus data older than configured retention is automatically pruned. Verify Loki compacts old logs.
12. **Grafana access control**: Verify Grafana is not accessible from user VLAN. Verify admin authentication required.
