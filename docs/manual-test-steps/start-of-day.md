# Manual Test Steps — Start of the Day (SD-TC-006 … SD-TC-032)

**Purpose.** When an automated test fails, run the matching steps here by hand.
The point is to answer one question: **is this a real app bug, a data problem,
or a broken script?** Each case below ends with a "How to read the result"
line that tells you which.

**Build verified against:** 0.1.92 (`nexus-app-qa-debug-92.apk`)
**Last updated:** 2026-09-01

---

## Before you start

### Routes — one per LOB (authoritative)

| LOB | Operation / Route | Notes |
|---|---|---|
| **Vending** | Miami, FL / **Route 990** | |
| **Coffee** | Charlotte, NC / **Route 103** | 153 Vending stops + **exactly 1 Coffee stop** (`24Hundred Marketplace`) |
| **Market** | Miami, FL / **Route 001** | |
| *(empty-state tests)* | Charlotte, NC / **Route 001** | the route kept deliberately at zero deliveries |

**Miami 010 is retired.** If a screen or script still points there, that is the
bug — it no longer carries data.

### Install the build correctly

**Always `adb uninstall` then `adb install`. Never `adb install -r`.**
A `-r` reinstall keeps the old app data directory. On 2026-08-31 that carried a
10-day-old database forward and produced a convincing phantom defect: route
sync failing, the Select Day sheet never appearing, and `Last sync` frozen four
days in the past. A clean install cleared all of it. The cost of doing it right
is one fresh SSO login plus one manual MFA approval.

### Checking data before you test

Home shows per-LOB counters (e.g. `0/153 Vending`, `0/1 Coffee`). Check them
**before** blaming a failure on the app — most "missing data" turns out to be
the wrong day. Data does **not** roll the same way on every route: Market's
seeded stops appear on each day, while Coffee's have stayed anchored to a fixed
date. Always confirm the day you are on carries deliveries.

### Destructive tests consume data

Servicing or completing a stop is **permanent** — a Route Setup reset clears
local corruption but cannot un-complete a stop server-side. The day selector
only offers yesterday / today / tomorrow, so **a consumed day becomes
unreachable within 24 hours.** Prefer **YESTERDAY** for anything destructive:
past days recede and cost nothing, while burning tomorrow destroys the next
day's data.

---

## SD-TC-006 — SSO sign-in completes sync and lands on Dashboard
**Route:** any · **Day:** any

1. Sign off (hamburger → Settings → Sign off), or force-stop after a sign-off
2. Launch the app → the **Compass SSO** login page appears
3. Enter credentials → approve the **MFA push** on your phone
4. Wait for sync to finish

**Expected:** you land on the **Dashboard / Schedule overview** (or the Start
day screen if route setup is already done) — never stranded on a sync screen.

**How to read the result:** if sync fails or hangs, check `Last sync` under
Settings → Route setup. A timestamp days old means stale app data — reinstall
cleanly before reporting anything.

> Not automated: `KEEP_APP_SESSION=true` bypasses SSO, and covering it would
> need a manual MFA approval on every run.

---

## SD-TC-007 — Route Setup: select operation and route, with data-loss warning
**Route:** any · **Day:** any

1. Hamburger → **Settings → Route setup**
2. Choose an **Operation** (e.g. Miami, FL)
3. Choose a **Route** (e.g. Route 001)
4. Tap **Change route**

**Expected:** a **"Change route"** dialog appears reading *"If you proceed all
information will be DELETED."* with **Change route** and **Cancel**.

**How to read the result:** if the Operation or Route dropdown opens but stays
**empty**, that is the known Route Setup modal issue — a bug, not your data.
Note that the Route list's **search box does not filter** (typing "103" leaves
all entries showing); selection still works because the exact label is present.

---

## SD-TC-008 — Date selector shows yesterday, today and tomorrow
**Route:** any · **Day:** n/a

1. Complete SD-TC-007 through the confirm dialog
2. Wait for the sync that follows

**Expected:** a **Select Day** sheet listing **YESTERDAY**, **TODAY** and
**TOMORROW**, each with its real calendar date, today centred.

**How to read the result:** if the sheet never appears and the app drops
straight into Prep Tasks or Home, check for stale app data first — this was the
single most misleading symptom of a `-r` reinstall.

---

## SD-TC-009 — Date confirmation pop-up, Confirm and Cancel
**Route:** any

1. From the Select Day sheet, tap a day (e.g. **TODAY**)
2. A **Confirm Date!** dialog appears naming the day (e.g. *TODAY Mon 31 Aug*)
3. Tap **Cancel** → you return to the Date Picker, nothing applied
4. Repeat and tap **Confirm**

**Expected:** Cancel returns to the picker with no change. Confirm runs the
sync and lands on **Prep Tasks**.

