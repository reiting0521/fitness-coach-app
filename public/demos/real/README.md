# Real ExerciseDB How-to GIFs

Local ExerciseDB form GIFs for Fitness Coach How-to. **Prefer these over SVG sequence demos.**

## Preference order (app)

1. **`demos/real/{planId}.gif`** + `mapping.json` (this pack) — real ExerciseDB media
2. Fallback: SVG start/mid/end sequences under `demos/{planId}/` only if a real GIF is missing

## Display

- Letterbox: background `#0B0C0E` (optional inner `#16181F`), `object-fit: contain`
- Show muted AscendAPI/ExerciseDB attribution (see `NOTICE.md` and mapping fields)

## Files

| File | Role |
|------|------|
| `*.gif` | One primary GIF per plan exercise id |
| `mapping.json` | plan id → ExerciseDB id/name, paths, letterbox, attribution |
| `NOTICE.md` | License / attribution requirements |

Plan coverage: Wednesday Legs (5) + Friday Back (5).
