"""
mlb_api.py — SpreadSlayer MLB FastAPI backend helpers

Pure-Python stubs for numpy / scipy / live_stats are injected into
sys.modules BEFORE importing mlb_engine.  This lets us call the real
5-engine pipeline while avoiding the broken libstdc++.so.6 native
extension that crashes numpy/scipy in this environment.

Import order (CRITICAL):
  1. Streamlit mock
  2. numpy stub
  3. scipy stub
  4. live_stats stub
  5. mlb_engine import  ← now resolves cleanly
  6. Everything else
"""

import sys
import types
import os
import csv
import json
import datetime
import math
import random
import requests


# ═══════════════════════════════════════════════════════════════════
# 1.  STREAMLIT MOCK
# ═══════════════════════════════════════════════════════════════════
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


# ═══════════════════════════════════════════════════════════════════
# 2.  NUMPY STUB (used only by Monte V1 in mlb_engine)
# ═══════════════════════════════════════════════════════════════════
class _FakeArray(list):
    """Minimal list subclass that supports element-wise numpy-style ops."""
    def _op(self, other, fn):
        if isinstance(other, list):
            return _FakeArray(fn(a, b) for a, b in zip(self, other))
        return _FakeArray(fn(a, other) for a in self)
    def __add__(self, other):  return self._op(other, lambda a,b: a+b)
    def __sub__(self, other):  return self._op(other, lambda a,b: a-b)
    def __mul__(self, other):  return self._op(other, lambda a,b: a*b)
    def __gt__(self, other):   return self._op(other, lambda a,b: a>b)
    def __lt__(self, other):   return self._op(other, lambda a,b: a<b)
    def __radd__(self, other): return self._op(other, lambda a,b: b+a)
    def __rsub__(self, other): return self._op(other, lambda a,b: b-a)


class _NPRandom:
    def normal(self, loc=0.0, scale=1.0, size=1):
        return _FakeArray(random.gauss(loc, scale) for _ in range(size))


class _FakeNumpy:
    random = _NPRandom()

    def maximum(self, threshold, arr):
        return _FakeArray(max(threshold, x) for x in arr)

    def mean(self, arr):
        lst = list(arr)
        return sum(lst) / len(lst) if lst else 0.0

    def sum(self, arr):
        return sum(arr)

    def exp(self, x):
        if isinstance(x, list):
            return _FakeArray(math.exp(v) for v in x)
        return math.exp(x)

    def sqrt(self, x):
        return math.sqrt(x)

    def array(self, lst):
        return _FakeArray(lst)

    def zeros(self, n):
        return _FakeArray([0.0] * n)

    # dtype stubs
    float64 = float
    int64   = int
    bool_   = bool

    def __getattr__(self, name):
        return lambda *a, **kw: None


_fake_np          = _FakeNumpy()
# NOTE: This process-level stub is intentional and scoped to this deployment.
# The Replit environment lacks libstdc++.so.6, making numpy/scipy C-extensions
# unloadable.  All downstream consumers in this process (mlb_engine, model.py)
# use the same stubs — no external package expects real numpy from this server.
# If the environment is ever upgraded to include libstdc++.so.6, remove stubs
# and revert to `import numpy as np` in mlb_engine.py.
sys.modules["numpy"] = _fake_np  # type: ignore[assignment]


# ═══════════════════════════════════════════════════════════════════
# 3.  SCIPY STUB (used by model.py: poisson.cdf / poisson.pmf)
# ═══════════════════════════════════════════════════════════════════
def _poisson_pmf(k, mu):
    """P(X=k) for Poisson(mu)."""
    if mu <= 0:
        return 1.0 if k == 0 else 0.0
    return math.exp(-mu) * (mu ** k) / math.factorial(int(k))


def _poisson_cdf(k, mu):
    """P(X <= k) for Poisson(mu)."""
    return sum(_poisson_pmf(i, mu) for i in range(int(k) + 1))


class _Poisson:
    def pmf(self, k, mu): return _poisson_pmf(k, mu)
    def cdf(self, k, mu): return _poisson_cdf(k, mu)
    def sf(self, k, mu):  return 1.0 - _poisson_cdf(k, mu)
    def rvs(self, mu, size=1):
        # Simple Knuth algorithm for Poisson random variates
        results = []
        for _ in range(size):
            L = math.exp(-mu)
            k = 0
            p = 1.0
            while p > L:
                k += 1
                p *= random.random()
            results.append(k - 1)
        return results if size > 1 else results[0]


poisson = _Poisson()

_fake_stats = types.ModuleType("scipy.stats")
_fake_stats.poisson = poisson

_fake_scipy = types.ModuleType("scipy")
_fake_scipy.stats = _fake_stats

sys.modules["scipy"]         = _fake_scipy
sys.modules["scipy.stats"]   = _fake_stats


# ═══════════════════════════════════════════════════════════════════
# 4.  LIVE_STATS STUB (replaces pandas-dependent module)
# ═══════════════════════════════════════════════════════════════════
def _pure_get_split_rpg(team_abbr, pitcher_hand, is_home=True):
    """Pure csv.DictReader version of live_stats.get_split_rpg."""
    venue = "Home" if is_home else "Away"
    try:
        with open("mlb_team_splits.csv", newline="") as f:
            for row in csv.DictReader(f):
                if (row.get("Team") == team_abbr
                        and row.get("Split") == pitcher_hand
                        and row.get("Venue") == venue):
                    return float(row["Split_RPG"])
    except Exception:
        pass
    return 4.5


