import type { MaterialArtifact } from "./types";
// Explicit development fixture data only. No candidate or hosted Storage reads.
export type QaCanonical = {
  pdf: string;
  docx: string;
  manifest: MaterialArtifact[];
};
