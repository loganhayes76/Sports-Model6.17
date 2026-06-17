"""
ncaa_api.py — SpreadSlayer NCAA backend helpers (pure Python, no numpy/pandas)
"""

import sys
import types
import os
import csv
import difflib
import math
from datetime import datetime

# ── Streamlit mock ───────────────────────────────────────────────────────────
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


# ── Helpers ──────────────────────────────────────────────────────────────────
def _stars_spread(edge):
    e = abs(edge)
    if e >= 4.0: return "⭐⭐⭐⭐⭐"
    elif e >= 2.5: return "⭐⭐⭐⭐"
    elif e >= 1.5: return "⭐⭐⭐"
    elif e > 0: return "⭐⭐"
    return "⭐"


def _stars_total(edge, sport="bb"):
    e = abs(edge)
    if sport == "bb":
        if e >= 2.0: return "⭐⭐⭐⭐⭐"
        elif e >= 1.0: return "⭐⭐⭐⭐"
        elif e >= 0.5: return "⭐⭐⭐"
        elif e > 0: return "⭐⭐"
        return "⭐"
    else:  # hoops
        if e >= 4.0: return "⭐⭐⭐⭐⭐"
        elif e >= 2.5: return "⭐⭐⭐⭐"
        elif e >= 1.5: return "⭐⭐⭐"
        elif e > 0: return "⭐⭐"
        return "⭐"


def _fmt_time(t):
    if not t:
        return "TBD"
    try:
        import datetime
        dt = datetime.datetime.fromisoformat(t.replace("Z", "+00:00"))
        dt_local = dt - datetime.timedelta(hours=4)
        return dt_local.strftime("%m/%d %I:%M %p")
    except Exception:
        return t


# ── NCAA Baseball ─────────────────────────────────────────────────────────────

