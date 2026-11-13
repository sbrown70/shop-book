# Shop Book

A project tracker for a 1966 Mustang (1968 302 from a Fairlane, C4 automatic). It covers projects and sub-projects with ordered task lists, a "what fits today" planner, a work log with readings checked against spec, the car's spec sheet with change history, parts and tools, and every guide and diagram.

It's a static site with no build step and no server. Data lives in `data/*.json` (format: [DATA.md](DATA.md)). Documents live in `files/`. The app edits the data by committing through the GitHub API.

To get it online, follow [SETUP.md](SETUP.md).

```
index.html            app shell
app/                  JavaScript modules + style.css (no framework)
  store.js            loading, saving, GitHub sync, offline queue
  views.js            Home, Today, Projects, Sub-project, Docs
  views2.js           Log, Car, Specs, Parts, Search, Settings
  actions.js          every edit form and button
sw.js                 offline cache
data/                 index.json, car.json, log.json, projects/<id>.json
files/<project>/      guides, diagrams, photos, PDFs
```
