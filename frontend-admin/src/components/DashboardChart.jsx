// src/components/DashboardChart.jsx
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const PALETTE = {
  primary: "hsl(142.1 76.2% 36.3%)",
  primaryFill: "hsl(142.1 76.2% 36.3%)",
  grid: "hsl(215 20.2% 94.5%)",
  tick: "hsl(215 20.2% 65.1%)",
};

const PEN = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 2,
});

export default function DashboardChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
      >
        <defs>
          <linearGradient id="gradPrimary" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={PALETTE.primaryFill}
              stopOpacity={0.2}
            />
            <stop
              offset="100%"
              stopColor={PALETTE.primaryFill}
              stopOpacity={0}
            />
          </linearGradient>
        </defs>
        <CartesianGrid
          stroke={PALETTE.grid}
          strokeDasharray="3 3"
          vertical={false}
        />
        <XAxis
          dataKey="dia"
          tickLine={false}
          axisLine={false}
          tick={{ fill: PALETTE.tick, fontSize: 12 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fill: PALETTE.tick, fontSize: 12 }}
          tickFormatter={(value) => `S/${value}`}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 12,
            borderColor: PALETTE.grid,
            background: "rgba(255,255,255,0.8)",
            backdropFilter: "blur(4px)",
          }}
          labelStyle={{ color: "#020617", fontWeight: 600 }}
          formatter={(value) => [PEN.format(value), "Total"]}
        />
        <Area
          type="monotone"
          dataKey="total"
          stroke={PALETTE.primary}
          strokeWidth={2.5}
          fill="url(#gradPrimary)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
