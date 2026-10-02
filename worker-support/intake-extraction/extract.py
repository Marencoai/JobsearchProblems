"""Bounded, stdin-only manual-evidence extractor. No URLs, macros or files followed.

Usage: isolated-python extract.py MIME EXPECTED_SHA256 EXPECTED_BYTE_SIZE < bytes
This reference helper does not upload, research, evaluate, or write any records.
"""
import hashlib
import io
import json
import os
import re
import resource
import stat
import subprocess
import sys
import unicodedata
import zipfile
from pathlib import PurePosixPath

MAX_BYTES = 8 * 1024 * 1024
MAX_TEXT = 100000
MAX_PAGES = 50
MAX_XML = 4 * 1024 * 1024
MAX_EXPANDED = 32 * 1024 * 1024
MAX_PIXELS = 16 * 1024 * 1024
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
MIMES = {"application/pdf", DOCX, "text/plain", "image/png", "image/jpeg"}

class Rejected(Exception):
    pass

def checked_text(text):
    if len(text) > MAX_TEXT:
        raise Rejected("text_limit_exceeded")
    if any(unicodedata.category(c) == "Cc" and c not in "\n\r\t" for c in text):
        raise Rejected("invalid_text")
    if not text.strip():
        raise Rejected("no_extractable_text")
    return text

def xml_root(data):
    if len(data) > MAX_XML:
        raise Rejected("xml_limit_exceeded")
    from lxml import etree
    parser = etree.XMLParser(resolve_entities=False, load_dtd=False, no_network=True, huge_tree=False)
    root = etree.fromstring(data, parser)
    if root.getroottree().docinfo.doctype or any(isinstance(node, etree._Entity) for node in root.iter()):
        raise Rejected("xml_entities_forbidden")
    return root

def docx_text(data):
    if not data.startswith(b"PK\x03\x04"):
        raise Rejected("signature_mismatch")
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        entries = archive.infolist()
        if len(entries) > 1000:
            raise Rejected("archive_entry_limit")
        names = set()
        expanded = 0
        for item in entries:
            name = item.filename
            path = PurePosixPath(name)
            if name in names or path.is_absolute() or ".." in path.parts or "\\" in name or "\x00" in name or stat.S_ISLNK(item.external_attr >> 16):
                raise Rejected("unsafe_archive_path")
            names.add(name)
            expanded += item.file_size
            if item.flag_bits & 1:
                raise Rejected("encrypted_archive")
            if item.file_size > MAX_EXPANDED or expanded > MAX_EXPANDED or item.file_size > max(item.compress_size, 1) * 200:
                raise Rejected("archive_expansion_limit")
            if "vbaproject" in name.lower() or name.lower().endswith((".exe", ".dll", ".bin")):
                raise Rejected("embedded_active_content")
        if "[Content_Types].xml" not in names or "word/document.xml" not in names:
            raise Rejected("not_docx")
        content = xml_root(archive.read("[Content_Types].xml"))
        matches = [n.get("ContentType") for n in content if n.get("PartName") == "/word/document.xml"]
        if matches != ["application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"]:
            raise Rejected("unsupported_docx_type")
        selected = ["word/document.xml"] + sorted(n for n in names if re.fullmatch(r"word/(header\d+|footer\d+|footnotes|endnotes)\.xml", n))
        paragraphs = []
        text_length = 0
        ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
        for name in selected:
            root = xml_root(archive.read(name))
            for paragraph in root.iter(ns + "p"):
                parts = []
                for node in paragraph.iter():
                    if node.tag == ns + "t":
                        parts.append(node.text or "")
                    elif node.tag == ns + "tab":
                        parts.append("\t")
                    elif node.tag in {ns + "br", ns + "cr"}:
                        parts.append("\n")
                text = "".join(parts)
                text_length += len(text) + (1 if paragraphs else 0)
                paragraphs.append(text)
                if text_length > MAX_TEXT:
                    raise Rejected("text_limit_exceeded")
        # Relationships, URLs, fields, macros and embedded objects are never read
        # or executed. Only bounded standard text parts are parsed in memory.
        return {"status": "extracted", "text": checked_text("\n".join(paragraphs))}

