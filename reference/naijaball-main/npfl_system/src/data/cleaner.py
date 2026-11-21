import pandas as pd, os
from src.utils.config import load
from src.utils.helpers import log, normalise_name

def run():
    cfg=load(); src=cfg["paths"]["raw"]; dest=cfg["paths"]["processed"]
    log.info(f"Cleaner: reading {src}")
    df=pd.read_csv(src,dtype=str); before=len(df)
    df["Home_Team"]=df["Home_Team"].str.strip().apply(normalise_name)
    df["Away_Team"]=df["Away_Team"].str.strip().apply(normalise_name)
    df["Date_Obj"]=pd.to_datetime(df["Date"],format="%d/%m/%Y",errors="coerce")
    df=df[df["Date_Obj"].notna()].copy()
    for col in ("Home_Goals","Away_Goals"):
        df[col]=pd.to_numeric(df[col],errors="coerce")
    df=df[df["Home_Goals"].notna()&df["Away_Goals"].notna()].copy()
    df["Home_Goals"]=df["Home_Goals"].astype(int); df["Away_Goals"]=df["Away_Goals"].astype(int)
    junk={"resch.","dec.","unknown","tbd",""}
    mask=df["Home_Team"].str.lower().isin(junk)|df["Away_Team"].str.lower().isin(junk)
    df=df[~mask].copy()
    if "Outcome" not in df.columns:
        df["Outcome"]=df.apply(lambda r:"Home Win" if r["Home_Goals"]>r["Away_Goals"] else("Away Win" if r["Away_Goals"]>r["Home_Goals"] else "Draw"),axis=1)
    df=df.drop_duplicates(subset=["Date","Home_Team","Away_Team"],keep="first")
    df=df.sort_values("Date_Obj").drop(columns="Date_Obj").reset_index(drop=True)
    os.makedirs(os.path.dirname(dest),exist_ok=True)
    df.to_csv(dest,index=False)
    log.info(f"  Cleaned: {before} -> {len(df)} rows -> {dest}")
    return df