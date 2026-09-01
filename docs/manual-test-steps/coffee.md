# Manual Test Steps — Coffee (C-TC-001 … C-TC-056)

**Purpose.** When an automated test fails, run the matching steps here by hand
to decide: **real app bug, data problem, or broken script?** Every case ends
with a "How to read the result" line.

**Build verified against:** 0.1.92 (`nexus-app-qa-debug-92.apk`)
**Last updated:** 2026-09-01

---

## Before you start — read this section, it explains most Coffee failures

### Route, and the single-stop problem

**Coffee runs on Charlotte, NC / Route 103.**

That route's 154 deliveries are **153 Vending stops and exactly ONE Coffee
stop** — Home's counters read `0/153 Vending`, `0/1 Coffee`. The one Coffee stop
is **`24Hundred Marketplace`**.

Consequences you will feel:

- **Every Coffee case runs against the same stop.** There is no second Coffee
  stop to fall back on.
- Any "search the route for a suitable stop" approach is nearly useless — it
  just opens Vending stops that can never qualify.
- Once that stop is serviced or completed, **later cases have nothing to work
  with** until the day is reset or you move to another day.

**`Amerock` is not real route data.** It is an ad-hoc account the automation
bootstraps, and it has not been on the route since the 2026-08-28 re-pull. If a
step or script names it, that is stale.

### Which day

Coffee's seeded data has stayed anchored to a **fixed date** rather than rolling
daily (unlike Market). Check Home's counters and pick the day that actually
shows Coffee deliveries — most recently **31 Aug** carried all 154.

### Servicing consumes the stop

Completing the Coffee stop is **permanent** for that day. Prefer a **past day**
for anything destructive: past days recede and cost nothing, while burning
tomorrow destroys the next day's data.

To get a clean station: Route Setup → same operation → same route → Change route
→ confirm → Select Day → Confirm. This clears the local DB and **undoes Start
Day**, so complete prep again afterwards.

### ⚠️ The precondition that breaks most Coffee runs

**After Photos only becomes enabled once the OTHER checklist items are
complete.** Opening it on a fresh stop does nothing — the *"Add supporting
photo"* sheet never appears. Complete Before Photos, Delivery, Equipment Audit
and Signing Order first, then After Photos opens normally.

If an automated After-Photos case fails with *"Add supporting photo not
displayed"*, that is this precondition, **not** a broken locator.

### Coffee service checklist — the tiles

`Before Photos` · `Delivery` · `Equipment Audit` · `Add Presale` *(Optional)* ·
`After Photos` · `Signing Order` → **Complete Delivery**

Coffee is identifiable by **Equipment Audit** and **Add Presale**; Market shows
Money Operations / Market Physical instead.

### Standard setup (assumed by every case below)

1. Route Setup → **Charlotte, NC / Route 103** → the day carrying Coffee data
2. Complete **Start Day** if the gate appears
3. Home → open **24Hundred Marketplace** → expand the **coffee** card → open the
   service station

---

# Stops, headers and navigation

## C-TC-050 — View stops and open Stop Preview
1. On Home, view the **Pending action** tab
2. Tap the Coffee stop

**Expected:** pending stops listed; tapping one opens **Stop Preview** with
**Date**, **Location** and **Service Type**.

---

## C-TC-006 — Delivery header shows the account location name
1. Open the Coffee service station and note the **bold primary header**
2. Open **Delivery**, then a product screen

**Expected:** the **account location name** is the bold header, persists across
Coffee delivery and product screens, and is shown **instead of an equipment
identifier**.

---

## C-TC-037 — Coffee delivery location shows its own address
1. Stop Preview → expand the **coffee** card

**Expected:** the Coffee delivery location shows **its own delivery address**
(e.g. `2400 Yorkmont Rd Charlotte North Carolina 28217-4511`).

---

## C-TC-054 — Order number on the Delivery page
1. Open the Coffee service station and look **below the location name**
2. Then open an ad-hoc delivery with no backend order

**Expected:** a real stop shows **`Order <number>`**; an ad-hoc with no order
shows **`No Orders`**.

**How to read the result:** the order number is a **separate line beneath** the
location name — not the header itself.

---

## C-TC-045 — Navigate to the stop using the default maps app
1. Stop Preview → tap **Navigate**

**Expected:** the default navigation app opens with directions.
**Verified:** Google Maps opens at `2400 Yorkmont Rd`.

---

## C-TC-043 — App navigates to Schedule after Complete Stop
**⚠️ NOT APPLICABLE TO COFFEE.** There is no **Complete Stop** action on the
Coffee flow — the equivalent is **Complete Delivery**, and the stop closes when
its single station completes. Recorded as not reachable; do not raise a defect
for a missing button.

