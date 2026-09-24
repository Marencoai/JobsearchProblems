# Database Change Management

**Project:** JobsearchProblems  
**Purpose:** Evergreen process for changing the deployed database without creating documentation drift or rewriting history.

## 1. Core Rule

Once a migration has been deployed, treat it as historical.

Do not go back and edit Migration 006, 014, 021, or any other already-applied migration to make the live database "look cleaner."

Instead:

1. decide what needs to change,
2. update the design,
3. create the next forward migration,
4. deploy it,
5. test it,
6. document the result.

Example:

The deployed schema currently ends at Migration 022.

If a future requirement adds `hiring_manager_name` to an Opportunity, the change should become something like:

`023_add_opportunity_hiring_manager_context.sql`

not an edit to Migration 003 where `opportunities` was originally created.

This preserves an honest record of how the database evolved.

## 2. Why This Matters

A migration chain is the database's history.

It should answer:

- What did the schema look like when the project started?
- What changed later?
- Why did it change?
- In what order were changes deployed?
- Can a brand-new environment reproduce the same final schema?
- Can we understand why a constraint, trigger, or column exists?

Editing old deployed migrations breaks that history and makes environments harder to reproduce.

## 3. Source-of-Truth Hierarchy

Use each document for a different purpose.

### 3.1 `system-design.md`

Answers:

> How should the product behave conceptually?

Update this when the product model, workflow, permissions, or architecture changes.

Examples:

- adding Contacts as a first-class domain,
- deciding External Actions require approval,
- changing how agents coordinate,
- introducing a new workflow concept.

### 3.2 `database-schema.md`

Answers:

> What is the intended current data model?

This is the human-readable description of the current target schema.

Update it when:

- a table is added,
- a field is added,
- a relationship changes,
- a lifecycle rule changes,
- a new constraint becomes part of the intended model.

This document describes the current design, not the chronological history of every change.

### 3.3 `supabase/migrations/`

Answers:

> Exactly how did the deployed database get from one state to the next?

Every deployed database change gets a new migration.

Migrations are chronological and forward-only.

### 3.4 Validation / audit documents

Point-in-time validation reports answer:

> What did we verify at this milestone?

Do not continuously rewrite an old validation report to pretend it happened later.

For a major future milestone, create a new dated validation report or add a clearly dated follow-up section.

## 4. Standard Change Workflow

Every future database change should follow this sequence.

### Step 1: Requirement

Write down what changed in plain English.

Example:

> We now need to track whether an Opportunity requires relocation and, if so, the stated relocation location.

Before touching SQL, decide:

- Is this really new data?
- Does an existing field already represent it?
- Is it current state or historical state?
- Does it belong to Opportunity, Company, Candidate Settings, or another domain?
- Is it optional or required?
- Who may read/write it?

### Step 2: Impact review

Check what the change touches.

Typical questions:

- Does RLS need to change?
- Does a trigger depend on this table?
- Does a lifecycle function need updating?
- Does a snapshot need to preserve this field?
- Does a composite Workspace FK need to be added?
- Does a permission need to be created?
- Does an index need to be added?
- Does historical data need a backfill?
- Could this break existing rows?

### Step 3: Update the intended design

Update `system-design.md` when behavior/architecture changes.

Update `database-schema.md` when the data model changes.

This should happen before or alongside the migration so documentation does not become an afterthought.

### Step 4: Create a new migration

Use the next sequential migration number.

Examples:

- `023_add_opportunity_relocation_fields.sql`
- `024_add_contact_domain.sql`
- `025_harden_outreach_send_authority.sql`

A migration should be narrowly scoped and explain:

- why it exists,
- what it changes,
- important safety assumptions,
- any backfill behavior,
- lifecycle/security implications.

### Step 5: Review before deployment

Review:

- SQL correctness
- dependencies on prior migrations
- RLS
- permissions
- Workspace isolation
- SECURITY DEFINER exposure
- indexes / constraints
- lifecycle transitions
- historical immutability
- backward compatibility

For a large change, test first in a non-production Supabase environment if one exists.

### Step 6: Deploy

Apply the new migration.

Do not manually edit the live table through the Dashboard as the normal way to evolve the schema.

The migration file should be the reproducible source of the change.

If an emergency manual SQL change is ever required:

1. record exactly what was run,
2. immediately create a matching migration / reconciliation migration,
3. document why the exception occurred.

### Step 7: Runtime validation

Test both:

**happy path**
- the intended new behavior works

and:

**negative / adversarial path**
- unauthorized actors are blocked
- invalid states are blocked
- old historical records remain correct
- cross-Workspace access is still blocked

For lifecycle changes, deliberately try the transitions that should fail.

### Step 8: Regression check

Retest the neighboring domain.

Example:

If Application Material behavior changes, also recheck:

