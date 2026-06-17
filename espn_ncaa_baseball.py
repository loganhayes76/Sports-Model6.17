"""
espn_ncaa_baseball.py — NCAA Baseball schedule + rankings from ESPN free API.

Public API:
    get_espn_games(force=False) -> list[dict]
    get_top25()                 -> dict[team_display_name, int]   (name -> rank)

Each game dict contains:
    home, away, home_id, away_id, home_abbr, away_abbr
    commence_time  ISO-8601 string
    status         "scheduled" | "in_progress" | "final" | "postponed"
    inning         int | None
    home_score     int | None
    away_score     int | None
    rank_home      int | None   (1-25 if ranked)
    rank_away      int | None
    conference     str          (home team conference)
    venue          str
"""

import json
import os
import time
import urllib.request

_SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/scoreboard"
_RANKINGS_URL   = "https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/rankings"
_CACHE_FILE     = "espn_ncaa_baseball_cache.json"
_CACHE_TTL      = 600   # 10 minutes (short to keep live scores fresh)
_HEADERS        = {"User-Agent": "Mozilla/5.0"}

# ── Conference map ────────────────────────────────────────────────────────────
# Key: cleaned school name (lower, after mascot strip) or display name fragment
# Value: conference string displayed in the Conference tab

CONF_MAP: dict[str, str] = {
    # ── SEC ────────────────────────────────────────────────────────────────────
    "alabama": "SEC", "arkansas": "SEC", "auburn": "SEC",
    "florida": "SEC", "florida gators": "SEC",
    "georgia": "SEC", "georgia bulldogs": "SEC",
    "kentucky": "SEC", "kentucky wildcats": "SEC",
    "lsu": "SEC", "louisiana state": "SEC",
    "mississippi state": "SEC", "mississippi state bulldogs": "SEC",
    "missouri": "SEC", "missouri tigers": "SEC",
    "ole miss": "SEC", "mississippi rebels": "SEC",
    "south carolina": "SEC", "south carolina gamecocks": "SEC",
    "tennessee": "SEC", "tennessee volunteers": "SEC",
    "texas a&m": "SEC", "texas a&m aggies": "SEC",
    "vanderbilt": "SEC", "vanderbilt commodores": "SEC",
    "oklahoma": "SEC", "oklahoma sooners": "SEC",
    "texas": "SEC", "texas longhorns": "SEC",
    # ── ACC ────────────────────────────────────────────────────────────────────
    "boston college": "ACC", "clemson": "ACC", "duke": "ACC",
    "florida state": "ACC", "georgia tech": "ACC", "louisville": "ACC",
    "miami": "ACC", "north carolina": "ACC", "nc state": "ACC",
    "north carolina state": "ACC", "notre dame": "ACC", "pittsburgh": "ACC",
    "syracuse": "ACC", "virginia": "ACC", "virginia tech": "ACC",
    "wake forest": "ACC", "stanford": "ACC", "california": "ACC", "smu": "ACC",
    # ── Big 12 ─────────────────────────────────────────────────────────────────
    "baylor": "Big 12", "byu": "Big 12", "cincinnati": "Big 12",
    "houston": "Big 12", "iowa state": "Big 12", "kansas": "Big 12",
    "kansas state": "Big 12", "oklahoma state": "Big 12", "tcu": "Big 12",
    "texas tech": "Big 12", "ucf": "Big 12", "west virginia": "Big 12",
    "arizona": "Big 12", "arizona state": "Big 12",
    "utah": "Big 12", "colorado": "Big 12",
    # ── Big Ten ────────────────────────────────────────────────────────────────
    "illinois": "Big Ten", "indiana": "Big Ten", "iowa": "Big Ten",
    "maryland": "Big Ten", "michigan": "Big Ten", "michigan state": "Big Ten",
    "minnesota": "Big Ten", "nebraska": "Big Ten", "northwestern": "Big Ten",
    "ohio state": "Big Ten", "penn state": "Big Ten", "purdue": "Big Ten",
    "rutgers": "Big Ten", "oregon": "Big Ten", "oregon state": "Big Ten",
    "washington": "Big Ten", "ucla": "Big Ten", "usc": "Big Ten",
    # ── AAC ────────────────────────────────────────────────────────────────────
    "east carolina": "AAC", "fau": "AAC", "florida atlantic": "AAC", "memphis": "AAC",
    "rice": "AAC", "south florida": "AAC", "usf": "AAC", "tulane": "AAC",
    "uab": "AAC", "wichita state": "AAC", "charlotte": "AAC",
    "temple": "AAC", "utsa": "AAC",
    # ── Sun Belt ───────────────────────────────────────────────────────────────
    "appalachian state": "Sun Belt", "arkansas state": "Sun Belt",
    "coastal carolina": "Sun Belt", "georgia southern": "Sun Belt",
    "georgia state": "Sun Belt", "james madison": "Sun Belt",
    "louisiana": "Sun Belt", "south alabama": "Sun Belt",
    "southern miss": "Sun Belt", "texas state": "Sun Belt",
    "troy": "Sun Belt", "marshall": "Sun Belt", "old dominion": "Sun Belt",
    "ulm": "Sun Belt", "little rock": "Sun Belt",
    # Note: UL Monroe and Little Rock are Sun Belt members
    # ── Mountain West ──────────────────────────────────────────────────────────
    "air force": "Mountain West", "boise state": "Mountain West",
    "fresno state": "Mountain West", "nevada": "Mountain West",
    "new mexico": "Mountain West", "san diego state": "Mountain West",
    "san jose state": "Mountain West", "unlv": "Mountain West",
    "hawaii": "Mountain West", "wyoming": "Mountain West",
    "colorado state": "Mountain West",
    # ── Conference USA ─────────────────────────────────────────────────────────
    "fiu": "CUSA", "louisiana tech": "CUSA", "middle tennessee": "CUSA",
    "western kentucky": "CUSA",
    "kennesaw state": "CUSA", "liberty": "CUSA", "new mexico state": "CUSA",
    "jacksonville state": "CUSA", "jsu": "CUSA",
    # ── Big West ───────────────────────────────────────────────────────────────
    "cal poly": "Big West", "cal state fullerton": "Big West",
    "cal state northridge": "Big West", "long beach state": "Big West",
    "uc davis": "Big West", "uc irvine": "Big West", "uc riverside": "Big West",
    "uc san diego": "Big West", "uc santa barbara": "Big West",
    # california baptist and grand canyon are now WAC (see WAC section)
    # ── Atlantic 10 ────────────────────────────────────────────────────────────
    "dayton": "Atlantic 10", "fordham": "Atlantic 10",
    "george mason": "Atlantic 10", "george washington": "Atlantic 10",
    "la salle": "Atlantic 10", "rhode island": "Atlantic 10",
    "richmond": "Atlantic 10", "saint bonaventure": "Atlantic 10",
    "saint joseph's": "Atlantic 10", "saint louis": "Atlantic 10",
    "umass": "Atlantic 10", "vcu": "Atlantic 10", "davidson": "Atlantic 10",
    # ── Southern ───────────────────────────────────────────────────────────────
    "east tennessee state": "Southern", "furman": "Southern",
    "mercer": "Southern", "the citadel": "Southern",
    "uncg": "Southern",
    "western carolina": "Southern", "wofford": "Southern",
    "samford": "Southern", "chattanooga": "Southern",
    "vmi": "Southern",
    # ── CAA ────────────────────────────────────────────────────────────────────
    "elon": "CAA", "hofstra": "CAA", "northeastern": "CAA",
    "stony brook": "CAA", "towson": "CAA", "william & mary": "CAA",
    "uncw": "CAA", "delaware": "CAA",
    "charleston": "CAA",
    # ── Missouri Valley ────────────────────────────────────────────────────────
    "bradley": "Missouri Valley", "dallas baptist": "Missouri Valley",
    "evansville": "Missouri Valley", "illinois state": "Missouri Valley",
    "indiana state": "Missouri Valley", "missouri state": "Missouri Valley",
    "murray state": "Missouri Valley", "southern illinois": "Missouri Valley",
    "valparaiso": "Missouri Valley", "belmont": "Missouri Valley",
    "southeastern louisiana": "Missouri Valley",
    # ── Ohio Valley ────────────────────────────────────────────────────────────
    "eastern illinois": "OVC", "morehead state": "OVC", "tennessee tech": "OVC",
    "tennessee-martin": "OVC", "austin peay": "OVC", "siu edwardsville": "OVC",
    "siue": "OVC",
    # eastern kentucky → ASUN; jackson state → SWAC; little rock → Sun Belt
    # ── West Coast ─────────────────────────────────────────────────────────────
    "gonzaga": "WCC", "loyola-marymount": "WCC", "pacific": "WCC",
    "pepperdine": "WCC", "portland": "WCC", "san diego": "WCC",
    "san francisco": "WCC", "santa clara": "WCC", "saint mary's college": "WCC",
    # ── America East ───────────────────────────────────────────────────────────
    "albany": "America East", "binghamton": "America East",
    "maine": "America East",
    "njit": "America East", "stonehill": "America East",
    "umbc": "America East", "umass-lowell": "America East",
    # maryland eastern shore is MEAC; not America East
    # ── Southland ──────────────────────────────────────────────────────────────
    "mcneese": "Southland", "nicholls": "Southland",
    "northwestern state": "Southland", "stephen f. austin": "Southland",
    "houston christian": "Southland", "incarnate word": "Southland",
    "new orleans": "Southland",
    # lamar moved to WAC in 2023 (see WAC section)
    # ── Patriot ────────────────────────────────────────────────────────────────
    "army": "Patriot", "bucknell": "Patriot", "colgate": "Patriot",
    "holy cross": "Patriot", "lafayette": "Patriot", "lehigh": "Patriot",
    "navy": "Patriot",
    # ── Atlantic Sun ───────────────────────────────────────────────────────────
    "bellarmine": "ASUN", "eastern kentucky": "ASUN",
    "fgcu": "ASUN", "jacksonville": "ASUN",
    "lipscomb": "ASUN", "north florida": "ASUN", "stetson": "ASUN",
    "north alabama": "ASUN",
    # high point → Big South (see below)
    # ── Big South ──────────────────────────────────────────────────────────────
    "campbell": "Big South", "charleston southern": "Big South",
    "gardner-webb": "Big South", "high point": "Big South",
    "longwood": "Big South", "presbyterian college": "Big South",
    "radford": "Big South", "unc asheville": "Big South",
    "winthrop": "Big South",
    "north carolina a&t": "Big South",
    # ── MAC ────────────────────────────────────────────────────────────────────
    "akron": "MAC", "ball state": "MAC", "bowling green": "MAC",
    "central michigan": "MAC", "eastern michigan": "MAC", "kent state": "MAC",
    "miami (oh)": "MAC", "northern illinois": "MAC", "ohio": "MAC",
    "toledo": "MAC", "western michigan": "MAC", "buffalo": "MAC",
    # ── Ivy League ─────────────────────────────────────────────────────────────
    "brown": "Ivy", "columbia": "Ivy", "cornell": "Ivy", "dartmouth": "Ivy",
    "harvard": "Ivy", "penn": "Ivy", "princeton": "Ivy", "yale": "Ivy",
    # ── MAAC ───────────────────────────────────────────────────────────────────
    "canisius": "MAAC", "fairfield": "MAAC", "iona": "MAAC",
    "manhattan": "MAAC", "marist": "MAAC", "monmouth": "MAAC",
    "niagara": "MAAC", "quinnipiac": "MAAC", "rider": "MAAC",
    "saint peter's": "MAAC", "siena": "MAAC",
    # ── Big East ───────────────────────────────────────────────────────────────
    "connecticut": "Big East", "creighton": "Big East",
    "georgetown": "Big East", "seton hall": "Big East",
    "st. john's": "Big East", "saint john's": "Big East",
    "villanova": "Big East", "butler": "Big East", "xavier": "Big East",
    # ── SWAC ───────────────────────────────────────────────────────────────────
    "alabama a&m": "SWAC", "alabama state": "SWAC",
    "alcorn state": "SWAC", "bethune-cookman": "SWAC",
    "coppin state": "SWAC", "delaware state": "SWAC",
    "florida a&m": "SWAC", "grambling state": "SWAC",
    "howard": "SWAC", "jackson state": "SWAC",
    "maryland eastern shore": "SWAC", "mississippi valley state": "SWAC",
    "morgan state": "SWAC", "norfolk state": "SWAC",
    "prairie view a&m": "SWAC",
    "savannah state": "SWAC", "southern": "SWAC",
    "texas southern": "SWAC",
    # ── WAC ────────────────────────────────────────────────────────────────────
    "abilene christian": "WAC", "california baptist": "WAC",
    "grand canyon": "WAC", "lamar": "WAC", "omaha": "WAC",
    "sam houston state": "WAC", "tarleton state": "WAC",
    "utrgv": "WAC", "utah tech": "WAC", "utah valley": "WAC",
    # ── Summit ─────────────────────────────────────────────────────────────────
    "north dakota state": "Summit", "oral roberts": "Summit",
    "denver": "Summit", "south dakota state": "Summit",
    "western illinois": "Summit",
    # ── Horizon ────────────────────────────────────────────────────────────────
    "detroit mercy": "Horizon", "iupui": "Horizon", "milwaukee": "Horizon",
    "northern kentucky": "Horizon", "oakland": "Horizon",
    "purdue fort wayne": "Horizon", "wright state": "Horizon",
    "youngstown state": "Horizon",
    # ── Northeast ──────────────────────────────────────────────────────────────
    "central connecticut": "Northeast", "fairleigh dickinson": "Northeast",
    "long island": "Northeast", "mount saint mary's": "Northeast",
    "sacred heart": "Northeast", "saint francis": "Northeast",
    "wagner": "Northeast", "le moyne": "Northeast",
    "merrimack": "Northeast", "queens": "Northeast",
    # ── CUSA (additional) ──────────────────────────────────────────────────────
    "florida international": "CUSA", "uta": "CUSA",
    # ── ESPN short-name / alternate-name aliases ────────────────────────────────
    # Sun Belt
    "app state": "Sun Belt", "appalachian st": "Sun Belt",
    "ga southern": "Sun Belt", "ga state": "Sun Belt",
    "james madison": "Sun Belt", "jmu": "Sun Belt",
    "ul monroe": "Sun Belt", "ulm": "Sun Belt",
    "s. alabama": "Sun Belt", "s alabama": "Sun Belt",
    "southern miss": "Sun Belt", "usm": "Sun Belt",
    "ark state": "Sun Belt", "arkansas st": "Sun Belt",
    # ACC
    "bc": "ACC", "gt": "ACC", "nc state": "ACC", "ncsu": "ACC",
    "pitt": "ACC", "fsu": "ACC", "fla state": "ACC",
    "nd": "ACC", "miami fl": "ACC", "miami (fl)": "ACC",
    "uva": "ACC", "vt": "ACC",
    # SEC
    "msst": "SEC", "miss state": "SEC", "miss st": "SEC",
    "texas a&m": "SEC", "tamu": "SEC", "a&m": "SEC",
    "ole miss": "SEC", "olemiss": "SEC",
    "s carolina": "SEC", "s. carolina": "SEC",
    "uk": "SEC",
    # Big 12
    "ok state": "Big 12", "okla state": "Big 12", "osu": "Big Ten",
    "ksu": "Big 12", "k-state": "Big 12", "kstate": "Big 12",
    "wvu": "Big 12", "ttu": "Big 12", "tcf": "Big 12",
    # Big Ten
    "mich state": "Big Ten", "msu": "Big Ten",
    "penn st": "Big Ten", "psu": "Big Ten",
    "nw": "Big Ten", "northwestern": "Big Ten",
    "neb": "Big Ten",
    # AAC
    "ecu": "AAC", "ucf": "Big 12", "usf": "AAC",
    "s florida": "AAC", "s. florida": "AAC",
    # Mountain West
    "sdsu": "Mountain West", "sjsu": "Mountain West",
    "nm": "Mountain West", "new mex": "Mountain West",
    "csu": "Mountain West", "col state": "Mountain West",
    # CUSA
    "mt": "CUSA", "middle tenn": "CUSA", "mtsu": "CUSA",
    "wku": "CUSA",
    # Big West
    "csuf": "Big West", "ucsb": "Big West", "ucr": "Big West",
    "ucsd": "Big West", "ucd": "Big West",
    # CAA
    "wm": "CAA", "william mary": "CAA", "w&m": "CAA",
    # ASUN
    "fgcu": "ASUN", "n florida": "ASUN", "n. florida": "ASUN",
}

