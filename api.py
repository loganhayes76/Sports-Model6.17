import sys
import types
import datetime
import json
import os
import csv
import io
import hashlib
import math

# ── Streamlit mock (must be before any engine import) ───────────────────────
_fake_st = types.ModuleType("streamlit")
_fake_st.cache_data = lambda func=None, ttl=None, max_entries=None, **kw: (
    func if func is not None else (lambda f: f)
)
_fake_st.cache_resource = lambda func=None, ttl=None, max_entries=None, **kw: (
    func if func is not None else (lambda f: f)
)
_fake_st.secrets = {}
_fake_st.session_state = {}
if "streamlit" not in sys.modules:
    sys.modules["streamlit"] = _fake_st
else:
    import streamlit as _real_st
    _real_st.cache_data     = _fake_st.cache_data
    _real_st.cache_resource = _fake_st.cache_resource

from fastapi import FastAPI, Query, UploadFile, File, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

import mlb_api
import nba_api
import ncaa_api
import dfs_api

app = FastAPI(title="SpreadSlayer API", version="0.20.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup_props_refresh():
    """
    On startup, check if mlb_props_slayer_data.json is missing, empty, or
    more than 6 hours old. If so, kick off a background props refresh so
    first-load users see real data without any manual trigger.
    Fires once per server start, non-blocking.
    """
    import subprocess
    import sys
    import time

    props_file = "mlb_props_slayer_data.json"
    stale = False

    if not os.path.exists(props_file):
        stale = True
    else:
        try:
            mtime = os.path.getmtime(props_file)
            age_hours = (time.time() - mtime) / 3600
            if age_hours > 6:
                stale = True
            else:
                try:
                    with open(props_file) as _f:
                        _data = json.load(_f)
                    if not isinstance(_data, list) or len(_data) == 0:
                        stale = True
                except Exception:
                    stale = True
        except Exception:
            stale = True

    if stale:
        print("[startup] mlb_props_slayer_data.json is missing/empty/stale — launching background props refresh.")
        try:
            subprocess.Popen(
                [sys.executable, "update_mlb_props.py"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                close_fds=True,
            )
        except Exception as _e:
            print(f"[startup] Could not launch background props refresh: {_e}")


import secrets as _secrets
import hmac

# ── Pydantic models ──────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    access_code: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    remember_me: bool = False

class GradeRequest(BaseModel):
    date: str
    matchup: str
    market: str
    status: str
    profit_loss: Optional[float] = None

class AddPlayRequest(BaseModel):
    date: str
    sport: str
    matchup: str
    market: str
    model_pick: str
    vegas_line: str = ""
    edge: float = 0.0
    stars: str = "⭐⭐"
    model: str = "Manual"

class DfsOptimizeRequest(BaseModel):
    sport: str = ""
    csv_text: str = ""
    locks: List[str] = []
    scratches: List[str] = []
    num_lineups: int = 10
    mode: str = "cash"
    stack_team: str = ""
    stack_size: int = 0


# ── Helpers ──────────────────────────────────────────────────────────────────
def _today():
    return datetime.datetime.now().strftime("%Y-%m-%d")

SYSTEM_FILE = "system_tracker.csv"
TRACKER_COLS = ["Date", "Sport", "Matchup", "Market", "Model Pick",
                "Vegas Line", "Edge", "Stars", "Status", "Profit/Loss", "Model"]

def _load_tracker() -> list[dict]:
    if not os.path.exists(SYSTEM_FILE):
        return []
    try:
        with open(SYSTEM_FILE, newline="") as f:
            return list(csv.DictReader(f))
    except Exception:
        return []

def _save_tracker(rows: list[dict]):
    with open(SYSTEM_FILE, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=TRACKER_COLS, extrasaction="ignore")
        w.writeheader()
        for row in rows:
            w.writerow({col: row.get(col, "") for col in TRACKER_COLS})

_ROLE_LEVEL = {"guest": 0, "member": 1, "dfs": 2, "admin": 3}

def _get_token_role(token: Optional[str]) -> str:
    """Return the role string for a session token, or 'guest' if invalid/missing."""
    if not token:
        return "guest"
    admin_pw = os.environ.get("ADMIN_PASSWORD", "")
    if admin_pw and token.strip() == admin_pw.strip():
        return "admin"
    tokens = _load_session_tokens()
    entry = tokens.get(token)
    if entry:
        from datetime import timezone
        import datetime as _dt
        exp = entry.get("expires_at")
        if exp:
            try:
                expiry = _dt.datetime.fromisoformat(exp)
                if expiry.tzinfo is None:
                    expiry = expiry.replace(tzinfo=timezone.utc)
                if _dt.datetime.now(timezone.utc) < expiry:
                    return entry.get("role", "member")
            except Exception:
                pass
    return "guest"

def _is_admin(token: Optional[str]) -> bool:
    return _ROLE_LEVEL.get(_get_token_role(token), 0) >= _ROLE_LEVEL["admin"]

def _is_dfs_or_above(token: Optional[str]) -> bool:
    return _ROLE_LEVEL.get(_get_token_role(token), 0) >= _ROLE_LEVEL["dfs"]

# ── Passkey helpers ───────────────────────────────────────────────────────────
PASSKEYS_FILE = "passkeys.json"
SESSION_TOKENS_FILE = "session_tokens.json"
TERMS_FILE = "terms.json"

def _load_passkeys() -> dict:
    if not os.path.exists(PASSKEYS_FILE):
        return {}
    try:
        with open(PASSKEYS_FILE) as f:
            return json.load(f)
    except Exception:
        return {}

def _save_passkeys(pk: dict):
    with open(PASSKEYS_FILE, "w") as f:
        json.dump(pk, f, indent=2)

def _load_session_tokens() -> dict:
    if not os.path.exists(SESSION_TOKENS_FILE):
        return {}
    try:
        with open(SESSION_TOKENS_FILE) as f:
            return json.load(f)
    except Exception:
        return {}

def _save_session_tokens(tokens: dict):
    with open(SESSION_TOKENS_FILE, "w") as f:
        json.dump(tokens, f, indent=2)

def _load_terms() -> str:
    if not os.path.exists(TERMS_FILE):
        return "Terms and Conditions\n\nNo terms have been configured yet. Please contact the administrator."
    try:
        with open(TERMS_FILE) as f:
            data = json.load(f)
            return data.get("content", "")
    except Exception:
        return ""

def _save_terms(content: str):
    with open(TERMS_FILE, "w") as f:
        json.dump({"content": content}, f, indent=2)

class SignupRequest(BaseModel):
    passkey_code: str
    username: str
    password: str
    accepted_terms: bool = False
    email: str = ""
    email_updates: bool = False

class PasskeyCreateRequest(BaseModel):
    code: str
    max_uses: int = 1
    tag: str = ""

class TermsUpdateRequest(BaseModel):
    content: str

class TokenValidateRequest(BaseModel):
    token: str

class LogoutRequest(BaseModel):
    token: str


# ── Core routes ──────────────────────────────────────────────────────────────
@app.get("/api/health")
def health_check():
    return {"status": "online", "version": "0.20.0"}


# ── MLB Props ────────────────────────────────────────────────────────────────
@app.get("/api/mlb/props")
def get_mlb_props():
    file_path = "mlb_props_slayer_data.json"
    if not os.path.exists(file_path):
        return {"status": "no_data", "props": [], "total_props_found": 0,
                "message": "Prop data file not yet populated. Runs daily at 6 AM ET."}
    try:
        with open(file_path, "r") as f:
            raw = json.load(f)
        if not isinstance(raw, list):
            raw = []
        def _safe_positive(v):
            try:
                return float(v or 0) > 0
            except (TypeError, ValueError):
                return False

        valid = [
            p for p in raw
            if isinstance(p, dict)
            and p.get("player", "").strip()
            and p.get("market", "").strip()
            and _safe_positive(p.get("line"))
            and _safe_positive(p.get("proj_mean"))
        ]
        return {"status": "success" if valid else "no_data",
                "props": valid, "total_props_found": len(valid)}
    except Exception as e:
        return {"status": "error", "message": str(e), "props": []}


# ── MLB Umpire ───────────────────────────────────────────────────────────────
@app.get("/api/mlb/umpire")
def get_mlb_umpire(date: str = Query(default=None)):
    date_str = date or _today()
    try:
        games = mlb_api.get_umpires(date_str)
        return {"status": "ok", "date": date_str, "games": games}
    except Exception as e:
        return {"status": "error", "message": str(e), "games": []}


# ── MLB Bullpen ──────────────────────────────────────────────────────────────
@app.get("/api/mlb/bullpen")
def get_mlb_bullpen(date: str = Query(default=None), hours: int = Query(default=72)):
    if hours not in (24, 72):
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="hours must be 24 or 72")
    date_str = date or _today()
    days = 1 if hours == 24 else 3
    try:
        games, raw_counts, pitcher_detail = mlb_api.get_bullpen(date_str, days=days)
        return {
            "status": "ok",
            "date": date_str,
            "hours": hours,
            "days": days,
            "games": games,
            "raw_pitch_counts": raw_counts,
            "pitcher_detail": pitcher_detail,
        }
    except Exception as e:
        return {"status": "error", "message": str(e), "games": []}


# ── MLB Cleanup Crew (Model) ─────────────────────────────────────────────────
@app.get("/api/mlb/model")
def get_mlb_model(date: str = Query(default=None)):
    date_str = date or _today()
    try:
        result = mlb_api.get_cleanup_crew(date_str)
        if result.get("error"):
            return {"status": "error", "message": result["error"], "date": date_str, "games": []}
        return {"status": "ok", "date": date_str, **result}
    except Exception as e:
        return {"status": "error", "message": str(e), "games": []}


# ── MLB Prop Matrix ──────────────────────────────────────────────────────────
@app.get("/api/mlb/prop-matrix")
def get_mlb_prop_matrix():
    try:
        return mlb_api.get_prop_matrix()
    except Exception as e:
        return {"status": "error", "message": str(e), "data": {}}


# ── MLB F5 / YRFI ─────────────────────────────────────────────────────────────
@app.get("/api/mlb/f5-yrfi")
def get_mlb_f5_yrfi(date: str = Query(default=None)):
    date_str = date or _today()
    try:
        result = mlb_api.get_f5_yrfi(date_str)
        return {"status": "ok", "date": date_str, **result}
    except Exception as e:
        return {"status": "error", "message": str(e), "yrfi": [], "f5": []}


# ── MLB Weather & Park ────────────────────────────────────────────────────────
@app.get("/api/mlb/weather")
def get_mlb_weather(date: str = Query(default=None)):
    date_str = date or _today()
    try:
        games = mlb_api.get_weather_park(date_str)
        return {"status": "ok", "date": date_str, "games": games}
    except Exception as e:
        return {"status": "error", "message": str(e), "games": []}


# ── NBA Props ─────────────────────────────────────────────────────────────────
@app.get("/api/nba/props")
def get_nba_props(model: str = Query(default="Consensus")):
    try:
        return nba_api.get_nba_props(model)
    except Exception as e:
        return {"status": "error", "message": str(e), "props": []}


# ── NBA Games ─────────────────────────────────────────────────────────────────
@app.get("/api/nba/games")
def get_nba_games():
    try:
        return nba_api.get_nba_games()
    except Exception as e:
        return {"status": "error", "message": str(e), "games": []}


# ── NBA DFS Optimizer ─────────────────────────────────────────────────────────
class NbaDfsRequest(BaseModel):
    csv_text: str = ""
    locks: list = []
    scratches: list = []
    num_lineups: int = 10
    mode: str = "cash"

@app.post("/api/nba/dfs")
async def nba_dfs_optimize(req: NbaDfsRequest):
    try:
        return dfs_api.optimize_nba(
            csv_text=req.csv_text,
            locks=req.locks,
            scratches=req.scratches,
            num_lineups=req.num_lineups,
            mode=req.mode,
        )
    except Exception as e:
        return {"status": "error", "message": str(e), "lineups": []}


# ── NCAA Baseball ──────────────────────────────────────────────────────────────
@app.get("/api/ncaa/baseball")
def get_ncaa_baseball():
    try:
        return ncaa_api.get_ncaa_baseball()
    except Exception as e:
        return {"status": "error", "message": str(e), "games": []}


# ── NCAA Hoops ────────────────────────────────────────────────────────────────
@app.get("/api/ncaa/hoops")
def get_ncaa_hoops():
    try:
        return ncaa_api.get_ncaa_hoops()
    except Exception as e:
        return {"status": "error", "message": str(e), "games": []}


# ── DFS Optimizer ─────────────────────────────────────────────────────────────
@app.post("/api/dfs/optimize")
async def dfs_optimize(req: DfsOptimizeRequest):
    sport = req.sport.upper()
    try:
        if sport == "MLB":
            return dfs_api.optimize_mlb(
                req.csv_text, req.locks, req.scratches,
                req.num_lineups, req.mode, req.stack_team, req.stack_size,
            )
        elif sport == "NBA":
            return dfs_api.optimize_nba(
                req.csv_text, req.locks, req.scratches, req.num_lineups, req.mode,
            )
        elif sport in ("UFC", "MMA"):
            return dfs_api.optimize_mma(
                req.csv_text, req.locks, req.scratches, req.num_lineups, req.mode,
            )
        elif sport == "PGA":
            return dfs_api.optimize_pga(
                req.csv_text, req.locks, req.scratches, req.num_lineups, req.mode,
            )
        elif sport == "NASCAR":
            return dfs_api.optimize_nascar(
                req.csv_text, req.locks, req.scratches, req.num_lineups, req.mode,
            )
        else:
            return {"status": "error", "message": f"Unknown sport: {sport}"}
    except Exception as e:
        return {"status": "error", "message": str(e), "lineups": []}


def _derive_pick_side(play: dict) -> str:
    """Return a human-readable bet recommendation from a masterboard play dict."""
    market  = play.get("market", "")
    edge    = play.get("edge", 0) or 0
    vegas   = play.get("vegas")
    matchup = play.get("matchup", "")
    sport   = play.get("sport", "")

    def _fmt(v, signed=True):
        """Format a float nicely: drop trailing .0 if whole, add sign if requested."""
        v = float(v)
        if v == int(v):
            return f"{int(v):+d}" if signed else str(int(v))
        return f"{v:+.1f}" if signed else f"{v:.1f}"

    # ── Spread / Runline ──────────────────────────────────────────────────────
    if market in ("Spread", "Runline"):
        if vegas is None:
            return ""
        try:
            v = float(vegas)
        except (ValueError, TypeError):
            return ""
        parts = [t.strip() for t in matchup.split("@")]
        away = parts[0] if len(parts) >= 1 else "Away"
        home = parts[1] if len(parts) >= 2 else "Home"
        if edge > 0:
            return f"{home} {_fmt(v)}"
        else:
            return f"{away} {_fmt(-v)}"

    # ── Total / Over-Under ────────────────────────────────────────────────────
    if market == "Total":
        if vegas is None:
            return ""
        try:
            v = float(vegas)
        except (ValueError, TypeError):
            return ""
        direction = "Over" if edge > 0 else "Under"
        return f"{direction} {_fmt(v, signed=False)}"

    # ── Props (NBA Props, MLB Props, etc.) ────────────────────────────────────
    if "Props" in sport or "prop" in market.lower():
        if vegas is None:
            return ""
        try:
            v = float(vegas)
        except (ValueError, TypeError):
            return ""
        direction = "Over" if edge > 0 else "Under"
        mkt_label = play.get("market", "")
        return f"{direction} {_fmt(v, signed=False)} {mkt_label}".strip()

    # ── NASCAR / PGA / single-winner markets ─────────────────────────────────
    return matchup


# ── MLB Vegas line fetch (totals + spreads from Odds API) ─────────────────────
_MLB_ODDS_NAME_TO_ABBR = {
    "Arizona Diamondbacks": "ARI", "Atlanta Braves": "ATL",
    "Baltimore Orioles": "BAL", "Boston Red Sox": "BOS",
    "Chicago Cubs": "CHC", "Chicago White Sox": "CHW",
    "Cincinnati Reds": "CIN", "Cleveland Guardians": "CLE",
    "Colorado Rockies": "COL", "Detroit Tigers": "DET",
    "Houston Astros": "HOU", "Kansas City Royals": "KCR",
    "Los Angeles Angels": "LAA", "Los Angeles Dodgers": "LAD",
    "Miami Marlins": "MIA", "Milwaukee Brewers": "MIL",
    "Minnesota Twins": "MIN", "New York Mets": "NYM",
    "New York Yankees": "NYY", "Oakland Athletics": "OAK",
    "Athletics": "OAK",
    "Philadelphia Phillies": "PHI", "Pittsburgh Pirates": "PIT",
    "San Diego Padres": "SDP", "San Francisco Giants": "SFG",
    "Seattle Mariners": "SEA", "St. Louis Cardinals": "STL",
    "Tampa Bay Rays": "TBR", "Texas Rangers": "TEX",
    "Toronto Blue Jays": "TOR", "Washington Nationals": "WSN",
}


def _mlb_fetch_vegas_lines() -> dict:
    """
    Fetch today's MLB game totals and runline spreads from the Odds API.
    Returns {home_abbr: {'total': float, 'home_spread': float|None}} or {}.
    Fails silently — never raises.
    """
    key = os.getenv("ODDS_API_KEY") or os.getenv("ODDS_API_KEY_BACKUP") or ""
    if not key:
        return {}
    url = (
        "https://api.the-odds-api.com/v4/sports/baseball_mlb/odds"
        f"?apiKey={key}&regions=us&markets=totals,spreads&oddsFormat=american"
    )
    import requests as _rq
    try:
        r = _rq.get(url, timeout=10)
        if r.status_code != 200:
            return {}
        games = r.json()
        if not isinstance(games, list):
            return {}
        result = {}
        for g in games:
            ht = g.get("home_team", "")
            home_abbr = _MLB_ODDS_NAME_TO_ABBR.get(ht)
            if not home_abbr:
                continue
            totals, home_spreads = [], []
            for bk in g.get("bookmakers", []):
                for mkt in bk.get("markets", []):
                    if mkt.get("key") == "totals":
                        for oc in mkt.get("outcomes", []):
                            if oc.get("name") == "Over":
                                pt = oc.get("point")
                                if pt is not None:
                                    totals.append(float(pt))
                    elif mkt.get("key") == "spreads":
                        for oc in mkt.get("outcomes", []):
                            if oc.get("name") == ht:
                                pt = oc.get("point")
                                if pt is not None:
                                    home_spreads.append(float(pt))
            if not totals:
                continue
            result[home_abbr] = {
                "total":       round(sum(totals) / len(totals), 2),
                "home_spread": round(sum(home_spreads) / len(home_spreads), 2) if home_spreads else None,
            }
        return result
    except Exception:
        return {}


def _mlb_stars(abs_edge: float) -> str:
    if abs_edge >= 1.5:
        return "⭐⭐⭐⭐⭐"
    if abs_edge >= 1.0:
        return "⭐⭐⭐⭐"
    if abs_edge >= 0.5:
        return "⭐⭐⭐"
    return "⭐⭐"


# ── Master Board ──────────────────────────────────────────────────────────────
@app.get("/api/master-board")
def get_master_board():
    """Aggregate top edge plays from all sports."""
    all_plays = []

    # MLB model
    try:
        mlb_result = mlb_api.get_cleanup_crew(_today())
        _vegas = _mlb_fetch_vegas_lines()
        for g in mlb_result.get("games", []):
            h_abbr = g.get("home_abbr", "")
            vline = _vegas.get(h_abbr, {})
            if vline:
                v_total = vline.get("total")
                v_spread = vline.get("home_spread")
                m_total = g.get("consensus_total")
                eng_outs = g.get("engine_outs", {})
                m_spread = (
                    sum(v.get("spread", 0) for v in eng_outs.values()) / len(eng_outs)
                ) if eng_outs else None

                if v_total and m_total:
                    te = round(m_total - v_total, 2)
                    g["total_edge"]  = te
                    g["model_total"] = m_total
                    g["vegas_total"] = v_total
                    g["total_stars"] = _mlb_stars(abs(te))

                if v_spread is not None and m_spread is not None:
                    se = round(m_spread - v_spread, 2)
                    g["spread_edge"]  = se
                    g["model_spread"] = round(m_spread, 2)
                    g["vegas_spread"] = v_spread
                    g["spread_stars"] = _mlb_stars(abs(se))

            te = g.get("total_edge", 0) or 0
            se = g.get("spread_edge", 0) or 0
            if te != 0:
                all_plays.append({
                    "sport": "MLB",
                    "matchup": g.get("matchup", ""),
                    "market": "Total",
                    "proj": g.get("model_total"),
                    "vegas": g.get("vegas_total"),
                    "edge": te,
                    "abs_edge": abs(te),
                    "stars": g.get("total_stars", "⭐⭐"),
                    "icon": "⚾",
                })
            if se != 0:
                all_plays.append({
                    "sport": "MLB",
                    "matchup": g.get("matchup", ""),
                    "market": "Runline",
                    "proj": g.get("model_spread"),
                    "vegas": g.get("vegas_spread"),
                    "edge": se,
                    "abs_edge": abs(se),
                    "stars": g.get("spread_stars", "⭐⭐"),
                    "icon": "⚾",
                })
    except Exception:
        pass

    # NCAA Baseball
    try:
        ncaa_bb = ncaa_api.get_ncaa_baseball()
        for g in ncaa_bb.get("games", []):
            te = g.get("total_edge", 0) or 0
            if te != 0:
                all_plays.append({
                    "sport": "NCAA Baseball",
                    "matchup": g.get("matchup", ""),
                    "market": "Total",
                    "proj": g.get("model_total"),
                    "vegas": g.get("vegas_total"),
                    "edge": te,
                    "abs_edge": abs(te),
                    "stars": g.get("total_stars", "⭐⭐"),
                    "icon": "⚾",
                })
    except Exception:
        pass

    # NCAA Hoops
    try:
        ncaa_h = ncaa_api.get_ncaa_hoops()
        for g in ncaa_h.get("games", []):
            for mkt, edge_key, proj_key, vegas_key, stars_key in [
                ("Spread", "spread_edge", "model_spread", "vegas_spread", "spread_stars"),
                ("Total", "total_edge", "model_total", "vegas_total", "total_stars"),
            ]:
                e = g.get(edge_key, 0) or 0
                if e != 0:
                    all_plays.append({
                        "sport": "NCAA Hoops",
                        "matchup": g.get("matchup", ""),
                        "market": mkt,
                        "proj": g.get(proj_key),
                        "vegas": g.get(vegas_key),
                        "edge": e,
                        "abs_edge": abs(e),
                        "stars": g.get(stars_key, "⭐⭐"),
                        "icon": "🏀",
                    })
    except Exception:
        pass

    # NBA games
    try:
        nba_g = nba_api.get_nba_games()
        for g in nba_g.get("games", []):
            for mkt, edge_key, proj_key, vegas_key, stars_key in [
                ("Spread", "spread_edge", "model_spread", "vegas_spread", "spread_stars"),
                ("Total", "total_edge", "model_total", "vegas_total", "total_stars"),
            ]:
                e = g.get(edge_key, 0) or 0
                if e != 0:
                    all_plays.append({
                        "sport": "NBA",
                        "matchup": g.get("matchup", ""),
                        "market": mkt,
                        "proj": g.get(proj_key),
                        "vegas": g.get(vegas_key),
                        "edge": e,
                        "abs_edge": abs(e),
                        "stars": g.get(stars_key, "⭐⭐"),
                        "icon": "🏀",
                    })
    except Exception:
        pass

    # NBA props
    try:
        nba_props = nba_api.get_nba_props("Consensus")
        for p in nba_props.get("props", [])[:20]:
            e = p.get("edge", 0) or 0
            proj_val = p.get("proj_mean")
            if e > 0 and proj_val is not None and not (isinstance(proj_val, float) and math.isnan(proj_val)):
                all_plays.append({
                    "sport": "NBA Props",
                    "matchup": p.get("player", ""),
                    "market": str(p.get("market", "")).replace("_", " ").title(),
                    "proj": proj_val,
                    "vegas": p.get("line"),
                    "edge": e,
                    "abs_edge": abs(e),
                    "stars": p.get("stars", "⭐⭐"),
                    "icon": "🎯",
                })
    except Exception:
        pass

    # MLB Props
    try:
        mlb_props_data = mlb_api.get_mlb_props_for_board()
        for p in mlb_props_data:
            e = p.get("edge", 0) or 0
            if e > 0:
                all_plays.append({
                    "sport":    "MLB Props",
                    "matchup":  p.get("player", ""),
                    "market":   str(p.get("market", "")).replace("_", " ").title(),
                    "proj":     p.get("proj"),
                    "vegas":    p.get("line"),
                    "edge":     e,
                    "abs_edge": abs(e),
                    "stars":    p.get("stars", "⭐⭐"),
                    "icon":     "⚾",
                })
    except Exception:
        pass

    # NASCAR model value plays (uses same Harville logic as /api/nascar/model)
    try:
        if os.path.exists("nascar_odds_data.json"):
            with open("nascar_odds_data.json") as f:
                nascar_raw = json.load(f)
            for d in nascar_raw:
                win_odds = d.get("odds")
                if not win_odds:
                    continue
                win_prob = _american_to_prob(float(win_odds))
                proj = _harville_expand(win_prob)
                driver_name = d.get("driver", "Unknown")
                mkt_list = [
                    ("Win", win_odds), ("Top 3", d.get("top_3_odds")),
                    ("Top 5", d.get("top_5_odds")), ("Top 10", d.get("top_10_odds")),
                ]
                for mkt, vegas_raw in mkt_list:
                    if not vegas_raw:
                        continue
                    try:
                        vp = _american_to_prob(float(vegas_raw))
                        mp = proj[mkt]
                        edge = round((mp - vp) * 100, 2)
                        if edge >= 3:
                            all_plays.append({
                                "sport": "NASCAR",
                                "matchup": driver_name,
                                "market": mkt,
                                "proj": f"{round(mp * 100, 1)}%",
                                "vegas": f"{round(vp * 100, 1)}%",
                                "edge": edge,
                                "abs_edge": abs(edge),
                                "stars": "⭐⭐⭐⭐⭐" if edge >= 10 else "⭐⭐⭐⭐" if edge >= 5 else "⭐⭐⭐",
                                "icon": "🏎️",
                            })
                    except Exception:
                        continue
    except Exception:
        pass

    all_plays = [
        p for p in all_plays
        if not (isinstance(p.get("proj"), float) and math.isnan(p["proj"]))
    ]

    for p in all_plays:
        if "pick_side" not in p:
            p["pick_side"] = _derive_pick_side(p)

    all_plays.sort(key=lambda x: x["abs_edge"], reverse=True)

    # ── Within-sport percentile rank (sport_pct) ──────────────────────────────
    # Group plays by sport and assign each play a 0.0–1.0 percentile based on
    # its abs_edge rank within that sport. Used for fair cross-sport comparison
    # in the fill pass — a 99th-pct MLB prop competes with a 99th-pct NBA prop.
    from collections import defaultdict as _dd
    _by_sport = _dd(list)
    for _p in all_plays:
        _by_sport[_p["sport"]].append(_p)

    for _sport_plays in _by_sport.values():
        _sorted = sorted(_sport_plays, key=lambda x: x["abs_edge"])
        _n = len(_sorted)
        for _i, _p in enumerate(_sorted):
            _p["sport_pct"] = _i / max(_n - 1, 1)

    # ── Stratified platinum: guaranteed 2 per active sport, then fill to 15 ──
    _guaranteed_list = []
    for _sport_plays in _by_sport.values():
        _top2 = sorted(_sport_plays, key=lambda x: x["abs_edge"], reverse=True)[:2]
        _guaranteed_list.extend(_top2)

    # If guaranteed set itself exceeds 15 (8+ active sports), trim it by
    # sport_pct descending, then abs_edge as tiebreak, to keep the best plays.
    if len(_guaranteed_list) > 15:
        _guaranteed_list = sorted(
            _guaranteed_list,
            key=lambda x: (x["sport_pct"], x["abs_edge"]),
            reverse=True,
        )[:15]

    _guaranteed_ids = {id(_p) for _p in _guaranteed_list}

    # Fill remaining slots using within-sport percentile (not raw edge) so that
    # top-ranked plays from low-edge sports (MLB, NASCAR) aren't squeezed out.
    _fill_candidates = sorted(
        [_p for _p in all_plays if id(_p) not in _guaranteed_ids],
        key=lambda x: (x["sport_pct"], x["abs_edge"]),
        reverse=True,
    )
    _plat_dict = {id(_p): _p for _p in _guaranteed_list}
    for _p in _fill_candidates:
        if len(_plat_dict) >= 15:
            break
        _plat_dict[id(_p)] = _p

    platinum = sorted(_plat_dict.values(), key=lambda x: x["abs_edge"], reverse=True)

    return {
        "status": "ok",
        "date": _today(),
        "total_plays": len(all_plays),
        "plays": all_plays,
        "platinum": platinum,
    }


# ── Tracker (Read/Write) ──────────────────────────────────────────────────────
@app.get("/api/tracker")
def get_tracker(sport: str = Query(default=""), status: str = Query(default="")):
    rows = _load_tracker()
    if sport:
        rows = [r for r in rows if sport.lower() in r.get("Sport", "").lower()]
    if status:
        rows = [r for r in rows if r.get("Status", "") == status]
    return {"status": "ok", "plays": rows, "total": len(rows)}


@app.post("/api/tracker/add")
def add_tracker_play(req: AddPlayRequest, x_admin_token: Optional[str] = Header(default=None)):
    if not _is_admin(x_admin_token):
        return {"status": "error", "message": "Admin access required to add plays"}
    rows = _load_tracker()
    new_row = {
        "Date": req.date or _today(),
        "Sport": req.sport,
        "Matchup": req.matchup,
        "Market": req.market,
        "Model Pick": req.model_pick,
        "Vegas Line": req.vegas_line,
        "Edge": str(req.edge),
        "Stars": req.stars,
        "Status": "Pending",
        "Profit/Loss": "0.0",
        "Model": req.model,
    }
    rows.append(new_row)
    _save_tracker(rows)
    return {"status": "ok", "message": "Play added", "play": new_row}


@app.post("/api/tracker/grade")
def grade_tracker_play(req: GradeRequest, x_admin_token: Optional[str] = Header(default=None)):
    if not _is_admin(x_admin_token):
        return {"status": "error", "message": "Admin access required to grade plays"}
    BASE_UNIT = 100.0
    rows = _load_tracker()
    updated = 0
    for row in rows:
        if (row.get("Date", "") == req.date and
                row.get("Matchup", "") == req.matchup and
                row.get("Market", "") == req.market):
            row["Status"] = req.status
            if req.profit_loss is not None:
                row["Profit/Loss"] = str(req.profit_loss)
            elif req.status == "Win":
                row["Profit/Loss"] = str(BASE_UNIT)
            elif req.status == "Loss":
                row["Profit/Loss"] = str(-BASE_UNIT * 1.1)
            else:
                row["Profit/Loss"] = "0.0"
            updated += 1
    if updated:
        _save_tracker(rows)
    return {"status": "ok", "updated": updated}


@app.delete("/api/tracker/delete")
def delete_tracker_plays(dates: List[str] = Query(default=[]),
                          matchups: List[str] = Query(default=[]),
                          x_admin_token: Optional[str] = Header(default=None)):
    if not _is_admin(x_admin_token):
        return {"status": "error", "message": "Admin access required"}
    rows = _load_tracker()
    orig = len(rows)
    rows = [
        r for r in rows
        if not (r.get("Date", "") in dates and r.get("Matchup", "") in matchups)
    ]
    _save_tracker(rows)
    return {"status": "ok", "deleted": orig - len(rows)}


# ── Admin ─────────────────────────────────────────────────────────────────────
@app.get("/api/admin/status")
def admin_status(x_admin_token: Optional[str] = Header(default=None)):
    if not _is_admin(x_admin_token):
        return {"status": "error", "message": "Invalid admin token"}

    data_files = [
        "mlb_props_slayer_data.json", "nba_props_slayer_data.json",
        "ncaa_stats.csv", "torvik_stats.csv", "system_tracker.csv",
        "mlb_war_database.json",
    ]
    file_status = {}
    for fp in data_files:
        if os.path.exists(fp):
            stat = os.stat(fp)
            age_hours = (datetime.datetime.now().timestamp() - stat.st_mtime) / 3600
            file_status[fp] = {
                "exists": True,
                "size_kb": round(stat.st_size / 1024, 1),
                "age_hours": round(age_hours, 1),
            }
        else:
            file_status[fp] = {"exists": False}

    tracker_rows = _load_tracker()
    pending = sum(1 for r in tracker_rows if r.get("Status") == "Pending")
    wins = sum(1 for r in tracker_rows if r.get("Status") == "Win")
    losses = sum(1 for r in tracker_rows if r.get("Status") == "Loss")

    odds_key_status = "unknown"
    try:
        with open("odds_key_status.json") as f:
            odds_key_status = json.load(f).get("status", "unknown")
    except Exception:
        odds_key_status = "unknown"

    return {
        "status": "ok",
        "date": _today(),
        "data_files": file_status,
        "odds_key": odds_key_status,
        "tracker": {
            "total": len(tracker_rows),
            "pending": pending,
            "wins": wins,
            "losses": losses,
            "win_rate": f"{round(wins / (wins + losses) * 100, 1)}%" if (wins + losses) > 0 else "N/A",
        },
    }


def _hash_code(code: str) -> str:
    """SHA-256 hex digest of an access code for safe storage."""
    return hashlib.sha256(code.encode()).hexdigest()


def _load_users_db() -> dict:
    """Load users.json. Schema: {username: {password_hash, role, ...}}"""
    if os.path.exists("users.json"):
        with open("users.json") as f:
            return json.load(f)
    return {}


def _scrub_users(users: dict) -> dict:
    """Return users dict with sensitive fields removed for API responses."""
    return {
        username: {"role": info.get("role", "viewer")}
        for username, info in users.items()
        if isinstance(info, dict)
    }


@app.get("/api/admin/users")
def admin_get_users(x_admin_token: Optional[str] = Header(default=None)):
    if not _is_admin(x_admin_token):
        return {"status": "error", "message": "Invalid admin token"}
    try:
        users = _load_users_db()
        return {"status": "ok", "users": _scrub_users(users)}
    except Exception as e:
        return {"status": "error", "message": str(e)}


class UserRequest(BaseModel):
    username: str
    access_code: str
    role: str = "viewer"


@app.post("/api/admin/users/add")
def admin_add_user(req: UserRequest, x_admin_token: Optional[str] = Header(default=None)):
    if not _is_admin(x_admin_token):
        return {"status": "error", "message": "Admin access required"}
    try:
        users = _load_users_db()
        if req.username in users:
            return {"status": "error", "message": f"User '{req.username}' already exists"}
        # Access code == username (the key used to log in).
        # Store sha256(username) so login hash verification passes.
        users[req.username] = {
            "password_hash": _hash_code(req.username.strip()),
            "role": req.role,
            "email": "",
            "tags": [],
            "email_updates": False,
        }
        with open("users.json", "w") as f:
            json.dump(users, f, indent=2)
        return {"status": "ok", "message": f"User '{req.username}' added", "users": _scrub_users(users)}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.delete("/api/admin/users/{username}")
def admin_delete_user(username: str, x_admin_token: Optional[str] = Header(default=None)):
    if not _is_admin(x_admin_token):
        return {"status": "error", "message": "Admin access required"}
    try:
        users = _load_users_db()
        if username not in users:
            return {"status": "error", "message": f"User '{username}' not found"}
        del users[username]
        with open("users.json", "w") as f:
            json.dump(users, f, indent=2)
        return {"status": "ok", "message": f"User '{username}' deleted", "users": _scrub_users(users)}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.put("/api/admin/users/{username}")
def admin_update_user(username: str, req: UserRequest, x_admin_token: Optional[str] = Header(default=None)):
    if not _is_admin(x_admin_token):
        return {"status": "error", "message": "Admin access required"}
    try:
        users = _load_users_db()
        entry = dict(users.get(username, {}))
        entry["role"] = req.role
        # Always re-hash the username (consistent with add logic)
        entry["password_hash"] = _hash_code(username.strip())
        users[username] = entry
        with open("users.json", "w") as f:
            json.dump(users, f, indent=2)
        return {"status": "ok", "message": f"User '{username}' updated", "users": _scrub_users(users)}
    except Exception as e:
        return {"status": "error", "message": str(e)}



@app.post("/api/admin/sync-github")
def admin_sync_github(
    files: List[str] = Query(default=[]),
    x_admin_token: Optional[str] = Header(default=None),
):
    if not _is_admin(x_admin_token):
        return {"status": "error", "message": "Invalid admin token"}

    import base64
    import requests as _requests

    token = os.environ.get("GITHUB_PAT") or os.environ.get("GITHUB_TOKEN")
    repo = os.environ.get("GITHUB_REPO")

    if not token or not repo:
        return {"status": "error", "message": "GITHUB_PAT and GITHUB_REPO secrets required"}

    DEFAULT_FILES = [
        "mlb_props_slayer_data.json", "nba_props_slayer_data.json",
        "ncaa_slayer_data.json", "mlb_batters.csv", "mlb_pitchers.csv",
        "ncaa_advanced_offense.csv", "ncaa_pitching_splits.csv",
        "torvik_stats.csv", "pga_odds_data.json", "ufc_odds_data.json",
        "ncaa_stats.csv",
    ]
    target_files = files or DEFAULT_FILES
    results = []

    for fname in target_files:
        url = f"https://api.github.com/repos/{repo}/contents/{fname}?ref=main"
        headers = {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json",
        }
        try:
            resp = _requests.get(url, headers=headers, timeout=15)
            if resp.status_code == 200:
                content_b64 = resp.json().get("content", "").replace("\n", "")
                with open(fname, "wb") as fp:
                    fp.write(base64.b64decode(content_b64))
                results.append({"file": fname, "status": "updated"})
            else:
                results.append({"file": fname, "status": f"not_found ({resp.status_code})"})
        except Exception as e:
            results.append({"file": fname, "status": f"error: {e}"})

    updated = sum(1 for r in results if r["status"] == "updated")
    return {
        "status": "ok",
        "results": results,
        "updated": updated,
        "total": len(results),
    }


# ── DFS sport routes (API compat: /api/dfs/{sport}) ─────────────────────────
@app.post("/api/dfs/{sport}")
async def dfs_optimize_by_sport(sport: str, req: DfsOptimizeRequest):
    """Compatibility route: /api/dfs/{sport} -> dispatch to optimizer."""
    req.sport = sport.upper()
    return await dfs_optimize(req)


# ── NASCAR Predictive Model ──────────────────────────────────────────────────
def _american_to_prob(odds: float) -> float:
    if not odds:
        return 0.0
    if odds < 0:
        return abs(odds) / (abs(odds) + 100)
    return 100 / (odds + 100)


def _prob_to_american(prob: float) -> str:
    if prob <= 0 or prob >= 1:
        return "N/A"
    if prob > 0.5:
        return str(int(round((prob / (1 - prob)) * -100)))
    return f"+{int(round(((1 - prob) / prob) * 100))}"


def _harville_expand(win_prob: float, start_pos: int = 15, track_wear: str = "Medium", temp: int = 95) -> dict:
    pos_mod = 1.0
    if start_pos <= 5:
        pos_mod = 1.15
    elif start_pos <= 12:
        pos_mod = 1.05
    elif start_pos >= 30:
        pos_mod = 0.70
    elif start_pos >= 25:
        pos_mod = 0.85
    temp_factor = max(0, (temp - 60) / 80.0)
    wear_mult = {"Low": 0.0, "Medium": 0.08, "High": 0.18}.get(track_wear, 0.08)
    env_mod = 1.0 + (temp_factor * wear_mult)
    adj = min(0.99, win_prob * pos_mod * env_mod)
    return {
        "Win": adj,
        "Top 3": min(0.99, adj * 2.8),
        "Top 5": min(0.99, adj * 4.2),
        "Top 10": min(0.99, adj * 7.8),
    }


@app.get("/api/nascar/model")
def get_nascar_model(
    track_wear: str = Query(default="Medium"),
    temp: int = Query(default=95),
    track_type: str = Query(default="Intermediate (1.5m)"),
):
    """NASCAR Harville Expansion model from nascar_odds_data.json."""
    fp = "nascar_odds_data.json"
    if not os.path.exists(fp):
        return {
            "status": "ok",
            "drivers": [],
            "message": "No nascar_odds_data.json found. Upload a BetMGM CSV to populate data.",
            "track_wear": track_wear, "temp": temp, "track_type": track_type,
        }
    try:
        with open(fp) as f:
            raw = json.load(f)
    except Exception as e:
        return {"status": "error", "message": str(e), "drivers": []}

    drivers = []
    for d in raw:
        win_odds = d.get("odds")
        if not win_odds:
            continue
        win_prob = _american_to_prob(float(win_odds))
        proj = _harville_expand(win_prob, start_pos=15, track_wear=track_wear, temp=temp)

        # Compare against book's listed odds
        rows = []
        markets = [
            ("Win", win_odds, d.get("top_3_odds")),
            ("Top 3", d.get("top_3_odds"), None),
            ("Top 5", d.get("top_5_odds"), None),
            ("Top 10", d.get("top_10_odds"), None),
        ]
        for market, vegas_raw, _ in markets:
            if not vegas_raw:
                continue
            try:
                vegas_prob = _american_to_prob(float(vegas_raw))
                model_prob = proj[market]
                edge = round((model_prob - vegas_prob) * 100, 2)
                stars = "⭐⭐⭐⭐⭐" if abs(edge) >= 10 else "⭐⭐⭐⭐" if abs(edge) >= 5 else "⭐⭐⭐" if abs(edge) >= 2 else "⭐⭐" if edge > 0 else "⭐"
                rows.append({
                    "market": market,
                    "vegas_odds": int(float(vegas_raw)),
                    "model_prob": f"{round(model_prob * 100, 1)}%",
                    "vegas_prob": f"{round(vegas_prob * 100, 1)}%",
                    "model_odds": _prob_to_american(model_prob),
                    "edge": edge,
                    "stars": stars,
                })
            except Exception:
                continue

        if rows:
            drivers.append({
                "name": d.get("driver", "Unknown"),
                "win_odds": int(float(win_odds)) if win_odds else None,
                "win_prob": f"{round(win_prob * 100, 1)}%",
                "markets": rows,
                "best_edge": max(rows, key=lambda x: x["edge"])["edge"] if rows else 0,
            })

    drivers.sort(key=lambda x: -x["best_edge"])
    return {
        "status": "ok",
        "drivers": drivers,
        "total": len(drivers),
        "track_wear": track_wear, "temp": temp, "track_type": track_type,
    }


@app.post("/api/nascar/upload-csv")
async def nascar_upload_csv(
    file: UploadFile = File(...),
    x_admin_token: Optional[str] = Header(default=None),
):
    if not _is_admin(x_admin_token):
        return {"status": "error", "message": "Admin access required"}
    try:
        content = await file.read()
        text = content.decode("utf-8", errors="ignore")
        reader = csv.reader(io.StringIO(text))
        rows = list(reader)
        parsed = {}
        for idx, row in enumerate(rows):
            if idx < 2 or not row:
                continue
            driver = str(row[0]).strip()
            if not driver or any(t in driver for t in ["PM", "AM", "Race", "Driver"]):
                continue
            try:
                win_odds = float(row[2]) if len(row) > 2 and row[2].strip() else None
                t3_odds = float(row[6]) if len(row) > 6 and row[6].strip() else None
                t5_odds = float(row[10]) if len(row) > 10 and row[10].strip() else None
                t10_odds = float(row[14]) if len(row) > 14 and row[14].strip() else None
                if win_odds is not None:
                    parsed[driver.lower()] = {
                        "driver": driver, "odds": win_odds,
                        "win_probability": round(_american_to_prob(win_odds), 4),
                        "top_3_odds": t3_odds, "top_5_odds": t5_odds, "top_10_odds": t10_odds,
                    }
            except Exception:
                continue
        if parsed:
            with open("nascar_odds_data.json", "w") as f:
                json.dump(list(parsed.values()), f, indent=2)
        return {"status": "ok", "drivers_parsed": len(parsed)}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ── Fantasy Draft Board ───────────────────────────────────────────────────────
@app.get("/api/fantasy/draft-board")
def get_fantasy_draft_board(
    player_type: str = Query(default="All"),
    limit: int = Query(default=50),
):
    """WAR Z-score fantasy draft ranking from mlb_war_database.json."""
    fp = "mlb_war_database.json"
    if not os.path.exists(fp):
        return {"status": "error", "message": "mlb_war_database.json not found", "players": []}
    try:
        with open(fp) as f:
            raw = json.load(f)
    except Exception as e:
        return {"status": "error", "message": str(e), "players": []}

    batters = [p for p in raw if p.get("type") == "Batter"]
    pitchers = [p for p in raw if p.get("type") == "Pitcher"]

    def _zscore(items, key):
        vals = [float(p.get(key) or 0) for p in items]
        if not vals:
            return [0.0] * len(items)
        mean = sum(vals) / len(vals)
        variance = sum((v - mean) ** 2 for v in vals) / len(vals)
        std = variance ** 0.5 or 1
        return [(v - mean) / std for v in vals]

    def _enrich(group):
        if not group:
            return []
        wars = [float(p.get("last_season_war") or 0) for p in group]
        mean = sum(wars) / len(wars) if wars else 0
        std = (sum((w - mean) ** 2 for w in wars) / len(wars)) ** 0.5 if wars else 1
        result = []
        for p, war in zip(group, wars):
            z = (war - mean) / (std or 1)
            adp = max(1, 200 - int(z * 30))
            result.append({
                **p,
                "war_z": round(z, 2),
                "adp": adp,
                "grade": "A+" if z >= 2 else "A" if z >= 1.5 else "B+" if z >= 1 else "B" if z >= 0.5 else "C+" if z >= 0 else "C",
            })
        return sorted(result, key=lambda x: -x["war_z"])

    enriched_batters = _enrich(batters)
    enriched_pitchers = _enrich(pitchers)

    if player_type == "Batter":
        players = enriched_batters
    elif player_type == "Pitcher":
        players = enriched_pitchers
    else:
        # Interleave top batters and pitchers for "All" view
        combined = []
        bi, pi = 0, 0
        while (bi < len(enriched_batters) or pi < len(enriched_pitchers)) and len(combined) < limit * 2:
            if bi < len(enriched_batters) and (pi >= len(enriched_pitchers) or enriched_batters[bi]["war_z"] >= enriched_pitchers[pi]["war_z"]):
                combined.append(enriched_batters[bi]); bi += 1
            elif pi < len(enriched_pitchers):
                combined.append(enriched_pitchers[pi]); pi += 1
        players = combined

    return {
        "status": "ok",
        "players": players[:limit],
        "total_batters": len(enriched_batters),
        "total_pitchers": len(enriched_pitchers),
        "player_type": player_type,
    }


@app.get("/api/fantasy/draft-state/{user}")
def get_draft_state(user: str):
    fp = f"draft_state_{user.lower()}.json"
    if not os.path.exists(fp):
        return {"status": "ok", "state": {"league_size": 12, "draft_slot": 1, "roster": []}}
    try:
        with open(fp) as f:
            return {"status": "ok", "state": json.load(f)}
    except Exception as e:
        return {"status": "error", "message": str(e)}


class DraftStateRequest(BaseModel):
    league_size: int = 12
    draft_slot: int = 1
    roster: list = []


@app.post("/api/fantasy/draft-state/{user}")
def save_draft_state_api(user: str, req: DraftStateRequest):
    fp = f"draft_state_{user.lower()}.json"
    try:
        with open(fp, "w") as f:
            json.dump({"league_size": req.league_size, "draft_slot": req.draft_slot, "roster": req.roster}, f)
        return {"status": "ok", "message": "Draft state saved"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ── Wall Street Cluster ───────────────────────────────────────────────────────
@app.get("/api/mlb/war-cluster")
def get_war_cluster(
    team: str = Query(default=""),
    player_type: str = Query(default="All"),
    sort_by: str = Query(default="war"),
):
    """Return WAR-based player rankings from mlb_war_database.json."""
    fp = "mlb_war_database.json"
    if not os.path.exists(fp):
        return {"status": "error", "message": "mlb_war_database.json not found", "players": []}
    try:
        with open(fp) as f:
            data = json.load(f)
    except Exception as e:
        return {"status": "error", "message": str(e), "players": []}

    if team:
        data = [p for p in data if p.get("team", "").upper() == team.upper()]
    if player_type != "All":
        data = [p for p in data if p.get("type", "").lower() == player_type.lower()]

    sort_key = "last_season_war" if sort_by == "war" else sort_by
    try:
        data.sort(key=lambda x: float(x.get(sort_key, 0) or 0), reverse=True)
    except Exception:
        pass

    teams = sorted(set(p.get("team", "") for p in json.load(open(fp))))
    return {
        "status": "ok",
        "players": data[:100],
        "total": len(data),
        "teams": teams,
    }


# ── Parlay Grader ─────────────────────────────────────────────────────────────
class ParlayLeg(BaseModel):
    description: str
    american_odds: int
    pick: str = ""

class GradeParlayRequest(BaseModel):
    legs: List[ParlayLeg]
    stake: float = 100.0

@app.post("/api/parlay/grade")
def grade_parlay(req: GradeParlayRequest):
    """Compute true-odds vs. house-odds edge for a parlay."""
    def _to_decimal(am):
        if am > 0:
            return 1 + (am / 100)
        return 1 + (100 / abs(am))

    def _to_prob(am):
        if am < 0:
            return abs(am) / (abs(am) + 100)
        return 100 / (am + 100)

    if not req.legs:
        return {"status": "error", "message": "No legs provided"}

    legs_out = []
    combined_decimal = 1.0
    combined_true_prob = 1.0

    for leg in req.legs:
        dec = _to_decimal(leg.american_odds)
        imp_prob = _to_prob(leg.american_odds)
        true_prob = imp_prob / 1.05  # assume ~5% vig removal
        true_prob = min(true_prob, 0.99)
        combined_decimal *= dec
        combined_true_prob *= true_prob
        legs_out.append({
            "description": leg.description,
            "pick": leg.pick,
            "american_odds": leg.american_odds,
            "decimal_odds": round(dec, 3),
            "implied_prob": f"{round(imp_prob * 100, 1)}%",
            "no_vig_prob": f"{round(true_prob * 100, 1)}%",
        })

    parlay_payout = round((combined_decimal - 1) * req.stake, 2)
    fair_decimal = 1 / combined_true_prob
    fair_payout = round((fair_decimal - 1) * req.stake, 2)
    edge = round(((combined_true_prob * combined_decimal) - 1) * 100, 2)

    def _to_american(dec):
        if dec >= 2:
            return f"+{int((dec - 1) * 100)}"
        return str(int(-100 / (dec - 1)))

    return {
        "status": "ok",
        "legs": legs_out,
        "num_legs": len(legs_out),
        "combined_decimal": round(combined_decimal, 3),
        "combined_american": _to_american(combined_decimal),
        "combined_true_prob": f"{round(combined_true_prob * 100, 2)}%",
        "parlay_payout": parlay_payout,
        "fair_payout": fair_payout,
        "edge_pct": edge,
        "stake": req.stake,
        "verdict": "VALUE BET ✅" if edge > 0 else "NEGATIVE EV ❌",
        "stars": "⭐⭐⭐⭐⭐" if edge >= 8 else "⭐⭐⭐⭐" if edge >= 4 else "⭐⭐⭐" if edge >= 1 else "⭐⭐" if edge >= -2 else "⭐",
    }


# ── Admin scheduler/log view ──────────────────────────────────────────────────
@app.get("/api/admin/logs")
def admin_get_logs(
    lines: int = Query(default=50),
    x_admin_token: Optional[str] = Header(default=None),
):
    if not _is_admin(x_admin_token):
        return {"status": "error", "message": "Admin access required"}
    log_files = ["scheduler.log", "grader.log", "sync.log"]
    result = {}
    for lf in log_files:
        if os.path.exists(lf):
            try:
                with open(lf) as f:
                    all_lines = f.readlines()
                result[lf] = [l.rstrip() for l in all_lines[-lines:]]
            except Exception:
                result[lf] = []
        else:
            result[lf] = []
    return {"status": "ok", "logs": result}


@app.post("/api/admin/run-grader")
def admin_run_grader(x_admin_token: Optional[str] = Header(default=None)):
    """Trigger the auto-grader manually."""
    if not _is_admin(x_admin_token):
        return {"status": "error", "message": "Admin access required"}
    try:
        import subprocess
        result = subprocess.run(
            ["python3", "grader.py"],
            capture_output=True, text=True, timeout=60,
        )
        return {
            "status": "ok",
            "returncode": result.returncode,
            "stdout": result.stdout[-2000:] if result.stdout else "",
            "stderr": result.stderr[-1000:] if result.stderr else "",
        }
    except FileNotFoundError:
        return {"status": "error", "message": "grader.py not found"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/api/admin/run-props-update")
def admin_run_props_update(x_admin_token: Optional[str] = Header(default=None)):
    """Trigger the MLB props fetcher manually."""
    if not _is_admin(x_admin_token):
        return {"status": "error", "message": "Admin access required"}
    try:
        import subprocess
        result = subprocess.run(
            ["python3", "update_mlb_props.py"],
            capture_output=True, text=True, timeout=120,
        )
        combined = ((result.stdout or "") + (result.stderr or "")).strip()
        return {
            "status": "ok",
            "returncode": result.returncode,
            "stdout": combined[-2000:] if combined else "",
        }
    except FileNotFoundError:
        return {"status": "error", "message": "update_mlb_props.py not found"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/api/mlb/refresh-props")
def mlb_refresh_props(x_session_token: Optional[str] = Header(default=None)):
    """
    Trigger a full MLB props refresh (update_mlb_props.py) accessible to any
    user with role dfs or above. Shows progress in real time via blocking call.
    """
    if not _is_dfs_or_above(x_session_token):
        return {"status": "error", "message": "DFS or admin access required to refresh props."}
    try:
        import subprocess
        result = subprocess.run(
            [sys.executable, "update_mlb_props.py"],
            capture_output=True, text=True, timeout=180,
        )
        combined = ((result.stdout or "") + (result.stderr or "")).strip()
        return {
            "status": "ok",
            "returncode": result.returncode,
            "stdout": combined[-2000:] if combined else "",
        }
    except FileNotFoundError:
        return {"status": "error", "message": "update_mlb_props.py not found"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ── Auth ─────────────────────────────────────────────────────────────────────
@app.post("/api/auth/login")
def login_with_code(request: LoginRequest):
    # Support both old access_code style and new username+password style
    username = (request.username or request.access_code or "").strip().lower()
    password = (request.password or request.access_code or "").strip()
    remember_me = request.remember_me

    if not username:
        return {"status": "error", "message": "Username is required."}

    # Admin special case: username=admin, password=ADMIN_PASSWORD env var
    admin_pw = os.environ.get("ADMIN_PASSWORD", "")
    if username == "admin" and admin_pw:
        if hmac.compare_digest(password, admin_pw):
            token = _secrets.token_hex(32)
            tokens = _load_session_tokens()
            days = 30 if remember_me else 1
            expires = (datetime.datetime.utcnow() + datetime.timedelta(days=days)).isoformat()
            tokens[token] = {"username": "admin", "role": "admin", "expires_at": expires}
            _save_session_tokens(tokens)
            return {"status": "success", "message": "Admin Access Granted!", "role": "admin", "username": "admin", "token": token}
        return {"status": "error", "message": "Invalid password."}

    users = _load_users_db()

    def _issue_token(uname, urole):
        tok = _secrets.token_hex(32)
        toks = _load_session_tokens()
        days = 30 if remember_me else 1
        expires = (datetime.datetime.utcnow() + datetime.timedelta(days=days)).isoformat()
        toks[tok] = {"username": uname, "role": urole, "expires_at": expires}
        _save_session_tokens(toks)
        return tok

    # Try username lookup first
    if username in users:
        entry = users[username]
        if isinstance(entry, dict):
            stored_hash = entry.get("password_hash", "")
            role = entry.get("role", "member")
            if stored_hash:
                if _hash_code(password) == stored_hash:
                    return {"status": "success", "message": "Access Granted!", "role": role, "username": username, "token": _issue_token(username, role)}
                return {"status": "error", "message": "Invalid password."}
            return {"status": "success", "message": "Access Granted!", "role": role, "username": username, "token": None}

    # Fall back to email lookup (username field may contain an email address)
    matched_user = None
    for uname, info in users.items():
        if isinstance(info, dict) and info.get("email", "").strip().lower() == username:
            matched_user = (uname, info)
            break
    if matched_user:
        uname, entry = matched_user
        stored_hash = entry.get("password_hash", "")
        role = entry.get("role", "member")
        if stored_hash:
            if _hash_code(password) == stored_hash:
                return {"status": "success", "message": "Access Granted!", "role": role, "username": uname, "token": _issue_token(uname, role)}
            return {"status": "error", "message": "Invalid password."}

    return {"status": "error", "message": "Invalid username or password."}


@app.post("/api/auth/signup")
def signup(req: SignupRequest):
    username = req.username.strip().lower()
    password = req.password.strip()
    passkey_code = req.passkey_code.strip().upper()
    email = req.email.strip().lower() if req.email else ""

    if not username or not password or not passkey_code:
        return {"status": "error", "message": "All fields are required."}
    if not req.accepted_terms:
        return {"status": "error", "message": "You must accept the Terms & Conditions."}
    if len(username) < 3:
        return {"status": "error", "message": "Username must be at least 3 characters."}
    if len(password) < 6:
        return {"status": "error", "message": "Password must be at least 6 characters."}
    if not email:
        return {"status": "error", "message": "Email is required."}
    if "@" not in email or "." not in email.split("@")[-1]:
        return {"status": "error", "message": "Please enter a valid email address."}

    # Validate passkey
    passkeys = _load_passkeys()
    if passkey_code not in passkeys:
        return {"status": "error", "message": "Invalid passkey code."}
    pk = passkeys[passkey_code]
    if pk.get("uses_remaining", 0) <= 0:
        return {"status": "error", "message": "This passkey has no uses remaining."}

    # Check username not taken
    users = _load_users_db()
    if username in users or username == "admin":
        return {"status": "error", "message": "Username is already taken."}

    # Create user
    tag = pk.get("tag", "member")
    role = tag if tag in ("dfs", "admin", "member") else "member"
    users[username] = {
        "password_hash": _hash_code(password),
        "role": role,
        "email": email,
        "tags": [tag] if tag else [],
        "email_updates": req.email_updates,
        "joined": datetime.date.today().isoformat(),
        "passkey_used": passkey_code,
    }
    with open("users.json", "w") as f:
        json.dump(users, f, indent=2)

    # Consume passkey
    passkeys[passkey_code]["uses_remaining"] = max(0, pk["uses_remaining"] - 1)
    used_by = passkeys[passkey_code].get("used_by", [])
    if username not in used_by:
        used_by.append(username)
    passkeys[passkey_code]["used_by"] = used_by
    _save_passkeys(passkeys)

    token = _secrets.token_hex(32)
    tokens = _load_session_tokens()
    expires = (datetime.datetime.utcnow() + datetime.timedelta(days=1)).isoformat()
    tokens[token] = {"username": username, "role": role, "expires_at": expires}
    _save_session_tokens(tokens)

    return {"status": "success", "message": "Account created!", "role": role, "username": username, "token": token}


@app.post("/api/auth/validate-token")
def validate_token(req: TokenValidateRequest):
    token = req.token.strip()
    if not token:
        return {"status": "error", "message": "No token provided."}
    tokens = _load_session_tokens()
    entry = tokens.get(token)
    if not entry:
        return {"status": "error", "message": "Invalid token."}
    try:
        expiry = datetime.datetime.fromisoformat(entry.get("expires_at", ""))
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=datetime.timezone.utc)
        if datetime.datetime.now(datetime.timezone.utc) >= expiry:
            del tokens[token]
            _save_session_tokens(tokens)
            return {"status": "error", "message": "Token expired."}
    except Exception:
        del tokens[token]
        _save_session_tokens(tokens)
        return {"status": "error", "message": "Invalid token expiry."}
    return {"status": "success", "username": entry["username"], "role": entry["role"]}


@app.post("/api/auth/logout")
def logout(req: LogoutRequest):
    token = req.token.strip()
    if token:
        tokens = _load_session_tokens()
        tokens.pop(token, None)
        _save_session_tokens(tokens)
    return {"status": "ok"}


# ── Passkeys (admin) ──────────────────────────────────────────────────────────
@app.get("/api/admin/passkeys")
def admin_get_passkeys(x_admin_token: Optional[str] = Header(default=None)):
    if not _is_admin(x_admin_token):
        return {"status": "error", "message": "Admin access required"}
    passkeys = _load_passkeys()
    result = []
    for code, pk in passkeys.items():
        result.append({
            "code": code,
            "uses_remaining": pk.get("uses_remaining", 0),
            "max_uses": pk.get("max_uses", 0),
            "tag": pk.get("tag", ""),
            "created": pk.get("created", ""),
            "used_by": pk.get("used_by", []),
        })
    result.sort(key=lambda x: x["created"], reverse=True)
    return {"status": "ok", "passkeys": result}


@app.post("/api/admin/passkeys")
def admin_create_passkey(req: PasskeyCreateRequest, x_admin_token: Optional[str] = Header(default=None)):
    if not _is_admin(x_admin_token):
        return {"status": "error", "message": "Admin access required"}
    code = req.code.strip().upper()
    if not code:
        return {"status": "error", "message": "Code is required."}
    if req.max_uses < 1 or req.max_uses > 1000:
        return {"status": "error", "message": "max_uses must be between 1 and 1000."}
    valid_tags = {"member", "dfs"}
    tag = req.tag.lower().strip()
    if tag not in valid_tags:
        return {"status": "error", "message": f"tag must be one of: {', '.join(sorted(valid_tags))}"}
    passkeys = _load_passkeys()
    if code in passkeys:
        return {"status": "error", "message": f"Passkey '{code}' already exists."}
    passkeys[code] = {
        "uses_remaining": req.max_uses,
        "max_uses": req.max_uses,
        "tag": req.tag.lower().strip(),
        "created": datetime.date.today().isoformat(),
        "used_by": [],
    }
    _save_passkeys(passkeys)
    return {"status": "ok", "message": f"Passkey '{code}' created.", "passkey": passkeys[code]}


@app.delete("/api/admin/passkeys/{code}")
def admin_delete_passkey(code: str, x_admin_token: Optional[str] = Header(default=None)):
    if not _is_admin(x_admin_token):
        return {"status": "error", "message": "Admin access required"}
    code = code.strip().upper()
    passkeys = _load_passkeys()
    if code not in passkeys:
        return {"status": "error", "message": f"Passkey '{code}' not found."}
    del passkeys[code]
    _save_passkeys(passkeys)
    return {"status": "ok", "message": f"Passkey '{code}' deleted."}


# ── Terms & Conditions ────────────────────────────────────────────────────────
@app.get("/api/terms")
def get_terms():
    return {"status": "ok", "content": _load_terms()}


@app.put("/api/admin/terms")
def update_terms(req: TermsUpdateRequest, x_admin_token: Optional[str] = Header(default=None)):
    if not _is_admin(x_admin_token):
        return {"status": "error", "message": "Admin access required"}
    _save_terms(req.content)
    return {"status": "ok", "message": "Terms updated."}


# ── Production static file serving ───────────────────────────────────────────
# Serves the built React/Vite frontend when frontend/dist exists (production).
# In development, Vite runs separately on port 5000 and this block is skipped.
# IMPORTANT: these routes must be registered LAST so they never shadow /api/* routes.
_DIST = "frontend/dist"
if os.path.isdir(_DIST):
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import FileResponse as _FileResponse

    _assets_dir = os.path.join(_DIST, "assets")
    if os.path.isdir(_assets_dir):
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="static-assets")

    _NO_CACHE_HEADERS = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
    }

    @app.get("/{full_path:path}", include_in_schema=False)
    async def _serve_spa(full_path: str):
        """Catch-all: serve specific dist files or fall back to index.html for SPA routing."""
        candidate = os.path.join(_DIST, full_path)
        if full_path and os.path.isfile(candidate):
            hdrs = _NO_CACHE_HEADERS if os.path.basename(candidate) == "index.html" else {}
            return _FileResponse(candidate, headers=hdrs)
        return _FileResponse(os.path.join(_DIST, "index.html"), headers=_NO_CACHE_HEADERS)
