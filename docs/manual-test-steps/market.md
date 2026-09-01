# Manual Test Steps — Market (M-TC-001 … M-TC-042)

**Purpose.** When an automated test fails, run the matching steps here by hand
to decide: **real app bug, data problem, or broken script?** Every case ends
with a "How to read the result" line.

**Build verified against:** 0.1.92 (`nexus-app-qa-debug-92.apk`)
**Last updated:** 2026-09-01

---

## Before you start

### Route

**Market runs on Miami, FL / Route 001.** Miami 010 is retired — if anything
still points there, that is the bug.

Miami 001 carries roughly **2–3 seeded Market stops per day**. Named stops seen
recently: `Teva Pharmaceutical Industries LTB`, `United Collection Bureau, Inc.`,
`Pet SuperMarket Sunrise`. Stop names change between re-pulls, so **state the
precondition ("a pending Market stop"), never the account name**.

### Servicing a stop consumes it — permanently

Completing or skipping a stop is **irreversible**. A same-route Route Setup
reset clears *local* corruption but **cannot un-complete a stop server-side** —
it re-pulls the server's truth, which now says "done".

The day selector only offers yesterday / today / tomorrow, so **a consumed day
becomes unreachable within 24 hours.**

> **Use YESTERDAY for anything destructive.** Past days recede and cost nothing;
> burning tomorrow destroys the next day's data. Roughly **one full Market pass
> per day** is the practical budget.

### Route Setup reset (when state gets tangled)

Hamburger → Settings → Route setup → same operation → same route → Change route
→ confirm → Select Day → Confirm. This clears the local DB and re-pulls, and it
**undoes Start Day**, so you will need to complete prep again.

### Identifying a Market service screen

| LOB | Tiles |
|---|---|
| **Market** | Money Operations, Removals & Returns, **Market Physical**, Market Transfers |
| Coffee | Equipment Audit, Add Presale, Signing Order |
| Vending | FULL SERVICE / SPOT / FINAL |

### Standard setup (assumed by every case below)

1. Route Setup → **Miami, FL / Route 001** → pick your day
2. Complete **Start Day** if the gate appears
3. Home → tap a pending Market stop → expand the **Market** card → open the
   service station

---

# Stops and navigation

## M-TC-001 / M-TC-042 — View market stops, open Stop Preview
1. On Home, look at the **Pending action** tab
2. Tap a Market stop

**Expected:** pending Market stops are listed; tapping one opens **Stop
Preview** showing **Date**, **Location** and **Service Type**.

**How to read the result:** an empty list usually means the wrong day — check
Home's LOB counters first.

---

## M-TC-002 — Delivery header shows the account location name
1. Open a Market stop → open its service station
2. Note the **bolded primary header**
3. Open **Delivery**, then a product screen

**Expected:** the account location name is the bold header and **persists**
across the Market delivery and product screens.

**Sheet status: Failed.** Confirm whether the name is missing entirely or is
simply replaced on a later screen — those are different defects.

---

## M-TC-003 — Each delivery location shows its own address
1. Stop Preview → expand the **Market** card

**Expected:** the Market delivery location shows **its own delivery address**,
per service line.

---

## M-TC-004 — Order number on the Delivery page
1. Open a Market stop's service station
2. Look directly beneath the location name in the header
3. Then create an **ad-hoc** delivery (Home → "+") and open it

**Expected:** a real stop shows **`Order <number>`**; an ad-hoc delivery with no
backend order shows **`No Orders`**.

**How to read the result — read this before reporting:** the order number is a
**separate line beneath the location name** (e.g. `United Collection` above
`Order 13517428`). The sheet records this as **Failed**, but that traced to a
script reading the location-name node instead of the order line — the app
displays it correctly. Also note **not every station has an order**: the first
stop's first station may legitimately show `No Orders`, which is the negative
half of this same case.

---

## M-TC-005 — Scheduled markets display immediately
1. Home → tap a Market stop → expand the **Market** card

**Expected:** all markets scheduled under the stop appear **immediately**, with
no extra dropdown selection.

---

# Service checklist

## M-TC-006 — Task categories with running item counts
1. Open the service station and confirm the categories: **Before Photos,
   Removals & Returns, Delivery, Market Physical (Audit), After Photos**
2. Open **Removals & Returns**, add a product with quantity **2**, save
3. Press Back to the checklist and read the tile

**Expected:** the category shows the **count of items entered** next to the
title.

**Known result: PASS on 0.1.92** — tiles read `1 item`, `1 photo`,
`Cycle(1)`. Note the count is **item lines, not quantity**: a saved quantity of
2 on one product reads `1 item`.

---

## M-TC-007 — Complete Delivery disabled until mandatory tasks are done
1. On a fresh service station, check **Complete Delivery** at the bottom
2. Complete each mandatory task, including photos

**Expected:** Complete Delivery stays **disabled** until all mandatory tasks
(photos included) are complete, then becomes **enabled**.

