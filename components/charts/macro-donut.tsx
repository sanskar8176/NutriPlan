"use client";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface MacroChartProps {
  proteinG: number;
  carbsG: number;
  fatG: number;
}

const COLORS = ["#16a34a", "#f59e0b", "#f97316"];

export function MacroDonutChart({ proteinG, carbsG, fatG }: MacroChartProps) {
  const data = [
    { name: "Protein", kcal: proteinG * 4, grams: proteinG },
    { name: "Carbs", kcal: carbsG * 4, grams: carbsG },
    { name: "Fat", kcal: fatG * 9, grams: fatG },
  ];

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={70}
          outerRadius={100}
          paddingAngle={3}
          dataKey="kcal"
        >
          {data.map((_, i) => (
            <Cell key={data[i].name} fill={COLORS[i]} />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as { name: string; kcal: number; grams: number };
            return (
              <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>
                <div style={{ fontWeight: 600 }}>{d.name}</div>
                <div>{d.grams}g &middot; {d.kcal} kcal</div>
              </div>
            );
          }}
        />
        <Legend
          formatter={(value, entry) => {
            const p = entry.payload as { grams: number } | undefined;
            return (
              <span style={{ color: "var(--foreground)", fontSize: 13 }}>
                {value}: {p?.grams ?? 0}g
              </span>
            );
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
