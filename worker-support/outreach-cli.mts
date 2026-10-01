// Pure JSON routing adapter for authenticated worker orchestration. Never pass
// credentials, passwords, tokens, database URLs or whole machine logs here.
import {
  outreachPreparationTarget,
  outreachFollowUpDisposition,
} from "./outreach-contracts.ts";
let input = "";
for await (const chunk of process.stdin) {
  input += chunk;
  if (input.length > 4_000_000)
    throw new Error("Outreach worker input is too large");
}
try {
  const data = JSON.parse(input);
  const args = [
    data.principal_id,
    data.task,
    data.task_link,
    data.engagement,
    data.messages ?? [],
  ] as const;
  const result =
    process.argv[2] === "preparation"
      ? outreachPreparationTarget(...args)
      : process.argv[2] === "follow-up"
        ? outreachFollowUpDisposition(...args, data.now)
        : (() => {
            throw new Error("Use preparation or follow-up mode");
          })();
  process.stdout.write(JSON.stringify(result) + "\n");
} catch (error) {
  process.stderr.write(
    (error instanceof Error ? error.message : "Invalid Outreach worker input") +
      "\n",
  );
  process.exitCode = 1;
}
