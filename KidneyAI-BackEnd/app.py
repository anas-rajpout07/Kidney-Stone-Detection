"""
KidneyAI Flask Backend
======================

Runs YOLO kidney-stone detection, persists every completed analysis in SQLite,
serves analysis history/statistics/detail APIs, and generates downloadable PDF
reports containing the scan images and structured prediction results.
"""

import base64
import io
import os
import re
import sqlite3
import tempfile
import traceback
from datetime import datetime
from typing import Any

try:
    import cv2
except ImportError:  # pragma: no cover - prediction dependency
    cv2 = None
import numpy as np
try:
    import torch
except ImportError:  # pragma: no cover - prediction dependency
    torch = None
from flask import Flask, jsonify, request, send_file
try:
    from flask_cors import CORS
except ImportError:  # pragma: no cover - optional development dependency
    def CORS(_app):
        return None
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle, Image as PdfImage
try:
    from ultralytics import YOLO
except ImportError:  # pragma: no cover - prediction dependency
    YOLO = None
from werkzeug.utils import secure_filename

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BEST_WEIGHTS_PATH = os.path.join(BASE_DIR, "best.pt")
DATABASE_PATH = os.environ.get("KIDNEYAI_DATABASE", os.path.join(BASE_DIR, "kidneyai.sqlite3"))

IMG_SIZE = 896
CONF_THRESHOLD = 0.25
DEVICE = 0 if torch is not None and torch.cuda.is_available() else "cpu"
DEVICE_LABEL = "CUDA" if torch is not None and torch.cuda.is_available() else "CPU"
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "bmp", "webp"}
MAX_CONTENT_LENGTH_MB = 10

app = Flask(__name__)
CORS(app)
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH_MB * 1024 * 1024


