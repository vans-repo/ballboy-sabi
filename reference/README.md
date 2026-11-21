# Reference material (read-only)

Source material from the earlier project. Used only for team coordinates,
name aliases, source data and the design look. The app and the model never
import it at runtime; the seed script reads the CSVs from here.

| File | Source |
| --- | --- |
| `npfl_historical_data.csv` | Owner's Google Drive. 2021/22 to 2024/25, no dates. |
| `naijaball-main/` | github.com/amarpepeadum/naijaball (owner's repo), without `models/npfl_brain.pkl`, which the spec says must not be reused. |

Lost, confirmed by the owner:

- `evaluate_models.py`: rebuilt from the spec's description in Stage 3.
- `fixtures_2026_27.csv`: can't be rebuilt, because it's real fixture data. The owner
  supplies it from the official NPFL fixture list as `data/fixtures_2026_27.csv`
  (template: `data/fixtures_2026_27.template.csv`).
