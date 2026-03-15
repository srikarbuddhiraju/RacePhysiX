---
name: validate
description: Run ApexSim physics validation — checks bicycle model against Gillespie Ch.6 reference values
allowed-tools: Bash
---

Run the ApexSim physics validation suite and report results.

```bash
cd /var/home/srikarbuddhiraju/Srikar/Repo/ApexSim && npx tsx src/physics/validate.ts
```

Then:
- If all checks PASS: confirm clean with a one-line summary
- If any check FAILS: read the failing check output, identify the root cause in the relevant physics file, explain it clearly, and propose a fix
- Always end with the tsc check: `npx tsc --noEmit` — report any type errors
