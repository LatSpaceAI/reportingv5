"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

import type {
  ChartSpec,
  ChartData,
  ChartSeries,
} from "@/lib/dashboard/chart-spec";

// LatSpace teal-led palette (matches the #074D47 accent used across the app).
const PALETTE = [
  "#074D47",
  "#22867C",
  "#89E4DA",
  "#0A0A0A",
  "#A07A2D",
  "#7A2D2D",
  "#2D5BA0",
  "#5B2DA0",
];

/**
 * How much filed evidence a figure rests on.
 *
 * The portfolio has no derived-balance mechanism: a total is the sum of the
 * returns actually filed. With most site-months still uncollected, a headline
 * number presented bare reads as "this is the company's total" when it is
 * "this is what we have". The note is deliberately shown even at full coverage
 * — a badge that only appears when something is wrong trains people to ignore
 * its absence.
 */
function CoverageNote({
  coverage,
}: {
  coverage?: { sitesReporting: number; sitesExpected: number };
}) {
  if (!coverage || coverage.sitesExpected <= 0) return null;
  const { sitesReporting, sitesExpected } = coverage;
  const pct = Math.round((sitesReporting / sitesExpected) * 100);
  const complete = sitesReporting >= sitesExpected;
  return (
    <div
      className={`mt-auto pt-2 text-[10px] ${
        complete ? "text-[#0A0A0A]/40" : "text-amber-700"
      }`}
      title={
        complete
          ? "Every expected site return has been filed for this period."
          : "Sums only the site returns filed so far — not an estimate of the full portfolio."
      }
    >
      {complete
        ? "All site returns filed"
        : `${sitesReporting} of ${sitesExpected} site returns filed (${pct}%)`}
    </div>
  );
}

interface ChartRendererProps {
  spec: ChartSpec;
  data: ChartData;
  /** Fixed pixel height, or undefined to fill the parent (used inside tiles). */
  height?: number;
}

function compact(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (abs >= 1_000) return (n / 1_000).toFixed(0) + "k";
  if (abs >= 1) return n.toFixed(0);
  return n.toFixed(2);
}

