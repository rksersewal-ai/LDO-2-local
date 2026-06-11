# ADR-005: Authentication, Security, and MFA Strategy

**Date:** June 2026  
**Status:** Proposed  
**Deciders:** Principal Engineer, Security Lead, Backend Lead  
**Technical Area:** Authentication, Authorization, and Identity Management

---

## Context

LDO-2 is an engineering-document intelligence platform deployed on industrial LANs. It manages sensitive documents including engineering drawings, specifications, and compliance records. The system currently supports 5 roles (admin, supervisor, engineer, reviewer, viewer) with JWT-based authentication. Industrial compliance regimes (railway, nuclear, defense) increasingly require MFA, SSO integration, and immutable audit trails.

The system must balance strong security with usability in an industrial environment where users may be shop-floor workers accessing the system from shared workstations or tablets.

## Problem

Current authentication has several gaps:

1. **No MFA**: Password-only authentication is insufficient for systems handling controlled documents
2. **No SSO**: Users maintain separate credentials instead of using their organizational identity provider
3. **Long-lived tokens**: Current JWT configuration may not enforce short access token lifetimes
4. **No object-level permissions**: Role-based access is all-or-nothing per resource type; cannot restrict access to specific documents
5. **No API keys for integrations**: Service-to-service communication (scanner API, ERP export) has no dedicated authentication mechanism
6. **Demo credentials in production**: `Login.tsx` exposes demo credentials that may leak into production builds

## Current Implementation

- JWT authentication with username/password login (`artifacts/edms/src/lib/auth.tsx`)
- 5 roles: admin, supervisor, engineer, reviewer, viewer
- `ProtectedRoute` component checks role arrays for route access (`App.tsx`)
- Backend uses DRF token authentication (`backend/edms/settings.py`)
- `shared/permissions.py` defines role-based permission classes
- AuditLog model tracks user actions with `AuditService`
- Correlation IDs in `shared/exceptions.py` link requests across services
- Demo credentials hardcoded in `Login.tsx` (security gap)

## Options Considered

### Option A: Keycloak OIDC + django-otp TOTP MFA (Recommended)

Deploy self-hosted Keycloak as the identity provider. Django authenticates via OIDC. MFA via TOTP (time-based one-time passwords) using django-otp for users who do not use Keycloak.

### Option B: Auth0 / Okta Cloud Identity

Use a cloud-hosted identity provider with built-in MFA, SSO, and user management.

### Option C: Django-native with django-allauth + django-otp

Build authentication entirely within Django using allauth for social/SAML login and django-otp for MFA.

### Option D: Custom JWT with FIDO2/WebAuthn

Extend current JWT system with FIDO2 hardware key support for passwordless authentication.

## Recommended Decision

**Option A: Keycloak OIDC + django-otp TOTP, with phased rollout behind feature flags.**

Architecture:
- **Phase 1**: Fix immediate security issues (demo credentials, session hardening). No flag needed.
- **Phase 2**: Add TOTP MFA via django-otp. Feature flag: `FEATURE_MFA_TOTP`.
- **Phase 3**: Deploy Keycloak. Integrate via OIDC. Feature flag: `FEATURE_KEYCLOAK_SSO`.
- **Phase 4**: Add object-level permissions via Django Guardian. Feature flag: `FEATURE_OBJECT_PERMS`.
- **Phase 5**: Add API key management for integrations. Feature flag: `FEATURE_API_KEYS`.

MFA policy:
- Required for: admin, supervisor roles
- Optional (encouraged) for: engineer, reviewer roles
- Not required for: viewer role (read-only access from shared workstations)

Token configuration:
- Access token: 15-minute expiry
- Refresh token: 7-day expiry with rotation on use
- Refresh token family: revoke all tokens if a used refresh token is replayed (detect theft)

## Why This Decision is Best

1. **Self-hosted**: Keycloak runs on-premises. No cloud dependency. Critical for air-gapped industrial networks.
2. **Standards-based**: OIDC/SAML2 are industry standards. Future ADFS/Entra ID integration is straightforward.
3. **Gradual adoption**: TOTP MFA can be deployed without Keycloak. Each phase is independently valuable.
4. **Enterprise features**: Keycloak provides user federation (LDAP), social login, brute-force detection, and account lockout out of the box.
5. **Open source (Apache 2.0)**: No licensing cost. Active community. Meets open-source adoption criteria (ADR-008).
6. **Proven at scale**: Keycloak handles millions of users. Overkill for our scale but means zero scaling concerns.
7. **Fallback preserved**: JWT authentication remains as fallback. If Keycloak is down, users can still authenticate directly.
8. **Compliance-ready**: MFA + SSO + audit logging meets ISO 27001, NIST 800-53, and railway sector requirements.
9. **Shop-floor compatible**: TOTP works on any smartphone. No hardware token procurement required.

