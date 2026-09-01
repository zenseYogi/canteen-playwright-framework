# Manual Test Steps — Menu, Transfers & Route Operations (TC002 … TC017)

**Purpose.** When an automated test fails, run the matching steps here by hand
to decide: **real app bug, data problem, or broken script?** Every case ends
with a "How to read the result" line.

**Build verified against:** 0.1.92 (`nexus-app-qa-debug-92.apk`)
**Last updated:** 2026-09-01

---

## Before you start

### ⚠️ These TC numbers come from ROW ORDER, not the sheet

The Menu sheet's **`TC #` column is empty** — every row is blank there. The
numbering below is the sheet's **row order** (row 2 = TC001 … row 18 = TC017),
which is what the automation tags (`@Menu-TC002`, `@Menu-TC003`, …) follow.

**Consequence:** if rows are ever inserted or reordered in the workbook, every
number after that point shifts. When reporting a Menu case, **quote the scenario
text as well as the number** so it stays unambiguous.

### Sub-areas covered

| TCs | Sub-area |
|---|---|
| TC002 | Menu — Device Information |
| TC003 | Menu — Route Setup |
| TC004–TC005 | Route Inventory / Truck Returns |
| TC006–TC009 | Route Shopping |
| TC010–TC013 | Transfers — Route to Route |
| TC014–TC017 | Transfers — Route to Warehouse |

*(TC001, DEX Support, is not in scope for this list.)*

### Route

Menu features are largely **route-agnostic** — they live under the hamburger
menu rather than in an LOB service flow. Use whichever route has data:
**Miami 001** (Market), **Charlotte 103** (Coffee/Vending volume) or
**Miami 990** (Vending).

**Route-to-Route transfers (TC013) need a second route** to transfer to — your
own route must not appear as a destination.

**Route-to-Warehouse (TC015)** needs a warehouse configured. Known limitation:
one Transfers case has been blocked historically because the account has only
**one** warehouse.

### Reaching these screens

- **Device info:** hamburger → **Settings → Device info**
- **Route setup:** hamburger → **Settings → Route setup**
- **Truck stock / Route inventory:** hamburger → **Truck stock** *(a collapsible
  group — expand it first)*
- **Transfers:** hamburger → **Transfers**

### Transfers LOB tabs

The Transfers screens carry **Coffee / Market / Vending** tabs. They are
**capitalised** — a previous lowercase assumption silently broke navigation, so
if a tab "cannot be found", check the casing before assuming a defect.

---

## TC002 — Device Information shows user, route and sync details
**Route:** any

1. Hamburger → **Settings → Device info**

**Expected:** the screen displays the **logged-in user**, **security
permissions**, **assigned route**, **last sync time**, and **hardware details**.

**How to read the result:** **last sync time is the most useful field in the
app.** If it is days old, the device is running on stale data — reinstall
cleanly (`adb uninstall` then `adb install`, never `-r`) before investigating
anything else.

---

## TC003 — Route change with warning message and data refresh
**Route:** any

1. Hamburger → **Settings → Route setup**
2. Select an **operation** and a **route**
3. Tap **Change route** → the **data deletion warning** appears
4. Tap **Cancel** → confirm the route is **unchanged**
5. Repeat and tap **Change route** to proceed
6. Choose a day on the **Select Day** sheet → **Confirm**

**Expected:** the warning reads *"If you proceed all information will be
DELETED."* Cancel leaves the route untouched. Proceeding **clears existing
handheld data** and **automatically downloads the newly selected route's data**.

**How to read the result — two known behaviours:**
- The **Operation/Route dropdowns can open empty** on occasion; that is the
  known Route Setup modal issue.
- The route modal's **search box does not filter** (typing "103" leaves all
  entries listed). Selection still works because the exact label is present.
- A route change **undoes Start Day** — expect to complete prep again. That is
  correct, not a regression.

---

## TC004 — Route Inventory and Truck Returns exclude zero-value rows
**Route:** any with inventory

1. Hamburger → expand **Truck stock** → open **Route Inventory** (or **Truck
   Returns**)
2. Enter a **zero** quantity on one record and **positive** quantities on others
3. Save, then delete one record

**Expected:** **zero-value records do not appear** in the final list; positive
records are saved with **correct quantities**; the deleted record is removed
**without affecting the remaining records**.

---

## TC005 — Market and truck inventory stay independent by LOB
**Route:** any

1. Record inventory values in a **market** context
2. Switch to the **truck** context (and/or another LOB) and record different
   values
3. Return to each in turn

**Expected:** market and truck-level records **do not cross-contaminate**; each
LOB preserves **its own counts** aligned with the selected context.

