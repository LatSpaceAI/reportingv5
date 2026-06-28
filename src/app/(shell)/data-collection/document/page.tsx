"use client";

// Smart Upload (AI-Powered) — ported from hindalco's /plant/data-entry document
// flow and restyled to plato-v1's design language. Frontend-only: uploads are
// simulated with a progress animation, then surface canned "extracted" data for
// review (approve / edit / reject). Field labels kept verbatim from hindalco.

import { useCallback, useState } from "react";

import { useToast } from "@/components/Toast";
import {
  PageHeader,
  ReportingPeriodCard,
  useReportingPeriod,
  monthLabel,
  inputClass,
  SparklesIcon,
  FactoryIcon,
  ZapIcon,
  LeafIcon,
  FileTextIcon,
  UploadIcon,
  XIcon,
  CheckCircleIcon,
} from "../shared";

type DocumentType = "production" | "environmental" | "electricity";
type ReviewStatus = "reviewing" | "approved" | "rejected" | "editing";

interface ExtractedDataItem {
  key: string;
  label: string;
  value: string;
  unit: string;
  editable: boolean;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  documentType: DocumentType;
  status: "uploading" | "processing" | "completed";
  reviewStatus: ReviewStatus;
  progress: number;
  extractedData?: ExtractedDataItem[];
  editableData?: Record<string, string>;
}

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "text/plain",
];

function getDocumentTypeData(docType: DocumentType): ExtractedDataItem[] {
  switch (docType) {
    case "production":
      return [
        { key: "totalAluminaProduction", label: "Total Alumina Production", value: "163,252", unit: "t", editable: true },
        { key: "totalAluminaConsumption", label: "Total Alumina Consumption", value: "103,502", unit: "t", editable: true },
        { key: "totalRawMeal", label: "Total Raw Meal Production", value: "247,935", unit: "t", editable: true },
        { key: "limestone", label: "Limestone", value: "237,572", unit: "t", editable: true },
        { key: "aluminiumTotal", label: "Aluminium Total", value: "115,388", unit: "Tons", editable: true },
        { key: "totalOPC", label: "Total OPC Produced", value: "70,695", unit: "t", editable: true },
      ];
    case "environmental":
      return [
        { key: "dustPm", label: "Dust / PM", value: "16.50", unit: "mg/Nm³", editable: true },
        { key: "noxEmissions", label: "NOx (as NO₂-eq.)", value: "328", unit: "mg/Nm³", editable: true },
        { key: "soxEmissions", label: "SOx (as SO₂)", value: "1.40", unit: "mg/Nm³", editable: true },
        { key: "normalVolumeFlow", label: "Normal-volume flow", value: "590,691", unit: "Nm³/h", editable: true },
      ];
    case "electricity":
      return [
        { key: "mainConsumption", label: "Total Consumption", value: "12,52,112", unit: "kWh", editable: true },
        { key: "billingPeriod", label: "Billing Period", value: "2024-04-01 to 2024-04-30", unit: "", editable: true },
      ];
  }
}

const DOC_CONFIG: Record<
  DocumentType,
  { title: string; icon: React.ReactNode; description: string; acceptedTypes: string }
