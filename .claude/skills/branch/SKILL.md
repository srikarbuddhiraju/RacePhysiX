---
name: branch
description: Create a new ApexSim feature branch following the project convention — commits current work first
allowed-tools: Bash, Read
---

Arguments: $ARGUMENTS (e.g. "stage4-quarter-car" or "fix-handling-diagram")

Follow the ApexSim branching convention:

1. Check current git status: `git status` and `git diff --stat`
2. If there are uncommitted changes, commit them first:
   - Stage relevant files: `git add src/ docs/`
   - Commit with a descriptive message following the feat/fix/docs prefix style
3. Create the new branch: `git checkout -b feature/$ARGUMENTS`
4. Confirm the branch was created: `git branch --show-current`
5. Update `docs/LatestTask.md` — add a new session entry with the branch name and status "IN PROGRESS"

If no argument is provided, ask the user for the branch name before proceeding.
