import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const TOOLTIP_STYLE = {
  backgroundColor: "#0f172a",
  border: "1px solid rgba(20, 184, 166, 0.2)",
  borderRadius: "12px",
  color: "#e2e8f0",
  fontSize: "12px",
};

export interface AvgDaysChartItem {
  name: string;
  target: number;
  avg: number;
}

export default function LedgerAvgDaysChart({ data }: { data: AvgDaysChartItem[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 60, left: 10, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(71, 85, 105, 0.3)" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          unit="d"
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          width={140}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v: number, name: string) => [
            `${v}d`,
            name === "avg" ? "Avg Taken" : "Target",
          ]}
        />
        <Legend
          iconType="square"
          iconSize={8}
          wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }}
        />
        <Bar dataKey="target" fill="rgba(71,85,105,0.4)" radius={[0, 4, 4, 0]} name="Target" />
        <Bar dataKey="avg" radius={[0, 4, 4, 0]} name="Avg Taken">
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.avg <= entry.target ? "#34d399" : "#f87171"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
