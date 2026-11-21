import yaml, os
_cfg = None
def load(path=None):
    global _cfg
    if _cfg: return _cfg
    if path is None:
        here = os.path.dirname(os.path.abspath(__file__))
        path = os.path.join(here,"..","..","config","config.yaml")
    with open(path,encoding="utf-8") as f:
        _cfg = yaml.safe_load(f)
    return _cfg
def reload(path=None):
    global _cfg; _cfg = None; return load(path)