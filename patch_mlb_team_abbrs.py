"""
patch_mlb_team_abbrs.py
-----------------------
Patches the Team column in mlb_batters.csv with current-year team
abbreviations sourced from the MLB Stats API.

Pure stdlib + requests — no pandas / numpy / scipy required.

Usage (standalone):
    python3 patch_mlb_team_abbrs.py

Or called programmatically from generate_mlb_prop_database.py:
    import patch_mlb_team_abbrs
    patch_mlb_team_abbrs.patch_csv(current_teams=my_dict, verbose=True)
"""

import csv
import io
import os
import requests

CSV_FILE = "mlb_batters.csv"
API_BASE = "https://statsapi.mlb.com/api/v1"

# Full team name → CSV abbreviation mapping (matches _MLB_ODDS_NAME_TO_ABBR in api.py)
# The MLB Stats API uses different abbreviations (e.g. "AZ", "CWS") so we use
# this internal map instead of the API's own abbreviation field.
_FULL_TO_ABBR = {
    "Arizona Diamondbacks":  "ARI",
    "Atlanta Braves":         "ATL",
    "Baltimore Orioles":      "BAL",
    "Boston Red Sox":         "BOS",
    "Chicago Cubs":           "CHC",
    "Chicago White Sox":      "CHW",
    "Cincinnati Reds":        "CIN",
    "Cleveland Guardians":    "CLE",
    "Colorado Rockies":       "COL",
    "Detroit Tigers":         "DET",
    "Houston Astros":         "HOU",
    "Kansas City Royals":     "KCR",
    "Los Angeles Angels":     "LAA",
    "Los Angeles Dodgers":    "LAD",
    "Miami Marlins":          "MIA",
    "Milwaukee Brewers":      "MIL",
    "Minnesota Twins":        "MIN",
    "New York Mets":          "NYM",
    "New York Yankees":       "NYY",
    "Oakland Athletics":      "OAK",
    "Athletics":              "ATH",
    "Philadelphia Phillies":  "PHI",
    "Pittsburgh Pirates":     "PIT",
    "San Diego Padres":       "SDP",
    "San Francisco Giants":   "SFG",
    "Seattle Mariners":       "SEA",
    "St. Louis Cardinals":    "STL",
    "Tampa Bay Rays":         "TBR",
    "Texas Rangers":          "TEX",
    "Toronto Blue Jays":      "TOR",
    "Washington Nationals":   "WSN",
}


def fetch_current_teams_with_abbrs(year: int) -> dict:
    """
    Return {normalized_player_name: abbr} for all active players in the given season.
    Builds team_id → abbr from the teams API, then maps player names.
    Returns {} on any error.
    """
    teams_url = f"{API_BASE}/teams?sportId=1&season={year}"
    try:
        r = requests.get(teams_url, timeout=10)
        r.raise_for_status()
        data = r.json()
        id_to_abbr: dict = {}
        for t in data.get("teams", []):
            tid = t.get("id")
            name = t.get("name", "")
            abbr = _FULL_TO_ABBR.get(name)
            if tid and abbr:
                id_to_abbr[tid] = abbr
    except Exception as e:
        print(f"   ⚠️  patch_mlb_team_abbrs: could not fetch team names: {e}")
        return {}

    players_url = f"{API_BASE}/sports/1/players?season={year}&hydrate=currentTeam"
    try:
        r = requests.get(players_url, timeout=20)
        r.raise_for_status()
        data = r.json()
        result: dict = {}
        for person in data.get("people", []):
            name = person.get("fullName", "").strip()
            if not name:
                continue
            team_id = person.get("currentTeam", {}).get("id")
            abbr = id_to_abbr.get(team_id)
            if abbr:
                result[name.lower()] = abbr
        return result
    except Exception as e:
        print(f"   ⚠️  patch_mlb_team_abbrs: could not fetch player rosters: {e}")
        return {}


def patch_csv(
    current_teams: dict = None,
    year: int = None,
    csv_path: str = CSV_FILE,
    verbose: bool = True,
) -> int:
    """
    Read mlb_batters.csv, patch the Team column with current abbreviations,
    write back in place.  Returns number of rows patched.

    current_teams: optional pre-fetched {norm_name: full_team_name} dict from
        generate_mlb_prop_database._fetch_current_teams(). If supplied we derive
        abbreviations from _FULL_TO_ABBR instead of calling the API again.
    year: season year for roster lookup (defaults to current calendar year).
    """
    if not os.path.exists(csv_path):
        if verbose:
            print(f"   ⚠️  {csv_path} not found — skipping CSV team patch")
        return 0

    import datetime
    if year is None:
        year = datetime.datetime.utcnow().year

    # Build name → abbr mapping
    if current_teams:
        # Convert the full-name map passed from generate_mlb_prop_database
        name_to_abbr: dict = {}
        for norm_name, full_team in current_teams.items():
            abbr = _FULL_TO_ABBR.get(full_team)
            if abbr:
                name_to_abbr[norm_name] = abbr
    else:
        name_to_abbr = fetch_current_teams_with_abbrs(year)

    if not name_to_abbr:
        if verbose:
            print("   ⚠️  No roster abbreviation data — CSV team patch skipped")
        return 0

    # Read CSV
    try:
        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            fieldnames = reader.fieldnames or []
            rows = list(reader)
    except Exception as e:
        if verbose:
            print(f"   ⚠️  Could not read {csv_path}: {e}")
        return 0

    if "Team" not in fieldnames:
        if verbose:
            print(f"   ⚠️  {csv_path} has no 'Team' column — skipping")
        return 0

    patched = 0
    for row in rows:
        player_name = row.get("Name", "").strip()
        if not player_name:
            continue
        new_abbr = name_to_abbr.get(player_name.lower())
        if new_abbr and row.get("Team", "") != new_abbr:
            row["Team"] = new_abbr
            patched += 1

    # Write back
    try:
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
        with open(csv_path, "w", encoding="utf-8", newline="") as f:
            f.write(buf.getvalue())
        if verbose and patched > 0:
            print(f"   🔄  Patched {patched} team abbreviations in {csv_path}")
        elif verbose:
            print(f"   ✅  {csv_path} team abbreviations already current")
    except Exception as e:
        if verbose:
            print(f"   ⚠️  Could not write {csv_path}: {e}")
        return 0

    return patched


if __name__ == "__main__":
    import datetime
    year = datetime.datetime.utcnow().year
    print(f"⚾  [MLB CSV Patch] Patching {CSV_FILE} team abbreviations for {year}...")
    n = patch_csv(year=year, verbose=True)
    print(f"   Done — {n} rows updated.")
