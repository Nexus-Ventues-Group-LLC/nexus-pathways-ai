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

Commit the intended Replit snapshot, then run:

```sh
pnpm run sync:github
```

The command refuses dirty trees, publishes the commit to a uniquely named
`replit/source-sync-*` branch, fetches that branch again, and verifies its
complete Git tree ID. Open the pull-request URL printed by the command, let the
required checks pass, and enroll the pull request in the merge queue.

After the queue merges it, align the local checkout to GitHub `main`, then run:

```sh
pnpm run verify:github
```

This fetches GitHub and compares the complete Git tree IDs for local `HEAD` and
`origin/main`. Equal tree IDs prove every tracked path and byte matches,
including:

- `artifacts/nexus-pathways/index.html`
- `artifacts/mockup-sandbox/index.html`
- `.github/workflows/workflow-validation.yml`

## Initial reconciliation verification

On September 8, 2026, the independently bootstrapped Replit and GitHub histories
were joined with a two-parent merge that retained the Replit tree. The snapshot
was published through pull request #3, passed the required checks, and was
merged through the queue. GitHub `main` was fetched again and its tree ID
matched the intended Replit snapshot exactly. The three required paths above
were also checked directly in `origin/main`.