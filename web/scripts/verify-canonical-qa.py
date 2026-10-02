"""Read-only verification of the committed synthetic canonical DOCX/PDF pair.

Requires python-docx and PyMuPDF in an explicitly selected isolated runtime.
Does not execute a converter, write QA attestations, or access network/storage.
"""
import hashlib
import json
import re
import sys
import unicodedata
import zipfile
from pathlib import Path
import pymupdf
from docx import Document

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / "qa-evidence/canonical"
data = json.loads((root / "renderer-input.json").read_text())
qa = json.loads((root / "qa.json").read_text())
for name, key in [("renderer-input.json", "input_sha256"), ("resume-v1.docx", "docx_sha256"), ("resume-v1.pdf", "pdf_sha256")]:
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == qa[key], f"Changed bytes: {name}"
assert qa["renderer_key"] == "executive-brief-two-page-v2"
with zipfile.ZipFile(root / "resume-v1.docx") as archive:
    assert "word/document.xml" in archive.namelist()
    assert sum(info.file_size for info in archive.infolist()) < 16 * 1024 * 1024
    assert not any("vbaproject" in name.lower() for name in archive.namelist())
doc = Document(root / "resume-v1.docx")
assert len(doc.paragraphs) > 0
pdf = pymupdf.open(root / "resume-v1.pdf")
assert len(pdf) == qa["page_count"] == 2
def normalize(text):
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", text).replace("–", "-").replace("—", "-")).strip()
pages = [normalize(page.get_text()) for page in pdf]
all_text = " ".join(pages)
expected = [data[k] for k in ["name", "headline", "summary"]]
expected += data["capabilities"] + data["tools"] + data["certifications"] + data["education"]
expected += [value for item in data["impact"] for value in item]
expected += [item[key] for item in data["projects"] for key in ["name", "role", "text"]]
expected += [item[key] for item in data["experience"] for key in ["title", "company", "dates", "scope"]]
expected += [bullet for item in data["experience"] for bullet in item["bullets"]]
for text in expected:
    assert normalize(text) in all_text, f"Lost text: {text}"
assert "PROFESSIONAL EXPERIENCE" not in pages[0]
assert "PROFESSIONAL EXPERIENCE" in pages[1]
for item in data["experience"]:
    assert normalize(item["title"]) in pages[1]
    assert normalize(item["title"]) not in pages[0]
for page in pdf:
    assert page.rect.width == 612 and page.rect.height == 792
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            for span in line["spans"]:
                x0, y0, x1, y1 = span["bbox"]
                assert -1 <= x0 < x1 <= 613 and -1 <= y0 < y1 <= 793, span["text"]
print(json.dumps({"synthetic_only": True, "page_count": len(pdf), "hashes_match": True, "all_input_text_retained": True, "all_text_within_page_bounds": True, "page_architecture": "positioning / experience", "visual_qa": "See recorded page images and report; this script does not replace human inspection."}, indent=2))
