import { type BOMNode, cloneTree, countNodes, type Product } from "../lib/bomData";

const BOM_DRAFTS_KEY = "ldo2_bom_drafts";

export interface BomDraftRecord {
  id: string;
  product: Product;
  tree: BOMNode[];
  createdAt: string;
  updatedAt: string;
}

interface CreateBomDraftInput {
  product: Omit<Product, "assemblies" | "parts" | "total" | "lastModified">;
  tree: BOMNode[];
}

type DraftProductBase = Omit<Product, "assemblies" | "parts" | "total" | "lastModified">;

function safeReadDrafts(): BomDraftRecord[] {
  try {
    const raw = localStorage.getItem(BOM_DRAFTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeWriteDrafts(drafts: BomDraftRecord[]) {
  localStorage.setItem(BOM_DRAFTS_KEY, JSON.stringify(drafts));
}

function slugifyProductName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function buildProduct(product: DraftProductBase, tree: BOMNode[]): Product {
  const stats = countNodes(tree);
  const root = tree[0];

  return {
    ...product,
    rootPL: root?.id ?? product.rootPL,
    revision: root?.revision ?? product.revision,
    assemblies: stats.assemblies,
    parts: stats.parts,
    total: stats.total,
    lastModified: new Date().toISOString().slice(0, 10),
  };
}

export class BomDraftService {
  static getAll(): BomDraftRecord[] {
    return safeReadDrafts().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  static getById(id: string): BomDraftRecord | null {
    return BomDraftService.getAll().find((draft) => draft.id === id) ?? null;
  }

  static create(input: CreateBomDraftInput): BomDraftRecord {
    const drafts = BomDraftService.getAll();
    const baseId = slugifyProductName(input.product.name) || "custom-bom";
    let nextId = `draft-${baseId}`;
    let suffix = 2;

    while (drafts.some((draft) => draft.id === nextId)) {
      nextId = `draft-${baseId}-${suffix}`;
      suffix += 1;
    }

    const timestamp = new Date().toISOString();
    const draft: BomDraftRecord = {
      id: nextId,
      product: buildProduct(input.product, input.tree),
      tree: cloneTree(input.tree),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    safeWriteDrafts([draft, ...drafts]);
    return draft;
  }

  static saveTree(id: string, tree: BOMNode[]): BomDraftRecord | null {
    const drafts = BomDraftService.getAll();
    const index = drafts.findIndex((draft) => draft.id === id);
    if (index === -1) return null;

    const current = drafts[index];
    const updated: BomDraftRecord = {
      ...current,
      product: buildProduct(
        {
          id: current.product.id,
          name: current.product.name,
          subtitle: current.product.subtitle,
          category: current.product.category,
          description: current.product.description,
          rootPL: current.product.rootPL,
          revision: current.product.revision,
          lifecycle: current.product.lifecycle,
          icon: current.product.icon,
        },
        tree,
      ),
      tree: cloneTree(tree),
      updatedAt: new Date().toISOString(),
    };

    drafts[index] = updated;
    safeWriteDrafts(drafts);
    return updated;
  }

  static delete(id: string) {
    safeWriteDrafts(BomDraftService.getAll().filter((draft) => draft.id !== id));
  }
}