def _pure_get_pitcher_projection(name):
    return {"proj_ip": 5.2, "proj_k": 5.5}


def _pure_get_batter_projection(name, implied=4.5, opp=""):
    return {"proj_hrr": 2.2, "mod": 1.0}


_fake_live_stats = types.ModuleType("live_stats")
_fake_live_stats.get_split_rpg          = _pure_get_split_rpg
_fake_live_stats.get_pitcher_projection = _pure_get_pitcher_projection
_fake_live_stats.get_batter_projection  = _pure_get_batter_projection
_fake_live_stats.get_ncaa_team_stats    = lambda name: {"rpg":6.5,"era":6.0,"def_hits":9.5,"elo":1500,"is_real":False}

sys.modules["live_stats"] = _fake_live_stats


# ═══════════════════════════════════════════════════════════════════
# 5.  SAFE IMPORTS (no native C extensions)
# ═══════════════════════════════════════════════════════════════════
try:
    from stadium_data import MLB_STADIUM_MAP
    _STADIUM_OK = True
except Exception:
    MLB_STADIUM_MAP = {}
    _STADIUM_OK = False

try:
    from weather import get_weather as _get_weather_raw
    _WEATHER_OK = True
except Exception:
    _WEATHER_OK = False
    def _get_weather_raw(city, target_date=None, cf_orientation=180): return None

# mlb_engine now imports cleanly (numpy/scipy/live_stats all stubbed)
try:
    import mlb_engine as _E
    _ENGINE_OK = True
except Exception as _eng_err:
    _ENGINE_OK = False
    _eng_err_msg = str(_eng_err)


# ═══════════════════════════════════════════════════════════════════
# 6.  CONSTANTS
# ═══════════════════════════════════════════════════════════════════
UMPIRE_DATABASE = {
    "Doug Eddings":      {"type":"Extreme Pitcher","run_factor":0.88,"k_bb":3.6,"zone":"Huge"},
    "Bill Miller":       {"type":"Pitcher Friendly","run_factor":0.94,"k_bb":3.1,"zone":"Large"},
    "Pat Hoberg":        {"type":"Neutral / Accurate","run_factor":0.98,"k_bb":2.8,"zone":"Perfect"},
    "CB Bucknor":        {"type":"Hitter Friendly","run_factor":1.08,"k_bb":2.2,"zone":"Small / Inconsistent"},
    "Rob Drake":         {"type":"Extreme Hitter","run_factor":1.12,"k_bb":2.1,"zone":"Tiny"},
    "Dan Bellino":       {"type":"Hitter Friendly","run_factor":1.06,"k_bb":2.3,"zone":"Small"},
    "Lance Barksdale":   {"type":"Pitcher Friendly","run_factor":0.93,"k_bb":3.2,"zone":"Large"},
    "Laz Diaz":          {"type":"Hitter Friendly","run_factor":1.09,"k_bb":2.1,"zone":"Inconsistent"},
    "Manny Gonzalez":    {"type":"Pitcher Friendly","run_factor":0.95,"k_bb":3.0,"zone":"Large"},
    "Dan Iassogna":      {"type":"Hitter Friendly","run_factor":1.05,"k_bb":2.3,"zone":"Small"},
    "Ron Kulpa":         {"type":"Pitcher Friendly","run_factor":0.96,"k_bb":2.9,"zone":"Large"},
    "Brian O'Nora":      {"type":"Hitter Friendly","run_factor":1.07,"k_bb":2.2,"zone":"Small"},
    "Quinn Wolcott":     {"type":"Hitter Friendly","run_factor":1.06,"k_bb":2.4,"zone":"Small"},
    "Mark Wegner":       {"type":"Pitcher Friendly","run_factor":0.95,"k_bb":3.0,"zone":"Large"},
    "Vic Carapazza":     {"type":"Hitter Friendly","run_factor":1.05,"k_bb":2.3,"zone":"Small"},
    "Larry Vanover":     {"type":"Pitcher Friendly","run_factor":0.94,"k_bb":3.1,"zone":"Large"},
    "Phil Cuzzi":        {"type":"Pitcher Friendly","run_factor":0.96,"k_bb":2.9,"zone":"Large"},
    "Brian Knight":      {"type":"Pitcher Friendly","run_factor":0.95,"k_bb":3.0,"zone":"Large"},
    "Hunter Wendelstedt":{"type":"Hitter Friendly","run_factor":1.05,"k_bb":2.4,"zone":"Small"},
    "Bruce Dreckman":    {"type":"Hitter Friendly","run_factor":1.06,"k_bb":2.3,"zone":"Small"},
    "Chris Guccione":    {"type":"Pitcher Friendly","run_factor":0.95,"k_bb":2.9,"zone":"Large"},
    "Andy Fletcher":     {"type":"Pitcher Friendly","run_factor":0.96,"k_bb":2.9,"zone":"Large"},
    "Mike Muchlinski":   {"type":"Hitter Friendly","run_factor":1.04,"k_bb":2.5,"zone":"Small"},
    "Mark Carlson":      {"type":"Neutral","run_factor":0.99,"k_bb":2.6,"zone":"Average"},
    "Will Little":       {"type":"Neutral","run_factor":1.00,"k_bb":2.6,"zone":"Average"},
    "Lance Barrett":     {"type":"Neutral","run_factor":1.01,"k_bb":2.5,"zone":"Average"},
    "Cory Blaser":       {"type":"Neutral","run_factor":0.99,"k_bb":2.7,"zone":"Average"},
    "Jordan Baker":      {"type":"Neutral","run_factor":1.01,"k_bb":2.5,"zone":"Average"},
    "Alan Porter":       {"type":"Pitcher Friendly","run_factor":0.96,"k_bb":2.8,"zone":"Large"},
    "Chris Conroy":      {"type":"Pitcher Friendly","run_factor":0.97,"k_bb":2.8,"zone":"Large"},
    "D.J. Reyburn":      {"type":"Neutral","run_factor":1.02,"k_bb":2.5,"zone":"Average"},
    "Ryan Blakney":      {"type":"Hitter Friendly","run_factor":1.05,"k_bb":2.4,"zone":"Small"},
    "Tripp Gibson":      {"type":"Pitcher Friendly","run_factor":0.95,"k_bb":3.0,"zone":"Large"},
    "Chad Fairchild":    {"type":"Neutral","run_factor":1.00,"k_bb":2.6,"zone":"Average"},
    "Paul Emmel":        {"type":"Hitter Friendly","run_factor":1.04,"k_bb":2.4,"zone":"Small"},
    "Jerry Layne":       {"type":"Neutral","run_factor":1.01,"k_bb":2.5,"zone":"Average"},
    "Adrian Johnson":    {"type":"Neutral","run_factor":0.98,"k_bb":2.7,"zone":"Average"},
    "Marvin Hudson":     {"type":"Neutral","run_factor":0.99,"k_bb":2.6,"zone":"Average"},
    "Tony Randazzo":     {"type":"Hitter Friendly","run_factor":1.04,"k_bb":2.4,"zone":"Small"},
    "Todd Tichenor":     {"type":"Neutral","run_factor":1.00,"k_bb":2.6,"zone":"Average"},
    "Ed Hickox":         {"type":"Pitcher Friendly","run_factor":0.96,"k_bb":2.9,"zone":"Large"},
    "Gabe Morales":      {"type":"Hitter Friendly","run_factor":1.05,"k_bb":2.4,"zone":"Small"},
}
_NEUTRAL_UMP = {"type":"Neutral / Standard","run_factor":1.00,"k_bb":2.6,"zone":"Average"}

