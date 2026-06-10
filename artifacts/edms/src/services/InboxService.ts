import { MOCK_NOTIFICATIONS } from "../lib/mockExtended";
import type { AppInboxItem } from "../lib/types";
import apiClient from "./ApiClient";
import { ApprovalService } from "./ApprovalService";

const STORAGE_KEY = "ldo2_inbox_items";

function mapMockNotifications(): AppInboxItem[] {
  return MOCK_NOTIFICATIONS.map((notification) => ({
    id: notification.id,
    type: notification.type,
    title: notification.title,
    subtitle: notification.message,
    status: notification.read ? "READ" : "UNREAD",
    created_at: notification.time,
    payload: notification.entity ? { entity: notification.entity } : {},
  }));
}

function persistMockItems(items: AppInboxItem[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }
}

function loadMockItems() {
  if (typeof window === "undefined") {
    return mapMockNotifications();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = mapMockNotifications();
      persistMockItems(seeded);
      return seeded;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("Inbox store is invalid");
    }

    return parsed as AppInboxItem[];
  } catch {
    const fallback = mapMockNotifications();
    persistMockItems(fallback);
    return fallback;
  }
}

let _mockStore = loadMockItems();

export const InboxService = {
  async getItems(
    signal?: AbortSignal,
  ): Promise<{ items: AppInboxItem[]; source: "backend" | "mock" }> {
    try {
      const response = await apiClient.getInbox({ signal });
      return { items: response.items, source: "backend" };
    } catch (error) {
      console.warn("[InboxService] Falling back to mock notifications.", error);
      return { items: mapMockNotifications(), source: "mock" };
    }
  },

  async actOnItem(
    itemId: string,
    payload: {
      action: string;
      notes?: string;
      comment?: string;
      reason?: string;
      bypass_reason?: string;
      effectivity_date?: string;
    },
  ) {
    try {
      return await apiClient.actOnWorkflowItem(itemId, payload);
    } catch (_error) {
      const item = _mockStore.find((entry) => entry.id === itemId);
      const entityId =
        typeof item?.payload?.entity === "string" ? (item.payload.entity as string) : undefined;

      if (item?.type === "approval" && entityId) {
        const status = payload.action === "approve" ? "Approved" : "Rejected";
        await ApprovalService.updateStatus(entityId, status);
      }

      _mockStore = _mockStore.filter((entry) => entry.id !== itemId);
      persistMockItems(_mockStore);

      return { result: payload.action, source: "mock" };
    }
  },
};
