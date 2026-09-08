# Database isolation merge-queue verification

Verified on September 7, 2026 against:

- Repository: <https://github.com/Nexus-Ventues-Group-LLC/nexus-pathways-ai>
- Protected branch: `main`
- Active ruleset: [Main merge queue](https://github.com/Nexus-Ventues-Group-LLC/nexus-pathways-ai/rules/22407994)
- Required status context: `Database fixture isolation`

## Ruleset configuration

The active default-branch ruleset includes:

- A merge queue using the `ALLGREEN` grouping strategy
- Strict required status checks
- `Database fixture isolation` as a required status check
- Pull requests required for changes to `main`

The workflow in `.github/workflows/api-integration-isolation.yml` subscribes to both
`pull_request` and `merge_group`.

## Passing merge-group proof

Pull request [#1](https://github.com/Nexus-Ventues-Group-LLC/nexus-pathways-ai/pull/1)
added the isolation workflow. Its pull-request check passed before it entered the queue.

GitHub then created a merge-group commit and ran the required check:

- Run: [API integration isolation #34144605935](https://github.com/Nexus-Ventues-Group-LLC/nexus-pathways-ai/actions/runs/34144605935)
- Event: `merge_group`
- Conclusion: `success`
- Queue branch: `gh-readonly-queue/main/pr-1-e8e52d10e04d8eb02c4f7faf264d75252879f3a7`
- Merge-group SHA: `69a68dbf2621a8c7e0d9e17f432996ee5d8d95fe`
- Outcome: pull request #1 merged into `main` at `2026-09-07T16:45:22Z`

This confirms a passing merge-group run can advance normally.

## Failing merge-group proof

Pull request [#2](https://github.com/Nexus-Ventues-Group-LLC/nexus-pathways-ai/pull/2)
was a controlled disposable verification. Its ordinary `pull_request` isolation run
[succeeded](https://github.com/Nexus-Ventues-Group-LLC/nexus-pathways-ai/actions/runs/34144748316),
making it eligible to enter the queue. The branch changed only the isolation command so
that it exited non-zero when `GITHUB_EVENT_NAME` was `merge_group`.

After enqueueing pull request #2, GitHub generated a merge-group commit and the required
check failed:

- Run: [API integration isolation #34144872465](https://github.com/Nexus-Ventues-Group-LLC/nexus-pathways-ai/actions/runs/34144872465)
- Event: `merge_group`
- Conclusion: `failure`
- Queue branch: `gh-readonly-queue/main/pr-2-69a68dbf2621a8c7e0d9e17f432996ee5d8d95fe`
- Merge-group SHA: `3a72bc2f497a9c9d991fdd3cf5ba32083ad5b74a`
- Outcome: pull request #2 remained open and unmerged after the failed queue run

The controlled pull request was then closed without merging and its temporary branch was
deleted. This confirms a failing `Database fixture isolation` merge-group check prevents
the queued change from merging.