import { copyFile, mkdir } from "node:fs/promises";
// The exact package version is pinned in package-lock.json. Serve locally so
// previews never send document bytes to a CDN or third-party rendering service.
const destination = new URL("../public/", import.meta.url);
await mkdir(destination, { recursive: true });
await copyFile(
  new URL(
    "../node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ),
  new URL("pdf.worker.min.mjs", destination),
);