_KNOWN_MASCOTS = [
    # Multi-word mascots first (order matters — longer matches take priority)
    "crimson tide", "tar heels", "demon deacons", "golden bears",
    "yellow jackets", "scarlet knights", "fighting illini", "blue devils",
    "nittany lions", "golden gophers", "horned frogs", "red raiders",
    "green wave", "red storm", "big green", "golden flash", "golden hurricane",
    "fighting camels", "golden eagles", "golden tigers", "golden bulls",
    "blue hens", "blue raiders", "purple aces", "purple eagles",
    "golden tornadoes", "big red", "ragin' cajuns", "ragin cajuns",
    "49ers", "flying fleet",
    # Single-word mascots
    "terrapins", "wolfpack", "buckeyes", "hoosiers", "wolverines",
    "tigers", "wildcats", "bulldogs", "gators", "seminoles", "cavaliers",
    "cowboys", "bears", "eagles", "hawks",
    "pirates", "cougars", "trojans", "bruins", "rebels", "volunteers",
    "commodores", "panthers", "flyers", "owls", "rams", "lions",
    "ducks", "huskies", "utes", "beavers", "longhorns", "razorbacks",
    "gamecocks", "aggies", "badgers", "boilermakers",
    "cardinals", "cardinal", "orange", "blue jays", "bearcats", "knights",
    "mountaineers", "sooners", "jayhawks",
    "spiders", "flames", "chanticleers", "warhawks",
    "musketeers", "bobcats", "redhawks", "rockets",
    "falcons", "broncos", "aztecs", "spartans",
    "cornhuskers", "hawkeyes", "dukes", "monarchs", "hatters",
    "dolphins", "hilltoppers", "shockers", "bulls", "highlanders",
    "matadors", "titans", "roadrunners", "anteaters", "tribe",
    "ospreys", "royals", "hoyas", "mustangs", "penguins",
    "lumberjacks", "colonels", "leathernecks", "fighting hawks",
    "sea hawks", "seahawks", "wave", "toreros", "gaels",
    "retrievers", "riverhawks", "mavericks", "bisons", "bison",
    "colonials", "raiders", "eagles", "pride", "skyhawks",
    "thunder", "warriors", "49ers", "antelopes", "lancers",
    "running eagles", "running rebels", "explorers", "quakers",
    "jaguars", "penguins", "eagles", "seawolves", "seawolves",
    "terriers", "crimson", "big green", "ephs", "mammoths",
    "stags", "bonnies", "billiken", "billikens", "friars", "hoyas",
    "lakers", "sea wolves", "sycamores", "peacocks", "chanticleers",
    "herons", "storm", "hatters", "dolphins", "monarchs", "pumas",
    "braves", "hawks", "chiefs", "running eagles",
]