_ENGINE_NAMES = ["Lumber V1", "Rubber V1", "Streak V1", "Elements V1", "Monte V1"]


# ═══════════════════════════════════════════════════════════════════
# 7.  SHARED HELPERS
# ═══════════════════════════════════════════════════════════════════
def _normalize_abbr(team_name, raw_abbr=""):
    if _STADIUM_OK and team_name in MLB_STADIUM_MAP:
        return MLB_STADIUM_MAP[team_name]["abbr"]
    if _ENGINE_OK:
        abbr = _E.ABBR_MAP.get(team_name)
        if abbr:
            return abbr
    if raw_abbr and raw_abbr not in ("???", ""):
        return raw_abbr
    return team_name[:3].upper()


def _utc_to_et(raw_time):
    if not raw_time: return "TBD"
    try:
        dt = datetime.datetime.fromisoformat(raw_time.replace("Z", "+00:00"))
        return (dt - datetime.timedelta(hours=4)).strftime("%I:%M %p")
    except Exception:
        return "TBD"


def _fetch_schedule_games(start_date, end_date, hydrate=""):
    base   = "https://statsapi.mlb.com/api/v1/schedule"
    params = f"sportId=1&startDate={start_date}&endDate={end_date}"
    if hydrate:
        params += f"&hydrate={hydrate}"
    try:
        r = requests.get(f"{base}?{params}", timeout=10).json()
        return [g for d in r.get("dates", []) for g in d.get("games", [])]
    except Exception:
        return []


def _stadium_for(home_team_name):
    return MLB_STADIUM_MAP.get(home_team_name, {}) if _STADIUM_OK else {}


def _get_weather(city, date_str, cf_orientation=180):
    if not _WEATHER_OK or not city or city == "Unknown":
        return None
    try:
        return _get_weather_raw(city, date_str, cf_orientation=cf_orientation)
    except Exception:
        return None


def _atmos_index(temp, wind_speed, wind_dir, park_factor, has_roof):
    if has_roof:
        return round(park_factor, 3)
    t_mod = 1.0 + ((temp - 72.0) * 0.0025)
    w_mod = 1.0
    if wind_speed >= 8.0:
        if wind_dir == "out":  w_mod = 1.0 + wind_speed * 0.005
        elif wind_dir == "in": w_mod = 1.0 - wind_speed * 0.005
    return round(park_factor * t_mod * w_mod, 3)


