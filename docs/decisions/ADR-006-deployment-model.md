# ADR-006: Deployment Model - Docker Compose First, Kubernetes Later

**Date:** June 2026  
**Status:** Proposed  
**Deciders:** Principal Engineer, DevOps Lead  
**Technical Area:** Deployment, Orchestration, and High Availability

---

## Context

LDO-2 is deployed on industrial LANs for engineering document management. The current deployment uses Docker Compose with PostgreSQL 16 + PgBouncer + Redis 7 + Celery worker/beat. The system targets 200+ concurrent users managing 6 lakh documents. High availability, zero-downtime deployments, and automatic failover are required for production readiness (10/10 score).

The deployment team is typically 1 DevOps engineer with limited container orchestration experience. The target hardware is on-premises servers (not cloud VMs), and internet access may be restricted or unavailable.

## Problem

The current single-node Docker Compose deployment has several limitations:

1. **Single point of failure**: Any service crash (PostgreSQL, Redis, Django) takes down the entire system
2. **No zero-downtime deployment**: Container restarts during updates cause 10-30 second outages
3. **No horizontal scaling**: Cannot add more API workers or OCR workers dynamically
4. **No automatic recovery**: Crashed containers require manual intervention or docker-compose restart
5. **No load balancing**: Single Nginx/Django instance handles all traffic
6. **Resource contention**: OCR workers compete with API workers for CPU/memory on one host

## Current Implementation

- `docker-compose.yml` defines the full stack:
  - PostgreSQL 16 (database)
  - PgBouncer (connection pooling)
  - Redis 7 (cache, queue broker, session store)
  - Django/Gunicorn (API server)
  - Celery worker (background tasks)
  - Celery beat (task scheduler)
  - Nginx (reverse proxy, static files)
- All services run on a single Docker host
- No health checks configured in compose services
- No restart policies beyond Docker's default
- No volume backup automation
- Build passes with `docker-compose build` in CI

## Options Considered

### Option A: Enhanced Docker Compose with HA Patterns (Recommended Start)

Keep Docker Compose as the primary deployment tool but add health checks, restart policies, replicas (where compose supports them), and a companion HAProxy for load balancing. Add Patroni for PostgreSQL HA.

### Option B: Kubernetes (K8s) from Day One

Deploy on Kubernetes (k3s or full K8s) with Helm charts, autoscaling, and full orchestration.

### Option C: Docker Swarm

Use Docker Swarm mode for multi-node orchestration with Docker's built-in clustering.

### Option D: Nomad (HashiCorp)

Use HashiCorp Nomad for container orchestration with simpler operational model than Kubernetes.

## Recommended Decision

**Option A: Enhanced Docker Compose for initial deployment (0-200 users), with documented migration path to Kubernetes for scale-out (200+ users). Feature flag: N/A (infrastructure decision).**

Docker Compose HA architecture:
- 2x Nginx instances behind Keepalived VIP (virtual IP failover)
- 2x Django/Gunicorn instances (active-active behind Nginx load balancing)
- PostgreSQL primary + streaming replica with Patroni for automatic failover
- Redis Sentinel (3 nodes) for Redis HA
- 4x Celery workers: 2 for default queue, 2 for OCR queue
- 1x Celery beat (single-instance with leader election)
- Health checks on all services with restart policies

Deployment strategy:
- Rolling update: Start new container, health check passes, drain old container
- Blue/green for database migrations: Apply migration, then swap traffic
- Canary: Route 10% traffic to new version, monitor, then full rollout

## Why This Decision is Best

1. **Team capability match**: Docker Compose is already proven in this project. The team knows it. Zero learning curve.
2. **Operational simplicity**: Single `docker-compose up -d` starts everything. Single `docker-compose pull && docker-compose up -d` updates.
3. **Hardware compatible**: Works on any Linux server with Docker. No Kubernetes prerequisites (etcd, kubelet, container runtime compatibility).
4. **Sufficient for target scale**: 200 concurrent users with 2 API instances and PgBouncer is well within Docker Compose capability.
5. **HA achievable**: PostgreSQL HA (Patroni), Redis HA (Sentinel), and API HA (multiple instances + Keepalived) provide genuine high availability within Docker Compose.
6. **Lower resource overhead**: Kubernetes control plane consumes 2-4 CPU cores and 4-8GB RAM. That is significant on a 16-core server.
7. **Air-gap friendly**: Docker Compose images can be pre-pulled and saved to tarballs. Kubernetes air-gap is significantly more complex.
8. **Documented scale-out**: When growth exceeds 200 users or multi-site is needed, Helm charts provide a clean migration to K8s.
9. **Fast recovery**: Container restart policies + health checks mean automatic recovery from crashes in <10 seconds.
10. **Cost-effective**: No Kubernetes licensing, no managed K8s service fees, no dedicated K8s admin.

