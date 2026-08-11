"use client";

// One row of a site return.
//
// The design goal is that someone holding the paper form can go down the screen
// without translating anything: same label, same order, same unit. Three things
// the plain <input> can't do on its own:
//
//   * "Not available" is a distinct state from zero. The forms are full of "NA"
//     and "Nil", and treating those as zero would understate every disclosure
//     they touch. It gets its own toggle, not a blank box.
//   * Text quantities get parsed and SHOWN. "58 kg" on an MT row becomes
//     0.058 MT with the working displayed, because that conversion is exactly
//     where a silent 1000x error would hide.
//   * Where the form unit differs from the stored unit, the conversion is
//     stated rather than performed invisibly.

import { useMemo } from "react";

import { parseQuantity, looksLikeText } from "@/lib/siteEntry/parseQuantity";
import type { EntryValue, FormField } from "@/lib/siteEntry/types";

const NUMBER_FMT = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 6 });

export function EntryField({
  field,
  value,
  onChange,
  flagMessage,
}: {
  field: FormField;
  value: EntryValue;
  onChange: (next: EntryValue) => void;
  flagMessage?: string;
}) {
  const parsed = useMemo(
    () => parseQuantity(value.raw, field.formUnit),
    [value.raw, field.formUnit]
  );

  const showParse = looksLikeText(value.raw) && !value.notAvailable;
  const unparseable = showParse && parsed.value === null && !parsed.notAvailable;

  // The canonical value this row will contribute, once the unit factor applies.
  const canonical =
    !value.notAvailable && parsed.value !== null
      ? parsed.value * field.unitFactor
      : null;
  const unitDiffers =
    field.parameterUnit &&
    field.formUnit &&
    field.parameterUnit.toLowerCase() !== field.formUnit.toLowerCase();

  return (
    <div className="grid grid-cols-[1fr_auto] items-start gap-3 border-b border-gray-100 px-5 py-3 last:border-b-0">
      <div className="min-w-0">
        <label
          htmlFor={`field-${field.fieldId}`}
          className="block text-[13px] leading-snug text-[#0A0A0A]"
        >
          {field.label}
          {field.isRequired && <span className="ml-1 text-rose-500">*</span>}
        </label>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-500">
          {field.isFormTotal && (
            <span className="bg-amber-50 px-1.5 py-0.5 text-amber-700">
              site total — checked, not consolidated
            </span>
          )}
          {field.isMemo && !field.isFormTotal && (
            <span className="bg-gray-100 px-1.5 py-0.5 text-gray-600">memo</span>
          )}
          {!field.parameterKey && (
            <span className="bg-gray-100 px-1.5 py-0.5 text-gray-600">
              recorded only
            </span>
          )}
          {field.helpText && <span>{field.helpText}</span>}
        </div>

        {/* What we parsed out of free text, with the arithmetic shown. */}
        {showParse && parsed.value !== null && (
          <p className="mt-1.5 text-[11px] text-brand">
            Reads as <strong>{NUMBER_FMT.format(parsed.value)}</strong>{" "}
            {field.formUnit}
            {parsed.explanation ? ` · ${parsed.explanation}` : ""}
          </p>
        )}
        {unparseable && (
          <p className="mt-1.5 text-[11px] text-amber-700">
            No number found in this text. It will be stored as written but will
            not reach any calculation.
          </p>
        )}
        {/* Only worth stating when the stored unit isn't the one on the form. */}
        {canonical !== null && unitDiffers && (
          <p className="mt-1 text-[11px] text-gray-500">
            Stored as {NUMBER_FMT.format(canonical)} {field.parameterUnit}
          </p>
        )}
        {flagMessage && (
          <p className="mt-1.5 text-[11px] text-rose-600">{flagMessage}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          id={`field-${field.fieldId}`}
          type="text"
          inputMode="decimal"
          value={value.notAvailable ? "" : value.raw}
          disabled={value.notAvailable}
          placeholder={value.notAvailable ? "NA" : "0"}
          onChange={(e) => onChange({ ...value, raw: e.target.value })}
          className={`w-32 border px-3 py-2 text-right text-sm tabular-nums outline-none transition-colors ${
            value.notAvailable
              ? "border-gray-200 bg-gray-50 text-gray-400"
              : unparseable
                ? "border-amber-300 bg-white focus:border-amber-500"
                : "border-gray-200 bg-white hover:border-gray-300 focus:border-brand"
          }`}
        />
        <span className="w-12 shrink-0 text-[11px] text-gray-400">
          {field.formUnit}
        </span>
        <button
          type="button"
          onClick={() =>
            onChange({
              ...value,
              notAvailable: !value.notAvailable,
              raw: value.notAvailable ? value.raw : "",
            })
          }
          title={
            value.notAvailable
              ? "The site reported a value"
              : "The site marked this NA / Nil — not the same as zero"
          }
          className={`shrink-0 border px-2 py-2 text-[11px] font-medium uppercase tracking-wider transition-colors ${
            value.notAvailable
              ? "border-brand/40 bg-brand/[0.06] text-brand"
              : "border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600"
          }`}
        >
          NA
        </button>
      </div>
    </div>
  );
}
