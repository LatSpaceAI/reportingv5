"use client";

// Manual Data Entry — ported from hindalco's /plant/data-entry/manual page and
// restyled to plato-v1's design language. Frontend-only: "saving" just marks the
// active tab done and shows a toast. Field labels kept verbatim from hindalco.

import { useState } from "react";

import { useToast } from "@/components/Toast";
import {
  PageHeader,
  ReportingPeriodCard,
  useReportingPeriod,
  monthLabel,
  labelClass,
  inputClass,
  PencilIcon,
  PaperclipIcon,
  RotateCcwIcon,
  SaveIcon,
  CheckCircleIcon,
  XIcon,
} from "../shared";

interface ParameterData {
  value: string;
  attachedFiles: File[];
}

interface FormData {
  fuel: { coal: ParameterData; naturalGas: ParameterData; diesel: ParameterData; petcoke: ParameterData };
  electricity: { gridPurchase: ParameterData; onSiteGeneration: ParameterData; renewableEnergy: ParameterData };
  process: { aluminaProduction: ParameterData; aluminiumProduction: ParameterData; rawMeal: ParameterData; limestone: ParameterData };
  refrigerants: { r134aQuantity: ParameterData; r410aQuantity: ParameterData; co2Extinguisher: ParameterData };
}

const emptyParam = (): ParameterData => ({ value: "", attachedFiles: [] });

const createFormData = (): FormData => ({
  fuel: { coal: emptyParam(), naturalGas: emptyParam(), diesel: emptyParam(), petcoke: emptyParam() },
  electricity: { gridPurchase: emptyParam(), onSiteGeneration: emptyParam(), renewableEnergy: emptyParam() },
  process: { aluminaProduction: emptyParam(), aluminiumProduction: emptyParam(), rawMeal: emptyParam(), limestone: emptyParam() },
  refrigerants: { r134aQuantity: emptyParam(), r410aQuantity: emptyParam(), co2Extinguisher: emptyParam() },
});

const TABS = [
  { id: "fuel", label: "Fuel Consumption" },
  { id: "electricity", label: "Electricity" },
  { id: "process", label: "Process Data" },
  { id: "refrigerants", label: "Refrigerants & Other" },
] as const;

