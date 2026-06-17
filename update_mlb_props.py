import requests
import json
import os
import re
import datetime
from dotenv import load_dotenv

load_dotenv()

PRIMARY_KEY = os.getenv("ODDS_API_KEY", "")
BACKUP_KEY  = os.getenv("ODDS_API_KEY_BACKUP", "")

if not PRIMARY_KEY and not BACKUP_KEY:
    print("❌ ERROR: No Odds API key found. Set ODDS_API_KEY or ODDS_API_KEY_BACKUP.")
    exit()

_active_key_override: str | None = None

ODDS_KEY_STATUS_FILE = "odds_key_status.json"

def _write_key_status(status: str):
    try:
        with open(ODDS_KEY_STATUS_FILE, "w") as f:
            json.dump({"status": status, "updated_at": datetime.datetime.now().isoformat()}, f)
    except Exception:
        pass

def _odds_get(url_template: str) -> dict | list | None:
    global _active_key_override

    if _active_key_override == "backup":
        keys = [(BACKUP_KEY, "backup")] if BACKUP_KEY else []
    else:
        keys = [(PRIMARY_KEY, "primary"), (BACKUP_KEY, "backup")]
    keys = [(k, label) for k, label in keys if k]

    for key, label in keys:
        url = url_template.replace("{KEY}", key)
        try:
            r = requests.get(url, timeout=15)
            if r.status_code in (401, 402, 403):
                print(f"⚠️  Odds API [{label} key] HTTP {r.status_code} — {'trying backup...' if label == 'primary' and BACKUP_KEY else 'both keys exhausted.'}")
                continue
            data = r.json()
            if isinstance(data, dict) and data.get("error_code") in (
                "OUT_OF_USAGE", "INVALID_API_KEY", "QUOTA_EXCEEDED", "FORBIDDEN"
            ):
                print(f"⚠️  Odds API [{label} key] error: {data.get('message', data.get('error_code'))} — {'trying backup...' if label == 'primary' and BACKUP_KEY else 'both keys exhausted.'}")
                continue

            remaining_header = r.headers.get("x-requests-remaining", "")
            if remaining_header:
                try:
                    remaining = int(remaining_header)
                    if label == "primary" and remaining <= 20 and BACKUP_KEY:
                        print(f"⚠️  Primary Odds API key has only {remaining} requests remaining — switching to backup for this run.")
                        _active_key_override = "backup"
                        _write_key_status("low_primary")
                    else:
                        if _active_key_override != "backup":
                            _write_key_status(label)
                except (ValueError, TypeError):
                    pass
            else:
                if _active_key_override != "backup":
                    _write_key_status(label)

            return data
        except Exception as e:
            print(f"⚠️  Odds API [{label} key] request failed: {e}")
            continue

    _write_key_status("exhausted")
    print("🔴 Both Odds API keys exhausted or failed — skipping this request.")
    return None


# ── Batter stats cache (from mlb_batter_stats.py) ────────────────────────────

_SUFFIX_RE = re.compile(r"\s+(jr\.?|sr\.?|ii+|iii+|iv|v)$", re.IGNORECASE)

def _norm_name(name: str) -> str:
    n = name.strip().lower()
    n = _SUFFIX_RE.sub("", n)
    return n

def _load_batter_stats() -> dict:
    """Load per-game rates from mlb_batter_stats_cache.json."""
    try:
        with open("mlb_batter_stats_cache.json") as f:
            return json.load(f).get("players", {})
    except Exception:
        return {}


# ── Fix 1: scan ALL bookmakers for a given market ────────────────────────────

_PREF_BOOKS = {"draftkings", "fanduel", "betmgm", "pointsbet", "williamhill_us", "bovada"}

def _collect_outcomes(bookmakers: list, target_market: str) -> dict:
    """
    Scan all bookmakers for target_market (not just DK/FanDuel).
    Preferred books win on line conflicts; first writer wins per player.
    Tries both 'description' and 'name' for player identification.
    Returns {player_name: {'over': int, 'under': int, 'line': float}}.
    """
    player_data: dict = {}
    ordered = sorted(bookmakers, key=lambda b: (0 if b.get("key") in _PREF_BOOKS else 1))
    for bk in ordered:
        for mkt in bk.get("markets", []):
            if mkt.get("key") != target_market:
                continue
            for outcome in mkt.get("outcomes", []):
                player = (outcome.get("description") or "").strip()
                if not player:
                    # fallback to name field only if it isn't a side label
                    raw_name = (outcome.get("name") or "").strip()
                    if raw_name.lower() not in {"over", "under", "yes", "no", ""}:
                        player = raw_name
                if not player:
                    continue
                point = outcome.get("point", 0)
                price = outcome.get("price", -110)
                side  = outcome.get("name", "")

                if player not in player_data:
                    player_data[player] = {"over": -110, "under": -110, "line": 0}

                if side == "Over":
                    if player_data[player]["line"] == 0 or player_data[player]["over"] == -110:
                        player_data[player]["over"] = price
                        player_data[player]["line"] = point
                elif side == "Under":
                    if player_data[player]["under"] == -110:
                        player_data[player]["under"] = price
                        if player_data[player]["line"] == 0 and point:
                            player_data[player]["line"] = point
    return player_data


