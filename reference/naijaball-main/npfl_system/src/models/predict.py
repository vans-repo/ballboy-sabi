import os, joblib, pandas as pd
from src.utils.config import load
from src.utils.helpers import log, travel_distance, fuzzy_match
from src.features.engineering import TeamTracker

class Predictor:
    def __init__(self,trackers=None):
        cfg=load(); self.cfg=cfg; self.features=cfg["features"]
        self.model=joblib.load(cfg["paths"]["model"]); self.classes=list(self.model.classes_)
        self.trackers=trackers if trackers is not None else self._rebuild_trackers()
        self.team_names=list(self.trackers.keys())

    def _rebuild_trackers(self):
        log.info("Predictor: rebuilding trackers…")
        proc=self.cfg["paths"]["processed"]; raw=self.cfg["paths"]["raw"]
        path=proc if os.path.exists(proc) else raw
        df=pd.read_csv(path)
        df["Date_Obj"]=pd.to_datetime(df["Date"],format="%d/%m/%Y",errors="coerce")
        df=df[df["Date_Obj"].notna()].sort_values("Date_Obj").reset_index(drop=True)
        trackers={}
        for _,m in df.iterrows():
            h,a=m["Home_Team"],m["Away_Team"]
            trackers.setdefault(h,TeamTracker(self.cfg,h))
            trackers.setdefault(a,TeamTracker(self.cfg,a))
            hg,ag=int(m["Home_Goals"]),int(m["Away_Goals"])
            hp=3 if hg>ag else(1 if hg==ag else 0); ap=3 if ag>hg else(1 if hg==ag else 0)
            trackers[h].record_result(m["Date_Obj"],hp,hg,ag)
            trackers[a].record_result(m["Date_Obj"],ap,ag,hg)
        return trackers

    def predict(self,home,away):
        import datetime
        home_c=fuzzy_match(home,self.team_names); away_c=fuzzy_match(away,self.team_names)
        today=pd.Timestamp(datetime.date.today())
        hs=self.trackers.get(home_c,TeamTracker(self.cfg,home_c)).get_pre_match_stats(today)
        as_=self.trackers.get(away_c,TeamTracker(self.cfg,away_c)).get_pre_match_stats(today)
        td=travel_distance(home_c,away_c)
        fv=pd.DataFrame([{"Home_Form_Pts":hs["form_pts"],"Away_Form_Pts":as_["form_pts"],
            "Home_Rest_Days":hs["rest_days"],"Away_Rest_Days":as_["rest_days"],
            "Home_Attack_L5":hs["goals_l5"],"Away_Defense_L5":as_["conceded_l5"],
            "Travel_Distance_Km":td,"Home_Quality":hs["quality"],"Away_Quality":as_["quality"]}])[self.features]
        proba=self.model.predict_proba(fv)[0]; probs=dict(zip(self.classes,proba))
        pred=max(probs,key=probs.get)
        return {"home":home_c,"away":away_c,"prediction":pred,"confidence":max(proba),
            "probabilities":probs,"travel_km":td,"home_quality":hs["quality"],
            "away_quality":as_["quality"],"home_form":hs["form_pts"],"away_form":as_["form_pts"],
            "cold_start_home":home_c not in self.trackers,"cold_start_away":away_c not in self.trackers}

    def print_prediction(self,home,away):
        r=self.predict(home,away)
        conf=f"{r['confidence']:.1%}"; travel=f"{r['travel_km']} km"
        print()
        print("╔"+"═"*58+"╗")
        print(f"║  MATCH PREDICTION{'':<40}║")
        print("╠"+"═"*58+"╣")
        print(f"║  {r['home']:<25}  vs  {r['away']:<22}║")
        print("╠"+"═"*58+"╣")
        print(f"║  Prediction   : {r['prediction']:<40}║")
        print(f"║  Confidence   : {conf:<40}║")
        print(f"║  Travel (away): {travel:<40}║")
        print("╠"+"═"*58+"╣")
        for outcome,prob in sorted(r["probabilities"].items(),key=lambda x:-x[1]):
            bar="█"*int(prob*30); pstr=f"{prob:.1%}"
            print(f"║  {outcome:<12} {pstr}  {bar:<33}║")
        print("╚"+"═"*58+"╝")
        print()