---

## M-TC-008 — Mark a service station complete
1. Complete all mandatory tasks → tap **Complete Delivery**

**Expected:** the service station tile shows a **green tick** and an updated
**progress bar**; you are returned to the main Market screen.

> **Destructive** — this consumes the stop. Use YESTERDAY.

---

# Delivery and numeric validation

## M-TC-009 — Delivery quantity rejects malformed text
1. Open **Delivery** → tap a product's quantity field
2. Enter letters / symbols (e.g. `abc`, `@@`)

**Expected:** the value is rejected and **Continue stays disabled**.

**How to read the result:** the app uses a **custom keypad**, not the system
keyboard. If you cannot type letters at all, that is the app preventing invalid
input — a pass, not a blocked test.

---

## M-TC-010 — Delivery quantity rejects negative numbers
1. Same as above, entering `-5`

**Expected:** rejected, **Continue stays disabled**.

---

## M-TC-011 — Fills quantity accepts valid positive numbers
1. Open **Fills** → enter a valid positive quantity

**Expected:** accepted, and **Continue becomes enabled**.

---

## M-TC-026 — Delivery numeric validation, valid and invalid
1. In **Delivery**, enter a valid number → then an invalid one

**Expected:** valid accepted; invalid rejected; **Continue / Save stays
disabled** until corrected.

---

## M-TC-040 — Keypad arrows move only between editable quantity fields
1. Open **Fills** (or Delivery) with several products
2. Focus a quantity field and use the keypad's **Down / Up arrows**

**Expected:** focus moves to the **next editable quantity field** only — never
to a read-only Ordered quantity or an unrelated button.

**Known:** a single Down-arrow tap not reaching the next field is a **tracked
PBI**, carried as a gap test.

---

# Removals and Returns

## M-TC-013 — Record a removal with reason and quantity
1. Open **Removals & Returns** → search a product → select it
2. Enter a **Removed Quantity**
3. Choose a reason: **Damaged, Spoiled, Theft, or Truck Return**
4. Save, then reopen the tile

**Expected:** the removal is saved and shown with **product name and returned
quantity**, and persists on reopen.

---

## M-TC-014 — Proceed without recording any removal
1. Open the service station, leave **Removals & Returns** untouched

**Expected:** the driver can proceed; Complete Delivery is not blocked by it.

---

## M-TC-033 — No-match search selects nothing
1. **Removals & Returns** → search a nonsense term (e.g. `XYZNONEXISTENT`)

**Expected:** no results, or a clear **no-match** state — and **no product is
selected or populated** on the parent screen.

---

## M-TC-034 — Search and scan return the expected product
1. **Removals & Returns** → search a real product name or SKU
2. Select a result

**Expected:** matching results shown, and the selected item's details appear on
the parent screen.

---

## M-TC-028 — Search and scan in **Fills → Add Product**
1. **Fills** → **Add Product** → search a product → select it

**Expected:** matching results shown, selected item details carried to the
parent screen.

---

# Audit (Market Physical)

## M-TC-024 / M-TC-029 — Audit is shown for a Market machine type
1. Open a Market service station and read the task list

**Expected:** **Market Physical / Audit is shown** for a Market machine type.

---

## M-TC-015 — Cycle Count or Full Audit with search and numeric entry
1. Open **Market Physical** → the **Count Type** modal offers **Cycle count**
   and **Full audit** (first time only)
2. Choose one → search a product → enter a count

**Expected:** counts save as **editable count pills**; **Continue stays disabled
until at least one valid count** is entered.

---

## M-TC-016 — Scanning a product repeatedly increases its count
1. In the audit, scan the same product several times

**Expected:** the counted quantity **increases with each scan** — it does not
create duplicate rows.

---

## M-TC-025 — Audit counts persist and complete with correct status
1. Enter counts → scroll away → return → re-enter the audit

**Expected:** edited counts **persist**, and Audit completes with the correct
status on the workflow screen.

---

# Money Operations

> **Bag codes are NUMERIC.** A text code like `EDBAG` is silently rejected and
> Save never completes — that looks like broken navigation but is invalid input.
> Use a number such as `91`.

## M-TC-019 / M-TC-031 — Bag code, bills, coins and refund
1. Open **Money Operations** → enter a valid **numeric bag code**
2. Enter **Replenished Bills**, **Coins**, and a **Refund** value
3. Tap **Save / Continue**

**Expected:** valid values are accepted and **Continue is enabled** once
requirements are met.

**How to read the result:** the keypad can cover the bag list — dismiss it
before deciding a bag "wasn't added".

---

## M-TC-018 — Duplicate bag code is blocked
1. Add a bag code, then add **the same code again** on the same day

**Expected:** the duplicate is **blocked** with a confirming error message.

---

## M-TC-017 — Delete a bag and confirm
1. With a bag added, delete it and confirm

**Expected:** the bag is removed from the list and the **task title count
updates**.

---