> = {
  production: {
    title: "Daily Production Report",
    icon: <FactoryIcon className="h-7 w-7" />,
    description: "Upload daily production reports, output metrics, and operational data.",
    acceptedTypes: "PDF, Excel, Word",
  },
  environmental: {
    title: "Environmental Compliance Report",
    icon: <LeafIcon className="h-7 w-7" />,
    description: "Upload NOx, SOx, particulate matter test reports.",
    acceptedTypes: "PDF, certified reports",
  },
  electricity: {
    title: "Electricity Bill",
    icon: <ZapIcon className="h-7 w-7" />,
    description: "Upload electricity bills and energy consumption reports.",
    acceptedTypes: "PDF, images, bills",
  },
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default function SmartUploadPage() {
  const { show } = useToast();
  const [period, setPeriod] = useReportingPeriod();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragOver, setDragOver] = useState<DocumentType | null>(null);

  const simulateProcessing = useCallback(async (fileId: string, docType: DocumentType) => {
    for (let progress = 0; progress <= 100; progress += 20) {
      await new Promise((r) => setTimeout(r, 150));
      setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, progress } : f)));
    }
    setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, status: "processing", progress: 0 } : f)));
    for (let progress = 0; progress <= 100; progress += 25) {
      await new Promise((r) => setTimeout(r, 400));
      setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, progress } : f)));
    }
    const extracted = getDocumentTypeData(docType);
    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileId
          ? {
              ...f,
              status: "completed",
              reviewStatus: "reviewing",
              progress: 100,
              extractedData: extracted,
              editableData: extracted.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {}),
            }
          : f,
      ),
    );
  }, []);

  const processFiles = useCallback(
    (fileList: File[], docType: DocumentType) => {
      const valid = fileList.filter((file) => {
        if (file.type && !ALLOWED_TYPES.includes(file.type)) {
          show(`File type ${file.type} is not supported.`);
          return false;
        }
        if (file.size > 10 * 1024 * 1024) {
          show(`${file.name} is too large (max 10MB).`);
          return false;
        }
        return true;
      });
      const newFiles: UploadedFile[] = valid.map((file) => ({
        id: Math.random().toString(36).slice(2, 11),
        name: file.name,
        size: file.size,
        documentType: docType,
        status: "uploading",
        reviewStatus: "reviewing",
        progress: 0,
      }));
      setFiles((prev) => [...prev, ...newFiles]);
      newFiles.forEach((f) => simulateProcessing(f.id, docType));
    },
    [show, simulateProcessing],
  );

  const updateExtracted = (fileId: string, key: string, value: string) =>
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, editableData: { ...f.editableData, [key]: value } } : f)),
    );

  const setReview = (fileId: string, reviewStatus: ReviewStatus) =>
    setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, reviewStatus } : f)));

  const removeFile = (fileId: string) => setFiles((prev) => prev.filter((f) => f.id !== fileId));

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[1000px] px-6 py-6">
        <PageHeader
          icon={<SparklesIcon className="h-5 w-5" />}
          title="Smart Upload"
          subtitle="Upload documents and let AI extract the data automatically, then review before importing."
          backHref="/data-collection"
        />

        <div className="space-y-6">
          <ReportingPeriodCard period={period} onChange={setPeriod} />

          {/* Three upload zones */}
          <div className="grid gap-4 lg:grid-cols-3">
            {(["production", "environmental", "electricity"] as DocumentType[]).map((docType) => {
              const config = DOC_CONFIG[docType];
              return (
                <div
                  key={docType}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(docType);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setDragOver(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(null);
                    processFiles(Array.from(e.dataTransfer.files), docType);
                  }}
                  className={`border-2 border-dashed p-6 text-center transition-all ${
                    dragOver === docType ? "border-brand bg-brand/[0.04]" : "border-gray-300 hover:border-brand/50"
                  }`}
                >
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center bg-brand/[0.06] text-brand">
                    {config.icon}
                  </div>
                  <h3 className="mb-1 text-[13px] font-semibold text-[#0A0A0A]">{config.title}</h3>
                  <p className="mb-3 text-[12px] leading-relaxed text-gray-500">{config.description}</p>
                  <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-gray-400">
                    {config.acceptedTypes}
                  </p>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
                    onChange={(e) => e.target.files && processFiles(Array.from(e.target.files), docType)}
                    className="hidden"
                    id={`upload-${docType}`}
                  />
                  <label
                    htmlFor={`upload-${docType}`}
                    className="inline-flex cursor-pointer items-center gap-1.5 bg-brand px-4 py-2 text-[12px] font-medium uppercase tracking-wider text-white transition-colors hover:bg-brand-medium"
                  >
                    <UploadIcon className="h-3.5 w-3.5" />
                    Choose Files
                  </label>
                </div>
              );
            })}
          </div>

          {/* Uploaded files, grouped by type */}
          {files.length > 0 && (
            <div className="space-y-6">
              {(["production", "environmental", "electricity"] as DocumentType[]).map((docType) => {
                const docFiles = files.filter((f) => f.documentType === docType);
                if (docFiles.length === 0) return null;
                const config = DOC_CONFIG[docType];
                return (
                  <section key={docType} className="border border-gray-200">
                    <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-brand">{config.icon}</span>
                        <h3 className="text-[13px] font-semibold text-[#0A0A0A]">{config.title}</h3>
                      </div>
                      <span className="font-mono text-[11px] text-gray-500">
                        {monthLabel(period.month)} {period.year}
                      </span>
                    </div>

                    <div className="space-y-5 p-5">
                      {docFiles.map((file) => (
                        <div key={file.id} className="border border-gray-200 p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <FileTextIcon className="h-5 w-5 text-gray-400" />
                              <div>
                                <p className="text-[13px] font-semibold text-[#0A0A0A]">{file.name}</p>
                                <p className="font-mono text-[11px] text-gray-400">{formatFileSize(file.size)}</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFile(file.id)}
                              className="text-gray-400 transition-colors hover:text-red-600"
                            >
                              <XIcon className="h-4 w-4" />
                            </button>
                          </div>

                          {file.status !== "completed" && (
                            <div className="mt-4">
                              <div className="mb-1 flex justify-between text-[11px]">
                                <span className="text-gray-500">
                                  {file.status === "uploading" ? "Uploading…" : "AI processing…"}
                                </span>
                                <span className="font-mono">{file.progress}%</span>
                              </div>
                              <div className="h-2 w-full bg-gray-100">
                                <div
                                  className="h-2 bg-brand transition-all duration-300"
                                  style={{ width: `${file.progress}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {file.status === "completed" && file.extractedData && (
                            <div className="mt-4 border border-gray-200 bg-gray-50 p-4">
                              <div className="mb-4 flex items-center justify-between">
                                <h4 className="text-[12px] font-semibold text-[#0A0A0A]">
                                  Extracted Data — Review Required
                                </h4>
                                {file.reviewStatus === "reviewing" && (
                                  <span className="border border-amber-200 bg-amber-50 px-2 py-1 font-mono text-[10px] text-amber-700">
                                    Pending Review
                                  </span>
                                )}
                                {file.reviewStatus === "approved" && (
                                  <span className="border border-brand/20 bg-brand/[0.06] px-2 py-1 font-mono text-[10px] text-brand">
                                    Approved
                                  </span>
                                )}
                                {file.reviewStatus === "rejected" && (
                                  <span className="border border-red-200 bg-red-50 px-2 py-1 font-mono text-[10px] text-red-700">
                                    Rejected
                                  </span>
                                )}
                              </div>

                              <div className="mb-4 space-y-3">
                                {file.extractedData.map((item) => (
                                  <div key={item.key} className="border-b border-gray-200 pb-3 last:border-0">
                                    <span className="mb-1 block text-[11px] font-semibold text-[#0A0A0A]">
                                      {item.label}
                                    </span>
                                    {file.reviewStatus === "editing" && item.editable ? (
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="text"
                                          value={file.editableData?.[item.key] ?? item.value}
                                          onChange={(e) => updateExtracted(file.id, item.key, e.target.value)}
                                          className={`${inputClass} max-w-[240px] py-2 font-mono`}
                                        />
                                        <span className="text-[12px] text-gray-500">{item.unit}</span>
                                      </div>
                                    ) : (
                                      <span className="block font-mono text-[13px] text-[#0A0A0A]">
                                        {file.editableData?.[item.key] ?? item.value}
                                        {item.unit && ` ${item.unit}`}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>

                              <div className="flex items-center justify-end gap-2">
                                {file.reviewStatus === "reviewing" && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReview(file.id, "rejected");
                                        show("Data rejected.");
                                      }}
                                      className="border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-[#0A0A0A]/70 transition-colors hover:border-red-300 hover:text-red-600"
                                    >
                                      Reject
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setReview(file.id, "editing")}
                                      className="border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-[#0A0A0A]/70 transition-colors hover:border-brand/50 hover:text-brand"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReview(file.id, "approved");
                                        show("Data approved and imported.");
                                      }}
                                      className="bg-brand px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-brand-medium"
                                    >
                                      Approve
                                    </button>
                                  </>
                                )}
                                {file.reviewStatus === "editing" && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => setReview(file.id, "reviewing")}
                                      className="border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-[#0A0A0A]/70 transition-colors hover:border-gray-300"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReview(file.id, "approved");
                                        show("Changes saved and data approved.");
                                      }}
                                      className="bg-brand px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-brand-medium"
                                    >
                                      Save & Approve
                                    </button>
                                  </>
                                )}
                                {file.reviewStatus === "approved" && (
                                  <span className="flex items-center gap-1 font-mono text-[11px] text-brand">
                                    <CheckCircleIcon className="h-4 w-4" />
                                    Data Approved
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
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
