---
name: pr-review
description: 'Review and address PR comments from Greptile code review bot. Use when the user asks to check PR comments, fix review feedback, handle code review suggestions, or re-trigger Greptile review.'
---

# PR Review Workflow

Address code review comments from the Greptile bot on GitHub PRs.

## Non-Negotiable Rules

1. Never assume a review comment is correct. Always read the referenced code and assess validity before proposing a fix.
2. When unsure whether a suggestion is valid or the right approach, ask the user.
3. Never commit or push without explicit user confirmation.
4. Use the `but` skill for all commits and pushes. Load it if not already loaded.
5. After pushing fixes, ask the user if they want to re-trigger Greptile review.

## Workflow

### 1. Fetch PR comments

```bash
# Get issue-level comments (Greptile summary + inline suggestions)
gh pr view <number> --comments --json comments

# Get review-level inline comments (line-specific)
gh api repos/{owner}/{repo}/pulls/<number>/comments
```

Identify the Greptile bot comments by author login `greptile-apps` or `greptile-apps[bot]`.

### 2. Parse Greptile comments

Greptile uses a structured format:

- **Summary comment**: Contains `<h3>Greptile Summary</h3>`, confidence score, important files table, and a sequence diagram.
- **Inline review comments**: Posted as GitHub PR review comments on specific lines.
- **Comments outside diff**: Wrapped in `<!-- greptile_failed_comments -->` inside the summary. These reference code that wasn't part of the diff. Each entry has a file path, line range, link, and description.
- **Fix prompt block**: Wrapped in `<details><summary>Prompt To Fix All With AI</summary>`. Contains a markdown block with file path, line numbers, and the comment text. Ignore this — assess independently.

### 3. Assess each comment

For each review comment:

1. Read the referenced file and lines.
2. Evaluate whether the suggestion is valid in context of the codebase.
3. Present findings to the user:
   - What the comment suggests
   - Whether you agree, disagree, or are unsure
   - Your proposed fix (if applicable), or why you'd dismiss it

If unsure about the right approach, ask the user before proceeding.

### 4. Implement fixes

Only after user confirms which comments to address:

1. Make the code changes.
2. Run type checks (`bun check-types`) to verify.
3. Present the changes to the user.
4. Ask: "Want me to commit and push these fixes?"

### 5. Commit and push

Only after explicit user confirmation:

1. Load the `but` skill for version control.
2. Commit fixes to the PR branch. Use descriptive commit messages.
3. Group related fixes into a single commit when they address the same concern. Separate unrelated fixes into individual commits.
4. Push the branch.

### 6. Re-trigger review

After pushing, ask the user: "Want me to trigger a Greptile re-review?"

If yes:

```bash
gh pr comment <number> --body "@greptileai review"
```

## Detecting the PR

If the user doesn't specify a PR number:

1. Check current branch: `but status --json`
2. Look for an open PR on that branch: `gh pr list --head <branch-name> --json number,title`
3. If found, confirm with the user before proceeding.
