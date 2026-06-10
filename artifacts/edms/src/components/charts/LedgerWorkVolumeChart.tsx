import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const CATEGORY_COLORS = [
  "#14b8a6",
  "#6366f1",
  "#f59e0b",
  "#ec4899",
  "#10b981",
  "#8b5cf6",
  "#f97316",
  "#06b6d4",
  "#84cc16",
  "#ef4444",
  "#a78bfa",
];

const TOOLTIP_STYLE = {
  backgroundColor: "#0f172a",
  border: "1px solid rgba(20, 184, 166, 0.2)",
  borderRadius: "12px",
  color: "#e2e8f0",
  fontSize: "12px",
};

export interface WorkVolumeChartItem {
  name: string;
  count: number;
}

export default function LedgerWorkVolumeChart({ data }: { data: WorkVolumeChartItem[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(71, 85, 105, 0.3)" />
        <XAxis
          dataKey="name"
          tick={{ fill: "#94a3b8", fontSize: 10 }}
          angle={-35}
          textAnchor="end"
          interval={0}
        />
        <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Records">
          {data.map((_, i) => (
            <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
