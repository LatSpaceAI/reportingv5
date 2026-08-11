// Parsing the quantities that arrive as free text on site returns.
//
// The forms ask for a number and regularly get a sentence. Real examples from
// the FY25 returns:
//
//   "58 kg"                                  -> 0.058 MT
//   "500 kg"                                 -> 0.5 MT
//   "Rebar - 3.5 / Steel - 0.02 / Wood - 0.15" -> 3.67 MT
//   "Rebar - 0.1 / Wooden waste -4"          -> 4.1 MT
//   "Paper & Card Board - 0.008"             -> 0.008 MT
//   "paint drums - kg: 4"                    -> 0.004 MT
//   "9 Kg x1 + 4.5Kg x1"                     -> 13.5 kg
//   "60 min" / "35 Min"                      -> 1.583 h (with the other DG row)
//   "NA" / "Nil" / "NIL"                     -> no data, NOT zero
//
// The central ESG team is transcribing someone else's handwriting-turned-
// spreadsheet, so the entry screen accepts the text as typed, shows what it
// parsed to, and stores both. A parse is a suggestion the user can override —
// never a silent substitution.

export interface ParsedQuantity {
  /** The number in the unit the FORM asks for; null when nothing parseable. */
  value: number | null;
  /** True when the text explicitly says "not available" rather than a number. */
  notAvailable: boolean;
  /** A unit detected in the text, when it differs from the form's own unit. */
  detectedUnit?: "kg" | "MT" | "L" | "kL" | "min" | "h" | "nos";
  /** Each number found, for multi-part text — shown so the sum is auditable. */
  parts: { label?: string; value: number }[];
  /** How the value was reached, surfaced next to the field. */
  explanation?: string;
}

const NA_WORDS = new Set([
  "na", "n/a", "nil", "none", "nothing", "no", "-", "--", "",
  "not applicable", "no qty generated", "no data",
]);

// Unit tokens, longest-first so "kl" is not matched as "l".
const UNIT_PATTERNS: { re: RegExp; unit: ParsedQuantity["detectedUnit"] }[] = [
  { re: /\b(?:mt|metric\s*tonnes?|tonnes?|tons?)\b/i, unit: "MT" },
  { re: /\b(?:kl|kilolit(?:re|er)s?)\b/i, unit: "kL" },
  { re: /\b(?:kgs?|kilograms?)\b/i, unit: "kg" },
  { re: /\b(?:min(?:ute)?s?)\b/i, unit: "min" },
  { re: /\b(?:hrs?|hours?)\b/i, unit: "h" },
  { re: /\b(?:nos?|numbers?|units?|pcs?)\b/i, unit: "nos" },
  { re: /\b(?:lit(?:re|er)s?|ltrs?|l)\b/i, unit: "L" },
];

function detectUnit(text: string): ParsedQuantity["detectedUnit"] | undefined {
  for (const { re, unit } of UNIT_PATTERNS) if (re.test(text)) return unit;
  return undefined;
}

/**
 * Pull every number out of the text along with the label that precedes it.
 *
 * Handles "Rebar - 3.5 / Steel - 0.02" and "9 Kg x1 + 4.5Kg x1" alike. A
 * trailing "xN" multiplies the preceding number, which is how the extinguisher
 * rows record "one 9 kg cylinder and one 4.5 kg cylinder".
 */
function extractParts(text: string): { label?: string; value: number }[] {
  const parts: { label?: string; value: number }[] = [];
  // number, optionally followed by a unit word, optionally followed by xN
  const re = /([A-Za-z&][A-Za-z&\s.]*?)?[\s\-:]*(\d+(?:\.\d+)?)\s*([A-Za-z]+)?\s*(?:[x×]\s*(\d+))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const [, rawLabel, num, unitWord, multiplier] = m;
    if (!num) continue;
    // A bare unit word that is itself a number-like token would double count.
    let value = Number(num);
    if (!Number.isFinite(value)) continue;
    if (multiplier) value *= Number(multiplier);
    const label = rawLabel?.trim().replace(/[-:,]+$/, "").trim();
    // Skip fragments where the "label" is really a unit we already consumed.
    parts.push({ label: label && label.length > 1 ? label : undefined, value });
    // Guard against zero-length matches looping forever.
    if (m.index === re.lastIndex) re.lastIndex++;
    void unitWord;
  }
  return parts;
}

/**
 * Parse a free-text quantity.
 *
 * `formUnit` is the unit printed on the form. When the text carries a different
 * unit ("58 kg" on an MT-denominated row) the value is converted and the
 * explanation says so, because that conversion is exactly the kind of silent
 * step that produces a 1000x error in a disclosure.
 */
export function parseQuantity(input: string, formUnit?: string | null): ParsedQuantity {
  const text = (input ?? "").trim();
  if (NA_WORDS.has(text.toLowerCase())) {
    return { value: null, notAvailable: true, parts: [] };
  }
  if (!text) return { value: null, notAvailable: false, parts: [] };

  // Fast path: a clean number.
  const plain = Number(text.replace(/,/g, ""));
  if (Number.isFinite(plain) && /^-?[\d,]+(\.\d+)?$/.test(text)) {
    return { value: plain, notAvailable: false, parts: [{ value: plain }] };
  }

  const parts = extractParts(text);
  if (parts.length === 0) {
    return { value: null, notAvailable: false, parts: [] };
  }

  const sum = parts.reduce((n, p) => n + p.value, 0);
  const detected = detectUnit(text);
  const form = (formUnit ?? "").toLowerCase();

  // Convert only when the text's unit disagrees with the form's.
  let value = sum;
  let explanation: string | undefined;

  const formIsMt = /^mt$/.test(form) || /tonne/.test(form);
  const formIsKl = /^(kl|m3|m³)$/.test(form);
  const formIsHours = /^(hrs?|hours?)$/.test(form);

  if (detected === "kg" && formIsMt) {
    value = sum / 1000;
    explanation = `${sum} kg → ${value} MT`;
  } else if (detected === "L" && formIsKl) {
    value = sum / 1000;
    explanation = `${sum} L → ${value} kL`;
  } else if (detected === "min" && formIsHours) {
    value = sum / 60;
    explanation = `${sum} min → ${round(value, 4)} h`;
  }

  if (!explanation && parts.length > 1) {
    explanation = `${parts
      .map((p) => (p.label ? `${p.label} ${p.value}` : String(p.value)))
      .join(" + ")} = ${round(value, 6)}`;
  }

  return {
    value: round(value, 6),
    notAvailable: false,
    detectedUnit: detected,
    parts,
    explanation,
  };
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/** True when the input needs the parse-assist UI rather than a plain number. */
export function looksLikeText(input: string): boolean {
  const t = (input ?? "").trim();
  if (!t) return false;
  return !/^-?[\d,]+(\.\d+)?$/.test(t);
}
