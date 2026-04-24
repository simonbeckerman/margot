# What the tests do (plain English)

This page is for anyone who is **not** a software expert. It explains the checks we run on **beckerman-companion** and how to read the output when the assistant or the terminal shows it.

## The big picture

The app has two main jobs:

1. **Store trips** in a database (when each of you left one country and arrived in another).
2. **Count days** in a country in a given date range, using the UK rules in our spec (see [SPEC.md](SPEC.md) if you want detail).

**Tests** make sure the day-counting logic and the **live** server (the thing Claude talks to) behave as we expect, without you having to click around in Claude to find bugs.

## The three test commands

| Command | What it checks | Needs internet? | Needs a secret token? |
| ------- | -------------- | --------------- | ---------------------- |
| `npm test` | The **math** for counting days, using made-up data in the code. | No | No |
| `npm run smoke` | The **live** function says “no” if you do not pass a key, and runs **unit tests** first. | Yes | Only if you want a real `log_trip` call (optional) |
| `npm run e2e` | A **full** check: unit tests, then real calls to the live server, then **deleting** the pretend trips we inserted. | Yes | The script **creates new** keys for the run (see below) |

## What a good `npm test` result looks like

You should see that all tests **passed** (a green or checkmark list, or text like `Tests: 11 passed`). That only means: **the counting rules in code match what we agreed in the spec.** It does not prove your Supabase or Claude is set up.

## What a good `npm run smoke` result looks like

- Unit tests pass (same as above).
- A line that the server answered with **HTTP 401** when no key was sent. That is good: it means the server is up and is **refusing** strangers.
- If you did **not** set a key in the terminal, you will see a message that the **live** trip insert was **skipped**. That is still a useful check.

## What a good `npm run e2e` result looks like

**Full** means the script (or the agent running it) does all of the following, in order:

1. **Unit tests** run and pass.
2. **New** Simon and **Chiara** API keys are set on the server for this test. That means the **old** keys stop working until you copy the new ones into your password file and into Claude. The script **prints** the new keys at the end. Save them.
3. **Pretend trips** are added, far in the future (year 2030), with a special note in the `notes` field so we can find them. These are not real travel plans, only test data.
4. A **return** trip is logged for Chiara, but **Simon** is the one calling the tool (this checks that a spouse can log for the other person, as in the spec).
5. **Day counts** are requested for the UK and for France, so we exercise both ways of counting (UK “midnight” rule vs other countries’ “inclusive” rule). The exact numbers are less important than **no error message** in the block.
6. All rows whose notes look like an automated test are **deleted** from the database, and a final count shows **zero** such rows.

If the run **finishes** and prints the two new key lines and “OK: 0 e2e rows remain” (or similar), treat that as a **successful** full check.

**Important:** each `e2e` run **changes** the Simon and Chiara keys. After every run, update what you store and what you put in Claude.

## Example: what the numbers in `days_in_country` mean (simple version)

- **`days_present`:** how many **calendar** days in the range we counted as a “day in that country” under our rules. It is normal for this to be a few days or many days, depending on the trips in the test.
- **`method`:** `uk_midnight` for the United Kingdom, `inclusive_presence` for other countries. You do not need to know more unless you are editing the spec.
- **`trips_considered`:** a list of **id**s of trips the tool used in the sum. It helps developers debug; you can ignore it in daily use.

## When you are *not* sure if something failed

- Look for the word **Error**, **non-zero exit**, or **HTTP 5xx** in the output. Those usually mean a problem.
- If the assistant says the command **exited with code 0** or **succeeded**, that is usually a good sign.

## Example things you could type in Claude (after the connector is on)

You do not type these into the test script. You use them in **Claude** so it can call the tools for you. Example ideas:

- “Add a trip: I left the United Kingdom for France on 1 June 2026 and arrived on 2 June 2026.”
- “How many days was I in the United Kingdom in the 2025 to 2026 UK tax year?”
- “How many days was Chiara in the United Kingdom in 2026 as a normal calendar year?”

Claude should pick the right tool (`log_trip` or `days_in_country`) if your connector is wired up.

## Where to run these commands

On your Mac, in a terminal, from the project folder:

```bash
cd /path/to/beckerman-companion
npm test
# or
npm run smoke
# or
npm run e2e
```

If you are working with the coding assistant in **Cursor**, you can also ask: “Run the full e2e test and show me the output.” The result will look like a long log in the chat, which is expected.
