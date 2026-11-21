import os, pandas as pd
from src.utils.config import load
from src.utils.helpers import log, travel_distance

class TeamTracker:
    def __init__(self,cfg,team_name):
        self.name=team_name; self.history=[]; self.cfg=cfg
        self._fw=cfg["engineering"]["form_window"]
        self._qw=cfg["engineering"]["quality_window"]
        self._qmin=cfg["engineering"]["quality_min"]
        self._qmax=cfg["engineering"]["quality_max"]
        self._override=cfg.get("reality_override",{}).get(team_name)

    def get_pre_match_stats(self,current_date):
        if not self.history:
            return dict(form_pts=7,goals_l5=5,conceded_l5=6,
                        rest_days=self.cfg["engineering"]["rest_default"],
                        quality=self._override if self._override else 0.65)
        last=self.history[-1]["date"]
        rest=max(0,(current_date-last).days)
        wf=self.history[-self._fw:]
        fp=sum(m["pts"] for m in wf); gl=sum(m["gf"] for m in wf); cl=sum(m["ga"] for m in wf)
        wq=self.history[-self._qw:]
        ppg=sum(m["pts"] for m in wq)/(len(wq)*3)
        q=round(min(self._qmax,max(self._qmin,ppg*self._qmax+0.3)),2)
        if self._override is not None and len(self.history)<self._qw:
            q=self._override
        return dict(form_pts=fp,goals_l5=gl,conceded_l5=cl,rest_days=rest,quality=q)

    def record_result(self,date,pts,gf,ga):
        self.history.append(dict(date=date,pts=pts,gf=gf,ga=ga))

def run():
    cfg=load(); src=cfg["paths"]["processed"]; dest=cfg["paths"]["features"]
    log.info(f"Engineering: reading {src}")
    df=pd.read_csv(src)
    df["Date_Obj"]=pd.to_datetime(df["Date"],format="%d/%m/%Y",errors="coerce")
    df=df[df["Date_Obj"].notna()].sort_values("Date_Obj").reset_index(drop=True)
    trackers={}; rows=[]
    for _,m in df.iterrows():
        h,a=m["Home_Team"],m["Away_Team"]
        trackers.setdefault(h,TeamTracker(cfg,h))
        trackers.setdefault(a,TeamTracker(cfg,a))
        hs=trackers[h].get_pre_match_stats(m["Date_Obj"])
        as_=trackers[a].get_pre_match_stats(m["Date_Obj"])
        td=travel_distance(h,a)
        rows.append({"Date":m["Date"],"Home_Team":h,"Away_Team":a,
            "Home_Goals":m["Home_Goals"],"Away_Goals":m["Away_Goals"],"Outcome":m["Outcome"],
            "Home_Form_Pts":hs["form_pts"],"Away_Form_Pts":as_["form_pts"],
            "Home_Rest_Days":hs["rest_days"],"Away_Rest_Days":as_["rest_days"],
            "Home_Attack_L5":hs["goals_l5"],"Away_Defense_L5":as_["conceded_l5"],
            "Travel_Distance_Km":td,"Home_Quality":hs["quality"],"Away_Quality":as_["quality"]})
        hg,ag=int(m["Home_Goals"]),int(m["Away_Goals"])
        hp=3 if hg>ag else(1 if hg==ag else 0); ap=3 if ag>hg else(1 if hg==ag else 0)
        trackers[h].record_result(m["Date_Obj"],hp,hg,ag)
        trackers[a].record_result(m["Date_Obj"],ap,ag,hg)
    master=pd.DataFrame(rows)
    os.makedirs(os.path.dirname(dest),exist_ok=True)
    master.to_csv(dest,index=False)
    log.info(f"  Engineered: {len(master)} rows -> {dest}")
    return master, trackers