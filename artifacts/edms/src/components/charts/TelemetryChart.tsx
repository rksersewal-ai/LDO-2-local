import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const BRAND = {
  primary: "#FF4E00",
  ink: "#070607",
  line: "rgba(7, 6, 7, 0.08)",
  lineStrong: "rgba(7, 6, 7, 0.14)",
  muted: "rgba(7, 6, 7, 0.62)",
  subdued: "rgba(7, 6, 7, 0.44)",
};

export default function TelemetryChart({
  data,
  metricKey,
}: {
  data: Array<{ time: string; value: number }>;
  metricKey: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id={`health-${metricKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BRAND.primary} stopOpacity={0.22} />
            <stop offset="100%" stopColor={BRAND.primary} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={BRAND.line} strokeDasharray="3 3" />
        <XAxis
          dataKey="time"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: BRAND.subdued }}
          interval={4}
        />
        <YAxis hide domain={[0, 100]} />
        <Tooltip
          cursor={{ stroke: BRAND.lineStrong, strokeDasharray: "4 4" }}
          contentStyle={{
            backgroundColor: "#FFFFFF",
            border: `1px solid ${BRAND.lineStrong}`,
            borderRadius: 16,
            boxShadow: "0 18px 40px rgba(7, 6, 7, 0.08)",
            color: BRAND.ink,
            fontSize: 11,
          }}
          labelStyle={{ color: BRAND.muted }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={BRAND.primary}
          strokeWidth={2}
          fill={`url(#health-${metricKey})`}
          dot={false}
          activeDot={{
            r: 4,
            stroke: BRAND.primary,
            fill: "#FFFFFF",
            strokeWidth: 2,
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
