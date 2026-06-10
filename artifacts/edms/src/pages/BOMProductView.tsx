import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  Box,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Cpu,
  ExternalLink,
  Eye,
  FileText,
  GitBranch,
  GripVertical,
  Hash,
  Layers,
  MoveDiagonal,
  Plus,
  Search,
  Shield,
  Sparkles,
  Unlink2,
  X,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { useNavigate, useParams } from "react-router";
import {
  DocumentDetailsButton,
  DocumentPreviewButton,
  getDocumentContextAttributes,
} from "../components/documents/DocumentPreviewActions";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { DatePicker } from "../components/ui/DatePicker";
import { PLNumberSelect } from "../components/ui/PLNumberSelect";
import { Badge, Button, GlassCard, Input, Select } from "../components/ui/Shared";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import { usePLItems } from "../hooks/usePLItems";
import type { BOMNode } from "../lib/bomData";
import {
  BOM_TREES,
  cloneTree,
  countNodes,
  findNode,
  PL_DATABASE,
  PRODUCTS,
  removeNode,
  searchTree,
} from "../lib/bomData";
import { BomDraftService } from "../services/BomDraftService";

const BOM_ITEM_TYPE = "BOM_NODE";

type MovePlacement = "before" | "inside" | "after" | "root";

interface DragItem {
  id: string;
}

function NodeIcon({ type }: { type: string }) {
  if (type === "assembly") return <Box className="w-4 h-4 text-blue-400 shrink-0" />;
  if (type === "sub-assembly") return <Layers className="w-4 h-4 text-indigo-400 shrink-0" />;
  return <Cpu className="w-4 h-4 text-muted-foreground shrink-0" />;
}

function tagColor(tag: string) {
  const t = tag.toLowerCase();
  if (t.includes("safety vital")) return "bg-rose-900/40 text-rose-400 border-rose-500/30";
  if (t.includes("high voltage")) return "bg-amber-900/40 text-amber-400 border-amber-500/30";
  if (t.includes("electrical") || t.includes("electronics"))
    return "bg-blue-900/40 text-blue-400 border-blue-500/30";
  if (t.includes("safety")) return "bg-rose-900/30 text-rose-400 border-rose-500/20";
  return "bg-secondary/80 text-muted-foreground border-border";
}

function containsNode(nodes: BOMNode[], id: string): boolean {
  return nodes.some((node) => node.id === id || containsNode(node.children, id));
}

function canMoveToTarget(tree: BOMNode[], dragId: string, targetId: string | null) {
  if (!targetId) return true;
  if (dragId === targetId) return false;
  const dragged = findNode(tree, dragId);
  if (!dragged) return false;
  return !containsNode(dragged.children, targetId);
}

function moveNodeAcrossHierarchy(
  tree: BOMNode[],
  dragId: string,
  targetId: string | null,
  placement: MovePlacement,
) {
  if (targetId && !canMoveToTarget(tree, dragId, targetId)) {
    return tree;
  }

  const removal = removeNode(tree, dragId);
  if (!removal.removed) {
    return tree;
  }

  const nextTree = removal.tree;
  const draggedNode = removal.removed;

  if (placement === "root" || !targetId) {
    nextTree.push(draggedNode);
    return nextTree;
  }

  if (placement === "inside") {
    const targetNode = findNode(nextTree, targetId);
    if (!targetNode) return tree;
    targetNode.children.push(draggedNode);
    return nextTree;
  }

  const insertRelativeToTarget = (nodes: BOMNode[]): boolean => {
    for (let index = 0; index < nodes.length; index += 1) {
      if (nodes[index].id === targetId) {
        const insertionIndex = placement === "before" ? index : index + 1;
        nodes.splice(insertionIndex, 0, draggedNode);
        return true;
      }

      if (insertRelativeToTarget(nodes[index].children)) {
        return true;
      }
    }

    return false;
  };

  return insertRelativeToTarget(nextTree) ? nextTree : tree;
}

function reorderWithinParent(
  tree: BOMNode[],
  parentId: string | null,
  fromIndex: number,
  toIndex: number,
) {
  if (fromIndex === toIndex) return tree;

  const nextTree = cloneTree(tree);

  if (parentId === null) {
    const [item] = nextTree.splice(fromIndex, 1);
    nextTree.splice(toIndex, 0, item);
    return nextTree;
  }

  const parent = findNode(nextTree, parentId);
  if (!parent) {
    return tree;
  }

  const [item] = parent.children.splice(fromIndex, 1);
  parent.children.splice(toIndex, 0, item);
  return nextTree;
}

function resolvePlacement(pointerY: number, bounds: DOMRect): MovePlacement {
  const relativeY = pointerY - bounds.top;
  const threshold = bounds.height * 0.32;

  if (relativeY < threshold) return "before";
  if (relativeY > bounds.height - threshold) return "after";
  return "inside";
}