def _strip_mascot(display_name: str) -> str:
    """'Missouri Tigers' -> 'Missouri', 'Nebraska Cornhuskers' -> 'Nebraska'.

    Resolution order:
    1. Check all known multi-word and single-word mascots (multi-word first).
    2. Strip last word as fallback for any unknown mascot suffix.
       This keeps school-state names intact for CONF_MAP exact lookup.
    """
    name = display_name.strip()
    low  = name.lower()
    # Known mascots (multi-word entries first to avoid partial matches)
    for m in _KNOWN_MASCOTS:
        if low.endswith(" " + m):
            return name[: -(len(m) + 1)].strip()
    # Fallback: strip last word (handles uncommon mascots like "Cornhuskers")
    parts = name.rsplit(" ", 1)
    if len(parts) == 2 and parts[0]:
        return parts[0].strip()
    return name


def _conf_for(display_name: str) -> str:
    """Look up conference from team display name.

    Resolution order:
    1. Exact match on cleaned display name ("florida state seminoles" in map).
    2. Exact match after mascot strip ("florida state" in map).
    3. Exact match on paren-stripped form ("miami (oh)" → "miami (oh)" or "miami").
    4. No substring/prefix guessing — prevents "florida" matching "florida atlantic".
    """
    clean = display_name.lower().strip()
    if clean in CONF_MAP:
        return CONF_MAP[clean]

    stripped = _strip_mascot(display_name).lower().strip()
    if stripped in CONF_MAP:
        return CONF_MAP[stripped]

    # Handle parenthetical suffixes like "Miami (OH)" → try "miami" after removing suffix
    no_paren = clean.split("(")[0].strip()
    if no_paren != clean and no_paren in CONF_MAP:
        return CONF_MAP[no_paren]

    stripped_no_paren = stripped.split("(")[0].strip()
    if stripped_no_paren != stripped and stripped_no_paren in CONF_MAP:
        return CONF_MAP[stripped_no_paren]

    return "Mid-Major"


