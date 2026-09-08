# GitHub source synchronization

The GitHub repository is synchronized through its SSH `origin` Git remote
rather than the GitHub content connector. The connector filters some HTML
payloads and does not have permission to create or update GitHub Actions
workflows.

## Required setup

- `origin` points to `git@github.com:Nexus-Ventues-Group-LLC/nexus-pathways-ai.git`.
- The corresponding public key is registered as an authentication key on a
  GitHub account with write access to the repository.
- The private key is committed only in AES-256 encrypted form at
  `.github/keys/nexus-pathways-sync-key.enc`.
- `GITHUB_SYNC_KEY_PASSPHRASE` is stored as a Replit Secret and decrypts the key
  into a temporary, permission-restricted file for each sync.
- Never put the plaintext private key or passphrase in a tracked file, command
  output, or chat.

## Publish and verify

Commit the intended Replit snapshot on `main`, then run:

```sh
pnpm run sync:github
```

The command refuses dirty trees and non-fast-forward updates. After pushing, it
fetches GitHub again and compares the complete Git tree IDs for local `main` and
`origin/main`. Equal tree IDs prove every tracked path and byte matches,
including:

- `artifacts/nexus-pathways/index.html`
- `artifacts/mockup-sandbox/index.html`
- `.github/workflows/workflow-validation.yml`

## Initial reconciliation verification

On September 8, 2026, the independently bootstrapped Replit and GitHub histories
were joined with a two-parent merge that retained the Replit tree. The sync
command then fast-forwarded GitHub `main`, fetched it again, and confirmed the
local and remote tree IDs were identical. The three required paths above were
also checked directly in `origin/main`.