## Why Alternatives are Rejected or Deferred

### Option B (Auth0/Okta Cloud) - Rejected

- **Cloud dependency**: Requires internet access from LAN. Incompatible with air-gapped industrial deployments.
- **Ongoing cost**: Auth0 charges $23/month for 1000 users at Professional tier. Annual cost adds up.
- **Data sovereignty**: User credentials and login events stored on cloud provider's infrastructure. May violate data residency requirements.
- **Vendor lock-in**: Migration away from Auth0/Okta requires significant re-engineering.
- **Latency**: Authentication requests traverse the internet. Adds 50-200ms to every login and token refresh.

### Option C (Django-native allauth + django-otp) - Deferred as Partial Implementation

- **No dedicated identity server**: All auth logic in Django means no centralized user management for multi-service deployments.
- **No SSO for other services**: If Grafana, Celery Flower, or other tools need SSO, each requires separate integration.
- **Limited federation**: allauth supports social providers but not enterprise LDAP/AD federation out of the box.
- **Partial use**: django-otp for TOTP is used in Phase 2 (before Keycloak is deployed). allauth is not needed if Keycloak handles the identity layer.
- **When acceptable**: If deployment will only ever be the single Django application with no other services needing SSO.

### Option D (Custom JWT with FIDO2/WebAuthn) - Rejected

- **Hardware dependency**: FIDO2 requires hardware security keys ($25-50 each). Not practical for 100+ shop-floor workers.
- **Browser compatibility**: WebAuthn support varies. Older industrial terminals may not support it.
- **Implementation complexity**: Custom WebAuthn implementation is significantly more complex than TOTP.
- **No SSO**: Does not address the centralized identity management requirement.
- **Future consideration**: Can be added as an additional MFA method in Keycloak after initial TOTP rollout.

## Impact on Current App

### Immediate Changes (Phase 1 - No Feature Flag)
- `Login.tsx`: Gate demo credentials behind `import.meta.env.DEV`
- `backend/edms/settings.py`: Configure 15-min access token, 7-day refresh token with rotation
- `backend/shared/middleware.py`: Add rate limiting for authentication endpoints (5 attempts/minute)
- `.github/workflows/ci.yml`: Add step to verify no credentials in production bundle

### Phase 2 Changes (TOTP MFA)
- New: `backend/shared/mfa/` - MFA views, serializers, enrollment flow
- Modified: `Login.tsx` - Add MFA challenge step after password verification
- Modified: `backend/shared/views.py` - MFA verification endpoint
- New dependency: `django-otp` + `qrcode` for TOTP enrollment

### Phase 3 Changes (Keycloak SSO)
- New: Keycloak service in `docker-compose.yml`
- New: `backend/shared/oidc.py` - OIDC authentication backend
- Modified: `Login.tsx` - Add "Login with SSO" button redirecting to Keycloak
- Modified: `backend/edms/settings.py` - OIDC configuration
- New dependency: `mozilla-django-oidc`

### Phase 4 Changes (Object-Level Permissions)
- New dependency: `django-guardian`
- Modified: `backend/documents/views.py` - Per-document permission checks
- Modified: `backend/shared/permissions.py` - Guardian-based permission classes
- New: Permission management UI in frontend admin panel

### Phase 5 Changes (API Keys)
- New: `backend/shared/api_keys/` - API key model, authentication backend, management views
- New: Admin UI for API key creation, rotation, and revocation
- Modified: DRF authentication classes to support API key header

## Migration Strategy

1. **Phase 1** (Week 1): Fix demo credentials. Harden token configuration. No user-facing changes.
2. **Phase 2** (Week 3-4): Deploy django-otp. Enable MFA enrollment for admins. 30-day grace period before enforcement.
3. **Phase 3** (Week 8-12): Deploy Keycloak container. Configure OIDC. Import existing users. Parallel login (JWT or OIDC) for 30 days.
4. **Phase 4** (Week 14-16): Deploy Django Guardian. Migrate existing role checks to include object-level checks. Default: open (preserve current behavior).
5. **Phase 5** (Week 18-20): Deploy API key system. Create keys for existing integrations. Migrate scanner/ERP to API key auth.

User communication:
- Phase 1: No user action required
- Phase 2: Email notification 30 days before MFA enforcement. QR code enrollment guide.
- Phase 3: Email notification with SSO login instructions. JWT fallback remains available.