def _fetch_url(url: str) -> dict | list | None:
    try:
        req = urllib.request.Request(url, headers=_HEADERS)
        with urllib.request.urlopen(req, timeout=12) as r:
            return json.loads(r.read())
    except Exception:
        return None


def _game_status(event: dict) -> tuple[str, int | None, int | None, int | None]:
    """Returns (status_str, inning, home_score, away_score)."""
    s = event.get("status", {})
    stype = s.get("type", {})
    name  = stype.get("name", "").lower()      # STATUS_FINAL, STATUS_IN_PROGRESS, etc.
    desc  = stype.get("description", "").lower()

    if "final" in name or "final" in desc:
        return "final", None, None, None
    if "postponed" in name or "postponed" in desc or "cancelled" in name:
        return "postponed", None, None, None
    if "progress" in name or "progress" in desc:
        # period is the inning number (int) for baseball; defensively coerce to int
        raw_inning = s.get("period") or s.get("displayClock")
        try:
            inning = int(raw_inning) if raw_inning is not None else None
        except (ValueError, TypeError):
            inning = None
        home_score = None
        away_score = None
        return "in_progress", inning, home_score, away_score
    return "scheduled", None, None, None


def _parse_events(events: list, top25: dict) -> list:
    results = []
    for ev in events:
        try:
            comps = ev.get("competitions", [])
            if not comps:
                continue
            comp = comps[0]
            competitors = comp.get("competitors", [])
            home = next((t for t in competitors if t.get("homeAway") == "home"), None)
            away = next((t for t in competitors if t.get("homeAway") == "away"), None)
            if not home or not away:
                continue

            home_team = home.get("team", {})
            away_team = away.get("team", {})
            home_name = home_team.get("displayName", "")
            away_name = away_team.get("displayName", "")

            status, inning, home_score, away_score = _game_status(ev)

            # Parse scores for in-progress games
            if status == "in_progress":
                try:
                    home_score = int(home.get("score", 0) or 0)
                    away_score = int(away.get("score", 0) or 0)
                except Exception:
                    pass

            # Skip finished/postponed games
            if status in ("final", "postponed"):
                continue

            home_abbr = home_team.get("abbreviation", "")
            away_abbr = away_team.get("abbreviation", "")
            rank_home = (top25.get(home_abbr)
                         or top25.get(home_name)
                         or top25.get(_strip_mascot(home_name)))
            rank_away = (top25.get(away_abbr)
                         or top25.get(away_name)
                         or top25.get(_strip_mascot(away_name)))

            venue = comp.get("venue", {}).get("fullName", "")

            results.append({
                "home":          home_name,
                "away":          away_name,
                "home_id":       home_team.get("id", ""),
                "away_id":       away_team.get("id", ""),
                "home_abbr":     home_team.get("abbreviation", ""),
                "away_abbr":     away_team.get("abbreviation", ""),
                "commence_time": ev.get("date", ""),
                "status":        status,
                "inning":        inning,
                "home_score":    home_score,
                "away_score":    away_score,
                "rank_home":     rank_home,
                "rank_away":     rank_away,
                "conference":    _conf_for(home_name),
                "venue":         venue,
            })
        except Exception:
            continue
    return results


