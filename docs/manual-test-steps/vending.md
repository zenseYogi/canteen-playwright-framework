# Manual Test Steps — Vending (V-TC-001 … V-TC-046)

**Purpose.** When an automated test fails, run the matching steps here by hand
to decide: **real app bug, data problem, or broken script?** Every case ends
with a "How to read the result" line.

**Build verified against:** 0.1.92 (`nexus-app-qa-debug-92.apk`)
**Last updated:** 2026-09-01

> **Note on coverage.** Vending is owned by a different tester, so unlike the
> other three areas the expectations below come from the regression sheet rather
> than from cases confirmed live in this session. Route and environment facts
> **were** verified. Treat the per-case expectations as the spec's claim, and
> update this file as you confirm them.

---

## Before you start

### Route

**Vending runs on Miami, FL / Route 990.**

Data is thin and uneven: at last check **31 Aug carried 15 pending stops, while
today and tomorrow both showed 0 deliveries**. Check Home's LOB counters and
pick the day that actually has stops — a `0 delivery` day will make every case
below look broken.

Charlotte 103 also carries **153 Vending stops**, but it is Coffee's route —
use 990 unless you specifically need volume.

### Known-good ad-hoc data

Account `Broward County Schools - Everglades Elementary`, location
`Bottle Bev 99092 - Vending` — creates a Vending delivery and lands on
`99092 - Bottle Bev (WPB Teachers Lounge)`.

### Identifying a Vending service screen

| LOB | What you see |
|---|---|
| **Vending** | Service Selection with **FULL SERVICE / SPOT / FINAL**; header is a **machine number**, e.g. `99092 - Bottle Bev` |
| Coffee | Equipment Audit, Add Presale, Signing Order |
| Market | Money Operations, Removals & Returns, Market Physical |

**Vending's header is a machine / POS identifier**, not an account location name
— that difference is itself V-TC-037.

### ⚠️ The task-gating rule that explains most Vending failures

**Money Operations must be completed before Fills & Ending Inventory and
Removals & Returns unlock.** On a fresh station those tiles are **disabled by
design**. Then:

- **Kit Returns** enables once **Fills & Ending Inventory** is complete
- **After Photos** enables once **Fills & Ending Inventory** is complete

A test that opens Fills first will find it disabled — that is the gate, not a
defect.

### Servicing consumes a stop

Completing or skipping is permanent for that day, and a Route Setup reset cannot
un-complete a stop server-side. **Use a past day for destructive cases.**

### Standard setup (assumed by every case below)

1. Route Setup → **Miami, FL / Route 990** → a day with stops
2. Complete **Start Day** if the gate appears
3. Home → tap a Vending stop → expand the **vending** card → open a machine

---

# Service selection and task list

## V-TC-033 — Service Selection shows machine context and Continue
1. Open a Vending machine from the stop

**Expected:** the Service Selection screen shows the **machine number**,
**service location**, and an **order number if any**; the primary action reads
**Continue**.

---

## V-TC-024 — Service screen lists the service types
1. On the service screen, review the options

**Expected:** `<Service ID>` / service station name / `<Type of Service>` /
`Order — No Order Available`, a **green Complete** button, and under **Other
options**: **FINAL** and **SPOT**. **Edit Existing Delivery** (white) appears
only when a completed service exists.

---

## V-TC-025 — Full Service task list
1. Tap the green **Complete / Continue** button for **FULL SERVICE**

**Expected:** machine id and **FULL Service**, with:
**Before Photos** *(optional)* · **Money Operations** · **Fills and Ending
Inventory** *(disabled)* · **Removals and Returns** *(disabled)* · **Kit
Returns** *(enabled)* · **After Photos** *(disabled)*

**How to read the result:** the disabled tiles are **correct** on a fresh
station — see the gating rule above.

---

## V-TC-030 — Full Service proceeds against the existing order
1. Start **Full Service** on a machine that has an order

