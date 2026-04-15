---
name: check-pr
description: >
  Check a GitHub PR for unresolved review comments, failing status checks, and incomplete
  description. Wait for pending checks, categorize issues, fix and resolve threads.
  Use when the user wants to check a PR, address review feedback, or prepare for merge.
---

# Check PR

Analyze a GitHub pull request for review comments, status checks, and description completeness, then help address any issues found.

## Inputs

- **PR number** (optional): If not provided, detect the PR for the current branch.

## Non-Negotiable Rules

1. Never assume a review comment is correct. Always read the referenced code and assess validity before proposing a fix.
2. When unsure whether a suggestion is valid or the right approach, ask the user.
3. Never commit or push without explicit user confirmation.
4. Use the `but` skill for all commits and pushes. Load it if not already loaded.
5. After pushing fixes, ask the user if they want to re-trigger Greptile review.

## Workflow

### 1. Detect the PR

Load the `but` skill if not already loaded. If a number was provided, use it. Otherwise:

1. Check current branch: `but status --json`
2. Look for an open PR on that branch: `gh pr list --head <branch-name> --json number,title`
3. If found, confirm with the user before proceeding.
4. If not found, abort and notify the user.

### 2. Fetch PR details

```bash
# PR metadata + status checks
gh pr view <PR_NUMBER> --json title,body,state,reviews,comments,headRefName,statusCheckRollup

# Inline review comments (line-specific)
gh api repos/{owner}/{repo}/pulls/<PR_NUMBER>/comments
```

### 3. Wait for pending checks

Before analyzing, ensure all status checks have completed. If any checks are `PENDING` or `IN_PROGRESS`, poll every 30 seconds until all reach a terminal state.

```bash
# Re-fetch statusCheckRollup until no PENDING/IN_PROGRESS entries remain
gh pr view <PR_NUMBER> --json statusCheckRollup
```

### 4. Parse review comments

Identify Greptile bot comments by author login `greptile-apps` or `greptile-apps[bot]`.

Greptile uses a structured format:

- **Summary comment**: Contains `<h3>Greptile Summary</h3>`, confidence score, important files table, and a sequence diagram.
- **Inline review comments**: Posted as GitHub PR review comments on specific lines.
- **Comments outside diff**: Wrapped in `<!-- greptile_failed_comments -->` inside the summary. These reference code that wasn't part of the diff. Each entry has a file path, line range, link, and description.
- **Fix prompt block**: Wrapped in `<details><summary>Prompt To Fix All With AI</summary>`. Ignore this — assess independently.

Also collect human reviewer comments and other bot comments (linters, deploy previews, etc.).

### 5. Analyze the PR

Evaluate these areas:

#### A. Status Checks

- Are all CI checks passing?
- If any are failing, identify which ones and the failure reason.

#### B. PR Description

- Is the description complete and follows team conventions?
- Are all required sections filled in?
- Are there TODOs or placeholders that need updating?

#### C. Review Comments

For each review comment:

1. Read the referenced file and lines.
2. Evaluate whether the suggestion is valid in context of the codebase.
3. Determine if it has already been addressed by subsequent commits.

### 6. Categorize issues

For each issue found, categorize as:

| Category | Meaning |
|---|---|
| **Actionable** | Code changes, test improvements, or fixes needed |
| **Informational** | Verification notes, questions, or FYIs that don't require changes |
| **Already addressed** | Issues resolved by subsequent commits |

### 7. Report findings

Present a summary table:

| Area | Issue | Status | Action Needed |
|------|-------|--------|---------------|
| Status Checks | CI build failing | Failing | Fix type error in `src/api.ts` |
| Review | "Add null check" — @reviewer | Actionable | Add guard clause |
| Description | TODO placeholder in test plan | Actionable | Fill in test plan |
| Review | "Looks good" — @teammate | Informational | None |
| Review | "Add error handling" — greptile | Already addressed | None |

For each actionable item, present:
- What the comment suggests
- Whether you agree, disagree, or are unsure
- Your proposed fix (if applicable), or why you'd dismiss it

### 8. Implement fixes

Only after user confirms which issues to address:

1. Make the code changes.
2. Run `bun checks` to verify.
3. Present the changes to the user.
4. Ask: "Want me to commit and push these fixes?"

### 9. Commit and push

Only after explicit user confirmation:

1. Load the `but` skill for version control.
2. Commit fixes to the PR branch. Use descriptive commit messages following Conventional Commits.
3. Group related fixes into a single commit when they address the same concern. Separate unrelated fixes into individual commits.
4. Push the branch.

### 10. Resolve review threads

After pushing fixes, resolve addressed threads via GraphQL.

Fetch unresolved thread IDs (paginate if `hasNextPage` is true):

```bash
gh api graphql -f query='
query($cursor: String) {
  repository(owner: "OWNER", name: "REPO") {
    pullRequest(number: PR_NUMBER) {
      reviewThreads(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          isResolved
          comments(first: 1) {
            nodes { body path }
          }
        }
      }
    }
  }
}'
```

Batch-resolve addressed threads using aliases:

```bash
gh api graphql -f query='
mutation {
  t1: resolveReviewThread(input: {threadId: "THREAD_ID_1"}) {
    thread { isResolved }
  }
  t2: resolveReviewThread(input: {threadId: "THREAD_ID_2"}) {
    thread { isResolved }
  }
}'
```

Only resolve threads for comments that were actually addressed or are purely informational. Do not resolve threads where the fix is uncertain.

### 11. Re-trigger review

After pushing, ask the user: "Want me to trigger a Greptile re-review?"

If yes:

```bash
gh pr comment <number> --body "@greptileai review"
```

### 12. Multiple PRs

If checking a chain of PRs, process them sequentially.

## Output format

Summarize:
- PR title and current state
- Status checks summary (passing/failing/pending)
- Total issues found
- Actionable items with descriptions
- Items that can be ignored with reasons
- Recommended next steps
