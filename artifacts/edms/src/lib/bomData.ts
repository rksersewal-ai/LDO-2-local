export type NodeType = "assembly" | "sub-assembly" | "part";
export type LifecycleState =
  | "Production"
  | "Prototyping"
  | "In Development"
  | "End of Life"
  | "Active"
  | "Obsolete";
export type DocType =
  | "Drawing"
  | "Specification"
  | "Test Report"
  | "Procedure"
  | "CAD Model"
  | "Datasheet"
  | "Certificate";

export interface LinkedDocument {
  docId: string;
  title: string;
  type: DocType;
  revision: string;
  status: "Approved" | "In Review" | "Draft" | "Obsolete";
  fileType: string;
  size: string;
  date: string;
}
export interface LinkedDrawing {
  drawingId: string;
  title: string;
  sheetNo: string;
  revision: string;
  status: "Released" | "Preliminary" | "Superseded";
  format: string;
}
export interface WhereUsedEntry {
  parentPL: string;
  parentName: string;
  quantity: number;
  findNumber: string;
}
export interface ChangeHistoryEntry {
  changeId: string;
  type: "ECO" | "ECN" | "DCR";
  title: string;
  date: string;
  status: "Implemented" | "Pending" | "Cancelled";
  author: string;
}
export interface PLRecord {
  plNumber: string;
  name: string;
  description: string;
  type: NodeType;
  revision: string;
  lifecycleState: LifecycleState;
  owner: string;
  department: string;
  material?: string;
  weight?: string;
  unitOfMeasure: string;
  classification: string;
  safetyVital: boolean;
  source: "Make" | "Buy" | "Make/Buy";
  supplier?: string;
  supplierPartNo?: string;
  alternates: string[];
  substitutes: string[];
  effectivity: {
    serialFrom?: string;
    serialTo?: string;
    dateFrom: string;
    dateTo?: string;
    lotNumbers?: string[];
  };
  linkedDocuments: LinkedDocument[];
  linkedDrawings: LinkedDrawing[];
  whereUsed: WhereUsedEntry[];
  changeHistory: ChangeHistoryEntry[];
  tags: string[];
  lastModified: string;
  createdDate: string;
}
export interface BOMNode {
  id: string;
  name: string;
  type: NodeType;
  revision: string;
  tags: string[];
  quantity: number;
  findNumber: string;
  unitOfMeasure: string;
  referenceDesignator?: string;
  unitWeightKg?: number;
  unitCost?: number;
  children: BOMNode[];
}
export interface BOMVersion {
  version: number;
  label: string;
  timestamp: string;
  tree: BOMNode[];
}
export interface BOMRollup {
  lineQuantity: number;
  componentInstances: number;
  totalWeightKg: number;
  totalCost: number;
}

export interface Product {
  id: string;
  name: string;
  subtitle: string;
  category: string;
  description: string;
  rootPL: string;
  revision: string;
  lifecycle: LifecycleState;
  lastModified: string;
  assemblies: number;
  parts: number;
  total: number;
  icon: string;
}

export function cloneTree(nodes: BOMNode[]): BOMNode[] {
  return JSON.parse(JSON.stringify(nodes));
}

export function findNode(nodes: BOMNode[], id: string): BOMNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children.length > 0) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function removeNode(
  nodes: BOMNode[],
  id: string,
): { tree: BOMNode[]; removed: BOMNode | null } {
  const tree = cloneTree(nodes);
  let removed: BOMNode | null = null;
  function remove(arr: BOMNode[]): boolean {
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].id === id) {
        removed = arr.splice(i, 1)[0];
        return true;
      }
      if (remove(arr[i].children)) return true;
    }
    return false;
  }
  remove(tree);
  return { tree, removed };
}

export function searchTree(nodes: BOMNode[], query: string): Set<string> {
  const matches = new Set<string>();
  if (!query.trim()) return matches;
  const q = query.toLowerCase();
  function search(arr: BOMNode[], ancestors: string[]): boolean {
    let found = false;
    for (const node of arr) {
      const match =
        node.name.toLowerCase().includes(q) ||
        node.id.toLowerCase().includes(q) ||
        node.tags.some((t) => t.toLowerCase().includes(q));
      const childFound =
        node.children.length > 0 ? search(node.children, [...ancestors, node.id]) : false;
      if (match || childFound) {
        matches.add(node.id);
        ancestors.forEach((a) => {
          matches.add(a);
        });
        found = true;
      }
    }
    return found;
  }
  search(nodes, []);
  return matches;
}

export function countNodes(nodes: BOMNode[]): {
  assemblies: number;
  parts: number;
  total: number;
} {
  let assemblies = 0,
    parts = 0;
  function count(arr: BOMNode[]) {
    for (const n of arr) {
      if (n.type === "part") parts++;
      else assemblies++;
      count(n.children);
    }
  }
  count(nodes);
  return { assemblies, parts, total: assemblies + parts };
}

const UNIT_FAMILY_MAP: Record<string, string> = {
  EA: "count",
  NOS: "count",
  NO: "count",
  SET: "count",
  PAIR: "count",
  KG: "mass",
  G: "mass",
  TON: "mass",
  TONNE: "mass",
  M: "length",
  CM: "length",
  MM: "length",
  L: "volume",
  ML: "volume",
};

function normalizeUnit(uom?: string) {
  return (uom ?? "").trim().toUpperCase();
}

export function getUnitFamily(uom?: string) {
  return UNIT_FAMILY_MAP[normalizeUnit(uom)] ?? normalizeUnit(uom) ?? "";
}

export function areUnitsCompatible(a?: string, b?: string) {
  const aUnit = normalizeUnit(a);
  const bUnit = normalizeUnit(b);

  if (!aUnit || !bUnit) return true;
  if (aUnit === bUnit) return true;

  return getUnitFamily(aUnit) === getUnitFamily(bUnit);
}

export function parseWeightKg(weight?: string): number | null {
  if (!weight) return null;

  const normalized = weight.trim().toLowerCase().replace(/,/g, "");
  const numeric = Number.parseFloat(normalized);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  if (normalized.includes("ton")) return numeric * 1000;
  if (normalized.includes(" g")) return numeric / 1000;
  return numeric;
}

export function getNodeUnitWeightKg(node: BOMNode): number {
  if (typeof node.unitWeightKg === "number" && Number.isFinite(node.unitWeightKg)) {
    return node.unitWeightKg;
  }

  return parseWeightKg(PL_DATABASE[node.id]?.weight) ?? 0;
}

export function estimateUnitCost(node: Pick<BOMNode, "id" | "type" | "unitCost">): number {
  if (typeof node.unitCost === "number" && Number.isFinite(node.unitCost)) {
    return node.unitCost;
  }

  const plRecord = PL_DATABASE[node.id];
  const weightKg = parseWeightKg(plRecord?.weight) ?? 0;
  const sourceRate = plRecord?.source === "Buy" ? 520 : plRecord?.source === "Make/Buy" ? 390 : 280;
  const typeFactor = node.type === "assembly" ? 2.2 : node.type === "sub-assembly" ? 1.55 : 1;

  if (weightKg > 0) {
    return Math.round(weightKg * sourceRate * typeFactor);
  }

  if (node.type === "assembly") return 350000;
  if (node.type === "sub-assembly") return 90000;
  return 12000;
}

function computeSingleUnitRollup(node: BOMNode): Omit<BOMRollup, "lineQuantity"> {
  let componentInstances = 1;
  let totalWeightKg = getNodeUnitWeightKg(node);
  let totalCost = estimateUnitCost(node);

  for (const child of node.children) {
    const childRollup = computeNodeRollup(child);
    componentInstances += childRollup.componentInstances;
    totalWeightKg += childRollup.totalWeightKg;
    totalCost += childRollup.totalCost;
  }

  return { componentInstances, totalWeightKg, totalCost };
}

export function computeNodeRollup(node: BOMNode): BOMRollup {
  const singleUnit = computeSingleUnitRollup(node);
  return {
    lineQuantity: node.quantity,
    componentInstances: singleUnit.componentInstances * node.quantity,
    totalWeightKg: singleUnit.totalWeightKg * node.quantity,
    totalCost: singleUnit.totalCost * node.quantity,
  };
}

export function computeTreeRollup(nodes: BOMNode[]): BOMRollup {
  return nodes.reduce<BOMRollup>(
    (accumulator, node) => {
      const rollup = computeNodeRollup(node);
      return {
        lineQuantity: accumulator.lineQuantity + rollup.lineQuantity,
        componentInstances: accumulator.componentInstances + rollup.componentInstances,
        totalWeightKg: accumulator.totalWeightKg + rollup.totalWeightKg,
        totalCost: accumulator.totalCost + rollup.totalCost,
      };
    },
    {
      lineQuantity: 0,
      componentInstances: 0,
      totalWeightKg: 0,
      totalCost: 0,
    },
  );
}

export function getAncestorIds(
  nodes: BOMNode[],
  targetId: string,
  ancestors: string[] = [],
): string[] {
  for (const node of nodes) {
    if (node.id === targetId) {
      return ancestors;
    }

    const nextAncestors = getAncestorIds(node.children, targetId, [...ancestors, node.id]);
    if (nextAncestors.length > 0) {
      return nextAncestors;
    }
  }

  return [];
}

export function getDescendantIds(node: BOMNode): string[] {
  const descendants: string[] = [];

  function collect(children: BOMNode[]) {
    for (const child of children) {
      descendants.push(child.id);
      collect(child.children);
    }
  }

  collect(node.children);
  return descendants;
}

