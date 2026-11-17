# Calamansi — notes for Claude

- Owner's app: Home, Kitchen & daily life. Split from Citrus Maxima (Amaerys/citrus-maxima) on 16/11/2026, after Mandarin and Clementine. Plain English in the UI, dates dd/mm/yyyy, metric, SAR.
- One data owner per kind: chores, recipes, meals, the fridge (pantry), the shopping list, bills/renewals/subscriptions and cars → Calamansi. Shifts and rotas → Mandarin (read from `hub/mandarin/shifts.json` by `roster.js`, turned into eating/chore days by `day.js`). Goals → Citrus Plan (diet goals are simple Calamansi settings until Plan shares them). People → Clementine. Never write into another app's Drive folder.
- Drive contract: `HUB.md` in the Citrus repo, plus the layout in the project doc `claude/drive-layout.md`. Folders are found by tag (`appProperties.citrusApp`), never by path (`google.js appFolder`); the old `My Apps/hub/<app>` is only the fallback, and only Calamansi's own folder is ever created (and tagged at once). Never rename or move it: Citrus does that. `status.json` says `drive.byTag: true`. Calamansi writes `{state,status}.json` and `backups/` in its own folder. It reads Mandarin's `shifts.json`, Citrus's `plan.json` (blocks with `app: "calamansi"`) and, once, Citrus's `state.json` (the chores migration, with Undo and a before-migration backup).
- The planner proposes; nothing is saved until the user taps (Plan my week, ＋, Plan it). Every delete and plan has Undo (`ctx.undoTo(before)` = replaceState with `exact`, so it holds on every device).
- Owner's facts the logic depends on: 12-hour shifts 08:00–20:00 / 20:00–08:00, sleeps after nights; cooks with an air fryer and an oven/microwave (Settings › Customise › Kitchen holds the machines).
- Before every deploy: `bash test/all.sh` must pass, then `sh scripts-bump.sh` (service worker module list and cache name).
- Never commit real names, phone numbers, addresses, plates or amounts: tests use made-up data (`test/fixture.mjs`); real data stays out of the repo (`test/data/` is git-ignored).
- Browser tests pin the clock (`page.clock.install`) and run in Asia/Riyadh.
- Keep `tools/check-imports.mjs` green: every named import and `X.name` use must exist. `tools/icons.mjs` redraws the PNG icons from `docs/icons/icon.svg`.
- Add seminal upgrades to the App Building Master Log (skill: app-master-log).
