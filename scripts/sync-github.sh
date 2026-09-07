#!/usr/bin/env bash
set -euo pipefail

remote="${GITHUB_REMOTE:-origin}"
branch="${GITHUB_BRANCH:-main}"

if [[ -z "${GITHUB_SYNC_TOKEN:-}" ]]; then
  echo "GITHUB_SYNC_TOKEN is not available. Add it as a Replit Secret." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Refusing to sync a dirty working tree. Commit or discard changes first." >&2
  exit 1
fi

askpass="$(mktemp)"
trap 'rm -f "$askpass"' EXIT
cat >"$askpass" <<'EOF'
#!/bin/sh
case "$1" in
  *Username*) printf '%s\n' 'x-access-token' ;;
  *Password*) printf '%s\n' "$GITHUB_SYNC_TOKEN" ;;
  *) exit 1 ;;
esac
EOF
chmod 700 "$askpass"

export GIT_ASKPASS="$askpass"
export GIT_TERMINAL_PROMPT=0

git fetch "$remote" "$branch"

if ! git merge-base --is-ancestor "$remote/$branch" "$branch"; then
  echo "Refusing a non-fast-forward push. Reconcile $remote/$branch first." >&2
  exit 1
fi

git push "$remote" "$branch:$branch"
git fetch "$remote" "$branch"

local_sha="$(git rev-parse "$branch^{tree}")"
remote_sha="$(git rev-parse "$remote/$branch^{tree}")"
if [[ "$local_sha" != "$remote_sha" ]]; then
  echo "Verification failed: local and GitHub trees differ." >&2
  exit 1
fi

echo "Verified $remote/$branch matches local $branch at tree $local_sha"