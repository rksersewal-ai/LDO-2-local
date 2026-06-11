import os
import sys
from pathlib import Path
from shared.startup import enforce_startup_config

from .settings_api import (
    ADDITIONAL_INSTALLED_APPS,
    ADDITIONAL_MIDDLEWARE,
    ANONYMOUS_USER_NAME as DEFAULT_ANONYMOUS_USER_NAME,
    AUTHENTICATION_BACKENDS as DEFAULT_AUTHENTICATION_BACKENDS,
    CORS_ALLOWED_ORIGINS as DEFAULT_CORS_ALLOWED_ORIGINS,
    CORS_ALLOW_CREDENTIALS as DEFAULT_CORS_ALLOW_CREDENTIALS,
    CORS_EXPOSE_HEADERS as DEFAULT_CORS_EXPOSE_HEADERS,
    CSRF_TRUSTED_ORIGINS as DEFAULT_CSRF_TRUSTED_ORIGINS,
    LOGGING as API_LOGGING,
    REST_FRAMEWORK as API_REST_FRAMEWORK,
    SIMPLE_JWT as API_SIMPLE_JWT,
)

BASE_DIR = Path(__file__).resolve().parent.parent
LOG_DIR = BASE_DIR / 'logs'
LOG_DIR.mkdir(parents=True, exist_ok=True)

SECRET_KEY = os.environ['DJANGO_SECRET_KEY']
DEBUG = os.getenv('DJANGO_DEBUG', os.getenv('DEBUG', 'false')).lower() == 'true'

allowed_hosts = os.getenv('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1,0.0.0.0,testserver')
ALLOWED_HOSTS = [host.strip() for host in allowed_hosts.split(',') if host.strip()]

def _env_list(name: str, default_values):
    configured = os.getenv(name)
    if configured is None:
        return list(default_values)
    return [item.strip() for item in configured.split(',') if item.strip()]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework_simplejwt.token_blacklist',
    *ADDITIONAL_INSTALLED_APPS,
]

AUTHENTICATION_BACKENDS = list(DEFAULT_AUTHENTICATION_BACKENDS)
ANONYMOUS_USER_NAME = DEFAULT_ANONYMOUS_USER_NAME

