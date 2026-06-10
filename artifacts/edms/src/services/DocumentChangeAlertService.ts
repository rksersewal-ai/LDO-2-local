import { ApiDocumentChangeAlertSchema } from "../lib/schemas";

const ALERTS_EVENT = "ldo2_document_change_alerts_updated";

export interface DocumentChangeAlert {
  id: string;
  status: "PENDING" | "APPROVED" | "BYPASSED";
  plId: string;
  plNumber: string;
  plName: string;
  designSupervisor?: string;
  documentId: string;
  documentName: string;
  documentStatus?: string;
  documentType?: string;
  category?: string;
  revision: string;
  previousDocumentId?: string;
  previousDocumentName?: string;
  previousDocumentStatus?: string;
  previousDocumentType?: string;
  previousRevision?: string;
  documentFamilyKey?: string;
  uploadedAt?: string;
  changeSummary?: string;
  resolutionNotes?: string;
  bypassReason?: string;
  resolvedAt?: string;
  message: string;
}

export const DocumentChangeAlertService = {
  mapApiReview(rawReview: unknown): DocumentChangeAlert {
    const review = ApiDocumentChangeAlertSchema.parse(rawReview);
    return {
      id: String(review.id),
      status: (review.status ?? "PENDING") as DocumentChangeAlert["status"],
      plId: String(review.pl_item ?? review.pl_number ?? ""),
      plNumber: String(review.pl_number ?? review.pl_item ?? ""),
      plName: review.pl_name ?? "",
      designSupervisor: review.design_supervisor ?? undefined,
      documentId: String(review.latest_document_id ?? review.latest_document ?? ""),
      documentName: review.latest_document_name ?? "",
      documentStatus: review.latest_document_status ?? undefined,
      documentType: review.latest_document_type ?? undefined,
      revision: String(review.latest_revision ?? ""),
      previousDocumentId: review.previous_document_id
        ? String(review.previous_document_id)
        : undefined,
      previousDocumentName: review.previous_document_name ?? undefined,
      previousDocumentStatus: review.previous_document_status ?? undefined,
      previousDocumentType: review.previous_document_type ?? undefined,
      previousRevision:
        review.previous_revision != null ? String(review.previous_revision) : undefined,
      documentFamilyKey: review.document_family_key ?? undefined,
      uploadedAt: review.created_at ?? undefined,
      changeSummary: review.change_summary ?? undefined,
      resolutionNotes: review.resolution_notes ?? undefined,
      bypassReason: review.bypass_reason ?? undefined,
      resolvedAt: review.resolved_at ?? undefined,
      message:
        review.change_summary ||
        `Latest revision ${String(review.latest_revision ?? "N/A")} needs supervisor review before replacing rev ${String(review.previous_revision ?? "N/A")}.`,
    };
  },

  notifyUpdated() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(ALERTS_EVENT));
    }
  },

  subscribe(listener: () => void) {
    if (typeof window === "undefined") {
      return () => undefined;
    }

    const handler = () => listener();
    window.addEventListener(ALERTS_EVENT, handler);
    return () => window.removeEventListener(ALERTS_EVENT, handler);
  },
};
