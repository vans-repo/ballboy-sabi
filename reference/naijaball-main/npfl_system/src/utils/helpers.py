import math, logging, difflib
from src.utils.config import load
logging.basicConfig(level=logging.INFO,format="%(asctime)s  %(levelname)-7s  %(message)s",datefmt="%H:%M:%S")
log = logging.getLogger("najaball")

ALIAS_MAP = {
    "enyimba aba":"Enyimba","enyimba fc":"Enyimba","3sc":"Shooting Stars",
    "3sc ibadan":"Shooting Stars","shooting stars sc":"Shooting Stars",
    "kwara":"Kwara United","kwara fc":"Kwara United","barau fc":"Barau",
    "kun khalifat fc":"Kun Khalifat","doma fc":"Doma United FC",
    "doma united":"Doma United FC","doma united fc":"Doma United FC",
    "rivers united fc":"Rivers United","kano pillars fc":"Kano Pillars",
    "enugu rangers fc":"Enugu Rangers","nasarawa united fc":"Nasarawa United",
    "plateau united fc":"Plateau United","bendel insurance fc":"Bendel Insurance",
    "ikorodu city fc":"Ikorodu City","abia warriors fc":"Abia Warriors",
    "niger tornadoes fc":"Niger Tornadoes","warri wolves fc":"Warri Wolves",
    "katsina united fc":"Katsina United","wikki tourists fc":"Wikki Tourists",
    "el-kanemi warriors":"El-Kanemi Warriors","el kanemi warriors":"El-Kanemi Warriors",
    "remo stars fc":"Remo Stars","bayelsa united fc":"Bayelsa United",
    "akwa united fc":"Akwa United","sporting lagos fc":"Sporting Lagos",
}

def normalise_name(raw):
    key = raw.strip().lower()
    if key in ALIAS_MAP: return ALIAS_MAP[key]
    for s in [" fc"," sc"," f.c."," s.c."]:
        if key.endswith(s): key=key[:-len(s)].strip()
    return raw.strip().title()

def fuzzy_match(name, candidates, cutoff=0.6):
    normed = normalise_name(name)
    m = difflib.get_close_matches(normed, candidates, n=1, cutoff=cutoff)
    return m[0] if m else normed

def haversine(c1, c2):
    lat1,lon1=map(math.radians,c1); lat2,lon2=map(math.radians,c2)
    dlat,dlon=lat2-lat1,lon2-lon1
    a=math.sin(dlat/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return 2*math.asin(math.sqrt(a))*6371

def travel_distance(home_team, away_team):
    cfg=load()
    coords=cfg["team_coords"]; default=cfg["default_coord"]
    flying=cfg.get("flying_clubs",[])
    road_f=cfg["travel"]["road_factor"]; flight_f=cfg["travel"]["flight_factor"]
    min_fly=cfg["travel"]["flight_min_km"]
    h=coords.get(home_team,default); a=coords.get(away_team,default)
    raw=haversine(h,a)
    flies=raw>min_fly and away_team in flying
    return round(raw*(flight_f if flies else road_f),1)