export const PL_DATABASE: Record<string, PLRecord> = {
  "38100000": {
    plNumber: "38100000",
    name: "WAP7 Locomotive",
    description:
      "Complete WAP7 class 25kV AC electric locomotive assembly for Indian Railways mainline passenger service. 6120 HP traction power with regenerative braking capability.",
    type: "assembly",
    revision: "D",
    lifecycleState: "Production",
    owner: "R. Krishnamurthy",
    department: "Locomotive Design Bureau",
    weight: "123,000 kg",
    unitOfMeasure: "EA",
    classification: "Rolling Stock — Electric Locomotive",
    safetyVital: true,
    source: "Make",
    alternates: [],
    substitutes: [],
    effectivity: {
      dateFrom: "2024-01-01",
      serialFrom: "WAP7-30601",
      serialTo: "WAP7-30650",
    },
    linkedDocuments: [
      {
        docId: "DOC-2026-0001",
        title: "WAP7 General Arrangement Drawing",
        type: "Drawing",
        revision: "D.2",
        status: "Approved",
        fileType: "PDF",
        size: "24.5 MB",
        date: "2025-11-15",
      },
      {
        docId: "DOC-2026-0002",
        title: "Type Test Certificate — WAP7 Locomotive",
        type: "Certificate",
        revision: "C.1",
        status: "Approved",
        fileType: "PDF",
        size: "8.2 MB",
        date: "2025-08-20",
      },
      {
        docId: "DOC-2026-0003",
        title: "WAP7 Maintenance Manual Volume I",
        type: "Procedure",
        revision: "D.0",
        status: "Approved",
        fileType: "PDF",
        size: "156 MB",
        date: "2026-01-10",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-WAP7-GA-001",
        title: "General Arrangement — Side Elevation",
        sheetNo: "1/4",
        revision: "D.2",
        status: "Released",
        format: "A0",
      },
      {
        drawingId: "DWG-WAP7-GA-002",
        title: "General Arrangement — Plan View",
        sheetNo: "2/4",
        revision: "D.2",
        status: "Released",
        format: "A0",
      },
      {
        drawingId: "DWG-WAP7-WD-001",
        title: "Main Wiring Diagram",
        sheetNo: "1/12",
        revision: "C.4",
        status: "Released",
        format: "A1",
      },
    ],
    whereUsed: [],
    changeHistory: [
      {
        changeId: "ECO-2025-1102",
        type: "ECO",
        title: "Upgrade traction motor insulation class to H",
        date: "2025-09-15",
        status: "Implemented",
        author: "A. Sharma",
      },
      {
        changeId: "ECN-2026-0034",
        type: "ECN",
        title: "Rev D release for serial 30601+ batch",
        date: "2026-01-10",
        status: "Implemented",
        author: "R. Krishnamurthy",
      },
    ],
    tags: ["Railway", "Production", "Electric", "25kV AC"],
    lastModified: "2026-03-20",
    createdDate: "2022-04-01",
  },
  "38110000": {
    plNumber: "38110000",
    name: "Bogie Assembly",
    description:
      "Complete bogie frame assembly with primary/secondary suspension, wheelsets, brake rigging, and traction motor mounting.",
    type: "sub-assembly",
    revision: "C",
    lifecycleState: "Production",
    owner: "D. Mukherjee",
    department: "Bogie Design Division",
    material: "IS 2062 Grade E350 Steel",
    weight: "12,800 kg",
    unitOfMeasure: "EA",
    classification: "Underframe — Bogie",
    safetyVital: true,
    source: "Make",
    alternates: ["38110500"],
    substitutes: [],
    effectivity: { dateFrom: "2024-01-01", serialFrom: "WAP7-30601" },
    linkedDocuments: [
      {
        docId: "DOC-2026-1101",
        title: "Bogie Frame Stress Analysis Report",
        type: "Test Report",
        revision: "C.0",
        status: "Approved",
        fileType: "PDF",
        size: "34.2 MB",
        date: "2025-06-10",
      },
      {
        docId: "DOC-2026-1102",
        title: "Bogie Assembly Procedure",
        type: "Procedure",
        revision: "B.3",
        status: "Approved",
        fileType: "PDF",
        size: "18.5 MB",
        date: "2025-09-22",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-BOG-ASM-001",
        title: "Bogie Assembly — General Arrangement",
        sheetNo: "1/6",
        revision: "C.0",
        status: "Released",
        format: "A0",
      },
    ],
    whereUsed: [
      {
        parentPL: "38100000",
        parentName: "WAP7 Locomotive",
        quantity: 2,
        findNumber: "10",
      },
    ],
    changeHistory: [
      {
        changeId: "ECO-2025-0887",
        type: "ECO",
        title: "Modify bogie frame gusset plate thickness",
        date: "2025-03-20",
        status: "Implemented",
        author: "D. Mukherjee",
      },
    ],
    tags: ["Structural", "Safety Vital", "Fabricated"],
    lastModified: "2026-02-15",
    createdDate: "2022-06-15",
  },
  "38111000": {
    plNumber: "38111000",
    name: "Brake System",
    description:
      "Complete pneumatic-hydraulic braking assembly including brake cylinders, brake rigging, slack adjuster, and brake blocks.",
    type: "sub-assembly",
    revision: "B.2",
    lifecycleState: "Production",
    owner: "S. Patel",
    department: "Brake Systems Division",
    weight: "1,450 kg",
    unitOfMeasure: "EA",
    classification: "Safety System — Braking",
    safetyVital: true,
    source: "Make",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2024-01-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-1201",
        title: "Brake System Type Test Report",
        type: "Test Report",
        revision: "B.2",
        status: "Approved",
        fileType: "PDF",
        size: "42.1 MB",
        date: "2025-04-18",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-BRK-ASM-001",
        title: "Brake Rigging Assembly",
        sheetNo: "1/3",
        revision: "B.2",
        status: "Released",
        format: "A1",
      },
    ],
    whereUsed: [
      {
        parentPL: "38110000",
        parentName: "Bogie Assembly",
        quantity: 1,
        findNumber: "10",
      },
    ],
    changeHistory: [
      {
        changeId: "ECO-2025-0912",
        type: "ECO",
        title: "Change brake block composite material",
        date: "2025-06-22",
        status: "Implemented",
        author: "S. Patel",
      },
    ],
    tags: ["Safety Vital", "Hydraulic", "Pneumatic"],
    lastModified: "2026-01-10",
    createdDate: "2022-08-01",
  },
  "38120000": {
    plNumber: "38120000",
    name: "Traction System",
    description:
      "Complete traction system including traction motor, gearbox, and motor suspension arrangement. 6120 HP total output.",
    type: "sub-assembly",
    revision: "B",
    lifecycleState: "Production",
    owner: "A. Sharma",
    department: "Electrical Design Division",
    weight: "4,200 kg",
    unitOfMeasure: "EA",
    classification: "Electrical — Traction",
    safetyVital: true,
    source: "Make",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2024-01-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-2001",
        title: "Traction Motor Type Test Report",
        type: "Test Report",
        revision: "B.0",
        status: "Approved",
        fileType: "PDF",
        size: "28.4 MB",
        date: "2025-04-10",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-TRC-MTR-001",
        title: "Traction Motor Assembly",
        sheetNo: "1/5",
        revision: "B.0",
        status: "Released",
        format: "A1",
      },
    ],
    whereUsed: [
      {
        parentPL: "38110000",
        parentName: "Bogie Assembly",
        quantity: 3,
        findNumber: "20",
      },
    ],
    changeHistory: [
      {
        changeId: "ECO-2025-1102",
        type: "ECO",
        title: "Upgrade insulation class to H",
        date: "2025-09-15",
        status: "Implemented",
        author: "A. Sharma",
      },
    ],
    tags: ["Electrical", "Traction Motor", "Safety Vital"],
    lastModified: "2026-02-01",
    createdDate: "2022-07-10",
  },
  "38130000": {
    plNumber: "38130000",
    name: "Main Transformer",
    description:
      "25kV single-phase to multi-winding transformer for traction and auxiliary power supply. ODAF cooling.",
    type: "sub-assembly",
    revision: "C",
    lifecycleState: "Production",
    owner: "P. Gupta",
    department: "Transformer Division",
    weight: "14,800 kg",
    unitOfMeasure: "EA",
    classification: "Electrical — Transformer",
    safetyVital: true,
    source: "Buy",
    supplier: "ABB Ltd.",
    supplierPartNo: "TRAX-TM-WAP7-C",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2024-01-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-3001",
        title: "Transformer Routine Test Certificate",
        type: "Certificate",
        revision: "C.0",
        status: "Approved",
        fileType: "PDF",
        size: "15.6 MB",
        date: "2025-10-28",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-TFR-ASM-001",
        title: "Transformer Outline Drawing",
        sheetNo: "1/2",
        revision: "C.0",
        status: "Released",
        format: "A1",
      },
    ],
    whereUsed: [
      {
        parentPL: "38100000",
        parentName: "WAP7 Locomotive",
        quantity: 1,
        findNumber: "30",
      },
    ],
    changeHistory: [],
    tags: ["Electrical", "Transformer", "High Voltage"],
    lastModified: "2026-01-20",
    createdDate: "2022-09-01",
  },
  "38140000": {
    plNumber: "38140000",
    name: "Control Electronics Cabinet",
    description:
      "Integrated power electronics and control system cabinet. Houses TCMS, converters, and protection relays.",
    type: "sub-assembly",
    revision: "B.3",
    lifecycleState: "Production",
    owner: "K. Joshi",
    department: "Electronics Division",
    weight: "850 kg",
    unitOfMeasure: "EA",
    classification: "Electronics — Control",
    safetyVital: true,
    source: "Make",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2024-01-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-4001",
        title: "Control System Architecture Specification",
        type: "Specification",
        revision: "B.3",
        status: "Approved",
        fileType: "PDF",
        size: "22.1 MB",
        date: "2025-12-05",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-ELC-CAB-001",
        title: "Control Cabinet Internal Layout",
        sheetNo: "1/4",
        revision: "B.3",
        status: "Released",
        format: "A1",
      },
    ],
    whereUsed: [
      {
        parentPL: "38100000",
        parentName: "WAP7 Locomotive",
        quantity: 1,
        findNumber: "40",
      },
    ],
    changeHistory: [
      {
        changeId: "ECN-2025-0445",
        type: "ECN",
        title: "Add TCMS redundancy module",
        date: "2025-07-15",
        status: "Implemented",
        author: "K. Joshi",
      },
    ],
    tags: ["Electronics", "TCMS", "Safety Vital", "High Voltage"],
    lastModified: "2026-02-28",
    createdDate: "2022-10-01",
  },
  "38150000": {
    plNumber: "38150000",
    name: "Pantograph & Current Collection",
    description:
      "Roof-mounted pantograph assembly for 25kV OHE current collection. Pneumatically raised/lowered.",
    type: "sub-assembly",
    revision: "A.5",
    lifecycleState: "Production",
    owner: "M. Reddy",
    department: "Current Collection Division",
    weight: "320 kg",
    unitOfMeasure: "EA",
    classification: "Electrical — Current Collection",
    safetyVital: true,
    source: "Buy",
    supplier: "Stemmann-Technik GmbH",
    supplierPartNo: "SBD-25-WAP7",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2024-01-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-5001",
        title: "Pantograph Type Test Report",
        type: "Test Report",
        revision: "A.5",
        status: "Approved",
        fileType: "PDF",
        size: "18.2 MB",
        date: "2025-05-20",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-PAN-ASM-001",
        title: "Pantograph Installation Drawing",
        sheetNo: "1/2",
        revision: "A.5",
        status: "Released",
        format: "A1",
      },
    ],
    whereUsed: [
      {
        parentPL: "38100000",
        parentName: "WAP7 Locomotive",
        quantity: 2,
        findNumber: "50",
      },
    ],
    changeHistory: [],
    tags: ["High Voltage", "Pantograph", "Safety Vital", "Wear Item"],
    lastModified: "2025-12-15",
    createdDate: "2022-11-01",
  },

  // ─── WAG-9HC Freight Locomotive ─────────────────────────────────────────
  "46100000": {
    plNumber: "46100000",
    name: "WAG-9HC Locomotive",
    description:
      "9000 HP 25kV AC freight locomotive with regenerative braking. High-capacity variant for heavy freight corridors.",
    type: "assembly",
    revision: "C.1",
    lifecycleState: "Production",
    owner: "B. Srinivasan",
    department: "Locomotive Design Bureau",
    weight: "128,500 kg",
    unitOfMeasure: "EA",
    classification: "Rolling Stock — Electric Freight Locomotive",
    safetyVital: true,
    source: "Make",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2023-06-01", serialFrom: "WAG9-52001" },
    linkedDocuments: [
      {
        docId: "DOC-2026-6001",
        title: "WAG-9HC General Arrangement Drawing",
        type: "Drawing",
        revision: "C.1",
        status: "Approved",
        fileType: "PDF",
        size: "28.3 MB",
        date: "2025-10-05",
      },
      {
        docId: "DOC-2026-6002",
        title: "Type Test Certificate — WAG-9HC",
        type: "Certificate",
        revision: "B.0",
        status: "Approved",
        fileType: "PDF",
        size: "9.5 MB",
        date: "2025-07-12",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-WAG9-GA-001",
        title: "WAG-9HC GA — Side Elevation",
        sheetNo: "1/4",
        revision: "C.1",
        status: "Released",
        format: "A0",
      },
    ],
    whereUsed: [],
    changeHistory: [
      {
        changeId: "ECO-2025-2210",
        type: "ECO",
        title: "HC variant — upgrade to 9000HP traction",
        date: "2025-04-01",
        status: "Implemented",
        author: "B. Srinivasan",
      },
    ],
    tags: ["Freight", "Production", "Electric", "25kV AC", "9000HP"],
    lastModified: "2026-02-15",
    createdDate: "2021-03-01",
  },
  "46110000": {
    plNumber: "46110000",
    name: "Power Bogie Assembly",
    description:
      "WAG-9HC powered bogie with 6 axle-hung traction motors, primary/secondary suspension, and braking system.",
    type: "sub-assembly",
    revision: "C",
    lifecycleState: "Production",
    owner: "T. Rajan",
    department: "Bogie Design Division",
    material: "IS 2062 Grade E410 Steel",
    weight: "16,400 kg",
    unitOfMeasure: "EA",
    classification: "Underframe — Power Bogie",
    safetyVital: true,
    source: "Make",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2023-06-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-6101",
        title: "WAG9 Power Bogie Stress Analysis",
        type: "Test Report",
        revision: "C.0",
        status: "Approved",
        fileType: "PDF",
        size: "41.0 MB",
        date: "2025-08-20",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-WAG9-BOG-001",
        title: "Power Bogie GA",
        sheetNo: "1/5",
        revision: "C.0",
        status: "Released",
        format: "A0",
      },
    ],
    whereUsed: [
      {
        parentPL: "46100000",
        parentName: "WAG-9HC Locomotive",
        quantity: 3,
        findNumber: "10",
      },
    ],
    changeHistory: [],
    tags: ["Structural", "Safety Vital", "Fabricated"],
    lastModified: "2026-01-20",
    createdDate: "2021-06-01",
  },
  "46111000": {
    plNumber: "46111000",
    name: "WAG9 Traction Motor (TAO-659)",
    description:
      "3-phase squirrel cage induction traction motor for WAG-9 class. 850 kW continuous rating, axle-hung nose-suspended.",
    type: "sub-assembly",
    revision: "B.1",
    lifecycleState: "Production",
    owner: "V. Krishnan",
    department: "Electrical Design Division",
    weight: "1,850 kg",
    unitOfMeasure: "EA",
    classification: "Electrical — Traction Motor",
    safetyVital: true,
    source: "Make",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2023-06-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-6201",
        title: "TAO-659 Type Test Report",
        type: "Test Report",
        revision: "B.1",
        status: "Approved",
        fileType: "PDF",
        size: "32.0 MB",
        date: "2025-05-15",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-TAO-659-001",
        title: "TAO-659 Motor Assembly Drawing",
        sheetNo: "1/6",
        revision: "B.1",
        status: "Released",
        format: "A1",
      },
    ],
    whereUsed: [
      {
        parentPL: "46110000",
        parentName: "Power Bogie Assembly",
        quantity: 2,
        findNumber: "10",
      },
    ],
    changeHistory: [],
    tags: ["Electrical", "Traction Motor", "Safety Vital", "3-Phase"],
    lastModified: "2025-12-01",
    createdDate: "2021-07-01",
  },
  "46112000": {
    plNumber: "46112000",
    name: "Brake Rigging Assembly",
    description:
      "Pneumatic brake rigging with distributor valve, brake cylinders, and composite brake blocks for WAG-9 bogie.",
    type: "sub-assembly",
    revision: "B",
    lifecycleState: "Production",
    owner: "R. Desai",
    department: "Brake Systems Division",
    weight: "680 kg",
    unitOfMeasure: "EA",
    classification: "Safety System — Braking",
    safetyVital: true,
    source: "Make",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2023-06-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-6301",
        title: "WAG9 Brake Type Test",
        type: "Test Report",
        revision: "B.0",
        status: "Approved",
        fileType: "PDF",
        size: "38.0 MB",
        date: "2025-03-10",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-WAG9-BRK-001",
        title: "Brake Rigging Layout",
        sheetNo: "1/3",
        revision: "B.0",
        status: "Released",
        format: "A1",
      },
    ],
    whereUsed: [
      {
        parentPL: "46110000",
        parentName: "Power Bogie Assembly",
        quantity: 1,
        findNumber: "20",
      },
    ],
    changeHistory: [],
    tags: ["Safety Vital", "Pneumatic", "Wear Item"],
    lastModified: "2025-11-15",
    createdDate: "2021-09-01",
  },
  "46113000": {
    plNumber: "46113000",
    name: "Axle & Wheelset Assembly",
    description:
      "Solid axle with fitted wheels, bearings, and speed sensor. 1676mm gauge. UIC 812 standard.",
    type: "sub-assembly",
    revision: "A.3",
    lifecycleState: "Production",
    owner: "G. Pandey",
    department: "Mechanical Division",
    material: "EN 13260 Grade EA4T",
    weight: "2,200 kg",
    unitOfMeasure: "EA",
    classification: "Running Gear — Wheelset",
    safetyVital: true,
    source: "Buy",
    supplier: "Vossloh AG",
    supplierPartNo: "WS-1676-EA4T",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2023-06-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-6401",
        title: "Wheelset Inspection Certificate",
        type: "Certificate",
        revision: "A.3",
        status: "Approved",
        fileType: "PDF",
        size: "4.5 MB",
        date: "2026-01-08",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-WS-1676-001",
        title: "Wheelset Assembly Drawing",
        sheetNo: "1/2",
        revision: "A.3",
        status: "Released",
        format: "A1",
      },
    ],
    whereUsed: [
      {
        parentPL: "46110000",
        parentName: "Power Bogie Assembly",
        quantity: 2,
        findNumber: "30",
      },
    ],
    changeHistory: [],
    tags: ["Mechanical", "Safety Vital", "Running Gear"],
    lastModified: "2026-01-08",
    createdDate: "2021-10-01",
  },
  "46120000": {
    plNumber: "46120000",
    name: "Roof Equipment Assembly",
    description:
      "Roof-mounted high-voltage equipment including transformer, pantograph, and surge arrestors.",
    type: "sub-assembly",
    revision: "B.2",
    lifecycleState: "Production",
    owner: "N. Sharma",
    department: "High Voltage Systems",
    weight: "18,600 kg",
    unitOfMeasure: "EA",
    classification: "Electrical — Roof Equipment",
    safetyVital: true,
    source: "Make",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2023-06-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-6501",
        title: "Roof Equipment Layout Drawing",
        type: "Drawing",
        revision: "B.2",
        status: "Approved",
        fileType: "PDF",
        size: "12.0 MB",
        date: "2025-09-01",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-WAG9-ROOF-001",
        title: "Roof Equipment Layout",
        sheetNo: "1/3",
        revision: "B.2",
        status: "Released",
        format: "A0",
      },
    ],
    whereUsed: [
      {
        parentPL: "46100000",
        parentName: "WAG-9HC Locomotive",
        quantity: 1,
        findNumber: "20",
      },
    ],
    changeHistory: [],
    tags: ["High Voltage", "Electrical", "Safety Vital"],
    lastModified: "2025-09-20",
    createdDate: "2021-11-01",
  },
  "46121000": {
    plNumber: "46121000",
    name: "Main Transformer 9000HP",
    description:
      "25kV single-phase traction transformer for WAG-9HC. 7.2 MVA rating, ODAF cooling with thermal monitoring.",
    type: "sub-assembly",
    revision: "B.1",
    lifecycleState: "Production",
    owner: "P. Gupta",
    department: "Transformer Division",
    weight: "15,200 kg",
    unitOfMeasure: "EA",
    classification: "Electrical — Transformer",
    safetyVital: true,
    source: "Buy",
    supplier: "Siemens Energy",
    supplierPartNo: "SFT-7200-25KV",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2023-06-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-6601",
        title: "Transformer Test Certificate WAG9",
        type: "Certificate",
        revision: "B.1",
        status: "Approved",
        fileType: "PDF",
        size: "11.0 MB",
        date: "2025-10-15",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-TFR-WAG9-001",
        title: "Transformer Outline Drawing WAG9",
        sheetNo: "1/2",
        revision: "B.1",
        status: "Released",
        format: "A1",
      },
    ],
    whereUsed: [
      {
        parentPL: "46120000",
        parentName: "Roof Equipment Assembly",
        quantity: 1,
        findNumber: "10",
      },
    ],
    changeHistory: [],
    tags: ["Electrical", "Transformer", "High Voltage", "Safety Vital"],
    lastModified: "2025-10-30",
    createdDate: "2022-01-01",
  },
  "46122000": {
    plNumber: "46122000",
    name: "Pantograph DSA380",
    description:
      "Roof pantograph for WAG-9HC. DSA380 type, pneumatically operated, suitable for 25kV/50Hz overhead equipment.",
    type: "part",
    revision: "A.2",
    lifecycleState: "Production",
    owner: "M. Reddy",
    department: "Current Collection Division",
    weight: "48 kg",
    unitOfMeasure: "EA",
    classification: "Electrical — Current Collection",
    safetyVital: true,
    source: "Buy",
    supplier: "Stemmann-Technik GmbH",
    supplierPartNo: "DSA380-WAG9",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2023-06-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-6701",
        title: "DSA380 Type Test Certificate",
        type: "Certificate",
        revision: "A.2",
        status: "Approved",
        fileType: "PDF",
        size: "6.5 MB",
        date: "2025-06-20",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-PAN-DSA380-001",
        title: "DSA380 Installation Drawing",
        sheetNo: "1/2",
        revision: "A.2",
        status: "Released",
        format: "A1",
      },
    ],
    whereUsed: [
      {
        parentPL: "46120000",
        parentName: "Roof Equipment Assembly",
        quantity: 2,
        findNumber: "20",
      },
    ],
    changeHistory: [],
    tags: ["High Voltage", "Pantograph", "Safety Vital", "Wear Item"],
    lastModified: "2025-06-30",
    createdDate: "2022-02-01",
  },
  "46130000": {
    plNumber: "46130000",
    name: "IGBT Converter Cabinet",
    description:
      "Power electronics cabinet housing 4-quadrant converters, auxiliary converters, and protection circuitry for WAG-9HC.",
    type: "sub-assembly",
    revision: "B.3",
    lifecycleState: "Production",
    owner: "K. Joshi",
    department: "Electronics Division",
    weight: "1,200 kg",
    unitOfMeasure: "EA",
    classification: "Electronics — Power Converter",
    safetyVital: true,
    source: "Make",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2023-06-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-6801",
        title: "IGBT Converter Architecture Spec",
        type: "Specification",
        revision: "B.3",
        status: "Approved",
        fileType: "PDF",
        size: "24.5 MB",
        date: "2025-11-10",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-IGBT-CAB-001",
        title: "Converter Cabinet Layout",
        sheetNo: "1/5",
        revision: "B.3",
        status: "Released",
        format: "A1",
      },
    ],
    whereUsed: [
      {
        parentPL: "46100000",
        parentName: "WAG-9HC Locomotive",
        quantity: 1,
        findNumber: "30",
      },
    ],
    changeHistory: [],
    tags: ["Electronics", "IGBT", "High Voltage", "Safety Vital"],
    lastModified: "2025-12-20",
    createdDate: "2022-03-01",
  },
  "46131000": {
    plNumber: "46131000",
    name: "4-Quadrant Converter Module",
    description:
      "IGBT-based 4QC module for WAG-9HC traction control. Enables regenerative braking and power quality improvement.",
    type: "sub-assembly",
    revision: "B.1",
    lifecycleState: "Production",
    owner: "A. Mehta",
    department: "Electronics Division",
    weight: "280 kg",
    unitOfMeasure: "EA",
    classification: "Electronics — 4QC",
    safetyVital: true,
    source: "Buy",
    supplier: "BHEL Bhopal",
    supplierPartNo: "4QC-WAG9-B1",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2023-06-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-6901",
        title: "4QC Module Test Report",
        type: "Test Report",
        revision: "B.1",
        status: "Approved",
        fileType: "PDF",
        size: "18.0 MB",
        date: "2025-09-05",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-4QC-001",
        title: "4QC Module Layout",
        sheetNo: "1/4",
        revision: "B.1",
        status: "Released",
        format: "A1",
      },
    ],
    whereUsed: [
      {
        parentPL: "46130000",
        parentName: "IGBT Converter Cabinet",
        quantity: 2,
        findNumber: "10",
      },
    ],
    changeHistory: [],
    tags: ["Electronics", "IGBT", "Regenerative", "Safety Vital"],
    lastModified: "2025-10-01",
    createdDate: "2022-04-01",
  },
  "46140000": {
    plNumber: "46140000",
    name: "Driver's Cab Assembly",
    description:
      "Operator cab with ergonomic desk, LOCOTROL interface, speed display, and safety control systems.",
    type: "sub-assembly",
    revision: "A.4",
    lifecycleState: "Production",
    owner: "C. Rajan",
    department: "Cab Design Division",
    weight: "3,800 kg",
    unitOfMeasure: "EA",
    classification: "Structure — Driver's Cab",
    safetyVital: true,
    source: "Make",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2023-06-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-7001",
        title: "Cab Ergonomics Assessment Report",
        type: "Test Report",
        revision: "A.4",
        status: "Approved",
        fileType: "PDF",
        size: "15.5 MB",
        date: "2025-08-15",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-CAB-WAG9-001",
        title: "Driver's Cab GA",
        sheetNo: "1/4",
        revision: "A.4",
        status: "Released",
        format: "A1",
      },
    ],
    whereUsed: [
      {
        parentPL: "46100000",
        parentName: "WAG-9HC Locomotive",
        quantity: 2,
        findNumber: "40",
      },
    ],
    changeHistory: [],
    tags: ["Structure", "Ergonomics", "LOCOTROL"],
    lastModified: "2025-09-01",
    createdDate: "2022-05-01",
  },
  "46141000": {
    plNumber: "46141000",
    name: "LOCOTROL Remote Control Unit",
    description:
      "Distributed power control system enabling remote MU operation. LOCOTROL Bxx model.",
    type: "part",
    revision: "A.1",
    lifecycleState: "Production",
    owner: "L. Kumar",
    department: "Control Systems Division",
    weight: "12 kg",
    unitOfMeasure: "EA",
    classification: "Electronics — Control",
    safetyVital: true,
    source: "Buy",
    supplier: "Wabtec Corporation",
    supplierPartNo: "LOCOTROL-BXX-A1",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2023-06-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-7101",
        title: "LOCOTROL Integration Manual",
        type: "Specification",
        revision: "A.1",
        status: "Approved",
        fileType: "PDF",
        size: "9.0 MB",
        date: "2025-07-01",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-LCTR-001",
        title: "LOCOTROL Unit Installation",
        sheetNo: "1/2",
        revision: "A.1",
        status: "Released",
        format: "A3",
      },
    ],
    whereUsed: [
      {
        parentPL: "46140000",
        parentName: "Driver's Cab Assembly",
        quantity: 1,
        findNumber: "10",
      },
    ],
    changeHistory: [],
    tags: ["Electronics", "Safety Vital", "LOCOTROL", "Remote Control"],
    lastModified: "2025-07-15",
    createdDate: "2022-06-01",
  },
  "46142000": {
    plNumber: "46142000",
    name: "Cab Desk Assembly",
    description:
      "Operator desk with controls, indicators, vigilance device (ZTCS), cab signalling display, and emergency stop.",
    type: "part",
    revision: "A.2",
    lifecycleState: "Production",
    owner: "C. Rajan",
    department: "Cab Design Division",
    weight: "185 kg",
    unitOfMeasure: "EA",
    classification: "Structure — Control Desk",
    safetyVital: true,
    source: "Make",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2023-06-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-7201",
        title: "Cab Desk Interface Specification",
        type: "Specification",
        revision: "A.2",
        status: "Approved",
        fileType: "PDF",
        size: "7.0 MB",
        date: "2025-06-10",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-DESK-001",
        title: "Control Desk Layout",
        sheetNo: "1/3",
        revision: "A.2",
        status: "Released",
        format: "A1",
      },
    ],
    whereUsed: [
      {
        parentPL: "46140000",
        parentName: "Driver's Cab Assembly",
        quantity: 1,
        findNumber: "20",
      },
    ],
    changeHistory: [],
    tags: ["Ergonomics", "Safety Vital", "ZTCS"],
    lastModified: "2025-06-20",
    createdDate: "2022-07-01",
  },
  "46132000": {
    plNumber: "46132000",
    name: "Auxiliary Converter Module",
    description:
      "Auxiliary power converter supplying 3-phase 415V 50Hz for hotel loads: lighting, fans, battery charger, and compressor.",
    type: "sub-assembly",
    revision: "B.1",
    lifecycleState: "Production",
    owner: "M. Iyer",
    department: "Electronics Division",
    weight: "145 kg",
    unitOfMeasure: "EA",
    classification: "Electronics — Auxiliary Converter",
    safetyVital: false,
    source: "Buy",
    supplier: "Medha Servo Drives",
    supplierPartNo: "AUX-CONV-415V-B1",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2023-01-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-7301",
        title: "Auxiliary Converter Test Report",
        type: "Test Report",
        revision: "B.1",
        status: "Approved",
        fileType: "PDF",
        size: "11.0 MB",
        date: "2025-05-10",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-AUXCONV-001",
        title: "Aux Converter Installation Schematic",
        sheetNo: "1/2",
        revision: "B.1",
        status: "Released",
        format: "A2",
      },
    ],
    whereUsed: [
      {
        parentPL: "46130000",
        parentName: "IGBT Converter Cabinet",
        quantity: 1,
        findNumber: "20",
      },
    ],
    changeHistory: [],
    tags: ["Electronics", "Auxiliary Power", "415V"],
    lastModified: "2025-06-01",
    createdDate: "2022-01-01",
  },
  "46143000": {
    plNumber: "46143000",
    name: "Cab Air Conditioning Unit",
    description:
      "Roof-mounted cab A/C unit. 5kW cooling, 3kW heating. Automatic temperature control, air filtration.",
    type: "part",
    revision: "A.1",
    lifecycleState: "Production",
    owner: "C. Rajan",
    department: "Cab Design Division",
    weight: "78 kg",
    unitOfMeasure: "EA",
    classification: "HVAC — Cab Comfort",
    safetyVital: false,
    source: "Buy",
    supplier: "Behr India Ltd",
    supplierPartNo: "CAB-AC-5KW-A1",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2023-06-01" },
    linkedDocuments: [],
    linkedDrawings: [
      {
        drawingId: "DWG-CAB-AC-001",
        title: "Cab A/C Mounting Layout",
        sheetNo: "1/1",
        revision: "A.1",
        status: "Released",
        format: "A3",
      },
    ],
    whereUsed: [
      {
        parentPL: "46140000",
        parentName: "Driver's Cab Assembly",
        quantity: 1,
        findNumber: "30",
      },
    ],
    changeHistory: [],
    tags: ["HVAC", "Cab Comfort", "Electrical"],
    lastModified: "2025-05-01",
    createdDate: "2022-08-01",
  },
  "46150000": {
    plNumber: "46150000",
    name: "Sanding System Assembly",
    description:
      "Gravity-fed pneumatic sanding system for wheel-rail adhesion improvement. Tank capacity 70 kg per axle.",
    type: "sub-assembly",
    revision: "A.2",
    lifecycleState: "Production",
    owner: "D. Pillai",
    department: "Bogie Design Division",
    weight: "42 kg",
    unitOfMeasure: "EA",
    classification: "Running Gear — Adhesion Control",
    safetyVital: true,
    source: "Make",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2023-01-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-7401",
        title: "Sanding System Procedure",
        type: "Procedure",
        revision: "A.2",
        status: "Approved",
        fileType: "PDF",
        size: "5.5 MB",
        date: "2025-04-20",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-SAND-001",
        title: "Sanding System Layout",
        sheetNo: "1/2",
        revision: "A.2",
        status: "Released",
        format: "A2",
      },
    ],
    whereUsed: [
      {
        parentPL: "46100000",
        parentName: "WAG-9HC Locomotive",
        quantity: 6,
        findNumber: "50",
      },
    ],
    changeHistory: [],
    tags: ["Adhesion Control", "Safety Vital", "Pneumatic"],
    lastModified: "2025-04-30",
    createdDate: "2022-03-01",
  },
  "46160000": {
    plNumber: "46160000",
    name: "Horn & Warning System",
    description:
      "Dual-tone electropneumatic horn (high 475Hz / low 370Hz) with compressor bypass relay for tunnels.",
    type: "part",
    revision: "A.1",
    lifecycleState: "Production",
    owner: "C. Rajan",
    department: "Cab Design Division",
    weight: "8 kg",
    unitOfMeasure: "EA",
    classification: "Safety System — Warning",
    safetyVital: true,
    source: "Buy",
    supplier: "Roots Industries India Ltd",
    supplierPartNo: "HORN-DT-475-A1",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2023-06-01" },
    linkedDocuments: [],
    linkedDrawings: [],
    whereUsed: [
      {
        parentPL: "46100000",
        parentName: "WAG-9HC Locomotive",
        quantity: 2,
        findNumber: "60",
      },
    ],
    changeHistory: [],
    tags: ["Safety Vital", "Warning", "Pneumatic"],
    lastModified: "2025-03-01",
    createdDate: "2022-04-01",
  },

  // ─── DETC Double-Deck EMU ─────────────────────────────────────────────────
  "52000000": {
    plNumber: "52000000",
    name: "DETC Motor Coach",
    description:
      "Double-Deck Electric Multiple Unit motor coach for high-density suburban and intercity corridors. 200 kph design speed.",
    type: "assembly",
    revision: "B",
    lifecycleState: "In Development",
    owner: "A. Verma",
    department: "EMU Design Bureau",
    weight: "56,000 kg",
    unitOfMeasure: "EA",
    classification: "Rolling Stock — EMU Motor Coach",
    safetyVital: true,
    source: "Make",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2026-01-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-8001",
        title: "DETC Motor Coach General Arrangement",
        type: "Drawing",
        revision: "B.0",
        status: "In Review",
        fileType: "PDF",
        size: "32.0 MB",
        date: "2025-12-20",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-DETC-GA-001",
        title: "DETC Motor Coach GA",
        sheetNo: "1/6",
        revision: "B.0",
        status: "Preliminary",
        format: "A0",
      },
    ],
    whereUsed: [],
    changeHistory: [
      {
        changeId: "ECN-2025-0701",
        type: "ECN",
        title: "Rev B — incorporate prototype feedback",
        date: "2025-10-20",
        status: "Implemented",
        author: "A. Verma",
      },
    ],
    tags: ["EMU", "Double-Deck", "In Development", "200kph"],
    lastModified: "2026-01-10",
    createdDate: "2023-04-01",
  },
  "52010000": {
    plNumber: "52010000",
    name: "Underframe Assembly",
    description:
      "Structural underframe with anti-climbing device, side buffers, and coupler interface for DETC motor coach.",
    type: "sub-assembly",
    revision: "B",
    lifecycleState: "In Development",
    owner: "P. Singh",
    department: "Structure Division",
    material: "EN 10025-4 S355 Steel",
    weight: "8,200 kg",
    unitOfMeasure: "EA",
    classification: "Structure — Underframe",
    safetyVital: true,
    source: "Make",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2026-01-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-8101",
        title: "DETC Underframe FEA Report",
        type: "Test Report",
        revision: "B.0",
        status: "Draft",
        fileType: "PDF",
        size: "28.0 MB",
        date: "2025-11-15",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-DETC-UF-001",
        title: "Underframe Assembly GA",
        sheetNo: "1/5",
        revision: "B.0",
        status: "Preliminary",
        format: "A0",
      },
    ],
    whereUsed: [
      {
        parentPL: "52000000",
        parentName: "DETC Motor Coach",
        quantity: 1,
        findNumber: "10",
      },
    ],
    changeHistory: [],
    tags: ["Structural", "Safety Vital", "Fabricated"],
    lastModified: "2026-01-05",
    createdDate: "2023-06-01",
  },
  "52011000": {
    plNumber: "52011000",
    name: "Power Bogie — DETC",
    description:
      "Bo-Bo powered bogie for DETC with axle load <17T. Air spring secondary suspension, disc brakes.",
    type: "sub-assembly",
    revision: "A.2",
    lifecycleState: "In Development",
    owner: "D. Pillai",
    department: "Bogie Design Division",
    weight: "11,800 kg",
    unitOfMeasure: "EA",
    classification: "Underframe — Power Bogie",
    safetyVital: true,
    source: "Make",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2026-01-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-8201",
        title: "DETC Bogie Design Specification",
        type: "Specification",
        revision: "A.2",
        status: "In Review",
        fileType: "PDF",
        size: "20.0 MB",
        date: "2025-10-01",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-DETC-BOG-001",
        title: "DETC Power Bogie GA",
        sheetNo: "1/5",
        revision: "A.2",
        status: "Preliminary",
        format: "A0",
      },
    ],
    whereUsed: [
      {
        parentPL: "52010000",
        parentName: "Underframe Assembly",
        quantity: 1,
        findNumber: "10",
      },
    ],
    changeHistory: [],
    tags: ["Structural", "Safety Vital", "Bo-Bo"],
    lastModified: "2025-10-15",
    createdDate: "2023-07-01",
  },
  "52012000": {
    plNumber: "52012000",
    name: "Pneumatic Brake System — DETC",
    description:
      "Electro-pneumatic disc brake system with WSP and blending control for regenerative/friction blend.",
    type: "sub-assembly",
    revision: "A.1",
    lifecycleState: "In Development",
    owner: "R. Pillai",
    department: "Brake Systems Division",
    weight: "420 kg",
    unitOfMeasure: "EA",
    classification: "Safety System — Braking",
    safetyVital: true,
    source: "Make",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2026-01-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-8301",
        title: "DETC Brake Blending Specification",
        type: "Specification",
        revision: "A.1",
        status: "Draft",
        fileType: "PDF",
        size: "14.0 MB",
        date: "2025-09-10",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-DETC-BRK-001",
        title: "Brake System Schematic",
        sheetNo: "1/4",
        revision: "A.1",
        status: "Preliminary",
        format: "A1",
      },
    ],
    whereUsed: [
      {
        parentPL: "52010000",
        parentName: "Underframe Assembly",
        quantity: 1,
        findNumber: "20",
      },
    ],
    changeHistory: [],
    tags: ["Safety Vital", "Pneumatic", "WSP", "Blending"],
    lastModified: "2025-09-20",
    createdDate: "2023-08-01",
  },
  "52020000": {
    plNumber: "52020000",
    name: "Carbody Structure",
    description:
      "Aluminium carbody with upper and lower deck modules. Crash-energy management compliant to EN15227.",
    type: "sub-assembly",
    revision: "B.1",
    lifecycleState: "In Development",
    owner: "F. Ahmad",
    department: "Structure Division",
    material: "Aluminium 6005A-T6 Extrusion",
    weight: "14,600 kg",
    unitOfMeasure: "EA",
    classification: "Structure — Carbody",
    safetyVital: true,
    source: "Make",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2026-01-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-8401",
        title: "Carbody Crash Analysis Report",
        type: "Test Report",
        revision: "B.1",
        status: "In Review",
        fileType: "PDF",
        size: "46.0 MB",
        date: "2025-12-01",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-DETC-CB-001",
        title: "Carbody GA",
        sheetNo: "1/8",
        revision: "B.1",
        status: "Preliminary",
        format: "A0",
      },
    ],
    whereUsed: [
      {
        parentPL: "52000000",
        parentName: "DETC Motor Coach",
        quantity: 1,
        findNumber: "20",
      },
    ],
    changeHistory: [],
    tags: ["Structural", "Safety Vital", "Aluminium", "EN15227"],
    lastModified: "2025-12-15",
    createdDate: "2023-09-01",
  },
  "52021000": {
    plNumber: "52021000",
    name: "Upper Deck Module",
    description:
      "Structural upper deck floor, sidewalls, and ceiling assembly with emergency egress hatches.",
    type: "sub-assembly",
    revision: "A.3",
    lifecycleState: "In Development",
    owner: "F. Ahmad",
    department: "Structure Division",
    weight: "5,800 kg",
    unitOfMeasure: "EA",
    classification: "Structure — Upper Deck",
    safetyVital: true,
    source: "Make",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2026-01-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-8501",
        title: "Upper Deck Structural Report",
        type: "Test Report",
        revision: "A.3",
        status: "Draft",
        fileType: "PDF",
        size: "22.0 MB",
        date: "2025-10-20",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-DETC-UD-001",
        title: "Upper Deck Module GA",
        sheetNo: "1/5",
        revision: "A.3",
        status: "Preliminary",
        format: "A1",
      },
    ],
    whereUsed: [
      {
        parentPL: "52020000",
        parentName: "Carbody Structure",
        quantity: 1,
        findNumber: "10",
      },
    ],
    changeHistory: [],
    tags: ["Structural", "Safety Vital", "Aluminium"],
    lastModified: "2025-11-01",
    createdDate: "2023-10-01",
  },
  "52022000": {
    plNumber: "52022000",
    name: "Lower Deck Module",
    description:
      "Lower deck floor structure with battery under-floor mounting provisions and inter-deck staircase interface.",
    type: "sub-assembly",
    revision: "A.2",
    lifecycleState: "In Development",
    owner: "F. Ahmad",
    department: "Structure Division",
    weight: "6,200 kg",
    unitOfMeasure: "EA",
    classification: "Structure — Lower Deck",
    safetyVital: true,
    source: "Make",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2026-01-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-8601",
        title: "Lower Deck Structural Report",
        type: "Test Report",
        revision: "A.2",
        status: "Draft",
        fileType: "PDF",
        size: "20.0 MB",
        date: "2025-09-15",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-DETC-LD-001",
        title: "Lower Deck Module GA",
        sheetNo: "1/5",
        revision: "A.2",
        status: "Preliminary",
        format: "A1",
      },
    ],
    whereUsed: [
      {
        parentPL: "52020000",
        parentName: "Carbody Structure",
        quantity: 1,
        findNumber: "20",
      },
    ],
    changeHistory: [],
    tags: ["Structural", "Safety Vital", "Aluminium"],
    lastModified: "2025-09-25",
    createdDate: "2023-10-15",
  },
  "52030000": {
    plNumber: "52030000",
    name: "Traction Equipment Package",
    description:
      "Complete traction package: 4× traction motors, VVVF converter, and traction control system for DETC.",
    type: "sub-assembly",
    revision: "A.3",
    lifecycleState: "In Development",
    owner: "S. Menon",
    department: "Electrical Design Division",
    weight: "3,400 kg",
    unitOfMeasure: "EA",
    classification: "Electrical — Traction",
    safetyVital: true,
    source: "Make",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2026-01-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-8701",
        title: "DETC Traction Architecture Spec",
        type: "Specification",
        revision: "A.3",
        status: "In Review",
        fileType: "PDF",
        size: "26.0 MB",
        date: "2025-11-20",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-DETC-TRC-001",
        title: "Traction Equipment Layout",
        sheetNo: "1/4",
        revision: "A.3",
        status: "Preliminary",
        format: "A1",
      },
    ],
    whereUsed: [
      {
        parentPL: "52000000",
        parentName: "DETC Motor Coach",
        quantity: 1,
        findNumber: "30",
      },
    ],
    changeHistory: [],
    tags: ["Electrical", "Traction", "Safety Vital", "VVVF"],
    lastModified: "2025-12-01",
    createdDate: "2023-11-01",
  },
  "52031000": {
    plNumber: "52031000",
    name: "DETC Traction Motor (1BW-4236)",
    description:
      "Induction traction motor for DETC. 250 kW, bogie-frame mounted, TEFC with IP65 enclosure.",
    type: "part",
    revision: "A.1",
    lifecycleState: "In Development",
    owner: "S. Menon",
    department: "Electrical Design Division",
    weight: "620 kg",
    unitOfMeasure: "EA",
    classification: "Electrical — Traction Motor",
    safetyVital: true,
    source: "Buy",
    supplier: "Alstom Transport",
    supplierPartNo: "1BW4236-0AA40",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2026-01-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-8801",
        title: "1BW-4236 Datasheet",
        type: "Datasheet",
        revision: "A.1",
        status: "Approved",
        fileType: "PDF",
        size: "4.0 MB",
        date: "2025-08-01",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-1BW4236-001",
        title: "Motor Mounting Interface",
        sheetNo: "1/2",
        revision: "A.1",
        status: "Preliminary",
        format: "A3",
      },
    ],
    whereUsed: [
      {
        parentPL: "52030000",
        parentName: "Traction Equipment Package",
        quantity: 4,
        findNumber: "10",
      },
    ],
    changeHistory: [],
    tags: ["Electrical", "Traction Motor", "Safety Vital"],
    lastModified: "2025-08-15",
    createdDate: "2023-12-01",
  },
  "52032000": {
    plNumber: "52032000",
    name: "VVVF Power Converter",
    description:
      "Variable voltage variable frequency converter for DETC traction control. GTO/IGBT based, 1500V DC link.",
    type: "sub-assembly",
    revision: "A.2",
    lifecycleState: "In Development",
    owner: "M. Iyer",
    department: "Electronics Division",
    weight: "580 kg",
    unitOfMeasure: "EA",
    classification: "Electronics — Power Converter",
    safetyVital: true,
    source: "Buy",
    supplier: "Medha Servo Drives",
    supplierPartNo: "VVVF-1500-A2",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2026-01-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-8901",
        title: "VVVF Converter Test Report",
        type: "Test Report",
        revision: "A.2",
        status: "In Review",
        fileType: "PDF",
        size: "19.0 MB",
        date: "2025-09-20",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-VVVF-001",
        title: "VVVF Converter Layout",
        sheetNo: "1/3",
        revision: "A.2",
        status: "Preliminary",
        format: "A1",
      },
    ],
    whereUsed: [
      {
        parentPL: "52030000",
        parentName: "Traction Equipment Package",
        quantity: 1,
        findNumber: "20",
      },
    ],
    changeHistory: [],
    tags: ["Electronics", "IGBT", "Regenerative", "Safety Vital"],
    lastModified: "2025-10-05",
    createdDate: "2024-01-01",
  },
  "52040000": {
    plNumber: "52040000",
    name: "Passenger Interior Assembly",
    description:
      "Complete passenger interior package including seating, inter-deck staircase, flooring, and overhead grab rails.",
    type: "sub-assembly",
    revision: "A.1",
    lifecycleState: "In Development",
    owner: "A. Verma",
    department: "Interior Design Division",
    weight: "9,400 kg",
    unitOfMeasure: "EA",
    classification: "Interior — Passenger Saloon",
    safetyVital: false,
    source: "Make",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2026-01-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-9001",
        title: "Passenger Interior General Arrangement",
        type: "Drawing",
        revision: "A.1",
        status: "Draft",
        fileType: "PDF",
        size: "24.0 MB",
        date: "2025-11-10",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-DETC-INT-001",
        title: "Interior Saloon GA",
        sheetNo: "1/6",
        revision: "A.1",
        status: "Preliminary",
        format: "A0",
      },
    ],
    whereUsed: [
      {
        parentPL: "52000000",
        parentName: "DETC Motor Coach",
        quantity: 1,
        findNumber: "40",
      },
    ],
    changeHistory: [],
    tags: ["Interior", "Passenger", "Comfort"],
    lastModified: "2025-11-20",
    createdDate: "2024-02-01",
  },
  "52041000": {
    plNumber: "52041000",
    name: "Upper Deck Seating Module",
    description:
      "84-seat upper deck saloon unit with longitudinal and transverse seating, luggage racks, and anti-vandal coatings.",
    type: "sub-assembly",
    revision: "A.1",
    lifecycleState: "In Development",
    owner: "A. Verma",
    department: "Interior Design Division",
    weight: "3,200 kg",
    unitOfMeasure: "EA",
    classification: "Interior — Seating",
    safetyVital: false,
    source: "Make",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2026-01-01" },
    linkedDocuments: [],
    linkedDrawings: [
      {
        drawingId: "DWG-DETC-USD-001",
        title: "Upper Deck Seating Arrangement",
        sheetNo: "1/3",
        revision: "A.1",
        status: "Preliminary",
        format: "A1",
      },
    ],
    whereUsed: [
      {
        parentPL: "52040000",
        parentName: "Passenger Interior Assembly",
        quantity: 1,
        findNumber: "10",
      },
    ],
    changeHistory: [],
    tags: ["Interior", "Seating", "Upper Deck"],
    lastModified: "2025-10-15",
    createdDate: "2024-03-01",
  },
  "52042000": {
    plNumber: "52042000",
    name: "Lower Deck Seating Module",
    description:
      "68-seat lower deck saloon unit with priority seating, wheelchair bays, and inter-deck staircase access panel.",
    type: "sub-assembly",
    revision: "A.1",
    lifecycleState: "In Development",
    owner: "A. Verma",
    department: "Interior Design Division",
    weight: "2,900 kg",
    unitOfMeasure: "EA",
    classification: "Interior — Seating",
    safetyVital: false,
    source: "Make",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2026-01-01" },
    linkedDocuments: [],
    linkedDrawings: [
      {
        drawingId: "DWG-DETC-LSD-001",
        title: "Lower Deck Seating Arrangement",
        sheetNo: "1/3",
        revision: "A.1",
        status: "Preliminary",
        format: "A1",
      },
    ],
    whereUsed: [
      {
        parentPL: "52040000",
        parentName: "Passenger Interior Assembly",
        quantity: 1,
        findNumber: "20",
      },
    ],
    changeHistory: [],
    tags: ["Interior", "Seating", "Lower Deck", "Accessibility"],
    lastModified: "2025-10-15",
    createdDate: "2024-03-01",
  },
  "52050000": {
    plNumber: "52050000",
    name: "HVAC System",
    description:
      "Roof-mounted HVAC system. Cooling 30 kW, heating 20 kW per coach. HEPA filtration, automatic climate control.",
    type: "sub-assembly",
    revision: "A.2",
    lifecycleState: "In Development",
    owner: "P. Singh",
    department: "Mechanical Systems Division",
    weight: "1,800 kg",
    unitOfMeasure: "EA",
    classification: "HVAC — Passenger Comfort",
    safetyVital: false,
    source: "Buy",
    supplier: "Faiveley Transport India",
    supplierPartNo: "HVAC-DETC-30KW-A2",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2026-01-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-9201",
        title: "HVAC Performance Test Report",
        type: "Test Report",
        revision: "A.2",
        status: "Draft",
        fileType: "PDF",
        size: "16.0 MB",
        date: "2025-10-05",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-DETC-HVAC-001",
        title: "HVAC Unit Roof Mounting",
        sheetNo: "1/3",
        revision: "A.2",
        status: "Preliminary",
        format: "A1",
      },
    ],
    whereUsed: [
      {
        parentPL: "52000000",
        parentName: "DETC Motor Coach",
        quantity: 2,
        findNumber: "50",
      },
    ],
    changeHistory: [],
    tags: ["HVAC", "Passenger Comfort", "HEPA"],
    lastModified: "2025-10-20",
    createdDate: "2024-04-01",
  },
  "52051000": {
    plNumber: "52051000",
    name: "Rooftop A/C Condenser Unit",
    description:
      "Variable-speed compressor rooftop condenser for DETC HVAC. R134a refrigerant, 15 kW cooling capacity per unit.",
    type: "part",
    revision: "A.1",
    lifecycleState: "In Development",
    owner: "P. Singh",
    department: "Mechanical Systems Division",
    weight: "420 kg",
    unitOfMeasure: "EA",
    classification: "HVAC — Condenser",
    safetyVital: false,
    source: "Buy",
    supplier: "Faiveley Transport India",
    supplierPartNo: "COND-15KW-R134A-A1",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2026-01-01" },
    linkedDocuments: [],
    linkedDrawings: [
      {
        drawingId: "DWG-DETC-COND-001",
        title: "Condenser Unit Outline",
        sheetNo: "1/1",
        revision: "A.1",
        status: "Preliminary",
        format: "A3",
      },
    ],
    whereUsed: [
      {
        parentPL: "52050000",
        parentName: "HVAC System",
        quantity: 2,
        findNumber: "10",
      },
    ],
    changeHistory: [],
    tags: ["HVAC", "Refrigerant", "Rooftop"],
    lastModified: "2025-09-10",
    createdDate: "2024-04-15",
  },

  // ─── Traction Motor HS-15250A Standalone ─────────────────────────────────
  "60100000": {
    plNumber: "60100000",
    name: "HS-15250A Traction Motor",
    description:
      "Axle-hung, nose-suspended squirrel cage induction motor for WAP7/WAG9. 850 kW continuous, Class H insulation, IP44.",
    type: "assembly",
    revision: "B.2",
    lifecycleState: "Production",
    owner: "V. Krishnan",
    department: "Electrical Design Division",
    weight: "1,850 kg",
    unitOfMeasure: "EA",
    classification: "Electrical — Traction Motor",
    safetyVital: true,
    source: "Make",
    alternates: ["60100100"],
    substitutes: [],
    effectivity: { dateFrom: "2022-04-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-9101",
        title: "HS-15250A Type Test Report",
        type: "Test Report",
        revision: "B.2",
        status: "Approved",
        fileType: "PDF",
        size: "35.0 MB",
        date: "2025-09-10",
      },
      {
        docId: "DOC-2026-9102",
        title: "HS-15250A Maintenance Manual",
        type: "Procedure",
        revision: "B.1",
        status: "Approved",
        fileType: "PDF",
        size: "48.0 MB",
        date: "2025-11-01",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-HS15250-001",
        title: "Motor GA — Side View",
        sheetNo: "1/4",
        revision: "B.2",
        status: "Released",
        format: "A1",
      },
      {
        drawingId: "DWG-HS15250-002",
        title: "Motor GA — End View",
        sheetNo: "2/4",
        revision: "B.2",
        status: "Released",
        format: "A1",
      },
    ],
    whereUsed: [
      {
        parentPL: "38120000",
        parentName: "Traction System (WAP7)",
        quantity: 1,
        findNumber: "10",
      },
      {
        parentPL: "46111000",
        parentName: "WAG9 Traction System",
        quantity: 1,
        findNumber: "10",
      },
    ],
    changeHistory: [
      {
        changeId: "ECO-2025-1102",
        type: "ECO",
        title: "Upgrade insulation class to H — all production",
        date: "2025-09-15",
        status: "Implemented",
        author: "V. Krishnan",
      },
    ],
    tags: ["Electrical", "Traction Motor", "Safety Vital", "Class H", "IP44"],
    lastModified: "2026-03-01",
    createdDate: "2020-06-01",
  },
  "60101000": {
    plNumber: "60101000",
    name: "Stator Assembly",
    description:
      "Stator core and Class H winding assembly for HS-15250A. Vacuum pressure impregnated (VPI) with epoxy resin.",
    type: "sub-assembly",
    revision: "B.2",
    lifecycleState: "Production",
    owner: "V. Krishnan",
    department: "Motor Manufacturing",
    material: "M310-50A Silicon Steel Laminations",
    weight: "640 kg",
    unitOfMeasure: "EA",
    classification: "Electrical — Stator",
    safetyVital: true,
    source: "Make",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2022-04-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-9201",
        title: "Stator Winding Specification",
        type: "Specification",
        revision: "B.2",
        status: "Approved",
        fileType: "PDF",
        size: "12.0 MB",
        date: "2025-08-20",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-HS15250-STT-001",
        title: "Stator Assembly Drawing",
        sheetNo: "1/3",
        revision: "B.2",
        status: "Released",
        format: "A1",
      },
    ],
    whereUsed: [
      {
        parentPL: "60100000",
        parentName: "HS-15250A Traction Motor",
        quantity: 1,
        findNumber: "10",
      },
    ],
    changeHistory: [],
    tags: ["Electrical", "Stator", "Safety Vital", "VPI"],
    lastModified: "2025-09-01",
    createdDate: "2020-08-01",
  },
  "60101001": {
    plNumber: "60101001",
    name: "Stator Core",
    description:
      "Laminated stator core stack assembled from M310-50A silicon steel punchings. 600mm core length.",
    type: "part",
    revision: "A.3",
    lifecycleState: "Production",
    owner: "V. Krishnan",
    department: "Motor Manufacturing",
    material: "M310-50A Silicon Steel, 0.5mm",
    weight: "420 kg",
    unitOfMeasure: "EA",
    classification: "Electrical — Core",
    safetyVital: false,
    source: "Make",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2022-04-01" },
    linkedDocuments: [],
    linkedDrawings: [
      {
        drawingId: "DWG-HS15250-SC-001",
        title: "Stator Core Punching",
        sheetNo: "1/2",
        revision: "A.3",
        status: "Released",
        format: "A2",
      },
    ],
    whereUsed: [
      {
        parentPL: "60101000",
        parentName: "Stator Assembly",
        quantity: 1,
        findNumber: "10",
      },
    ],
    changeHistory: [],
    tags: ["Electrical", "Core", "Lamination"],
    lastModified: "2025-06-15",
    createdDate: "2020-09-01",
  },
  "60101002": {
    plNumber: "60101002",
    name: "Class H Stator Winding",
    description:
      "3-phase stator winding with Class H (180°C) insulation system. VPI impregnated with epoxy resin.",
    type: "part",
    revision: "B.2",
    lifecycleState: "Production",
    owner: "V. Krishnan",
    department: "Motor Manufacturing",
    weight: "180 kg",
    unitOfMeasure: "EA",
    classification: "Electrical — Winding",
    safetyVital: true,
    source: "Make",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2022-04-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-9202",
        title: "Winding Insulation Test Certificate",
        type: "Certificate",
        revision: "B.2",
        status: "Approved",
        fileType: "PDF",
        size: "3.5 MB",
        date: "2025-08-25",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-HS15250-WD-001",
        title: "Winding Diagram",
        sheetNo: "1/2",
        revision: "B.2",
        status: "Released",
        format: "A2",
      },
    ],
    whereUsed: [
      {
        parentPL: "60101000",
        parentName: "Stator Assembly",
        quantity: 1,
        findNumber: "20",
      },
    ],
    changeHistory: [
      {
        changeId: "ECO-2025-1102",
        type: "ECO",
        title: "Class F → Class H upgrade",
        date: "2025-09-15",
        status: "Implemented",
        author: "V. Krishnan",
      },
    ],
    tags: ["Electrical", "Winding", "Safety Vital", "Class H"],
    lastModified: "2025-09-20",
    createdDate: "2020-10-01",
  },
  "60102000": {
    plNumber: "60102000",
    name: "Rotor Assembly",
    description:
      "Squirrel cage rotor with balancing rings, cast aluminium cage, and dynamic balancing certification.",
    type: "sub-assembly",
    revision: "B.1",
    lifecycleState: "Production",
    owner: "G. Nair",
    department: "Motor Manufacturing",
    material: "M310-50A Rotor Laminations + Aluminium Cage",
    weight: "560 kg",
    unitOfMeasure: "EA",
    classification: "Mechanical — Rotor",
    safetyVital: true,
    source: "Make",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2022-04-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-9301",
        title: "Rotor Dynamic Balance Certificate",
        type: "Certificate",
        revision: "B.1",
        status: "Approved",
        fileType: "PDF",
        size: "4.0 MB",
        date: "2025-07-10",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-HS15250-ROR-001",
        title: "Rotor Assembly Drawing",
        sheetNo: "1/3",
        revision: "B.1",
        status: "Released",
        format: "A1",
      },
    ],
    whereUsed: [
      {
        parentPL: "60100000",
        parentName: "HS-15250A Traction Motor",
        quantity: 1,
        findNumber: "20",
      },
    ],
    changeHistory: [],
    tags: ["Mechanical", "Rotor", "Safety Vital", "Balanced"],
    lastModified: "2025-08-01",
    createdDate: "2020-11-01",
  },
  "60102001": {
    plNumber: "60102001",
    name: "Rotor Core Lamination Stack",
    description:
      "Rotor core built from M310-50A silicon steel punchings. Skewed slots for reduced harmonic torque.",
    type: "part",
    revision: "A.2",
    lifecycleState: "Production",
    owner: "G. Nair",
    department: "Motor Manufacturing",
    material: "M310-50A Silicon Steel, 0.5mm",
    weight: "380 kg",
    unitOfMeasure: "EA",
    classification: "Mechanical — Rotor Core",
    safetyVital: false,
    source: "Make",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2022-04-01" },
    linkedDocuments: [],
    linkedDrawings: [
      {
        drawingId: "DWG-HS15250-RC-001",
        title: "Rotor Core Punching",
        sheetNo: "1/2",
        revision: "A.2",
        status: "Released",
        format: "A2",
      },
    ],
    whereUsed: [
      {
        parentPL: "60102000",
        parentName: "Rotor Assembly",
        quantity: 1,
        findNumber: "10",
      },
    ],
    changeHistory: [],
    tags: ["Mechanical", "Core", "Lamination"],
    lastModified: "2025-05-01",
    createdDate: "2020-12-01",
  },
  "60102002": {
    plNumber: "60102002",
    name: "Squirrel Cage (Cast Aluminium)",
    description:
      "Die-cast aluminium rotor cage bars and end rings for squirrel cage induction motor.",
    type: "part",
    revision: "A.1",
    lifecycleState: "Production",
    owner: "G. Nair",
    department: "Motor Manufacturing",
    material: "Aluminium Alloy A380",
    weight: "42 kg",
    unitOfMeasure: "EA",
    classification: "Electrical — Rotor Cage",
    safetyVital: false,
    source: "Make",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2022-04-01" },
    linkedDocuments: [],
    linkedDrawings: [
      {
        drawingId: "DWG-HS15250-CAGE-001",
        title: "Rotor Cage Drawing",
        sheetNo: "1/1",
        revision: "A.1",
        status: "Released",
        format: "A3",
      },
    ],
    whereUsed: [
      {
        parentPL: "60102000",
        parentName: "Rotor Assembly",
        quantity: 1,
        findNumber: "20",
      },
    ],
    changeHistory: [],
    tags: ["Electrical", "Aluminium", "Die-Cast"],
    lastModified: "2025-04-01",
    createdDate: "2021-01-01",
  },
  "60103000": {
    plNumber: "60103000",
    name: "Frame & Endshield Assembly",
    description:
      "Cast iron motor frame with drive-end (DE) and non-drive-end (NDE) endshields, providing structural housing for stator.",
    type: "sub-assembly",
    revision: "B.1",
    lifecycleState: "Production",
    owner: "S. Rao",
    department: "Mechanical Division",
    material: "Cast Iron GG-25",
    weight: "480 kg",
    unitOfMeasure: "EA",
    classification: "Mechanical — Frame",
    safetyVital: false,
    source: "Make",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2022-04-01" },
    linkedDocuments: [],
    linkedDrawings: [
      {
        drawingId: "DWG-HS15250-FRM-001",
        title: "Motor Frame Drawing",
        sheetNo: "1/4",
        revision: "B.1",
        status: "Released",
        format: "A1",
      },
    ],
    whereUsed: [
      {
        parentPL: "60100000",
        parentName: "HS-15250A Traction Motor",
        quantity: 1,
        findNumber: "30",
      },
    ],
    changeHistory: [],
    tags: ["Mechanical", "Casting", "Frame"],
    lastModified: "2025-07-01",
    createdDate: "2021-02-01",
  },
  "60103001": {
    plNumber: "60103001",
    name: "Motor Frame Casting",
    description:
      "Main motor frame body — cast iron with integral cooling ribs and mounting feet for nose suspension.",
    type: "part",
    revision: "B.0",
    lifecycleState: "Production",
    owner: "S. Rao",
    department: "Mechanical Division",
    material: "GG-25 Grey Cast Iron",
    weight: "340 kg",
    unitOfMeasure: "EA",
    classification: "Mechanical — Frame Casting",
    safetyVital: false,
    source: "Buy",
    supplier: "Kirloskar Ferrous",
    supplierPartNo: "KFI-GG25-HS15250",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2022-04-01" },
    linkedDocuments: [],
    linkedDrawings: [
      {
        drawingId: "DWG-HS15250-FRM-CA-001",
        title: "Frame Casting Drawing",
        sheetNo: "1/3",
        revision: "B.0",
        status: "Released",
        format: "A1",
      },
    ],
    whereUsed: [
      {
        parentPL: "60103000",
        parentName: "Frame & Endshield Assembly",
        quantity: 1,
        findNumber: "10",
      },
    ],
    changeHistory: [],
    tags: ["Mechanical", "Cast Iron", "Casting"],
    lastModified: "2025-06-01",
    createdDate: "2021-03-01",
  },
  "60103002": {
    plNumber: "60103002",
    name: "Drive End Endshield",
    description:
      "Drive-end (commutator/coupling end) endshield for HS-15250A. Houses DE bearing housing.",
    type: "part",
    revision: "A.2",
    lifecycleState: "Production",
    owner: "S. Rao",
    department: "Mechanical Division",
    material: "GG-25 Grey Cast Iron",
    weight: "72 kg",
    unitOfMeasure: "EA",
    classification: "Mechanical — Endshield",
    safetyVital: false,
    source: "Make",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2022-04-01" },
    linkedDocuments: [],
    linkedDrawings: [
      {
        drawingId: "DWG-HS15250-DE-001",
        title: "DE Endshield Drawing",
        sheetNo: "1/2",
        revision: "A.2",
        status: "Released",
        format: "A2",
      },
    ],
    whereUsed: [
      {
        parentPL: "60103000",
        parentName: "Frame & Endshield Assembly",
        quantity: 1,
        findNumber: "20",
      },
    ],
    changeHistory: [],
    tags: ["Mechanical", "Cast Iron"],
    lastModified: "2025-05-15",
    createdDate: "2021-04-01",
  },
  "60103003": {
    plNumber: "60103003",
    name: "Non-Drive End Endshield",
    description:
      "Non-drive-end endshield for HS-15250A. Houses NDE bearing and terminal box interface.",
    type: "part",
    revision: "A.2",
    lifecycleState: "Production",
    owner: "S. Rao",
    department: "Mechanical Division",
    material: "GG-25 Grey Cast Iron",
    weight: "68 kg",
    unitOfMeasure: "EA",
    classification: "Mechanical — Endshield",
    safetyVital: false,
    source: "Make",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2022-04-01" },
    linkedDocuments: [],
    linkedDrawings: [
      {
        drawingId: "DWG-HS15250-NDE-001",
        title: "NDE Endshield Drawing",
        sheetNo: "1/2",
        revision: "A.2",
        status: "Released",
        format: "A2",
      },
    ],
    whereUsed: [
      {
        parentPL: "60103000",
        parentName: "Frame & Endshield Assembly",
        quantity: 1,
        findNumber: "30",
      },
    ],
    changeHistory: [],
    tags: ["Mechanical", "Cast Iron"],
    lastModified: "2025-05-15",
    createdDate: "2021-04-01",
  },
  "60104000": {
    plNumber: "60104000",
    name: "Bearing Assembly",
    description:
      "Drive-end and non-drive-end bearing kit for HS-15250A. Includes bearings, housings, and grease nipples.",
    type: "sub-assembly",
    revision: "A.3",
    lifecycleState: "Production",
    owner: "S. Rao",
    department: "Mechanical Division",
    weight: "45 kg",
    unitOfMeasure: "EA",
    classification: "Mechanical — Bearings",
    safetyVital: true,
    source: "Buy",
    supplier: "SKF India Ltd.",
    supplierPartNo: "SKF-HS15250-BRG-KIT",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2022-04-01" },
    linkedDocuments: [
      {
        docId: "DOC-2026-9401",
        title: "Bearing Maintenance Procedure",
        type: "Procedure",
        revision: "A.3",
        status: "Approved",
        fileType: "PDF",
        size: "6.0 MB",
        date: "2025-07-20",
      },
    ],
    linkedDrawings: [
      {
        drawingId: "DWG-HS15250-BRG-001",
        title: "Bearing Arrangement Drawing",
        sheetNo: "1/2",
        revision: "A.3",
        status: "Released",
        format: "A2",
      },
    ],
    whereUsed: [
      {
        parentPL: "60100000",
        parentName: "HS-15250A Traction Motor",
        quantity: 1,
        findNumber: "40",
      },
    ],
    changeHistory: [],
    tags: ["Mechanical", "Safety Vital", "Bearings", "Wear Item"],
    lastModified: "2025-08-01",
    createdDate: "2021-05-01",
  },
  "60104001": {
    plNumber: "60104001",
    name: "Drive End Spherical Roller Bearing",
    description:
      "DE spherical roller bearing for HS-15250A. SKF 22344 CCK/W33. Accommodates shaft deflection under traction loads.",
    type: "part",
    revision: "A.2",
    lifecycleState: "Production",
    owner: "S. Rao",
    department: "Mechanical Division",
    weight: "22 kg",
    unitOfMeasure: "EA",
    classification: "Mechanical — Bearing",
    safetyVital: true,
    source: "Buy",
    supplier: "SKF India Ltd.",
    supplierPartNo: "22344-CCK-W33",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2022-04-01" },
    linkedDocuments: [],
    linkedDrawings: [
      {
        drawingId: "DWG-HS15250-DE-BRG-001",
        title: "DE Bearing Interface",
        sheetNo: "1/1",
        revision: "A.2",
        status: "Released",
        format: "A3",
      },
    ],
    whereUsed: [
      {
        parentPL: "60104000",
        parentName: "Bearing Assembly",
        quantity: 1,
        findNumber: "10",
      },
    ],
    changeHistory: [],
    tags: ["Mechanical", "Safety Vital", "SKF", "Wear Item"],
    lastModified: "2025-07-01",
    createdDate: "2021-06-01",
  },
  "60104002": {
    plNumber: "60104002",
    name: "NDE Deep Groove Ball Bearing",
    description:
      "Non-drive-end deep groove ball bearing for HS-15250A. SKF 6224. Radial load bearing on terminal box side.",
    type: "part",
    revision: "A.1",
    lifecycleState: "Production",
    owner: "S. Rao",
    department: "Mechanical Division",
    weight: "6 kg",
    unitOfMeasure: "EA",
    classification: "Mechanical — Bearing",
    safetyVital: true,
    source: "Buy",
    supplier: "SKF India Ltd.",
    supplierPartNo: "6224-C3",
    alternates: [],
    substitutes: [],
    effectivity: { dateFrom: "2022-04-01" },
    linkedDocuments: [],
    linkedDrawings: [
      {
        drawingId: "DWG-HS15250-NDE-BRG-001",
        title: "NDE Bearing Interface",
        sheetNo: "1/1",
        revision: "A.1",
        status: "Released",
        format: "A3",
      },
    ],
    whereUsed: [
      {
        parentPL: "60104000",
        parentName: "Bearing Assembly",
        quantity: 1,
        findNumber: "20",
      },
    ],
    changeHistory: [],
    tags: ["Mechanical", "Safety Vital", "SKF", "Wear Item"],
    lastModified: "2025-06-01",
    createdDate: "2021-07-01",
  },
};

