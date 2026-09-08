#!/usr/bin/env bash
set -euo pipefail

remote="${GITHUB_REMOTE:-origin}"
branch="${GITHUB_BRANCH:-main}"
encrypted_key="${GITHUB_SYNC_KEY_FILE:-.github/keys/nexus-pathways-sync-key.enc}"

if [[ -z "${GITHUB_SYNC_KEY_PASSPHRASE:-}" ]]; then
  echo "GITHUB_SYNC_KEY_PASSPHRASE is not available. Add it as a Replit Secret." >&2
  exit 1
fi

if [[ ! -f "$encrypted_key" ]]; then
  echo "Encrypted GitHub synchronization key not found: $encrypted_key" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Refusing to sync a dirty working tree. Commit or discard changes first." >&2
  exit 1
fi

key_file="$(mktemp)"
trap 'rm -f "$key_file"' EXIT
openssl enc -d -aes-256-cbc -pbkdf2 \
  -in "$encrypted_key" \
  -out "$key_file" \
  -pass env:GITHUB_SYNC_KEY_PASSPHRASE
chmod 600 "$key_file"

export GIT_SSH_COMMAND="ssh -i $key_file -o IdentitiesOnly=yes"

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