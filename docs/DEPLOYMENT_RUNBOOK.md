# LDO-2 EDMS — Deployment Runbook

## Overview

| Service | Port | Image | Health Check |
|---------|------|-------|-------------|
| Frontend (Nginx) | 80 | `ldo2-frontend` | `GET /` returns 200 |
| Backend (Gunicorn) | 8420 | `ldo2-backend` | `GET /api/v1/health/status/` |
| PostgreSQL | 5432 | `postgres:16-alpine` | `pg_isready` |
| Redis | 6379 | `redis:7-alpine` | `redis-cli ping` |
| Celery Worker | — | `ldo2-backend` | N/A (process-level) |
| Celery Beat | — | `ldo2-backend` | N/A (process-level) |

---

## Pre-Deployment Checklist

- [ ] All CI checks pass (typecheck, lint, test, build, security scan)
- [ ] Database migrations reviewed (`python manage.py showmigrations`)
- [ ] Environment variables updated in target environment
- [ ] Docker images built and tagged with git SHA
- [ ] Backup of production database taken

---

## Deployment Steps

### 1. Build Images

```bash
docker build -f Dockerfile.backend -t ldo2-backend:$(git rev-parse --short HEAD) .
docker build -f Dockerfile.frontend -t ldo2-frontend:$(git rev-parse --short HEAD) .
```

### 2. Push to Registry

```bash
docker tag ldo2-backend:$TAG $REGISTRY/ldo2-backend:$TAG
docker tag ldo2-frontend:$TAG $REGISTRY/ldo2-frontend:$TAG
docker push $REGISTRY/ldo2-backend:$TAG
docker push $REGISTRY/ldo2-frontend:$TAG
```

### 3. Run Migrations (Backend)

```bash
docker exec -it <backend-container> python manage.py migrate --noinput
docker exec -it <backend-container> python manage.py collectstatic --noinput
```

### 4. Deploy Services

```bash
# Docker Compose (staging)
docker-compose --profile prod pull
docker-compose --profile prod up -d

# Or Kubernetes
kubectl set image deployment/backend backend=$REGISTRY/ldo2-backend:$TAG
kubectl set image deployment/frontend frontend=$REGISTRY/ldo2-frontend:$TAG
```

### 5. Verify Deployment

```bash
# Health checks
curl -f http://localhost:8420/api/v1/health/status/
curl -f http://localhost/

# Smoke test
curl -X POST http://localhost:8420/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<password>"}'
```

---

## Rollback Procedure

### Immediate Rollback (< 5 minutes)

```bash
# Revert to previous image tag
docker-compose --profile prod down
TAG=<previous-sha> docker-compose --profile prod up -d

# Or Kubernetes
kubectl rollout undo deployment/backend
kubectl rollout undo deployment/frontend
```

### Database Rollback

```bash
# If migrations were applied, reverse them
docker exec -it <backend-container> python manage.py migrate <app_name> <previous_migration_number>

# Or restore from backup
pg_restore -d edms /backups/edms_pre_deploy.dump
```

---

## Environment Variables

See `.env.example` (root) for the full list. Critical production variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `DJANGO_SECRET_KEY` | Yes | 50+ char random hex |
| `POSTGRES_PASSWORD` | Yes | Strong database password |
| `DJANGO_DEBUG` | Yes | Must be `false` in production |
| `CORS_ALLOWED_ORIGINS` | Yes | Frontend URL only |
| `CELERY_BROKER_URL` | Yes | Redis connection string |

---

## Monitoring

- **Health endpoint**: `GET /api/v1/health/status/` — returns service status JSON
- **Logs**: Structured JSON logging enabled via `EDMS_JSON_LOGGING=true`
- **Frontend errors**: Captured via `lib/logger.ts` → ready for Sentry integration
- **Web Vitals**: Reported via Performance Observer (see `main.tsx`)

---

## Incident Response

| Severity | Response Time | Action |
|----------|--------------|--------|
| P0 (site down) | 15 min | Immediate rollback, notify stakeholders |
| P1 (degraded) | 1 hour | Investigate, apply hotfix or rollback |
| P2 (non-critical) | Next business day | Create issue, plan fix |

---

*Last updated: June 11, 2026*
