# Garage site data format

The site is static. Everything it shows comes from the JSON files in `data/` and the documents in `files/`. You can edit these by hand, a Claude session can edit them, or the site edits them for you (it commits through the GitHub API).

All dates use `YYYY-MM-DD`. IDs are lowercase kebab-case and never change once created, because other records point at them.

## Layout

```
data/
  index.json              list of projects, in display order
  car.json                the vehicle spec sheet
  log.json                work log, measurements, findings
  projects/<id>.json      one file per project
files/<project-id>/...    guides, diagrams, photos, PDFs for that project
files/car/...             photos and docs about the car itself
```

## data/index.json

```json
{ "updated": "2026-11-13", "projects": ["engine-302", "wiring"] }
```

## data/car.json

```json
{
  "name": "1966 Mustang",
  "subtitle": "Hardtop · Blue",
  "updated": "2026-11-13",
  "sections": [
    {
      "id": "engine",
      "title": "Engine",
      "fields": [
        {
          "label": "Engine",
          "value": "1968 Ford 302 V8 (from a Fairlane)",
          "notes": "",
          "updated": "2026-11-13",
          "history": [ { "date": "2026-11-13", "value": "previous value" } ]
        }
      ]
    }
  ]
}
```

Standard section ids: `overview`, `engine`, `ignition`, `transmission`, `rear-end`, `suspension-steering`, `brakes`, `wheels-tires`, `electrical`, `audio-gauges`, `body-paint`, `interior`, `fluids-capacities`, `references`. A section can have zero fields. When a value changes, push the old `{date, value}` onto `history` (newest first).

Unknown values: put `"Unknown"` as the value and say what would answer it in `notes`.

## data/projects/&lt;id&gt;.json

```json
{
  "id": "engine-302",
  "title": "Engine: rear main seal & bottom-end refresh",
  "area": "engine",
  "status": "active",
  "goal": "One or two sentences: what done looks like.",
  "summary": "Short paragraph: background and current state.",
  "next_step": "The single next thing to do.",
  "started": "2026-10-20",
  "updated": "2026-11-13",
  "links": [ { "label": "Live guide (Claude)", "url": "https://..." } ],
  "files": [
    { "path": "files/engine-302/guide/guide.html", "title": "Rear main seal guide",
      "kind": "guide", "primary": true, "caption": "" }
  ],
  "subprojects": [
    {
      "id": "rear-main-seal",
      "title": "Rear main seal",
      "status": "todo",
      "goal": "",
      "summary": "",
      "blocked_by": "",
      "depends_on": ["teardown", "wiring/dash-reassembly"],
      "files": ["files/engine-302/diagrams/05-rear-seal-joint-offset.png"],
      "notes": ["Free-text notes, warnings, incidents (prefix incidents with the date)."],
      "tasks": [
        {
          "id": "clean-silicone",
          "text": "Clean every trace of silicone out of the block and cap grooves",
          "detail": "Optional longer how-to text (markdown allowed).",
          "done": false,
          "done_date": null,
          "est_min": 60,
          "est_guess": true,
          "needs_parts": ["rear-main-seal"],
          "needs_tools": [],
          "confirm": false
        }
      ]
    }
  ],
  "parts": [
    { "id": "rear-main-seal", "name": "Two-piece rear main seal, 289/302", "status": "needed",
      "qty": 1, "vendor": "", "part_number": "", "price": null, "url": "", "notes": "" }
  ],
  "tools": [ { "id": "torque-wrench", "name": "Torque wrench 10-90 ft-lb", "status": "needed", "notes": "" } ],
  "specs": [
    { "item": "Main cap bolts", "value": "60-70", "unit": "ft-lb", "min": 60, "max": 70, "notes": "" }
  ],
  "decisions": [ { "date": "2026-10-25", "text": "..." } ],
  "open_questions": [ { "text": "...", "resolved": false, "answer": "" } ],
  "sources": [ { "title": "...", "url": "..." } ]
}
```

Field rules:

- `area` is one of: `engine`, `electrical`, `drivetrain`, `suspension-steering`, `brakes`, `cooling`, `fuel`, `exhaust`, `body-paint`, `interior`, `wheels-tires`, `general`.
- Project `status`: `active`, `paused`, `done`, `idea`.
- Sub-project `status`: `todo`, `in_progress`, `blocked`, `done`. Use `blocked` with a `blocked_by` sentence when it waits on parts, tools, or another sub-project.
- `depends_on` lists sub-projects that must be `done` first. Use `"sub-id"` within the same project, or `"project-id/sub-id"` for another project. Until they're done, the sub-project's tasks stay off the Today list.
- Task fields:
  - `est_min` is the estimated minutes. `est_guess: true` means someone guessed it and the owner hasn't confirmed it.
  - `confirm: true` means a chat marked the task's state as uncertain.
  - `needs_parts` and `needs_tools` hold part and tool ids from the same project. A task counts as "waiting" while any part it needs isn't `on_hand` or `installed`.
- Part `status`: `needed`, `in_cart`, `ordered`, `on_hand`, `installed`, `skip`.
- Tool `status`: `needed`, `have`, `borrow`, `rent`.
- Specs:
  - `min` and `max` are numbers when the value is a numeric range. The site uses them to check logged measurements. Leave them out otherwise.
  - Store values in the units given, as decimal inches, so `.004` and not `0.004 in.`.
- File `kind`: `guide`, `sheet`, `diagram`, `photo`, `pdf`, `reference`, `list`. Mark one file `"primary": true` per project. That's the main work guide, and it gets its own button.
- `.md` files render as formatted text. `.html` files open as full pages. `.csv` files render as tables.

## data/log.json

```json
{
  "entries": [
    {
      "id": "2026-11-12-circuit-11-short",
      "date": "2026-11-12",
      "kind": "finding",
      "project": "wiring",
      "subproject": "parking-light-short",
      "area": "electrical",
      "title": "Short on circuit 11 isolated",
      "text": "Markdown body.",
      "measurements": [
        { "what": "Wire 11 to ground", "location": "passenger front socket",
          "value": 0.4, "unit": "ohm", "spec_ref": null, "min": null, "max": null }
      ],
      "photos": [],
      "cost": null,
      "odometer": null,
      "task": null
    }
  ]
}
```

- `kind` is one of `work` (did something), `measurement`, `finding` (learned something), `incident` (something went wrong), `purchase`, `note`.
- `task` is `"subproject-id/task-id"` when the entry came from finishing a task.
- `spec_ref` is the `item` name of a spec in the same project. When it's set, or when `min`/`max` are set, the site marks the reading in or out of spec.
- Entries can be in any order. The site sorts them.

## Adding a project from a Claude chat

Ask the chat for a zip containing a project JSON in the format above, plus its files under `files/<project-id>/`. Then:

1. Put the files in place.
2. Add the id to `data/index.json`.
3. Push.
