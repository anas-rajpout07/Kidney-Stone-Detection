export type DetectionStatus = "detected" | "not_detected";

export interface DetectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Detection {
  id: number;
  className: string;
  confidence: number;
  bbox: DetectionBox;
}

export interface DetectionResult {
  recordId?: number;
  status: DetectionStatus;
  stoneCount: number;
  averageConfidence: number;
  highestConfidence: number;
  originalImageUrl: string;
  detectedImageUrl: string;
  fileName: string;
  analyzedAt: string;
  detections: Detection[];
}

export interface HistoryRecord {
  id: number;
  fileName: string;
  analyzedAt: string;
  status: DetectionStatus;
  stoneCount: number;
  confidence: number;
  highestConfidence: number;
}

export interface AnalysisStats {
  analysesCompleted: number;
  stonesDetected: number;
  averageConfidence: number;
}

export interface ModelInfo {
  name: string;
  type: string;
  task: string;
  input: string;
  output: string;
  status: string;
}