---

## SD-TC-010 — Sync pop-up then date confirmed
**Route:** any

1. Continue from SD-TC-009 after tapping **Confirm**

**Expected:** a brief sync screen, then the selected date is applied and shown
in the header (e.g. `August 31,2026`).

**How to read the result:** the header date is the proof. If it still shows the
previous day, the change did not apply.

---

## SD-TC-011 — Required vs optional tasks on Start Day
**Route:** any with deliveries · **Day:** one with data

1. Open **Prep Tasks** ("Start day, Route N")
2. Inspect the four categories: Product Collection, Money Operations,
   Additional Prep, Checks

**Expected:** required tasks are visually marked as mandatory; optional ones are
shown but do **not** block Start Day. On optional tasks, **Continue stays
enabled**.

---

## SD-TC-013 — Start Day completes after required prep tasks
**Route:** any with deliveries

1. Work through all four prep categories
2. Return to the Prep Tasks list

**Expected:** completed tasks carry a **green checkmark**, the overall
**Start day** action becomes enabled, and using it returns you to **Home**.

---

## SD-TC-014 — Dashboard "+" creates an ad-hoc delivery, schedule updates live
**Route:** any with deliveries

1. On Home, find the **"+"** next to the **Schedule** heading
2. Tap it → the **Add Delivery** screen opens
3. Pick an **Account**, then a **Location / Machine or POS**
4. Tap **Continue**
5. Return to Home

**Expected:** the delivery is created **without an order number** when the
account provides none, and Home's totals plus the **Pending / Completed**
buckets update **immediately** with no manual refresh.

**How to read the result:** on a heavy route (Charlotte 103 has 154 stops) Home
can take a while to paint. Give it time before concluding the "+" is missing —
a script failing here is usually checking too early.

---

## SD-TC-015 — Ad-hoc delivery for **Vending**
**Route:** Miami 990 · **Day:** **YESTERDAY** (the only day with data)

1. Home → **"+"**
2. **Account:** `Broward County Schools - Everglades Elementary`
3. **Location, Machine or POS:** `Bottle Bev 99092 - Vending`
4. Tap **Continue**

**Expected:** you land on the **Vending service screen** — e.g.
`99092 - Bottle Bev (WPB Teachers Lounge)`, **FULL SERVICE**, `Order: No Order
Available`, with **SPOT** and **FINAL** under OTHER OPTIONS.

> The sheet lists `Amerock` as test data. **Ignore it** — that account is an
> ad-hoc one the automation bootstraps and it has not been on any route since
> the 2026-08-28 re-pull. Use the account above.

---

## SD-TC-016 — Ad-hoc delivery for **Market**
**Route:** Miami 001 · **Day:** TODAY or TOMORROW

1. Home → **"+"**
2. Pick an account, then a **Market** location / POS
3. Tap **Continue**

**Expected:** you land on the **Market service screen**.

**How to read the result — check the tiles, they identify the LOB:**

| LOB | Tiles you should see |
|---|---|
| **Market** | Money Operations, Removals & Returns, **Market Physical**, Market Transfers |
| **Coffee** | **Equipment Audit**, **Add Presale**, Signing Order |
| **Vending** | FULL SERVICE / SPOT / FINAL options |

Landing on a Coffee checklist means a Coffee service was selected — that is
SD-TC-017, not this case.

---

## SD-TC-017 — Ad-hoc delivery for **Coffee**
**Route:** Charlotte 103 · **Day:** the one carrying data

1. Home → **"+"**
2. Pick a customer offering a **Coffee (OCS/Pantry)** service
3. Select the Coffee service station → **Continue**

**Expected:** you land on the **Coffee service screen** (Before Photos,
Delivery, Equipment Audit, Add Presale, After Photos, Signing Order).

---

## SD-TC-018 — Ad-hoc Coffee shows Delivery Fees and Fuel Adjustment
**Route:** Charlotte 103

1. Create or open an ad-hoc **Coffee** delivery
2. Open its **Deliveries** screen and the **Signing Order** cost summary

**Expected (per the sheet):** **Delivery Fees** and **Fuel Adjustment** charges
are displayed, matching OneCup or showing zero.

**Known result: FAIL — these fields do not exist anywhere in the Coffee flow.**
Recorded in the sheet as "Bug to be raised". If you see no fee fields, that is
the known defect, not a data problem.

---

## SD-TC-019 — Ad-hoc option visible when no deliveries are scheduled
**Route:** Charlotte 001 (the empty route) · **Day:** any

1. Switch to the empty route and open Home

