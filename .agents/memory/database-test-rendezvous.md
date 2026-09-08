---
name: Database test rendezvous
description: Reliable synchronization for concurrent processes that validate shared-database fixture isolation.
---

Use an ordered, multi-phase departure handshake when database rows coordinate concurrent test processes. A symmetric “wait until both exist, then both delete” barrier is racy because one process can delete before the other observes the shared state.

**Why:** Polling is not atomic with cleanup. A healthy, faster process can make the rendezvous condition disappear and cause the slower process to report a false isolation failure.

**How to apply:** Give workers distinct roles after both arrive. Have one worker publish readiness and wait for its peer, then delete; have the peer observe that deletion before removing the final marker. Keep a final zero-row assertion.