export function getPLRecord(plNumber: string): PLRecord | undefined {
  return PL_DATABASE[plNumber];
}

export const INITIAL_BOM_TREE: BOMNode[] = [
  {
    id: "38100000",
    name: "WAP7 Locomotive",
    type: "assembly",
    revision: "D",
    quantity: 1,
    findNumber: "1",
    unitOfMeasure: "EA",
    tags: ["Railway", "Production", "25kV AC"],
    children: [
      {
        id: "38110000",
        name: "Bogie Assembly",
        type: "sub-assembly",
        revision: "C",
        quantity: 2,
        findNumber: "10",
        unitOfMeasure: "EA",
        tags: ["Structural", "Safety Vital"],
        children: [
          {
            id: "38111000",
            name: "Brake System",
            type: "sub-assembly",
            revision: "B.2",
            quantity: 1,
            findNumber: "10",
            unitOfMeasure: "EA",
            tags: ["Safety Vital"],
            children: [],
          },
          {
            id: "38120000",
            name: "Traction System",
            type: "sub-assembly",
            revision: "B",
            quantity: 3,
            findNumber: "20",
            unitOfMeasure: "EA",
            tags: ["Electrical", "Traction Motor"],
            children: [],
          },
        ],
      },
      {
        id: "38130000",
        name: "Main Transformer",
        type: "sub-assembly",
        revision: "C",
        quantity: 1,
        findNumber: "30",
        unitOfMeasure: "EA",
        tags: ["Electrical", "High Voltage"],
        children: [],
      },
      {
        id: "38140000",
        name: "Control Electronics Cabinet",
        type: "sub-assembly",
        revision: "B.3",
        quantity: 1,
        findNumber: "40",
        unitOfMeasure: "EA",
        tags: ["Electronics", "TCMS"],
        children: [],
      },
      {
        id: "38150000",
        name: "Pantograph & Current Collection",
        type: "sub-assembly",
        revision: "A.5",
        quantity: 2,
        findNumber: "50",
        unitOfMeasure: "EA",
        tags: ["High Voltage", "Wear Item"],
        children: [],
      },
    ],
  },
];

