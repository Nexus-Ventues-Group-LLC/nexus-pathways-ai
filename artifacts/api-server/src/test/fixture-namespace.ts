import { randomUUID } from "node:crypto";

export function createFixtureNamespace(suite: string) {
  const runId = randomUUID();

  return {
    id: () => randomUUID(),
    key: (label: string) => `${suite}-${label}-${runId}`,
  };
}