def _get_bullpen_grade(pitcher_list):
    """Grade a bullpen by how many individual arms are taxed, not the raw aggregate total.
    A single overworked arm no longer drags the whole pen into 'Gassed' territory."""
    tired  = sum(1 for p in pitcher_list if p['pitches'] >= 30)
    gassed = sum(1 for p in pitcher_list if p['pitches'] >= 50)
    if gassed >= 3 or tired >= 5:
        return "Gassed",       "red",    "Multiple arms unavailable — smash opponent OVERS."
    if gassed >= 2 or tired >= 3:
        return "Fatigued",     "orange", "Key setup arms limited — consider fading."
    if gassed >= 1 or tired >= 2:
        return "Moderate",     "yellow", "Some usage — monitor late-game leverage."
    return "Fully Rested",     "green",  "Bullpen well-rested — safe to back ML and Unders."


def _build_bullpen_payload(abbr, bp_pitches, bp_detail):
    """Return a compact bullpen dict suitable for the frontend scorecard panel."""
    arms = bp_detail.get(abbr, [])
    status, color, action = _get_bullpen_grade(arms)
    return {
        "pitches": bp_pitches.get(abbr, 0),
        "status":  status,
        "color":   color,
        "action":  action,
        "arms":    arms[:5],
    }


# ═══════════════════════════════════════════════════════════════════
# 8.  UMPIRE
# ═══════════════════════════════════════════════════════════════════
def get_umpires(date_str: str):
    results = []
    for g in _fetch_schedule_games(date_str, date_str):
        try:
            game_pk   = g["gamePk"]
            away_t    = g["teams"]["away"]["team"].get("name","Unknown")
            home_t    = g["teams"]["home"]["team"].get("name","Unknown")
            away_abbr = _normalize_abbr(away_t, g["teams"]["away"]["team"].get("abbreviation",""))
            home_abbr = _normalize_abbr(home_t, g["teams"]["home"]["team"].get("abbreviation",""))
            game_time = _utc_to_et(g.get("gameDate",""))

            umpire_name = "TBD"
            try:
                feed      = requests.get(
                    f"https://statsapi.mlb.com/api/v1.1/game/{game_pk}/feed/live",
                    timeout=5).json()
                for off in feed.get("liveData",{}).get("boxscore",{}).get("officials",[]):
                    if off.get("officialType") == "Home Plate":
                        umpire_name = off["official"].get("fullName","TBD")
                        break
            except Exception:
                pass

            ud  = UMPIRE_DATABASE.get(umpire_name, _NEUTRAL_UMP)
            rf  = ud["run_factor"]
            action = ("Boost OVERS & Batter Props" if rf > 1.03 else
                      "Boost UNDERS & Pitcher Ks"  if rf < 0.97 else
                      "Neutral Environment")
            results.append({
                "away_abbr": away_abbr, "home_abbr": home_abbr,
                "game_time": game_time, "umpire": umpire_name,
                "tendency": ud["type"], "run_factor": rf,
                "k_bb": ud["k_bb"],     "zone": ud["zone"],
                "action": action,
            })
        except Exception:
            continue
    return results


