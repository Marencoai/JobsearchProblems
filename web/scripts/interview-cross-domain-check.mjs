import { runNative } from "./native-domain-harness.mjs";
import { checkCrossDomain } from "./cross-domain-lock-check.mjs";
await runNative("interview", (h) => checkCrossDomain(h, "interview"));
