# Manual Test Steps — End Day (ED-TC-002 … ED-TC-016)

**Purpose.** When an automated test fails, run the matching steps here by hand
to decide: **real app bug, data problem, or broken script?** Every case ends
with a "How to read the result" line.

**Build verified against:** 0.1.92 (`nexus-app-qa-debug-92.apk`)
**Last updated:** 2026-09-01

---

## Before you start

### End Day spans all three LOB routes

Unlike the other areas, End Day cases run on **different routes** depending on
what each one needs:

| Route | Used for |
|---|---|
| **Charlotte 103** (Coffee) | ED-TC-006, 007, 008, 009 — the Coffee-specific rules |
| **Charlotte 001** (empty route) | ED-TC-004 — a day with no scheduled activities |
| **Miami 001** (Market) | ED-TC-002, 003, 005, 010, 012, 013 — pending stops, money bags, reports |

### End Day is reached from the hamburger menu

Hamburger → **End day**. What you land on depends entirely on the day's state:

- **Activities outstanding** → the **"End Day is Disabled"** gate, listing
  pending activities with **Service** / **No Service** actions
- **Everything resolved** → the End Day flow proper (Unused Kits → Money Bag
  Review → Reports → Done → Close)

**That branch is the single most useful diagnostic in this area.** If a case
expects the flow and you get the gate, the day has unfinished stops — that is
state, not a bug.

### End Day completion is itself a reset

Completing End Day **restores skipped stops** and does not touch the Route Setup
modal. That makes this area unusually self-healing — it is why the destructive
cases here are safe to automate at all.

### Resolving a blocked day

To clear the gate by hand: open End Day, tap **No Service** on a pending
activity, choose a **reason** (e.g. *Serviced Using Client App*) and a
**disposition** (*Return to warehouse* / *Leave on truck*), then **Skip stop**.
Repeat until the gate clears.

> **Destructive** — this skips real stops. Use a **past day**.

---

## ED-TC-002 — End Day blocked until required activities are complete
**Route:** Miami 001 · **Day:** one with **pending** Market stops

1. Confirm the day has pending stops on Home
2. Hamburger → **End day**

**Expected:** you land on an **"End Day is Disabled"** screen listing the
**pending activities**, each offering **Service** and **No Service**.

**How to read the result:** if End Day opens straight into the flow instead, the
day has no pending activities — pick a day that does. That is the ED-TC-004
situation, not a failure here.

---

## ED-TC-003 — No Service pop-up shows order options
**Route:** Miami 001 · **Day:** one with a **current-day order**

1. From the End Day gate, tap **No Service** on a pending activity

**Expected:** a sheet appears with **Select Order Option** listing the available
order options.

**How to read the result:** the options only appear when a **current-day order**
exists for that stop. On a stop showing `No Orders`, an empty list is correct.

---

## ED-TC-004 — End Day available when no scheduled activities exist
**Route:** **Charlotte 001** (the empty route) · **Day:** any

1. Switch to the empty route
2. Hamburger → **End day**

**Expected:** **End Day is enabled** — no gate, because there are no pending
activities to block it.

---

## ED-TC-005 — End Day becomes enabled in real time
**Route:** Miami 001 · **Day:** one with **more than one** outstanding activity

1. Open **End day** → confirm the gate lists **2+** pending activities
2. Without leaving the flow, resolve them one at a time (**No Service** →
   reason → disposition → **Skip stop**)
3. Watch the screen as the **final** activity is resolved

**Expected:** End Day becomes **enabled immediately**, with **no page refresh**
and no need to back out and re-enter.

> **Destructive** — use a past day.

---

## ED-TC-006 — Unused Kits appears only when a stop was skipped
**Route:** Charlotte 103

1. On a day where **a stop was skipped**, complete End Day up to Unused Kits
2. Then repeat on a day where **nothing was skipped**

**Expected:** the **Unused Kits** step appears **only** when a stop was skipped;
with nothing skipped it should **not** appear.

**How to read the result:** on a Coffee route with nothing skipped, Unused Kits
being shown **with a count of zero** is the current behaviour — see ED-TC-007,
which is tracked as a gap.

---

## ED-TC-007 — Unused Kits not shown for Coffee
**Route:** Charlotte 103

1. Run End Day on the Coffee route
2. Watch for an **Unused Kits** step

**Expected (per the sheet):** the Unused Kits screen should **not** be shown for
Coffee.

**⚠️ KNOWN GAP:** it **is** shown for Coffee, with a count of zero. Carried as a
gap test. If you see Unused Kits on a Coffee route, that is this known issue.

---

## ED-TC-008 — Coffee route does not support Skip Stop
**Route:** Charlotte 103

