import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const STATUS_COLORS: Record<string, string> = {
  OPEN: "#60a5fa",
  SUBMITTED: "#fbbf24",
  VERIFIED: "#34d399",
  CLOSED: "#94a3b8",
};

const TOOLTIP_STYLE = {
  backgroundColor: "#0f172a",
  border: "1px solid rgba(20, 184, 166, 0.2)",
  borderRadius: "12px",
  color: "#e2e8f0",
  fontSize: "12px",
};

export interface StatusChartItem {
  key: string;
  name: string;
  value: number;
}

export default function LedgerStatusChart({ data }: { data: StatusChartItem[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={95}
          paddingAngle={3}
          dataKey="value"
          nameKey="name"
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={STATUS_COLORS[entry.key] ?? "#64748b"} stroke="transparent" />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
