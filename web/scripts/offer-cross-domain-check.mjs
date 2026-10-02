import { runNative } from "./native-domain-harness.mjs";
import { checkCrossDomain } from "./cross-domain-lock-check.mjs";
await runNative("offer", (h) => checkCrossDomain(h, "offer"));
