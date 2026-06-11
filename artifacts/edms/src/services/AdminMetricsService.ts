const STORAGE_KEY = "ldo2_admin_metrics";
const FAILED_JOBS_KEY = "ldo2_failed_jobs";

export interface AdminMetrics {
  ocrQueueDepth: number;
  ocrProcessingRate: number; // jobs/hour
  storageUsedGB: number;
  storageTotalGB: number;
  workerCount: number;
  workersHealthy: number;
  workersOverloaded: number;
  failedJobCount: number;
  lastWorkerHeartbeat: string; // ISO timestamp
  systemUptime: number; // hours
}

export interface FailedJob {
  id: string;
  documentId: string;
  filename: string;
  failedAt: string;
  errorReason: string;
  retryCount: number;
}

export interface WorkerInfo {
  id: string;
  name: string;
  status: "healthy" | "overloaded" | "dead";
  lastHeartbeat: string;
  currentTask: string | null;
}

const DEFAULT_METRICS: AdminMetrics = {
  ocrQueueDepth: 12,
  ocrProcessingRate: 84,
  storageUsedGB: 142.7,
  storageTotalGB: 200,
  workerCount: 4,
  workersHealthy: 3,
  workersOverloaded: 1,
  failedJobCount: 3,
  lastWorkerHeartbeat: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  systemUptime: 1247,
};

const DEFAULT_FAILED_JOBS: FailedJob[] = [
  {
    id: "fj-001",
    documentId: "DOC-0042",
    filename: "thermal-analysis-rev3.pdf",
    failedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
    errorReason: "Timeout: OCR engine exceeded 120s processing limit",
    retryCount: 2,
  },
  {
    id: "fj-002",
    documentId: "DOC-0089",
    filename: "assembly-drawing-B12.tiff",
    failedAt: new Date(Date.now() - 7200 * 1000).toISOString(),
    errorReason: "Unsupported image encoding: CCITT Group 4",
    retryCount: 1,
  },
  {
    id: "fj-003",
    documentId: "DOC-0103",
    filename: "calibration-cert-2024.pdf",
    failedAt: new Date(Date.now() - 1800 * 1000).toISOString(),
    errorReason: "Memory allocation failure during page decomposition",
    retryCount: 0,
  },
];

const DEFAULT_WORKERS: WorkerInfo[] = [
  {
    id: "w-001",
    name: "ocr-worker-alpha",
    status: "healthy",
    lastHeartbeat: new Date(Date.now() - 30 * 1000).toISOString(),
    currentTask: "DOC-0201 page 3/12",
  },
  {
    id: "w-002",
    name: "ocr-worker-beta",
    status: "healthy",
    lastHeartbeat: new Date(Date.now() - 45 * 1000).toISOString(),
    currentTask: "DOC-0198 page 7/7",
  },
  {
    id: "w-003",
    name: "ocr-worker-gamma",
    status: "overloaded",
    lastHeartbeat: new Date(Date.now() - 120 * 1000).toISOString(),
    currentTask: "DOC-0195 page 22/45",
  },
  {
    id: "w-004",
    name: "ocr-worker-delta",
    status: "healthy",
    lastHeartbeat: new Date(Date.now() - 15 * 1000).toISOString(),
    currentTask: null,
  },
];

function loadMetrics(): AdminMetrics {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_METRICS));
      return DEFAULT_METRICS;
    }
    return JSON.parse(raw) as AdminMetrics;
  } catch {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_METRICS));
    return DEFAULT_METRICS;
  }
}

function loadFailedJobs(): FailedJob[] {
  try {
    const raw = window.localStorage.getItem(FAILED_JOBS_KEY);
    if (!raw) {
      window.localStorage.setItem(FAILED_JOBS_KEY, JSON.stringify(DEFAULT_FAILED_JOBS));
      return DEFAULT_FAILED_JOBS;
    }
    return JSON.parse(raw) as FailedJob[];
  } catch {
    window.localStorage.setItem(FAILED_JOBS_KEY, JSON.stringify(DEFAULT_FAILED_JOBS));
    return DEFAULT_FAILED_JOBS;
  }
}

function persistFailedJobs(jobs: FailedJob[]) {
  window.localStorage.setItem(FAILED_JOBS_KEY, JSON.stringify(jobs));
}

function persistMetrics(metrics: AdminMetrics) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(metrics));
}

export const AdminMetricsService = {
  getMetrics(): AdminMetrics {
    return loadMetrics();
  },

  getFailedJobs(): FailedJob[] {
    return loadFailedJobs();
  },

  getWorkers(): WorkerInfo[] {
    return DEFAULT_WORKERS;
  },

  retryJob(jobId: string): FailedJob[] {
    const jobs = loadFailedJobs();
    const updated = jobs.filter((j) => j.id !== jobId);
    persistFailedJobs(updated);
    const metrics = loadMetrics();
    metrics.failedJobCount = updated.length;
    metrics.ocrQueueDepth += 1;
    persistMetrics(metrics);
    return updated;
  },

  retryAllFailed(): FailedJob[] {
    const jobs = loadFailedJobs();
    const metrics = loadMetrics();
    metrics.failedJobCount = 0;
    metrics.ocrQueueDepth += jobs.length;
    persistMetrics(metrics);
    persistFailedJobs([]);
    return [];
  },
};