def _load_ncaa_stats():
    """Pure-Python load of ncaa_stats.csv → dict keyed by TEAM."""
    path = "ncaa_stats.csv"
    if not os.path.exists(path):
        return {}
    teams = {}
    try:
        with open(path, newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                name = str(row.get("TEAM", "")).strip().lower()
                if name:
                    teams[name] = {
                        "rpg": float(row.get("RPG", 4.2) or 4.2),
                        "era": float(row.get("ERA", 4.5) or 4.5),
                        "elo": float(row.get("ELO", 1500) or 1500),
                        "park_factor": 1.0,
                    }
    except Exception:
        pass
    return teams


# Known mascot suffix list for name normalisation (ESPN → stats DB)
_MASCOT_SUFFIXES = [
    "crimson tide", "tar heels", "demon deacons", "golden bears",
    "yellow jackets", "scarlet knights", "fighting illini", "blue devils",
    "nittany lions", "terrapins", "wolfpack", "horned frogs",
    "golden gophers", "buckeyes", "hoosiers", "wolverines",
    "tigers", "wildcats", "bulldogs", "gators", "seminoles", "cavaliers",
    "cowboys", "bears", "eagles", "hawks", "pirates", "cougars",
    "trojans", "bruins", "rebels", "volunteers", "commodores", "panthers",
    "flyers", "owls", "rams", "lions", "ducks", "huskies", "utes",
    "beavers", "longhorns", "razorbacks", "gamecocks", "aggies",
    "badgers", "boilermakers", "cardinals", "orange", "bearcats",
    "knights", "mountaineers", "sooners", "jayhawks", "spiders",
    "flames", "chanticleers", "warhawks", "red raiders", "musketeers",
    "bobcats", "redhawks", "rockets", "falcons", "broncos", "aztecs",
    "spartans", "wildcats", "cardinals",
]


def _strip_mascot(display_name: str) -> str:
    """'Missouri Tigers' -> 'Missouri'. Returns stripped name or original."""
    low = display_name.lower().strip()
    for m in _MASCOT_SUFFIXES:
        if low.endswith(" " + m):
            return display_name[: -(len(m) + 1)].strip()
    return display_name


def _fuzzy_team(name: str, teams_dict: dict) -> dict | None:
    """Find closest team in stats DB. Handles ESPN full names (e.g. 'Missouri Tigers')."""
    # Try raw name first
    clean = name.lower().strip()
    if clean in teams_dict:
        return teams_dict[clean]
    # Strip mascot and try again
    stripped = _strip_mascot(name).lower().strip()
    if stripped in teams_dict:
        return teams_dict[stripped]
    # Partial substring match on stripped
    for k, v in teams_dict.items():
        if k in stripped or stripped in k:
            return v
    # Partial on original
    for k, v in teams_dict.items():
        if k in clean or clean in k:
            return v
    # Fuzzy on stripped
    matches = difflib.get_close_matches(stripped, list(teams_dict.keys()), n=1, cutoff=0.55)
    if matches:
        return teams_dict[matches[0]]
    return None


def _calc_proj_runs(base_avg, park_factor=1.0, temp=72, wind_speed=5, wind_dir="neutral"):
    """Replicate model.calculate_projected_run_total in pure Python."""
    proj = base_avg * park_factor
    temp_adj = 1 + ((temp - 70) * 0.0033)
    proj *= temp_adj
    if wind_dir == "out":
        proj *= (1 + (wind_speed * 0.01))
    elif wind_dir == "in":
        proj *= (1 - (wind_speed * 0.01))
    return round(proj, 2)


def _load_odds_cache_raw() -> list:
    """Load the raw Odds API cache for baseball_ncaa without triggering a live fetch."""
    import json as _json
    path = "odds_cache_baseball_ncaa.json"
    if not os.path.exists(path):
        return []
    try:
        with open(path) as f:
            data = _json.load(f)
        return data if isinstance(data, list) else []
    except Exception:
        return []


def _match_odds_game(h_name: str, a_name: str, odds_cache: list,
                     game_date: str | None = None) -> dict | None:
    """Find the best-matching odds game for a given ESPN home/away name pair.

    Scoring (max 5 pts):
      +2  exact home team substring match
      +1  home team fuzzy >=0.70
      +2  exact away team substring match
      +1  away team fuzzy >=0.70
      +1  date matches today's game date (bonus to disambiguate series games)
    Threshold: >= 3 pts to be accepted.
    """
    h_clean  = _strip_mascot(h_name).lower()
    a_clean  = _strip_mascot(a_name).lower()
    today    = game_date or datetime.utcnow().strftime("%Y-%m-%d")
    best     = None
    best_score = 0

    for g in odds_cache:
        oh = g.get("home_team", "").lower()
        oa = g.get("away_team", "").lower()
        score = 0
        if h_clean in oh or oh in h_clean: score += 2
        elif difflib.SequenceMatcher(None, h_clean, oh).ratio() > 0.70: score += 1
        if a_clean in oa or oa in a_clean: score += 2
        elif difflib.SequenceMatcher(None, a_clean, oa).ratio() > 0.70: score += 1
        # Date proximity bonus: prefer cache entries whose commence_time matches today
        ct = g.get("commence_time", "")
        if today in ct:
            score += 1
        if score > best_score:
            best_score = score
            best = g

    return best if best_score >= 3 else None


def get_ncaa_baseball() -> dict:
    """Run NCAA baseball model. Primary source: ESPN schedule. Odds layered from cache."""
    try:
        from espn_ncaa_baseball import get_espn_games
    except Exception as e:
        return {"status": "error", "message": f"ESPN fetcher unavailable: {e}", "games": []}

    espn_games = get_espn_games() or []
    stats      = _load_ncaa_stats()
    odds_cache = _load_odds_cache_raw()
    results    = []

    def _ml_fmt_bb(ml):
        if ml is None: return "N/A"
        return f"+{int(ml)}" if ml > 0 else str(int(ml))

    bb_exp = 1.83

    def _prob_to_ml_bb(p):
        if p <= 0 or p >= 1: return "N/A"
        if p > 0.5: return int(round((p / (1 - p)) * -100))
        return int(round(((1 - p) / p) * 100))

    for g in espn_games:
        try:
            h = g["home"]
            a = g["away"]

            h_s = _fuzzy_team(h, stats)
            a_s = _fuzzy_team(a, stats)

            has_stats = h_s is not None and a_s is not None
            if not h_s:
                h_s = {"rpg": 4.2, "era": 4.5, "elo": 1500, "park_factor": 1.0}
            if not a_s:
                a_s = {"rpg": 4.2, "era": 4.5, "elo": 1500, "park_factor": 1.0}

            elo_diff = (h_s["elo"] - a_s["elo"]) / 200
            h_base = ((h_s["rpg"] + a_s["era"]) / 2) + elo_diff
            a_base = ((a_s["rpg"] + h_s["era"]) / 2) - elo_diff

            h_p = _calc_proj_runs(h_base, h_s.get("park_factor", 1.0))
            a_p = _calc_proj_runs(a_base, a_s.get("park_factor", 1.0))
            model_total  = round(h_p + a_p, 2) if has_stats else None
            model_spread = round(a_p - h_p, 1) if has_stats else None

            # Win probability (Pythagorean, baseball exponent 1.83)
            h_win_prob = (h_p ** bb_exp) / (h_p ** bb_exp + a_p ** bb_exp) if (h_p + a_p) > 0 else 0.5

            # ── Odds overlay from cache ───────────────────────────────────────
            v_total = None
            v_spread = None
            h_ml = None
            a_ml = None

            game_date = g.get("commence_time", "")[:10] or None
            odds_game = _match_odds_game(h, a, odds_cache, game_date) if odds_cache else None
            if odds_game:
                for book in odds_game.get("bookmakers", []):
                    for mkt in book.get("markets", []):
                        if mkt["key"] == "totals" and v_total is None:
                            for out in mkt.get("outcomes", []):
                                if out.get("name", "").lower() == "over":
                                    v_total = out.get("point")
                        if mkt["key"] == "spreads" and v_spread is None:
                            oh_name = odds_game.get("home_team", "")
                            for out in mkt.get("outcomes", []):
                                if out.get("name", "") == oh_name and v_spread is None:
                                    v_spread = out.get("point")
                        if mkt["key"] == "h2h":
                            oh_name = odds_game.get("home_team", "")
                            oa_name = odds_game.get("away_team", "")
                            for out in mkt.get("outcomes", []):
                                oname = out.get("name", "")
                                if (oname == oh_name or _strip_mascot(oname).lower() in h.lower()) and h_ml is None:
                                    h_ml = out.get("price")
                                if (oname == oa_name or _strip_mascot(oname).lower() in a.lower()) and a_ml is None:
                                    a_ml = out.get("price")

            # Only compute model-derived edges when both teams have stats coverage
            if has_stats:
                total_edge  = round(model_total - v_total, 2) if (model_total and v_total) else 0.0
                spread_edge = round(v_spread - model_spread, 1) if (v_spread is not None and model_spread is not None) else 0.0
            else:
                total_edge  = 0.0
                spread_edge = 0.0

            results.append({
                "matchup":      f"{a} @ {h}",
                "home":         h,
                "away":         a,
                "commence_time": _fmt_time(g.get("commence_time", "")),
                "status":       g.get("status", "scheduled"),
                "inning":       g.get("inning"),
                "home_score":   g.get("home_score"),
                "away_score":   g.get("away_score"),
                "rank_home":    g.get("rank_home"),
                "rank_away":    g.get("rank_away"),
                "conference":   g.get("conference", ""),
                "venue":        g.get("venue", ""),
                "has_stats":    has_stats,
                "model_total":  model_total,
                "vegas_total":  v_total,
                "total_edge":   total_edge,
                "total_stars":  _stars_total(total_edge, "bb") if has_stats else None,
                "model_spread": model_spread,
                "vegas_spread": v_spread,
                "spread_edge":  spread_edge,
                "spread_stars": _stars_spread(spread_edge) if has_stats else None,
                "h_proj":       h_p if has_stats else None,
                "a_proj":       a_p if has_stats else None,
                "h_win_prob":   f"{round(h_win_prob * 100, 1)}%" if has_stats else "N/A",
                "a_win_prob":   f"{round((1 - h_win_prob) * 100, 1)}%" if has_stats else "N/A",
                "vegas_h_ml":   _ml_fmt_bb(h_ml),
                "vegas_a_ml":   _ml_fmt_bb(a_ml),
                "model_h_ml":   _ml_fmt_bb(_prob_to_ml_bb(h_win_prob)) if has_stats else "N/A",
                "model_a_ml":   _ml_fmt_bb(_prob_to_ml_bb(1 - h_win_prob)) if has_stats else "N/A",
                "h_base":       round(h_base, 4),
                "a_base":       round(a_base, 4),
                "h_park":       h_s.get("park_factor", 1.0),
                "a_park":       a_s.get("park_factor", 1.0),
            })
        except Exception:
            continue

    # Sort: in-progress first, then by abs total edge desc
    results.sort(key=lambda x: (
        0 if x.get("status") == "in_progress" else 1,
        -abs(x.get("total_edge") or 0),
    ))
    return {"status": "ok", "games": results, "total": len(results)}


# ── NCAA Hoops ────────────────────────────────────────────────────────────────

TEAM_DICT = {
    "uconn": "connecticut",
    "miami (fl)": "miami fl",
    "miami (oh)": "miami oh",
    "ole miss": "mississippi",
    "saint mary's": "st mary's",
    "saint joseph's": "st joseph's",
    "saint louis": "st louis",
    "st. john's": "st john's",
    "hawai'i": "hawaii",
}


def _clean_hoops_name(name: str) -> str:
    n = name.lower().strip()
    for k, v in TEAM_DICT.items():
        if k in n:
            return v
    n = n.replace(" state ", " st ").replace(" state", " st").replace(".", "")
    return n


def _load_torvik() -> tuple[dict, float, float]:
    """Load torvik_stats.csv → (teams_dict, avg_efficiency, avg_tempo)."""
    path = "torvik_stats.csv"
    teams = {}
    if not os.path.exists(path):
        return teams, 105.0, 68.0

    try:
        with open(path, newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                name = str(row.get("TEAM", "")).strip()
                if name:
                    teams[name.lower()] = {
                        "raw_name": name,
                        "adj_o": float(row.get("AdjOE", 105.0) or 105.0),
                        "adj_d": float(row.get("AdjDE", 105.0) or 105.0),
                        "tempo": float(row.get("Tempo", 68.0) or 68.0),
                    }
    except Exception:
        pass

    if teams:
        all_vals = list(teams.values())
        avg_eff = sum(t["adj_o"] for t in all_vals) / len(all_vals)
        avg_tempo = sum(t["tempo"] for t in all_vals) / len(all_vals)
    else:
        avg_eff, avg_tempo = 105.0, 68.0

    return teams, avg_eff, avg_tempo


def _fuzzy_hoops(name: str, teams: dict) -> dict | None:
    clean = _clean_hoops_name(name)
    if clean in teams:
        return teams[clean]
    for k, v in teams.items():
        if k in clean or clean in k:
            return v
    matches = difflib.get_close_matches(clean, list(teams.keys()), n=1, cutoff=0.55)
    if matches:
        return teams[matches[0]]
    return None


def get_ncaa_hoops() -> dict:
    """Run NCAA hoops tempo model. Returns spread/total edges sorted by magnitude."""
    import datetime
    try:
        from fetch_odds import get_ncaab_odds, get_vegas_spread, get_market_line
    except Exception as e:
        return {"status": "error", "message": str(e), "games": []}

    games_raw = get_ncaab_odds() or []
    teams, avg_eff, avg_tempo = _load_torvik()
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    results = []

    for g in games_raw:
        try:
            # Skip games that have already started or finished
            ct = g.get("commence_time", "")
            if ct:
                try:
                    dt = datetime.datetime.fromisoformat(ct.replace("Z", "+00:00"))
                    if dt <= now_utc:
                        continue
                except Exception:
                    pass
            h, a = g["home_team"], g["away_team"]
            h_s = _fuzzy_hoops(h, teams)
            a_s = _fuzzy_hoops(a, teams)

            if not h_s:
                h_s = {"adj_o": 105.0, "adj_d": 105.0, "tempo": 68.0}
            if not a_s:
                a_s = {"adj_o": 105.0, "adj_d": 105.0, "tempo": 68.0}

            tempo = (h_s["tempo"] * a_s["tempo"]) / avg_tempo
            h_p = (h_s["adj_o"] * a_s["adj_d"] / avg_eff / 100) * tempo
            a_p = (a_s["adj_o"] * h_s["adj_d"] / avg_eff / 100) * tempo

            model_spread = round(a_p - h_p, 1)
            model_total = round(h_p + a_p, 1)

            # Win probability (Pythagorean formula)
            exp = 11.5
            h_win_prob = (h_p ** exp) / (h_p ** exp + a_p ** exp) if (h_p + a_p) > 0 else 0.5

            v_spread = get_vegas_spread(g, h, "draftkings") or get_vegas_spread(g, h, "betmgm")
            v_total = get_market_line(g, "totals", "draftkings") or get_market_line(g, "totals", "betmgm")

            spread_edge = round((v_spread or 0) - model_spread, 1) if v_spread else 0.0
            total_edge = round(model_total - (v_total or 0), 1) if v_total else 0.0

            # Moneyline
            h_ml, a_ml = None, None
            for book in g.get("bookmakers", []):
                for mkt in book.get("markets", []):
                    if mkt["key"] == "h2h":
                        for out in mkt.get("outcomes", []):
                            if out["name"] == h and h_ml is None:
                                h_ml = out.get("price")
                            if out["name"] == a and a_ml is None:
                                a_ml = out.get("price")
                if h_ml and a_ml:
                    break

            def _ml_fmt(ml):
                if ml is None: return "N/A"
                return f"+{int(ml)}" if ml > 0 else str(int(ml))

            def _prob_to_ml(p):
                if p <= 0 or p >= 1: return "N/A"
                if p > 0.5: return int(round((p / (1 - p)) * -100))
                return int(round(((1 - p) / p) * 100))

            results.append({
                "matchup": f"{a} @ {h}",
                "home": h,
                "away": a,
                "commence_time": _fmt_time(g.get("commence_time", "")),
                "model_spread": model_spread,
                "vegas_spread": v_spread,
                "spread_edge": spread_edge,
                "spread_stars": _stars_spread(spread_edge),
                "model_total": model_total,
                "vegas_total": v_total,
                "total_edge": total_edge,
                "total_stars": _stars_total(total_edge, "hoops"),
                "h_proj": round(h_p, 1),
                "a_proj": round(a_p, 1),
                "h_win_prob": f"{round(h_win_prob * 100, 1)}%",
                "a_win_prob": f"{round((1 - h_win_prob) * 100, 1)}%",
                "model_h_ml": _ml_fmt(_prob_to_ml(h_win_prob)),
                "model_a_ml": _ml_fmt(_prob_to_ml(1 - h_win_prob)),
                "vegas_h_ml": _ml_fmt(h_ml),
                "vegas_a_ml": _ml_fmt(a_ml),
            })
        except Exception:
            continue

    results.sort(key=lambda x: abs(x["total_edge"]), reverse=True)
    return {"status": "ok", "games": results, "total": len(results)}
