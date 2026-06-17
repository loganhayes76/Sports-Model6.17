"""
dfs_api.py — SpreadSlayer DFS optimizer backend (pure Python + pulp)

All sports: MLB, NBA, UFC/MMA, PGA, NASCAR
Salary-cap linear programming via pulp (CBC solver — no C extensions needed).
"""

import csv
import io
import json
import os
import random
import difflib


def _parse_csv(csv_text: str) -> list[dict]:
    """Parse CSV string into list of row dicts."""
    reader = csv.DictReader(io.StringIO(csv_text))
    return [dict(row) for row in reader]


def _salary(row: dict) -> float:
    try:
        return float(str(row.get("Salary", 0)).replace(",", "") or 0)
    except Exception:
        return 0.0


def _avg_pts(row: dict) -> float:
    try:
        return float(row.get("AvgPointsPerGame", 0) or 0)
    except Exception:
        return 0.0


def _primary_pos(row: dict) -> str:
    pos = str(row.get("Position", "")).strip()
    first = pos.split("/")[0]
    if "P" in first:
        return "P"
    return first


# ── MLB Optimizer ────────────────────────────────────────────────────────────

def optimize_mlb(
    csv_text: str,
    locks: list[str] = None,
    scratches: list[str] = None,
    num_lineups: int = 10,
    mode: str = "cash",       # "cash" | "gpp"
    stack_team: str = "",
    stack_size: int = 0,
) -> dict:
    import pulp

    locks = [l.strip() for l in (locks or [])]
    scratches = [s.strip() for s in (scratches or [])]

    # Load optional props data for projection blending
    mlb_prop_data = []
    if os.path.exists("mlb_props_slayer_data.json"):
        try:
            with open("mlb_props_slayer_data.json") as f:
                mlb_prop_data = json.load(f)
        except Exception:
            pass

    player_vegas = {}
    for item in mlb_prop_data:
        pn = str(item.get("player", "")).lower()
        mkt = item.get("market", "")
        mean = float(item.get("proj_mean", 0) or 0)
        if pn not in player_vegas:
            player_vegas[pn] = {"h": 0, "r": 0, "rbi": 0, "hr": 0, "k": 0}
        if mkt == "player_hits":           player_vegas[pn]["h"] = mean
        elif mkt == "player_runs":         player_vegas[pn]["r"] = mean
        elif mkt == "player_rbis":         player_vegas[pn]["rbi"] = mean
        elif mkt == "player_home_runs":    player_vegas[pn]["hr"] = mean
        elif mkt == "pitcher_strikeouts":  player_vegas[pn]["k"] = mean

    rows = _parse_csv(csv_text)
    if not rows:
        return {"status": "error", "message": "No players found in CSV", "lineups": []}

    # Remove scratches & injuries
    rows = [r for r in rows if r.get("Name", "") not in scratches]
    if "Injury Indicator" in rows[0]:
        rows = [r for r in rows if r.get("Injury Indicator", "") not in ("O", "IR", "IL", "Out")]

    # Add Primary_Pos and projections
    processed = []
    for r in rows:
        name = str(r.get("Name", "")).strip()
        sal = _salary(r)
        if sal <= 0:
            continue
        base_avg = _avg_pts(r) or (sal / 1000) * 1.5
        pname_lower = name.lower()

        matched = player_vegas.get(pname_lower)
        if not matched:
            cl = difflib.get_close_matches(pname_lower, list(player_vegas.keys()), n=1, cutoff=0.80)
            if cl:
                matched = player_vegas[cl[0]]

        pos = _primary_pos(r)
        if matched and (matched["h"] > 0 or matched["k"] > 0):
            if pos == "P":
                vegas_pts = (matched["k"] * 2.0) + (5.5 * 2.25) + 2.0
            else:
                vegas_pts = ((matched["h"] * 3) + (matched["r"] * 2) + (matched["rbi"] * 2) + (matched["hr"] * 10)) * 0.8
            cash_proj = (vegas_pts * 0.70) + (base_avg * 0.30)
            source = "Vegas Props"
        else:
            cash_proj = base_avg
            source = "Base DK"

        gpp_proj = cash_proj * (1 + random.uniform(0.2, 0.6))
        proj = cash_proj if mode == "cash" else gpp_proj

        processed.append({
            "name": name,
            "salary": sal,
            "pos": pos,
            "team": str(r.get("TeamAbbrev", "")).strip(),
            "proj": proj,
            "cash_proj": cash_proj,
            "gpp_proj": gpp_proj,
            "source": source,
        })

    if len(processed) < 10:
        return {"status": "error", "message": f"Only {len(processed)} valid players — need at least 10", "lineups": []}

    # Group by position
    pos_idx = {pos: [] for pos in ("P", "C", "1B", "2B", "3B", "SS", "OF")}
    for i, p in enumerate(processed):
        pos = p["pos"]
        if pos in pos_idx:
            pos_idx[pos].append(i)

    needed_positions = ("P", "C", "1B", "2B", "3B", "SS", "OF")
    for pos in needed_positions:
        if pos == "OF":
            if len(pos_idx[pos]) < 3:
                return {"status": "error", "message": f"Not enough {pos} players ({len(pos_idx[pos])} found, need 3)", "lineups": []}
        elif pos == "P":
            if len(pos_idx[pos]) < 2:
                return {"status": "error", "message": f"Not enough P players ({len(pos_idx[pos])} found, need 2)", "lineups": []}
        else:
            if len(pos_idx[pos]) < 1:
                return {"status": "error", "message": f"Not enough {pos} players ({len(pos_idx[pos])} found, need 1)", "lineups": []}

    # Build LP model
    prob = pulp.LpProblem("MLB_DFS", pulp.LpMaximize)
    n = len(processed)
    player_vars = pulp.LpVariable.dicts("P", range(n), cat="Binary")

    prob += pulp.lpSum(processed[i]["proj"] * player_vars[i] for i in range(n))
    prob += pulp.lpSum(player_vars[i] for i in range(n)) == 10
    prob += pulp.lpSum(processed[i]["salary"] * player_vars[i] for i in range(n)) <= 50000

    prob += pulp.lpSum(player_vars[i] for i in pos_idx["P"]) == 2
    prob += pulp.lpSum(player_vars[i] for i in pos_idx["C"]) == 1
    prob += pulp.lpSum(player_vars[i] for i in pos_idx["1B"]) == 1
    prob += pulp.lpSum(player_vars[i] for i in pos_idx["2B"]) == 1
    prob += pulp.lpSum(player_vars[i] for i in pos_idx["3B"]) == 1
    prob += pulp.lpSum(player_vars[i] for i in pos_idx["SS"]) == 1
    prob += pulp.lpSum(player_vars[i] for i in pos_idx["OF"]) == 3

    # Locks
    for name in locks:
        idx_list = [i for i, p in enumerate(processed) if p["name"] == name]
        if idx_list:
            prob += player_vars[idx_list[0]] == 1

    # Team stack
    if stack_team and stack_size > 0:
        prob += pulp.lpSum(
            player_vars[i] for i, p in enumerate(processed)
            if p["team"] == stack_team and p["pos"] != "P"
        ) >= stack_size

    lineups = []
    for _ in range(num_lineups):
        result = prob.solve(pulp.PULP_CBC_CMD(msg=False))
        if pulp.LpStatus[prob.status] != "Optimal":
            break
        selected = [i for i in range(n) if (player_vars[i].varValue or 0) >= 0.9]
        if len(selected) != 10:
            break
        lineup = [processed[i] for i in selected]
        lineups.append({
            "players": sorted(lineup, key=lambda x: x["pos"]),
            "total_salary": int(sum(p["salary"] for p in lineup)),
            "total_proj": round(sum(p["proj"] for p in lineup), 2),
        })
        prob += pulp.lpSum(player_vars[i] for i in selected) <= 9

    return {
        "status": "ok",
        "sport": "MLB",
        "mode": mode,
        "lineups": lineups,
        "total_lineups": len(lineups),
        "roster": [{
            "name": p["name"], "pos": p["pos"], "team": p["team"],
            "salary": int(p["salary"]), "proj": round(p["proj"], 2),
            "source": p["source"],
        } for p in sorted(processed, key=lambda x: -x["proj"])],
    }