---

# Deliveries and products

## C-TC-014 — Search or scan and add a product to Deliveries
1. Open **Delivery** → search a product name or SKU → select it

**Expected:** the product appears with **Ordered** and an editable **Delivered**
field; **Continue enables** once a valid delivered quantity is entered.

---

## C-TC-028 — Product SKU displayed beneath the product name
1. On **Deliveries**, inspect any product row

**Expected:** each product's **SKU** appears directly **beneath its name**.

---

## C-TC-029 — Re-adding an existing product increments quantity
1. Add a product, then **scan or add the same product again**

**Expected:** quantity **increases by one**, the product **moves to the top**,
and **no duplicate line** is created.

---

## C-TC-011 — Delete a manually added product with confirmation
1. Add a product manually → delete it → confirm

**Expected:** the product is **removed** from the delivery list.

---

## C-TC-047 — Keypad arrows move only between editable quantity fields
1. On **Deliveries** with several products, focus a quantity field
2. Use the keypad **Down / Up arrows**

**Expected:** focus moves only between **editable Delivered fields** — never to
the read-only **Ordered** quantity or unrelated buttons.

---

## C-TC-051 / C-TC-052 / C-TC-053 — Fills quantity validation
1. Open **Fills** and enter, in turn:
   - **C-TC-051:** malformed text (`abc`)
   - **C-TC-052:** a negative number (`-5`)
   - **C-TC-053:** a valid positive number

**Expected:** malformed and negative values are **rejected with Continue
disabled**; valid positives are **accepted and enable Continue**.

**How to read the result:** the app uses a **custom keypad**. If letters cannot
be typed at all, that is the app rejecting invalid input — a pass.

---

# Pre-sales

## C-TC-010 — Create a presale with a valid delivery date and product
1. Open **Add Presale** → **Add Presale** → choose a **Delivery Date**
2. Add a product with a quantity → save

**Expected:** the presale is saved and shown on **Pre-sales** with an **Items**
count and **Delivery Date** (e.g. `Items 100`, `Wed 2 Sep`).

---

## C-TC-027 — Presale Continue disabled until a product is added
1. Open a new presale with **no products**

**Expected:** **Continue stays disabled**; adding one product with a valid
quantity **enables** it.

---

## C-TC-031 — Search and scan in a Presales order
1. In the presale, search a product → select it

**Expected:** matching results displayed; selected product details appear on the
parent screen.

---

## C-TC-007 — Cancel presale creation with unsaved changes
1. Start a presale, add a product, then **cancel / back out** without saving

**Expected:** **no presale is created**, and you return to **Pre-sales** without
the unsaved order.

---

## C-TC-012 — Delete a saved presale with confirmation
1. With a saved presale, delete it → confirm

**Expected:** the presale order is **removed** from the Pre-sales screen.

---

## C-TC-017 — Skip or complete Pre-sales via the Back arrow
1. Open **Pre-sales** → press **Back**
2. On the confirmation popup, tap **Skip pre-sale**
3. Reopen Pre-sales, add an order, press **Back**, choose **Complete**

**Expected:** Skip exits without completing; Complete marks **Add presale**
complete with a **green tick**.

---

# Equipment Audit

> Equipment **can be created and deleted** on this build. An empty audit offers
> a **+**; Add Equipment creates a card; **Delete Product** removes it. If no
> stop has equipment, create your own rather than hunting for one.

## C-TC-021 — Equipment list details, verify / mark missing
1. Open **Equipment Audit** (create a card first if empty)
2. Inspect the card
3. Mark it **Verified**, then another **Does not exist**

**Expected:** each item shows **Name, Model, Serial Number, Asset Number and
Equipped Date & Time**; statuses update with a checkmark / missing indicator.

**⚠️ KNOWN GAP:** the card shows Name, Model, Serial Number and Asset Number,
plus `1 photos` and `Recently Added` — but **no "Equipped Date & Time"**. That
half is a genuine gap; the rest passes.

---

## C-TC-034 — Add equipment enabled only when mandatory fields are complete
1. **Equipment Audit** → **+** → **Add Equipment**
2. With **Manufacturer\*** and **Model\*** empty, check the **Add equipment**
   button
3. Fill Account, **Manufacturer**, **Model**

**Expected:** **Add equipment stays disabled** until the mandatory fields are
set, then **enables**.

**Verified:** the form shows **all fields at once** — Account, Manufacturer*,
Model*, Barcode, Serial Number, Asset Number, Net/TLM Connected, Plumbed, Audit
Date. Note **Barcode is a dropdown** (`Select Barcode`), not free text.