- Package approval
- Application submission
- submitted snapshots
- retry behavior

A change should not only pass its new test; it should not break the old contract.

### Step 9: Document the deployed result

Record:

- migration number and name,
- requirement,
- important implementation decision,
- tests run,
- whether a bug was found,
- final result.

For a small routine change, the migration comments + updated schema docs may be enough.

For a major release or security/lifecycle change, add a dated validation note/report.

## 5. Types of Future Changes

### 5.1 Adding a nullable field

Usually simple.

Example:

`opportunities.hiring_manager_name text null`

Typical work:

- update schema doc,
- add migration,
- deploy,
- test read/write + RLS.

### 5.2 Adding a required field

More care is needed because existing rows do not have a value.

Typical safe pattern:

1. add it nullable,
2. backfill existing rows,
3. validate the data,
4. add `NOT NULL`.

Do not add a required field in one step unless every existing row can satisfy it safely.

### 5.3 Renaming a field

Avoid destructive rename-only changes when application code may still depend on the old name.

Safer staged pattern:

1. add new field,
2. write/migrate data,
3. update application code,
4. verify,
5. remove old field in a later migration.

### 5.4 Changing an enum-like CHECK constraint

Example: adding a new Opportunity stage.

Create a new migration that replaces or expands the constraint.

Then test every trigger/lifecycle function that switches on that status.

### 5.5 Adding a new table/domain

Treat this as a mini-design cycle.

Define:

- ownership / `workspace_id`
- foreign keys
- permissions
- RLS
- audit fields
- lifecycle
- historical behavior
- indexes
- agent/human authority
- Activity Event integration where relevant

### 5.6 Changing lifecycle rules

These are high-risk changes.

Example:

Allowing a previously terminal state to reopen.

Before changing it, explicitly answer:

- What history must remain immutable?
- Who gets authority?
- What dependent records need reconciliation?
- Does reopening invalidate prior approval?
- Does a new version make more sense than mutating history?

The runtime bugs found in Migrations 020–022 are examples of why lifecycle changes should be adversarially tested.

### 5.7 Removing a field or table

Destructive changes should normally be staged.

Preferred pattern:

1. stop writing it,
2. remove application dependencies,
3. verify no important reads remain,
4. preserve/export data if required,
5. drop it in a later migration.

## 6. Documentation Rule That Prevents the Housing Compass Problem

Do not create a new document every time a tiny thing changes.

That creates a pile of conflicting documents.

Instead use:

- **one evergreen system design**
- **one evergreen current database schema**
- **one forward-only migration chain**
- **dated milestone validation reports**
- **this evergreen change-management process**

For routine changes, update the existing canonical docs.

Create a new document only when there is a genuine new category of documentation or a point-in-time milestone worth preserving.

## 7. Git / Commit Pattern

A clean change may look like:

**Commit 1**
`Update Opportunity design for relocation requirements`

**Commit 2**
`Add Opportunity relocation fields migration`

**Commit 3**
`Document and validate Opportunity relocation migration`

For very small changes these may be one commit, but the conceptual steps should still exist.

## 8. Migration Naming

Continue the sequential numbering already in use.

Current end of chain:

`022_withdrawn_submission_retry_support`

Next change:

`023_<short_description>.sql`

Then:

`024_<short_description>.sql`

Do not reuse a number.

Do not reorder deployed migrations.

Do not rename old deployed migrations unless there is an exceptional repository-only reason and the deployment history is handled explicitly.

## 9. Definition of Done for a Database Change

A database change is not done merely because the SQL ran.

It is done when:

- requirement is clear,
- intended design is updated,
- forward migration exists,
- migration deploys successfully,
- RLS / permissions still behave correctly,
- happy-path test passes,
- expected failure tests pass,
- relevant regression tests pass,
- no synthetic data is left behind,
- documentation matches the deployed behavior.

## 10. Example: "We Need Three More Fields Later"

Suppose six months from now we decide an Opportunity needs:

- `travel_percent`
- `equity_offered`
- `hiring_manager_name`

The process is:

1. confirm these belong on Opportunity,
2. decide types and nullable/default behavior,
3. update the Opportunity section of `database-schema.md`,
4. create Migration 023,
5. deploy it,
6. test User 1 / User 2 RLS,
7. test create/update behavior,
8. determine whether Evaluation snapshots should include the new fields,
9. if yes, update snapshot logic in the same or next migration,
10. run Evaluation regression tests,
11. document the result.

We do **not** rewrite Migration 003 just because that is where Opportunities were originally created.

## 11. Guiding Principle

The schema document describes **what is true now**.

The migration chain records **how we got here**.

Validation reports record **what we proved at a point in time**.

Git history records **who changed the repository and when**.

Keeping those four jobs separate is what prevents documentation from turning into a pile of contradictory notes.
