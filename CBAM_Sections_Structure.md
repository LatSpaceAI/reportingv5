# CBAM Report — Sections & Question Structure

This document describes how the `/cbam` form is organised into sections, sub-questions, and fields. Source of truth: `src/lib/cbamSections.ts`.

Each top-level **Section** maps to a sheet in the official CBAM template. Within a section, each **question** is either a `fields` block (a fixed set of inputs) or a `table` (repeatable rows).

---

## Section A — Installation Data
Sheet: `A_InstData`

### A.1 Reporting period *(fields)*
Start and end date of the reporting period to which all data in this template refers.
- Start date *(date, required)*
- End date *(date, required)*

### A.2 About the installation *(fields)*
Installation identity and contact details.
- Installation name (local) *(text)*
- Installation name (English) *(text, required)*
- Street, number *(text, required)*
- Economic activity *(text)*
- Post code *(text)*
- P.O. Box *(text)*
- City *(text, required)*
- Country *(country, required)*
- UNLOCODE *(text, required — 5-letter UN/LOCODE, e.g. INBOM)*
- Latitude (main emission source) *(number, -90 to 90)*
- Longitude (main emission source) *(number, -180 to 180)*
- Authorised representative — name *(text)*
- Authorised representative — email *(email)*
- Authorised representative — phone *(tel)*

### A.3 Verifier of the report *(fields)*
Optional during the transitional period.
- Company name *(text)*
- Street, number *(text)*
- City *(text)*
- Postcode / ZIP *(text)*
- Country *(country)*
- Authorised rep — name *(text)*
- Authorised rep — email *(email)*
- Authorised rep — phone *(tel)*
- Accreditation Member State *(country)*
- National accreditation body *(text)*
- Registration number *(text)*

### A.4 Aggregated goods categories & production routes *(table, rows G1–G10)*
List every aggregated CBAM good produced in the installation. Route options depend on the selected good.

| Column | Type |
|---|---|
| Aggregated good *(required)* | selectGood |
| Route 1 | selectDependent (on good) |
| Route 2 | selectDependent (on good) |
| PFC relevant? | boolean |

### A.5 Purchased precursors *(table, rows PP1–PP20)*
Precursors produced outside the installation and consumed inside it.

| Column | Type |
|---|---|
| Aggregated good *(required)* | selectGood |
| Country of origin *(required)* | country |
| Production route | selectDependent (on good) |

---

## Section B — Emissions at source-stream level
Sheet: `B_EmInst`

### B.1 Calculation-based source streams (excluding PFC) *(table, up to 75 rows)*
Every fuel or process material that results in CO₂ emissions.

| Column | Type / Unit |
|---|---|
| Source stream name *(required)* | text |
| Method *(required)* | select (monitoring approach) |
| Activity data | number |
| AD unit | select (mass or gas) |
| NCV | number, GJ/t |
| Emission factor | number |
| EF unit | select |
| Carbon content | number, % |
| Oxidation factor | number, % |
| Conversion factor | number, % |
| Biomass content | number, % |

### B.2 PFC (perfluorocarbon) emissions *(table, up to 10 rows)*
Only relevant for primary aluminium smelters.

| Column | Type / Unit |
|---|---|
| Method *(required)* | select |
| Technology *(required)* | select |
| Aluminium produced | number, t |
| AE frequency | number, /cell-day |
| AE duration | number, min |
| Overvoltage | number, mV |
| Slope CF₄ | number |
| Slope C₂F₆ | number |

### B.3 Measurement-based emission sources *(table, up to 10 rows)*
Continuous Emission Monitoring System (CEMS) sources.

| Column | Type / Unit |
|---|---|
| Source name *(required)* | text |
| GHG *(required)* | select |
| Concentration | number, g/Nm³ |
| Flow rate | number, 1000 Nm³/h |
| Operating hours | number, h/period |

---

## Section C — Installation-level emissions & energy
Sheet: `C_Emissions&Energy`

### C.1 Fuel balance (TJ) *(fields)*
Split total fuel input across the four use types.
- Direct fuel for CBAM processes *(TJ)*
- Fuel for electricity production *(TJ)*
- Direct fuel for non-CBAM goods *(TJ)*
- Rest *(TJ)*

### C.2 GHG balance (tCO₂e) *(fields)*
Manual override values; indirect emissions must always be entered manually.
- Total CO₂ emissions
- Biomass emissions
- Total N₂O emissions
- Total PFC emissions
- Total direct emissions
- Total indirect emissions *(required)*

