import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = ["#14b8a6", "#f59e0b", "#64748b", "#ef4444"];

export default function ReportsPieChart({
  data,
}: {
  data: Array<{ name: string; value: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={75}
          label={({ name, value }) => `${name} (${value})`}
          labelLine={false}
        >
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "#0f172a",
            border: "1px solid rgba(20, 184, 166, 0.2)",
            borderRadius: "12px",
            color: "#e2e8f0",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