MIDDLEWARE = [
    'django.middleware.gzip.GZipMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    *ADDITIONAL_MIDDLEWARE,
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'edms.urls'
WSGI_APPLICATION = 'edms.wsgi.application'
ASGI_APPLICATION = 'edms.asgi.application'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

db_engine = os.getenv('EDMS_DB_ENGINE', 'sqlite').lower()
if db_engine == 'postgresql':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv('POSTGRES_DB', 'edms_db'),
            'USER': os.getenv('POSTGRES_USER', 'edms_user'),
            'PASSWORD': os.environ['POSTGRES_PASSWORD'],
            'HOST': os.getenv('POSTGRES_HOST', 'localhost'),
            'PORT': os.getenv('POSTGRES_PORT', '5432'),
            'CONN_MAX_AGE': int(os.getenv('POSTGRES_CONN_MAX_AGE', '600')),
            'OPTIONS': {
                'connect_timeout': int(os.getenv('POSTGRES_CONNECT_TIMEOUT', '10')),
            },
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': os.getenv('EDMS_SQLITE_PATH', str(BASE_DIR / 'db.sqlite3')),
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = os.getenv('DJANGO_TIME_ZONE', 'UTC')
USE_I18N = True
USE_TZ = True

SESSION_COOKIE_SECURE = os.getenv('DJANGO_SESSION_COOKIE_SECURE', str(not DEBUG)).lower() == 'true'
CSRF_COOKIE_SECURE = os.getenv('DJANGO_CSRF_COOKIE_SECURE', str(not DEBUG)).lower() == 'true'
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = 'Lax'
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = os.getenv('DJANGO_SECURE_SSL_REDIRECT', 'false').lower() == 'true'
SECURE_HSTS_SECONDS = 0 if DEBUG else 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_HSTS_PRELOAD = not DEBUG

DATA_UPLOAD_MAX_MEMORY_SIZE = int(os.getenv('DJANGO_DATA_UPLOAD_MAX_MEMORY_SIZE', str(10 * 1024 * 1024)))
FILE_UPLOAD_MAX_MEMORY_SIZE = int(os.getenv('DJANGO_FILE_UPLOAD_MAX_MEMORY_SIZE', str(10 * 1024 * 1024)))

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = dict(API_REST_FRAMEWORK)
REST_FRAMEWORK['DEFAULT_PAGINATION_CLASS'] = 'shared.pagination.StandardResultsSetPagination'
REST_FRAMEWORK['EXCEPTION_HANDLER'] = 'shared.exceptions.edms_exception_handler'
REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'] = dict(REST_FRAMEWORK.get('DEFAULT_THROTTLE_RATES', {}))
REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'].setdefault('login', os.getenv('EDMS_LOGIN_THROTTLE', '10/minute'))
REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'].setdefault('health', os.getenv('EDMS_HEALTH_THROTTLE', '12000/hour'))
SIMPLE_JWT = dict(API_SIMPLE_JWT)
if not SIMPLE_JWT.get('SIGNING_KEY'):
    SIMPLE_JWT['SIGNING_KEY'] = SECRET_KEY

CORS_ALLOWED_ORIGINS = _env_list('CORS_ALLOWED_ORIGINS', DEFAULT_CORS_ALLOWED_ORIGINS)
CSRF_TRUSTED_ORIGINS = _env_list('CSRF_TRUSTED_ORIGINS', DEFAULT_CSRF_TRUSTED_ORIGINS)

if DEBUG:
    if not CORS_ALLOWED_ORIGINS:
        CORS_ALLOWED_ORIGINS = [
            'http://localhost:4173',
            'http://127.0.0.1:4173',
            'http://localhost:5173',
            'http://127.0.0.1:5173',
        ]
    if not CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS = [
            'http://localhost:4173',
            'http://127.0.0.1:4173',
            'http://localhost:5173',
            'http://127.0.0.1:5173',
        ]

CORS_EXPOSE_HEADERS = list(DEFAULT_CORS_EXPOSE_HEADERS)
CORS_ALLOW_CREDENTIALS = DEFAULT_CORS_ALLOW_CREDENTIALS

LOGGING = dict(API_LOGGING)
LOGGING['filters']['request_context'] = {'()': 'shared.logging.RequestContextFilter'}
LOGGING['formatters']['verbose']['format'] = (
    '{levelname} {asctime} corr={correlation_id} tenant={tenant_id} plant={plant_id} '
    '{module} {process:d} {thread:d} {message}'
)
LOGGING['formatters']['simple']['format'] = (
    '{levelname} {asctime} corr={correlation_id} tenant={tenant_id} plant={plant_id} {message}'
)
for handler_name in ('file', 'api_file'):
    handler = LOGGING['handlers'][handler_name]
    handler['filename'] = str(LOG_DIR / Path(handler['filename']).name)
for handler_name in ('console', 'file', 'api_file'):
    LOGGING['handlers'][handler_name]['filters'] = ['request_context']

if os.getenv('EDMS_JSON_LOGGING', 'true').lower() == 'true':
    LOGGING['formatters']['json'] = {'()': 'shared.logging.JsonLogFormatter'}
    for handler_name in ('console', 'file', 'api_file'):
        LOGGING['handlers'][handler_name]['formatter'] = 'json'

EDMS_RUNTIME = {
    'database_backend': db_engine,
    'redis_url': os.getenv('REDIS_URL', 'redis://localhost:6379/0'),
    'celery_broker_url': os.getenv('CELERY_BROKER_URL', os.getenv('REDIS_URL', 'redis://localhost:6379/0')),
    'celery_result_backend': os.getenv('CELERY_RESULT_BACKEND', os.getenv('REDIS_URL', 'redis://localhost:6379/0')),
    'object_storage_bucket': os.getenv('EDMS_OBJECT_STORAGE_BUCKET', ''),
    'object_storage_endpoint': os.getenv('EDMS_OBJECT_STORAGE_ENDPOINT', ''),
    'hash_backfill_interval_minutes': int(os.getenv('EDMS_HASH_BACKFILL_INTERVAL_MINUTES', '0')),
    'hash_backfill_batch_size': int(os.getenv('EDMS_HASH_BACKFILL_BATCH_SIZE', '500')),
    'hash_backfill_force_full_hash': os.getenv('EDMS_HASH_BACKFILL_FORCE_FULL_HASH', 'false').lower() == 'true',
}

EDMS_HASH_BACKFILL_INTERVAL_MINUTES = EDMS_RUNTIME['hash_backfill_interval_minutes']
EDMS_HASH_BACKFILL_BATCH_SIZE = EDMS_RUNTIME['hash_backfill_batch_size']
EDMS_HASH_BACKFILL_FORCE_FULL_HASH = EDMS_RUNTIME['hash_backfill_force_full_hash']

CACHE_BACKEND_USES_REDIS = not DEBUG and 'test' not in sys.argv

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': EDMS_RUNTIME['redis_url'],
        'TIMEOUT': 300,
        'OPTIONS': {
            'db': 1,
        },
    }
} if CACHE_BACKEND_USES_REDIS else {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    }
}

CELERY_BROKER_URL = EDMS_RUNTIME['celery_broker_url']
CELERY_RESULT_BACKEND = EDMS_RUNTIME['celery_result_backend']
CELERY_TASK_ALWAYS_EAGER = os.getenv('CELERY_TASK_ALWAYS_EAGER', 'false').lower() == 'true'
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TRACK_STARTED = True
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'

# Task timeouts — prevent hung tasks from blocking workers
CELERY_TASK_TIME_LIMIT = int(os.getenv('CELERY_TASK_TIME_LIMIT', '300'))        # 5 min hard kill
CELERY_TASK_SOFT_TIME_LIMIT = int(os.getenv('CELERY_TASK_SOFT_TIME_LIMIT', '240'))  # 4 min graceful
CELERY_TASK_ROUTES = {
    'edms_api.ocr_tasks.*': {'queue': 'ocr'},
    'documents.tasks.*': {'queue': 'indexing'},
    'work.tasks.*': {'queue': 'default'},
    'integrations.*': {'queue': 'notifications'},
}

enforce_startup_config(debug=DEBUG, db_engine=db_engine)
