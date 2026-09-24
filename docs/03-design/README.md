# Design Documentation Map

This folder contains the canonical design and database documentation for JobsearchProblems.

Use this map before creating a new document.

| Document | Purpose | Update when |
| --- | --- | --- |
| [System Design](./system-design.md) | Product architecture and behavioral model | A workflow, domain, permission model, or architectural rule changes |
| [Database Schema](./database-schema.md) | Intended current data model | Tables, fields, relationships, constraints, or lifecycle rules change |
| [Database Change Management](./database-change-management.md) | Process for future database changes | The team's schema-change process itself changes |
| [Migration Audit — 2026-09-24](./migration-audit-2026-09-24.md) | Point-in-time static audit and deployment-gate summary | Preserve as the 2026-09-24 milestone; only correct factual errors or add explicit follow-up references |
| [Database Deployment Validation — 2026-09-24](./database-deployment-validation-2026-09-24.md) | Runtime proof of the initial V1 deployment | Preserve as the initial V1 validation milestone; create a new dated validation report for a future major release |

## Documentation rule

Do not create a new design document for every small feature or schema change.

For normal evolution:

1. update the relevant section of the evergreen System Design or Database Schema,
2. create the next forward migration,
3. test the change,
4. record major milestone validation separately only when useful.

The migration chain records how the database changed over time. The evergreen design documents describe what the system is intended to be now. Dated audit/validation reports preserve what was verified at a specific milestone.
