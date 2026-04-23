"use client";

import { countries } from "@/lib/codeLists";
import { aggregatedGoods, type Field } from "@/lib/cbamSections";

export type FieldValue = string | number | boolean | null | undefined;
export type RowValues = Record<string, FieldValue>;

function optionsForField(field: Field, siblings?: RowValues): readonly string[] {
  if (field.kind === "select") return field.options;
  if (field.kind === "selectGood") return aggregatedGoods as readonly string[];
  if (field.kind === "selectCountry") return countries.map((c) => `${c.code} — ${c.name}`);
  if (field.kind === "selectDependent") {
    const key = String(siblings?.[field.dependsOn] ?? "");
    return field.map[key] ?? field.fallback;
  }
  return [];
}

interface FieldProps {
  field: Field;
  value: FieldValue;
  onChange: (v: FieldValue) => void;
  siblings?: RowValues;
  compact?: boolean;
}

export function FieldRenderer({ field, value, onChange, siblings, compact }: FieldProps) {
  const baseCls = compact
    ? "w-full bg-transparent px-2 py-1.5 text-sm outline-none border-0"
    : "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

  const selectLike =
    field.kind === "select" ||
    field.kind === "selectCountry" ||
    field.kind === "selectGood" ||
    field.kind === "selectDependent";

  if (selectLike) {
    const opts = optionsForField(field, siblings);
    return (
      <select
        className={baseCls}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">—</option>
        {opts.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }

  if (field.kind === "boolean") {
    return (
      <select
        className={baseCls}
        value={value === true ? "Yes" : value === false ? "No" : ""}
        onChange={(e) => onChange(e.target.value === "Yes" ? true : e.target.value === "No" ? false : null)}
      >
        <option value="">—</option>
        <option value="Yes">Yes</option>
        <option value="No">No</option>
      </select>
    );
  }

  if (field.kind === "number") {
    return (
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          className={baseCls + (field.unit ? " pr-14" : "")}
          value={value === null || value === undefined || value === "" ? "" : String(value)}
          min={field.min}
          max={field.max}
          step={field.step ?? "any"}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === "" ? null : Number(v));
          }}
        />
        {field.unit && (
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
            {field.unit}
          </span>
        )}
      </div>
    );
  }

  if (field.kind === "date") {
    return (
      <input
        type="date"
        className={baseCls}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
      />
    );
  }

  if (field.kind === "email") {
    return (
      <input
        type="email"
        className={baseCls}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder="name@company.com"
      />
    );
  }

  if (field.kind === "tel") {
    return (
      <input
        type="tel"
        className={baseCls}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
      />
    );
  }

  if (field.kind === "longtext") {
    return (
      <textarea
        className={baseCls + " min-h-[96px] resize-y"}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter text..."
      />
    );
  }

  return (
    <input
      type="text"
      className={baseCls}
      value={(value as string) ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
    />
  );
}

export function FieldLabel({ field }: { field: Field }) {
  return (
    <label className="block text-sm font-medium text-slate-700 mb-1">
      {field.label}
      {field.required && <span className="ml-1 text-rose-500">*</span>}
      {field.unit && <span className="ml-1 text-xs font-normal text-slate-400">({field.unit})</span>}
    </label>
  );
}

export function FieldHelp({ field }: { field: Field }) {
  if (!field.help) return null;
  return <p className="mt-1 text-xs text-slate-500">{field.help}</p>;
}

export function isFilled(field: Field, v: FieldValue): boolean {
  if (field.kind === "boolean") return v === true || v === false;
  if (field.kind === "number") return typeof v === "number" && !Number.isNaN(v);
  return typeof v === "string" && v.trim().length > 0;
}

export function isValid(field: Field, v: FieldValue): boolean {
  if (!isFilled(field, v)) return !field.required;
  if (field.kind === "number") {
    const n = v as number;
    if (field.min !== undefined && n < field.min) return false;
    if (field.max !== undefined && n > field.max) return false;
  }
  return true;
}