### C.3 Data quality & quality assurance *(fields)*
- Predominant approach *(required)*
- Justification for defaults
- Quality assurance approach

---

## Section D — Per-process production & attributed emissions
Sheet: `D_Processes`

### D.1 Production processes *(table, rows P1–P10)*
One row per production process.

| Column | Type / Unit |
|---|---|
| Aggregated good *(required)* | selectGood |
| Output | number, t |
| Attributed direct emissions | number, tCO₂e |
| Heat produced | number, TJ |
| Heat consumed | number, TJ |
| Heat imported | number, TJ |
| Heat exported | number, TJ |
| Electricity consumption | number, MWh |
| Electricity source | select |
| Electricity EF | number, tCO₂/MWh |

---

## Section E — Purchased precursors — embedded emissions
Sheet: `E_PurchPrec`

### E.1 Purchased precursors SEE *(table, rows PP1–PP20)*
One row per precursor.

| Column | Type / Unit |
|---|---|
| Aggregated good *(required)* | selectGood |
| Country of origin *(required)* | country |
| Mass consumed | number, t |
| SEE direct | number, tCO₂e/t |
| SEE indirect | number, tCO₂e/t |
| Electricity consumption | number, MWh/t |
| Electricity source | select |
| Electricity EF | number, tCO₂/MWh |
| Measured / default / unknown | select |
| Justification for defaults | select |

---

## Section F — Tools (CHP & carbon price)
Sheet: `F_Tools`

### F.1 Cogeneration (CHP) allocation *(fields)*
Complete only if the installation operates a CHP plant.
- CHP plant present? *(boolean)*
- Fuel input *(TJ)*
- Heat output *(TJ)*
- Electricity output *(MWh)*
- Allocation to heat *(%)*

### F.2 Carbon price due *(fields)*
Applicable carbon-pricing instrument and amount due per tonne of CBAM good.
- Carbon price instrument *(select)*
- Rebate mechanism *(select)*
- Currency *(select)*
- Carbon price *(per tCO₂e)*
- Amount due per tonne of CBAM good *(number)*
- Additional information *(longtext)*

---

## Section G — Further guidance references
Sheet: `G_FurtherGuidance`

### G.1 Methodology notes & assumptions *(fields)*
Free-text notes for any deviations from standard guidance, interpretive choices, or footnotes to flag to the reporting declarant.
- Notes *(longtext)*

---

## Summary — Products
Sheet: `Summary_Products` *(id: SP)*

### SP.1 Products by CN code *(table, up to 100 rows)*
One row per CN code exported.

| Column | Type / Unit |
|---|---|
| CN code | select (aluminium CN codes) |
| Product name (commercial) | text |
| Production process ID | text |
| SEE direct | number, tCO₂e/t |
| SEE indirect | number, tCO₂e/t |
| SEE total | number, tCO₂e/t |
| Share from defaults | number, % |
| t scrap per t Al | number |
| % non-aluminium elements | number, % |
| % pre-consumer scrap | number, % |

---

## Summary — Communication to declarant
Sheet: `Summary_Communication` *(id: SC)*

### SC.1 Installation snapshot *(fields)*
Rendered in English for the EU importer. Most fields prefill from Sheet A when persistence is wired up.
- Installation name (English) *(text)*
- Country *(country)*
- UNLOCODE *(text)*
- Reporting period start *(date)*
- Reporting period end *(date)*

### SC.2 Emissions by methodology (tCO₂e) *(fields)*
- Calculation-based (excl. PFC)
- Total PFC
- Measurement-based
- Other

### SC.3 Carbon price & additional information *(fields)*
- Carbon price instrument *(select)*
- Any additional information *(longtext)*

---

## Section index at a glance

| ID | Title | Sheet | Questions |
|---|---|---|---|
| A | Installation Data | A_InstData | A.1–A.5 |
| B | Emissions at source-stream level | B_EmInst | B.1–B.3 |
| C | Installation-level emissions & energy | C_Emissions&Energy | C.1–C.3 |
| D | Per-process production & attributed emissions | D_Processes | D.1 |
| E | Purchased precursors — embedded emissions | E_PurchPrec | E.1 |
| F | Tools (CHP & carbon price) | F_Tools | F.1–F.2 |
| G | Further guidance references | G_FurtherGuidance | G.1 |
| SP | Summary — Products | Summary_Products | SP.1 |
| SC | Summary — Communication to declarant | Summary_Communication | SC.1–SC.3 |
