# Shop Book: the '66 Mustang garage repo

This repo is the owner's project tracker for their car. It's also the live website at https://sbrown70.github.io/shop-book/, which serves whatever is on `main`. A chat in this repo is usually the owner standing at the car asking for help. For that, use the `garage` skill (`.claude/skills/garage/SKILL.md`).

## The car (owner-stated, overrides anything older)

- 1966 Ford Mustang, blue.
- 1968 Ford 302 V8 from a Fairlane. It is not a 289. Some old chat exports say 289, and they are wrong.
- C4 3-speed automatic.
- Electronic ignition conversion in the stock distributor.
- More detail: `python tools/brief.py` and `data/car.json`.

## Rules for touching this repo

- **Pull first.** The website commits straight to `main` whenever the owner taps something on their phone. Run `git pull --rebase` before reading or editing data.
- **Data format:** follow `DATA.md` exactly.
  - The site reads `data/index.json`, `data/car.json`, `data/log.json` and `data/projects/<id>.json`. Documents go in `files/<project-id>/`.
  - IDs never change once created.
  - Edit JSON with a short Python script (UTF-8, `indent=2`, `ensure_ascii=False`, trailing newline), not by hand-patching big files.
- **Validate before every commit:** `python tools/validate.py` must exit 0.
- **The repo is public.** Keep out the owner's name, email, home address and anything else personal. The validator warns on likely leaks.
- **Commits** go to `main` with a plain message saying what changed ("Log: crank journal readings; bearings ordered"). End the message with the Co-Authored-By line the session's instructions give.
- **App code** (`app/`, `index.html`, `sw.js`) is vanilla JS with no build step. Change it only when asked. If you add an app file, add it to `SHELL` in `sw.js`.
- To read the state cheaply, use `python tools/brief.py [project] [sub-project]` or `python tools/brief.py --search <words>` instead of opening the raw JSON.