## Why Alternatives are Rejected or Deferred

### Option B (Kubernetes) - Deferred

- **Operational complexity**: Kubernetes requires expertise in: pod scheduling, persistent volumes, ingress controllers, RBAC, network policies, cert-manager, and upgrade procedures.
- **Resource overhead**: K8s control plane (etcd + API server + scheduler + controller-manager) uses 4-8GB RAM minimum. On a 32GB server, that is 25% overhead for orchestration.
- **Learning curve**: The team has Docker Compose experience. K8s requires months of training for reliable operation.
- **Overkill for single-site**: K8s shines in multi-cluster, multi-region, cloud-native deployments. Single-site LAN does not benefit from most K8s features.
- **Air-gap complexity**: Deploying K8s offline requires mirroring container registries, managing offline Helm repos, and custom kubeadm configurations.
- **When to adopt**: If user count exceeds 500, or multi-site deployment is required, or the team grows to include a dedicated platform engineer.
- **Migration path**: All Docker images are K8s-compatible. Helm charts can wrap existing compose definitions. Migration is effort but not a rewrite.

### Option C (Docker Swarm) - Rejected

- **Deprecated direction**: Docker has deprioritized Swarm development. Community momentum has moved to Kubernetes.
- **Limited ecosystem**: Fewer monitoring tools, fewer community resources, fewer proven patterns compared to Compose or K8s.
- **Stuck in the middle**: More complex than Compose (distributed state) but less capable than K8s (no autoscaling, limited networking).
- **No clear advantage**: For our scale, Compose with HA patterns provides equivalent capability with less complexity.

### Option D (Nomad) - Rejected

- **Smaller community**: HashiCorp ecosystem (Nomad + Consul + Vault) is less widely adopted than Docker/K8s. Harder to hire and troubleshoot.
- **Additional infrastructure**: Nomad requires Consul for service discovery. That is another distributed system to manage.
- **Limited tooling**: Fewer monitoring integrations, fewer CI/CD integrations, fewer community-maintained templates.
- **Vendor uncertainty**: HashiCorp's licensing changes (BSL) introduce risk for open-source-first projects.
- **No team experience**: Learning Nomad provides less career value to the team than learning K8s.

## Impact on Current App

### Docker Compose Changes
- Add `healthcheck` directives to all services
- Add `restart: unless-stopped` to all services
- Add `deploy.replicas: 2` for Django and Nginx services
- Add Patroni sidecar for PostgreSQL HA
- Add Redis Sentinel configuration (3 instances)
- Add HAProxy/Keepalived for VIP management
- Separate `docker-compose.override.yml` for development (single instance, no HA)

### New Infrastructure Components
- `deploy/patroni/` - Patroni configuration for PostgreSQL HA
- `deploy/sentinel/` - Redis Sentinel configuration
- `deploy/haproxy/` - HAProxy configuration for load balancing
- `deploy/keepalived/` - Keepalived for VIP failover
- `scripts/deploy.sh` - Rolling update deployment script
- `scripts/backup.sh` - Automated backup with verification

### Application Changes
- Backend: Health check endpoint expanded (check DB, Redis, Celery connectivity)
- Backend: Django configured for multiple instances (shared session store in Redis)
- Backend: Celery beat uses database scheduler (for multi-instance safety)
- Frontend: Build artifacts served from shared Nginx volume (or per-instance copy)
- CI: Add deployment validation step (health check after deploy)

### Documentation
- `docs/deployment/PRODUCTION.md` - Production deployment guide
- `docs/deployment/HA.md` - High availability configuration
- `docs/deployment/UPGRADE.md` - Zero-downtime upgrade procedure
- `docs/deployment/DR.md` - Disaster recovery procedure

## Migration Strategy

1. **Phase 1** (Week 1): Add health checks and restart policies to existing compose. Zero risk.
2. **Phase 2** (Week 2): Configure PostgreSQL streaming replication (read-only replica). Patroni for failover.
3. **Phase 3** (Week 3): Deploy Redis Sentinel. Configure Celery and Django to use Sentinel.
4. **Phase 4** (Week 4): Add second Django instance. Configure Nginx upstream load balancing.
5. **Phase 5** (Week 5): Add HAProxy/Keepalived for VIP. Test failover scenarios.
6. **Phase 6** (Week 6): Write deployment scripts. Test rolling update procedure. Document.
7. **Phase 7** (ongoing): Monitor. Tune. Prepare K8s Helm charts for future migration.