# ═══════════════════════════════════════════════════════════════════
# 9.  BULLPEN  (per-game boxscore, configurable time range, per-pitcher detail)
# ═══════════════════════════════════════════════════════════════════
def get_bullpen(date_str: str, days: int = 3):
    """
    Fetch bullpen pitch totals over the prior `days` days (1 or 3).
    Returns (games_list, raw_pitch_counts_dict, pitcher_detail_dict).
    pitcher_detail[abbr] = list of {name, pitches} sorted desc.
    """
    days = max(1, min(days, 3))
    today = datetime.datetime.strptime(date_str, "%Y-%m-%d")
    start = (today - datetime.timedelta(days=days)).strftime("%Y-%m-%d")
    end   = (today - datetime.timedelta(days=1)).strftime("%Y-%m-%d")

    bullpen_pitches: dict = {}
    pitcher_detail: dict  = {}   # abbr -> {pid -> {name, pitches, number}}

    for g in _fetch_schedule_games(start, end):
        game_pk = g.get("gamePk")
        if not game_pk:
            continue
        if g.get("status",{}).get("abstractGameState","") not in ("Final","Completed"):
            continue
        try:
            bs = requests.get(
                f"https://statsapi.mlb.com/api/v1/game/{game_pk}/boxscore",
                timeout=8).json()
            for side in ("away","home"):
                t    = bs.get("teams",{}).get(side,{})
                abbr = _normalize_abbr(
                    t.get("team",{}).get("name","Unknown"),
                    t.get("team",{}).get("abbreviation",""))
                if abbr not in bullpen_pitches:
                    bullpen_pitches[abbr] = 0
                if abbr not in pitcher_detail:
                    pitcher_detail[abbr] = {}
                players = t.get("players",{})
                for pid in t.get("pitchers",[])[1:]:
                    p_data  = players.get(f"ID{pid}",{})
                    pitches = p_data.get("stats",{}).get("pitching",{}).get("numberOfPitches", 0)
                    p_name  = p_data.get("person",{}).get("fullName", f"P#{pid}")
                    p_num   = str(p_data.get("jerseyNumber", "") or "").strip()
                    bullpen_pitches[abbr] += pitches
                    if pid not in pitcher_detail[abbr]:
                        pitcher_detail[abbr][pid] = {"name": p_name, "pitches": 0, "number": p_num}
                    pitcher_detail[abbr][pid]["pitches"] += pitches
                    if p_num and not pitcher_detail[abbr][pid]["number"]:
                        pitcher_detail[abbr][pid]["number"] = p_num
        except Exception:
            continue

    # Batch-fetch handedness (pitchHand) for all unique pitcher IDs in one call.
    # The /api/v1/people endpoint supports up to ~100 IDs per request.
    all_pids = set()
    for pid_map in pitcher_detail.values():
        all_pids.update(pid_map.keys())
    pid_meta: dict = {}   # pid -> {throws: str, number: str}
    pid_list = list(all_pids)
    for i in range(0, len(pid_list), 100):
        chunk = pid_list[i:i+100]
        try:
            resp = requests.get(
                f"https://statsapi.mlb.com/api/v1/people?personIds={','.join(str(p) for p in chunk)}",
                timeout=10).json()
            for person in resp.get("people", []):
                pid_meta[person["id"]] = {
                    "throws": person.get("pitchHand", {}).get("code", "?") or "?",
                    "number": str(person.get("primaryNumber", "") or "").strip(),
                }
        except Exception:
            pass

    pitcher_detail_sorted = {
        abbr: sorted(
            [
                {
                    "name":    info["name"],
                    "pitches": info["pitches"],
                    # Prefer boxscore jerseyNumber; fall back to people API primaryNumber
                    "number":  info["number"] or pid_meta.get(pid, {}).get("number", ""),
                    "throws":  pid_meta.get(pid, {}).get("throws", "?"),
                }
                for pid, info in pid_map.items()
            ],
            key=lambda x: x["pitches"], reverse=True
        )
        for abbr, pid_map in pitcher_detail.items()
    }

    results = []
    for g in _fetch_schedule_games(date_str, date_str):
        try:
            away_t    = g["teams"]["away"]["team"].get("name","Unknown")
            home_t    = g["teams"]["home"]["team"].get("name","Unknown")
            away_abbr = _normalize_abbr(away_t, g["teams"]["away"]["team"].get("abbreviation",""))
            home_abbr = _normalize_abbr(home_t, g["teams"]["home"]["team"].get("abbreviation",""))
            game_time = _utc_to_et(g.get("gameDate",""))
            a_p = bullpen_pitches.get(away_abbr, 0)
            h_p = bullpen_pitches.get(home_abbr, 0)
            a_s, a_c, a_a = _get_bullpen_grade(pitcher_detail_sorted.get(away_abbr, []))
            h_s, h_c, h_a = _get_bullpen_grade(pitcher_detail_sorted.get(home_abbr, []))
            results.append({
                "away_abbr": away_abbr, "home_abbr": home_abbr, "game_time": game_time,
                "away_pitches": a_p, "away_status": a_s, "away_color": a_c, "away_action": a_a,
                "away_pitchers": pitcher_detail_sorted.get(away_abbr, []),
                "home_pitches": h_p, "home_status": h_s, "home_color": h_c, "home_action": h_a,
                "home_pitchers": pitcher_detail_sorted.get(home_abbr, []),
            })
        except Exception:
            continue
    return results, bullpen_pitches, pitcher_detail_sorted