**Expected:** a clear empty-state message (*"You do not have an active
deliveries for …"*) **and** the **"+"** action still available.

---

## SD-TC-020 — Route number displays immediately after prep tasks
**Route:** any

1. Complete Start Day → land on Home

**Expected:** the **route badge** (e.g. `Route 103`) shows immediately, without
waiting for a service to be added.

**How to read the result:** on a route with **zero** deliveries the badge can
render blank by design. Confirm the day has deliveries before calling it a bug.

---

## SD-TC-021 — Schedule screen shows date, stop location and service categories
**Route:** any with deliveries

1. Home → tap a stop → the **Stop Preview** opens

**Expected:** current **date**, **stop name** and **address**, plus **only the
service categories assigned to that stop** (Vending / Market / Coffee).

---

## SD-TC-022 — Prep Tasks after adding an unscheduled delivery with no route setup
**Route:** any, with **route setup not yet performed**

1. From a state where route setup has not been done, add an unscheduled delivery
2. Tap **Continue**

**Expected:** the app navigates to **Prep Tasks**.

> Confirmed live: tapping Continue on a route whose Start Day is not complete
> routes to the Start day screen first. That is the same gate.

---

## SD-TC-023 — Back-press on the four prep sub-screens offers Skip / Complete
**Route:** any with deliveries

1. Open **Product Collection** → press **Back**
2. Repeat for **Money Operations**, **Additional Prep**, **Checks**

**Expected:** each raises a popup offering **Skip** and **Continue**. Skip skips
the action; Continue marks the task completed.

**How to read the result:** this needs a day whose Start Day is **not already
complete**. On a finished day the popup will not appear — that is state, not a
bug. There is no in-app way to un-complete Start Day, so use a fresh day.

---

## SD-TC-024 — Start Day with no scheduled deliveries
**Route:** Charlotte 001 (empty route)

1. Switch to the empty route and complete Start Day

**Expected:** Start Day completes successfully, and ad-hoc deliveries can still
be added from the schedule.

---

## SD-TC-025 — Home screen counters, tabs and navigation actions
**Route:** any with deliveries

1. Open Home and check the **Vending / Market / Coffee** counters
2. Check the **Pending action (n)** and **Completed (n)** tabs
3. Tap **"+"** → Add Delivery opens
4. Go back, tap **Edit schedule** → the Edit Schedule screen opens

**Expected:** counters reflect the real route state, tab counts are correct, and
both actions navigate correctly.

**How to read the result:** if the totals and the tab counts disagree — e.g.
`2 Deliveries` but `Pending action (1) / Completed (0)` — that is the known
schedule-count corruption caused by completing a **previously skipped** stop.

---

## SD-TC-026 — Business date shown consistently
**Route:** any

1. Note the date on Home (e.g. `August 31,2026`)
2. Open Prep Tasks, a stop preview, and a service screen

**Expected:** the same business date appears in each header
(the service screens use the short form, e.g. `31 Aug 2026 • Route 103`).

---

## SD-TC-028 — Permissions not re-requested after relaunch
**Route:** any

1. Grant permissions once on a fresh install (**build 0.1.92 asks for Camera
   only** — no Location, Phone or Photos prompt)
2. **Force-stop** the app, then relaunch

**Expected:** no permission dialog reappears; the app opens straight through.

---

## SD-TC-029 — Relaunch within the session returns to home
**Route:** any

1. With an active session, **force-stop** the app
2. Relaunch

**Expected:** opens directly to **Home** (or the last screen) with **no SSO and
no MFA**.

---

## SD-TC-031 — Add Delivery account list: route-assigned, alphabetical
**Route:** any with deliveries

1. Home → **"+"** → open the **Account** dropdown
2. Scroll the full list
3. Open the **Location / Machine or POS** dropdown

**Expected:** only accounts assigned to the **currently loaded route** are
listed, in **alphabetical order**, and the service dropdown shows **machine
numbers in ascending order**.

---

## SD-TC-032 — Product Collection shows items with package size, no photo prompt
**Route:** any with deliveries

1. Prep Tasks → **Product Collection**
2. Add a product with a quantity
3. Review the collected list

**Expected:** each item shows **name, quantity and package size**, and **no
camera or photo prompt** appears at any point.

**Known result: the package-size half is a confirmed gap** — tracked by a
dedicated gap test. No photo prompt appearing is correct.

---

## Quick triage guide

| What you see | Most likely | Check first |
|---|---|---|
| "No data" / empty list | **Data or wrong day** | Home's LOB counters; try another day |
| Element missing that you can see on screen | **Script** | timing, or the wrong node — screenshot the tree |
| Sync fails / `Last sync` days old | **Stale app data** | reinstall cleanly (never `-r`) |
| Dropdown opens but is empty | **App bug** | the known Route Setup modal issue |
| Counts disagree with the stop list | **App bug** | the skip-then-complete corruption |
| Works by hand, fails automated | **Script** | precondition the test skipped |