**Expected:** the task list includes **Before Photos, Money Operations, Fills &
Ending Inventory, Removals & Returns, Kit Returns (if applicable), After
Photos** — and **Fills & Ending Inventory stays disabled until Money Operations
is complete**.

---

## V-TC-036 — Task enablement rules
1. On a fresh station, note which tiles are enabled
2. Complete **Money Operations** → re-check
3. Complete **Fills & Ending Inventory** → re-check

**Expected:** Before Photos and Money Operations enabled when required; **Fills
& Ending Inventory and Removals & Returns enable once money bags are
satisfied**; **Kit Returns** and **After Photos** enable once Fills & Ending
Inventory is complete.

---

## V-TC-026 — FINAL service confirmation
1. From Other options, tap **FINAL**

**Expected:** a Final Service screen asking **"Do you want to continue with
Final Service?"** with **NO** and **Yes** — **Yes selected by default**.

---

## V-TC-027 — FINAL service task list
1. Tap **Yes** on the Final Service confirmation

**Expected:** the task list shows **Before Photos, Money Operations, Removals
and Returns, After Photos**.

---

## V-TC-028 — SPOT service task list
1. From Other options, tap **SPOT**

**Expected:** the service task screen shows `<date>` `<Route number>`
`Machine:<Machine no.>` **SPOT Service**, with:
1. Before Photos *(Optional)* 2. Money Operations 3. Fills & Removals
*(disabled)* 4. After Photos *(disabled)* — and **Complete Delivery disabled**.

---

## V-TC-035 — Spot Service requires at least one fill or spoil
1. Run a **SPOT** service and try to complete it with **no** entries
2. Add one **Fill** or **Spoil** entry

**Expected:** at least one Fill or Spoil entry is **required** before the service
can complete.

---

## V-TC-034 — Spot not offered for Wet or Changer machines
1. Open a **Wet** or **Changer** machine and review the service types

**Expected:** **SPOT is not offered** for those machine types.

**How to read the result:** you need a Wet or Changer machine on the route. If
none exists, that is a **data gap**, not a defect.

---

## V-TC-007 / V-TC-031 — Audit is NOT shown for Vending
1. Open a Vending machine's task list

**Expected:** **Audit is not shown** for a Vending machine type.

**How to read the result:** this is the deliberate contrast with Market, where
Audit (Market Physical) **is** shown.

---

# Headers, addresses and orders

## V-TC-037 — Vending header shows the machine / POS identifier
1. Open a Vending machine and note the **primary header**
2. Move through the delivery screens

**Expected:** the **machine number or POS identifier** is the primary header and
**persists** across Vending delivery screens — and **differs** from Coffee's and
Market's account-location headers.

---

## V-TC-043 — Order number on the Delivery page
1. Open a machine with an order, and look at the header area
2. Then open one **without** an order

**Expected:** `Order <number>` when an order exists; **`No Orders`** when not.

**How to read the result:** on other LOBs the order number sits on a **separate
line beneath** the location name — check there before reporting it missing.

---

## V-TC-044 — Vending delivery location shows its own address
1. Stop Preview → expand the **vending** card

**Expected:** the Vending delivery location shows **its own delivery address**.

---

## V-TC-041 — Navigate to the stop using the default maps app
1. Stop Preview → **Navigate**

**Expected:** the default navigation app opens with directions to the stop.

---

# Photos

> **The camera screen has no labels** — three controls: flash (left), **shutter
> (centre, largest)**, camera flip (right). Capture plus review can take
> **20–40s** on the emulator.

## V-TC-001 — Before Photos requires at least one photo
1. Open **Before Photos** → **Take photo** → centre shutter → attach

**Expected:** the section shows a **green checkmark** on completion.

---

## V-TC-002 — After Photos disabled until required tasks are complete
1. On a fresh station, try **After Photos**
2. Complete all mandatory tasks **and** Before Photos, then retry

**Expected:** After Photos **enables only** once all mandatory tasks and Before
Photos are complete.