# ═══════════════════════════════════════════════════════════════════
# 10.  CLEANUP CREW — real mlb_engine 5-engine consensus
# ═══════════════════════════════════════════════════════════════════
def get_cleanup_crew(date_str: str):
    if not _ENGINE_OK:
        return {"error": f"MLB engine unavailable: {_eng_err_msg}", "games": []}

    games_raw = _fetch_schedule_games(date_str, date_str)
    if not games_raw:
        return {"games": []}

    # Intel: probable pitchers + confirmed batting orders
    intel        = _E.fetch_live_mlb_intel(date_str)
    # Bullpen: use our fixed per-game-boxscore version
    # bp_detail holds per-arm pitch counts for the scorecard bullpen panel
    _, bp_pitches, bp_detail = get_bullpen(date_str)

    results = []
    for g in games_raw:
        try:
            home_t = g["teams"]["home"]["team"]["name"]
            away_t = g["teams"]["away"]["team"]["name"]
            game_dict = {
                "home_team":     home_t,
                "away_team":     away_t,
                "commence_time": g.get("gameDate",""),
            }

            # Live umpire lookup from MLB Stats API (same source as Umpire Radar page)
            live_ump = "TBD"
            try:
                gp = g.get("gamePk")
                if gp:
                    ump_feed = requests.get(
                        f"https://statsapi.mlb.com/api/v1.1/game/{gp}/feed/live",
                        timeout=4).json()
                    for off in ump_feed.get("liveData",{}).get("boxscore",{}).get("officials",[]):
                        if off.get("officialType") == "Home Plate":
                            live_ump = off["official"].get("fullName", "TBD")
                            break
            except Exception:
                pass

            engine_outs = {}
            for eng in _ENGINE_NAMES:
                try:
                    out = _E.run_game_engine(game_dict, eng, intel, bp_pitches, date_str)
                    if out:
                        engine_outs[eng] = out
                except Exception:
                    pass

            if not engine_outs:
                continue

            vals  = list(engine_outs.values())
            avg_total  = round(sum(v["total"]     for v in vals) / len(vals), 2)
            avg_h_win  = sum(v["h_win_prob"] for v in vals) / len(vals)

            ref       = vals[0]
            h_abbr    = ref["h_abbr"]
            a_abbr    = ref["a_abbr"]
            h_intel   = intel.get(h_abbr, {})
            a_intel   = intel.get(a_abbr, {})

            results.append({
                "matchup":        f"{a_abbr} @ {h_abbr}",
                "away_abbr":      a_abbr,
                "home_abbr":      h_abbr,
                "game_time":      _utc_to_et(g.get("gameDate","")),
                "game_date":      g.get("officialDate", g.get("gameDate","")[:10]),
                "venue_name":     g.get("venue", {}).get("name", ""),
                "game_pk":        g.get("gamePk"),
                "h_pitcher":      h_intel.get("p_name","TBD"),
                "a_pitcher":      a_intel.get("p_name","TBD"),
                "h_pitcher_hand": h_intel.get("p_hand",""),
                "a_pitcher_hand": a_intel.get("p_hand",""),
                "h_pitcher_id":   h_intel.get("p_id"),
                "a_pitcher_id":   a_intel.get("p_id"),
                "h_pitcher_number": h_intel.get("p_number",""),
                "a_pitcher_number": a_intel.get("p_number",""),
                "h_pitcher_era":  h_intel.get("p_era","--"),
                "a_pitcher_era":  a_intel.get("p_era","--"),
                "h_manager":      h_intel.get("manager",""),
                "a_manager":      a_intel.get("manager",""),
                "h_lineup":       h_intel.get("players",[]),
                "a_lineup":       a_intel.get("players",[]),
                "h_lineup_status":h_intel.get("lineup","Expected"),
                "a_lineup_status":a_intel.get("lineup","Expected"),
                "consensus_total":avg_total,
                "h_win_pct":      round(avg_h_win * 100, 1),
                "a_win_pct":      round((1 - avg_h_win) * 100, 1),
                "w_display":      ref.get("w_display","N/A"),
                "park_fac":       ref.get("park_fac", 1.0),
                "ump_name":       live_ump,
                "engine_outs": {
                    eng: {
                        "total":     v["total"],
                        "h_win_pct": round(v["h_win_prob"] * 100, 1),
                        "spread":    v.get("spread", 0),
                    }
                    for eng, v in engine_outs.items()
                },
                "a_bullpen": _build_bullpen_payload(a_abbr, bp_pitches, bp_detail),
                "h_bullpen": _build_bullpen_payload(h_abbr, bp_pitches, bp_detail),
            })
        except Exception:
            continue

    return {"games": results}


# ═══════════════════════════════════════════════════════════════════
# 11.  PROP MATRIX  (pure Python — no pandas/numpy dependency)
# ═══════════════════════════════════════════════════════════════════
def _safe_float(val, default=0.0):
    """Convert any value (including percentage strings) to float."""
    if val is None or val == "":
        return default
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip().replace(",", "")
    if s.endswith("%"):
        try:
            return float(s[:-1]) / 100.0
        except ValueError:
            return default
    try:
        return float(s)
    except ValueError:
        return default


def _confidence_stars(rank_pct: float) -> str:
    """Return star rating based on percentile rank (0–1, higher = better)."""
    if rank_pct >= 0.90: return "⭐⭐⭐⭐⭐"
    if rank_pct >= 0.75: return "⭐⭐⭐⭐"
    if rank_pct >= 0.50: return "⭐⭐⭐"
    if rank_pct >= 0.25: return "⭐⭐"
    return "⭐"


def _rank_and_top(rows: list, proj_key: str, n: int = 20) -> list:
    """Sort rows by proj_key, assign percentile confidence stars, return top n."""
    filtered = [r for r in rows if r.get(proj_key, 0) > 0]
    if not filtered:
        return []
    filtered.sort(key=lambda r: r[proj_key])
    total = len(filtered)
    for i, r in enumerate(filtered):
        r["_rank_pct"] = i / max(total - 1, 1)
    filtered.sort(key=lambda r: r[proj_key], reverse=True)
    result = []
    for r in filtered[:n]:
        result.append({
            "player":     r.get("name", r.get("player", "Unknown")),
            "team":       r.get("team", ""),
            "proj":       round(r[proj_key], 2),
            "confidence": _confidence_stars(r["_rank_pct"]),
        })
    return result


