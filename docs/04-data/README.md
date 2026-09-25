# Data Preparation

This folder contains controlled, pre-import data manifests and related data-loading notes.

## Current files

- [Candidate Knowledge Import Manifest — 2026-09-24](./candidate-knowledge-import-manifest-2026-09-24.md)

## Rule

A manifest is a reviewable staging document, not the production database.

Use the sequence:

1. extract source-backed facts,
2. separate confirmed facts from inference,
3. resolve exceptions,
4. generate the import,
5. load into Supabase,
6. validate relationships, RLS, and retrieval,
7. preserve the manifest as the record of what was intended to be loaded.

Future changes to Candidate Knowledge after import should be made as normal data changes with source/validation history, not by repeatedly re-running the original manifest as though it were authoritative forever.
