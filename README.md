# Calamansi — Home, Kitchen & daily life

The home app of the citrus family, split out of Citrus Maxima on 16/11/2026. Calamansi plans home life around your shifts (12-hour days and night stretches, read from Mandarin):

- **Today**: your shift and what it means at home (quick meals on a 12-hour day, eat early and pack for a night, light before sleep after one), today's meals, chores due, food to use up, the shopping list, bills and the car, Citrus's planned blocks for Calamansi. Cards in your order.
- **Home**: chores that repeat every N days, each with minutes and a last-done date, fitted around your shifts (days off first, short ones after work, never right before a night) and put on your calendar; Done ✓ with Undo and "It was yesterday". Brought over from Citrus.
- **Kitchen**: the next 7 days of meals, slot by slot for each kind of day (day shift, first night, night, after a night, off, leave), with a **Plan my week** proposal you tick and accept: quick recipes after a 12-hour day, packed lunches and night meals, one **batch cook** before a night stretch feeding the packed nights, light food before sleep, food that is about to go off used first, a simple kcal / protein target. **Recipes** carry a time and temperature for every machine (air fryer, oven, microwave, hob); 16 original starter recipes come ready.
- **Shop**: the shopping list by aisle, filled from the planned meals on a tap (scaled to portions, minus what the fridge and the list already have, staples left out), shared as text for WhatsApp; ticked items go into **the fridge** list with a best-before guess. Cooking takes ingredients out; a batch leaves its portions in the fridge for the packed meals.
- **Life**: bills, renewals and subscriptions (Paid ✓ moves a repeating one to its next date), and the car: istimara, fahas, insurance and the service by date or km.

## How it fits with the other apps

One Google Drive tree for every app (see `HUB.md` in Citrus). Calamansi finds its folder by tag (`citrusApp = calamansi`; today `My Apps/hub/calamansi/`, later wherever Citrus moves it) and writes only there:

| File | For | What is in it |
|---|---|---|
| `state.json` | Calamansi on your other devices | everything Calamansi keeps (merged per record, newest edit wins) |
| `status.json` | Citrus (contract v2) | summary ("2 chores due · dinner: air-fryer chicken"), next, metrics (chores done this week, meals cooked, list, food to use up, bills due), pending, inbox (dated tasks for bills and car papers, stable ids), asks (batch cooks, a big shop), 6 deep links, extra `{ chores, meals, shopping, fridge, bills }` |
| `backups/state-YYYY-MM-DD.json` | you | one copy a day, newest 14, plus a copy before a migration or restore |

Calamansi **reads** only `hub/mandarin/shifts.json` (your days), `hub/citrus/plan.json` (blocks Citrus planned for Calamansi) and, once, `hub/citrus/state.json` to bring the chores over (with Undo).

Deep links: `…/Calamansi/?from=citrus&do=today|chores|chore|plan|recipes|recipe|shop|add|fridge|bills|car`.

Look: the family's Manrope and Arcade / Clean / Paper interfaces, in Calamansi's own palette (forest-ink, calamansi lime, pulp, leaf) with Fraunces headings; accents calamansi, leaf, pulp, mint, clementine, sky; bubbly or classic shapes.

## Development

Vanilla ES modules in `docs/`, no build step; GitHub Pages serves `/docs` from `main`.

```
bash test/all.sh      # every test; deploy only when it passes
sh scripts-bump.sh    # before each deploy: module list and cache name in the service worker
```

Browser tests use Playwright and an in-memory Google (`test/fake-google.mjs`), with made-up data in `test/fixture.mjs`.
