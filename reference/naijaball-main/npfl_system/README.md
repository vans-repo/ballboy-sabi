# NaijaBall Analytics Platform

AI-based match outcome prediction for the Nigeria Professional Football League (NPFL).

**Model:** Random Forest · 68.24% test accuracy · 1,127 matches · 2023–2026  
**Primary predictor:** Travel_Distance_Km (20.0% importance)

---

## Project Structure

```
npfl_system/
├── api/            Flask REST API (deploy to Render)
├── frontend/       React dashboard (deploy to Vercel)
├── src/            Python ML pipeline
├── data/           Datasets (raw + engineered features)
├── models/         Trained model (npfl_brain.pkl)
├── config/         config.yaml
├── main.py         CLI entry point
├── render.yaml     Render deployment config
├── vercel.json     Vercel deployment config
└── Procfile        Gunicorn process file
```

---

## Local Development

### 1. Python dependencies
```bash
pip install -r api/requirements.txt
```

### 2. Run Flask API
```bash
python api/app.py
# API running at http://localhost:5000
```

### 3. Run React dashboard
```bash
cd frontend
npm install
cp .env.example .env.local   # uses localhost:5000 via Vite proxy
npm run dev
# Dashboard at http://localhost:5173
```

### 4. CLI only (no React needed)
```bash
python main.py predict "Enugu Rangers" "Rivers United"
python main.py demo
python main.py evaluate
```

---

## Deployment

### Backend — Render
1. Push this repo to GitHub
2. Go to render.com → New → Web Service
3. Connect your GitHub repo
4. Render auto-detects `render.yaml` and configures everything
5. Note your Render URL: `https://najaball-api.onrender.com`

### Frontend — Vercel
1. Go to vercel.com → New Project → Import from GitHub
2. Vercel auto-detects `vercel.json`
3. Add environment variable:
   - Key: `VITE_API_URL`
   - Value: your Render URL (e.g. `https://najaball-api.onrender.com`)
4. Deploy

---

## API Endpoints

| Method | Endpoint       | Description                        |
|--------|----------------|------------------------------------|
| GET    | /api/health    | Health check                       |
| GET    | /api/teams     | Active and historical team lists   |
| GET    | /api/standings | Final 2025/26 league table         |
| GET    | /api/stats     | Dataset and model statistics       |
| POST   | /api/predict   | Predict fixture outcome            |
| GET    | /api/h2h       | Head-to-head record                |

**Predict example:**
```bash
curl -X POST https://najaball-api.onrender.com/api/predict \
  -H "Content-Type: application/json" \
  -d '{"home": "Enugu Rangers", "away": "Rivers United"}'
```

---

## CLI Commands

```bash
python main.py pipeline                           # full pipeline: clean → engineer → train → evaluate
python main.py predict "Enugu Rangers" "Enyimba"  # single fixture prediction
python main.py demo                               # 5 sample predictions
python main.py evaluate                           # model evaluation report
python main.py update results.txt                 # ingest new match dump + retrain
```

---

*Final Year Project — Amarpepe Adum (U22/CS/1011) · AFIT Kaduna · Supervisor: Mrs. A.C. Okafor*