**How to read the result:** this is the same precondition that breaks Coffee's
After-Photos cases. Disabled early is **correct**.

---

## V-TC-003 — Retake, delete or skip optional photos
1. Capture a photo → use **retake** and **delete** on the review screen
2. On an optional requirement, use **Skip photo**

**Expected:** the new capture is **added** as expected; Skip proceeds without
capturing.

**Known behaviour elsewhere:** on Coffee, *"Take photo"* on the review screen
**adds** rather than replaces — worth checking whether Vending behaves the same.

---

# Fills, Ending Inventory and Planogram

## V-TC-008 — Product title displayed
1. Open **Fills**

**Expected:** each product's **title** is displayed.

---

## V-TC-009 — Par, Capacity, Ordered, Picked values
1. On **Fills**, inspect a product row

**Expected:** **Par**, **Capacity**, **Ordered** and **Picked** fields display
values under the designed labels.

---

## V-TC-010 — Keypad arrows move only between editable quantity fields
1. Focus a quantity field on Fills → use the keypad **Down / Up arrows**

**Expected:** focus moves only between **editable** quantity fields — never to a
read-only Ordered quantity or an unrelated button.

---

## V-TC-011 — Filter and sort products on Fills
1. On **Fills**, apply a **filter**, then a **sort**

**Expected:** the Fills list updates to match the selected filter and sort.

**How to read the result:** active filter/sort state is reflected as a
**checked** control rather than by visibility — check the control's state, not
whether it is on screen.

---

## V-TC-012 — Ending Inventory persists after reopening Fills
1. Enter **Fills** and **Ending Inventory** values → complete the task
2. Reopen **Fills**

**Expected:** **both** Fills and Ending Inventory values remain as entered.

---

## V-TC-013 — Fills and Ending Inventory auto-save, no Complete button
1. Enter values on Fills / Ending Inventory
2. Navigate away without any explicit save

**Expected:** data saves **automatically with no save prompt**, and there is
**no Complete button** at the bottom of the screen.

---

## V-TC-014 — Active planogram effective on or before the business date
1. Note the **business date** in the header
2. Open the **Planogram** from Fills

**Expected:** the **most recently effective planogram on or before that business
date** is used.

---

## V-TC-015 — Open Planogram from Fills and verify the screen
1. **Fills** → open **Planogram**
2. Switch **category views** and **layout orientations**

**Expected:** the Planogram loads for the selected location, **Date and Route
chips** show in the header, and **only the selected category's data** is shown
per column.

---

## V-TC-016 — Planogram title and machine name
1. On the Planogram screen, read the header

**Expected:** title **Planogram**, subtitle **Machine <id> POG**
(e.g. `Machine 68621 POG`).

---

## V-TC-017 — Planogram category list
1. Open the Planogram category list

**Expected:** **Ending inventory · Fills · Par / Capacity · Price · Spoils /
Return to truck · Service tests · Product**.

---

# Removals and Returns

## V-TC-005 — Record removals with filter and sort
1. Open **Removals & Returns** → search or scan a product
2. Enter quantities for **Damaged, Spoiled, Theft** or **Truck return**
3. Apply **filters** and **sort** options

**Expected:** the removal saves with **product name, size and returned
quantity**; the product list updates to match the filter/sort.

---

## V-TC-006 — Skip removals when none are required
1. Leave **Removals & Returns** untouched and proceed

**Expected:** the driver proceeds **without recording a removal**.

---

# Money Operations

> Money bag numbers are **numeric**. Length rules are the subject of V-TC-018
> and V-TC-019.

## V-TC-018 — Bag number length 3 to 5 accepted
1. **Money Operations** → enter a bag number of **3–5 digits**

**Expected:** accepted **without error**.

---

## V-TC-019 — Bag number longer than 5 rejected
1. Enter a bag number of **more than 5 digits**

**Expected:** **rejected** with an **error message and sound**.

---