function precise(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function kpiNumber(v: number) {
  const abs = Math.abs(v);
  if (abs >= 1_000_000)
    return (
      (v / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + "M"
    );
  if (abs >= 1_000)
    return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

interface RowShape {
  label: string;
  [code: string]: number | string | null;
}

function buildRows(data: ChartData): RowShape[] {
  if (data.series.length === 0) return [];
  const labels = data.series[0].points.map((p) => p.label);
  return labels.map((label, i) => {
    const row: RowShape = { label };
    for (const s of data.series) row[s.code] = s.points[i]?.value ?? null;
    return row;
  });
}

export function ChartRenderer({ spec, data, height = 280 }: ChartRendererProps) {
  const rows = useMemo(() => buildRows(data), [data]);
  const colors = useMemo(() => {
    const base = spec.options?.color;
    return data.series.map((_, i) =>
      i === 0 && base ? base : PALETTE[i % PALETTE.length]
    );
  }, [data.series, spec.options?.color]);

  const sizeStyle: React.CSSProperties =
    height != null ? { height } : { height: "100%", width: "100%" };

  const hasData = data.series.some((s) =>
    s.points.some((p) => p.value != null)
  );
  if (!hasData) {
    return (
      <div
        style={sizeStyle}
        className="flex flex-col items-center justify-center gap-1 px-4 text-center"
      >
        <span className="text-xs text-[#0A0A0A]/40">No data for this selection</span>
        <span className="text-[10px] text-[#0A0A0A]/30">
          Only filed site returns are charted — nothing has been entered here yet.
        </span>
      </div>
    );
  }

  // ---- KPI ------------------------------------------------------------------
  if (spec.kind === "kpi") {
    const computeValue = (
      s: ChartSeries
    ): { value: number | null; subtitle?: string } => {
      const points = s.points.filter((p) => p.value != null);
      if (points.length === 0) return { value: null };
      if (spec.granularity === "annual" || points.length === 1) {
        return { value: points[points.length - 1].value ?? null };
      }
      const total = points.reduce((acc, p) => acc + (p.value ?? 0), 0);
      return { value: total, subtitle: `Sum across ${points.length} points` };
    };

    if (data.series.length === 1) {
      const s = data.series[0];
      const { value, subtitle } = computeValue(s);
      return (
        <div className="flex h-full flex-col p-4 sm:p-5">
          <div className="text-[10px] uppercase tracking-[0.08em] text-[#0A0A0A]/60">
            {s.display_name}
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-4xl font-medium leading-none tabular-nums">
              {value == null ? "—" : kpiNumber(value)}
            </span>
            <span className="text-xs text-[#0A0A0A]/60">{s.unit}</span>
          </div>
          {subtitle && (
            <div className="mt-1 text-[10px] text-[#0A0A0A]/45">{subtitle}</div>
          )}
          <CoverageNote coverage={data.coverage} />
        </div>
      );
    }

    return (
      <div className="grid h-full grid-cols-1 gap-3 p-3 sm:grid-cols-2">
        {data.series.map((s) => {
          const { value } = computeValue(s);
          return (
            <div
              key={s.code}
              className="flex flex-col justify-center border border-[#0A0A0A]/[0.06] p-3"
            >
              <div className="text-[10px] uppercase tracking-[0.08em] text-[#0A0A0A]/55">
                {s.display_name}
              </div>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span className="text-2xl font-medium tabular-nums">
                  {value == null ? "—" : kpiNumber(value)}
                </span>
                <span className="text-[10px] text-[#0A0A0A]/55">{s.unit}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ---- Pie ------------------------------------------------------------------
  if (spec.kind === "pie") {
    const pieData = data.series.map((s, i) => ({
      name: s.display_name,
      value: s.points.reduce((acc, p) => acc + (p.value ?? 0), 0),
      fill: colors[i],
    }));
    return (
      <div style={sizeStyle}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              outerRadius="70%"
              stroke="#fff"
              strokeWidth={1}
            >
              {pieData.map((d, i) => (
                <Cell key={i} fill={d.fill} />
              ))}
            </Pie>
            <Tooltip formatter={(v: unknown) => precise(Number(v ?? 0))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ---- Trend (line) / Bar / Stacked ----------------------------------------
  const isBar = spec.kind === "bar" || spec.kind === "stacked";
  const isStacked = spec.kind === "stacked";

  const tooltipFormatter = (value: unknown, name: unknown) => {
    const nameStr = typeof name === "string" ? name : String(name ?? "");
    const series = data.series.find(
      (s) => s.display_name === nameStr || s.code === nameStr
    );
    const unit = series?.unit ?? "";
    return [
      `${precise(Number(value ?? 0))} ${unit}`.trim(),
      series?.display_name ?? nameStr,
    ] as [string, string];
  };

  return (
    <div style={sizeStyle}>
      <ResponsiveContainer width="100%" height="100%">
        {isBar ? (
          <BarChart data={rows} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#0A0A0A" strokeOpacity={0.04} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#0A0A0A", fontSize: 11, opacity: 0.5 }}
            />
            <YAxis
              tick={{ fill: "#0A0A0A", fontSize: 11, opacity: 0.5 }}
              tickFormatter={compact}
              width={50}
            />
            <Tooltip
              formatter={tooltipFormatter}
              cursor={{ fill: "#0A0A0A", fillOpacity: 0.04 }}
            />
            {data.series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {data.series.map((s, i) => (
              <Bar
                key={s.code}
                dataKey={s.code}
                name={s.display_name}
                fill={colors[i]}
                stackId={isStacked ? "stack" : undefined}
                radius={isStacked ? 0 : [2, 2, 0, 0]}
              />
            ))}
          </BarChart>
        ) : (
          <LineChart data={rows} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#0A0A0A" strokeOpacity={0.04} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#0A0A0A", fontSize: 11, opacity: 0.5 }}
            />
            <YAxis
              tick={{ fill: "#0A0A0A", fontSize: 11, opacity: 0.5 }}
              tickFormatter={compact}
              width={50}
            />
            <Tooltip formatter={tooltipFormatter} />
            {data.series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {data.series.map((s, i) => (
              <Line
                key={s.code}
                type="monotone"
                dataKey={s.code}
                name={s.display_name}
                stroke={colors[i]}
                strokeWidth={1.5}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
