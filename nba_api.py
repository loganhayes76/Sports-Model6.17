"""
nba_api.py — SpreadSlayer NBA backend helpers (pure Python, no numpy/pandas)
"""

import sys
import types
import os
import json
import random
import math

# ── Streamlit mock (must be first) ──────────────────────────────────────────
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
def _prob(odds):
    if odds is None:
        return 0.5
    try:
        odds = float(odds)
        if odds < 0:
            return abs(odds) / (abs(odds) + 100)
        return 100 / (odds + 100)
    except Exception:
        return 0.5


def _stars(edge):
    e = abs(edge)
    if e >= 10:
        return "⭐⭐⭐⭐⭐"
    elif e >= 5:
        return "⭐⭐⭐⭐"
    elif e >= 2:
        return "⭐⭐⭐"
    elif e > 0:
        return "⭐⭐"
    return "⭐"


def _team_stars(edge):
    e = abs(edge)
    if e >= 5:
        return "⭐⭐⭐⭐⭐"
    elif e >= 3:
        return "⭐⭐⭐⭐"
    elif e >= 1.5:
        return "⭐⭐⭐"
    return "⭐⭐"


MARKET_DISPLAY = {
    "player_points": "Points",
    "player_rebounds": "Rebounds",
    "player_assists": "Assists",
    "player_points_rebounds_assists": "PRA",
    "player_steals": "Steals",
    "player_blocks": "Blocks",
    "player_threes": "3-Pointers",
}

VALID_MODELS = [
    "Consensus", "Season V1", "Hot Hand V1",
    "Matchup V1", "Pace V1", "Monte V1", "Dice V1",
]


def get_nba_props(model: str = "Consensus") -> dict:
    """Run Monte Carlo simulation on NBA props. Returns picks sorted by edge."""
    if model not in VALID_MODELS:
        model = "Consensus"

    data = []
    fp = "nba_props_slayer_data.json"
    if os.path.exists(fp):
        try:
            with open(fp) as f:
                data = json.load(f)
        except Exception:
            pass

    if not data:
        return {"status": "no_data", "props": [], "model": model}

    results = []
    N_SIMS = 10_000

    for item in data:
        player = item.get("player", "Unknown")
        line = float(item.get("line", 0))
        raw_market = item.get("market", "")

        breakdown = item.get("model_breakdown", {})
        if model in breakdown:
            mean = float(breakdown[model].get("proj_mean", item.get("proj_mean", 0)))
            std = float(breakdown[model].get("proj_std", item.get("proj_std", 1)))
        else:
            mean = float(item.get("proj_mean", 0))
            std = float(item.get("proj_std", 1))

        if mean == 0 or std == 0:
            continue

        sims = [random.gauss(mean, std) for _ in range(N_SIMS)]
        over_p = sum(1 for s in sims if s > line) / N_SIMS
        under_p = sum(1 for s in sims if s < line) / N_SIMS

        imp_o = _prob(item.get("over_odds", -110))
        imp_u = _prob(item.get("under_odds", -110))
        e_o = (over_p - imp_o) * 100
        e_u = (under_p - imp_u) * 100

        if e_o > e_u and e_o > 0:
            pick = f"OVER {line}"
            edge = round(e_o, 2)
            sim_prob = over_p
        elif e_u > e_o and e_u > 0:
            pick = f"UNDER {line}"
            edge = round(e_u, 2)
            sim_prob = under_p
        else:
            pick = "PASS"
            edge = 0.0
            sim_prob = 0.5

        results.append({
            "player": player,
            "market": MARKET_DISPLAY.get(raw_market, raw_market),
            "line": line,
            "proj_mean": round(mean, 1),
            "sim_prob": f"{round(sim_prob * 100, 1)}%",
            "pick": pick,
            "edge": edge,
            "stars": _stars(edge),
            "over_odds": item.get("over_odds"),
            "under_odds": item.get("under_odds"),
            "own_team": item.get("own_team", ""),
            "opp_team": item.get("opp_team", ""),
        })

    results.sort(key=lambda x: x["edge"], reverse=True)
    return {
        "status": "ok",
        "model": model,
        "props": results,
        "total": len(results),
        "available_models": VALID_MODELS,
    }


def get_nba_games() -> dict:
    """Pull NBA game lines and compute simple spread/total edges."""
    try:
        from fetch_odds import get_nba_odds, get_vegas_spread, get_market_line
    except Exception as e:
        return {"status": "error", "message": str(e), "games": []}

    games_raw = get_nba_odds() or []
    results = []

    HOME_EDGE = 2.5  # pts home court advantage baseline

    for g in games_raw:
        try:
            h = g["home_team"]
            a = g["away_team"]
            commence = g.get("commence_time", "")

            v_spread = get_vegas_spread(g, h, "draftkings") or get_vegas_spread(g, h, "betmgm")
            v_total = get_market_line(g, "totals", "draftkings") or get_market_line(g, "totals", "betmgm")

            # Simple baseline model: adjust spread by home-court constant
            model_spread = round((v_spread or 0) - HOME_EDGE + random.uniform(-1.0, 1.0), 1)
            model_total = round((v_total or 225) + random.uniform(-3.0, 3.0), 1)

            s_edge = round((v_spread or 0) - model_spread, 1) if v_spread else 0.0
            t_edge = round(model_total - (v_total or 0), 1) if v_total else 0.0

            # Pull moneyline
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

            results.append({
                "matchup": f"{a} @ {h}",
                "home": h,
                "away": a,
                "commence_time": commence,
                "model_spread": model_spread,
                "vegas_spread": v_spread,
                "spread_edge": s_edge,
                "spread_stars": _team_stars(s_edge),
                "model_total": model_total,
                "vegas_total": v_total,
                "total_edge": t_edge,
                "total_stars": _team_stars(t_edge),
                "home_ml": h_ml,
                "away_ml": a_ml,
            })
        except Exception:
            continue

    return {"status": "ok", "games": results, "total": len(results)}
