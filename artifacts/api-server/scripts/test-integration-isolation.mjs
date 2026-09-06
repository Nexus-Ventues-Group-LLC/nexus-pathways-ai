import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const stressRunId = randomUUID();

async function findIntegrationTests(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findIntegrationTests(path);
    return entry.name.endsWith(".integration.test.ts") ? [relative(root, path)] : [];
  }));
  return files.flat();
}

function run(workerId, tests) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "pnpm",
      ["exec", "vitest", "run", ...tests],
      {
        cwd: root,
        env: {
          ...process.env,
          FIXTURE_ISOLATION_STRESS_RUN_ID: stressRunId,
          FIXTURE_ISOLATION_STRESS_WORKER_ID: workerId,
        },
        stdio: "inherit",
      },
    );

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Integration worker ${workerId} failed (${signal ?? `exit ${code}`})`));
    });
  });
}

const tests = await findIntegrationTests(join(root, "src"));
if (tests.length === 0) throw new Error("No API integration tests were found");

await Promise.all([run("a", tests), run("b", tests)]);