export const WAG9HC_BOM_TREE: BOMNode[] = [
  {
    id: "46100000",
    name: "WAG-9HC Locomotive",
    type: "assembly",
    revision: "C.1",
    quantity: 1,
    findNumber: "1",
    unitOfMeasure: "EA",
    tags: ["Freight", "Production", "25kV AC"],
    children: [
      {
        id: "46110000",
        name: "Power Bogie Assembly",
        type: "sub-assembly",
        revision: "C",
        quantity: 3,
        findNumber: "10",
        unitOfMeasure: "EA",
        tags: ["Structural", "Safety Vital"],
        children: [
          {
            id: "46111000",
            name: "Traction Motor TAO-659",
            type: "sub-assembly",
            revision: "B.1",
            quantity: 2,
            findNumber: "10",
            unitOfMeasure: "EA",
            tags: ["Electrical", "Safety Vital"],
            children: [],
          },
          {
            id: "46112000",
            name: "Brake Rigging Assembly",
            type: "sub-assembly",
            revision: "B",
            quantity: 1,
            findNumber: "20",
            unitOfMeasure: "EA",
            tags: ["Safety Vital", "Pneumatic"],
            children: [],
          },
          {
            id: "46113000",
            name: "Axle & Wheelset Assembly",
            type: "sub-assembly",
            revision: "A.3",
            quantity: 2,
            findNumber: "30",
            unitOfMeasure: "EA",
            tags: ["Safety Vital", "Running Gear"],
            children: [],
          },
        ],
      },
      {
        id: "46120000",
        name: "Roof Equipment Assembly",
        type: "sub-assembly",
        revision: "B.2",
        quantity: 1,
        findNumber: "20",
        unitOfMeasure: "EA",
        tags: ["High Voltage", "Electrical"],
        children: [
          {
            id: "46121000",
            name: "Main Transformer 9000HP",
            type: "sub-assembly",
            revision: "B.1",
            quantity: 1,
            findNumber: "10",
            unitOfMeasure: "EA",
            tags: ["Electrical", "Transformer"],
            children: [],
          },
          {
            id: "46122000",
            name: "Pantograph DSA380",
            type: "part",
            revision: "A.2",
            quantity: 2,
            findNumber: "20",
            unitOfMeasure: "EA",
            tags: ["High Voltage", "Wear Item"],
            children: [],
          },
        ],
      },
      {
        id: "46130000",
        name: "IGBT Converter Cabinet",
        type: "sub-assembly",
        revision: "B.3",
        quantity: 1,
        findNumber: "30",
        unitOfMeasure: "EA",
        tags: ["Electronics", "IGBT"],
        children: [
          {
            id: "46131000",
            name: "4-Quadrant Converter Module",
            type: "sub-assembly",
            revision: "B.1",
            quantity: 2,
            findNumber: "10",
            unitOfMeasure: "EA",
            tags: ["Electronics", "Regenerative"],
            children: [],
          },
          {
            id: "46132000",
            name: "Auxiliary Converter Module",
            type: "sub-assembly",
            revision: "B.1",
            quantity: 1,
            findNumber: "20",
            unitOfMeasure: "EA",
            tags: ["Electronics", "Auxiliary Power"],
            children: [],
          },
        ],
      },
      {
        id: "46140000",
        name: "Driver's Cab Assembly",
        type: "sub-assembly",
        revision: "A.4",
        quantity: 2,
        findNumber: "40",
        unitOfMeasure: "EA",
        tags: ["Structure", "Ergonomics"],
        children: [
          {
            id: "46141000",
            name: "LOCOTROL Remote Control Unit",
            type: "part",
            revision: "A.1",
            quantity: 1,
            findNumber: "10",
            unitOfMeasure: "EA",
            tags: ["Electronics", "Safety Vital"],
            children: [],
          },
          {
            id: "46142000",
            name: "Cab Desk Assembly",
            type: "part",
            revision: "A.2",
            quantity: 1,
            findNumber: "20",
            unitOfMeasure: "EA",
            tags: ["Ergonomics", "ZTCS"],
            children: [],
          },
          {
            id: "46143000",
            name: "Cab Air Conditioning Unit",
            type: "part",
            revision: "A.1",
            quantity: 1,
            findNumber: "30",
            unitOfMeasure: "EA",
            tags: ["HVAC", "Cab Comfort"],
            children: [],
          },
        ],
      },
      {
        id: "46150000",
        name: "Sanding System Assembly",
        type: "sub-assembly",
        revision: "A.2",
        quantity: 6,
        findNumber: "50",
        unitOfMeasure: "EA",
        tags: ["Adhesion Control", "Safety Vital"],
        children: [],
      },
      {
        id: "46160000",
        name: "Horn & Warning System",
        type: "part",
        revision: "A.1",
        quantity: 2,
        findNumber: "60",
        unitOfMeasure: "EA",
        tags: ["Safety Vital", "Warning"],
        children: [],
      },
    ],
  },
];