def get_top25() -> dict[str, int]:
    """Return {espn_abbreviation_or_location: rank} for D1Baseball.com Top 25.

    Only the D1Baseball.com poll is used. Team objects in the rankings endpoint
    often have a null displayName; the abbreviation (e.g. "UCLA", "TEX") and
    location (e.g. "UCLA", "Texas") fields are more reliably populated and match
    the abbreviation/displayName returned by the scoreboard competitor objects.
    """
    data = _fetch_url(_RANKINGS_URL)
    rankings: dict[str, int] = {}
    if not data:
        return rankings
    for poll in data.get("rankings", []):
        poll_name = poll.get("name", "").lower()
        if "d1baseball" not in poll_name:
            continue  # Only use the D1Baseball.com poll explicitly
        for entry in poll.get("ranks", []):
            team = entry.get("team", {})
            abbr = team.get("abbreviation", "")
            loc  = team.get("location") or ""
            name = team.get("displayName") or ""
            rank = entry.get("current", 99)
            if abbr:
                rankings[abbr] = rank
            if loc and loc not in rankings:
                rankings[loc] = rank
            if name and name not in rankings:
                rankings[name] = rank
    return rankings


def get_espn_games(force: bool = False) -> list[dict]:
    """Return today's D1 NCAA baseball games (scheduled + in-progress)."""
    now = time.time()

    # Check disk cache
    if not force and os.path.exists(_CACHE_FILE):
        try:
            mtime = os.path.getmtime(_CACHE_FILE)
            if now - mtime < _CACHE_TTL:
                with open(_CACHE_FILE) as f:
                    return json.load(f)
        except Exception:
            pass

    top25  = get_top25()
    data   = _fetch_url(_SCOREBOARD_URL)
    events = data.get("events", []) if data else []
    games  = _parse_events(events, top25)

    # Save cache
    try:
        with open(_CACHE_FILE, "w") as f:
            json.dump(games, f)
    except Exception:
        pass

    return games
