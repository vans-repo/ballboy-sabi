"""
main.py — NaijaBall Analytics Platform CLI

python main.py pipeline                            # clean → engineer → train → evaluate
python main.py train                               # retrain only
python main.py evaluate                            # evaluate saved model
python main.py predict "Enugu Rangers" "Enyimba"   # predict a fixture
python main.py update results.txt                  # ingest new dump + retrain
python main.py demo                                # 5 sample predictions
"""
import sys

def cmd_pipeline():
    from src.data.cleaner import run as clean
    from src.features.engineering import run as engineer
    from src.models.train import run as train
    from src.models.evaluate import run as evaluate
    print("\n── Step 1/4: Cleaning ──"); clean()
    print("\n── Step 2/4: Engineering ──"); engineer()
    print("\n── Step 3/4: Training ──"); train()
    print("\n── Step 4/4: Evaluating ──"); evaluate()

def cmd_train():
    from src.models.train import run as train
    from src.models.evaluate import run as evaluate
    train(); evaluate()

def cmd_evaluate():
    from src.models.evaluate import run as evaluate
    evaluate()

def cmd_predict(home, away):
    from src.models.predict import Predictor
    Predictor().print_prediction(home, away)

def cmd_update(dump_path):
    import re, shutil, pandas as pd
    from datetime import datetime
    from src.utils.config import load
    from src.utils.helpers import log, normalise_name
    from src.data.cleaner import run as clean
    from src.features.engineering import run as engineer
    from src.models.train import run as train
    from src.models.evaluate import run as evaluate

    DATE_PAT  = re.compile(r"^\d{2}\.\d{2}\.\d{4}$")
    SCORE_PAT = re.compile(r"^\d+:\d+$")
    cfg = load(); raw_path = cfg["paths"]["raw"]

    with open(dump_path, encoding="utf-8-sig") as f:
        text = f.read()

    lines = [l.strip() for l in text.splitlines() if l.strip()]
    matches = []; current_date = None
    for i, line in enumerate(lines):
        if DATE_PAT.match(line): current_date = line; continue
        if line.lower().startswith(("round","week")): continue
        if SCORE_PAT.match(line):
            h,a = int(line.split(":")[0]),int(line.split(":")[1])
            if h>20 or a>20 or i==0 or i>=len(lines)-1: continue
            home_raw,away_raw = lines[i-1],lines[i+1]
            if DATE_PAT.match(home_raw) or SCORE_PAT.match(home_raw): continue
            if DATE_PAT.match(away_raw) or SCORE_PAT.match(away_raw): continue
            home=normalise_name(home_raw); away=normalise_name(away_raw)
            if home==away or current_date is None: continue
            outcome="Home Win" if h>a else("Away Win" if a>h else "Draw")
            matches.append({"Date":current_date.replace(".","/"),"Home_Team":home,
                "Away_Team":away,"Home_Goals":h,"Away_Goals":a,"Outcome":outcome})

    new_df = pd.DataFrame(matches)
    log.info(f"Parsed: {len(new_df)} matches")
    if new_df.empty: print("Nothing parsed."); return

    import os
    if os.path.exists(raw_path):
        existing = pd.read_csv(raw_path, dtype=str)
        keys = set(zip(existing["Date"].str.strip(),existing["Home_Team"].str.strip(),existing["Away_Team"].str.strip()))
    else:
        existing = pd.DataFrame(); keys = set()

    new_df["_k"] = list(zip(new_df["Date"],new_df["Home_Team"],new_df["Away_Team"]))
    unique = new_df[~new_df["_k"].isin(keys)].drop(columns="_k")
    log.info(f"New unique: {len(unique)}")
    if unique.empty: print("Already up to date."); return

    if os.path.exists(raw_path):
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        shutil.copy(raw_path, raw_path.replace(".csv",f"_backup_{ts}.csv"))

    combined = pd.concat([existing, unique], ignore_index=True)
    combined["Date_Obj"] = pd.to_datetime(combined["Date"],format="%d/%m/%Y",errors="coerce")
    combined = combined[combined["Date_Obj"].notna()].sort_values("Date_Obj").drop(columns="Date_Obj").reset_index(drop=True)
    os.makedirs(os.path.dirname(raw_path),exist_ok=True)
    combined.to_csv(raw_path, index=False)
    log.info(f"Saved {len(combined)} total rows")

    print(f"\n── {len(unique)} new matches — rerunning pipeline ──")
    clean(); engineer(); train(); evaluate()

def cmd_demo():
    from src.models.predict import Predictor
    print("\nLoading model…"); p = Predictor()
    for home,away in [
        ("Enugu Rangers","Rivers United"),("Kano Pillars","Plateau United"),
        ("Enyimba","Shooting Stars"),("Nasarawa United","Kwara United"),
        ("Bendel Insurance","Barau")]:
        p.print_prediction(home,away)

if __name__ == "__main__":
    if len(sys.argv)<2: print(__doc__); sys.exit(0)
    cmd = sys.argv[1].lower()
    if cmd=="pipeline": cmd_pipeline()
    elif cmd=="train": cmd_train()
    elif cmd=="evaluate": cmd_evaluate()
    elif cmd=="predict":
        if len(sys.argv)<4: print('Usage: python main.py predict "Home" "Away"'); sys.exit(1)
        cmd_predict(sys.argv[2],sys.argv[3])
    elif cmd=="update":
        if len(sys.argv)<3: print("Usage: python main.py update <dump.txt>"); sys.exit(1)
        cmd_update(sys.argv[2])
    elif cmd=="demo": cmd_demo()
    else: print(f"Unknown: {cmd}\n"); print(__doc__); sys.exit(1)