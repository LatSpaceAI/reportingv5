"use client";

// Excel Upload (Bulk Data Entry) — ported from hindalco's /plant/data-entry bulk
// flow and restyled to plato-v1's design language. Frontend-only: spreadsheet
// uploads are simulated, surfacing canned "extracted" rows with built-in anomaly
// / unit-mismatch validation for review. Field labels kept verbatim from hindalco.

import { useCallback, useState } from "react";

import { useToast } from "@/components/Toast";
import {
  PageHeader,
  ReportingPeriodCard,
  useReportingPeriod,
  monthLabel,
  inputClass,
  SpreadsheetIcon,
  FactoryIcon,
  FileTextIcon,
  UploadIcon,
  DownloadIcon,
  XIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
} from "../shared";
import { downloadPlantInputTemplate, downloadHrDataTemplate } from "../templateBuilder";

interface ExtractedField {
  id: string;
  label: string;
  value: string;
  unit: string;
  isAnomaly?: boolean;
  anomalyMessage?: string;
  hasUnitMismatch?: boolean;
  suggestedUnit?: string;
  suggestedValue?: string;
}

interface BulkFile {
  id: string;
  name: string;
  size: number;
  status: "uploading" | "processing" | "reviewing" | "approved" | "rejected";
  progress: number;
  extractedData?: ExtractedField[];
  editableData?: Record<string, string>;
  isEditing?: boolean;
}

const TEMPLATES = [
  {
    id: "plant",
    name: "Plant Input Sheet",
    description: "Standardized monthly input sheet for all 7 sites — production, energy, emissions, fuel, Scope 3, resources, water & waste.",
    icon: <FactoryIcon className="h-5 w-5" />,
  },
  {
    id: "hr",
    name: "HR Data",
    description: "Workforce and social data input sheet.",
    icon: <FileTextIcon className="h-5 w-5" />,
  },
] as const;