---

## TC006 — Search or scan products in Route Shopping
**Route:** any

1. Hamburger → **Truck stock** → **Route Shopping**
2. Search (or scan) a product name / SKU
3. Select a result

**Expected:** matching results are displayed, and the selected product's details
appear on the parent screen **with quantity and package information**.

---

## TC007 — Route Shopping add, update, delete, save and discard
**Route:** any

1. In **Route Shopping**, **add** a product, **update** a quantity, **delete**
   another
2. Choose **Save** → reopen the list
3. Repeat the edits, then choose **No / Discard** → reopen the list

**Expected:** **Save persists** the updated list. **No / Discard restores the
previous state** with unsaved changes dropped.

---

## TC008 — No-match search selects nothing (Route Shopping)
**Route:** any

1. In **Route Shopping**, search a nonsense term (e.g. `XYZNONEXISTENT`)

**Expected:** no results, or a clear **no-match state** — and **no incorrect
product** is selected or populated on the parent screen.

---

## TC009 — Search and scan return the expected product (Route Shopping)
**Route:** any

1. Search a **real** product name or SKU → select a result

**Expected:** matching results shown, with the selected item's details on the
parent screen.

---

## TC010 — Search and scan in Route-to-Route transfers
**Route:** any

1. Hamburger → **Transfers** → **Route to Route**
2. Pick the LOB tab (**Coffee / Market / Vending** — note the capitalisation)
3. Search or scan a product → select it

**Expected:** matching results displayed, and the selection **populates the
parent screen**.

---

## TC011 — No-match search selects nothing (Route to Route)
1. In a Route-to-Route transfer, search a nonsense term

**Expected:** no match, and **no incorrect product** selected or populated.

---

## TC012 — Search and scan return the expected product (Route to Route)
1. Search a real product → select it

**Expected:** matching results with the selected item's details on the parent
screen.

---

## TC013 — Complete a Route-to-Route transfer
**Route:** any · **needs a second route to transfer to**

1. **Transfers** → **Route to Route**
2. Choose a **destination route**
3. Add products with quantities → complete the transfer

**Expected:** the transfer is **initiated and completed successfully**, and
**your own route does not appear** as a destination option.

**How to read the result:** the "own route excluded" clause is half the case —
check the destination list explicitly rather than only that the transfer
succeeded.

> **Destructive** — this moves real stock. Prefer a past day, and be aware a
> deleted transfer with products has shown persistence quirks before.

---

## TC014 — Search and scan in Route-to-Warehouse transfers
1. **Transfers** → **Route to Warehouse**
2. Search or scan a product → select it

**Expected:** matching results displayed, and the selection populates the parent
screen.

---

## TC015 — Complete a Route-to-Warehouse transfer
**Route:** any · **needs a warehouse configured**

1. **Transfers** → **Route to Warehouse**
2. Choose the **warehouse**, add products with quantities
3. Complete the transfer

**Expected:** the transfer completes with **correct warehouse and quantity
details**.

**Known limitation:** where the account has only **one** warehouse, any case
needing a **choice** of warehouse cannot be exercised. That is a **data/account
limitation**, not a defect.

---

## TC016 — No-match search selects nothing (Route to Warehouse)
1. In a Route-to-Warehouse transfer, search a nonsense term

**Expected:** no match, and **no incorrect product** selected or populated.

---

## TC017 — Search and scan return the expected product (Route to Warehouse)
1. Search a real product → select it

**Expected:** matching results with the selected item's details on the parent
screen.

---

## Quick triage guide

| What you see | Most likely | Check first |
|---|---|---|
| Last sync days old | **Stale app data** | reinstall cleanly, never `adb install -r` |
| Route dropdown opens empty | **App bug** | the known Route Setup modal issue |
| Search box does not filter | **Known** | the exact label is still selectable |
| Start Day undone after a route change | **Correct** | a route change clears handheld data by design |
| Transfers LOB tab "not found" | **Casing** | tabs are **Coffee / Market / Vending**, capitalised |
| Only one warehouse offered | **Account limitation** | blocks warehouse-choice cases; not a defect |
| Own route offered as a destination | **App bug** | TC013 requires it be excluded |
| Works by hand, fails automated | **Script** | a precondition the test skipped |

---

## Note on the numbering

Because the workbook leaves `TC #` blank, these numbers exist only by
convention — in the row order of the Menu sheet, matching the `@Menu-TCnnn` tags
in the automation. **If the sheet gains a TC # column, reconcile against it and
update both this file and the tags.** Until then, quote the scenario text
alongside the number in any defect report.
