export interface UploadProgressItem {
  id: string;
  filename: string;
  progress: number;
  status: "uploading" | "success" | "failed" | "processing";
  error?: string;
  startedAt: number;
}

const UPLOAD_PROGRESS_EVENT = "edms:upload-progress";

let activeUploads: Map<string, UploadProgressItem> = new Map();

function emit() {
  window.dispatchEvent(new CustomEvent(UPLOAD_PROGRESS_EVENT, { detail: getActive() }));
}

function getActive(): UploadProgressItem[] {
  return Array.from(activeUploads.values());
}

export const UploadProgressService = {
  startUpload(id: string, filename: string) {
    activeUploads.set(id, {
      id,
      filename,
      progress: 0,
      status: "uploading",
      startedAt: Date.now(),
    });
    emit();
  },

  updateProgress(id: string, progress: number) {
    const item = activeUploads.get(id);
    if (item) {
      item.progress = Math.min(100, Math.max(0, progress));
      emit();
    }
  },

  completeUpload(id: string) {
    const item = activeUploads.get(id);
    if (item) {
      item.progress = 100;
      item.status = "success";
      emit();
      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        activeUploads.delete(id);
        emit();
      }, 5000);
    }
  },

  failUpload(id: string, error: string) {
    const item = activeUploads.get(id);
    if (item) {
      item.status = "failed";
      item.error = error;
      emit();
      // Auto-dismiss failed uploads after 8 seconds
      setTimeout(() => {
        activeUploads.delete(id);
        emit();
      }, 8000);
    }
  },

  getActive,

  subscribe(callback: (items: UploadProgressItem[]) => void): () => void {
    const handler = (e: Event) => {
      callback((e as CustomEvent<UploadProgressItem[]>).detail);
    };
    window.addEventListener(UPLOAD_PROGRESS_EVENT, handler);
    return () => window.removeEventListener(UPLOAD_PROGRESS_EVENT, handler);
  },

  clear() {
    activeUploads = new Map();
    emit();
  },
};