export const DETC_BOM_TREE: BOMNode[] = [
  {
    id: "52000000",
    name: "DETC Motor Coach",
    type: "assembly",
    revision: "B",
    quantity: 1,
    findNumber: "1",
    unitOfMeasure: "EA",
    tags: ["EMU", "In Development", "Double-Deck"],
    children: [
      {
        id: "52010000",
        name: "Underframe Assembly",
        type: "sub-assembly",
        revision: "B",
        quantity: 1,
        findNumber: "10",
        unitOfMeasure: "EA",
        tags: ["Structural", "Safety Vital"],
        children: [
          {
            id: "52011000",
            name: "Power Bogie — DETC",
            type: "sub-assembly",
            revision: "A.2",
            quantity: 1,
            findNumber: "10",
            unitOfMeasure: "EA",
            tags: ["Structural", "Bo-Bo"],
            children: [],
          },
          {
            id: "52012000",
            name: "Pneumatic Brake System — DETC",
            type: "sub-assembly",
            revision: "A.1",
            quantity: 1,
            findNumber: "20",
            unitOfMeasure: "EA",
            tags: ["Safety Vital", "WSP"],
            children: [],
          },
        ],
      },
      {
        id: "52020000",
        name: "Carbody Structure",
        type: "sub-assembly",
        revision: "B.1",
        quantity: 1,
        findNumber: "20",
        unitOfMeasure: "EA",
        tags: ["Structural", "Aluminium"],
        children: [
          {
            id: "52021000",
            name: "Upper Deck Module",
            type: "sub-assembly",
            revision: "A.3",
            quantity: 1,
            findNumber: "10",
            unitOfMeasure: "EA",
            tags: ["Structural", "Safety Vital"],
            children: [],
          },
          {
            id: "52022000",
            name: "Lower Deck Module",
            type: "sub-assembly",
            revision: "A.2",
            quantity: 1,
            findNumber: "20",
            unitOfMeasure: "EA",
            tags: ["Structural", "Safety Vital"],
            children: [],
          },
        ],
      },
      {
        id: "52030000",
        name: "Traction Equipment Package",
        type: "sub-assembly",
        revision: "A.3",
        quantity: 1,
        findNumber: "30",
        unitOfMeasure: "EA",
        tags: ["Electrical", "VVVF"],
        children: [
          {
            id: "52031000",
            name: "DETC Traction Motor (1BW-4236)",
            type: "part",
            revision: "A.1",
            quantity: 4,
            findNumber: "10",
            unitOfMeasure: "EA",
            tags: ["Electrical", "Safety Vital"],
            children: [],
          },
          {
            id: "52032000",
            name: "VVVF Power Converter",
            type: "sub-assembly",
            revision: "A.2",
            quantity: 1,
            findNumber: "20",
            unitOfMeasure: "EA",
            tags: ["Electronics", "Regenerative"],
            children: [],
          },
        ],
      },
      {
        id: "52040000",
        name: "Passenger Interior Assembly",
        type: "sub-assembly",
        revision: "A.1",
        quantity: 1,
        findNumber: "40",
        unitOfMeasure: "EA",
        tags: ["Interior", "Passenger"],
        children: [
          {
            id: "52041000",
            name: "Upper Deck Seating Module",
            type: "sub-assembly",
            revision: "A.1",
            quantity: 1,
            findNumber: "10",
            unitOfMeasure: "EA",
            tags: ["Interior", "Seating"],
            children: [],
          },
          {
            id: "52042000",
            name: "Lower Deck Seating Module",
            type: "sub-assembly",
            revision: "A.1",
            quantity: 1,
            findNumber: "20",
            unitOfMeasure: "EA",
            tags: ["Interior", "Seating", "Accessibility"],
            children: [],
          },
        ],
      },
      {
        id: "52050000",
        name: "HVAC System",
        type: "sub-assembly",
        revision: "A.2",
        quantity: 2,
        findNumber: "50",
        unitOfMeasure: "EA",
        tags: ["HVAC", "Passenger Comfort"],
        children: [
          {
            id: "52051000",
            name: "Rooftop A/C Condenser Unit",
            type: "part",
            revision: "A.1",
            quantity: 2,
            findNumber: "10",
            unitOfMeasure: "EA",
            tags: ["HVAC", "Refrigerant"],
            children: [],
          },
        ],
      },
    ],
  },
];

