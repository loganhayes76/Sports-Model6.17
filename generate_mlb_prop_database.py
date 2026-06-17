"""
generate_mlb_prop_database.py
-----------------------------
Pulls current-season hitting and pitching stats from the free MLB Stats API
and writes mlb_prop_database.json in the format that mlb_api.get_prop_matrix()
expects.

No API key required.  No pandas / numpy / scipy — pure Python stdlib + requests.

Output schema — list of dicts, one per player:
  Batters:  {"type": "batter",  "name": str, "team": str,
             "g": int, "h": int, "hr": int, "r": int, "rbi": int,
             "slg": float, "ab": int}
  Pitchers: {"type": "pitcher", "name": str, "team": str,
             "gs": int, "so": int, "era": float}

Importable — no top-level side effects.
Call generate_prop_database() to trigger a refresh programmatically.

Team labels are always patched with current-year roster data so that offseason
movers show the correct team regardless of which stats year was used.
"""

import json
import datetime
import requests

PROP_DB_FILE  = "mlb_prop_database.json"
API_BASE      = "https://statsapi.mlb.com/api/v1"
PAGE_SIZE     = 500
MIN_QUALIFIED = 50   # minimum players with sufficient games to trust current-year data
MIN_G_BATTER  = 10   # minimum games for a batter to qualify
MIN_GS_PITCHER = 5   # minimum starts to include a pitcher in the matrix


# ── Current-roster team lookup ────────────────────────────────────────────────

def _fetch_team_names(year: int) -> dict:
    """
    Fetch {team_id: team_name} for all MLB teams in the given season.
    Returns {} on any error.
    """
    url = f"{API_BASE}/teams?sportId=1&season={year}"
    try:
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        data = r.json()
        return {t["id"]: t["name"] for t in data.get("teams", []) if "id" in t and "name" in t}
    except Exception as e:
        print(f"   ⚠️  Could not fetch team names for {year}: {e}")
        return {}


def _fetch_current_teams(year: int) -> dict:
    """
    Return {normalized_player_name: current_team_name} for all active players
    registered in the given season. Uses the current calendar year's roster so
    that team labels stay accurate even when stats fall back to a prior year.
    Returns {} on any error (safe fallback — won't break DB generation).

    Implementation note: the /sports/1/players endpoint with hydrate=currentTeam
    returns only currentTeam.id (not currentTeam.name), so a prior call to
    _fetch_team_names() is required to build the id→name mapping. This is a
    known limitation of the MLB Stats API — there is no single-endpoint way to
    get player+team-name in one call.

    Matching is by normalized full name. Duplicate-name collisions are
    theoretically possible but extremely rare in MLB. A future improvement
    would join on stable person IDs instead.
    """
    team_names = _fetch_team_names(year)
    if not team_names:
        return {}
    url = f"{API_BASE}/sports/1/players?season={year}&hydrate=currentTeam"
    try:
        r = requests.get(url, timeout=20)
        r.raise_for_status()
        data = r.json()
        result: dict = {}
        for person in data.get("people", []):
            name = person.get("fullName", "").strip()
            if not name:
                continue
            team_id = person.get("currentTeam", {}).get("id")
            if team_id and team_id in team_names:
                result[name.lower()] = team_names[team_id]
        return result
    except Exception as e:
        print(f"   ⚠️  Could not fetch current rosters for {year}: {e}")
        return {}


# ── Shared fetch + pagination ─────────────────────────────────────────────────

def _fetch_splits(group: str, year: int) -> list:
    """
    Fetch all splits for the given stat group and season year.
    Uses playerPool=ALL and paginates automatically.
    Returns [] on any error.
    """
    all_splits: list = []
    offset = 0

    while True:
        url = (
            f"{API_BASE}/stats"
            f"?stats=season&group={group}&season={year}"
            f"&playerPool=ALL&sportId=1"
            f"&limit={PAGE_SIZE}&offset={offset}"
        )
        try:
            r = requests.get(url, timeout=15)
            r.raise_for_status()
            data = r.json()
            stats_list = data.get("stats", [])
            if not stats_list:
                break
            splits = stats_list[0].get("splits", [])
            if not splits:
                break
            all_splits.extend(splits)
            total = stats_list[0].get("totalSplits", 0)
            offset += len(splits)
            if offset >= total:
                break
        except Exception as e:
            print(f"   ⚠️  MLB Stats API error (group={group}, season={year}, offset={offset}): {e}")
            break

    return all_splits


def _safe_int(v) -> int:
    try:
        return int(v or 0)
    except (TypeError, ValueError):
        return 0


def _safe_float(v) -> float:
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


# ── Batter record builder ─────────────────────────────────────────────────────

def _build_batter_records(splits: list) -> list:
    """Convert hitting splits → list of batter dicts for mlb_prop_database.json."""
    records = []
    for split in splits:
        player_obj = split.get("player", {})
        name = player_obj.get("fullName", "").strip()
        if not name:
            continue
        team = split.get("team", {}).get("name", "").strip()
        s = split.get("stat", {})
        g  = _safe_int(s.get("gamesPlayed"))
        ab = _safe_int(s.get("atBats"))
        if g < MIN_G_BATTER or ab == 0:
            continue
        records.append({
            "type": "batter",
            "name": name,
            "team": team,
            "g":    g,
            "h":    _safe_int(s.get("hits")),
            "hr":   _safe_int(s.get("homeRuns")),
            "r":    _safe_int(s.get("runs")),
            "rbi":  _safe_int(s.get("rbi")),
            "slg":  _safe_float(s.get("slg")),
            "ab":   ab,
        })
    return records