## M-TC-021 — Money Operations shows total bags added
1. Add one or more bags → return to the checklist

**Expected:** the **Money Operations** tile shows the count of added bags.

---

## M-TC-030 — Money Operations numeric validation
1. Enter valid numbers in Bills / Coins / Refund
2. Then try invalid input (letters, negative)

**Expected:** valid accepted; invalid rejected.

**Known:** a negative sign being **stripped** is expected behaviour here.

---

## M-TC-031 (skip half) — Skip Money Bag disables bag entry
1. Tick **Skip money bag**

**Expected:** bag code entry becomes **disabled**.

**Known gap:** ticking Skip does **not** currently disable the field — tracked
as a gap test. If you see the field still active, that is the known issue.

---

# Skip, complete and transfers

## M-TC-023 — Skip Stop requires reason and disposition
1. On a service station, choose **Skip Stop**

**Expected:** **Reason for Skipping** defaults to *"Select reason"* with nothing
pre-chosen; **no disposition radio is pre-selected**; **Skip Stop stays
disabled** until both are chosen.

---

## M-TC-032 — Skip a stop, then resume service on it
1. Skip a machine → confirm the **skip indicator** on the stop
2. Tap the skipped machine again → complete the required service

**Expected:** the skip indicator **clears** once the service is completed.

**Known:** skipping alone does **not** corrupt counts — see M-TC-035.

---

## M-TC-035 — Complete Stop and Skip Stop state handling
1. Confirm a stop cannot be completed until **every mandatory service** is done
2. Confirm Skip Stop requires **explicit confirmation**
3. **Re-enter a previously skipped station and complete it**
4. Return to Home and compare the **totals** with the **Pending / Completed**
   tab counts

**Expected:** re-entering and completing a skipped station leaves stop state
intact.

**⚠️ KNOWN APP DEFECT — the one confirmed Market bug.** Completing a
**previously skipped** station **corrupts the schedule counts**: Home shows e.g.
`2 Deliveries` / `Remaining of 2` while the tabs read `Pending action (1)` /
`Completed (0)` — a stop vanishes from both tabs.

> This **leaves the route corrupted.** Run a Route Setup reset afterwards, and
> expect stops to be missing until you do.

---

## M-TC-036 / M-TC-027 — Complete Stop navigates to Schedule; full journey
1. Complete every task on a Market stop → **Complete Delivery / Complete Stop**

**Expected:** the app navigates to the **Schedule** screen, Home reflects the
updated **completed** status, and you can continue to the next task without
losing context.

> **Destructive** — consumes the stop. Use YESTERDAY.

---

## M-TC-022 — No nearby markets blocks transfer creation
1. Open **Market Transfers** on a stop with no nearby markets

**Expected:** an **exclamation icon** indicates no nearby markets, plus an
informational message explaining transfers cannot be created.

---

# Photos

> **Camera screen has no labels at all.** It has exactly three controls: flash
> (left), **shutter (centre, largest)**, camera flip (right).

## M-TC-037 — Retake, delete or skip optional photos
1. Open **Before Photos** → the sheet offers **Take photo** and **Skip photo**
2. **Take photo** → tap the **centre shutter**
3. On the review screen (titled **Photos**) confirm **Take photo** (retake) and
   **Delete photo** are offered
4. **Delete photo** → the image is removed and you return to the **camera**
5. Back out, reopen **Before Photos**, tap **Skip photo**

**Expected:** capture, retake and delete all work; Skip photo proceeds without
capturing.

**How to read the result:** capture plus review render can take **20–40s** on
the emulator. Allow time before concluding the shutter failed. Note "Take photo"
on the review screen **ADDS** another capture rather than replacing —
raised with Anthony.

---

## M-TC-041 — Capture, label, describe and attach a photo
1. Take a photo → on the review screen choose a **Label** and type a
   **description**
2. Tap **Attach Photo** *(disabled until a Label is chosen)*
3. Return to the checklist

**Expected:** the photo is saved against the selected label. The **Before
Photos** tile then reports the stored photo — on 0.1.92 it reads **`1 photo`**
(older builds read *"tap to view"*).

---

## M-TC-038 — Navigate to the stop using the default maps app
1. Stop Preview → tap **Navigate**

**Expected:** the device's default navigation app opens with directions
(verified: Google Maps opens at the stop address).

---

## Quick triage guide

| What you see | Most likely | Check first |
|---|---|---|
| Stop list empty | **Data / wrong day** | Home LOB counters; try another day |
| "Stop not found under either tab" | **Corrupted counts** | the M-TC-035 defect — reset the route |
| Totals disagree with tab counts | **App bug** | same skip-then-complete defect |
| Money bag never saves | **Invalid input** | bag codes must be **numeric** |
| Review screen never appears | **Timing** | allow 20–40s; confirm you hit the centre shutter |
| Order number "missing" | **Reading the wrong line** | it sits *below* the location name |
| Works by hand, fails automated | **Script** | a precondition the test skipped |
