/**
 * Permission Guard
 *
 * Frontend permission checking utility that enforces role-based access
 * control with hierarchical roles. Validates user permissions before
 * rendering actions or allowing operations.
 *
 * Role hierarchy: admin > approver > editor > viewer
 *
 * Usage:
 *   import { hasPermission, canPerformAction, getAvailableActions } from "@/lib/security/permissionGuard";
 *
 *   if (hasPermission(user, "edit", resource)) { ... }
 *   const actions = getAvailableActions(user, document);
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Available permissions in the system */
export type Permission = "view" | "edit" | "delete" | "approve" | "admin";

/** User roles with hierarchical access levels */
export type Role = "viewer" | "editor" | "approver" | "admin";

/** Document actions that can be performed */
export type DocumentAction =
  | "view"
  | "download"
  | "edit"
  | "delete"
  | "approve"
  | "reject"
  | "manage";

/** Represents a user with role information */
export interface PermissionUser {
  /** User identifier */
  id: string;
  /** User's assigned role */
  role: Role;
  /** Optional list of specific document IDs the user owns */
  ownedDocuments?: string[];
}

/** Represents a resource with optional ownership information */
export interface PermissionResource {
  /** Resource/document identifier */
  id: string;
  /** ID of the user who owns/created this resource */
  ownerId?: string;
  /** Whether the resource is in a restricted state (e.g., locked, archived) */
  restricted?: boolean;
}

/** Result of a permission check */
export interface PermissionCheckResult {
  /** Whether the action is allowed */
  allowed: boolean;
  /** Reason for denial, if applicable */
  reason?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Role hierarchy levels (higher number = more privileges).
 * admin > approver > editor > viewer
 */
export const ROLE_HIERARCHY: Record<Role, number> = {
  viewer: 1,
  editor: 2,
  approver: 3,
  admin: 4,
};

/** Minimum role required for each permission */
const PERMISSION_REQUIREMENTS: Record<Permission, Role> = {
  view: "viewer",
  edit: "editor",
  delete: "admin",
  approve: "approver",
  admin: "admin",
};

/** Actions available per role (cumulative based on hierarchy) */
const ROLE_ACTIONS: Record<Role, DocumentAction[]> = {
  viewer: ["view", "download"],
  editor: ["view", "download", "edit", "delete"],
  approver: ["view", "download", "edit", "delete", "approve", "reject"],
  admin: ["view", "download", "edit", "delete", "approve", "reject", "manage"],
};

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Check if a user has a specific permission for a resource.
 *
 * Permission is granted if:
 * 1. The user's role meets or exceeds the minimum required role for the permission
 * 2. For "delete" on non-admin users: the user must be the resource owner
 * 3. Restricted resources require admin or approver role for edit/delete
 *
 * @param user - The user to check permissions for
 * @param permission - The permission being requested
 * @param resource - The target resource
 * @returns PermissionCheckResult with allowed status and optional reason
 */
export function hasPermission(
  user: PermissionUser | null | undefined,
  permission: Permission,
  resource?: PermissionResource,
): PermissionCheckResult {
  // Null/undefined user has no permissions
  if (!user) {
    return { allowed: false, reason: "No authenticated user" };
  }

  // Unknown role has no permissions
  if (!(user.role in ROLE_HIERARCHY)) {
    return { allowed: false, reason: `Unknown role: ${user.role}` };
  }

  const userLevel = ROLE_HIERARCHY[user.role];

  // Special handling for delete: ownership can grant permission even without admin role
  if (permission === "delete") {
    if (user.role === "admin") {
      return { allowed: true };
    }

    // Non-admin users need at least editor role AND ownership to delete
    if (userLevel < ROLE_HIERARCHY["editor"]) {
      return {
        allowed: false,
        reason: `Role "${user.role}" does not have "${permission}" permission. Requires document ownership with editor role or higher, or admin role.`,
      };
    }

    if (!resource) {
      return {
        allowed: false,
        reason: `Role "${user.role}" does not have "${permission}" permission. Requires document ownership or admin role.`,
      };
    }

    // Restricted resources require admin role to delete
    if (resource.restricted) {
      return { allowed: false, reason: "Restricted resource requires admin role to delete" };
    }

    const isOwner = resource.ownerId === user.id ||
      (user.ownedDocuments?.includes(resource.id) ?? false);
    if (!isOwner) {
      return { allowed: false, reason: "Only the document owner or an admin can delete this resource" };
    }

    return { allowed: true };
  }

  // Standard permission check for non-delete permissions
  const requiredRole = PERMISSION_REQUIREMENTS[permission];
  const requiredLevel = ROLE_HIERARCHY[requiredRole];

  if (userLevel < requiredLevel) {
    return {
      allowed: false,
      reason: `Role "${user.role}" does not have "${permission}" permission. Requires "${requiredRole}" or higher.`,
    };
  }

  // Resource-specific checks
  if (resource) {
    // Restricted resources require approver+ for edit
    if (resource.restricted) {
      if (permission === "edit" && userLevel < ROLE_HIERARCHY["approver"]) {
        return { allowed: false, reason: "Restricted resource requires approver or admin role to edit" };
      }
    }
  }

  return { allowed: true };
}

/**
 * Check if a user can perform a specific action on a document.
 *
 * @param user - The user attempting the action
 * @param action - The action to perform
 * @param document - The target document
 * @returns Whether the action is allowed
 */
export function canPerformAction(
  user: PermissionUser | null | undefined,
  action: DocumentAction,
  document?: PermissionResource,
): boolean {
  if (!user) return false;
  if (!(user.role in ROLE_HIERARCHY)) return false;

  const availableActions = getAvailableActions(user, document);
  return availableActions.includes(action);
}

/**
 * Get all actions available to a user for a given document.
 *
 * Takes into account role hierarchy, ownership, and resource restrictions.
 *
 * @param user - The user to get actions for
 * @param document - The target document (optional)
 * @returns Array of available actions
 */
export function getAvailableActions(
  user: PermissionUser | null | undefined,
  document?: PermissionResource,
): DocumentAction[] {
  if (!user) return [];
  if (!(user.role in ROLE_HIERARCHY)) return [];

  const roleActions = ROLE_ACTIONS[user.role] ?? [];

  if (!document) {
    return [...roleActions];
  }

  // Filter actions based on document-specific constraints
  return roleActions.filter((action) => {
    // Delete requires ownership (unless admin)
    if (action === "delete" && user.role !== "admin") {
      if (!document) return false;
      const isOwner = document.ownerId === user.id ||
        (user.ownedDocuments?.includes(document.id) ?? false);
      if (!isOwner) return false;
      // Restricted documents can only be deleted by admin
      if (document.restricted) return false;
      return true;
    }

    // Restricted documents limit edit to approver+
    if (document.restricted && action === "edit") {
      return ROLE_HIERARCHY[user.role] >= ROLE_HIERARCHY["approver"];
    }

    return true;
  });
}

/**
 * Check if one role has equal or higher privileges than another.
 *
 * @param role - The role to check
 * @param minimumRole - The minimum required role
 * @returns true if role meets or exceeds the minimum
 */
export function meetsMinimumRole(role: Role, minimumRole: Role): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minimumRole];
}