# ── Batter projection (Fix 2) ─────────────────────────────────────────────────

# League-average fallback per-game rates (used when player not in cache)
_LEAGUE_AVG = {
    "batter_hits":         0.220 * 4.2,   # ~0.924
    "batter_home_runs":    0.030 * 4.2,   # ~0.126
    "batter_rbis":         0.110 * 4.2,   # ~0.462
    "batter_runs_scored":  0.110 * 4.2,   # ~0.462
}

def _batter_proj(player: str, market_name: str, line: float, batter_stats: dict) -> float:
    """
    Return projected mean for a batter prop using season per-game rates.
    Blends 80% actual season stats / 20% Vegas line.
    Falls back to league-average when player is not in cache.
    """
    stat = batter_stats.get(_norm_name(player), {})
    rate_map = {
        "batter_hits":        "h_per_g",
        "batter_home_runs":   "hr_per_g",
        "batter_rbis":        "rbi_per_g",
        "batter_runs_scored": "r_per_g",
    }
    rate_key = rate_map.get(market_name)
    if rate_key and stat:
        proj = stat.get(rate_key, _LEAGUE_AVG.get(market_name, line))
    else:
        proj = _LEAGUE_AVG.get(market_name, line)

    return (proj * 0.80) + (line * 0.20)


# ── Pitcher projection (unchanged logic) ─────────────────────────────────────

def _pitcher_proj(line: float, historical_data: dict, player: str) -> float:
    p_base = historical_data.get(player.lower(), {})
    base_rate = p_base.get("k_per_pa", 1.0) if p_base else 1.0
    assumed_pas = 4.2
    historical_proj = base_rate * assumed_pas
    return (historical_proj * 0.90) + (line * 0.10)


# ── Historical baselines (pitcher Ks — legacy, kept for compatibility) ───────

def load_historical_baselines() -> dict:
    return {}


# ── Main prop-fetching loop ───────────────────────────────────────────────────

PITCHER_MARKETS  = ["pitcher_strikeouts"]


def _fetch_today_lineups(today_str: str) -> set:
    """
    Fetch confirmed batting lineups for today's MLB games from the MLB Stats API.
    Returns a set of normalised player names for players in today's lineups.
    Falls back to empty set on any error; caller handles the empty case.
    """
    url = (
        f"https://statsapi.mlb.com/api/v1/schedule"
        f"?sportId=1&date={today_str}&hydrate=lineups"
    )
    try:
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        data = r.json()
        players: set = set()
        for date_obj in data.get("dates", []):
            for game in date_obj.get("games", []):
                lineups = game.get("lineups", {})
                for side in ("homePlayers", "awayPlayers"):
                    for player in lineups.get(side, []):
                        name = player.get("person", {}).get("fullName", "")
                        if name:
                            players.add(_norm_name(name))
        return players
    except Exception as e:
        print(f"   ⚠️  Could not fetch today's lineups: {e}")
        return set()