export const TRACTION_MOTOR_BOM_TREE: BOMNode[] = [
  {
    id: "60100000",
    name: "HS-15250A Traction Motor",
    type: "assembly",
    revision: "B.2",
    quantity: 1,
    findNumber: "1",
    unitOfMeasure: "EA",
    tags: ["Electrical", "Production", "Class H"],
    children: [
      {
        id: "60101000",
        name: "Stator Assembly",
        type: "sub-assembly",
        revision: "B.2",
        quantity: 1,
        findNumber: "10",
        unitOfMeasure: "EA",
        tags: ["Electrical", "VPI"],
        children: [
          {
            id: "60101001",
            name: "Stator Core",
            type: "part",
            revision: "A.3",
            quantity: 1,
            findNumber: "10",
            unitOfMeasure: "EA",
            tags: ["Core", "Lamination"],
            children: [],
          },
          {
            id: "60101002",
            name: "Class H Stator Winding",
            type: "part",
            revision: "B.2",
            quantity: 1,
            findNumber: "20",
            unitOfMeasure: "EA",
            tags: ["Winding", "Safety Vital"],
            children: [],
          },
        ],
      },
      {
        id: "60102000",
        name: "Rotor Assembly",
        type: "sub-assembly",
        revision: "B.1",
        quantity: 1,
        findNumber: "20",
        unitOfMeasure: "EA",
        tags: ["Mechanical", "Balanced"],
        children: [
          {
            id: "60102001",
            name: "Rotor Core Lamination Stack",
            type: "part",
            revision: "A.2",
            quantity: 1,
            findNumber: "10",
            unitOfMeasure: "EA",
            tags: ["Core", "Lamination"],
            children: [],
          },
          {
            id: "60102002",
            name: "Squirrel Cage (Cast Aluminium)",
            type: "part",
            revision: "A.1",
            quantity: 1,
            findNumber: "20",
            unitOfMeasure: "EA",
            tags: ["Aluminium", "Die-Cast"],
            children: [],
          },
        ],
      },
      {
        id: "60103000",
        name: "Frame & Endshield Assembly",
        type: "sub-assembly",
        revision: "B.1",
        quantity: 1,
        findNumber: "30",
        unitOfMeasure: "EA",
        tags: ["Mechanical", "Cast Iron"],
        children: [
          {
            id: "60103001",
            name: "Motor Frame Casting",
            type: "part",
            revision: "B.0",
            quantity: 1,
            findNumber: "10",
            unitOfMeasure: "EA",
            tags: ["Casting", "Frame"],
            children: [],
          },
          {
            id: "60103002",
            name: "Drive End Endshield",
            type: "part",
            revision: "A.2",
            quantity: 1,
            findNumber: "20",
            unitOfMeasure: "EA",
            tags: ["Cast Iron"],
            children: [],
          },
          {
            id: "60103003",
            name: "Non-Drive End Endshield",
            type: "part",
            revision: "A.2",
            quantity: 1,
            findNumber: "30",
            unitOfMeasure: "EA",
            tags: ["Cast Iron"],
            children: [],
          },
        ],
      },
      {
        id: "60104000",
        name: "Bearing Assembly",
        type: "sub-assembly",
        revision: "A.3",
        quantity: 1,
        findNumber: "40",
        unitOfMeasure: "EA",
        tags: ["Mechanical", "Wear Item"],
        children: [
          {
            id: "60104001",
            name: "Drive End Spherical Roller Bearing",
            type: "part",
            revision: "A.2",
            quantity: 1,
            findNumber: "10",
            unitOfMeasure: "EA",
            tags: ["Safety Vital", "SKF"],
            children: [],
          },
          {
            id: "60104002",
            name: "NDE Deep Groove Ball Bearing",
            type: "part",
            revision: "A.1",
            quantity: 1,
            findNumber: "20",
            unitOfMeasure: "EA",
            tags: ["Safety Vital", "SKF"],
            children: [],
          },
        ],
      },
    ],
  },
];

