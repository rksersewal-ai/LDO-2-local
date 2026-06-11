import { describe, it, expect } from "vitest";
import {
  hasPermission,
  canPerformAction,
  getAvailableActions,
  meetsMinimumRole,
  ROLE_HIERARCHY,
} from "./permissionGuard";
import type { PermissionUser, PermissionResource } from "./permissionGuard";

describe("permissionGuard", () => {
  const viewer: PermissionUser = { id: "user-viewer", role: "viewer" };
  const editor: PermissionUser = { id: "user-editor", role: "editor" };
  const approver: PermissionUser = { id: "user-approver", role: "approver" };
  const admin: PermissionUser = { id: "user-admin", role: "admin" };

  const ownedDocument: PermissionResource = { id: "doc-1", ownerId: "user-editor" };
  const otherDocument: PermissionResource = { id: "doc-2", ownerId: "user-other" };
  const restrictedDocument: PermissionResource = { id: "doc-3", ownerId: "user-editor", restricted: true };

  describe("ROLE_HIERARCHY", () => {
    it("defines correct hierarchy levels", () => {
      expect(ROLE_HIERARCHY.viewer).toBeLessThan(ROLE_HIERARCHY.editor);
      expect(ROLE_HIERARCHY.editor).toBeLessThan(ROLE_HIERARCHY.approver);
      expect(ROLE_HIERARCHY.approver).toBeLessThan(ROLE_HIERARCHY.admin);
    });
  });

  describe("hasPermission", () => {
    describe("null/undefined user handling", () => {
      it("denies permission for null user", () => {
        const result = hasPermission(null, "view");
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain("No authenticated user");
      });

      it("denies permission for undefined user", () => {
        const result = hasPermission(undefined, "view");
        expect(result.allowed).toBe(false);
      });
    });

    describe("unknown role handling", () => {
      it("denies permission for unknown role", () => {
        const unknownUser = { id: "user-x", role: "superuser" as any };
        const result = hasPermission(unknownUser, "view");
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain("Unknown role");
      });
    });

    describe("view permission", () => {
      it("allows all roles to view", () => {
        expect(hasPermission(viewer, "view").allowed).toBe(true);
        expect(hasPermission(editor, "view").allowed).toBe(true);
        expect(hasPermission(approver, "view").allowed).toBe(true);
        expect(hasPermission(admin, "view").allowed).toBe(true);
      });
    });

    describe("edit permission", () => {
      it("denies viewer from editing", () => {
        const result = hasPermission(viewer, "edit");
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain("does not have");
      });

      it("allows editor and above to edit", () => {
        expect(hasPermission(editor, "edit").allowed).toBe(true);
        expect(hasPermission(approver, "edit").allowed).toBe(true);
        expect(hasPermission(admin, "edit").allowed).toBe(true);
      });
    });

    describe("approve permission", () => {
      it("denies viewer and editor from approving", () => {
        expect(hasPermission(viewer, "approve").allowed).toBe(false);
        expect(hasPermission(editor, "approve").allowed).toBe(false);
      });

      it("allows approver and admin to approve", () => {
        expect(hasPermission(approver, "approve").allowed).toBe(true);
        expect(hasPermission(admin, "approve").allowed).toBe(true);
      });
    });

    describe("delete permission", () => {
      it("denies viewer and editor from deleting (no resource)", () => {
        expect(hasPermission(viewer, "delete").allowed).toBe(false);
        expect(hasPermission(editor, "delete").allowed).toBe(false);
      });

      it("allows admin to delete any resource", () => {
        expect(hasPermission(admin, "delete", otherDocument).allowed).toBe(true);
      });

      it("denies non-owner non-admin from deleting", () => {
        const result = hasPermission(approver, "delete", otherDocument);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain("owner");
      });

      it("allows owner (approver) to delete their own document", () => {
        const approverDoc: PermissionResource = { id: "doc-x", ownerId: "user-approver" };
        const result = hasPermission(approver, "delete", approverDoc);
        expect(result.allowed).toBe(true);
      });
    });

    describe("admin permission", () => {
      it("only allows admin role", () => {
        expect(hasPermission(viewer, "admin").allowed).toBe(false);
        expect(hasPermission(editor, "admin").allowed).toBe(false);
        expect(hasPermission(approver, "admin").allowed).toBe(false);
        expect(hasPermission(admin, "admin").allowed).toBe(true);
      });
    });

    describe("restricted resource checks", () => {
      it("denies editor from editing restricted resource", () => {
        const result = hasPermission(editor, "edit", restrictedDocument);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain("Restricted");
      });

      it("allows approver to edit restricted resource", () => {
        expect(hasPermission(approver, "edit", restrictedDocument).allowed).toBe(true);
      });

      it("allows admin to edit restricted resource", () => {
        expect(hasPermission(admin, "edit", restrictedDocument).allowed).toBe(true);
      });
    });

    describe("ownedDocuments list", () => {
      it("recognizes ownership via ownedDocuments array", () => {
        const userWithDocs: PermissionUser = {
          id: "user-owner",
          role: "approver",
          ownedDocuments: ["doc-100", "doc-200"],
        };
        const doc: PermissionResource = { id: "doc-100", ownerId: "someone-else" };

        const result = hasPermission(userWithDocs, "delete", doc);
        expect(result.allowed).toBe(true);
      });
    });
  });

  describe("canPerformAction", () => {
    it("returns false for null user", () => {
      expect(canPerformAction(null, "view")).toBe(false);
    });

    it("returns false for undefined user", () => {
      expect(canPerformAction(undefined, "view")).toBe(false);
    });

    it("allows viewer to view and download", () => {
      expect(canPerformAction(viewer, "view")).toBe(true);
      expect(canPerformAction(viewer, "download")).toBe(true);
    });

    it("denies viewer from editing", () => {
      expect(canPerformAction(viewer, "edit")).toBe(false);
    });

    it("allows editor to edit", () => {
      expect(canPerformAction(editor, "edit")).toBe(true);
    });

    it("denies editor from approving", () => {
      expect(canPerformAction(editor, "approve")).toBe(false);
    });

    it("allows approver to approve and reject", () => {
      expect(canPerformAction(approver, "approve")).toBe(true);
      expect(canPerformAction(approver, "reject")).toBe(true);
    });

    it("allows admin to manage", () => {
      expect(canPerformAction(admin, "manage")).toBe(true);
    });

    it("denies editor from deleting non-owned document", () => {
      expect(canPerformAction(editor, "delete", otherDocument)).toBe(false);
    });

    it("allows admin to delete any document", () => {
      expect(canPerformAction(admin, "delete", otherDocument)).toBe(true);
    });
  });

  describe("getAvailableActions", () => {
    it("returns empty array for null user", () => {
      expect(getAvailableActions(null)).toEqual([]);
    });

    it("returns empty array for undefined user", () => {
      expect(getAvailableActions(undefined)).toEqual([]);
    });

    it("returns view and download for viewer", () => {
      const actions = getAvailableActions(viewer);
      expect(actions).toContain("view");
      expect(actions).toContain("download");
      expect(actions).not.toContain("edit");
      expect(actions).not.toContain("delete");
    });

    it("returns view, download, edit for editor (delete requires owned document)", () => {
      const actions = getAvailableActions(editor);
      expect(actions).toContain("view");
      expect(actions).toContain("download");
      expect(actions).toContain("edit");
      expect(actions).toContain("delete");
      expect(actions).not.toContain("approve");
    });

    it("returns all non-admin actions for approver", () => {
      const actions = getAvailableActions(approver);
      expect(actions).toContain("view");
      expect(actions).toContain("download");
      expect(actions).toContain("edit");
      expect(actions).toContain("delete");
      expect(actions).toContain("approve");
      expect(actions).toContain("reject");
      expect(actions).not.toContain("manage");
    });

    it("returns all actions for admin", () => {
      const actions = getAvailableActions(admin);
      expect(actions).toContain("view");
      expect(actions).toContain("download");
      expect(actions).toContain("edit");
      expect(actions).toContain("delete");
      expect(actions).toContain("approve");
      expect(actions).toContain("reject");
      expect(actions).toContain("manage");
    });

    it("excludes delete for non-owner editor on specific document", () => {
      const actions = getAvailableActions(editor, otherDocument);
      expect(actions).not.toContain("delete");
    });

    it("includes delete for owner editor on owned document", () => {
      const editorWithDocs: PermissionUser = {
        id: "user-editor",
        role: "editor",
        ownedDocuments: ["doc-1"],
      };
      const actions = getAvailableActions(editorWithDocs, ownedDocument);
      // Editor can delete their own document
      expect(actions).toContain("delete");
    });

    it("limits actions on restricted documents for editor", () => {
      const actions = getAvailableActions(editor, restrictedDocument);
      expect(actions).not.toContain("edit");
      expect(actions).toContain("view");
      expect(actions).toContain("download");
    });

    it("allows approver to edit restricted documents", () => {
      const actions = getAvailableActions(approver, restrictedDocument);
      expect(actions).toContain("edit");
    });

    it("returns empty array for unknown role", () => {
      const unknownUser = { id: "x", role: "superuser" as any };
      expect(getAvailableActions(unknownUser)).toEqual([]);
    });
  });

  describe("meetsMinimumRole", () => {
    it("viewer meets viewer minimum", () => {
      expect(meetsMinimumRole("viewer", "viewer")).toBe(true);
    });

    it("editor meets viewer minimum", () => {
      expect(meetsMinimumRole("editor", "viewer")).toBe(true);
    });

    it("viewer does not meet editor minimum", () => {
      expect(meetsMinimumRole("viewer", "editor")).toBe(false);
    });

    it("admin meets all minimums", () => {
      expect(meetsMinimumRole("admin", "viewer")).toBe(true);
      expect(meetsMinimumRole("admin", "editor")).toBe(true);
      expect(meetsMinimumRole("admin", "approver")).toBe(true);
      expect(meetsMinimumRole("admin", "admin")).toBe(true);
    });

    it("approver does not meet admin minimum", () => {
      expect(meetsMinimumRole("approver", "admin")).toBe(false);
    });
  });
});
