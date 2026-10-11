# RailFlow

RailFlow is a local, offline-capable prototype for station-aware railway
platform assignment, conflict detection, disruption-aware replanning, and an
experimental arrival-delay forecast.

The core differentiator is that station profiles carry platform, compatibility,
separation, closure, and availability constraints into one shared scheduler and
independent validator. A prediction never changes the timetable; the
constraint-based scheduler and validator remain authoritative for operations.

## Architecture

- `backend/main.py` — FastAPI application, in-memory active timetable, route handlers, and CORS.
- `backend/models.py` — Pydantic request, timetable, platform, and station-profile schemas.
- `backend/station_profiles.py` — Fictional default station and illustrative profile registry.
- `backend/scheduler.py` — Backtracking platform assignment with independent candidate validation.
- `backend/validator.py` — Independent overlap, minimum-gap, platform, closure, availability, and compatibility checks.
- `backend/conflict_detector.py` — Converts validator violations into conflict responses.
- `backend/disruption_engine.py` — Delay and platform-closure replanning.
- `backend/ai_parser.py` — Rule-based disruption text parser; it does not use an LLM.
- `backend/arrival_delay_prediction.py` — Strict wrapper around the experimental HistGradientBoosting artifact.

## Prerequisites

- Windows PowerShell
- Python 3.13 or a compatible Python version supported by the local environment
- The repository's existing `.venv`

This repository includes the FastAPI backend and ML experiment described here,
along with the React/Vite frontend in `frontend/`. The frontend keeps its own
package configuration and Express development server in that directory.

## Setup and startup

From `D:\RailFlow`:

```powershell
.\.venv\Scripts\Activate.ps1
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload
```

Swagger UI is available at <http://127.0.0.1:8000/docs>.

## Frontend setup

From the repository root:

```powershell
Set-Location .\frontend
npm ci
npm run dev
```

The default development server runs the frontend and its Express API on port
3000. To run only the Vite frontend, use `npm run dev:frontend`. Frontend
environment-variable placeholders are documented in `frontend/.env.example`;
keep real values in an ignored local environment file. The frontend-specific
project guide is in `frontend/PROJECT_GUIDE.md`.

## Core API

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/` | Service status |
| GET | `/api/health` | Health status |
| GET | `/api/timetable` | Active timetable and station metadata |
| GET | `/api/conflicts` | Current validator conflicts |
| GET | `/api/stations/profiles` | Available station profiles |
| GET | `/api/stations/profiles/{station_id}` | One station profile |
| POST | `/api/stations/select` | Select a backend-owned profile and load its illustrative seed timetable |
| POST | `/api/schedule/validate` | Validate a supplied timetable |
| POST | `/api/schedule/replan?station_id=ST01` | Replan using a selected profile |
| POST | `/api/disruptions/delay` | Delay a known train and replan |
| POST | `/api/disruptions/closure` | Close a platform interval and replan |
| POST | `/api/platforms/reopen` | Reopen a platform after its closure interval ends and replan |
| POST | `/api/disruptions/parse` | Parse disruption text without applying it |
| POST | `/api/predictions/arrival-delay` | Standalone experimental delay estimate |
| GET | `/api/schedule/history` | In-memory replan history |

### Verified disruption requests

Delay the demo train `T102`:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:8000/api/disruptions/delay `
  -ContentType application/json `
  -Body '{"train_id":"T102","delay_minutes":15}'
```

Close demo platform `P1` from minute 540 through 570:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:8000/api/disruptions/closure `
  -ContentType application/json `
  -Body '{"platform_id":"P1","start_minute":540,"end_minute":570}'
```

Reopen `P1` only after the closure has ended:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:8000/api/platforms/reopen `
  -ContentType application/json `
  -Body '{"platform_id":"P1","reopen_minute":570}'
```

Switch to the backend-owned illustrative North profile:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:8000/api/stations/select `
  -ContentType application/json `
  -Body '{"station_id":"ILLUSTRATIVE-NORTH"}'
```

Both requests are evaluated against the actual constraints. A result with
`status: "VALID_FOUND"` includes a revised schedule and `validation.valid: true`.
An impossible request returns `status: "INFEASIBLE_UNDER_MODEL"` and no schedule;
the existing active timetable is retained.

### Experimental arrival-delay prediction

The model requires prediction-time fields that are not present in the current
timetable train schema:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:8000/api/predictions/arrival-delay `
  -ContentType application/json `
  -Body '{"service_date":"2026-08-15","seq":10,"station_code":"TVC"}'
```

The response contains `predicted_delay_minutes`, `model_id`,
`status: "experimental"`, `experimental: true`, and a full disclaimer. It is an
estimate only: it is not a confirmed live delay and does not alter train times,
platform assignments, closures, or the active timetable.

## Reproducible demo workflow

1. Start the backend and open `/api/timetable` and `/api/conflicts`.
2. Confirm the fictional default station `ST01` uses `P1`, `P2`, and `P3` and the initial `T101`/`T102` overlap is reported.
3. Submit the delay or closure request above.
4. Inspect the `VALID_FOUND` response and its independent validation result.
5. Fetch `/api/timetable` and `/api/conflicts` again to confirm the committed timetable and current conflict state.
6. Switch to `ILLUSTRATIVE-NORTH` through `/api/stations/select` and verify its `N1`/`N2` platforms.
7. Try an impossible profile replan; confirm it reports infeasibility and does not replace the active valid timetable.

## Station profiles and limitations

`ST01` / Central Junction is the required fictional demonstration station.
`ILLUSTRATIVE-NORTH` and `ILLUSTRATIVE-YARD` are illustrative configurations,
not reproductions of actual Indian railway infrastructure.

Station state and schedule history are stored in memory and reset when the
server restarts. Profile selection is applied by the backend before scheduling
and validation; an incompatible platform ID is rejected rather than silently
using another station's constraints.

## ML limitations

The experimental model uses `seq`, `station_code`, service day-of-week, and
service month. It was trained on historical data for train `12624` only. It is
not validated for all trains or stations, is not a live operational forecast,
and must not be treated as a confirmed delay. No prediction automatically
triggers a disruption or schedule replan.

## Testing

Run the complete backend suite with:

```powershell
.\.venv\Scripts\python.exe -m pytest -v
```

The suite includes real HTTP integration tests using an ephemeral Uvicorn server
and Python's standard-library HTTP client. Request routing, JSON parsing,
serialization, and status codes are exercised without adding a production
dependency; tests isolate the backend's in-memory state between cases.
