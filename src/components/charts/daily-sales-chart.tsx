"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";

const BAR = "#8f7232"; // foil-dark: ≥3:1 on white
const GRID = "#eeece6";
const MUTED = "#5d5a52";

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-PH", { notation: "compact", maximumFractionDigits: 1 });

type Point = { date: string; label: string; booked: number; orders: number };

function TipContent({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as Point;
  return (
    <div className="rounded-md border border-rule bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-ink">{p.label}</p>
      <p className="mt-1 font-mono text-ink">{peso.format(p.booked)}</p>
      <p className="text-graphite">
        {p.orders} {p.orders === 1 ? "order" : "orders"}
      </p>
    </div>
  );
}

/** Single-series column chart: sales booked per day. */
export function DailySalesChart({ data }: { data: Point[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Sales booked per day">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => String(Number(d.slice(8)))}
            tick={{ fill: MUTED, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            interval="preserveStartEnd"
            minTickGap={8}
          />
          <YAxis
            tickFormatter={(v: number) => (v === 0 ? "0" : `₱${compact.format(v)}`)}
            tick={{ fill: MUTED, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={52}
            allowDecimals={false}
          />
          <Tooltip content={TipContent} cursor={{ fill: "#f7f6f2" }} />
          <Bar dataKey="booked" fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