def get_prop_matrix():
    PROP_DB = "mlb_prop_database.json"
    if not os.path.exists(PROP_DB):
        return {"status": "no_data", "message": "Prop database not uploaded yet.", "data": {}}

    try:
        with open(PROP_DB) as f:
            raw = json.load(f)
    except Exception as e:
        return {"status": "error", "message": f"Could not read prop database: {e}", "data": {}}

    if not raw:
        return {"status": "no_data", "message": "Prop database is empty.", "data": {}}

    # Normalise column names to lowercase; guard: skip records with no player name
    records = []
    for row in raw:
        r = {k.strip().lower(): v for k, v in row.items()}
        name = str(r.get("name", r.get("player", ""))).strip()
        team = str(r.get("team", "")).strip()
        if not name:
            continue
        r.setdefault("name", name)
        r.setdefault("team", team)
        records.append(r)

    pitchers = [r for r in records if r.get("type","").lower() == "pitcher"]
    batters  = [r for r in records if r.get("type","").lower() == "batter"]

    # ── Pitchers: projected Ks per start ────────────────────────────
    starters_proj = []
    for p in pitchers:
        so = _safe_float(p.get("so") or p.get("k") or p.get("strikeouts"))
        gs = _safe_float(p.get("gs") or p.get("games started")) or 1.0
        if gs < 5:
            continue
        p["Proj_K"] = so / gs
        starters_proj.append(p)

    # ── Batters: multiple category projections ──────────────────────
    batters_proj = []
    for b in batters:
        g   = _safe_float(b.get("g")) or 1.0
        if g < 20:
            continue
        h   = _safe_float(b.get("h"))
        hr  = _safe_float(b.get("hr"))
        r   = _safe_float(b.get("r"))
        rbi = _safe_float(b.get("rbi"))
        slg = _safe_float(b.get("slg"))
        ab  = _safe_float(b.get("ab"))
        tb  = slg * ab if ab > 0 else 0.0
        b["Proj_Hits"] = h   / g
        b["Proj_HR"]   = hr  / g
        b["Proj_R"]    = r   / g
        b["Proj_RBI"]  = rbi / g
        b["Proj_TB"]   = tb  / g
        b["Proj_HRR"]  = b["Proj_Hits"] + b["Proj_R"] + b["Proj_RBI"]
        batters_proj.append(b)

    return {
        "status": "ok",
        "data": {
            "strikeouts":  _rank_and_top(starters_proj, "Proj_K"),
            "home_runs":   _rank_and_top(batters_proj,  "Proj_HR"),
            "total_bases": _rank_and_top(batters_proj,  "Proj_TB"),
            "hits":        _rank_and_top(batters_proj,  "Proj_Hits"),
            "runs":        _rank_and_top(batters_proj,  "Proj_R"),
            "rbi":         _rank_and_top(batters_proj,  "Proj_RBI"),
            "hrr":         _rank_and_top(batters_proj,  "Proj_HRR"),
        },
    }


# ═══════════════════════════════════════════════════════════════════
# 12.  F5 / YRFI
# ═══════════════════════════════════════════════════════════════════
def get_f5_yrfi(date_str: str):
    yrfi_out, f5_out = [], []
    for g in _fetch_schedule_games(date_str, date_str, hydrate="probablePitcher"):
        try:
            away_t    = g["teams"]["away"]["team"].get("name","Unknown")
            home_t    = g["teams"]["home"]["team"].get("name","Unknown")
            away_abbr = _normalize_abbr(away_t, g["teams"]["away"]["team"].get("abbreviation",""))
            home_abbr = _normalize_abbr(home_t, g["teams"]["home"]["team"].get("abbreviation",""))
            game_time = _utc_to_et(g.get("gameDate",""))

            a_sp   = g["teams"]["away"].get("probablePitcher",{}).get("fullName","TBD")
            h_sp   = g["teams"]["home"].get("probablePitcher",{}).get("fullName","TBD")
            a_hand = "LHP" if g["teams"]["away"].get("probablePitcher",{}).get("pitchHand",{}).get("code")=="L" else "RHP"
            h_hand = "LHP" if g["teams"]["home"].get("probablePitcher",{}).get("pitchHand",{}).get("code")=="L" else "RHP"

            stadium  = _stadium_for(home_t)
            city     = stadium.get("city","Unknown")
            has_roof = stadium.get("roof_type","Open") in ("Retractable","Dome")
            park_fac = stadium.get("park_factor",1.0)
            cf_orient= stadium.get("cf_orientation",180)

            wx       = _get_weather(city, date_str, cf_orient)
            temp     = wx["temp"]       if wx else 72
            w_speed  = wx["wind_speed"] if wx else 0
            w_dir    = wx["wind_dir"]   if wx else "neutral"
            atmos    = _atmos_index(temp, w_speed, w_dir, park_fac, has_roof)

            a_rpg = _pure_get_split_rpg(away_abbr, h_hand, False)
            h_rpg = _pure_get_split_rpg(home_abbr, a_hand, True)

            # YRFI Poisson
            base_1st = 0.325
            exp_a = base_1st * (a_rpg / 4.3) * atmos
            exp_h = base_1st * (h_rpg / 4.3) * atmos
            p_nrfi = math.exp(-exp_a) * math.exp(-exp_h)
            p_yrfi = 1.0 - p_nrfi
            target = "YRFI" if p_yrfi > p_nrfi else "NRFI"
            confidence = (("⭐⭐⭐⭐⭐" if p_yrfi >= 0.515 else "⭐⭐⭐⭐" if p_yrfi >= 0.485 else "⭐⭐⭐")
                         if target == "YRFI" else
                         ("⭐⭐⭐⭐⭐" if p_nrfi >= 0.565 else "⭐⭐⭐⭐" if p_nrfi >= 0.535 else "⭐⭐⭐"))

            yrfi_out.append({
                "matchup":   f"{away_abbr} @ {home_abbr}",
                "game_time": game_time,
                "pitching":  f"{a_sp} vs {h_sp}",
                "atmos_idx": atmos,
                "yrfi_pct":  round(p_yrfi * 100, 1),
                "nrfi_pct":  round(p_nrfi * 100, 1),
                "target":    target, "confidence": confidence,
            })

            # F5
            f5r  = 0.52
            a_f5 = (a_rpg * f5r) * atmos
            h_f5 = (h_rpg * f5r) * atmos
            f5_t = round(a_f5 + h_f5, 1)
            fav  = home_abbr if h_f5 > a_f5 else away_abbr

            def _ml(p):
                if p <= 0 or p >= 1: return "N/A"
                return int(round(p/(1-p)*-100)) if p > 0.5 else int(round((1-p)/p*100))

            h_wp = (h_f5**1.65) / (h_f5**1.65 + a_f5**1.65) if (h_f5 + a_f5) > 0 else 0.5
            spread = f"{fav} -{round(abs(h_f5 - a_f5)*2)/2}"
            f5_out.append({
                "matchup":   f"{away_abbr} @ {home_abbr}",
                "game_time": game_time,
                "pitching":  f"{a_sp} vs {h_sp}",
                "f5_total":  f5_t,
                "f5_spread": spread,
                "away_ml":   _ml(1 - h_wp),
                "home_ml":   _ml(h_wp),
                "advantage": fav,
            })
        except Exception:
            continue
    return {"yrfi": yrfi_out, "f5": f5_out}