## V-TC-020 — Skip Money Bag does not auto-select when a bag number is deleted
1. Enter a bag number, then **delete** it

**Expected:** **Skip Money Bag is not automatically selected** — it should only
be set when the driver explicitly chooses it.

---

## V-TC-021 — Money Operations numeric validation
1. Enter valid numbers, then invalid ones (letters, negative)

**Expected:** valid accepted; invalid rejected; **Continue / Save stays
disabled** until corrected.

---

## V-TC-022 — Bag codes, refund and replenishment
1. Tick **Skip Money Bag** → check the bag code field
2. Enter a **duplicate** or invalid bag code
3. Enter valid **replenishment** and **refund** values

**Expected:** Skip Money Bag **disables** bag code entry; duplicate/invalid codes
are **rejected**; valid values **enable Continue**.

**Known on Market:** ticking Skip does **not** disable the field there — worth
checking whether Vending shares that defect.

---

# Wet machine meters

## V-TC-045 — Meter validation blocks invalid readings
1. Open a **Wet** machine → enter an **invalid** meter reading
2. Then enter valid readings for **all** required meters

**Expected:** invalid values **trigger an error and block progress**; valid
readings allow continuing.

---

## V-TC-046 — Meter reading validated against prior reading tolerance
1. On a Wet machine, enter a reading far outside the prior reading's tolerance

**Expected:** an **error** is displayed and **progress is blocked** until
resolved.

**How to read the result:** both Wet cases need a **Wet machine** on the route.
No Wet machine = **data gap**, not a defect.

---

# Skip, complete and delete

## V-TC-038 — Skip a stop and resume service on a skipped machine
1. Skip a machine → confirm the **skip indicator**
2. Tap the skipped machine again → complete the required service

**Expected:** you are taken to **Service Selection**, and completing the service
**clears the skip indicator**.

---

## V-TC-039 — Complete Stop and Skip Stop state handling
1. Confirm **Complete Stop stays disabled** until every required station reaches
   a terminal state
2. Confirm **Skip Stop requires explicit confirmation**
3. **Re-enter and complete a previously skipped station**
4. Return to Home and compare **totals** with the **Pending / Completed** counts

**Expected:** stop state is not corrupted.

**⚠️ Known on Market:** completing a **previously skipped** station corrupts the
schedule counts there (totals disagree with tab counts). **Check carefully
whether Vending shares this** — it would be the same defect.

---

## V-TC-042 — Mark a service station complete
1. Complete all mandatory tasks → complete the station

**Expected:** the tile shows a **green tick** and updated **progress bar**, and
you return to the main Vending screen.

> **Destructive** — use a past day.

---

## V-TC-023 — Deleting an added delivery removes it from the schedule
1. Create an ad-hoc Vending delivery
2. Delete it

**Expected:** **all data is cleared** and the delivery is **removed from the
schedule entirely**.

---

## V-TC-029 — Deleting a completed unsynced service returns the machine to unhandled
1. Complete a service **without syncing**
2. Delete that scheduled service

**Expected:** all recorded data is **cleared**, and the machine returns to
**unhandled** status on the schedule.

---

## Quick triage guide

| What you see | Most likely | Check first |
|---|---|---|
| No stops on the route | **Wrong day** | 990 had 15 on 31 Aug, 0 today/tomorrow |
| Fills / Removals disabled | **Correct gating** | complete **Money Operations** first |
| After Photos disabled | **Correct gating** | complete mandatory tasks + Before Photos |
| Audit missing | **Correct** | Vending does not show Audit (V-TC-007/031) |
| No Wet or Changer machine | **Data gap** | needed by V-TC-034/045/046 |
| Bag number rejected | **Length rule** | 3–5 digits accepted, >5 rejected |
| Review screen never appears | **Timing** | allow 20–40s; hit the **centre** shutter |
| Totals disagree with tab counts | **Possible app bug** | the skip-then-complete defect seen on Market |
| Works by hand, fails automated | **Script** | a precondition the test skipped |