def pdf_text(data):
    if not data.startswith(b"%PDF-"):
        raise Rejected("signature_mismatch")
    import pymupdf
    pymupdf.TOOLS.mupdf_display_errors(False)
    pymupdf.TOOLS.mupdf_display_warnings(False)
    with pymupdf.open(stream=data, filetype="pdf") as doc:
        if doc.is_encrypted:
            raise Rejected("encrypted_pdf")
        if doc.is_repaired:
            raise Rejected("malformed_pdf")
        if not 0 < len(doc) <= MAX_PAGES or doc.xref_length() > 10000:
            raise Rejected("pdf_structure_limit")
        for xref in range(1, doc.xref_length()):
            if set(doc.xref_get_keys(xref)) & {"JS", "JavaScript", "AA", "OpenAction", "Launch", "EmbeddedFiles", "EF", "RichMedia", "XFA"}:
                raise Rejected("pdf_active_content")
            if doc.xref_get_key(xref, "S")[1] in {"/JavaScript", "/Launch", "/GoToR", "/SubmitForm", "/ImportData", "/Rendition"}:
                raise Rejected("pdf_active_content")
        pages = []
        text_length = 0
        for page in doc:
            if page.rect.width <= 0 or page.rect.height <= 0 or page.rect.width > 2400 or page.rect.height > 3600:
                raise Rejected("pdf_page_dimensions")
            text = page.get_text()
            text_length += len(text) + (1 if pages else 0)
            pages.append(text)
            if text_length > MAX_TEXT:
                raise Rejected("text_limit_exceeded")
        text = "\n".join(pages)
        if any(not page.strip() for page in pages):
            return {"status": "needs_vision", "page_count": len(doc), "text": checked_text(text) if text.strip() else "", "reason": "scanned_or_empty_pdf_pages"}
        return {"status": "extracted", "text": checked_text(text), "page_count": len(doc)}

def image_contract(data, mime):
    from PIL import Image
    import warnings
    Image.MAX_IMAGE_PIXELS = MAX_PIXELS
    warnings.simplefilter("error", Image.DecompressionBombWarning)
    expected = "PNG" if mime == "image/png" else "JPEG"
    with Image.open(io.BytesIO(data)) as image:
        w, h = image.size
        if image.format != expected or getattr(image, "n_frames", 1) != 1:
            raise Rejected("image_signature_or_frames")
        if not 0 < w <= 4096 or not 0 < h <= 4096 or w * h > MAX_PIXELS:
            raise Rejected("image_dimensions")
        image.verify()
    with Image.open(io.BytesIO(data)) as image:
        image.load()
    # No guessed OCR result. The existing authorized vision/OCR tool must handle
    # this exact validated evidence; absence is a blocker, never an empty JD.
    return {"status": "needs_vision", "text": "", "width": w, "height": h, "reason": "authorized_vision_required"}

def parse(data, mime):
    if mime == DOCX:
        return docx_text(data)
    if mime == "application/pdf":
        return pdf_text(data)
    if mime in {"image/png", "image/jpeg"}:
        return image_contract(data, mime)
    return {"status": "extracted", "text": checked_text(data.decode("utf-8-sig", errors="strict"))}

def worker(mime):
    try:
        resource.setrlimit(resource.RLIMIT_CPU, (12, 12))
        resource.setrlimit(resource.RLIMIT_AS, (1024 * 1024 * 1024, 1024 * 1024 * 1024))
        resource.setrlimit(resource.RLIMIT_NOFILE, (32, 32))
    except (ValueError, OSError):
        # No fallback to parsing without mandatory process resource limits.
        print(json.dumps({"status": "blocked", "reason": "parser_resource_limits_unavailable"}))
        return
    data = sys.stdin.buffer.read(MAX_BYTES + 1)
    try:
        if not data or len(data) > MAX_BYTES or mime not in MIMES:
            raise Rejected("invalid_input_envelope")
        result = parse(data, mime)
    except Rejected as error:
        result = {"status": "blocked", "reason": str(error)}
    except Exception:
        result = {"status": "blocked", "reason": "invalid_or_unsupported_document"}
    print(json.dumps(result, ensure_ascii=True))

def main():
    if len(sys.argv) == 3 and sys.argv[1] == "--worker":
        worker(sys.argv[2])
        return
    data = sys.stdin.buffer.read(MAX_BYTES + 1)
    result = {"status": "blocked", "reason": "invalid_input_envelope"}
    if len(sys.argv) == 4:
        mime, expected_hash, size = sys.argv[1:]
        actual_hash = hashlib.sha256(data).hexdigest()
        if mime in MIMES and size.isdecimal() and int(size) == len(data) and 0 < len(data) <= MAX_BYTES and re.fullmatch(r"[a-f0-9]{64}", expected_hash) and actual_hash == expected_hash:
            try:
                child = subprocess.run([sys.executable, "-I", os.path.abspath(__file__), "--worker", mime], input=data, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=20, env={"PATH": "/usr/bin:/bin", "LANG": "C.UTF-8", "TZ": "UTC"}, check=False)
                if child.returncode or len(child.stdout) > 1000000:
                    result = {"status": "blocked", "reason": "parser_resource_or_execution_limit"}
                else:
                    result = json.loads(child.stdout)
            except subprocess.TimeoutExpired:
                result = {"status": "blocked", "reason": "parser_timeout"}
            except Exception:
                result = {"status": "blocked", "reason": "parser_failure"}
            result.update({"contract_version": 1, "mime_type": mime, "byte_size": len(data), "sha256": actual_hash, "source_kind": "user_provided", "employer_verified": False})
    print(json.dumps(result, ensure_ascii=True))
    sys.exit(0 if result["status"] in {"extracted", "needs_vision"} else 2)

if __name__ == "__main__":
    main()