function placementLabel(placement: MovePlacement | null) {
  if (placement === "before") return "Place above";
  if (placement === "inside") return "Nest here";
  if (placement === "after") return "Place below";
  if (placement === "root") return "Promote to top level";
  return "";
}

function DraggableBOMRow({
  node,
  index,
  parentId,
  siblingCount,
  isExpanded,
  toggleExpand,
  selectedId,
  onSelect,
  searchMatches,
  onMoveNode,
  onReorderWithinParent,
  canAcceptDrop,
  onDelink,
  children,
}: {
  node: BOMNode;
  index: number;
  parentId: string | null;
  siblingCount: number;
  isExpanded: boolean;
  toggleExpand: (id: string) => void;
  selectedId: string | null;
  onSelect: (nodeId: string) => void;
  searchMatches: Set<string>;
  onMoveNode: (dragId: string, targetId: string | null, placement: MovePlacement) => void;
  onReorderWithinParent: (parentId: string | null, from: number, to: number) => void;
  canAcceptDrop: (dragId: string, targetId: string) => boolean;
  onDelink: (node: BOMNode) => void;
  children?: React.ReactNode;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const plRecord = PL_DATABASE[node.id];
  const isSelected = selectedId === node.id;
  const isMatch = searchMatches.size > 0 && searchMatches.has(node.id);
  const hasChildren = node.children.length > 0;
  const [dropPlacement, setDropPlacement] = useState<MovePlacement | null>(null);

  const [{ isDragging }, dragHandleRef] = useDrag<DragItem, void, { isDragging: boolean }>({
    type: BOM_ITEM_TYPE,
    item: { id: node.id },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [{ isOver, canDrop }, dropRef] = useDrop<
    DragItem,
    void,
    { isOver: boolean; canDrop: boolean }
  >({
    accept: BOM_ITEM_TYPE,
    canDrop: (item) => canAcceptDrop(item.id, node.id),
    hover: (item, monitor) => {
      if (!rowRef.current || !canAcceptDrop(item.id, node.id)) {
        setDropPlacement(null);
        return;
      }

      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;

      setDropPlacement(resolvePlacement(clientOffset.y, rowRef.current.getBoundingClientRect()));
    },
    drop: (item, monitor) => {
      if (
        !rowRef.current ||
        !monitor.isOver({ shallow: true }) ||
        !canAcceptDrop(item.id, node.id)
      ) {
        return;
      }

      const clientOffset = monitor.getClientOffset();
      const placement = clientOffset
        ? resolvePlacement(clientOffset.y, rowRef.current.getBoundingClientRect())
        : "inside";

      onMoveNode(item.id, node.id, placement);
      setDropPlacement(null);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
  });

  useEffect(() => {
    if (!isOver) {
      setDropPlacement(null);
    }
  }, [isOver]);

  dragHandleRef(dropRef(rowRef));

  const showDropSuggestion = isOver && canDrop && dropPlacement;

  return (
    <div ref={rowRef} style={{ opacity: isDragging ? 0.42 : 1 }}>
      <div
        className={`relative flex items-center gap-1.5 rounded-xl border px-2 py-2.5 transition-all group min-h-[46px] ${
          isSelected
            ? "bg-teal-500/15 border-teal-500/25"
            : "hover:bg-secondary/50 border-transparent"
        } ${isMatch ? "ring-1 ring-teal-500/40" : ""} ${showDropSuggestion ? "bg-teal-500/10 border-teal-400/40 shadow-[0_0_0_1px_rgba(94,234,212,0.08)]" : ""}`}
        onClick={() => onSelect(node.id)}
      >
        {showDropSuggestion && dropPlacement === "before" && (
          <div className="absolute inset-x-3 top-0 h-px bg-teal-300/80 shadow-[0_0_10px_rgba(94,234,212,0.6)]" />
        )}
        {showDropSuggestion && dropPlacement === "after" && (
          <div className="absolute inset-x-3 bottom-0 h-px bg-teal-300/80 shadow-[0_0_10px_rgba(94,234,212,0.6)]" />
        )}
        {showDropSuggestion && (
          <div className="absolute right-3 -top-2 rounded-full border border-teal-400/40 bg-slate-950/95 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-primary/90 shadow-lg">
            {placementLabel(dropPlacement)}
          </div>
        )}

        <div
          className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity -ml-1"
          onClick={(event) => event.stopPropagation()}
        >
          <div
            className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-primary transition-colors"
            title="Drag to restructure the hierarchy"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </div>
          <div className="flex flex-col gap-px">
            <button
              type="button"
              disabled={index === 0}
              onClick={(event) => {
                event.stopPropagation();
                onReorderWithinParent(parentId, index, index - 1);
              }}
              className="p-0.5 text-slate-600 hover:text-primary disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
              aria-label="Move up"
            >
              <ChevronUp className="w-2.5 h-2.5" />
            </button>
            <button
              type="button"
              disabled={index >= siblingCount - 1}
              onClick={(event) => {
                event.stopPropagation();
                onReorderWithinParent(parentId, index, index + 1);
              }}
              className="p-0.5 text-slate-600 hover:text-primary disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
              aria-label="Move down"
            >
              <ChevronDown className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>

        <div className="shrink-0 w-5">
          {hasChildren ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                toggleExpand(node.id);
              }}
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          ) : (
            <div className="w-2 h-2 mx-auto rounded-full border border-border bg-secondary/60" />
          )}
        </div>

        <NodeIcon type={node.type} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground truncate leading-tight">
              {node.name}
            </span>
            {plRecord?.safetyVital && (
              <Shield className="w-3 h-3 text-rose-400 shrink-0" aria-label="Safety Vital" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
            <span className="font-mono text-primary">{node.id}</span>
            <span>·</span>
            <span>Rev {node.revision}</span>
            <span>·</span>
            <span>Qty: {node.quantity}</span>
          </div>
        </div>

        {node.tags.slice(0, 1).map((tag) => (
          <span
            key={tag}
            className={`shrink-0 px-1.5 py-0.5 border rounded-md text-[9px] font-medium ${tagColor(tag)}`}
          >
            {tag}
          </span>
        ))}

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelink(node);
              }}
              className="shrink-0 p-1 rounded text-muted-foreground/40 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all"
              aria-label={`Remove ${node.name} from BOM`}
            >
              <Unlink2 className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Remove from BOM</TooltipContent>
        </Tooltip>
      </div>

      {hasChildren && isExpanded && (
        <div className="ml-8 pl-3 border-l border-teal-500/15 mt-0.5 space-y-0.5">{children}</div>
      )}
    </div>
  );
}

function RootDropZone({
  label,
  hint,
  onMoveNode,
}: {
  label: string;
  hint: string;
  onMoveNode: (dragId: string, targetId: string | null, placement: MovePlacement) => void;
}) {
  const [{ isOver, canDrop }, dropRef] = useDrop<
    DragItem,
    void,
    { isOver: boolean; canDrop: boolean }
  >({
    accept: BOM_ITEM_TYPE,
    canDrop: () => true,
    drop: (item, monitor) => {
      if (monitor.isOver({ shallow: true })) {
        onMoveNode(item.id, null, "root");
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
  });

  return (
    <div
      ref={(node) => {
        dropRef(node);
      }}
      className={`rounded-xl border border-dashed px-3 py-2 text-[11px] transition-all ${
        isOver && canDrop
          ? "border-teal-400/50 bg-teal-500/10 text-primary/90 shadow-[0_0_0_1px_rgba(94,234,212,0.08)]"
          : "border-white/8 bg-slate-950/25 text-muted-foreground"
      }`}
    >
      <div className="flex items-center gap-2">
        <MoveDiagonal className="w-3.5 h-3.5" />
        <span className="font-semibold tracking-wide">{label}</span>
      </div>
      <p className="mt-1 text-[10px] text-inherit/80">{hint}</p>
    </div>
  );
}

function BOMTreeLevel({
  nodes,
  parentId,
  expanded,
  toggleExpand,
  selectedId,
  onSelect,
  searchMatches,
  onMoveNode,
  onReorderWithinParent,
  canAcceptDrop,
  onDelink,
}: {
  nodes: BOMNode[];
  parentId: string | null;
  expanded: Set<string>;
  toggleExpand: (id: string) => void;
  selectedId: string | null;
  onSelect: (nodeId: string) => void;
  searchMatches: Set<string>;
  onMoveNode: (dragId: string, targetId: string | null, placement: MovePlacement) => void;
  onReorderWithinParent: (parentId: string | null, from: number, to: number) => void;
  canAcceptDrop: (dragId: string, targetId: string) => boolean;
  onDelink: (node: BOMNode) => void;
}) {
  return (
    <>
      {nodes.map((node, index) => (
        <DraggableBOMRow
          key={node.id}
          node={node}
          index={index}
          parentId={parentId}
          siblingCount={nodes.length}
          isExpanded={expanded.has(node.id)}
          toggleExpand={toggleExpand}
          selectedId={selectedId}
          onSelect={onSelect}
          searchMatches={searchMatches}
          onMoveNode={onMoveNode}
          onReorderWithinParent={onReorderWithinParent}
          canAcceptDrop={canAcceptDrop}
          onDelink={onDelink}
        >
          {node.children.length > 0 && expanded.has(node.id) && (
            <BOMTreeLevel
              nodes={node.children}
              parentId={node.id}
              expanded={expanded}
              toggleExpand={toggleExpand}
              selectedId={selectedId}
              onSelect={onSelect}
              searchMatches={searchMatches}
              onMoveNode={onMoveNode}
              onReorderWithinParent={onReorderWithinParent}
              canAcceptDrop={canAcceptDrop}
              onDelink={onDelink}
            />
          )}
        </DraggableBOMRow>
      ))}
    </>
  );
}

function DetailPanel({ node, onClose }: { node: BOMNode; onClose: () => void }) {
  const navigate = useNavigate();
  const plRecord = PL_DATABASE[node.id];

  return (
    <motion.div
      key="detail-panel"
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="w-80 flex-shrink-0 flex flex-col bg-card/40 border-l border-border backdrop-blur-md overflow-hidden"
    >
      <div className="flex items-center justify-between p-3.5 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <NodeIcon type={node.type} />
          <h2 className="text-xs font-bold text-foreground truncate">{node.name}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-secondary/60"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 custom-scrollbar">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
            PL Identity
          </p>
          <div className="bg-card/40 border border-border/50 rounded-xl p-3 space-y-2">
            <div>
              <p className="text-[10px] text-muted-foreground">PL Number</p>
              <p className="font-mono text-xs font-semibold text-primary flex items-center gap-1.5">
                <Hash className="w-3 h-3" />
                {node.id}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Type", value: node.type },
                { label: "Revision", value: node.revision, mono: true },
                {
                  label: "Quantity",
                  value: `${node.quantity} ${node.unitOfMeasure}`,
                },
                { label: "Find No.", value: node.findNumber, mono: true },
              ].map((field) => (
                <div key={field.label}>
                  <p className="text-[10px] text-muted-foreground">{field.label}</p>
                  <p
                    className={`text-xs font-medium text-foreground capitalize ${field.mono ? "font-mono" : ""}`}
                  >
                    {field.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {node.tags.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Tags
            </p>
            <div className="flex flex-wrap gap-1.5">
              {node.tags.map((tag) => (
                <span
                  key={tag}
                  className={`px-2 py-0.5 border rounded-md text-[10px] font-medium ${tagColor(tag)}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {plRecord && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              PL Record
            </p>
            <div className="bg-card/40 border border-border/50 rounded-xl p-3 space-y-2">
              {plRecord.safetyVital && (
                <div className="flex items-center gap-2 px-2.5 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                  <Shield className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="text-xs text-rose-300 font-medium">Safety Vital Item</span>
                </div>
              )}
              {[
                { label: "Owner", value: plRecord.owner },
                { label: "Department", value: plRecord.department },
                { label: "Lifecycle", value: plRecord.lifecycleState },
                ...(plRecord.weight ? [{ label: "Weight", value: plRecord.weight }] : []),
                ...(plRecord.supplier ? [{ label: "Supplier", value: plRecord.supplier }] : []),
                ...(plRecord.source ? [{ label: "Source", value: plRecord.source }] : []),
              ].map((field) => (
                <div key={field.label}>
                  <p className="text-[10px] text-muted-foreground">{field.label}</p>
                  <p className="text-xs text-foreground">{field.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {plRecord && plRecord.linkedDocuments.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Linked Documents ({plRecord.linkedDocuments.length})
            </p>
            <div className="space-y-1.5">
              {plRecord.linkedDocuments.slice(0, 3).map((doc) => (
                <div
                  key={doc.docId}
                  {...getDocumentContextAttributes(doc.docId, doc.title)}
                  className="flex items-center gap-2 p-2 rounded-lg bg-card/20 border border-border/50"
                >
                  <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-foreground/90 truncate">{doc.title}</p>
                    <p className="text-[9px] text-muted-foreground">
                      {doc.type} · Rev {doc.revision}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <DocumentPreviewButton
                      documentId={doc.docId}
                      title={doc.title}
                      iconOnly
                      className="h-7 min-h-0 px-2 text-foreground/90 hover:text-teal-200"
                    />
                    <DocumentDetailsButton
                      documentId={doc.docId}
                      iconOnly
                      className="h-7 min-h-0 px-2 text-foreground/90 hover:text-white"
                    />
                  </div>
                  <Badge
                    variant={
                      doc.status === "Approved"
                        ? "success"
                        : doc.status === "In Review"
                          ? "warning"
                          : "default"
                    }
                    className="text-[9px] px-1.5"
                  >
                    {doc.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {node.children.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Children ({node.children.length})
            </p>
            <div className="space-y-1">
              {node.children.map((child) => (
                <div
                  key={child.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-card/40 border border-border"
                >
                  <NodeIcon type={child.type} />
                  <span className="text-xs text-foreground/90 flex-1 truncate">{child.name}</span>
                  <span className="font-mono text-[10px] text-primary">{child.id}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border space-y-2">
        {plRecord ? (
          <Button className="w-full" onClick={() => navigate(`/pl/${node.id}`)}>
            <ExternalLink className="w-4 h-4" /> View Complete PL Details
          </Button>
        ) : (
          <div className="flex items-center gap-2 p-3 bg-amber-900/20 border border-amber-500/20 rounded-xl">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-xs text-amber-300">No PL record found for this node</p>
          </div>
        )}
        <Button variant="secondary" className="w-full" onClick={() => navigate("/pl")}>
          <Eye className="w-3.5 h-3.5" /> Browse PL Hub
        </Button>
      </div>
    </motion.div>
  );
}

function getAllAssemblyTargets(nodes: BOMNode[]): { id: string; name: string; type: string }[] {
  const result: { id: string; name: string; type: string }[] = [];

  function collect(items: BOMNode[]) {
    for (const item of items) {
      if (item.type !== "part") {
        result.push({ id: item.id, name: item.name, type: item.type });
      }
      collect(item.children);
    }
  }

  collect(nodes);
  return result;
}

interface AddNodeForm {
  plNumber: string;
  name: string;
  nodeType: "assembly" | "sub-assembly" | "part";
  parentId: string;
  quantity: number;
  findNumber: string;
  revision: string;
  effectiveDate: string;
}

function AddNodeModal({
  bom,
  workspaceName,
  onClose,
  onAdd,
}: {
  bom: BOMNode[];
  workspaceName: string;
  onClose: () => void;
  onAdd: (node: BOMNode, parentId: string | null) => void;
}) {
  const [form, setForm] = useState<AddNodeForm>({
    plNumber: "",
    name: "",
    nodeType: "part",
    parentId: "ROOT",
    quantity: 1,
    findNumber: "10",
    revision: "A",
    effectiveDate: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [plLookupResult, setPlLookupResult] = useState<(typeof PL_DATABASE)[string] | null>(null);
  const { data: plItems, loading: plItemsLoading } = usePLItems();

  const parentOptions = [
    { id: "ROOT", name: "Top Level (no parent)", type: "root" },
    ...getAllAssemblyTargets(bom),
  ];
  const selectedPl = useMemo(
    () => plItems.find((item) => item.plNumber === form.plNumber) ?? null,
    [form.plNumber, plItems],
  );

  const handlePlNumberChange = (plNumber: string) => {
    const pl = PL_DATABASE[plNumber] ?? null;
    const matchedPl = plItems.find((item) => item.plNumber === plNumber) ?? null;
    setPlLookupResult(pl);
    setForm((current) => ({
      ...current,
      plNumber,
      name: pl?.name ?? matchedPl?.name ?? current.name,
      nodeType: pl
        ? pl.type === "assembly"
          ? "assembly"
          : pl.type === "sub-assembly"
            ? "sub-assembly"
            : "part"
        : current.nodeType,
      revision: pl?.revision ?? current.revision,
    }));
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!/^\d{8}$/.test(form.plNumber.trim())) nextErrors.plNumber = "Enter an 8-digit PL number.";
    if (!form.name.trim()) nextErrors.name = "Name is required";
    if (form.quantity < 1) nextErrors.quantity = "Quantity must be at least 1";
    return nextErrors;
  };

  const handleSubmit = () => {
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const newNode: BOMNode = {
      id: form.plNumber.trim(),
      name: form.name.trim(),
      type: form.nodeType,
      revision: form.revision || "A",
      quantity: form.quantity,
      findNumber: form.findNumber || "10",
      unitOfMeasure: "EA",
      tags: plLookupResult ? plLookupResult.tags.slice(0, 2) : [],
      children: [],
    };

    onAdd(newNode, form.parentId === "ROOT" ? null : form.parentId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <GlassCard className="w-full max-w-2xl p-4 bg-card/40 border border-border/50 backdrop-blur-md shadow-2xl max-h-[92vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">Add PL Node</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Place a new PL anywhere in {workspaceName}. You can also drag it later to promote,
              demote, or re-nest it.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground/90 hover:bg-secondary/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <span className="text-xs font-medium text-muted-foreground mb-1.5 block">
              PL Number *
            </span>
            <PLNumberSelect
              value={form.plNumber}
              onChange={handlePlNumberChange}
              plItems={plItems}
              loading={plItemsLoading}
              placeholder="Search and select the PL to add..."
              helperText="Choose the PL first, then place it anywhere in the hierarchy and drag it later if needed."
              showPreview={false}
              showViewLink={false}
            />
            {errors.plNumber && <p className="text-[10px] text-rose-400 mt-1">{errors.plNumber}</p>}
          </div>

          {(plLookupResult || selectedPl) && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-teal-900/20 border border-teal-500/20">
              <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-primary/90">
                  {plLookupResult?.name ?? selectedPl?.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {plLookupResult
                    ? `${plLookupResult.department} · Rev ${plLookupResult.revision} · ${plLookupResult.lifecycleState}`
                    : `${selectedPl?.controllingAgency ?? "CLW"} · ${selectedPl?.status ?? "ACTIVE"} record`}
                </p>
                {(plLookupResult?.safetyVital || selectedPl?.safetyCritical) && (
                  <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-rose-900/30 border border-rose-500/30 rounded-full text-[10px] text-rose-300">
                    <Shield className="w-2.5 h-2.5" /> Safety Vital
                  </span>
                )}
              </div>
            </div>
          )}

          <div>
            <span className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Component Name *
            </span>
            <Input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="e.g. Bogie Frame Assembly"
              className={`w-full ${errors.name ? "border-rose-500/50" : ""}`}
            />
            {errors.name && <p className="text-[10px] text-rose-400 mt-1">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Node Type
              </span>
              <Select
                value={form.nodeType}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    nodeType: event.target.value as AddNodeForm["nodeType"],
                  }))
                }
                className="w-full"
              >
                <option value="assembly">Assembly</option>
                <option value="sub-assembly">Sub-Assembly</option>
                <option value="part">Part</option>
              </Select>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Revision
              </span>
              <Input
                value={form.revision}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    revision: event.target.value,
                  }))
                }
                placeholder="e.g. A"
                className="w-full font-mono"
              />
            </div>
          </div>

          <div>
            <span className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Place Under
            </span>
            <Select
              value={form.parentId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  parentId: event.target.value,
                }))
              }
              className="w-full"
            >
              {parentOptions.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.type === "root" ? "⊤ Top Level" : `↳ ${parent.name} (${parent.id})`}
                </option>
              ))}
            </Select>
            <p className="text-[10px] text-slate-600 mt-1">
              This only chooses the initial placement. The magnetic drag hints will still let you
              move it anywhere later.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Quantity
              </span>
              <Input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    quantity: Number(event.target.value),
                  }))
                }
                className={`w-full ${errors.quantity ? "border-rose-500/50" : ""}`}
              />
              {errors.quantity && (
                <p className="text-[10px] text-rose-400 mt-1">{errors.quantity}</p>
              )}
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Find Number
              </span>
              <Input
                value={form.findNumber}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    findNumber: event.target.value,
                  }))
                }
                placeholder="e.g. 10"
                className="w-full font-mono"
              />
            </div>
          </div>

          <DatePicker
            label="Effective From Date"
            value={form.effectiveDate}
            onChange={(value) => setForm((current) => ({ ...current, effectiveDate: value }))}
            placeholder="Optional"
          />
        </div>

        <div className="flex gap-3 mt-6 pt-5 border-t border-border">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="flex-1">
            <Plus className="w-4 h-4" /> Add to BOM
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}

function BOMProductViewInner() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const draft = productId ? BomDraftService.getById(productId) : null;
  const product = draft?.product ?? PRODUCTS.find((item) => item.id === productId);
  const resolvedTree = draft?.tree ?? (productId ? (BOM_TREES[productId] ?? null) : null);

  const [bom, setBom] = useState<BOMNode[]>(resolvedTree ? cloneTree(resolvedTree) : []);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showAddNode, setShowAddNode] = useState(false);
  const [delinkTarget, setDelinkTarget] = useState<BOMNode | null>(null);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const next = new Set<string>();
    if (resolvedTree?.[0]) next.add(resolvedTree[0].id);
    return next;
  });

  useEffect(() => {
    setBom(resolvedTree ? cloneTree(resolvedTree) : []);
    setSelectedNodeId(null);
    setSearch("");
    setShowAddNode(false);
    setExpanded(() => {
      const next = new Set<string>();
      if (resolvedTree?.[0]) next.add(resolvedTree[0].id);
      return next;
    });
  }, [productId]);

  useEffect(() => {
    if (draft && bom.length > 0) {
      BomDraftService.saveTree(draft.id, bom);
    }
  }, [bom, draft]);

  const selectedNode = selectedNodeId ? findNode(bom, selectedNodeId) : null;
  const searchMatches = search.trim() ? searchTree(bom, search) : new Set<string>();
  const stats = countNodes(bom);

  const toggleExpand = useCallback((id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const ids = new Set<string>();
    const collect = (nodes: BOMNode[]) => {
      for (const node of nodes) {
        ids.add(node.id);
        collect(node.children);
      }
    };
    collect(bom);
    setExpanded(ids);
  }, [bom]);

  const collapseAll = useCallback(() => {
    setExpanded(bom.length > 0 ? new Set([bom[0].id]) : new Set());
  }, [bom]);

  const handleAddNode = useCallback((node: BOMNode, parentId: string | null) => {
    setBom((current) => {
      const next = cloneTree(current);
      if (parentId === null) {
        next.push(node);
      } else {
        const parent = findNode(next, parentId);
        if (parent) parent.children.push(node);
      }
      return next;
    });

    setExpanded((current) => {
      const next = new Set(current);
      if (parentId) next.add(parentId);
      return next;
    });
  }, []);

  const handleMoveNode = useCallback(
    (dragId: string, targetId: string | null, placement: MovePlacement) => {
      setBom((current) => moveNodeAcrossHierarchy(current, dragId, targetId, placement));

      if (targetId && placement === "inside") {
        setExpanded((current) => {
          const next = new Set(current);
          next.add(targetId);
          return next;
        });
      }
    },
    [],
  );

  const handleReorderWithinParent = useCallback(
    (parentId: string | null, fromIndex: number, toIndex: number) => {
      setBom((current) => reorderWithinParent(current, parentId, fromIndex, toIndex));
    },
    [],
  );

  const canAcceptDrop = useCallback(
    (dragId: string, targetId: string) => canMoveToTarget(bom, dragId, targetId),
    [bom],
  );

  const handleDelink = useCallback((node: BOMNode) => {
    setDelinkTarget(node);
  }, []);

  const confirmDelink = useCallback(() => {
    if (!delinkTarget) return;
    setBom((current) => {
      const result = removeNode(current, delinkTarget.id);
      return result.tree;
    });
    if (selectedNodeId === delinkTarget.id) setSelectedNodeId(null);
    setDelinkTarget(null);
  }, [delinkTarget, selectedNodeId]);

  if (!product || !resolvedTree) {
    return (
      <div className="flex items-center justify-center h-64">
        <GlassCard className="p-12 text-center">
          <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <p className="text-foreground/90 font-medium">Product not found</p>
          <p className="text-muted-foreground text-sm mb-4">
            The BOM for "{productId}" does not exist
          </p>
          <Button onClick={() => navigate("/bom")}>
            <ArrowLeft className="w-4 h-4" /> Back to Explorer
          </Button>
        </GlassCard>
      </div>
    );
  }

  const isDraftWorkspace = Boolean(draft);

  return (
    <div className="flex flex-col min-h-0">
      {/* Compact header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
            <button
              type="button"
              onClick={() => navigate("/bom")}
              className="hover:text-primary transition-colors flex items-center gap-1"
            >
              <GitBranch className="w-3 h-3" /> BOM Explorer
            </button>
            <ChevronRight className="w-3 h-3" />
          </nav>
          <h1 className="text-sm font-bold text-foreground truncate">{product.name}</h1>
          {isDraftWorkspace && (
            <Badge variant="info" className="shrink-0">
              Draft
            </Badge>
          )}
          <Badge
            variant={
              product.lifecycle === "Production"
                ? "success"
                : product.lifecycle === "In Development"
                  ? "info"
                  : "warning"
            }
            className="shrink-0"
          >
            {product.lifecycle}
          </Badge>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground mr-2">
            <span>
              Nodes <strong className="text-primary font-mono">{stats.total}</strong>
            </span>
            <span>
              Asm <strong className="text-foreground font-mono">{stats.assemblies}</strong>
            </span>
            <span>
              Parts <strong className="text-foreground font-mono">{stats.parts}</strong>
            </span>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setShowInfoPanel((p) => !p)}
                className={`px-2 py-1.5 text-xs border rounded-lg transition-colors ${showInfoPanel ? "border-primary/50 text-primary bg-primary/10" : "border-border/60 text-muted-foreground hover:text-primary/90"}`}
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{showInfoPanel ? "Hide" : "Show"} BOM details panel</p>
            </TooltipContent>
          </Tooltip>
          <Button variant="secondary" size="sm" onClick={() => navigate("/bom")}>
            <ArrowLeft className="w-3.5 h-3.5" /> All Products
          </Button>
          <Button variant="secondary" size="sm" onClick={() => navigate("/pl")}>
            <Eye className="w-3.5 h-3.5" /> PL Hub
          </Button>
          <Button size="sm" onClick={() => setShowAddNode(true)}>
            <Plus className="w-3.5 h-3.5" /> Add Node
          </Button>
        </div>
      </div>

      {/* Main content — BOM tree + optional info panel + detail panel */}
      <div className="flex min-h-0">
        {/* BOM tree — takes all available space, grows with content */}
        <GlassCard className="flex flex-col flex-1 min-w-0 rounded-none border-0 border-r border-border bg-card/40 backdrop-blur-md">
          <div className="p-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search by name, PL number, or tag..."
                  className="pl-9 w-full h-9"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={expandAll}
                className="h-9 px-3 text-xs text-muted-foreground hover:text-primary/90 border border-border/60 rounded-lg transition-colors whitespace-nowrap flex items-center justify-center bg-card/40 hover:bg-secondary/40"
              >
                Expand All
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="h-9 px-3 text-xs text-muted-foreground hover:text-primary/90 border border-border/60 rounded-lg transition-colors flex items-center justify-center bg-card/40 hover:bg-secondary/40"
              >
                Collapse
              </button>
            </div>
            {search && searchMatches.size > 0 && (
              <p className="text-xs text-primary mt-2 flex items-center gap-1">
                <Search className="w-3 h-3" />
                {searchMatches.size} match{searchMatches.size !== 1 ? "es" : ""} for "{search}"
              </p>
            )}
          </div>

          <div className="border-b border-border px-3 py-2 text-[10px] text-muted-foreground flex flex-wrap items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Drag a PL above, below, or into another node. Drop hints snap into place.</span>
          </div>

          <div className="p-3 space-y-1.5">
            <RootDropZone
              label="Top-level drop lane"
              hint="Drop here to promote any dragged PL back to the root of the BOM."
              onMoveNode={handleMoveNode}
            />

            <BOMTreeLevel
              nodes={bom}
              parentId={null}
              expanded={expanded}
              toggleExpand={toggleExpand}
              selectedId={selectedNodeId}
              onSelect={(nodeId) =>
                setSelectedNodeId((current) => (current === nodeId ? null : nodeId))
              }
              searchMatches={searchMatches}
              onMoveNode={handleMoveNode}
              onReorderWithinParent={handleReorderWithinParent}
              canAcceptDrop={canAcceptDrop}
              onDelink={handleDelink}
            />

            <RootDropZone
              label="Promote here"
              hint="Useful when downgrading a child was a mistake and the PL belongs at the top level instead."
              onMoveNode={handleMoveNode}
            />
          </div>
        </GlassCard>

        {/* Node detail panel — floats above info panel in priority */}
        <AnimatePresence>
          {selectedNode && (
            <DetailPanel node={selectedNode} onClose={() => setSelectedNodeId(null)} />
          )}
        </AnimatePresence>

        {/* Collapsible BOM info side panel */}
        <AnimatePresence>
          {showInfoPanel && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="shrink-0 border-l border-border bg-card/40 backdrop-blur-md overflow-hidden"
            >
              <div className="w-[280px] overflow-y-auto custom-scrollbar p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] uppercase tracking-widest font-bold text-primary">
                    BOM Details
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowInfoPanel(false)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                      Product
                    </p>
                    <p className="text-sm font-bold text-foreground">{product.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{product.subtitle}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-secondary/30 border border-border/30 rounded-lg p-2.5">
                      <p className="text-[10px] text-muted-foreground">Root PL</p>
                      <p className="text-xs font-mono font-bold text-primary">{product.rootPL}</p>
                    </div>
                    <div className="bg-secondary/30 border border-border/30 rounded-lg p-2.5">
                      <p className="text-[10px] text-muted-foreground">Revision</p>
                      <p className="text-xs font-mono font-bold text-foreground">
                        {product.revision}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-secondary/30 border border-border/30 rounded-lg p-2.5 text-center">
                      <p className="text-[10px] text-muted-foreground">Total</p>
                      <p className="text-sm font-mono font-bold text-primary">{stats.total}</p>
                    </div>
                    <div className="bg-secondary/30 border border-border/30 rounded-lg p-2.5 text-center">
                      <p className="text-[10px] text-muted-foreground">Asm</p>
                      <p className="text-sm font-mono font-bold text-foreground">
                        {stats.assemblies}
                      </p>
                    </div>
                    <div className="bg-secondary/30 border border-border/30 rounded-lg p-2.5 text-center">
                      <p className="text-[10px] text-muted-foreground">Parts</p>
                      <p className="text-sm font-mono font-bold text-foreground">{stats.parts}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                      Lifecycle
                    </p>
                    <Badge
                      variant={
                        product.lifecycle === "Production"
                          ? "success"
                          : product.lifecycle === "In Development"
                            ? "info"
                            : "warning"
                      }
                    >
                      {product.lifecycle}
                    </Badge>
                  </div>

                  {isDraftWorkspace && (
                    <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-3">
                      <p className="text-[10px] font-semibold text-amber-300 mb-1">
                        Draft Workspace
                      </p>
                      <p className="text-[10px] text-amber-200/70">
                        Structure changes are saved locally until the backend contract is finalized.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showAddNode && (
        <AddNodeModal
          bom={bom}
          workspaceName={product.name}
          onClose={() => setShowAddNode(false)}
          onAdd={handleAddNode}
        />
      )}

      <ConfirmDialog
        open={!!delinkTarget}
        onOpenChange={(open) => {
          if (!open) setDelinkTarget(null);
        }}
        variant="destructive"
        title={`Remove "${delinkTarget?.name}" from BOM?`}
        description={`This will de-link PL item ${delinkTarget?.id} from the current BOM structure. The PL record itself will not be deleted.`}
        confirmLabel="Remove"
        onConfirm={confirmDelink}
      />
    </div>
  );
}

export default function BOMProductView() {
  return (
    <DndProvider backend={HTML5Backend}>
      <BOMProductViewInner />
    </DndProvider>
  );
}
