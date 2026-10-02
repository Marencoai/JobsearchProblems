// JSON over stdin only; no credentials, connection strings, or network.
import { plannerEligibility, preparationTarget } from "./hq-contracts.ts";
import { intakeDedupe } from "./intake-dedupe.ts";
import { intakeTaskEvidence } from "./intake-contract.ts";
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
      : mode === "intake-dedupe"
        ? intakeDedupe(data.candidate, data.opportunities, data.sources)
        : mode === "manual-intake"
          ? intakeTaskEvidence(data.task, data.event)
          : mode === "preparation"
            ? preparationTarget(data.task, data.packages)
            : (() => {
                throw new Error(
                  "Use planner, preparation, manual-intake, or intake-dedupe mode",
                );
              })();
  process.stdout.write(JSON.stringify(result) + "\n");
} catch (error) {
  process.stderr.write(
    (error instanceof Error ? error.message : "Invalid worker input") + "\n",
  );
  process.exitCode = 1;
}
