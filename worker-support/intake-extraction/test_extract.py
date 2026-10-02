"""Synthetic-only parser and process-boundary checks; no network or records."""
import hashlib
import importlib.util
import io
import json
import pathlib
import stat
import subprocess
import sys
import unittest
import warnings
import zipfile

import pymupdf
from PIL import Image

HELPER = pathlib.Path(__file__).with_name("extract.py")
spec = importlib.util.spec_from_file_location("intake_extractor", HELPER)
extractor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(extractor)
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
CONTENT = b'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
DOCUMENT = b'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Fictional role. Visit https://example.invalid; do not fetch it.</w:t></w:r></w:p></w:body></w:document>'

def archive(extra=(), document=DOCUMENT, content=CONTENT):
    target = io.BytesIO()
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("[Content_Types].xml", content)
            z.writestr("word/document.xml", document)
            for name, value in extra:
                z.writestr(name, value)
    return target.getvalue()

def pdf(pages=1, dimensions=(612, 792), text=True, active=False, encrypted=False):
    with pymupdf.open() as document:
        for _ in range(pages):
            page = document.new_page(width=dimensions[0], height=dimensions[1])
            if text:
                page.insert_text((72, 72), "Fictional role. https://example.invalid")
        if active == "launch":
            action = document.get_new_xref()
            document.update_object(action, "<< /S /Launch /F (file:///not/authorized) >>")
            document.xref_set_key(document.pdf_catalog(), "A", f"{action} 0 R")
        elif active:
            document.xref_set_key(document.pdf_catalog(), "OpenAction", "<< /S /JavaScript /JS (app.alert('untrusted')) >>")
        return document.tobytes(encryption=pymupdf.PDF_ENCRYPT_AES_256, owner_pw="synthetic", user_pw="synthetic") if encrypted else document.tobytes()

def image(kind="PNG", size=(32, 32), multi=False):
    output = io.BytesIO()
    frame = Image.new("RGB", size, "white")
    frame.save(output, format=kind, save_all=multi, append_images=[Image.new("RGB", size, "black")] if multi else [])
    return output.getvalue()