# ── MMA/UFC Optimizer ─────────────────────────────────────────────────────────

def optimize_mma(
    csv_text: str,
    locks: list[str] = None,
    scratches: list[str] = None,
    num_lineups: int = 10,
    mode: str = "cash",
) -> dict:
    import pulp

    locks = [l.strip() for l in (locks or [])]
    scratches = [s.strip() for s in (scratches or [])]

    rows = _parse_csv(csv_text)
    if not rows:
        return {"status": "error", "message": "No fighters found in CSV", "lineups": []}

    rows = [r for r in rows if r.get("Name", "") not in scratches]
    if rows and "Injury Indicator" in rows[0]:
        rows = [r for r in rows if r.get("Injury Indicator", "") not in ("O", "WD", "Out")]

    processed = []
    for r in rows:
        name = str(r.get("Name", "")).strip()
        sal = _salary(r)
        if sal <= 0:
            continue
        base = _avg_pts(r) or (sal / 1000) * 8.5
        gpp = base * (1 + random.uniform(0.1, 0.5))
        proj = base if mode == "cash" else gpp
        processed.append({"name": name, "salary": sal, "proj": proj, "base": base, "gpp": gpp})

    if len(processed) < 6:
        return {"status": "error", "message": f"Need at least 6 fighters (found {len(processed)})", "lineups": []}

    prob = pulp.LpProblem("MMA_DFS", pulp.LpMaximize)
    n = len(processed)
    pv = pulp.LpVariable.dicts("F", range(n), cat="Binary")

    prob += pulp.lpSum(processed[i]["proj"] * pv[i] for i in range(n))
    prob += pulp.lpSum(pv[i] for i in range(n)) == 6
    prob += pulp.lpSum(processed[i]["salary"] * pv[i] for i in range(n)) <= 50000

    for name in locks:
        idx_list = [i for i, p in enumerate(processed) if p["name"] == name]
        if idx_list:
            prob += pv[idx_list[0]] == 1

    lineups = []
    for _ in range(num_lineups):
        prob.solve(pulp.PULP_CBC_CMD(msg=False))
        if pulp.LpStatus[prob.status] != "Optimal":
            break
        selected = [i for i in range(n) if (pv[i].varValue or 0) >= 0.9]
        if len(selected) != 6:
            break
        lineup = [processed[i] for i in selected]
        lineups.append({
            "players": lineup,
            "total_salary": int(sum(p["salary"] for p in lineup)),
            "total_proj": round(sum(p["proj"] for p in lineup), 2),
        })
        prob += pulp.lpSum(pv[i] for i in selected) <= 5

    return {
        "status": "ok", "sport": "UFC", "mode": mode,
        "lineups": lineups, "total_lineups": len(lineups),
        "roster": [{"name": p["name"], "salary": int(p["salary"]), "proj": round(p["proj"], 2)} for p in sorted(processed, key=lambda x: -x["proj"])],
    }


