#!/bin/bash
cd "$CLAUDE_PROJECT_DIR" || exit 0

FILE=$(jq -r '.tool_input.file_path // empty')
[ -z "$FILE" ] && exit 0

# Skip secret files
case "$(basename "$FILE")" in
  .env|*.env|credentials.json|*.pem|*.key) exit 0 ;;
esac

# Stage only the changed file
git add -- "$FILE" 2>/dev/null || exit 0
git diff --cached --quiet && exit 0

# Get recent commit style
RECENT_STYLE=$(git log --oneline -5 2>/dev/null)

# Generate commit message using Claude Code
DIFF=$(git diff --cached --stat && echo "---" && git diff --cached)
COMMIT_MSG=$(echo "$DIFF" | claude -p "Generate a concise git commit message (imperative mood, max 72 chars) summarizing these staged changes. Match this repo's commit style: $RECENT_STYLE. Reply with ONLY the commit message, no explanation, no quotes." 2>/dev/null)

# Fallback to timestamp message if claude command fails or returns empty
if [ -z "$COMMIT_MSG" ]; then
  COMMIT_MSG="Auto-commit from Claude Code [$(date '+%Y-%m-%d %H:%M:%S')]"
fi

git commit -m "$COMMIT_MSG" -- "$FILE" || true
exit 0
