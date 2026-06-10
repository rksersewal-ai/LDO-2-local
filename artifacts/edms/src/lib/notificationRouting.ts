export interface AppNotificationRouteTarget {
  type: string;
  entity?: string | null;
  target?: string | null;
}

export function resolveNotificationPath(notification: AppNotificationRouteTarget) {
  if (notification.target) {
    return notification.target;
  }

  switch (notification.type) {
    case "approval":
      return notification.entity
        ? `/approvals?id=${encodeURIComponent(notification.entity)}`
        : "/approvals";
    case "ocr":
      return notification.entity
        ? `/ocr?document=${encodeURIComponent(notification.entity)}`
        : "/ocr";
    case "case":
      return notification.entity
        ? `/cases?id=${encodeURIComponent(notification.entity)}`
        : "/cases";
    case "work":
      return notification.entity
        ? `/ledger?id=${encodeURIComponent(notification.entity)}`
        : "/ledger";
    case "supervisor_review":
      return "/notifications";
    case "dedup_review":
      return "/admin/deduplication";
    case "indexing_failure":
      return "/admin/deduplication";
    case "change_request":
      return notification.target || "/notifications";
    case "change_notice":
      return notification.target || "/notifications";
    case "system":
      return "/health";
    default:
      return "/notifications";
  }
}

export function resolveNotificationActionLabel(notification: AppNotificationRouteTarget) {
  switch (notification.type) {
    case "approval":
      return "Open approval";
    case "ocr":
      return "Open OCR monitor";
    case "case":
      return "Open case";
    case "work":
      return "Open work item";
    case "supervisor_review":
      return "Open supervisor review";
    case "dedup_review":
      return "Open dedup review";
    case "indexing_failure":
      return "Open indexing issue";
    case "change_request":
      return "Open change request";
    case "change_notice":
      return "Open change notice";
    case "system":
      return "Open system health";
    default:
      return "Open notification";
  }
}
