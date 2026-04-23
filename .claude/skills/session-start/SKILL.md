---
name: session-start
description: Use at the start of every RacePhysiX session before any response or planning — reads prior decisions, lessons, and current task state
allowed-tools: Read, Bash
---

# RacePhysiX Session Start

Run this at the beginning of every session before doing anything else.

## Steps

1. **Read `docs/ConvoQAClaude.md`** — past decisions and open questions (don't repeat resolved debates)
2. **Read `docs/lessons.md`** — mistakes made and rules to avoid repeating
3. **Read `docs/LatestTask.md`** — what was being worked on last session, open checklist items

Then summarise aloud to Srikar:
- What was in progress last session (branch, task, state)
- Any open `[ ]` checklist items that are blockers
- Key lessons or constraints relevant to today's likely work
- Ask: **"What would you like to work on today?"**

## Rules
- Never skip this — it prevents re-litigating old decisions and repeating past mistakes
- If `LatestTask.md` has unchecked items (`[ ]`), surface them before accepting new work
- Keep the summary tight — bullet points, no waffle