---

## C-TC-036 — View, search, verify or mark equipment missing
1. In the audit, search for an item
2. Mark items **Verified** / **Does not exist**
3. Open **Add Equipment**

**Expected:** items are markable both ways, and **all add-equipment fields are
displayed at once** on one form.

---

## C-TC-030 / C-TC-042 — Search and scan during Equipment Audit
1. On the Equipment Audit screen (or an Add Equipment dropdown), search a term
2. Select a result

**Expected:** matching results shown; the selection carries to the parent
screen.

---

## C-TC-001 — Audit Date auto-populated and not editable
1. **Equipment Audit** → **+** → scroll to **Audit Date**
2. Try to tap / change it

**Expected:** an Audit Date reflecting the **business date** is filled in, and
**cannot be changed**.

**How to read the result:** confirm whether it follows the **business date**
(the day selected in Route Setup) or the device's system date — they can differ,
and only the business date is correct.

---

## C-TC-019 — Equipment Audit stays optional after relaunch
1. Confirm **Equipment Audit is optional** (not blocking Complete Delivery)
2. **Force-stop and relaunch** the app
3. Return to the same stop

**Expected:** Equipment Audit is **still optional** after relaunch.

---

## C-TC-020 — Equipment Audit optional, does not block completion
1. Leave Equipment Audit untouched
2. Complete the other mandatory tasks → **Complete Delivery**

**Expected:** the stop **completes without a blocking validation** for the
skipped audit.

---

# Photos

> **The camera screen has no labels at all** — three controls: flash (left),
> **shutter (centre, largest)**, camera flip (right). Capture plus review render
> can take **20–40s** on the emulator.

## C-TC-009 — Capture, label and attach **Before** Photos
1. Open **Before Photos** → **Take photo** → tap the **centre shutter**
2. On the review screen (**Photos**), choose a **Label**, add a description
3. Tap **Attach Photo**

**Expected:** the photo attaches and **Before Photos is marked complete in
green**.

---

## C-TC-008 — Capture, label and attach **After** Photos
**⚠️ Complete the other checklist items first** — After Photos is disabled until
then.

1. Complete Before Photos, Delivery, Equipment Audit and Signing Order
2. Open **After Photos** → capture → label → **Attach Photo**

**Expected:** **After Photos marked completed in green**.

---

## C-TC-016 — Skip **Before** Photo with a reason
1. Open **Before Photos** → **Skip photo** → choose a reason → confirm

**Expected:** the reason is saved and **Before Photos is marked complete** with
a check mark.

---

## C-TC-015 — Skip **After** Photo with a reason
**⚠️ Same precondition as C-TC-008** — complete the other items first.

1. Open **After Photos** → **Skip photo** → choose a reason → confirm

**Expected:** **After Photos marked complete** with a tick.

---

## C-TC-044 — Retake, delete or skip optional photos
1. Capture a photo → on the review screen use **Take photo** (retake) and
   **Delete photo**
2. Then use **Skip photo** on an optional requirement

**Expected:** retake replaces / delete removes as expected; Skip proceeds
without capturing.

**⚠️ KNOWN — with Anthony:** *"Take photo"* on the review screen **ADDS another
capture rather than replacing** the previous one.

---

## C-TC-056 — Capture, label, describe and attach with a description
1. Capture → choose a **Label** → type a **description** → **Attach Photo**

**Expected:** the photo is confirmed and **saved against the selected label**.
**Attach Photo stays disabled until a Label is chosen.**

---

## C-TC-046 — Flash and camera flip available on capture screens
1. Open any in-app camera screen

**Expected:** **Flash** (left) and **Camera Flip** (right) are available, and
capture behaviour is otherwise unaffected.

---

## C-TC-041 — Complete Coffee service without adding photos
1. Complete the mandatory tasks but **attach no photos**
2. **Complete Delivery**

**Expected:** the service completes **whether or not photos are attached**.

---

# Signing Order, signature and payment

## C-TC-033 — Signing Order screen contents
1. Complete Delivery → open **Signing Order**

**Expected:** **Order number, Ordered Items, Items Delivered, Delivery summary**
and **Cost summary** are shown, with applicable prices (Delivery Charge,
Shipping & Handling, Product Cost, Total Cost). The **Sign off** option shows a
signature icon, and **Continue stays disabled until a signature is added**.

---

## C-TC-013 — Save customer signature and complete the Delivery activity
1. **Signing Order** → **Sign Off** → sign → add email details → save
2. Tap **Continue**

**Expected:** signature and email are saved, you return to Signing Order with
**Continue enabled**, and Delivery is marked complete with a **green tick**.

