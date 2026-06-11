import { motion } from "framer-motion";
import {
  ArrowRight,
  ChevronRight,
  Clock,
  Filter,
  GitBranch,
  Layers,
  Package,
  Plus,
  Search,
  Train,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Badge, Button, FilterPills, GlassCard, Input, PageHeader } from "../components/ui/Shared";
import type { Product } from "../lib/bomData";
import { PRODUCTS } from "../lib/bomData";
import { BomDraftService } from "../services/BomDraftService";
import { ExportImportService } from "../services/ExportImportService";

const PRODUCT_ICONS: Record<string, React.ElementType> = {
  Train,
  Container: Package,
  Layers,
  Zap,
};

function lifecycleBadgeVariant(lc: string): "success" | "warning" | "info" | "default" {
  if (lc === "Production") return "success";
  if (lc === "In Development") return "info";
  if (lc === "Prototyping") return "warning";
  return "default";
}

function categoryColor(cat: string): string {
  if (cat.includes("Passenger")) return "from-blue-500/10 to-teal-500/10 border-blue-500/20";
  if (cat.includes("Freight")) return "from-amber-500/10 to-orange-500/10 border-amber-500/20";
  if (cat.includes("EMU")) return "from-purple-500/10 to-indigo-500/10 border-purple-500/20";
  if (cat.includes("Electrical")) return "from-emerald-500/10 to-teal-500/10 border-emerald-500/20";
  return "from-teal-500/10 to-slate-500/10 border-teal-500/20";
}

function categoryIconColor(cat: string): string {
  if (cat.includes("Passenger")) return "text-blue-400";
  if (cat.includes("Freight")) return "text-amber-400";
  if (cat.includes("EMU")) return "text-purple-400";
  if (cat.includes("Electrical")) return "text-emerald-400";
  return "text-primary";
}

const CATEGORIES = [
  "All",
  "Passenger Locomotive",
  "Freight Locomotive",
  "EMU Rolling Stock",
  "Electrical Component",
];
const LIFECYCLES = ["All", "Production", "In Development", "Prototyping"];

function ProductCard({
  product,
  index,
  isDraft = false,
}: {
  product: Product;
  index: number;
  isDraft?: boolean;
}) {
  const navigate = useNavigate();
  const Icon = PRODUCT_ICONS[product.icon] || Package;
  const gradClass = categoryColor(product.category);
  const iconColor = categoryIconColor(product.category);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.06, ease: "easeOut" }}
      className={`relative group bg-card/40 border-border/50 rounded-xl bg-gradient-to-br ${gradClass} border cursor-pointer overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-secondary/40 backdrop-blur-md shadow-sm hover:shadow-lg`}
      onClick={() => navigate(`/bom/${product.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/bom/${product.id}`)}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gradient-to-br from-teal-500/5 to-transparent pointer-events-none" />

      <div className="p-4">
        {/* Icon + Badge row */}
        <div className="flex items-start justify-between mb-3">
          <div
            className={`w-9 h-9 rounded-lg bg-card border border-border flex items-center justify-center ${iconColor}`}
          >
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-1.5">
            {isDraft && <Badge variant="info">Draft</Badge>}
            <Badge variant={lifecycleBadgeVariant(product.lifecycle)}>{product.lifecycle}</Badge>
          </div>
        </div>

        {/* Name + subtitle */}
        <h3 className="text-sm font-bold text-foreground mb-0.5 tracking-tight">{product.name}</h3>
        <p className="text-[11px] text-muted-foreground mb-1">{product.subtitle}</p>
        <p className="text-[11px] text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
          {product.description}
        </p>

        {/* Stats row */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <GitBranch className="w-3 h-3 text-primary" />
            <span className="font-mono text-primary font-semibold">{product.total}</span>
            <span>nodes</span>
          </div>
          <span className="w-px h-3 bg-border" />
          <div className="text-[11px] text-muted-foreground">
            <span className="font-mono text-blue-400">{product.assemblies}</span> assy
          </div>
          <span className="w-px h-3 bg-border" />
          <div className="text-[11px] text-muted-foreground">
            <span className="font-mono text-foreground/90">{product.parts}</span> parts
          </div>
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between pt-2.5 border-t border-border">
          <div>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Root PL</p>
            <p className="font-mono text-[10px] text-primary">{product.rootPL}</p>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-medium text-primary group-hover:text-primary/90 transition-colors">
            <span>View BOM</span>
            <ArrowRight className="w-3 h-3 translate-x-0 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function CreateNewCard() {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 4 * 0.06, ease: "easeOut" }}
      className="relative bg-card/40 border-border/50 rounded-xl border-2 border-dashed border-teal-500/20 hover:border-teal-400/40 cursor-pointer group transition-all duration-200 hover:-translate-y-0.5 hover:bg-secondary/40 backdrop-blur-md overflow-hidden"
      onClick={() => navigate("/bom/new")}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => event.key === "Enter" && navigate("/bom/new")}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-teal-500/5 pointer-events-none" />
      <div className="p-4 h-full flex flex-col items-center justify-center text-center min-h-[200px]">
        <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-2.5 group-hover:bg-teal-500/20 transition-colors">
          <Plus className="w-4 h-4 text-primary" />
        </div>
        <p className="text-xs font-semibold text-primary mb-0.5 group-hover:text-primary/90 transition-colors">
          Create New BOM
        </p>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Define a new product structure and start building your bill of materials
        </p>
      </div>
    </motion.div>
  );
}