# ── PGA Optimizer ─────────────────────────────────────────────────────────────

def optimize_pga(
    csv_text: str,
    locks: list[str] = None,
    scratches: list[str] = None,
    num_lineups: int = 10,
    mode: str = "cash",
) -> dict:
    import pulp

    locks = [l.strip() for l in (locks or [])]
    scratches = [s.strip() for s in (scratches or [])]

    # Load PGA odds for projection blend
    pga_data = {}
    if os.path.exists("pga_odds_data.json"):
        try:
            with open("pga_odds_data.json") as f:
                raw = json.load(f)
            if isinstance(raw, list):
                for item in raw:
                    n = str(item.get("name", item.get("player", ""))).lower().strip()
                    if n:
                        pga_data[n] = item
        except Exception:
            pass

    rows = _parse_csv(csv_text)
    if not rows:
        return {"status": "error", "message": "No golfers found in CSV", "lineups": []}

    rows = [r for r in rows if r.get("Name", "") not in scratches]
    if rows and "Injury Indicator" in rows[0]:
        rows = [r for r in rows if r.get("Injury Indicator", "") not in ("O", "WD", "Out")]

    processed = []
    for r in rows:
        name = str(r.get("Name", "")).strip()
        sal = _salary(r)
        if sal <= 0:
            continue
        base = _avg_pts(r) or (sal / 1000) * 4.0
        # Blend with odds-implied value if available
        pga_match = pga_data.get(name.lower())
        if pga_match:
            odds_val = float(pga_match.get("value_score", pga_match.get("proj", base)) or base)
            base = (base * 0.6) + (odds_val * 0.4)

        gpp = base * (1 + random.uniform(0.2, 0.8))
        proj = base if mode == "cash" else gpp
        processed.append({"name": name, "salary": sal, "proj": proj, "gpp": gpp})

    if len(processed) < 6:
        return {"status": "error", "message": f"Need at least 6 golfers (found {len(processed)})", "lineups": []}

    prob = pulp.LpProblem("PGA_DFS", pulp.LpMaximize)
    n = len(processed)
    pv = pulp.LpVariable.dicts("G", range(n), cat="Binary")

    prob += pulp.lpSum(processed[i]["proj"] * pv[i] for i in range(n))
    prob += pulp.lpSum(pv[i] for i in range(n)) == 6
    prob += pulp.lpSum(processed[i]["salary"] * pv[i] for i in range(n)) <= 50000

    for name in locks:
        idx_list = [i for i, p in enumerate(processed) if p["name"] == name]
        if idx_list:
            prob += pv[idx_list[0]] == 1

    lineups = []
    for _ in range(num_lineups):
        prob.solve(pulp.PULP_CBC_CMD(msg=False))
        if pulp.LpStatus[prob.status] != "Optimal":
            break
        selected = [i for i in range(n) if (pv[i].varValue or 0) >= 0.9]
        if len(selected) != 6:
            break
        lineup = [processed[i] for i in selected]
        lineups.append({
            "players": lineup,
            "total_salary": int(sum(p["salary"] for p in lineup)),
            "total_proj": round(sum(p["proj"] for p in lineup), 2),
        })
        prob += pulp.lpSum(pv[i] for i in selected) <= 5

    return {
        "status": "ok", "sport": "PGA", "mode": mode,
        "lineups": lineups, "total_lineups": len(lineups),
        "roster": [{"name": p["name"], "salary": int(p["salary"]), "proj": round(p["proj"], 2)} for p in sorted(processed, key=lambda x: -x["proj"])],
    }