export default function ManualEntryPage() {
  const { show } = useToast();
  const [period, setPeriod] = useReportingPeriod();
  const [activeTab, setActiveTab] = useState<string>("fuel");
  const [savedSections, setSavedSections] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState<FormData>(createFormData());

  const handleInputChange = (section: keyof FormData, field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: { ...(prev[section] as Record<string, ParameterData>)[field], value },
      },
    }));
  };

  const handleFileAttachment = (section: keyof FormData, field: string, files: FileList | null) => {
    if (!files) return;
    const fileArray = Array.from(files);
    setFormData((prev) => {
      const current = (prev[section] as Record<string, ParameterData>)[field];
      return {
        ...prev,
        [section]: {
          ...prev[section],
          [field]: { ...current, attachedFiles: [...current.attachedFiles, ...fileArray] },
        },
      };
    });
  };

  const handleFileRemoval = (section: keyof FormData, field: string, fileIndex: number) => {
    setFormData((prev) => {
      const current = (prev[section] as Record<string, ParameterData>)[field];
      return {
        ...prev,
        [section]: {
          ...prev[section],
          [field]: {
            ...current,
            attachedFiles: current.attachedFiles.filter((_, idx) => idx !== fileIndex),
          },
        },
      };
    });
  };

  const handleSaveSection = (section: string) => {
    setSavedSections((prev) => new Set(Array.from(prev).concat(section)));
    show(`${TABS.find((t) => t.id === section)?.label ?? section} saved.`);
  };

  const handleReset = () => {
    setFormData(createFormData());
    setSavedSections(new Set());
    show("Form reset to initial state.");
  };

  const renderParameterInput = (
    section: keyof FormData,
    field: string,
    label: string,
    unit: string,
    description?: string,
  ) => {
    const data = (formData[section] as Record<string, ParameterData>)[field];
    if (!data) return null;
    return (
      <div className="border border-gray-200">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
          <div>
            <span className="text-[13px] font-semibold text-[#0A0A0A]">{label}</span>
            {description && <p className="mt-0.5 text-[11px] text-gray-500">{description}</p>}
          </div>
          <span className="bg-white px-2 py-1 font-mono text-[11px] text-gray-500">{unit}</span>
        </div>
        <div className="space-y-3 p-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className={labelClass}>Value</label>
              <input
                type="text"
                value={data.value}
                onChange={(e) => handleInputChange(section, field, e.target.value)}
                placeholder="Enter value"
                className={inputClass}
              />
            </div>
            <div className="flex h-[46px] items-center whitespace-nowrap bg-brand/[0.06] px-3 text-[12px] font-medium text-brand">
              {monthLabel(period.month)} {period.year}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              multiple
              onChange={(e) => handleFileAttachment(section, field, e.target.files)}
              className="hidden"
              id={`file-${section}-${field}`}
            />
            <label
              htmlFor={`file-${section}-${field}`}
              className="inline-flex cursor-pointer items-center gap-1.5 border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-[#0A0A0A]/70 transition-colors hover:border-brand/50 hover:text-brand"
            >
              <PaperclipIcon className="h-3.5 w-3.5" />
              Attach Files
            </label>
            {data.attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {data.attachedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-1 border border-brand/20 bg-brand/[0.06] px-2 py-1 text-[11px]"
                  >
                    <span className="max-w-[120px] truncate text-brand">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => handleFileRemoval(section, field, index)}
                      className="text-brand/60 hover:text-brand"
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[900px] px-6 py-6">
        <PageHeader
          icon={<PencilIcon className="h-5 w-5" />}
          title="Manual Data Entry"
          subtitle="Enter emissions and activity data manually for your site."
          backHref="/data-collection"
          action={
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 border border-gray-200 px-3 py-2 text-[12px] font-medium text-[#0A0A0A]/70 transition-colors hover:border-brand/50 hover:text-brand"
            >
              <RotateCcwIcon className="h-3.5 w-3.5" />
              Reset All
            </button>
          }
        />

        <div className="space-y-6">
          <ReportingPeriodCard period={period} onChange={setPeriod} />

          {/* Tabs */}
          <div className="border border-gray-200">
            <div className="grid grid-cols-2 border-b border-gray-200 sm:grid-cols-4">
              {TABS.map((tab) => {
                const active = activeTab === tab.id;
                const saved = savedSections.has(tab.id);
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center justify-center gap-1.5 border-b-2 px-3 py-3 text-[12px] font-medium transition-colors ${
                      active
                        ? "border-brand text-brand"
                        : "border-transparent text-[#0A0A0A]/50 hover:text-brand"
                    }`}
                  >
                    {saved && <CheckCircleIcon className="h-3.5 w-3.5 text-brand" />}
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="space-y-4 p-5">
              {activeTab === "fuel" && (
                <>
                  <h3 className="text-[14px] font-semibold text-[#0A0A0A]">Fuel Consumption Data</h3>
                  {renderParameterInput("fuel", "coal", "Coal Consumption", "MT", "Total coal consumed in the period")}
                  {renderParameterInput("fuel", "naturalGas", "Natural Gas Consumption", "m³", "Natural gas used for heating/processing")}
                  {renderParameterInput("fuel", "diesel", "Diesel Consumption", "Liters", "Diesel for generators and vehicles")}
                  {renderParameterInput("fuel", "petcoke", "Petroleum Coke", "MT", "Petcoke used in kiln operations")}
                </>
              )}
              {activeTab === "electricity" && (
                <>
                  <h3 className="text-[14px] font-semibold text-[#0A0A0A]">Electricity Consumption Data</h3>
                  {renderParameterInput("electricity", "gridPurchase", "Grid Purchase", "kWh", "Electricity purchased from grid")}
                  {renderParameterInput("electricity", "onSiteGeneration", "On-site Generation", "kWh", "Electricity generated on-site")}
                  {renderParameterInput("electricity", "renewableEnergy", "Renewable Energy", "kWh", "Solar, wind, or other renewables")}
                </>
              )}
              {activeTab === "process" && (
                <>
                  <h3 className="text-[14px] font-semibold text-[#0A0A0A]">Process Data</h3>
                  {renderParameterInput("process", "aluminaProduction", "Alumina Production", "MT", "Total alumina produced")}
                  {renderParameterInput("process", "aluminiumProduction", "Aluminium Production", "MT", "Total aluminium produced")}
                  {renderParameterInput("process", "rawMeal", "Raw Meal", "MT", "Raw meal fed to kiln")}
                  {renderParameterInput("process", "limestone", "Limestone Consumption", "MT", "Limestone used in process")}
                </>
              )}
              {activeTab === "refrigerants" && (
                <>
                  <h3 className="text-[14px] font-semibold text-[#0A0A0A]">Refrigerants & Fire Suppression</h3>
                  {renderParameterInput("refrigerants", "r134aQuantity", "R-134a Refrigerant", "kg", "R-134a used or refilled")}
                  {renderParameterInput("refrigerants", "r410aQuantity", "R-410A Refrigerant", "kg", "R-410A used or refilled")}
                  {renderParameterInput("refrigerants", "co2Extinguisher", "CO₂ Fire Extinguishers", "kg", "CO₂ extinguisher refills")}
                </>
              )}
            </div>
          </div>

          <div className="flex justify-end border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={() => handleSaveSection(activeTab)}
              className="inline-flex items-center gap-2 bg-brand px-6 py-3 text-[13px] font-medium uppercase tracking-wider text-white transition-colors hover:bg-brand-medium"
            >
              <SaveIcon className="h-4 w-4" />
              {savedSections.has(activeTab) ? "Section Saved" : "Save Section"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