## Rollback Strategy

1. **Phase 1**: Cannot roll back (security hardening is permanent). If token lifetime causes issues, increase to 1-hour access token.
2. **Phase 2**: Set `FEATURE_MFA_TOTP=false`. MFA check bypassed. Users log in with password only.
3. **Phase 3**: Set `FEATURE_KEYCLOAK_SSO=false`. Login page shows only password form. JWT authentication remains primary.
4. **Phase 4**: Set `FEATURE_OBJECT_PERMS=false`. Permission checks revert to role-only (existing behavior).
5. **Phase 5**: Set `FEATURE_API_KEYS=false`. API key authentication disabled; integrations must use user tokens.

Each phase rollback is independent. No phase depends on a previous phase being active (except Phase 3 builds on Phase 2 for MFA in Keycloak).

## Performance Impact

| Metric | Before | After | Notes |
|--------|--------|-------|-------|
| Login latency | ~200ms | ~300ms (TOTP) / ~500ms (OIDC redirect) | Acceptable for login (infrequent operation) |
| API request overhead | ~5ms (JWT verify) | ~5ms (JWT verify, unchanged) | Tokens still verified locally once issued |
| Token refresh | ~100ms | ~150ms (with rotation) | Slightly slower due to token family tracking |
| Permission check | ~2ms (role check) | ~5ms (role + object check) | One additional DB query per request |
| Keycloak memory | 0 | 512MB-1GB | Dedicated container resource allocation |
| Session storage | Stateless JWT | Stateless JWT + Keycloak sessions | Keycloak manages its own session store |

## Security Impact

- **Positive**: MFA eliminates password-only attacks (credential stuffing, phishing). SSO eliminates password reuse across services.
- **Positive**: Short-lived tokens limit exposure window if token is compromised.
- **Positive**: Object-level permissions enable least-privilege access to sensitive documents.
- **Positive**: API keys with scoped permissions limit integration damage radius.
- **Risk**: Keycloak becomes a critical security component. Must be kept updated and hardened.
- **Mitigation**: Keycloak on dedicated VLAN. Admin access restricted to management VLAN. Regular security updates.
- **Risk**: TOTP shared secrets stored in database. Must be encrypted at rest.
- **Mitigation**: Use `django-otp` encrypted storage backend. Database-level encryption (pgcrypto).

## Operational Complexity

| Aspect | Complexity | Mitigation |
|--------|-----------|------------|
| Keycloak administration | Medium | Admin console is web-based; well-documented |
| User provisioning | Low | Keycloak imports from LDAP/AD; self-service enrollment |
| MFA support requests | Medium | Clear enrollment guide; admin can reset MFA for locked-out users |
| Token rotation monitoring | Low | Prometheus metrics for token refresh failures |
| Keycloak upgrades | Medium | Container-based; rolling update with session persistence |
| Key rotation | Low | Keycloak handles signing key rotation automatically |
| Backup | Low | Keycloak uses PostgreSQL; included in existing DB backup |
| Disaster recovery | Medium | JWT fallback ensures system accessible even if Keycloak is down |

## Acceptance Tests

1. **Demo credential removal**: Build production frontend. Search bundle for demo passwords. Verify zero results.
2. **Token lifetime**: Login. Wait 16 minutes. Attempt API call. Verify 401 response. Verify refresh token still works.
3. **MFA enrollment**: Admin user navigates to MFA settings. Scans QR code. Enters TOTP code. Verify MFA enabled.
4. **MFA login flow**: User with MFA enabled logs in. After password, verify TOTP challenge displayed. Enter valid code. Verify access granted.
5. **MFA enforcement**: Admin without MFA attempts to access admin pages. Verify redirect to MFA enrollment.
6. **SSO login**: Click "Login with SSO". Verify redirect to Keycloak. Authenticate. Verify redirect back to app with valid session.
7. **SSO fallback**: Disable Keycloak container. Verify JWT login still works (fallback mode).
8. **Object permissions**: Admin assigns document X to user A only. User B (same role) attempts to access document X. Verify 403 forbidden.
9. **API key**: Create API key with "documents:read" scope. Use key to list documents (success). Use key to create document (403 forbidden).
10. **Rate limiting**: Attempt 10 failed logins in 1 minute. Verify account locked for 5 minutes.
11. **Audit trail**: Perform login, MFA enrollment, document access. Verify all events in audit log with correct user, timestamp, and correlation ID.
12. **Token theft detection**: Use refresh token. Use same refresh token again (replay). Verify entire token family revoked.