---

## C-TC-004 — Customer Signature back-navigation validation
1. Open **Customer Signature** and tap **Back** **without signing**
2. Reopen, **add a signature**, then tap **Back**
3. On the confirmation, tap **Cancel**

**Expected:** unsigned Back returns to Signing Order **with no popup**; after
signing, Back raises **"Are you sure?"**; **Cancel retains the signature**.

---

## C-TC-018 — Editing a signed delivery clears the signature status
1. With a signed delivery, go back and **edit a quantity**
2. Confirm the warning

**Expected:** a dialog states *"A customer signature has already been captured.
Any changes to this delivery will remove the signature and require the customer
to re-sign."* — and the **Sign for Order** completed status is **cleared** until
re-signed.

---

## C-TC-002 — Cash payment hides the Check Number field
1. **Signing Order** → **Payment** → set **Payment Type** to **Cash**

**Expected:** Cash shown in Payment Type, **no Check Number field**, and
**Comments remains optional**.

---

## C-TC-003 — Check payment requires a Check Number, max 10 digits
1. Set **Payment Type** to **Check**
2. Try entering more than 10 digits

**Expected:** **Check Number** is displayed and **mandatory**, and accepts a
**maximum of 10 digits**.

---

## C-TC-022 — Saving a Check payment without a Check Number is blocked
1. Choose **Check**, leave Check Number empty, try to save

**Expected:** a **validation message** appears and you **stay on the Payment
screen**.

---

## C-TC-023 / C-TC-024 / C-TC-025 — Order Payment Amount validation
1. On the Payment screen, in **Order Payment Amount**:
   - **C-TC-023:** leave it **empty**
   - **C-TC-024:** enter a **negative** number
   - **C-TC-025:** enter a **valid positive** number

**Expected:** empty → **Done stays enabled** and you can proceed; negative →
**rejected, Done still enabled**; valid positive → **accepted and saved**, Done
enabled.

**How to read the result:** Done staying enabled is **intended** here — this is
current app behaviour recorded in the sheet, not a defect.

---

## C-TC-026 — Payment saved without comments
1. Enter payment details, leave **Comments** empty, save

**Expected:** payment saves and you return to **Signing Order**.

---

## C-TC-032 — Signing Order completes without payment
1. Sign the order but **enter no payment** → **Continue**

**Expected:** the order **completes** and returns to the coffee menu; payment
remains **optional**.

---

# Completion and end-to-end

## C-TC-048 — Continue disabled until mandatory tasks are complete
1. On a fresh service station, check **Complete Delivery**
2. Complete each mandatory task in turn

**Expected:** stays **disabled** until all mandatory tasks are done, then
**enables**.

---

## C-TC-049 — Mark the service station complete
1. Complete all mandatory tasks → **Complete Delivery**

**Expected:** the station tile shows a **green tick** and updated **progress
bar**, and you return to the main screen.

> **Destructive** — consumes the day's only Coffee stop.

---

## C-TC-038 / C-TC-040 — Full end-to-end service
1. **Add Presale** → product + quantity → save
2. **Delivery** → enter delivered quantities
3. **Signing Order** → signature → payment (or skip)
4. **Complete Delivery**
5. Reopen the stop

**Expected:** presale and delivery summaries **preserve product, quantity,
signature and payment state**; the Coffee service is **marked complete** and
Home reflects it (`1/1 Coffee`, `Completed (1)`).

> **Destructive.**

---

## C-TC-039 — Over-delivery with optional payment
1. **Delivery** → enter a quantity **greater than Ordered** (e.g. Ordered 8,
   Delivered 9)
2. Open **Signing Order** → check the Delivery summary
3. Sign, **enter no payment**, tap **Continue**

**Expected:** **Ordered and Delivered are both shown clearly** (`8` / `9`), and
Signing Order **completes even with no payment**.

---

## Quick triage guide

| What you see | Most likely | Check first |
|---|---|---|
| "No Coffee stop found" | **Route reality** | there is only **1** Coffee stop — `24Hundred Marketplace` |
| After Photos does nothing | **Precondition** | complete the other checklist items first |
| Stop already completed | **Consumed** | reset the route, or use another day |
| No Coffee deliveries on the day | **Wrong day** | Coffee data is date-anchored; check Home's counters |
| Review screen never appears | **Timing** | allow 20–40s; hit the **centre** shutter |
| `Amerock` not found | **Stale data** | it is a bootstrap account, not on the route |
| No fee fields on Signing Order | **Known gap** | Delivery Fees / Fuel Adjustment do not exist |
| Works by hand, fails automated | **Script** | a precondition the test skipped |
