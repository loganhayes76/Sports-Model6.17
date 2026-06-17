# SpreadSlayer v0.20.0

## Overview
Multi-sport analytics and DFS optimization platform rebranded from VLS 3000.
Migrating from Streamlit to React/Vite (frontend) + FastAPI (backend).

## Architecture

### Auth System (Task #38)
- **Login wall**: All routes require auth; unauthenticated users see `LoginPage.jsx`
- **Roles**: `guest (0) < member (1) < dfs (2) < admin (3)` — stored in session + localStorage
- **AuthContext**: `frontend/src/context/AuthContext.jsx` — provides `auth`, `login`, `loginAsGuest`, `logout`
- **GuestGate**: `frontend/src/components/GuestGate.jsx` — wraps role-gated routes
- **Login page**: Sign In tab + Create Account tab (passkey code required) + View as Guest
- **Remember Me**: 30-day session token stored in `localStorage` under `ss_session_token`
- **Passkeys**: `passkeys.json` — invite codes with `{uses_remaining, max_uses, tag, used_by[]}`
- **Session tokens**: `session_tokens.json` — `{token: {username, role, expires_at}}`
- **Terms**: `terms.json` — editable T&C text served from `/api/terms`, editable at `/admin` → T&C tab
- **Role gating**: DFS+Fantasy require `dfs`; Tracker+MasterBoard require `member`; Admin requires `admin`
- **Admin auth**: Admin hub still uses `x-admin-token` (ADMIN_PASSWORD secret) for API calls

### Frontend — React + Vite (port 5000)
- Entry: `frontend/src/main.jsx` (BrowserRouter)
- App shell: `frontend/src/App.jsx` (Routes/Router — wraps with AuthProvider)
- Layout: `frontend/src/components/Layout.jsx` — header (user pill + sign-out), sidebar (role-filtered), mobile bottom nav
- Loading: `frontend/src/components/LoadingScreen.jsx` — katana sweep animation

### Backend — FastAPI (port 8000)
- Entry: `start.py` (uvicorn launch)
- Routes: `api.py` (all `/api/*` endpoints)
- MLB logic: `mlb_api.py` — streamlit-free, pure Python+requests
- Scheduler: `scheduler.py` (APScheduler background jobs)

### Dev Server
- `run_dev.sh` — kills stale processes on 8000/5000, starts uvicorn + vite
- Vite proxy: `/api/*` → `http://localhost:8000` (no path rewrite)
- Workflow: "Start application" = `bash run_dev.sh`

## Pages / Routes

| Route | Component | Status |
|---|---|---|
| `/` | `pages/Home.jsx` | Live |
| `/mlb/*` | `pages/mlb/MlbHub.jsx` | **LIVE** — all 7 tools |
| `/nba/*` | `pages/nba/NbaHub.jsx` | **LIVE** — Props + Games |
| `/ncaa/*` | `pages/ncaa/NcaaHub.jsx` | **LIVE** — Baseball + Hoops |
| `/dfs/*` | `pages/dfs/DfsHub.jsx` | **LIVE** — MLB/NBA/UFC/PGA LP optimizer |
| `/admin/*` | `pages/admin/AdminHub.jsx` | **LIVE** — data files, GitHub sync, tracker stats |
| `/tracker` | `pages/tracker/Tracker.jsx` | **LIVE** — play ledger, grader, ROI |
| `/master-board` | `pages/master-board/MasterBoard.jsx` | **LIVE** — all-sport edge aggregator |