def get_db() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_db() -> None:
    os.makedirs(os.path.dirname(DATABASE_PATH) or ".", exist_ok=True)
    with get_db() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS analysis_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_name TEXT NOT NULL,
                analyzed_at TEXT NOT NULL,
                created_at TEXT NOT NULL,
                detected INTEGER NOT NULL DEFAULT 0,
                total_stones INTEGER NOT NULL DEFAULT 0,
                average_confidence REAL NOT NULL DEFAULT 0,
                highest_confidence REAL NOT NULL DEFAULT 0,
                original_image BLOB NOT NULL,
                original_mime_type TEXT NOT NULL,
                annotated_image BLOB NOT NULL,
                annotated_mime_type TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS analysis_detections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                record_id INTEGER NOT NULL,
                detection_number INTEGER NOT NULL,
                class_name TEXT NOT NULL,
                confidence REAL NOT NULL,
                x1 REAL NOT NULL,
                y1 REAL NOT NULL,
                x2 REAL NOT NULL,
                y2 REAL NOT NULL,
                FOREIGN KEY (record_id) REFERENCES analysis_records(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_analysis_records_created_at
                ON analysis_records(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_analysis_detections_record_id
                ON analysis_detections(record_id);
            """
        )


model = None
model_load_error = None


def load_model() -> None:
    global model, model_load_error
    if YOLO is None:
        model_load_error = "Ultralytics is not installed on the backend."
        print(f"[ERROR] {model_load_error}")
        return
    if not os.path.exists(BEST_WEIGHTS_PATH):
        model_load_error = f"Weights file not found at {BEST_WEIGHTS_PATH}"
        print(f"[ERROR] {model_load_error}")
        return
    try:
        model = YOLO(BEST_WEIGHTS_PATH)
        print(f"[INFO] Model loaded successfully from {BEST_WEIGHTS_PATH}")
    except Exception as exc:  # noqa: BLE001
        model_load_error = str(exc)
        print(f"[ERROR] Failed to load model: {model_load_error}")


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def is_valid_image(file_path: str) -> bool:
    if cv2 is None:
        return False
    try:
        return cv2.imread(file_path) is not None
    except Exception:  # noqa: BLE001
        return False


def mime_type_for_extension(extension: str) -> str:
    return {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "bmp": "image/bmp",
        "webp": "image/webp",
    }.get(extension.lower(), "image/jpeg")


def encode_image_to_base64(image_bytes: bytes, mime_type: str = "image/jpeg") -> str:
    encoded = base64.b64encode(image_bytes).decode("utf-8")
    return f"data:{mime_type};base64,{encoded}"


def encode_array_to_jpeg(image: np.ndarray) -> bytes:
    if cv2 is None:
        raise RuntimeError("OpenCV is not installed on the backend.")
    success, buffer = cv2.imencode(".jpg", image)
    if not success:
        raise RuntimeError("Failed to encode annotated image as JPEG.")
    return buffer.tobytes()


def now_strings() -> tuple[str, str]:
    now = datetime.now().astimezone()
    return now.strftime("%b %d, %Y · %I:%M %p"), now.isoformat(timespec="seconds")


def detection_to_api(item: sqlite3.Row) -> dict[str, Any]:
    return {
        "detection_id": int(item["detection_number"]),
        "class_name": item["class_name"],
        "confidence": float(item["confidence"]) / 100,
        "confidence_percentage": f"{float(item['confidence']):.2f}%",
        "box": {
            "x1": float(item["x1"]),
            "y1": float(item["y1"]),
            "x2": float(item["x2"]),
            "y2": float(item["y2"]),
        },
    }


def load_record(record_id: int, include_images: bool = False) -> dict[str, Any] | None:
    with get_db() as connection:
        record = connection.execute(
            "SELECT * FROM analysis_records WHERE id = ?", (record_id,)
        ).fetchone()
        if record is None:
            return None
        detections = connection.execute(
            "SELECT * FROM analysis_detections WHERE record_id = ? ORDER BY detection_number",
            (record_id,),
        ).fetchall()

    response: dict[str, Any] = {
        "id": int(record["id"]),
        "file_name": record["file_name"],
        "analyzed_at": record["analyzed_at"],
        "status": "detected" if record["detected"] else "not_detected",
        "detected": bool(record["detected"]),
        "total_stones": int(record["total_stones"]),
        "average_confidence": float(record["average_confidence"]),
        "highest_confidence": float(record["highest_confidence"]),
        "detections": [detection_to_api(item) for item in detections],
    }
    if include_images:
        response["original_image"] = encode_image_to_base64(
            bytes(record["original_image"]), record["original_mime_type"]
        )
        response["annotated_image"] = encode_image_to_base64(
            bytes(record["annotated_image"]), record["annotated_mime_type"]
        )
    return response


def save_analysis_record(
    *,
    file_name: str,
    original_image: bytes,
    original_mime_type: str,
    annotated_image: bytes,
    detections: list[dict[str, Any]],
) -> tuple[int, str, float, float]:
    analyzed_at, created_at = now_strings()
    confidences = [float(item["confidence"]) for item in detections]
    average_confidence = sum(confidences) / len(confidences) if confidences else 0.0
    highest_confidence = max(confidences) if confidences else 0.0

    with get_db() as connection:
        cursor = connection.execute(
            """
            INSERT INTO analysis_records (
                file_name, analyzed_at, created_at, detected, total_stones,
                average_confidence, highest_confidence, original_image,
                original_mime_type, annotated_image, annotated_mime_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                file_name,
                analyzed_at,
                created_at,
                int(bool(detections)),
                len(detections),
                average_confidence,
                highest_confidence,
                original_image,
                original_mime_type,
                annotated_image,
                "image/jpeg",
            ),
        )
        record_id = int(cursor.lastrowid)
        connection.executemany(
            """
            INSERT INTO analysis_detections (
                record_id, detection_number, class_name, confidence,
                x1, y1, x2, y2
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    record_id,
                    int(item["detection_id"]),
                    item["class_name"],
                    float(item["confidence"]),
                    float(item["box"]["x1"]),
                    float(item["box"]["y1"]),
                    float(item["box"]["x2"]),
                    float(item["box"]["y2"]),
                )
                for item in detections
            ],
        )
    return record_id, analyzed_at, average_confidence, highest_confidence


def safe_download_name(filename: str) -> str:
    stem = os.path.splitext(secure_filename(filename))[0] or "scan"
    return re.sub(r"[^A-Za-z0-9_-]+", "-", stem).strip("-") or "scan"


def build_pdf(record_id: int) -> io.BytesIO | None:
    with get_db() as connection:
        record = connection.execute(
            "SELECT * FROM analysis_records WHERE id = ?", (record_id,)
        ).fetchone()
        if record is None:
            return None
        detections = connection.execute(
            "SELECT * FROM analysis_detections WHERE record_id = ? ORDER BY detection_number",
            (record_id,),
        ).fetchall()

    styles = getSampleStyleSheet()
    title_style = styles["Title"]
    heading_style = styles["Heading2"]
    body_style = styles["BodyText"]
    body_style.leading = 15

    output = io.BytesIO()
    document = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=16 * mm,
        leftMargin=16 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
        title=f"KidneyAI Analysis Report #{record_id}",
        author="KidneyAI",
    )
    story: list[Any] = [
        Paragraph("KidneyAI Analysis Report", title_style),
        Paragraph(f"Record #{record_id} · {record['analyzed_at']}", body_style),
        Spacer(1, 8),
        Paragraph(f"<b>File:</b> {record['file_name']}", body_style),
        Spacer(1, 8),
    ]

    image_cells: list[Any] = []
    for image_bytes, label in (
        (bytes(record["original_image"]), "Original scan"),
        (bytes(record["annotated_image"]), "AI detection result"),
    ):
        reader = ImageReader(io.BytesIO(image_bytes))
        width, height = reader.getSize()
        max_width, max_height = 82 * mm, 78 * mm
        scale = min(max_width / width, max_height / height, 1)
        image = PdfImage(io.BytesIO(image_bytes), width=width * scale, height=height * scale)
        image_cells.append([Paragraph(f"<b>{label}</b>", body_style), image])
    image_table = Table([image_cells], colWidths=[86 * mm, 86 * mm])
    image_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.extend([image_table, Spacer(1, 8)])

    summary_data = [
        ["Detection status", "Detected" if record["detected"] else "No stone detected"],
        ["Stones detected", str(record["total_stones"])],
        ["Average confidence", f"{float(record['average_confidence']):.1f}%"],
        ["Highest confidence", f"{float(record['highest_confidence']):.1f}%"],
    ]
    summary_table = Table(summary_data, colWidths=[55 * mm, 115 * mm])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#E7F5F2")),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#B7CCC8")),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("PADDING", (0, 0), (-1, -1), 7),
    ]))
    story.extend([summary_table, Spacer(1, 12), Paragraph("Prediction records", heading_style)])

    if detections:
        detection_rows = [["#", "Class", "Confidence", "Bounding box"]]
        for item in detections:
            detection_rows.append([
                str(item["detection_number"]),
                item["class_name"],
                f"{float(item['confidence']):.1f}%",
                f"({float(item['x1']):.1f}, {float(item['y1']):.1f}) → "
                f"({float(item['x2']):.1f}, {float(item['y2']):.1f})",
            ])
        prediction_table = Table(detection_rows, colWidths=[12 * mm, 47 * mm, 35 * mm, 76 * mm])
        prediction_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#102A34")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#B7CCC8")),
            ("PADDING", (0, 0), (-1, -1), 6),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        story.append(prediction_table)
    else:
        story.append(Paragraph("No prediction regions were returned for this scan.", body_style))
    story.extend([
        Spacer(1, 14),
        Paragraph(
            "This report contains model output for research and demonstration. Confidence is a model signal and is not a medical diagnosis.",
            body_style,
        ),
    ])

    document.build(story)
    output.seek(0)
    return output


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "success": True,
        "status": "Backend is running",
        "model_loaded": model is not None,
        "device": DEVICE_LABEL,
        "database": os.path.basename(DATABASE_PATH),
    }), 200


@app.route("/stats", methods=["GET"])
def stats():
    with get_db() as connection:
        row = connection.execute(
            """
            SELECT COUNT(*) AS analyses_completed,
                   COALESCE(SUM(total_stones), 0) AS stones_detected,
                   COALESCE(AVG(NULLIF(average_confidence, 0)), 0) AS average_confidence
            FROM analysis_records
            """
        ).fetchone()
    return jsonify({
        "success": True,
        "analyses_completed": int(row["analyses_completed"]),
        "stones_detected": int(row["stones_detected"]),
        "average_confidence": round(float(row["average_confidence"]), 1),
    }), 200


@app.route("/history", methods=["GET"])
def history():
    try:
        limit = min(max(int(request.args.get("limit", 50)), 1), 200)
    except ValueError:
        limit = 50
    search = request.args.get("search", "").strip()
    query = "SELECT * FROM analysis_records"
    params: list[Any] = []
    if search:
        query += " WHERE file_name LIKE ?"
        params.append(f"%{search}%")
    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)

    with get_db() as connection:
        rows = connection.execute(query, params).fetchall()
    records = [
        {
            "id": int(row["id"]),
            "file_name": row["file_name"],
            "analyzed_at": row["analyzed_at"],
            "status": "detected" if row["detected"] else "not_detected",
            "total_stones": int(row["total_stones"]),
            "average_confidence": float(row["average_confidence"]),
            "highest_confidence": float(row["highest_confidence"]),
        }
        for row in rows
    ]
    return jsonify({"success": True, "records": records}), 200


@app.route("/history/<int:record_id>", methods=["GET"])
def history_detail(record_id: int):
    record = load_record(record_id, include_images=True)
    if record is None:
        return jsonify({"success": False, "error": "Analysis record not found."}), 404
    return jsonify({"success": True, "record": record}), 200


@app.route("/history/<int:record_id>/pdf", methods=["GET"])
def history_pdf(record_id: int):
    with get_db() as connection:
        row = connection.execute(
            "SELECT file_name FROM analysis_records WHERE id = ?", (record_id,)
        ).fetchone()
    if row is None:
        return jsonify({"success": False, "error": "Analysis record not found."}), 404

    try:
        pdf = build_pdf(record_id)
    except Exception as exc:  # noqa: BLE001
        traceback.print_exc()
        return jsonify({"success": False, "error": "PDF generation failed.", "details": str(exc)}), 500
    if pdf is None:
        return jsonify({"success": False, "error": "Analysis record not found."}), 404

    return send_file(
        pdf,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"kidneyai-{record_id}-{safe_download_name(row['file_name'])}.pdf",
    )


@app.route("/predict", methods=["POST"])
def predict():
    if model is None:
        return jsonify({
            "success": False,
            "error": "Model is not loaded.",
            "details": model_load_error or "Unknown error while loading model.",
        }), 500

    if "image" not in request.files:
        return jsonify({"success": False, "error": "No image file provided."}), 400

    file = request.files["image"]
    if not file.filename:
        return jsonify({"success": False, "error": "No image file provided."}), 400
    if not allowed_file(file.filename):
        return jsonify({"success": False, "error": "Invalid image file."}), 400

    filename = secure_filename(file.filename)
    extension = filename.rsplit(".", 1)[1].lower() if "." in filename else "jpg"
    mime_type = mime_type_for_extension(extension)
    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{extension}") as tmp_file:
            file.save(tmp_file.name)
            temp_path = tmp_file.name

        if not is_valid_image(temp_path):
            return jsonify({"success": False, "error": "Invalid image file."}), 400

        with open(temp_path, "rb") as original_file:
            original_bytes = original_file.read()

        print(f"Processing image: {filename}")
        try:
            results = model.predict(
                source=temp_path,
                imgsz=IMG_SIZE,
                device=DEVICE,
                conf=CONF_THRESHOLD,
                save=False,
                verbose=True,
            )
        except Exception as exc:  # noqa: BLE001
            traceback.print_exc()
            return jsonify({"success": False, "error": "Prediction failed.", "details": str(exc)}), 500

        result = results[0]
        annotated_bytes = encode_array_to_jpeg(result.plot())
        detections: list[dict[str, Any]] = []

        if result.boxes is not None and len(result.boxes) > 0:
            confidences = result.boxes.conf.cpu().numpy()
            boxes = result.boxes.xyxy.cpu().numpy()
            classes = result.boxes.cls.cpu().numpy().astype(int) if result.boxes.cls is not None else np.zeros(len(boxes), dtype=int)
            names = getattr(result, "names", {}) or getattr(model, "names", {}) or {}

            for index, (confidence, box, class_index) in enumerate(zip(confidences, boxes, classes), 1):
                x1, y1, x2, y2 = [float(value) for value in box]
                class_name = names.get(int(class_index), "Kidney stone") if isinstance(names, dict) else "Kidney stone"
                detections.append({
                    "detection_id": index,
                    "class_name": str(class_name),
                    "confidence": float(confidence) * 100,
                    "box": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
                })

        record_id, analyzed_at, average_confidence, highest_confidence = save_analysis_record(
            file_name=filename,
            original_image=original_bytes,
            original_mime_type=mime_type,
            annotated_image=annotated_bytes,
            detections=detections,
        )

        return jsonify({
            "success": True,
            "record_id": record_id,
            "detected": bool(detections),
            "total_stones": len(detections),
            "average_confidence": average_confidence,
            "highest_confidence": highest_confidence,
            "detections": [
                {
                    **item,
                    "confidence": float(item["confidence"]) / 100,
                    "confidence_percentage": f"{float(item['confidence']):.2f}%",
                }
                for item in detections
            ],
            "message": "Kidney stones detected." if detections else "No kidney stone detected.",
            "annotated_image": encode_image_to_base64(annotated_bytes),
            "analyzed_at": analyzed_at,
        }), 200

    except Exception as exc:  # noqa: BLE001
        traceback.print_exc()
        return jsonify({"success": False, "error": "Prediction failed.", "details": str(exc)}), 500
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass


@app.errorhandler(413)
def too_large(_error):
    return jsonify({
        "success": False,
        "error": f"Uploaded file too large. Max size is {MAX_CONTENT_LENGTH_MB}MB.",
    }), 413


@app.errorhandler(404)
def not_found(_error):
    return jsonify({"success": False, "error": "Endpoint not found."}), 404


@app.errorhandler(500)
def server_error(_error):
    return jsonify({"success": False, "error": "Internal server error."}), 500


init_db()
load_model()


if __name__ == "__main__":
    print("=" * 40)
    print("      KIDNEYAI FLASK BACKEND")
    print("=" * 40)
    print("Model: best.pt")
    print(f"Device: {DEVICE_LABEL}")
    print(f"Image Size: {IMG_SIZE}")
    print(f"Confidence Threshold: {CONF_THRESHOLD}")
    print(f"SQLite DB: {DATABASE_PATH}")
    print("Backend: http://localhost:5000")
    print("=" * 40)
    DEBUG_MODE = os.environ.get("FLASK_DEBUG", "true").lower() == "true"
    app.run(host="0.0.0.0", port=5000, debug=DEBUG_MODE)