function getMockExtractedData(): ExtractedField[] {
  return [
    { id: "aluminaProduction", label: "Total Alumina Production", value: "163,252", unit: "t" },
    {
      id: "aluminaConsumed",
      label: "Total Alumina Consumption",
      value: "185,502",
      unit: "t",
      isAnomaly: true,
      anomalyMessage:
        "Alumina consumption (185,502 t) exceeds production (163,252 t). Please verify or check if alumina was imported.",
    },
    { id: "rawMealProduction", label: "Raw Meal Production", value: "247,935", unit: "t" },
    { id: "limestoneConsumed", label: "Limestone Consumed", value: "237,572", unit: "t" },
    {
      id: "aluminiumDispatched",
      label: "Total Aluminium Dispatched",
      value: "115,388",
      unit: "Tons",
      hasUnitMismatch: true,
      suggestedUnit: "t",
      suggestedValue: "115,388",
    },
    { id: "opcProduced", label: "Total OPC Produced", value: "70,695", unit: "t" },
    { id: "onSitePowerGeneration", label: "On-site Power Generation", value: "10,617", unit: "MWh" },
    {
      id: "gridPowerConsumed",
      label: "Total Grid Power Consumed",
      value: "15,264",
      unit: "MWh",
      isAnomaly: true,
      anomalyMessage: "Grid power consumption (15,264 MWh) is unusually high. Expected range: 800–5,000 MWh.",
    },
    { id: "indigenousCoal", label: "Indigenous Coal", value: "1,288", unit: "t" },
    { id: "petCoke", label: "Pet Coke", value: "14,256", unit: "t" },
  ];
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

const num = (v: string) => parseFloat(v.replace(/,/g, ""));

export default function BulkUploadPage() {
  const { show } = useToast();
  const [period, setPeriod] = useReportingPeriod();
  const [files, setFiles] = useState<BulkFile[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const simulateProcessing = useCallback(async (fileId: string) => {
    for (let progress = 0; progress <= 100; progress += 25) {
      await new Promise((r) => setTimeout(r, 150));
      setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, progress } : f)));
    }
    setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, status: "processing", progress: 0 } : f)));
    for (let progress = 0; progress <= 100; progress += 20) {
      await new Promise((r) => setTimeout(r, 300));
      setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, progress } : f)));
    }
    const extracted = getMockExtractedData();
    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileId
          ? {
              ...f,
              status: "reviewing",
              progress: 100,
              extractedData: extracted,
              editableData: extracted.reduce((acc, item) => ({ ...acc, [item.id]: item.value }), {}),
            }
          : f,
      ),
    );
  }, []);

  const processFiles = useCallback(
    (fileList: File[]) => {
      const valid = fileList.filter((file) => {
        const isSheet =
          file.type.includes("sheet") || file.type.includes("excel") || file.name.endsWith(".csv");
        if (!isSheet) {
          show(`${file.name} is not a supported spreadsheet format.`);
          return false;
        }
        if (file.size > 5 * 1024 * 1024) {
          show(`${file.name} is too large (max 5MB).`);
          return false;
        }
        return true;
      });
      const newFiles: BulkFile[] = valid.map((file) => ({
        id: Math.random().toString(36).slice(2, 11),
        name: file.name,
        size: file.size,
        status: "uploading",
        progress: 0,
      }));
      setFiles((prev) => [...prev, ...newFiles]);
      newFiles.forEach((f) => simulateProcessing(f.id));
    },
    [show, simulateProcessing],
  );

  const updateField = (fileId: string, fieldId: string, value: string) =>
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, editableData: { ...f.editableData, [fieldId]: value } } : f)),
    );

  const startEditing = (fileId: string) =>
    setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, isEditing: true } : f)));

  const cancelEditing = (fileId: string) =>
    setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, isEditing: false } : f)));

  const saveEditing = (fileId: string) => {
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id !== fileId) return f;
        const updated = f.extractedData?.map((field) => {
          const edited = f.editableData?.[field.id] ?? field.value;
          const next = { ...field, value: edited };
          if (field.id === "aluminaConsumed") {
            const prod = num(f.editableData?.["aluminaProduction"] ?? "0");
            if (num(edited) <= prod) return { ...next, isAnomaly: false, anomalyMessage: undefined };
          }
          if (field.id === "gridPowerConsumed") {
            const v = num(edited);
            if (v >= 800 && v <= 5000) return { ...next, isAnomaly: false, anomalyMessage: undefined };
          }
          return next;
        });
        return { ...f, isEditing: false, extractedData: updated };
      }),
    );
    show("Changes saved and validated.");
  };

  const autoCorrectUnit = (fileId: string, fieldId: string, suggestedUnit: string, suggestedValue: string) => {
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id !== fileId) return f;
        return {
          ...f,
          editableData: { ...f.editableData, [fieldId]: suggestedValue },
          extractedData: f.extractedData?.map((field) =>
            field.id === fieldId
              ? { ...field, unit: suggestedUnit, hasUnitMismatch: false, suggestedUnit: undefined, suggestedValue: undefined }
              : field,
          ),
        };
      }),
    );
    show(`Unit corrected to ${suggestedUnit}.`);
  };

  const setStatus = (fileId: string, status: BulkFile["status"]) =>
    setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, status } : f)));

  const removeFile = (fileId: string) => setFiles((prev) => prev.filter((f) => f.id !== fileId));

  const downloadTemplate = async (id: (typeof TEMPLATES)[number]["id"], name: string) => {
    const meta = { site: period.site, month: monthLabel(period.month), year: period.year };
    show(`Generating ${name} for ${period.site}…`);
    try {
      if (id === "plant") await downloadPlantInputTemplate(meta);
      else await downloadHrDataTemplate(meta);
    } catch {
      show(`Could not generate ${name}. Please try again.`);
    }
  };

  const countIssues = (fields?: ExtractedField[]) => ({
    anomalies: fields?.filter((f) => f.isAnomaly).length ?? 0,
    mismatches: fields?.filter((f) => f.hasUnitMismatch).length ?? 0,
  });

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[1000px] px-6 py-6">
        <PageHeader
          icon={<SpreadsheetIcon className="h-5 w-5" />}
          title="Excel Upload"
          subtitle="Upload Excel/CSV files with production, energy, and fuel data, then review extracted rows."
          backHref="/data-collection"
        />

        <div className="space-y-6">
          <ReportingPeriodCard period={period} onChange={setPeriod} />

          {/* Templates */}
          <section className="border border-gray-200">
            <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-3">
              <SpreadsheetIcon className="h-4 w-4 text-brand" />
              <h3 className="text-[13px] font-semibold text-[#0A0A0A]">Download Templates</h3>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => downloadTemplate(t.id, t.name)}
                  className="group flex items-center gap-3 border border-gray-200 p-4 text-left transition-all hover:border-brand/50 hover:bg-brand/[0.02]"
                >
                  <div className="flex-shrink-0 bg-brand/[0.06] p-2 text-brand">{t.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-[#0A0A0A]">{t.name}</div>
                    <div className="text-[11px] leading-relaxed text-gray-500">{t.description}</div>
                  </div>
                  <DownloadIcon className="h-4 w-4 flex-shrink-0 text-gray-300 transition-opacity group-hover:text-brand" />
                </button>
              ))}
            </div>
          </section>

          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragOver(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              processFiles(Array.from(e.dataTransfer.files));
            }}
            className={`border-2 border-dashed p-12 text-center transition-colors ${
              dragOver ? "border-brand bg-brand/[0.04]" : "border-gray-300 hover:border-brand/50"
            }`}
          >
            <SpreadsheetIcon className="mx-auto mb-4 h-12 w-12 text-gray-300" />
            <h3 className="mb-1 text-[15px] font-semibold text-[#0A0A0A]">Upload Excel/CSV Files</h3>
            <p className="mb-4 text-[13px] text-gray-500">Drag and drop your spreadsheet files here, or click to browse.</p>
            <input
              type="file"
              multiple
              accept=".xlsx,.xls,.csv"
              onChange={(e) => e.target.files && processFiles(Array.from(e.target.files))}
              className="hidden"
              id="bulk-upload"
            />
            <label
              htmlFor="bulk-upload"
              className="inline-flex cursor-pointer items-center gap-1.5 bg-brand px-5 py-2.5 text-[12px] font-medium uppercase tracking-wider text-white transition-colors hover:bg-brand-medium"
            >
              <UploadIcon className="h-3.5 w-3.5" />
              Choose Files
            </label>
            <p className="mt-4 text-[11px] text-gray-400">Supports .xlsx, .xls, .csv • Maximum 5MB per file</p>
          </div>

          {/* Uploaded files */}
          {files.length > 0 && (
            <div className="space-y-6">
              {files.map((file) => {
                const issues = countIssues(file.extractedData);
                const hasIssues = issues.anomalies > 0 || issues.mismatches > 0;
                return (
                  <section key={file.id} className="border border-gray-200">
                    <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-brand/[0.06] p-2 text-brand">
                          <FileTextIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-[14px] font-semibold text-[#0A0A0A]">{file.name}</div>
                          <p className="mt-0.5 text-[11px] text-gray-500">
                            {formatFileSize(file.size)} • {period.site} • {monthLabel(period.month)} {period.year}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {file.status === "reviewing" && (
                          <span className="border border-amber-200 bg-amber-50 px-2 py-1 font-mono text-[10px] text-amber-700">
                            Pending Review
                          </span>
                        )}
                        {file.status === "approved" && (
                          <span className="border border-brand/20 bg-brand/[0.06] px-2 py-1 font-mono text-[10px] text-brand">
                            Approved
                          </span>
                        )}
                        {file.status === "rejected" && (
                          <span className="border border-red-200 bg-red-50 px-2 py-1 font-mono text-[10px] text-red-700">
                            Rejected
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeFile(file.id)}
                          className="text-gray-400 transition-colors hover:text-red-600"
                        >
                          <XIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="p-5">
                      {(file.status === "uploading" || file.status === "processing") && (
                        <div>
                          <div className="mb-1 flex justify-between text-[11px]">
                            <span className="text-gray-500">
                              {file.status === "uploading" ? "Uploading file…" : "Extracting data…"}
                            </span>
                            <span className="font-mono">{file.progress}%</span>
                          </div>
                          <div className="h-2 w-full bg-gray-100">
                            <div className="h-2 bg-brand transition-all duration-300" style={{ width: `${file.progress}%` }} />
                          </div>
                        </div>
                      )}

                      {file.status === "reviewing" && file.extractedData && (
                        <div className="border border-gray-200 bg-gray-50">
                          <div className="border-b border-gray-200 px-4 py-3">
                            <h4 className="text-[12px] font-semibold text-[#0A0A0A]">
                              Extracted Data — Review Required
                            </h4>
                          </div>

                          <div className="max-h-[500px] overflow-y-auto p-4">
                            {hasIssues && (
                              <div className="mb-4 flex items-start gap-2 border border-amber-200 bg-amber-50 p-3 text-[11px]">
                                <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                                <div>
                                  <p className="font-semibold text-amber-900">Data Validation Issues Detected</p>
                                  <p className="text-amber-700">
                                    {issues.anomalies > 0 && (
                                      <span className="font-semibold">
                                        {issues.anomalies} {issues.anomalies === 1 ? "anomaly" : "anomalies"}
                                      </span>
                                    )}
                                    {issues.anomalies > 0 && issues.mismatches > 0 && " and "}
                                    {issues.mismatches > 0 && (
                                      <span className="font-semibold">
                                        {issues.mismatches} unit {issues.mismatches === 1 ? "mismatch" : "mismatches"}
                                      </span>
                                    )}{" "}
                                    found. Please review highlighted fields.
                                  </p>
                                </div>
                              </div>
                            )}

                            <div className="space-y-3">
                              {file.extractedData.map((field) => {
                                const currentValue = file.editableData?.[field.id] ?? field.value;
                                return (
                                  <div
                                    key={field.id}
                                    className={`border-b border-gray-200 pb-3 last:border-0 ${
                                      field.isAnomaly ? "border-red-200 bg-red-50 px-3 py-2" : ""
                                    }`}
                                  >
                                    <div className="mb-1 flex items-center gap-2">
                                      <span className="text-[11px] font-semibold text-[#0A0A0A]">{field.label}</span>
                                      {field.isAnomaly && (
                                        <span className="bg-red-100 px-1.5 py-0.5 font-mono text-[9px] text-red-600">
                                          ANOMALY
                                        </span>
                                      )}
                                      {field.hasUnitMismatch && (
                                        <span className="bg-amber-100 px-1.5 py-0.5 font-mono text-[9px] text-amber-700">
                                          UNIT MISMATCH
                                        </span>
                                      )}
                                    </div>
                                    {file.isEditing ? (
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="text"
                                          value={currentValue}
                                          onChange={(e) => updateField(file.id, field.id, e.target.value)}
                                          className={`${inputClass} max-w-[220px] py-2 font-mono ${
                                            field.isAnomaly ? "border-red-300 focus:border-red-500" : ""
                                          }`}
                                        />
                                        <span className="text-[12px] text-gray-500">{field.unit}</span>
                                      </div>
                                    ) : (
                                      <span
                                        className={`block font-mono text-[13px] ${
                                          field.isAnomaly ? "font-semibold text-red-600" : "text-[#0A0A0A]"
                                        }`}
                                      >
                                        {currentValue} {field.unit}
                                      </span>
                                    )}
                                    {field.isAnomaly && field.anomalyMessage && (
                                      <p className="mt-1 flex items-start gap-1 text-[11px] text-red-600">
                                        <span className="mt-0.5">⚠</span>
                                        <span>{field.anomalyMessage}</span>
                                      </p>
                                    )}
                                    {field.hasUnitMismatch && field.suggestedUnit && (
                                      <div className="mt-1 flex items-center gap-2 text-[11px] text-amber-700">
                                        <span>Expected unit: &quot;{field.suggestedUnit}&quot;</span>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            autoCorrectUnit(
                                              file.id,
                                              field.id,
                                              field.suggestedUnit!,
                                              field.suggestedValue!,
                                            )
                                          }
                                          className="font-medium text-brand underline"
                                        >
                                          Auto-correct
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex flex-col gap-3 border-t border-gray-200 bg-white p-4 sm:flex-row">
                            {!file.isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setStatus(file.id, "rejected");
                                    show("Data rejected.");
                                  }}
                                  className="flex-1 border border-red-200 px-4 py-2.5 text-[12px] font-medium uppercase tracking-wider text-red-600 transition-colors hover:bg-red-50"
                                >
                                  Reject
                                </button>
                                <button
                                  type="button"
                                  onClick={() => startEditing(file.id)}
                                  className="flex-1 border border-gray-200 px-4 py-2.5 text-[12px] font-medium uppercase tracking-wider text-[#0A0A0A]/70 transition-colors hover:border-brand/50 hover:text-brand"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (hasIssues) return;
                                    setStatus(file.id, "approved");
                                    show("Data approved and imported.");
                                  }}
                                  disabled={hasIssues}
                                  title={hasIssues ? "Resolve validation issues before approving" : undefined}
                                  className={`flex-1 px-4 py-2.5 text-[12px] font-medium uppercase tracking-wider text-white transition-colors ${
                                    hasIssues ? "cursor-not-allowed bg-gray-300" : "bg-brand hover:bg-brand-medium"
                                  }`}
                                >
                                  Approve
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => cancelEditing(file.id)}
                                  className="flex-1 border border-gray-200 px-4 py-2.5 text-[12px] font-medium uppercase tracking-wider text-[#0A0A0A]/70 transition-colors hover:border-gray-300"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => saveEditing(file.id)}
                                  className="flex-1 bg-brand px-4 py-2.5 text-[12px] font-medium uppercase tracking-wider text-white transition-colors hover:bg-brand-medium"
                                >
                                  Save Changes
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {file.status === "approved" && (
                        <div className="flex items-center gap-2 border border-brand/20 bg-brand/[0.06] p-3 text-[12px] text-brand">
                          <CheckCircleIcon className="h-4 w-4" />
                          Successfully imported {file.extractedData?.length} data points.
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
