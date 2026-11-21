import os, joblib, pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score
from xgboost import XGBClassifier
from sklearn.preprocessing import LabelEncoder
from src.utils.config import load
from src.utils.helpers import log

def run():
    cfg=load(); src=cfg["paths"]["features"]; model_p=cfg["paths"]["model"]
    enc_p=cfg["paths"]["encoder"]; features=cfg["features"]; target=cfg["target"]; mp=cfg["model"]
    df=pd.read_csv(src).dropna(subset=features+[target])
    split=int(len(df)*(1-mp["test_size"]))
    X_train=df.iloc[:split][features]; y_train=df.iloc[:split][target]
    X_test=df.iloc[split:][features];  y_test=df.iloc[split:][target]
    log.info(f"Train: {len(X_train)} train / {len(X_test)} test")
    le=LabelEncoder().fit(y_train)
    contenders={
        "Logistic Regression":LogisticRegression(max_iter=2000,random_state=mp["random_state"],solver="lbfgs"),
        "Random Forest":RandomForestClassifier(n_estimators=mp["n_estimators"],max_depth=mp["max_depth"],
            min_samples_leaf=mp["min_samples_leaf"],random_state=mp["random_state"],n_jobs=-1),
        "XGBoost":XGBClassifier(n_estimators=200,max_depth=6,learning_rate=0.1,
            random_state=mp["random_state"],use_label_encoder=False,eval_metric="mlogloss",verbosity=0),
    }
    results={}
    for name,model in contenders.items():
        if name=="XGBoost":
            model.fit(X_train,le.transform(y_train)); preds=le.inverse_transform(model.predict(X_test))
        else:
            model.fit(X_train,y_train); preds=model.predict(X_test)
        acc=accuracy_score(y_test,preds); results[name]={"model":model,"acc":acc}
        log.info(f"  {name:<25} {acc:.2%}")
    winner_name=max(results,key=lambda k:results[k]["acc"])
    winner=results[winner_name]["model"]; best_acc=results[winner_name]["acc"]
    log.info(f"  Winner: {winner_name} ({best_acc:.2%})")
    if best_acc<mp["min_accuracy"]:
        log.error(f"  REJECTED — below threshold. Keeping existing model."); return None,results
    os.makedirs(os.path.dirname(model_p),exist_ok=True)
    joblib.dump(winner,model_p); joblib.dump(le,enc_p)
    log.info(f"  Saved: {model_p}")
    return winner,results