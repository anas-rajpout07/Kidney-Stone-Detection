import type {
  AnalysisStats,
  DetectionResult,
  HistoryRecord,
  ModelInfo,
} from "@/types/analysis";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

export const modelInfo: ModelInfo = {
  name: "YOLO Kidney Stone Detector",
  type: "YOLO",
  task: "Object Detection",
  input: "CT Scan Image",
  output: "Bounding Boxes + Confidence",
  status: "active",
};

async function readJson(response: Response): Promise<any> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new Error(data.error || "The backend request failed.");
  }
  return data;
}

function mapDetections(items: any[] = []) {
  return items.map((item: any) => ({
    id: Number(item.detection_id),
    className: item.class_name || "Kidney stone",
    confidence: Number(item.confidence) * 100,
    bbox: {
      x: Number(item.box.x1),
      y: Number(item.box.y1),
      width: Number(item.box.x2) - Number(item.box.x1),
      height: Number(item.box.y2) - Number(item.box.y1),
    },
  }));
}

function mapDetectionResult(data: any, fallbackFileName?: string): DetectionResult {
  const detections = mapDetections(data.detections);
  const averageConfidence = Number(
    data.average_confidence ??
      (detections.length
        ? detections.reduce((sum: number, item: any) => sum + item.confidence, 0) /
          detections.length
        : 0),
  );
  const highestConfidence = Number(
    data.highest_confidence ??
      (detections.length ? Math.max(...detections.map((item: any) => item.confidence)) : 0),
  );

  return {
    recordId: data.record_id ?? data.id,
    status: data.detected ? "detected" : "not_detected",
    stoneCount: Number(data.total_stones ?? data.stone_count ?? detections.length),
    averageConfidence,
    highestConfidence,
    originalImageUrl: data.original_image || "",
    detectedImageUrl: data.annotated_image || "",
    fileName: data.file_name || fallbackFileName || "scan",
    analyzedAt: data.analyzed_at || new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" }),
    detections,
  };
}

export async function detectScan(file: File): Promise<DetectionResult> {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch(`${API_URL}/predict`, {
    method: "POST",
    body: formData,
  });
  const data = await readJson(response);
  const mapped = mapDetectionResult(data, file.name);
  return {
    ...mapped,
    originalImageUrl: URL.createObjectURL(file),
  };
}

export async function getHistory(search = ""): Promise<HistoryRecord[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  const response = await fetch(`${API_URL}/history${query}`);
  const data = await readJson(response);
  return (data.records ?? []).map((item: any) => ({
    id: Number(item.id),
    fileName: item.file_name,
    analyzedAt: item.analyzed_at,
    status: item.status,
    stoneCount: Number(item.total_stones),
    confidence: Number(item.average_confidence),
    highestConfidence: Number(item.highest_confidence),
  }));
}

export async function getStats(): Promise<AnalysisStats> {
  const response = await fetch(`${API_URL}/stats`);
  const data = await readJson(response);
  return {
    analysesCompleted: Number(data.analyses_completed ?? 0),
    stonesDetected: Number(data.stones_detected ?? 0),
    averageConfidence: Number(data.average_confidence ?? 0),
  };
}

export async function getRecord(recordId: number): Promise<DetectionResult> {
  const response = await fetch(`${API_URL}/history/${recordId}`);
  const data = await readJson(response);
  return mapDetectionResult(data.record);
}

export function getPdfUrl(recordId: number): string {
  return `${API_URL}/history/${recordId}/pdf`;
}

export async function downloadRecordPdf(recordId: number, fileName = "analysis"): Promise<void> {
  const response = await fetch(getPdfUrl(recordId));
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "PDF download failed.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `kidneyai-${fileName.replace(/[^a-z0-9_-]+/gi, "-")}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/health`);
    const data = await response.json();
    return response.ok && data.success;
  } catch {
    return false;
  }
}
