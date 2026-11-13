---
name: garage
description: Hands-on help with the owner's 1966 Mustang projects, then updating the Shop Book website. Use when the owner describes a problem, symptom, reading or progress on the car ("having an issue with the turn signals", "measured the journals", "what should I do next on the engine", "I finished X"), asks for next steps on a project, or wants the site updated with work done.
---

# Garage session

The owner is at or near the car. They know their way around tools and like straight, specific answers. Work the problem with them the way a sharp mechanic friend would. When the session ends, record what happened in the repo so the website at https://sbrown70.github.io/shop-book/ shows it.

## 1. Get up to speed (quietly, fast)

1. Run `git pull --rebase`. The website commits to `main` from the owner's phone.
   - If git complains about local changes, run `git stash`, pull, then `git stash pop`.
   - If there's no remote or no network, say so and carry on.
   - On Windows, run Python with `PYTHONIOENCODING=utf-8` and open files with `encoding='utf-8'`.
2. Run `python tools/brief.py` to see every project, then `python tools/brief.py <project> <sub-project>` for the one they mean. It prints the sub-project's goal, notes, tasks, the parts it waits on, its log entries with readings, and the project's specs. If you can't tell which project they mean, ask.
3. Read only the reference docs that matter, from the `doc:` lines in the brief. Typical ones:
   - Wiring: `files/wiring/reference/diagnostic-log.md` and `factory-wiring-reference.md`.
   - Engine: the main guide `files/engine-302/guide/*.html`. It's long, so grep it for the step you need rather than reading it all.
   - Diagrams and photos are images, and you can look at them.
4. Use `python tools/brief.py --search <words>` to find earlier readings or findings ("flasher", "journal", "12 V").

Then open with a short status: where this stands, what's already been ruled out, and the open questions. Keep it to a few lines; they were there.

## 2. Work the problem

- One step at a time:
  - What to check, where exactly, and how. Give the meter mode, which lead goes where, and battery on or off.
  - What reading to expect, and what each possible result would mean.
  - Then wait for their result.
- Use the car's real facts: the 1968 302 (not a 289), the C4, the factory circuit numbers and wire colors in the reference docs, and the specs in the project. Say when something comes from general knowledge rather than this car's records or a measurement.
- Safety first, briefly: disconnect the battery for continuity and ohms tests, support the engine and trans properly, keep the starter cable insulated while the engine is out, and never use the pink resistance wire as a power source. Don't lecture.
- **Keep a running change list** in your head as you go:
  - readings, with value, unit and where they were taken;
  - findings and conclusions;
  - tasks done or newly needed;
  - parts to order or now on hand;
  - car facts learned;
  - questions answered.

## 3. Update the website (end of session, or when they say "update the site")

1. Show the change list in plain English, grouped by project, and ask "Update the site with this?" Apply it only after they agree. Small corrections are fine.
2. `git pull --rebase` again, then apply the changes with a short Python script following `DATA.md`:
   - **Log entries** go in `data/log.json`. Use one entry per meaningful event, with today's date (or the date they give), `kind` (`work`, `measurement`, `finding`, `incident`, `purchase`, `note`), `project`, `subproject` and `area`.
     - A clear `title`, and `text` that a future reader can use without having seen this chat.
     - Readings go in `measurements` as `{what, location, value (number), unit}`. Add `spec_ref` with the spec's `item` name when one applies, so the site marks the reading in or out of spec.
     - Pass/fail checks (continuity, "light works") go in `measurements` too. Use a short string value (`"continuity"`, `"open"`, `"pass"`) and an empty `unit`.
     - When a numeric reading has a published spec that the project lacks, add it to the project's `specs` first, with numeric `min`/`max` and its source in `notes`, then point `spec_ref` at it. Otherwise leave `spec_ref` out.
     - IDs look like `YYYY-MM-DD-short-slug` and must be unique.
   - **Finished tasks:** set `done: true` and `done_date`, and clear `confirm`. Add a `detail` line if *how* it was done matters.
   - **Tasks that turned out unnecessary** (for example "replace the switch" when the switch tested good): set `done: true` and `skipped: true`, with the reason in `detail`. Don't delete them.
   - **New tasks:** add them in the right order within the right sub-project, with an `id`, a `text` that names the actual action, an `est_min` guess, `est_guess: true`, and `needs_parts` if they wait on a part.
   - **Parts:** set the status (`needed`, `in_cart`, `ordered`, `on_hand`, `installed`). Add new parts with a part number or vendor if known.
   - **Sub-projects:** update the `status` and `blocked_by` text. Mark a sub-project `done` only when its work is really finished.
   - **The project:** update `next_step` so it reads right on the home page.
   - **Answered open questions:** set `resolved: true` and fill in `answer`.
   - **Car facts:** update `data/car.json`. Put the old value into `history` with today's date.
   - **Photos the owner sent:** save them to `files/photos/YYYY/` and list them in the entry's `photos`.
3. Run `python tools/validate.py`, which must exit 0. Fix anything it reports. Treat its personal-info warnings as errors, because the repo is public.
4. Commit with a plain message ("Log turn-signal switch test; switch ordered") and get it onto `main`:
   - If you're on `main`, run `git push`.
   - If the session put you on another branch (cloud sessions often do), run `git fetch origin main && git rebase origin/main && git push origin HEAD:main`.
   - If the push is refused (rejected or permission denied), push the branch, tell the owner its name, and say it needs merging into `main` before the site shows it.
   - If the push is refused because main moved, pull with rebase and push again.
5. Tell them what changed in one or two lines, and that the site updates within about a minute.

## Don't

- Don't invent readings, dates or part numbers. If you're unsure, record it as unknown or put `confirm: true` on the task.
- Don't rewrite or reorder existing tasks and log entries unless asked. Add to them.
- Don't change files in `app/` during a garage session.
