#!/usr/bin/env bash
set -euo pipefail

remote="${GITHUB_REMOTE:-origin}"
branch="${GITHUB_BRANCH:-main}"
encrypted_key="${GITHUB_SYNC_KEY_FILE:-.github/keys/nexus-pathways-sync-key.enc}"
mode="${GITHUB_SYNC_MODE:-publish}"

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

local_tree="$(git rev-parse "HEAD^{tree}")"

case "$mode" in
  publish)
    sync_branch="${GITHUB_SYNC_BRANCH:-replit/source-sync-$(git rev-parse --short=12 HEAD)}"
    git push "$remote" "HEAD:refs/heads/$sync_branch"
    git fetch "$remote" "$sync_branch"
    remote_tree="$(git rev-parse "FETCH_HEAD^{tree}")"
    if [[ "$local_tree" != "$remote_tree" ]]; then
      echo "Verification failed: local and published sync-branch trees differ." >&2
      exit 1
    fi
    echo "Verified $remote/$sync_branch matches local HEAD at tree $local_tree"
    echo "Open a pull request: https://github.com/Nexus-Ventues-Group-LLC/nexus-pathways-ai/compare/$branch...$sync_branch?expand=1"
    ;;
  verify)
    remote_tree="$(git rev-parse "$remote/$branch^{tree}")"
    if [[ "$local_tree" != "$remote_tree" ]]; then
      echo "Verification failed: local HEAD and $remote/$branch differ." >&2
      exit 1
    fi
    echo "Verified $remote/$branch matches local HEAD at tree $local_tree"
    ;;
  *)
    echo "Unsupported GITHUB_SYNC_MODE: $mode (expected publish or verify)" >&2
    exit 1
    ;;
esac