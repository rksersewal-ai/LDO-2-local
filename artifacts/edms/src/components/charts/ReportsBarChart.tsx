import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function ReportsBarChart({
  data,
}: {
  data: Array<{ type: string; count: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(71, 85, 105, 0.3)" />
        <XAxis dataKey="type" tick={{ fill: "#94a3b8", fontSize: 11 }} />
        <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#0f172a",
            border: "1px solid rgba(20, 184, 166, 0.2)",
            borderRadius: "12px",
            color: "#e2e8f0",
          }}
        />
        <Bar dataKey="count" fill="#14b8a6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