# ── NBA DFS Optimizer ─────────────────────────────────────────────────────────

def optimize_nba(
    csv_text: str,
    locks: list[str] = None,
    scratches: list[str] = None,
    num_lineups: int = 10,
    mode: str = "cash",
) -> dict:
    """NBA DFS — DraftKings format: PG, SG, SF, PF, C, G, F, UTIL = 8 players."""
    import pulp

    locks = [l.strip() for l in (locks or [])]
    scratches = [s.strip() for s in (scratches or [])]

    rows = _parse_csv(csv_text)
    if not rows:
        return {"status": "error", "message": "No players found in CSV", "lineups": []}

    rows = [r for r in rows if r.get("Name", "") not in scratches]
    if rows and "Injury Indicator" in rows[0]:
        rows = [r for r in rows if r.get("Injury Indicator", "") not in ("O", "IR", "IL", "Out")]

    # Load NBA props for blending
    nba_props = {}
    if os.path.exists("nba_props_slayer_data.json"):
        try:
            with open("nba_props_slayer_data.json") as f:
                raw = json.load(f)
            for item in raw:
                pn = str(item.get("player", "")).lower().strip()
                if pn:
                    mean = float(item.get("proj_mean", 0) or 0)
                    if pn not in nba_props or mean > nba_props[pn]:
                        nba_props[pn] = mean
        except Exception:
            pass

    processed = []
    for r in rows:
        name = str(r.get("Name", "")).strip()
        sal = _salary(r)
        if sal <= 0:
            continue
        pos_raw = str(r.get("Position", "")).strip()
        base = _avg_pts(r) or (sal / 1000) * 5.0

        # Blend with NBA props
        pn = name.lower()
        if pn in nba_props and nba_props[pn] > 0:
            # Convert proj_mean (points) to rough DK points
            implied_dk = nba_props[pn] * 1.0
            base = (base * 0.5) + (implied_dk * 0.5)

        gpp = base * (1 + random.uniform(0.15, 0.5))
        proj = base if mode == "cash" else gpp
        processed.append({
            "name": name, "salary": sal, "pos_raw": pos_raw,
            "proj": proj, "gpp": gpp,
        })

    if len(processed) < 8:
        return {"status": "error", "message": f"Need at least 8 players (found {len(processed)})", "lineups": []}

    # DK NBA: PG, SG, SF, PF, C, G (PG/SG), F (SF/PF), UTIL (any)
    def _has(pos, allowed):
        return any(p.strip() in allowed for p in pos.split("/"))

    is_pg = [_has(p["pos_raw"], {"PG"}) for p in processed]
    is_sg = [_has(p["pos_raw"], {"SG"}) for p in processed]
    is_sf = [_has(p["pos_raw"], {"SF"}) for p in processed]
    is_pf = [_has(p["pos_raw"], {"PF"}) for p in processed]
    is_c  = [_has(p["pos_raw"], {"C"})  for p in processed]
    is_g  = [_has(p["pos_raw"], {"PG", "SG"}) for p in processed]
    is_f  = [_has(p["pos_raw"], {"SF", "PF"}) for p in processed]

    prob = pulp.LpProblem("NBA_DFS", pulp.LpMaximize)
    n = len(processed)
    pv = pulp.LpVariable.dicts("P", range(n), cat="Binary")

    prob += pulp.lpSum(processed[i]["proj"] * pv[i] for i in range(n))
    prob += pulp.lpSum(pv[i] for i in range(n)) == 8
    prob += pulp.lpSum(processed[i]["salary"] * pv[i] for i in range(n)) <= 50000

    prob += pulp.lpSum(pv[i] for i in range(n) if is_pg[i]) >= 1
    prob += pulp.lpSum(pv[i] for i in range(n) if is_sg[i]) >= 1
    prob += pulp.lpSum(pv[i] for i in range(n) if is_sf[i]) >= 1
    prob += pulp.lpSum(pv[i] for i in range(n) if is_pf[i]) >= 1
    prob += pulp.lpSum(pv[i] for i in range(n) if is_c[i]) >= 1
    prob += pulp.lpSum(pv[i] for i in range(n) if is_g[i]) >= 2
    prob += pulp.lpSum(pv[i] for i in range(n) if is_f[i]) >= 2

    for name in locks:
        idx_list = [i for i, p in enumerate(processed) if p["name"] == name]
        if idx_list:
            prob += pv[idx_list[0]] == 1

    lineups = []
    for _ in range(num_lineups):
        prob.solve(pulp.PULP_CBC_CMD(msg=False))
        if pulp.LpStatus[prob.status] != "Optimal":
            break
        selected = [i for i in range(n) if (pv[i].varValue or 0) >= 0.9]
        if len(selected) != 8:
            break
        lineup = [processed[i] for i in selected]
        # Assign DK slots: PG, SG, SF, PF, C, G, F, UTIL
        dk_slots = ["PG", "SG", "SF", "PF", "C", "G", "F", "UTIL"]
        assigned = []
        used = set()
        for slot in dk_slots:
            for p in lineup:
                if id(p) in used:
                    continue
                pos = p["pos_raw"]
                if slot == "G" and any(x in pos for x in ["PG", "SG"]):
                    assigned.append({**p, "slot": slot, "pos": pos})
                    used.add(id(p))
                    break
                elif slot == "F" and any(x in pos for x in ["SF", "PF"]):
                    assigned.append({**p, "slot": slot, "pos": pos})
                    used.add(id(p))
                    break
                elif slot == "UTIL":
                    assigned.append({**p, "slot": slot, "pos": pos})
                    used.add(id(p))
                    break
                elif slot in pos and slot not in ("G", "F", "UTIL"):
                    assigned.append({**p, "slot": slot, "pos": pos})
                    used.add(id(p))
                    break
        # Fallback: any remaining unassigned players
        for p in lineup:
            if id(p) not in used:
                assigned.append({**p, "slot": "UTIL", "pos": p["pos_raw"]})
        players_out = [{"name": p["name"], "slot": p.get("slot", "UTIL"), "pos": p.get("pos", p.get("pos_raw", "")), "salary": int(p["salary"]), "proj": round(p["proj"], 2)} for p in assigned]
        lineups.append({
            "players": players_out,
            "total_salary": int(sum(p["salary"] for p in lineup)),
            "total_proj": round(sum(p["proj"] for p in lineup), 2),
        })
        prob += pulp.lpSum(pv[i] for i in selected) <= 7

    return {
        "status": "ok", "sport": "NBA", "mode": mode,
        "lineups": lineups, "total_lineups": len(lineups),
        "roster": [{"name": p["name"], "pos": p["pos_raw"], "salary": int(p["salary"]), "proj": round(p["proj"], 2)} for p in sorted(processed, key=lambda x: -x["proj"])],
    }


