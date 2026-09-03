# Winter Arc

A two-person challenge tracker. Sarthak and Inan each get their own passcode,
their own task list, and their own theme. Tick it or cross it, every day.

## Run it

Double-click `index.html`. That's it — no build step, no server, no npm.

Default passcodes (change them in `js/config.js`):

| Person  | Passcode  |
|---------|-----------|
| Sarthak | `inan`    |
| Inan    | `sarthak` |

## What's here

```
index.html          the whole UI
css/base.css        layout + components (no colours)
css/warrior.css     Sarthak's theme — ember on black, Orbitron, scanlines
css/bloom.css       Inan's theme — rose + blush, Cormorant, falling petals
js/config.js        >> the only file you need to edit <<
js/store.js         persistence: localStorage now, Supabase when configured
js/app.js           app logic
sql/schema.sql      the Supabase table
```

## How it works

- **Tick (✓) / cross (✕)** each task. Tap the same button again to clear it.
- **Arrow keys** move between days, `T` jumps back to today. The calendar and
  week strip are clickable, so you can look at any day you like.
- **Midnight IST seals the day.** Only the current day can be edited: at 00:00
  IST yesterday goes read-only — ticks, crosses and the log all freeze — and
  future days aren't open yet. The task card shows how long you have left
  (`Locks in 4h 12m`), and if you leave the page open past midnight it rolls
  over to the new day on its own.
  The day boundary is always IST, whatever your device clock says. This is
  enforced in the browser, so it's a commitment device, not a security control
  — someone determined could work around it with devtools.
- A day counts as **won** when you tick ≥ 80% of your tasks. Streaks are built
  from won days. Change the bar with `winThreshold` in `js/config.js`.
- Tasks marked `weekly: N` (Sarthak's gym 5×, run 1×, reading 3×) show progress
  against the current Mon–Sun week instead of a daily target.
- The **food card** is one text box for the whole day: write what you ate and
  hit Save (Ctrl/Cmd+Enter works, and clicking away saves too). Stored per day
  like everything else, and sealed by the same midnight lock — after which it
  shows read-only with the Save button gone.
- The **Log** box saves a free-text note per day, automatically.
- The **rival card** shows the other person's day. It only carries real numbers
  once Supabase is connected, since localStorage can't cross devices.

## Supabase

**Connected.** Both of you write to the same table, so laptop and phone stay in
step and the rival card carries real numbers. The badge in the top bar reads
`cloud`; if it ever reads `local`, the app fell back and is still saving safely
on that device.

Credentials live in `js/config.js`, the table in `sql/schema.sql`.

To point it at a different project: create one at
[supabase.com](https://supabase.com), run `sql/schema.sql` in its SQL Editor,
then swap the `url` and `anonKey` under `supabase:` in `js/config.js`. Emptying
both fields drops the app back to localStorage-only.

Once connected, the app pulls fresh data whenever the tab comes back to the
front, so ticking on your phone shows up on the laptop the moment you switch
back to it. The badge is also a button — tap it to sync right now.

Writes are optimistic: localStorage is written first so the UI never waits, the
cloud write follows, and anything that fails while you're offline is queued and
retried on the next save or page load.

> **Note on the anon key.** Anyone reading the page source can see it, and the
> policies in `schema.sql` let it read and write this one table. That's an
> accepted trade for a private tracker between two people — but don't put
> anything sensitive in the note field. There's no delete policy, so nothing
> can be wiped from the browser.

## Putting it online

Any static host works. Drag the folder onto [netlify.com/drop](https://app.netlify.com/drop),
or push to GitHub and enable Pages. With Supabase configured you'll both see the
same data from your own phones.

## Editing the challenge

Everything lives in `js/config.js`:

- `challenge.start` / `challenge.days` — the arc window (currently
  1 Sep 2026 to 15 Oct 2026, 45 days).
- `challenge.winThreshold` — how much of a day counts as a win.
- `users.<person>.tasks` — add, remove or rename tasks freely.
  **Keep the `id` stable** once you've started logging, or old entries lose
  their label. Renaming `name` is always safe.
