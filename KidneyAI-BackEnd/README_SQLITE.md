# KidneyAI SQLite Backend

The Flask backend now stores each completed analysis in `kidneyai.sqlite3`. The database is created automatically on first startup, so a new database begins with zero history, zero stones, and zero confidence statistics.

## Start the backend

Place `best.pt` beside `app.py`, install the dependencies, and start Flask:

```bash
cd kidney-backend
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

The backend listens on `http://localhost:5000`. The frontend uses `VITE_API_URL` when provided; otherwise it defaults to that URL.

## Endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Checks backend, model, and database status. |
| `GET /stats` | Returns live analysis count, detected-stone count, and average confidence. |
| `GET /history` | Returns the newest saved analysis records. Supports `?search=filename`. |
| `GET /history/<id>` | Returns one stored record with original image, annotated image, scores, and prediction boxes. |
| `GET /history/<id>/pdf` | Downloads a PDF containing both images, score summary, and prediction records. |
| `POST /predict` | Runs YOLO detection, saves the images and prediction output to SQLite, and returns the saved record ID. |

The frontend no longer uses `mockHistory` or hard-coded dashboard statistics. After an analysis completes, the result is saved automatically; the history page loads from SQLite, and the result page's **Download PDF** action downloads the report for that record.