1. Open the Coffee service station and look for a **Skip Stop** action
2. Then open **Transfers** and check the available options

**Expected:** **Skip Stop is not available** for Coffee, and **Return to
Warehouse** is handled through **transfer** functionality instead — Transfers
offers **Route to Warehouse**.

---

## ED-TC-009 — Complete End Day on mixed LOB without servicing Coffee stops
**Route:** Charlotte 103 (Coffee stops left **pending**)

1. Leave the Coffee stop(s) **unserviced**
2. Run **End day** through to its final step

**Expected:** End Day **completes without forcing** the driver to service the
Coffee stops.

**How to read the result:** this is the deliberate contrast with ED-TC-002 —
**Market** stops block End Day, **Coffee** stops do not.

---

## ED-TC-010 — Money Bag Review shows the summary and continues
**Route:** Miami 001 · **Precondition:** a stop **serviced with a money bag**

1. Service a Market stop and add a **money bag** in Money Operations
   *(bag codes are **numeric** — e.g. `91`; a text code is silently rejected)*
2. Resolve the day's remaining activities
3. Hamburger → **End day** → proceed to **Money Bag Review**

**Expected:** the review lists **total money bags**, and per bag the **bag ID,
time, and machine or account**. Deliveries completed **without** cash bags list
the **reason**. **Continue** moves to the next End Day step.

**How to read the result:** the precondition is a stop serviced **with a bag** —
a *skipped* stop will not produce one. An empty review usually means no bag was
ever added, not a display bug.

---

## ED-TC-012 — No photo requested after Money Bag Review
**Route:** Miami 001 · same setup as ED-TC-010

1. From **Money Bag Review**, tap **Continue**

**Expected:** **no photo prompt** appears — you go straight to the next step.

---

## ED-TC-013 — Reports step lists EOD reports with correct defaults
**Route:** Miami 001 · **Precondition:** the day's activities are **all
resolved**

1. Hamburger → **End day** (you must **not** get the gate)
2. Step past **Unused Kits** if shown
3. Reach the **Reports** step

**Expected:** the screen shows the **Date** and **Route Number** at the top, a
**Reports** heading, and report **categories** (Coffee, Market, Vending) with
their reports and counts. Each report has a **checkbox** that can be selected
and deselected, and **Done** is visible at the bottom, **enabled and green**.

**How to read the result:** if you land on the gate instead, the day still has
unfinished stops — resolve them first (see the "Resolving a blocked day" note
above). That is a **precondition**, not a defect. This is the single most common
reason this case fails.

---

## ED-TC-014 — End Day Successful popup after report upload
**Route:** Miami 001 · continues from ED-TC-013

1. Select one or more reports → tap **Done**

**Expected:** the selected reports upload, then an **End Day Successful** popup
appears with **Date and Time** details and an **enabled green Close** button at
the bottom.

---

## ED-TC-015 — Complete End Day from the closure screen
**Route:** Miami 001 · continues from ED-TC-014

1. Tap **Close** on the End Day Successful popup

**Expected:** the End Day process **completes**, all data is **saved**, and you
**exit the End Day flow**.

---

## ED-TC-016 — Begin Day reopens centred on today
**Route:** Miami 001 · continues from ED-TC-015

1. After End Day completes, observe the **day selector**

**Expected:** the date selector returns with **today's date centred**.

**How to read the result:** "today" means the real system date, not the business
date you were working on. If you ran End Day on a past day, the selector should
still centre on **today**.

---

## Quick triage guide

| What you see | Most likely | Check first |
|---|---|---|
| Gate instead of the flow | **Unresolved activities** | resolve them, or use a resolved day |
| Flow instead of the gate | **Nothing pending** | pick a day with pending Market stops |
| Money Bag Review empty | **No bag was added** | bag codes are **numeric**; skipped stops make no bag |
| Unused Kits shown on Coffee | **Known gap** | ED-TC-007 — already tracked |
| Coffee stop blocks End Day | **Would be a bug** | Coffee should not block (ED-TC-009) |
| Order options list empty | **No current-day order** | check the stop shows an `Order <n>`, not `No Orders` |
| Works by hand, fails automated | **Script** | a precondition the test skipped |

---

## Note on running order

Several cases chain: **ED-TC-013 → 014 → 015 → 016** is one continuous pass
through the flow, and **ED-TC-010 → 012** likewise. Running them in sequence on
a single prepared day is far cheaper than setting up each one separately.

**ED-TC-005 resolves the day it runs on**, so it is a convenient way to prepare
the resolved day that ED-TC-013 needs — just be aware it consumes that day's
pending stops to do it.
