import type { AppInboxItem } from "./types";

function readPayloadValue(payload: Record<string, unknown> | undefined, key: string) {
  const value = payload?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export function resolveDocumentPreviewPath(documentId: string) {
  return `/documents/${encodeURIComponent(documentId)}/preview`;
}

export function resolveNotificationPreviewDocumentId(notification: AppInboxItem) {
  const payload = notification.payload as Record<string, unknown> | undefined;

  const directKeys = [
    "preview_document_id",
    "latest_document_id",
    "document_id",
    "master_document_id",
  ];

  for (const key of directKeys) {
    const value = readPayloadValue(payload, key);
    if (value) {
      return value;
    }
  }

  if (
    notification.type === "approval" &&
    readPayloadValue(payload, "entity_type")?.toLowerCase() === "document"
  ) {
    return readPayloadValue(payload, "entity_id");
  }

  return null;
}

export function resolveNotificationPreviewLabel(notification: AppInboxItem) {
  const payload = notification.payload as Record<string, unknown> | undefined;
  return (
    readPayloadValue(payload, "preview_document_name") ||
    readPayloadValue(payload, "latest_document_name") ||
    readPayloadValue(payload, "document_name") ||
    notification.title
  );
}
