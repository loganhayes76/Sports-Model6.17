"""
mlb_batter_stats.py
-------------------
Pulls current-season hitting stats from the free MLB Stats API and writes a
per-player per-game rate cache used by update_mlb_props.py for batter projections.

No API key required.  No pandas / numpy — pure Python stdlib + requests.

Output: mlb_batter_stats_cache.json
  {
    "updated_at": "2026-04-01T12:00:00",
    "season": 2026,
    "players": {
      "aaron judge": {"h_per_g": 1.18, "hr_per_g": 0.35, ...},
      ...
    }
  }

Importable from other scripts — no top-level side effects when imported.
Call refresh_batter_stats() to trigger a refresh programmatically.
"""

import json
import datetime
import re
import requests

CACHE_FILE    = "mlb_batter_stats_cache.json"
API_BASE      = "https://statsapi.mlb.com/api/v1"
MIN_GAMES_CY  = 10    # minimum games in current year to trust it as primary source
PAGE_SIZE     = 500   # players per API page
MIN_QUALIFIED = 50    # minimum qualified batters to use a given year as primary


# ── Name normalisation ────────────────────────────────────────────────────────

_SUFFIX_RE = re.compile(
    r"\s+(jr\.?|sr\.?|ii+|iii+|iv|v)$", re.IGNORECASE
)

def _norm(name: str) -> str:
    """Lowercase, strip punctuation artefacts and name suffixes."""
    name = name.strip().lower()
    name = _SUFFIX_RE.sub("", name)
    return name


# ── MLB Stats API fetch ───────────────────────────────────────────────────────

def _fetch_season(year: int) -> list:
    """
    Return list of split dicts from the MLB Stats API for the given season.
    Uses playerPool=ALL and paginates to retrieve all hitters (not just qualified).
    Returns [] on any error.
    """
    all_splits: list = []
    offset = 0

    while True:
        url = (
            f"{API_BASE}/stats"
            f"?stats=season&group=hitting&season={year}"
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
            all_splits.extend(splits)
            total = stats_list[0].get("totalSplits", 0)
            offset += len(splits)
            if not splits or offset >= total:
                break
        except Exception as e:
            print(f"⚠️  MLB Stats API error (season={year}, offset={offset}): {e}")
            break

    return all_splits


# ── Per-game rate computation ─────────────────────────────────────────────────

def _safe_div(num, denom):
    try:
        n = float(num)
        d = float(denom)
        return round(n / d, 4) if d > 0 else 0.0
    except (TypeError, ValueError):
        return 0.0


def _build_player_dict(splits: list) -> dict:
    """Convert a list of API splits into the {norm_name: rates} dict."""
    players = {}
    for split in splits:
        player_obj = split.get("player", {})
        name = player_obj.get("fullName", "")
        if not name:
            continue
        s = split.get("stat", {})
        g = float(s.get("gamesPlayed") or 0)
        if g == 0:
            continue
        players[_norm(name)] = {
            "full_name":  name,
            "games":      int(g),
            "h_per_g":    _safe_div(s.get("hits"),        g),
            "hr_per_g":   _safe_div(s.get("homeRuns"),    g),
            "rbi_per_g":  _safe_div(s.get("rbi"),         g),
            "r_per_g":    _safe_div(s.get("runs"),        g),
            "tb_per_g":   _safe_div(s.get("totalBases"),  g),
            "pa_per_g":   _safe_div(s.get("plateAppearances"), g),
            "avg":        float(s.get("avg") or 0),
            "obp":        float(s.get("obp") or 0),
            "slg":        float(s.get("slg") or 0),
        }
    return players


# ── Main entry point ──────────────────────────────────────────────────────────

def refresh_batter_stats(verbose: bool = True) -> dict:
    """
    Fetch current-season batter stats and write the cache file.
    Returns the players dict (empty on total failure).
    Leaves existing cache untouched if the API is unreachable.
    """
    current_year = datetime.datetime.utcnow().year

    if verbose:
        print(f"⚾  [MLB Batter Stats] Fetching {current_year} season data...")

    splits_cy = _fetch_season(current_year)
    season_used = current_year
    players = {}

    if splits_cy:
        players_cy = _build_player_dict(splits_cy)
        # Check if enough games have been played to trust current-year rates
        qualifying = [v for v in players_cy.values() if v["games"] >= MIN_GAMES_CY]
        if len(qualifying) >= MIN_QUALIFIED:
            players = players_cy
            if verbose:
                print(f"   ✅ {current_year}: {len(players)} hitters ({len(qualifying)} with ≥{MIN_GAMES_CY} G)")
        else:
            if verbose:
                print(
                    f"   ⚠️  {current_year} too early ({len(qualifying)} hitters with ≥{MIN_GAMES_CY} G) "
                    f"— falling back to {current_year - 1}"
                )

    if not players:
        prior_year = current_year - 1
        if verbose:
            print(f"   Fetching {prior_year} season data as fallback...")
        splits_py = _fetch_season(prior_year)
        if splits_py:
            players = _build_player_dict(splits_py)
            season_used = prior_year
            if verbose:
                print(f"   ✅ {prior_year}: {len(players)} hitters loaded")
        else:
            if verbose:
                print("   ❌ Both years failed — cache unchanged.")
            return {}

    payload = {
        "updated_at": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S"),
        "season":     season_used,
        "player_count": len(players),
        "players":    players,
    }

    try:
        with open(CACHE_FILE, "w") as f:
            json.dump(payload, f, indent=2)
        if verbose:
            print(f"   💾  Saved {len(players)} player records → {CACHE_FILE}")
    except Exception as e:
        if verbose:
            print(f"   ❌  Could not write cache: {e}")
        return {}

    return players


def load_batter_stats() -> dict:
    """
    Load the cached player rates.  Returns {} if cache is missing or corrupt.
    This is the function imported by update_mlb_props.py.
    """
    try:
        with open(CACHE_FILE) as f:
            return json.load(f).get("players", {})
    except Exception:
        return {}


# ── CLI entry ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    result = refresh_batter_stats(verbose=True)
    if result:
        # Quick sanity check — print a few well-known players
        checks = ["aaron judge", "mookie betts", "shohei ohtani", "freddie freeman"]
        print("\nSanity check:")
        for name in checks:
            p = result.get(name)
            if p:
                print(
                    f"  {p['full_name']:25s}  "
                    f"G={p['games']:3d}  "
                    f"H/G={p['h_per_g']:.3f}  "
                    f"HR/G={p['hr_per_g']:.3f}  "
                    f"RBI/G={p['rbi_per_g']:.3f}"
                )
            else:
                print(f"  {name}: not found in cache")