# ── NASCAR DFS Optimizer ──────────────────────────────────────────────────────

def optimize_nascar(
    csv_text: str,
    locks: list[str] = None,
    scratches: list[str] = None,
    num_lineups: int = 10,
    mode: str = "cash",
) -> dict:
    """NASCAR DFS — DraftKings format: 6 drivers · $50K cap."""
    import pulp

    locks = [l.strip() for l in (locks or [])]
    scratches = [s.strip() for s in (scratches or [])]

    rows = _parse_csv(csv_text)
    if not rows:
        return {"status": "error", "message": "No drivers found in CSV", "lineups": []}

    rows = [r for r in rows if r.get("Name", "") not in scratches]
    if rows and "Injury Indicator" in rows[0]:
        rows = [r for r in rows if r.get("Injury Indicator", "") not in ("O", "WD", "Out")]

    processed = []
    for r in rows:
        name = str(r.get("Name", "")).strip()
        sal = _salary(r)
        if sal <= 0:
            continue
        base = _avg_pts(r) or (sal / 1000) * 4.5
        gpp = base * (1 + random.uniform(0.2, 1.2))  # higher variance for NASCAR
        proj = base if mode == "cash" else gpp
        processed.append({"name": name, "salary": sal, "proj": proj, "gpp": gpp})

    if len(processed) < 6:
        return {"status": "error", "message": f"Need at least 6 drivers (found {len(processed)})", "lineups": []}

    prob = pulp.LpProblem("NASCAR_DFS", pulp.LpMaximize)
    n = len(processed)
    pv = pulp.LpVariable.dicts("D", range(n), cat="Binary")

    prob += pulp.lpSum(processed[i]["proj"] * pv[i] for i in range(n))
    prob += pulp.lpSum(pv[i] for i in range(n)) == 6
    prob += pulp.lpSum(processed[i]["salary"] * pv[i] for i in range(n)) <= 50000

    for name in locks:
        idx_list = [i for i, p in enumerate(processed) if p["name"] == name]
        if idx_list:
            prob += pv[idx_list[0]] == 1

    lineups = []
    for _ in range(num_lineups):
        prob.solve(pulp.PULP_CBC_CMD(msg=False))
        if pulp.LpStatus[prob.status] != "Optimal":
            break
        selected = [i for i in range(n) if (pv[i].varValue or 0) >= 0.9]
        if len(selected) != 6:
            break
        lineup = [processed[i] for i in selected]
        lineups.append({
            "players": lineup,
            "total_salary": int(sum(p["salary"] for p in lineup)),
            "total_proj": round(sum(p["proj"] for p in lineup), 2),
        })
        prob += pulp.lpSum(pv[i] for i in selected) <= 5

    return {
        "status": "ok", "sport": "NASCAR", "mode": mode,
        "lineups": lineups, "total_lineups": len(lineups),
        "roster": [{"name": p["name"], "salary": int(p["salary"]), "proj": round(p["proj"], 2)} for p in sorted(processed, key=lambda x: -x["proj"])],
    }
