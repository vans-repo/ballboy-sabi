import joblib, pandas as pd
from sklearn.metrics import accuracy_score, classification_report, log_loss
from src.utils.config import load
from src.utils.helpers import log

def run(verbose=True):
    cfg=load(); src=cfg["paths"]["features"]; model_p=cfg["paths"]["model"]
    features=cfg["features"]; target=cfg["target"]; mp=cfg["model"]
    df=pd.read_csv(src).dropna(subset=features+[target])
    split=int(len(df)*(1-mp["test_size"]))
    X_train=df.iloc[:split][features]; y_train=df.iloc[:split][target]
    X_test=df.iloc[split:][features];  y_test=df.iloc[split:][target]
    model=joblib.load(model_p); preds=model.predict(X_test); proba=model.predict_proba(X_test)
    tr_acc=accuracy_score(y_train,model.predict(X_train)); te_acc=accuracy_score(y_test,preds)
    if verbose:
        print("\n"+"="*60)
        print("  MODEL EVALUATION REPORT")
        print("="*60)
        print(f"  Train: {len(X_train)} rows | Test: {len(X_test)} rows")
        print(f"  Train accuracy: {tr_acc:.2%}")
        print(f"  Test  accuracy: {te_acc:.2%}")
        print(f"  Overfit gap:    {tr_acc-te_acc:.2%}")
        print(f"  Log-loss:       {log_loss(y_test,proba):.4f}")
        print(); print(classification_report(y_test,preds,digits=4))
        if hasattr(model,"feature_importances_"):
            print("-"*60+"\n  FEATURE IMPORTANCE\n"+"-"*60)
            fi=sorted(zip(features,model.feature_importances_),key=lambda x:-x[1])
            for fname,imp in fi:
                print(f"  {fname:<25} {imp:.1%}  {"█"*int(imp*200)}")
        print("="*60+"\n")
    return {"train_accuracy":tr_acc,"test_accuracy":te_acc,"overfit_gap":tr_acc-te_acc}