export default function BOMExplorer() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [lifecycleFilter, setLifecycleFilter] = useState("All");
  const draftProducts = BomDraftService.getAll().map((draft) => draft.product);
  const allProducts = [...draftProducts, ...PRODUCTS];

  const filtered = allProducts.filter((p) => {
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.subtitle.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase()) ||
      p.rootPL.includes(search);
    const matchCat = categoryFilter === "All" || p.category === categoryFilter;
    const matchLife = lifecycleFilter === "All" || p.lifecycle === lifecycleFilter;
    return matchSearch && matchCat && matchLife;
  });

  const totalNodes = allProducts.reduce((s, p) => s + p.total, 0);
  const totalParts = allProducts.reduce((s, p) => s + p.parts, 0);

  const exportSubtitle = [
    categoryFilter !== "All" ? `Category: ${categoryFilter}` : null,
    lifecycleFilter !== "All" ? `Lifecycle: ${lifecycleFilter}` : null,
    search ? `Search: ${search}` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  const exportRows = filtered.map((product) => [
    product.name,
    product.subtitle,
    product.category,
    product.rootPL,
    product.revision,
    product.lifecycle,
    product.total,
    product.assemblies,
    product.parts,
    product.lastModified,
    product.description,
  ]);

  const exportHeaders = [
    "Product",
    "Subtitle",
    "Category",
    "Root PL",
    "Revision",
    "Lifecycle",
    "Total Nodes",
    "Assemblies",
    "Parts",
    "Last Modified",
    "Description",
  ];

  const exportProducts = (format: "excel" | "word" | "pdf") => {
    if (format === "excel") {
      ExportImportService.exportGenericTableExcel(
        "BOM Explorer",
        exportHeaders,
        exportRows,
        "bom-explorer",
      );
      return;
    }

    if (format === "word") {
      ExportImportService.exportGenericTableWord(
        "BOM Explorer Snapshot",
        exportHeaders,
        exportRows,
        "bom-explorer",
        exportSubtitle || undefined,
      );
      return;
    }

    ExportImportService.exportGenericTablePdf(
      "BOM Explorer Snapshot",
      exportHeaders,
      exportRows,
      exportSubtitle || undefined,
    );
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="BOM Explorer"
        subtitle="Select a product to explore its full Bill of Materials hierarchy"
        actions={
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm">
                  <Filter className="w-3.5 h-3.5" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-52 border border-border/60 bg-popover text-foreground"
              >
                <DropdownMenuItem
                  className="focus:bg-secondary"
                  onSelect={() => exportProducts("excel")}
                >
                  Export filtered list to Excel
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="focus:bg-secondary"
                  onSelect={() => exportProducts("word")}
                >
                  Export filtered list to Word
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="focus:bg-secondary"
                  onSelect={() => exportProducts("pdf")}
                >
                  Export filtered list to PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" onClick={() => navigate("/bom/new")}>
              <Plus className="w-3.5 h-3.5" /> New BOM
            </Button>
          </div>
        }
      />

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Products", value: allProducts.length, accent: true },
          { label: "Total Nodes", value: totalNodes, accent: false },
          {
            label: "In Production",
            value: allProducts.filter((p) => p.lifecycle === "Production").length,
            accent: false,
          },
          { label: "Total Parts", value: totalParts, accent: false },
        ].map((s) => (
          <GlassCard key={s.label} className="px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">
              {s.label}
            </p>
            <p className={`text-2xl font-bold ${s.accent ? "text-primary" : "text-foreground"}`}>
              {s.value}
            </p>
          </GlassCard>
        ))}
      </div>

      {/* Filters */}
      <GlassCard className="p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search products, PL numbers..."
              className="pl-9 w-full h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">
                Category
              </p>
              <FilterPills
                options={CATEGORIES}
                value={categoryFilter}
                onChange={setCategoryFilter}
              />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">
                Lifecycle
              </p>
              <FilterPills
                options={LIFECYCLES}
                value={lifecycleFilter}
                onChange={setLifecycleFilter}
              />
            </div>
          </div>
        </div>
        {(categoryFilter !== "All" || lifecycleFilter !== "All" || search) && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Showing <span className="text-primary font-semibold">{filtered.length}</span> of{" "}
              {allProducts.length} products
            </span>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setCategoryFilter("All");
                setLifecycleFilter("All");
              }}
              className="text-xs text-muted-foreground hover:text-foreground/90 underline transition-colors"
            >
              Clear filters
            </button>
          </div>
        )}
      </GlassCard>

      {/* Product grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((product, i) => (
            <ProductCard
              key={product.id}
              product={product}
              index={i}
              isDraft={product.id.startsWith("draft-")}
            />
          ))}
          <CreateNewCard />
        </div>
      ) : (
        <GlassCard className="p-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-secondary/60 border border-border flex items-center justify-center mx-auto mb-4">
            <Search className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-foreground/90 font-medium mb-1">No products found</p>
          <p className="text-muted-foreground text-sm mb-4">
            Try adjusting your search or filter criteria
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setCategoryFilter("All");
              setLifecycleFilter("All");
            }}
          >
            Clear filters
          </Button>
        </GlassCard>
      )}

      {/* Recent activity */}
      <GlassCard className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Recently Modified
          </h3>
        </div>
        <div className="space-y-2">
          {[...allProducts]
            .sort((a, b) => b.lastModified.localeCompare(a.lastModified))
            .slice(0, 3)
            .map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => navigate(`/bom/${p.id}`)}
                className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-secondary/40 transition-colors cursor-pointer group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                  <span className="text-sm text-foreground/90 group-hover:text-white transition-colors">
                    {p.name}
                  </span>
                  <span className="text-xs text-muted-foreground">{p.subtitle}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{p.lastModified}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </button>
            ))}
        </div>
      </GlassCard>
    </div>
  );
}