## Rollback Strategy

Each phase can be rolled back independently:

1. **Health checks**: Remove healthcheck directives (no risk, always additive).
2. **PostgreSQL HA**: Promote replica manually. Remove Patroni. Revert to single-instance.
3. **Redis Sentinel**: Switch Django/Celery config back to single Redis host.
4. **Multiple API instances**: Scale replicas to 1. Remove load balancing config.
5. **VIP/HAProxy**: Remove HAProxy. Point DNS directly to single Nginx.
6. **Full rollback**: `git checkout` previous docker-compose.yml. `docker-compose up -d`.

Recovery time: <5 minutes per phase rollback. Full rollback: <15 minutes.

## Performance Impact

| Metric | Before (Single Node) | After (HA Compose) | Notes |
|--------|---------------------|-------------------|-------|
| API throughput | ~200 req/s (1 instance) | ~400 req/s (2 instances) | Linear scaling with instances |
| API failover | Manual restart (30s+) | Automatic (<5s) | Health check detects, LB routes away |
| DB failover | Manual (minutes) | Automatic (<30s) via Patroni | Streaming replication, leader election |
| Redis failover | Manual (minutes) | Automatic (<10s) via Sentinel | Sentinel promotes replica |
| Deploy downtime | 10-30s (container restart) | 0s (rolling update) | Old container serves until new is healthy |
| Resource usage | 100% on one host | 120-150% (HA overhead) | Additional container instances |
| Disk I/O | All on one volume | Distributed across hosts (if multi-host) | Better I/O distribution |

## Security Impact

- **Reduced blast radius**: Service compromise on one instance does not affect the other.
- **Network segmentation**: HAProxy can enforce TLS between services (mutual TLS for internal communication).
- **Secret management**: Compose secrets for sensitive values (DB password, JWT secret). Consider Vault for production.
- **Patroni security**: PostgreSQL replication channel must use certificate authentication.
- **Redis Sentinel**: Sentinel communication must be on a trusted network (internal VLAN).
- **Deployment security**: Rolling update scripts must verify image signatures before deploying.
- **Attack surface**: More exposed ports (HAProxy, Sentinel, Patroni). Restrict to management VLAN.

## Operational Complexity

| Aspect | Complexity | Mitigation |
|--------|-----------|------------|
| Initial setup | Medium (Patroni + Sentinel config) | Detailed deployment guide with ansible playbook |
| Day-to-day operation | Low (docker-compose commands) | Same workflow as current; just more containers |
| Failover testing | Medium (scheduled chaos) | Quarterly failover drills with runbook |
| Upgrades | Low (rolling update script) | One command; automated health verification |
| Monitoring | Medium (more components to watch) | Prometheus service discovery for all containers |
| Troubleshooting | Medium (distributed logs) | Loki for centralized logging; correlation IDs |
| Backup | Low (Patroni handles WAL archiving) | pgBackRest or pg_basebackup with Patroni |
| Capacity planning | Low (scale by adding instances) | Clear scaling guide in documentation |

## Acceptance Tests

1. **Health check**: Kill Django process in container. Verify container restarts automatically within 10 seconds.
2. **API failover**: Stop one Django container. Verify requests continue to succeed via second instance with no errors visible to user.
3. **DB failover**: Stop PostgreSQL primary. Verify Patroni promotes replica within 30 seconds. Verify application reconnects automatically.
4. **Redis failover**: Stop Redis primary. Verify Sentinel promotes replica. Verify Celery and session management continue working.
5. **Zero-downtime deploy**: Run deployment script. Monitor API responses throughout. Verify zero failed requests.
6. **Rolling update**: Deploy new image version. Verify old and new versions serve traffic during transition. Verify old containers drain within 30 seconds.
7. **Load test**: 200 concurrent users. Verify p95 <200ms. Verify no errors. Verify load distributed across instances.
8. **Split-brain prevention**: Network-partition PostgreSQL. Verify Patroni fences the old primary (prevents split-brain writes).
9. **Backup verification**: Trigger backup. Stop all services. Restore from backup. Verify all data intact.
10. **Monitoring**: Verify all services appear in Prometheus targets. Verify Grafana dashboards show correct metrics.
11. **Degraded mode**: Remove one of two API instances. Verify system continues serving all requests at reduced throughput.
