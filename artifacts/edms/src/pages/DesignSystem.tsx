import { Activity, CheckCircle, Info, Layers, ShieldAlert, Sparkles } from "lucide-react";
import { useState } from "react";
import { Badge, Button, GlassCard, Input, PageHeader, Select } from "../components/ui/Shared";

export default function DesignSystem() {
  const [inputValue, setInputValue] = useState("");
  const [selectValue, setSelectValue] = useState("option-1");

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <PageHeader
        title="Design System Showcase"
        subtitle="Catalog of our custom theme components, design tokens, and aesthetic layers."
        breadcrumb={<span>Admin / Identity / Design System</span>}
      />

      {/* Grid of components */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Buttons Showcase */}
        <GlassCard className="p-4 space-y-4 border-border/50 bg-card/40 backdrop-blur-md">
          <div className="flex items-center gap-2 border-b border-border/40 pb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-white">Button Components</h2>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="primary">Primary Button</Button>
            <Button variant="secondary">Secondary Button</Button>
            <Button variant="ghost">Ghost Button</Button>
            <Button variant="danger">Danger Button</Button>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button size="sm" variant="primary">
              Small Primary
            </Button>
            <Button size="sm" variant="secondary">
              Small Secondary
            </Button>
          </div>
        </GlassCard>

        {/* Badges Showcase */}
        <GlassCard className="p-4 space-y-4 border-border/50 bg-card/40 backdrop-blur-md">
          <div className="flex items-center gap-2 border-b border-border/40 pb-2">
            <Layers className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-white">Badge Indicators</h2>
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <Badge variant="default">Default Badge</Badge>
            <Badge variant="success">Success Badge</Badge>
            <Badge variant="warning">Warning Badge</Badge>
            <Badge variant="danger">Danger Badge</Badge>
            <Badge variant="info">Info Badge</Badge>
            <Badge variant="processing">Processing Badge</Badge>
          </div>
        </GlassCard>

        {/* Inputs & Controls */}
        <GlassCard className="p-4 space-y-4 border-border/50 bg-card/40 backdrop-blur-md">
          <div className="flex items-center gap-2 border-b border-border/40 pb-2">
            <Activity className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-white">Form Inputs & Controls</h2>
          </div>
          <div className="space-y-3 pt-2">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                Standard Input
              </span>
              <Input
                placeholder="Enter some text..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                Custom Selector
              </span>
              <Select
                value={selectValue}
                onChange={(e) => setSelectValue(e.target.value)}
                className="h-9 text-xs"
              >
                <option value="option-1">Option 1 - Default</option>
                <option value="option-2">Option 2 - Special</option>
                <option value="option-3">Option 3 - Restricted</option>
              </Select>
            </div>
          </div>
        </GlassCard>

        {/* Alert Cards */}
        <GlassCard className="p-4 space-y-4 border-border/50 bg-card/40 backdrop-blur-md">
          <div className="flex items-center gap-2 border-b border-border/40 pb-2">
            <ShieldAlert className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-white">Alert Messages</h2>
          </div>
          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-teal-500/8 border border-teal-500/20 text-xs text-primary/90">
              <Info className="w-4 h-4 text-primary shrink-0" />
              <span>Information alert showing safe notification state.</span>
            </div>
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-rose-500/8 border border-rose-500/20 text-xs text-rose-300">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Danger warning displaying high severity notice.</span>
            </div>
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-emerald-500/8 border border-emerald-500/20 text-xs text-emerald-300">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Success completion banner validating transaction.</span>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