# ── Pitcher record builder ────────────────────────────────────────────────────

def _build_pitcher_records(splits: list) -> list:
    """Convert pitching splits → list of pitcher dicts for mlb_prop_database.json."""
    records = []
    for split in splits:
        player_obj = split.get("player", {})
        name = player_obj.get("fullName", "").strip()
        if not name:
            continue
        team = split.get("team", {}).get("name", "").strip()
        s = split.get("stat", {})
        gs = _safe_int(s.get("gamesStarted"))
        if gs < MIN_GS_PITCHER:
            continue
        records.append({
            "type": "pitcher",
            "name": name,
            "team": team,
            "gs":   gs,
            "so":   _safe_int(s.get("strikeOuts")),
            "era":  _safe_float(s.get("era")),
        })
    return records


# ── Year selection (same fallback logic as mlb_batter_stats.py) ───────────────

def _choose_year(verbose: bool = True) -> int:
    current_year = datetime.datetime.utcnow().year
    if verbose:
        print(f"   Checking {current_year} season for qualifying players...")
    splits_cy = _fetch_splits("hitting", current_year)
    qualifying = [
        sp for sp in splits_cy
        if _safe_int(sp.get("stat", {}).get("gamesPlayed")) >= MIN_G_BATTER
    ]
    if len(qualifying) >= MIN_QUALIFIED:
        if verbose:
            print(f"   ✅ Using {current_year} ({len(qualifying)} qualifying batters)")
        return current_year
    prior_year = current_year - 1
    if verbose:
        print(
            f"   ⚠️  {current_year} too early ({len(qualifying)} qualifying) "
            f"— falling back to {prior_year}"
        )
    return prior_year


# ── Main entry point ──────────────────────────────────────────────────────────

def generate_prop_database(verbose: bool = True) -> dict:
    """
    Fetch hitting and pitching stats from the MLB Stats API and write
    mlb_prop_database.json.  Returns {"batters": N, "pitchers": M}.

    After building records from (possibly historical) stats, a team-override
    pass patches every player's team label with their current-year assignment
    so that offseason movers always show the correct team.
    """
    if verbose:
        print("⚾  [MLB Prop DB] Generating mlb_prop_database.json...")

    current_year = datetime.datetime.utcnow().year
    year = _choose_year(verbose=verbose)

    if verbose:
        print(f"   Fetching {year} hitting stats...")
    hitting_splits = _fetch_splits("hitting", year)
    batter_records = _build_batter_records(hitting_splits)

    if verbose:
        print(f"   Fetching {year} pitching stats...")
    pitching_splits = _fetch_splits("pitching", year)
    pitcher_records = _build_pitcher_records(pitching_splits)

    all_records = batter_records + pitcher_records

    if not all_records:
        if verbose:
            print("   ❌ No records built — aborting. Existing file left unchanged.")
        return {"batters": 0, "pitchers": 0}

    # ── Team override pass ────────────────────────────────────────────────────
    # Always use the current calendar year for roster lookups, even when stats
    # fell back to a prior year. This corrects team labels for offseason movers.
    if verbose:
        print(f"   Fetching {current_year} current roster for team label override...")
    current_teams = _fetch_current_teams(current_year)
    patched = 0
    if current_teams:
        for record in all_records:
            key = record["name"].lower()
            live_team = current_teams.get(key)
            if live_team and record.get("team") != live_team:
                record["team"] = live_team
                patched += 1
        if verbose:
            status = f"Patched {patched} team labels" if patched else "All team labels already current"
            print(f"   🔄  {status} with {current_year} roster data")
    else:
        if verbose:
            print("   ⚠️  Roster lookup failed — team labels from stats year retained")
    # ─────────────────────────────────────────────────────────────────────────

    try:
        with open(PROP_DB_FILE, "w") as f:
            json.dump(all_records, f, indent=2)
        if verbose:
            print(
                f"   💾  Saved {len(all_records)} records → {PROP_DB_FILE} "
                f"({len(batter_records)} batters, {len(pitcher_records)} pitchers)"
            )
    except Exception as e:
        if verbose:
            print(f"   ❌  Could not write {PROP_DB_FILE}: {e}")
        return {"batters": 0, "pitchers": 0}

    # ── Also patch mlb_batters.csv abbreviations ──────────────────────────────
    try:
        import patch_mlb_team_abbrs as _patch
        _patch.patch_csv(current_teams=current_teams, verbose=verbose)
    except Exception as e:
        if verbose:
            print(f"   ⚠️  CSV team abbr patch skipped: {e}")
    # ─────────────────────────────────────────────────────────────────────────

    return {"batters": len(batter_records), "pitchers": len(pitcher_records)}


# ── CLI entry ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    result = generate_prop_database(verbose=True)
    if result["batters"] or result["pitchers"]:
        print("\nSanity check:")
        import json as _json
        with open(PROP_DB_FILE) as f:
            db = _json.load(f)
        spot_batters  = [r for r in db if r["type"] == "batter"][:3]
        spot_pitchers = [r for r in db if r["type"] == "pitcher"][:3]
        print("  Sample batters:")
        for b in spot_batters:
            print(f"    {b['name']:25s}  G={b['g']:3d}  H={b['h']:3d}  HR={b['hr']:2d}  SLG={b['slg']:.3f}")
        print("  Sample pitchers:")
        for p in spot_pitchers:
            print(f"    {p['name']:25s}  GS={p['gs']:3d}  SO={p['so']:3d}  ERA={p['era']:.2f}")
