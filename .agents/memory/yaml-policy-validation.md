---
name: YAML policy validation
description: How to avoid syntax and parser-precedence bypasses in security checks over workflow YAML.
---

Security-sensitive workflow policies must traverse a real YAML syntax tree using semantic key values. They must also reject duplicate mapping keys and merge keys rather than relying on parser precedence.

**Why:** Line-oriented matching was bypassed by valid flow mappings and quoted keys. Even semantic traversal was ambiguous when duplicate keys let one parser select a pinned value while another selected a mutable value.

**How to apply:** For CI policy checks, parse YAML, resolve aliases, traverse the intended mapping paths, preserve source-node comments when comments are part of policy, and fail closed on duplicate or merged mappings.