export const BOM_TREES: Record<string, BOMNode[]> = {
  wap7: INITIAL_BOM_TREE,
  wag9hc: WAG9HC_BOM_TREE,
  detc: DETC_BOM_TREE,
  tractionmotor: TRACTION_MOTOR_BOM_TREE,
};

export const PRODUCTS: Product[] = [
  {
    id: "wap7",
    name: "WAP-7",
    subtitle: "Electric Passenger Locomotive",
    category: "Passenger Locomotive",
    description:
      "25kV AC electric locomotive for Indian Railways mainline passenger service. 6120 HP with regenerative braking.",
    rootPL: "38100000",
    revision: "D",
    lifecycle: "Production",
    lastModified: "2026-03-20",
    assemblies: 5,
    parts: 0,
    total: 7,
    icon: "Train",
  },
  {
    id: "wag9hc",
    name: "WAG-9HC",
    subtitle: "Electric Freight Locomotive",
    category: "Freight Locomotive",
    description:
      "9000 HP 25kV AC freight locomotive with IGBT converters and regenerative braking for heavy haul.",
    rootPL: "46100000",
    revision: "C.1",
    lifecycle: "Production",
    lastModified: "2026-02-15",
    assemblies: 10,
    parts: 4,
    total: 14,
    icon: "Container",
  },
  {
    id: "detc",
    name: "DETC",
    subtitle: "Double-Deck EMU Motor Coach",
    category: "EMU Rolling Stock",
    description:
      "Double-deck electric multiple unit motor coach for high-capacity suburban and intercity corridors.",
    rootPL: "52000000",
    revision: "B",
    lifecycle: "In Development",
    lastModified: "2026-01-10",
    assemblies: 7,
    parts: 3,
    total: 10,
    icon: "Layers",
  },
  {
    id: "tractionmotor",
    name: "Traction Motor",
    subtitle: "HS-15250A Axle-Hung Motor",
    category: "Electrical Component",
    description:
      "Axle-hung, nose-suspended squirrel cage induction motor for WAP7 and WAG9 class locomotives.",
    rootPL: "60100000",
    revision: "B.2",
    lifecycle: "Production",
    lastModified: "2026-03-01",
    assemblies: 4,
    parts: 7,
    total: 11,
    icon: "Zap",
  },
];
