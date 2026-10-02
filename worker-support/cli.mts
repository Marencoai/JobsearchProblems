// JSON over stdin only; no credentials, connection strings, or network.
import { plannerEligibility, preparationTarget } from "./hq-contracts.ts";
let input = "";
for await (const chunk of process.stdin) {
  input += chunk;
  if (input.length > 4_000_000) throw new Error("Worker input is too large");
}
try {
  const data = JSON.parse(input);
  const mode = process.argv[2];
  const result =
    mode === "planner"
      ? plannerEligibility(
          data.workspace_id,
          data.principal_id,
          data.actions,
          data.plan_items ?? [],
          data.now,
        )
      : mode === "preparation"
        ? preparationTarget(data.task, data.packages)
        : (() => {
            throw new Error("Use planner or preparation mode");
          })();
  process.stdout.write(JSON.stringify(result) + "\n");
} catch (error) {
  process.stderr.write(
    (error instanceof Error ? error.message : "Invalid worker input") + "\n",
  );
  process.exitCode = 1;
}
