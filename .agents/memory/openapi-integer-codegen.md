---
name: OpenAPI integer code generation
description: Compatibility rule for integer validation in this workspace's OpenAPI-to-Zod pipeline.
---

Express integer-valued API fields as OpenAPI `number` with `multipleOf: 1`, rather than `integer`.

**Why:** The current generator emits a Zod 4-only `z.int()` call for OpenAPI `integer`, while the generated validation package resolves Zod 3 and fails typechecking.

**How to apply:** For bounded counts or timeout fields that must be whole numbers, combine `type: number`, `multipleOf: 1`, and the appropriate minimum/maximum constraints.