**Removed (Task #39)**: `/nascar/*` and `/fantasy/*` routes and sidebar links removed.

## MLB Sub-Routes (MlbHub) — Task #36 COMPLETE

| Route | Component | Data Source |
|---|---|---|
| `/mlb/` | `MlbProps.jsx` | `GET /api/mlb/props` → mlb_props_slayer_data.json |
| `/mlb/matrix` | `MlbPropMatrix.jsx` | `GET /api/mlb/prop-matrix` → mlb_prop_database.json |
| `/mlb/cleanup` | `MlbCleanupCrew.jsx` | `GET /api/mlb/model` → Poisson model via mlb_api.py |
| `/mlb/umpire` | `MlbUmpire.jsx` | `GET /api/mlb/umpire` → MLB feed/live endpoint |
| `/mlb/bullpen` | `MlbBullpen.jsx` | `GET /api/mlb/bullpen?days=1|3` → per-game boxscore, per-pitcher detail |
| `/mlb/weather` | `MlbWeather.jsx` | `GET /api/mlb/weather` → weather.py + stadium_data.py |
| `/mlb/f5` | `MlbF5Yrfi.jsx` | `GET /api/mlb/f5-yrfi` → Poisson + team splits CSV |
| `/mlb/dfs` | Stub | Task #37 |

## Key Fixes (Task #36)
- **Bullpen FIXED**: Per-game `GET /api/v1/game/{gamePk}/boxscore` instead of broken `hydrate=boxscore`
- **Umpire FIXED**: Uses `GET /api/v1.1/game/{game_pk}/feed/live` → `liveData.boxscore.officials`
- **No pandas/numpy at import time**: mlb_api.py is pure Python/requests/csv (pandas lazy-imported only in prop-matrix)
- **Streamlit mock**: `api.py` and `mlb_api.py` inject fake `st.cache_data`/`st.cache_resource` before any engine import
- **Abbreviation lookup**: `_normalize_abbr` chains ABBR_MAP → MLB_STADIUM_MAP → raw_abbr → name[:3]

## Brand / Design
- Colors: teal `#0ea5e9`, lime-green `#84cc16`, bg `#0a0a0f`, surface `#111117`
- CSS variables: `--ss-*` prefix (defined in `frontend/src/index.css`)
- Font: Inter
- Assets in `frontend/public/`: `SSLogo.png`, `SSCrest.png`, `SSKatana.png`
- Shared MLB styles: `frontend/src/pages/mlb/MlbPages.css`

## Python Views (Legacy Streamlit — being migrated)
- `mlb_api.py` — **NEW** FastAPI-native MLB backend (no streamlit)
- `views/nba_view.py` — NBA basketball models
- `views/mlb_view.py` — MLB matchup models (legacy, replaced by mlb_api.py)
- `views/mlb_prop_matrix.py` — MLB player prop matrix (legacy)
- `views/mlb_f5_yrfi_view.py` — MLB F5/YRFI (legacy)
- `views/mlb_weather_park_view.py` — MLB weather/park (legacy)
- `views/mlb_umpire_view.py` — MLB umpire dashboard (legacy)
- `views/mlb_bullpen_view.py` — MLB bullpen radar (legacy)
- `views/ncaa_baseball_view.py` — NCAA baseball models
- `views/ncaa_hoops_view.py` — NCAA basketball models
- `views/nba_dfs_view.py` — NBA DFS optimizer
- `views/mlb_dfs_view.py` — MLB DFS optimizer
- `views/admin_panel.py` — Admin panel

## Key Rules
- Always use relative `/api/...` URLs in React (never `localhost:8000`)
- Frontend port: **5000** (outputType: webview)
- `allowedHosts: true` required in vite.config.js for Replit proxy
- Admin credentials: username `admin`, password = `ADMIN_PASSWORD` secret
- NCAA CSV: `ncaa_advanced_offense.csv` `Runs` column = per-game RPG (single float)
- Streamlit mock: inject BOTH `cache_data` AND `cache_resource` BEFORE any engine import
- pandas/numpy are broken in scheduler process (libstdc++.so.6) — do NOT import at module level

## Environment Secrets
`ODDS_API_KEY`, `ADMIN_PASSWORD`, `WEATHER_API_KEY`, `GITHUB_PAT`, `DATABASE_URL`

## New Backend Modules (Task #37)

- `nba_api.py` — NBA props (10K Monte Carlo sims per player, pure Python) + NBA game edges
- `ncaa_api.py` — NCAA baseball (ELO+RPG+ERA model) + NCAA hoops (Torvik AdjOE/AdjDE/Tempo, Pythagorean win prob)
- `dfs_api.py` — DFS LP optimizer (pulp CBC) for MLB (10P), NBA (8P), UFC (6F), PGA (6G)

## API Endpoints (FastAPI, port 8000)

| Endpoint | Method | Description |
|---|---|---|
| `/api/nba/props?model=X` | GET | Monte Carlo NBA props |
| `/api/nba/games` | GET | NBA game spread/total edges |
| `/api/ncaa/baseball` | GET | NCAA baseball model |
| `/api/ncaa/hoops` | GET | NCAA hoops tempo model |
| `/api/dfs/optimize` | POST | LP lineup optimizer |
| `/api/master-board` | GET | Aggregated top plays |
| `/api/tracker` | GET | Play ledger |
| `/api/tracker/add` | POST | Add a play |
| `/api/tracker/grade` | POST | Grade a play |
| `/api/tracker/delete` | DELETE | Remove plays (admin) |
| `/api/admin/status` | GET | System health + file status |
| `/api/admin/sync-github` | POST | Pull data files from GitHub |

## Task Status
- Task #35 — App shell, brand, routing — COMPLETE
- Task #36 — MLB views migration + umpire/bullpen fixes — COMPLETE
- Task #37 — NBA/NCAA/DFS/Admin/Tracker/MasterBoard views — COMPLETE
