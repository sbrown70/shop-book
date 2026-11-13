# Putting Shop Book online

This takes about 15 minutes, once. Everything is free.

## 1. Make the repository

1. Sign in at github.com. Create an account if you don't have one.
2. Click **+** → **New repository**.
   - Name: `shop-book`, or anything you like. The name becomes part of the web address.
   - Visibility: **Public**. Free GitHub Pages hosting needs a public repo, so anyone who has the address can read the site. Search engines are asked not to index it. Don't put anything private in it, such as your home address or a full VIN if that bothers you.
   - Don't add a README, .gitignore or license.
3. Click **Create repository**. Leave the page open, because you'll need the address it shows.

## 2. Upload the site

Run these in a terminal in this folder, replacing `YOUR-USERNAME`:

```bash
git init -b main
```

```bash
git add .
```

```bash
git commit -m "Shop Book: first version"
```

```bash
git remote add origin https://github.com/YOUR-USERNAME/shop-book.git
```

```bash
git push -u origin main
```

The first push opens a GitHub sign-in window. The `from_chats/` and `proposals/` folders are excluded by `.gitignore`.

## 3. Turn on GitHub Pages

In the repository, go to **Settings** → **Pages**. Under "Build and deployment", set Source to **Deploy from a branch**, Branch to **main**, and folder to **/ (root)**, then click **Save**.

After about a minute the site is live at `https://YOUR-USERNAME.github.io/shop-book/`. Bookmark it.

## 4. Make an access token (this lets the site save your edits)

1. Open github.com/settings/personal-access-tokens/new.
2. Fill it in:
   - Token name: `Shop Book`.
   - Expiration: the longest it offers. When the token expires, the site will say "The token was rejected", and you make a new one the same way.
   - Repository access: **Only select repositories** → `shop-book`.
   - Permissions → Repository permissions → **Contents: Read and write**. Leave everything else alone.
3. Click **Generate token** and copy it. It starts with `github_pat_`.

The token can only touch this one repository.

## 5. Connect each device

On the phone, the laptop, and anything else you'll use:

1. Open the site and tap **⚙** (top right of the home page).
2. Check that the username and repository are filled in. They fill in automatically on the github.io address.
3. Paste the token and tap **Save & test**. It should say "Connected".

To save the token on your phone without retyping it, paste it into a note, copy it from there, and delete the note afterwards.

## 6. Put it on your home screen

- **iPhone:** in Safari, tap Share → **Add to Home Screen**.
- **Android:** in Chrome, open the ⋮ menu → **Install app** (or Add to Home screen).

It then opens full-screen like an app. Pages you've opened before work without signal. In Settings, **Save all documents for offline** downloads every guide and diagram at once. Edits made offline wait on the phone and save once you're back online. The small pill at the bottom left shows how many are waiting.

## How saving works

- Every edit is a small commit to the repository, so GitHub keeps the full history. You can see and undo anything from the repo's commit list.
- While a device is connected, the site reads the live data from GitHub, so a change on your phone shows up on the laptop at its next reload.
- If two devices change the same project while one is offline, the log is merged entry by entry. For anything else, the device that saves last wins, and it tells you so.

## Adding a project from a Claude chat

- **Start a new project from a chat:** ask the chat for "a project JSON in the Shop Book format", and paste it the contents of `DATA.md`. Put the JSON in `data/projects/`, its files in `files/<project-id>/`, and add the id to `data/index.json`. Then commit and push, or do it from Claude Code in this folder.
- **Continue a project in a chat:** on the project page, tap **Copy brief for Claude** and paste it into the chat. The brief gives the chat the current state and asks for updates in the same format.

## Previewing locally

```bash
python .claude/serve.py
```

Then open http://localhost:8765. Offline mode only runs on the real https site.
