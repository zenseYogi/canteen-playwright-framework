# Manual Test Steps

Step-by-step manual verification for every regression test case, one file per
area. Use these when an automated test fails, to decide whether the cause is a
**real app bug**, a **data problem**, or a **broken script**.

Each case gives the **route**, the **day** to use, numbered steps, the expected
result, and a **"How to read the result"** line. Every file ends with a **quick
triage guide** mapping symptoms to likely causes.

**Build verified against:** 0.1.92 (`nexus-app-qa-debug-92.apk`)
**Last updated:** 2026-09-01

| Area | Cases | File |
|---|---|---|
| Start of the Day | 24 | [start-of-day.md](start-of-day.md) |
| Market | 39 | [market.md](market.md) |
| Coffee | 53 | [coffee.md](coffee.md) |
| Vending | 43 | [vending.md](vending.md) |
| End Day | 14 | [end-day.md](end-day.md) |
| Menu, Transfers & Route Operations | 16 | [menu.md](menu.md) |

## Facts that apply everywhere

**Routes — one per LOB.** Vending = Miami 990 · Coffee = Charlotte 103 ·
Market = Miami 001 · empty-state tests = Charlotte 001. **Miami 010 is
retired.**

**Install builds cleanly.** `adb uninstall` then `adb install` — **never
`adb install -r`.** A `-r` reinstall keeps the old data directory, which on
2026-08-31 produced a convincing phantom defect (sync failing, Select Day never
appearing, `Last sync` frozen four days back). A clean install cleared all of
it.

**Check the day before blaming the app.** Home's LOB counters tell you what the
current day actually holds. Data does not roll uniformly: Market's stops appear
each day, Coffee's have stayed anchored to a fixed date, and Vending's route had
15 stops on one day and none on the next.

**Servicing consumes data permanently.** Completing or skipping a stop cannot be
undone — a Route Setup reset clears *local* corruption but re-pulls the server's
truth. The day selector offers only yesterday / today / tomorrow, so a consumed
day becomes unreachable within 24 hours. **Use YESTERDAY for destructive work:**
past days recede and cost nothing, while burning tomorrow destroys the next
day's data.

**Identify the LOB by its tiles.**

| LOB | Tiles / screen |
|---|---|
| Market | Money Operations, Removals & Returns, Market Physical, Market Transfers |
| Coffee | Equipment Audit, Add Presale, Signing Order |
| Vending | Service Selection with FULL SERVICE / SPOT / FINAL; machine-number header |

**Task gating is real, not a bug.** Vending unlocks Fills & Removals only after
Money Operations; Coffee's After Photos enables only once the other checklist
items are complete. Tiles disabled early are usually correct.

**The camera screen has no labels** — three controls: flash (left), **shutter
(centre, largest)**, camera flip (right). Capture plus review can take 20–40s on
the emulator.
