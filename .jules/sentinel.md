## 2026-06-11 - Unsafe CORS Configuration Fixed
**Vulnerability:** Hardcoded local domains (`localhost`, `127.0.0.1`) in `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` could leak into production if not overridden, exposing the application to CORS/CSRF attacks from local development servers or compromised endpoints.
**Learning:** Default settings intended for development must be strictly gated by `DEBUG` flags and explicitly removed or flagged when running in production to prevent unintended exposure.
**Prevention:** Enforce strict validation during app startup (`enforce_startup_config`) to ensure critical variables like `CORS_ALLOWED_ORIGINS` are correctly set and do not contain unsafe defaults when `DEBUG=False`.
