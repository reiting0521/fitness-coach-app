# Demo media attribution

## Visual Artist (preferred How-to demos)

SVG sequence strips and start/mid/end frames under `public/demos/va/` are
Iron Quiet Visual Artist assets (charcoal stage, motion cues). Sourced from
`/workspace/fitness-design/demos/` and shipped locally for Wed Legs + Fri Back.

How-to priority: **sequence.svg** → start/mid/end frames → legacy GIF.

## Legacy fallbacks

Looping GIFs under `public/demos/*.gif` are sourced from the
[Aquariius/exercises-dataset](https://github.com/Aquariius/exercises-dataset)
ExerciseDB-derived media set (Gym Visual / ExerciseDB lineage). Used only when
a Visual Artist asset is missing for that exercise.

Still frames (`*/0.jpg`, `*/1.jpg`) are from
[yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db)
(public-domain exercise photos).

Shipped locally so the app does not hotlink at runtime.
