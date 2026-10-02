import { describe, it, expect, vi, afterEach } from "vitest";
import { readFile } from "node:fs/promises";
import { createHash, webcrypto } from "node:crypto";
import { createHqClient } from "@/lib/supabase/client";
import {
  artifactPair,
  loadMaterialArtifact,
  materialFilename,
} from "@/lib/material-delivery";
import type { Material, MaterialArtifact } from "@/lib/types";
import { materialManifest } from "../../worker-support/material-artifacts.mts";
afterEach(() => vi.unstubAllGlobals());
describe("actual canonical synthetic DOCX/PDF bytes", () => {
  it.each([
    ["canonical", 1],
    ["canonical-validated", 2],
  ] as const)(
    "registers and delivers the inspected %s pair without changing bytes or switching Material versions",
    async (directory, version) => {
      vi.stubGlobal("crypto", webcrypto);
      const root = new URL(
          "../qa-evidence/" + directory + "/",
          import.meta.url,
        ),
        load = (name: string) => readFile(new URL(name, root));
      const [input, docx, pdf, contextBytes, qaBytes] = await Promise.all(
        [
          "renderer-input.json",
          "resume-v1.docx",
          "resume-v1.pdf",
          "context.json",
          "qa.json",
        ].map(load),
      );
      const context = JSON.parse(contextBytes.toString()),
        qa = JSON.parse(qaBytes.toString()),
        material = { ...context.material, version_number: version } as Material;
      const manifest = await materialManifest(context, input, docx, pdf, qa),
        rows = manifest.map((r, i) => ({
          ...r,
          id: "synthetic-" + i,
          created_at: "2026-10-02T00:00:00Z",
          created_by_principal_id: "synthetic",
        })) as MaterialArtifact[];
      expect(artifactPair(material, rows)).not.toBeNull();
      for (const format of ["pdf", "docx"] as const) {
        const bytes = format === "pdf" ? pdf : docx,
          native = vi.fn().mockResolvedValue(new Response(bytes)),
          client = createHqClient(
            {
              url: "https://xhhfnxswwspejdxjyvzz.supabase.co",
              key: "sb_publishable_synthetic",
              materialDelivery: true,
            },
            native,
          ),
          artifact = rows.find((r) => r.format === format)!;
        const blob = await loadMaterialArtifact(client, material, artifact),
          actual = Buffer.from(await blob.arrayBuffer());
        expect(actual.equals(bytes)).toBe(true);
        expect(createHash("sha256").update(actual).digest("hex")).toBe(
          artifact.sha256,
        );
        expect(materialFilename(material, format)).toContain(
          "-v" + version + "-" + material.id + "." + format,
        );
        await expect(
          loadMaterialArtifact(
            client,
            {
              ...material,
              id: "44444444-4444-4444-8444-444444444444",
              version_number: version + 1,
            },
            artifact,
          ),
        ).rejects.toThrow("selected material");
        expect(native).toHaveBeenCalledTimes(1);
        client.auth.stopAutoRefresh();
      }
      expect(
        artifactPair(
          material,
          rows.map((r) => ({
            ...r,
            qa: { ...r.qa, pdf_sha256: "f".repeat(64) },
          })),
        ),
      ).toBeNull();
      expect(
        createHash("sha256")
          .update(await load("resume-v1.docx"))
          .digest("hex"),
      ).toBe(qa.docx_sha256);
    },
  );
});