def get_mlb_props():
    print("⚾ [THE CLEANUP CREW] Pinging The Odds API for today's MLB slate...")

    batter_stats = _load_batter_stats()
    cache_size   = len(batter_stats)
    print(f"   📊 Batter stats cache: {cache_size} players loaded"
          + (" — run mlb_batter_stats.py to refresh" if cache_size == 0 else ""))

    today_utc    = datetime.datetime.utcnow().date()
    tomorrow_utc = today_utc + datetime.timedelta(days=1)
    today_str    = today_utc.isoformat()
    commence_from = f"{today_str}T00:00:00Z"
    commence_to   = f"{tomorrow_utc.isoformat()}T10:00:00Z"

    events_url = (
        f"https://api.the-odds-api.com/v4/sports/baseball_mlb/events"
        f"?apiKey={{KEY}}"
        f"&commenceTimeFrom={commence_from}"
        f"&commenceTimeTo={commence_to}"
    )
    events = _odds_get(events_url)
    if events is None:
        print("❌ Could not fetch MLB events — no usable Odds API key.")
        return

    if not isinstance(events, list):
        print(f"❌ Unexpected events response: {events}")
        return

    event_ids = [
        (e["id"], e.get("home_team", ""), e.get("away_team", ""))
        for e in events[:20]
        if isinstance(e, dict) and e.get("id")
        and e.get("commence_time", "")[:10] in (today_str, tomorrow_utc.isoformat())
    ]

    all_props = []
    markets_str = ",".join(PITCHER_MARKETS)

    print(f"🧹 Found {len(event_ids)} games. Fetching pitcher K props + generating synthetic batter props...")

    pitcher_count = 0
    batter_count  = 0

    # ── Pass 1: Pitcher strikeouts from Odds API ──────────────────────────────
    for event_id, home_team, away_team in event_ids:
        odds_url = (
            f"https://api.the-odds-api.com/v4/sports/baseball_mlb/events/{event_id}/odds"
            f"?apiKey={{KEY}}&regions=us&markets={markets_str}&oddsFormat=american"
        )
        resp = _odds_get(odds_url)
        if resp is None or not isinstance(resp, dict):
            continue

        bookmakers = resp.get("bookmakers", [])
        if not bookmakers:
            continue

        for market_name in PITCHER_MARKETS:
            player_data = _collect_outcomes(bookmakers, market_name)
            if not player_data:
                continue

            for player, odds in player_data.items():
                line = odds["line"]
                if line == 0:
                    continue

                blended_mean = (1.0 * 4.2 * 0.90) + (line * 0.10)
                std_dev = blended_mean * 0.25

                if blended_mean <= 0 or std_dev <= 0:
                    continue

                all_props.append({
                    "player":     player,
                    "market":     market_name,
                    "line":       line,
                    "over_odds":  odds["over"],
                    "under_odds": odds["under"],
                    "proj_mean":  round(blended_mean, 2),
                    "proj_std":   round(std_dev, 2),
                    "home_team":  home_team,
                    "away_team":  away_team,
                })
                pitcher_count += 1

    # ── Pass 2: Synthetic batter props from stats cache ───────────────────────
    today_lineups = _fetch_today_lineups(today_str)
    has_lineups = len(today_lineups) > 0
    print(f"   📋 Lineup check: {'confirmed lineup data available' if has_lineups else 'no lineup data — using all cache players with 50+ games'} ({len(today_lineups)} players)")

    # Build game lookup (home_team/away_team by normalized home team name)
    # so we can attach team info to each batter prop
    # We use the Odds API events for home/away team names
    team_lookup: dict = {}
    for _, home_team, away_team in event_ids:
        team_lookup[home_team.lower()] = (home_team, away_team)
        team_lookup[away_team.lower()] = (home_team, away_team)

    synthetic_defs = [
        # (market_name, rate_key, fixed_line, std_factor)
        ("batter_hits",        "h_per_g",                0.5, 0.40),
        ("batter_total_bases", "tb_per_g",               1.5, 0.40),
        ("batter_hrr",         None,                     1.5, 0.45),  # h+r+rbi combined
    ]

    for norm_player, stat in batter_stats.items():
        if has_lineups:
            if norm_player not in today_lineups:
                continue
        else:
            if stat.get("games", 0) < 50:
                continue

        for market_name, rate_key, fixed_line, std_factor in synthetic_defs:
            if rate_key:
                proj_mean = stat.get(rate_key, 0.0)
            else:
                proj_mean = (
                    stat.get("h_per_g", 0.0)
                    + stat.get("r_per_g", 0.0)
                    + stat.get("rbi_per_g", 0.0)
                )

            if proj_mean <= fixed_line:
                continue

            std_dev = proj_mean * std_factor
            if std_dev <= 0:
                continue

            all_props.append({
                "player":     stat.get("full_name", norm_player.title()),
                "market":     market_name,
                "line":       fixed_line,
                "over_odds":  -110,
                "under_odds": -110,
                "proj_mean":  round(proj_mean, 3),
                "proj_std":   round(std_dev, 3),
                "home_team":  "",
                "away_team":  "",
            })
            batter_count += 1

    with open("mlb_props_slayer_data.json", "w") as f:
        json.dump(all_props, f, indent=4)

    print(
        f"✅ SUCCESS: {len(all_props)} props written "
        f"({pitcher_count} pitcher K, {batter_count} synthetic batter hits/TB/HRR)"
    )


if __name__ == "__main__":
    get_mlb_props()
