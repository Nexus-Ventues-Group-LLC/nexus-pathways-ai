import { afterAll, describe, expect, it } from "vitest";
import { and, count, eq, like } from "drizzle-orm";
import { db, organizationsTable } from "@workspace/db";
import { createFixtureNamespace } from "./fixture-namespace";

const runId = process.env.FIXTURE_ISOLATION_STRESS_RUN_ID;
const workerId = process.env.FIXTURE_ISOLATION_STRESS_WORKER_ID;
const enabled = Boolean(runId && workerId);
const fixtures = createFixtureNamespace("fixture-isolation-stress");
const organizationId = fixtures.id();
const markerPrefix = `fixture-isolation-stress:${runId ?? "disabled"}:`;
const marker = `${markerPrefix}${workerId ?? "disabled"}`;

async function markerCount() {
  const [row] = await db
    .select({ value: count() })
    .from(organizationsTable)
    .where(like(organizationsTable.name, `${markerPrefix}%`));
  return row?.value ?? 0;
}

async function waitForCount(expected: number, namePattern = `${markerPrefix}%`) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const [row] = await db
      .select({ value: count() })
      .from(organizationsTable)
      .where(like(organizationsTable.name, namePattern));
    if ((row?.value ?? 0) === expected) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  expect(await markerCount(), `Timed out waiting for ${expected} concurrent stress fixtures`).toBe(expected);
}

afterAll(async () => {
  if (!enabled) return;
  await db.delete(organizationsTable).where(eq(organizationsTable.id, organizationId));
});

describe.skipIf(!enabled)("shared database fixture isolation stress", () => {
  it("keeps both process fixtures isolated and leaves no records behind", async () => {
    await db.insert(organizationsTable).values({ id: organizationId, name: marker });
    await waitForCount(2);

    await db
      .update(organizationsTable)
      .set({ name: `${marker}:ready-to-delete` })
      .where(and(eq(organizationsTable.id, organizationId), eq(organizationsTable.name, marker)));

    if (workerId === "a") {
      await waitForCount(1, `${markerPrefix}b:ready-to-delete`);
      await db.delete(organizationsTable).where(eq(organizationsTable.id, organizationId));
      await waitForCount(0);
    } else {
      await waitForCount(1, `${markerPrefix}a:ready-to-delete`);
      await waitForCount(1);
      await db.delete(organizationsTable).where(eq(organizationsTable.id, organizationId));
    }
  }, 30_000);
});