# ═══════════════════════════════════════════════════════════════════
# 13.  WEATHER & PARK
# ═══════════════════════════════════════════════════════════════════
def get_weather_park(date_str: str):
    results = []
    for g in _fetch_schedule_games(date_str, date_str):
        try:
            away_t    = g["teams"]["away"]["team"].get("name","Unknown")
            home_t    = g["teams"]["home"]["team"].get("name","Unknown")
            away_abbr = _normalize_abbr(away_t, g["teams"]["away"]["team"].get("abbreviation",""))
            home_abbr = _normalize_abbr(home_t, g["teams"]["home"]["team"].get("abbreviation",""))
            game_time = _utc_to_et(g.get("gameDate",""))

            stadium      = _stadium_for(home_t)
            city         = stadium.get("city","Unknown")
            stadium_name = stadium.get("name","Unknown Stadium")
            roof_type    = stadium.get("roof_type","Open")
            park_fac     = stadium.get("park_factor",1.0)
            cf_orient    = stadium.get("cf_orientation",180)
            has_roof     = roof_type in ("Retractable","Dome")

            wx       = _get_weather(city, date_str, cf_orient)
            temp     = wx["temp"]       if wx else 72
            w_speed  = wx["wind_speed"] if wx else 0
            w_dir    = wx["wind_dir"]   if wx else "neutral"
            atmos    = _atmos_index(temp, w_speed, w_dir, park_fac, has_roof)

            results.append({
                "away_abbr": away_abbr, "home_abbr": home_abbr,
                "game_time": game_time, "stadium_name": stadium_name,
                "city": city, "roof_type": roof_type,
                "park_factor": park_fac,
                "temp": temp, "wind_speed": w_speed, "wind_dir": w_dir,
                "has_roof": has_roof,
                "atmos_index": atmos,
                "edge_pct": round((atmos - 1.0) * 100, 1),
            })
        except Exception:
            continue
    return results


def get_mlb_props_for_board() -> list:
    """Read mlb_props_slayer_data.json and return prop plays with edges for the master board."""
    props_file = "mlb_props_slayer_data.json"
    if not os.path.exists(props_file):
        return []
    try:
        with open(props_file) as f:
            raw = json.load(f)
    except Exception:
        return []

    if not raw:
        return []

    OU_MARKETS = {"strikeouts", "hits", "total bases", "home runs", "runs batted in", "walks",
                  "pitcher strikeouts", "hitter strikeouts", "earned runs", "innings pitched",
                  "stolen bases", "singles", "doubles", "hrr"}

    plays = []
    all_edges = []
    for r in raw:
        try:
            market = str(r.get("market", "")).lower().strip()
            if not any(m in market for m in OU_MARKETS) and not market.startswith("o/u"):
                if "over" not in market and "under" not in market and "total" not in market:
                    continue
            proj = float(r.get("proj_mean", 0) or 0)
            line = float(r.get("line", 0) or 0)
            if proj <= 0 or line <= 0:
                continue
            edge = round(proj - line, 2)
            all_edges.append(abs(edge))
        except Exception:
            continue

    if not all_edges:
        return []

    all_edges.sort()
    total = len(all_edges)

    for r in raw:
        try:
            market = str(r.get("market", "")).lower().strip()
            if not any(m in market for m in OU_MARKETS) and not market.startswith("o/u"):
                if "over" not in market and "under" not in market and "total" not in market:
                    continue
            proj = float(r.get("proj_mean", 0) or 0)
            line = float(r.get("line", 0) or 0)
            if proj <= 0 or line <= 0:
                continue
            edge = round(proj - line, 2)
            abs_edge = abs(edge)
            rank_pct = all_edges.index(abs_edge) / max(total - 1, 1)
            stars = _confidence_stars(rank_pct)
            plays.append({
                "player":  r.get("player", "Unknown"),
                "market":  str(r.get("market", "")).replace("_", " ").title(),
                "proj":    round(proj, 1),
                "line":    round(line, 1),
                "edge":    edge,
                "stars":   stars,
            })
        except Exception:
            continue

    return plays