class Extraction(unittest.TestCase):
    def run_parser(self, data, mime="text/plain", digest=None, size=None):
        if sys.platform == "darwin" and digest is None and size is None and mime in extractor.MIMES and 0 < len(data) <= extractor.MAX_BYTES:
            # macOS here refuses RLIMIT_AS. Exercise only pure parsing against
            # generated synthetic bytes; do not bypass the production CLI's
            # mandatory limits. Linux CI executes the complete bounded CLI.
            try:
                return extractor.parse(data, mime)
            except extractor.Rejected as error:
                return {"status": "blocked", "reason": str(error)}
            except Exception:
                return {"status": "blocked", "reason": "invalid_or_unsupported_document"}
        result = subprocess.run([sys.executable, "-I", str(HELPER), mime, digest or hashlib.sha256(data).hexdigest(), str(len(data) if size is None else size)], input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=25, check=False)
        self.assertEqual(result.stderr, b"")
        value = json.loads(result.stdout)
        self.assertEqual(result.returncode, 2 if value["status"] == "blocked" else 0)
        if "sha256" in value:
            self.assertEqual(value["sha256"], hashlib.sha256(data).hexdigest())
            self.assertEqual(value["byte_size"], len(data))
            self.assertEqual(value["source_kind"], "user_provided")
            self.assertFalse(value["employer_verified"])
        return value

    @unittest.skipUnless(sys.platform == "darwin", "Mac resource rejection is environment-specific")
    def test_mac_cli_fails_closed_when_memory_limit_unavailable(self):
        value = self.run_parser(b"Fictional role", digest=hashlib.sha256(b"Fictional role").hexdigest())
        self.assertEqual(value["status"], "blocked")
        self.assertEqual(value["reason"], "parser_resource_limits_unavailable")
        self.assertNotIn("text", value)

    def blocked(self, data, mime="text/plain", **options):
        value = self.run_parser(data, mime, **options)
        self.assertEqual(value["status"], "blocked", value)
        self.assertIn("reason", value)
        self.assertNotIn("text", value)

    def test_utf8_and_bom(self):
        result = self.run_parser(b"\xef\xbb\xbfFictional role\nUTF-8: \xc3\xa9")
        self.assertEqual(result["status"], "extracted")
        self.assertEqual(result["text"], "Fictional role\nUTF-8: \u00e9")

    def test_envelope_hash_size_mime_and_bytes(self):
        for options in [{"digest": "0" * 64}, {"size": 99}, {"mime": "application/octet-stream"}, {"digest": "A" * 64}]:
            with self.subTest(options=options):
                self.blocked(b"safe", **options)
        self.blocked(b"")
        self.blocked(b"x" * (8 * 1024 * 1024 + 1))

    def test_text_controls_encoding_empty_and_output_bound(self):
        for data in [b"\xff", b"\x00secret", b" \n\t", b"x" * 100001]:
            with self.subTest(data=data[:20]):
                self.blocked(data)

    def test_docx_literal_text_and_external_relationship_not_followed(self):
        relationships = b'<Relationships><Relationship Target="file:///not/authorized" TargetMode="External"/></Relationships>'
        result = self.run_parser(archive([("word/_rels/document.xml.rels", relationships)]), DOCX)
        self.assertEqual(result["status"], "extracted")
        self.assertEqual(result["text"], "Fictional role. Visit https://example.invalid; do not fetch it.")

    def test_docx_path_duplicate_symlink_and_active_content(self):
        symlink = zipfile.ZipInfo("word/link.xml")
        symlink.create_system = 3
        symlink.external_attr = (stat.S_IFLNK | 0o777) << 16
        for name in ["../escape.xml", "/absolute.xml", "word\\escape.xml", "word/document.xml", "word/vbaProject.bin", "word/embeddings/active.exe", symlink]:
            with self.subTest(name=str(name)):
                self.blocked(archive([(name, b"unsafe")]), DOCX)

    def test_docx_expansion_entry_xml_and_text_limits(self):
        self.blocked(archive([("word/large.txt", b"x" * 200000)]), DOCX)
        self.blocked(archive([(f"small/{i}", b"x") for i in range(1000)]), DOCX)
        for text in [b"x" * 100001, b"x" * (4 * 1024 * 1024 + 1)]:
            self.blocked(archive(document=DOCUMENT.replace(b"Fictional role. Visit https://example.invalid; do not fetch it.", text)), DOCX)

    def test_docx_entities_in_utf8_and_utf16(self):
        evil = '<!DOCTYPE w:document [<!ENTITY hidden SYSTEM "file:///not/authorized">]><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>&hidden;</w:t></w:r></w:p></w:body></w:document>'
        for encoding in ["utf-8", "utf-16"]:
            self.blocked(archive(document=evil.encode(encoding)), DOCX)

    def test_docx_macro_type_missing_parts_and_corruption(self):
        self.blocked(archive(content=CONTENT.replace(b"wordprocessingml.document.main", b"ms-word.document.macroEnabled.main")), DOCX)
        self.blocked(archive()[:80], DOCX)
        self.blocked(b"not a docx", DOCX)
        target = io.BytesIO()
        with zipfile.ZipFile(target, "w") as z:
            z.writestr("unrelated", b"text")
        self.blocked(target.getvalue(), DOCX)

    def test_pdf_text(self):
        result = self.run_parser(pdf(), "application/pdf")
        self.assertEqual(result["status"], "extracted")
        self.assertEqual(result["page_count"], 1)
        self.assertIn("https://example.invalid", result["text"])

    def test_pdf_scanned_needs_vision(self):
        result = self.run_parser(pdf(text=False), "application/pdf")
        self.assertEqual(result["status"], "needs_vision")
        self.assertEqual(result["text"], "")

    def test_pdf_active_encrypted_structure_dimensions_and_malformed(self):
        for data in [pdf(active=True), pdf(active="launch"), pdf(encrypted=True), pdf(pages=51), pdf(dimensions=(2401, 3601)), b"%PDF-1.7\ngarbage", b"not pdf"]:
            with self.subTest(size=len(data)):
                self.blocked(data, "application/pdf")

    def test_image_png_jpeg_and_vision_requirement(self):
        for kind, mime in [("PNG", "image/png"), ("JPEG", "image/jpeg")]:
            result = self.run_parser(image(kind), mime)
            self.assertEqual(result["status"], "needs_vision")
            self.assertEqual(result["reason"], "authorized_vision_required")
            self.assertEqual((result["width"], result["height"]), (32, 32))

    def test_image_wrong_format_corrupt_multi_and_dimensions(self):
        for data, mime in [(image("JPEG"), "image/png"), (b"not image", "image/png"), (image()[:40], "image/png"), (image(multi=True), "image/png"), (image(size=(4097, 1)), "image/png")]:
            with self.subTest(size=len(data)):
                self.blocked(data, mime)

if __name__ == "__main__":
    unittest.main()
