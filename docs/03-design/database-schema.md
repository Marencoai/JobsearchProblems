Job Search AI Agent

Database Schema

1. Identity, Workspace, and Permissions

This section defines the access-control foundation for the Job Search AI Agent.

The workspace is the primary tenancy boundary. Human users, AI agents, and trusted system actors are all represented as Principals and operate through explicit workspace membership, roles, and permissions.

Normal agent activity should be governed by the same access model as human activity rather than relying on unrestricted backend access.

1.1 workspaces

Represents one isolated job-search environment.

For V1, there may be only one Workspace. The schema should still support future individual users, coaches, teams, and shared programs without redesigning the data model.

Suggested fields:

Field

Type

Purpose

id

uuid

Primary key

name

text

Workspace name

slug

text

Human-readable unique identifier

status

text

Active, inactive, archived

created_at

timestamptz

Creation timestamp

updated_at

timestamptz

Last update timestamp

Design rule:

Every major business record should belong directly to a Workspace through workspace_id.

1.2 principals

Represents an actor that may access data or perform actions.

A Principal may be:

Human user

AI agent

Trusted system actor

Suggested fields:

Field

Type

Purpose

id

uuid

Primary key

principal_type

text

Human, agent, system

auth_user_id

uuid nullable

Supabase authenticated identity when applicable

name

text

Display name

status

text

Active, inactive, suspended

created_at

timestamptz

Creation timestamp

updated_at

timestamptz

Last update timestamp

Constraints:

auth_user_id should be unique when present.

Normal agent actions should execute through a recognizable Principal identity whenever technically possible.

Examples:

Diana
principal_type = human

Evaluation Agent
principal_type = agent

Outreach Agent
principal_type = agent

Application Agent
principal_type = agent

1.3 workspace_memberships

Represents a Principal's membership in a Workspace.

Suggested fields:

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Related Workspace

principal_id

uuid

Related Principal

status

text

Active, inactive, suspended

joined_at

timestamptz

Membership start

created_at

timestamptz

Record creation

updated_at

timestamptz

Last update

Constraints:

A Principal should not have duplicate active memberships in the same Workspace.

Workspace membership is required before a Principal may access workspace-owned data.

1.4 roles

Represents a reusable bundle of responsibilities.

Examples:

Owner

Candidate

Coach

Evaluation Agent

Application Agent

Outreach Agent

Interview Agent

Safety Agent

Suggested fields:

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid nullable

Workspace-specific role; null for predefined system role

name

text

Role name

description

text nullable

Human-readable purpose

is_system_role

boolean

Whether predefined by the system

status

text

Active, inactive

created_at

timestamptz

Record creation

updated_at

timestamptz

Last update

Design rule:

Roles describe responsibility. They should not be tied to one specific human or agent identity.

1.5 membership_roles

Links Workspace Memberships to Roles.

Using a junction table allows a Membership to receive more than one Role later without redesigning workspace_memberships.

Suggested fields:

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

workspace_membership_id

uuid

Related Membership

role_id

uuid

Assigned Role

created_at

timestamptz

Record creation

created_by_principal_id

uuid nullable

Actor assigning role

Constraint:

The same Role should not be assigned to the same Membership more than once.

1.6 permissions

Represents one explicit capability.

Permissions should be action-oriented and granular enough to support RBAC and progressive autonomy.

Suggested fields:

Field

Type

Purpose

id

uuid

Primary key

permission_key

text

Unique capability key

domain

text

Functional domain

action

text

Read, create, update, delete, prepare, submit, send, etc.

description

text nullable

Human-readable explanation

created_at

timestamptz

Record creation

Example permission keys:

workspace.read

opportunity.read
opportunity.create
opportunity.update

candidate_knowledge.read
candidate_knowledge.create
candidate_knowledge.update

evaluation.read
evaluation.create

application.read
application.prepare
application.submit

outreach.read
outreach.draft
outreach.send

interview.read
interview.prepare

email.read
email.send

calendar.read
calendar.write

internal_task.read
internal_task.create
internal_task.update

Preparation and real-world execution should use different permissions.

1.7 role_permissions

Links Roles to Permissions.

Suggested fields:

Field

Type

Purpose

id

uuid

Primary key

role_id

uuid

Related Role

permission_id

uuid

Related Permission

created_at

timestamptz

Record creation

Constraint:

The same Permission should not be assigned to the same Role more than once.

1.8 Access-Control Relationship

Conceptually:

auth.users / agent identity
        ↓
Principals
        ↓
Workspace Memberships
        ↓
Membership Roles
        ↓
Roles
        ↓
Role Permissions
        ↓
Permissions

An access decision should answer:

Which Principal is making the request?

Which Workspace owns the record?

Is the Principal an active member of that Workspace?

Does the Principal have the required Permission through an assigned Role?

1.9 Workspace Ownership Pattern

Major business tables should contain workspace_id directly.

Examples:

companies.workspace_id
opportunities.workspace_id
contacts.workspace_id
applications.workspace_id
projects.workspace_id
activity_events.workspace_id
internal_tasks.workspace_id

Explicit Workspace ownership improves RLS simplicity, debugging, query performance, auditing, and future multi-tenant support.

1.10 Workspace-Safe Foreign Keys

RLS is not sufficient by itself to guarantee tenant isolation.

A child row must not be able to claim one workspace_id while referencing a parent record in another Workspace.

Tenant-owned parent tables should therefore expose a composite candidate key:

UNIQUE (workspace_id, id)

Tenant-owned child relationships should use composite foreign keys where practical:

(workspace_id, opportunity_id)
    → opportunities(workspace_id, id)

rather than relying only on:

opportunity_id → opportunities(id)

This pattern should be applied consistently to relationships among tenant-owned business records.

Design principle:

RLS controls who may access a row. Workspace-safe foreign keys prevent the data model itself from creating cross-Workspace relationships.

1.11 Actor Audit Pattern

Meaningful writable records should support actor attribution where relevant.

Common fields may include:

created_by_principal_id
updated_by_principal_id

External or approved actions may additionally include:

requested_by_principal_id
approved_by_principal_id
performed_by_principal_id

This allows the system to distinguish human activity, agent activity, approval, and execution.

1.12 RLS Design Principles

RLS should enforce Workspace membership and required permissions consistently.

Reusable helper functions should centralize access checks rather than duplicating complex logic across hundreds of policies.

Conceptual helpers:

current_principal_id()
can_access_workspace(workspace_id)
has_permission(workspace_id, permission_key)

Conceptual policy:

Allow SELECT on opportunities when:

has_permission(
    opportunities.workspace_id,
    'opportunity.read'
)

Implementation notes:

Helper functions used by RLS should be designed carefully to avoid recursive policy evaluation.

Any SECURITY DEFINER helper must use a controlled search path and expose only the minimum required behavior.

Normal agent work should not routinely use the Supabase service-role credential because service-role access bypasses RLS.

Service-role access should be reserved for narrowly defined trusted system operations where bypassing RLS is intentional.

1.13 External Action Boundary

Database access is not the same as authority to perform a real-world external action.

An external action should require:

Database Permission
+
Automation Policy
+
Required Approval
+
Safety / execution checks
=
External Action Allowed

Example:

Application Agent
application.prepare = allowed
application.submit = denied

Later the Workspace may allow:

application.submit = allowed after candidate approval

External execution is modeled separately in the Workflow schema.

1.14 Identity and Access Design Principle

Humans and agents participate in the system through the same governed access model.

The goal is not to give agents unrestricted backend power.

The goal is to make every meaningful actor identifiable, permissioned, auditable, and constrained by Workspace boundaries.

2. Core Opportunity Schema

This section defines the core records used to represent employers, job openings, sources, role families, and professional contacts.

These tables form the foundation for Opportunity discovery, evaluation, outreach, application tracking, and interview workflows.

All major records in this section belong to a Workspace and should participate in the shared RLS model defined in Section 1.

2.1 companies

Represents an employer or organization.

A Company may have many Opportunities, Contacts, Company Intelligence records, Applications, and Outreach Engagements over time.

Suggested fields:

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

name

text

Company name

normalized_name

text

Standardized name used for matching and deduplication

website_url

text nullable

Company website

careers_url

text nullable

Main careers page

linkedin_url

text nullable

Company LinkedIn page

industry

text nullable

Industry or sector

company_size

text nullable

Company size when known

headquarters_location

text nullable

Headquarters

status

text

Active, inactive, archived

created_at

timestamptz

Record creation

updated_at

timestamptz

Last update

created_by_principal_id

uuid

Actor that created the record

updated_by_principal_id

uuid nullable

Actor that last updated the record

Design notes:

Company identity should remain stable across multiple Opportunities.

Historical Opportunity activity should not be deleted if a Company later becomes inactive.

normalized_name may support duplicate detection.

2.2 company_intelligence

Represents time-stamped research, observations, or signals about a Company.

Company Intelligence should remain separate from the Company's stable core record because this information changes over time.

Suggested fields:

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

company_id

uuid

Related Company

intelligence_type

text

News, hiring signal, leadership change, review theme, strategy signal, etc.

title

text nullable

Short label

summary

text

Intelligence summary

evidence_type

text

Confirmed, public report, employee opinion, inference, unknown

confidence_level

text nullable

High, medium, low or equivalent

source_url

text nullable

Supporting source

source_name

text nullable

Source name

published_at

timestamptz nullable

Source publication date

researched_at

timestamptz

When the system retrieved or recorded it

expires_at

timestamptz nullable

Optional freshness boundary

is_active

boolean

Whether intelligence should currently be considered

created_by_principal_id

uuid

Human or agent that created it

created_at

timestamptz

Record creation

Design notes:

Intelligence should be reusable across multiple Opportunities at the same Company.

Old intelligence should usually be preserved rather than overwritten.

Freshness matters. Historical intelligence may remain valuable even after it is no longer considered current.

2.3 job_families

Represents a reusable role category across Companies.

Examples:

Enterprise Account Executive

Strategic Solutions Engineer

Director of Operations

Revenue Operations

AI Transformation

Suggested fields:

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

name

text

Job Family name

description

text nullable

Plain-language description

status

text

Active, inactive

created_at

timestamptz

Record creation

updated_at

timestamptz

Last update

created_by_principal_id

uuid

Actor that created the record

Design notes:

Job Family is reusable across Companies.

Job Family should not be confused with a specific Opportunity.

Application Templates may later be linked to Job Families.

2.4 opportunities

Represents one specific job opening at one specific Company.

This is the central business object in the system.

Suggested fields:

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

company_id

uuid

Related Company

job_family_id

uuid nullable

Related Job Family

title

text

Job title

normalized_title

text nullable

Standardized title used for matching

requisition_id

text nullable

Employer or ATS requisition identifier

canonical_url

text nullable

Preferred authoritative posting URL

location_text

text nullable

Job location

work_arrangement

text nullable

Remote, hybrid, onsite

employment_type

text nullable

Full-time, contract, part-time, etc.

salary_min

numeric nullable

Minimum compensation

salary_max

numeric nullable

Maximum compensation

salary_currency

text nullable

Currency

salary_period

text nullable

Annual, hourly, etc.

job_description_text

text nullable

Canonical job-description text

opportunity_stage

text

Discovered, Verified, Evaluating, Pursuing, Interviewing, Offer, Closed

closed_reason

text nullable

Rejected, Withdrawn, Role Closed, No Response, etc.

first_discovered_at

timestamptz

First discovery timestamp

last_verified_at

timestamptz nullable

Most recent verification

posting_date

date nullable

Posting date when known

closing_date

date nullable

Deadline when known

is_currently_active

boolean

Whether role appears active

previous_opportunity_id

uuid nullable

Optional link to earlier related Opportunity

created_at

timestamptz

Record creation

updated_at

timestamptz

Last update

created_by_principal_id

uuid

Actor that created it

updated_by_principal_id

uuid nullable

Actor that last updated it

Design notes:

One Opportunity represents one hiring event, not one job title forever.

If the same role is reposted months later as a new hiring event, a new Opportunity may be created.

previous_opportunity_id may link a new Opportunity to an earlier related posting when useful.

Closed Opportunities should normally be preserved for history rather than reactivated blindly.

Requisition ID and canonical URL should help distinguish a reopened posting from a new Opportunity.

2.5 opportunity_sources

Represents each external place where an Opportunity was discovered, observed, or verified.

Examples:

Indeed alert

LinkedIn posting

Employer careers page

Recruiter email

Referral

Suggested fields:

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

opportunity_id

uuid

Related Opportunity

source_type

text

Indeed, LinkedIn, Employer Site, Gmail, Referral, etc.

source_url

text nullable

Source URL

external_job_id

text nullable

Source-specific identifier

source_title

text nullable

Title as presented by source

source_company_name

text nullable

Company name as presented

source_location

text nullable

Location as presented

source_salary_text

text nullable

Raw salary text

source_job_description_text

text nullable

Source-specific JD text when useful

discovered_at

timestamptz

When source was first observed

last_checked_at

timestamptz nullable

Most recent verification

is_active

boolean

Whether source is still live

created_by_principal_id

uuid

Actor that created it

created_at

timestamptz

Record creation

Design notes:

Multiple Sources should enrich one Opportunity rather than create duplicate Opportunities.

Source-specific data may be retained when it helps resolve conflicts or preserve evidence.

Employer-controlled sources should generally be treated as more authoritative for current job facts.

2.6 contacts

Represents an individual professional contact.

Examples:

Recruiter

Hiring manager

Functional leader

Employee

Referral

Former colleague

Networking contact

Suggested fields:

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

company_id

uuid nullable

Current related Company

first_name

text

First name

last_name

text nullable

Last name

full_name

text

Display name

title

text nullable

Current role title

email

text nullable

Email address

linkedin_url

text nullable

LinkedIn profile

phone

text nullable

Phone number

location_text

text nullable

Location

relationship_type

text nullable

Recruiter, hiring manager, referral, former colleague, etc.

relationship_context

text nullable

Why the relationship matters

status

text

Active, inactive, archived

created_at

timestamptz

Record creation

updated_at

timestamptz

Last update

created_by_principal_id

uuid

Actor that created it

updated_by_principal_id

uuid nullable

Actor that last updated it

Design notes:

A Contact should exist independently of a single Opportunity.

One Contact may matter to many Opportunities over time.

Current Company should not erase historical relationship context if the person later changes employers.

A future Contact history model may be added if employer changes become important.

2.7 Opportunity-Contact Relationship

A Contact may relate to multiple Opportunities, and an Opportunity may involve multiple Contacts.

This should be modeled through a junction table rather than a single contact_id field on Opportunity.

Suggested table:

opportunity_contacts

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

opportunity_id

uuid

Related Opportunity

contact_id

uuid

Related Contact

relationship_role

text

Recruiter, hiring manager, interviewer, referral, outreach target, etc.

is_primary

boolean

Whether this is the primary contact for that role

notes

text nullable

Relationship-specific context

created_at

timestamptz

Record creation

created_by_principal_id

uuid

Actor that created the relationship

Constraint:

The same Contact and Opportunity should not receive duplicate identical relationship records unless there is a meaningful reason.

2.8 Core Relationship Map

Conceptually:

Workspace
   ↓
Company
   ├── Company Intelligence
   ├── Contacts
   └── Opportunities
          ├── Opportunity Sources
          ├── Job Family
          └── Opportunity Contacts
                   ↓
                Contacts

2.9 Historical Opportunity Rule

Closed Opportunities should remain historical records.

If a similar role appears later, the system should determine whether it is:

The same posting still active

The same requisition reopened

A reposted version of the previous Opportunity

A genuinely new hiring event

When it is a new hiring event, the system should create a new Opportunity and may link it to an earlier related Opportunity using previous_opportunity_id.

This preserves prior applications, outreach, interviews, and outcomes while allowing new pursuit activity to begin cleanly.

2.10 Core Opportunity Design Principle

Company and Contact represent relatively durable entities.

Opportunity represents a specific hiring event.

Opportunity Sources represent external observations of that hiring event.

Company Intelligence represents changing employer context.

Historical Opportunity records should remain available so future Opportunities can benefit from what the system already learned.

3. Candidate Knowledge Schema

This section defines the structured Candidate Knowledge Base.

The Candidate Knowledge Base stores the candidate's professional history, projects, evidence, skills, tools, and supporting artifacts.

It should serve as the primary source of truth for:

Opportunity Evaluation

Resume generation

Application preparation

Outreach

Interview preparation

Career Gap analysis

Candidate Knowledge should be reusable across Opportunities rather than recreated for every application.

All Candidate Knowledge records belong to a Workspace and should participate in the shared RLS and Principal audit model.

3.1 work_experiences

Represents a professional role, contract, company, client engagement, or substantial work period.

Examples:

Ferrari & Maserati of San Diego

Reliant Funding

Backd Business Funding

Levo Funding

Alpine Development Collaborative

MarencoAI

Suggested fields:

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

company_name

text

Employer or client

company_id

uuid nullable

Link to Company when useful

role_title

text

Primary title

employment_type

text nullable

Full-time, contract, self-employed, etc.

start_date

date nullable

Start date

end_date

date nullable

End date

is_current

boolean

Whether currently active

summary

text nullable

Plain-language overview

scope

text nullable

Organizational or operational scope

team_context

text nullable

Team size, reporting structure, environment

responsibilities

text nullable

Main responsibilities

systems_owned

text nullable

Systems or platforms owned

major_outcomes

text nullable

High-level outcomes

promotion_history

text nullable

Promotions or title progression

source_type

text nullable

Resume, LinkedIn, candidate-provided, etc.

validation_status

text

Confirmed, needs review, inferred

created_at

timestamptz

Record creation

updated_at

timestamptz

Last update

created_by_principal_id

uuid

Actor that created it

updated_by_principal_id

uuid nullable

Actor that last updated it

Design notes:

One Work Experience may contain many Projects.

One Work Experience may support many Evidence Stories.

The record should preserve enough context to understand the environment in which the work occurred.

3.2 projects

Represents a substantial body of work completed within or across one or more Work Experiences.

Examples:

Housing Compass

Zoho to Salesforce migration

Reliant lead-distribution redesign

Azure OCR workflow

SharePoint taxonomy redesign

Suggested fields:

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

primary_work_experience_id

uuid nullable

Optional primary Work Experience for display/convenience

name

text

Project name

summary

text nullable

Plain-language summary

problem_statement

text nullable

Problem being solved

candidate_role

text nullable

Candidate's role

stakeholders

text nullable

Users or stakeholders

responsibilities

text nullable

Candidate responsibilities

architecture_summary

text nullable

System or solution description

scale_complexity

text nullable

Scale, complexity, or operating environment

outcomes

text nullable

Results

quantitative_results

text nullable

Metrics

status

text

Active, completed, archived

start_date

date nullable

Start date

end_date

date nullable

End date

validation_status

text

Confirmed, needs review, inferred

created_at

timestamptz

Record creation

updated_at

timestamptz

Last update

created_by_principal_id

uuid

Actor that created it

updated_by_principal_id

uuid nullable

Actor that last updated it

Design notes:

Projects provide reusable context above individual stories.

A Project should explain what was built or changed without requiring reconstruction from resume bullets.

3.3 evidence_stories

Represents a specific example demonstrating how the candidate handled a problem, decision, project, interaction, or outcome.

Evidence Stories are the strongest unit for proving capabilities.

Suggested fields:

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

work_experience_id

uuid nullable

Related Work Experience

project_id

uuid nullable

Related Project

title

text

Short story label

situation

text nullable

Situation or problem

candidate_role

text nullable

Candidate's responsibility

actions_taken

text

What the candidate actually did

stakeholders

text nullable

People involved

tools_used_summary

text nullable

Plain-language tool-use summary; canonical tool links live in junction tables

outcome

text nullable

Result

quantitative_impact

text nullable

Measurable impact

professional_translation

text nullable

Professional terminology describing the work

evidence_type

text

Direct, adjacent, demonstrated understanding, inference, unknown

validation_status

text

Confirmed, candidate review needed, rejected

confidence_level

text nullable

High, medium, low

source_type

text nullable

Candidate conversation, resume, file, etc.

source_reference

text nullable

Reference to original supporting source

created_at

timestamptz

Record creation

updated_at

timestamptz

Last update

created_by_principal_id

uuid

Actor that created it

updated_by_principal_id

uuid nullable

Actor that last updated it

Design rule:

The system must distinguish between what the candidate actually did and terminology inferred from that experience.

Professional translation should not overwrite the original candidate story.

3.4 skills

Represents a reusable professional capability.

Examples:

Discovery

Solution Design

Consultative Selling

Salesforce Administration

Workflow Design

AI Enablement

Change Management

Systems Integration

Stakeholder Management

Suggested fields:

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

name

text

Skill name

normalized_name

text nullable

Standardized matching name

category

text nullable

Sales, operations, technical, leadership, etc.

description

text nullable

Plain-language meaning

status

text

Active, archived

created_at

timestamptz

Record creation

updated_at

timestamptz

Last update

Design notes:

Skills should not exist only as unsupported keywords.

Skills should be connected to Evidence Stories and Projects demonstrating them.

3.5 tools

Represents a platform, technology, framework, or system used by the candidate.

Examples:

Salesforce

Supabase

GitHub

ChatGPT

Claude

Microsoft Graph

SharePoint

Jira

AWS

Azure

Suggested fields:

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

name

text

Tool name

normalized_name

text nullable

Standardized matching name

category

text nullable

CRM, AI, cloud, database, project management, etc.

description

text nullable

Optional context

status

text

Active, archived

created_at

timestamptz

Record creation

updated_at

timestamptz

Last update

Design notes:

Experience depth should come from linked evidence, not only from a generic proficiency label.

A Tool may appear across many Projects and Evidence Stories.

3.6 artifacts

Represents tangible proof or supporting material associated with Candidate Knowledge.

Examples:

Demo video

GitHub repository

Screenshot

User guide

Architecture diagram

Presentation

Case study

LinkedIn post

PDF

Project documentation

Suggested fields:

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

name

text

Artifact name

artifact_type

text

Video, screenshot, repo, guide, document, etc.

description

text nullable

What the artifact demonstrates

url

text nullable

External URL

storage_path

text nullable

Internal storage reference

source_system

text nullable

GitHub, Drive, local upload, etc.

status

text

Active, archived

created_at

timestamptz

Record creation

created_by_principal_id

uuid

Actor that created it

Design notes:

Artifacts may support Projects, Evidence Stories, applications, outreach, and interviews.

Artifact access may later require additional privacy controls depending on storage location.

3.7 Candidate Knowledge Relationship Tables

Candidate Knowledge contains several many-to-many relationships.

These should use junction tables rather than duplicating lists inside individual records.

project_skills

Links Projects to Skills.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

project_id

uuid

Related Project

skill_id

uuid

Related Skill

evidence_strength

text nullable

Direct, strong, moderate, inferred

created_at

timestamptz

Record creation

evidence_story_skills

Links Evidence Stories to Skills.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

evidence_story_id

uuid

Related Evidence Story

skill_id

uuid

Related Skill

evidence_strength

text

Direct, adjacent, understanding, inferred

created_at

timestamptz

Record creation

This relationship is especially important because it allows the system to answer:

Which real examples prove that the candidate has this skill?

project_tools

Links Projects to Tools.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

project_id

uuid

Related Project

tool_id

uuid

Related Tool

usage_context

text nullable

How the tool was used

created_at

timestamptz

Record creation

evidence_story_tools

Links Evidence Stories directly to Tools when the tool is part of a specific example.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

evidence_story_id

uuid

Related Evidence Story

tool_id

uuid

Related Tool

usage_context

text nullable

What the candidate did with the tool

created_at

timestamptz

Record creation

project_artifacts

Links Projects to supporting Artifacts.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

project_id

uuid

Related Project

artifact_id

uuid

Related Artifact

relationship_type

text nullable

Demo, documentation, proof, output, etc.

created_at

timestamptz

Record creation

evidence_story_artifacts

Links Evidence Stories to supporting Artifacts.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

evidence_story_id

uuid

Related Evidence Story

artifact_id

uuid

Related Artifact

relationship_type

text nullable

Proof, supporting document, demonstration

created_at

timestamptz

Record creation

project_work_experiences

Links Projects to one or more Work Experiences.

This supports Projects that span a contract, consulting entity, or multiple professional contexts without forcing one Project to belong to only one Work Experience.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

project_id

uuid

Related Project

work_experience_id

uuid

Related Work Experience

relationship_role

text nullable

Primary, supporting, client context, etc.

created_at

timestamptz

Record creation

3.8 Candidate Knowledge Validation

Candidate Knowledge should support progressive enrichment without treating every AI interpretation as confirmed truth.

Recommended validation states:

confirmed
candidate_review_needed
inferred
rejected

3.9 Candidate Knowledge Source Traceability

Candidate Knowledge should retain enough source information to answer:

Where did this information come from?

Did the candidate state it directly?

Was it extracted from a resume or LinkedIn?

Was it inferred by an agent?

Has the candidate validated it?

The system should preserve both the original candidate evidence and any professional interpretation rather than replacing one with the other.

3.10 Candidate Knowledge Reuse

Candidate Knowledge should feed downstream systems.

Candidate Knowledge
      ↓
      ├── Opportunity Evaluation
      ├── Application Preparation
      ├── Outreach
      ├── Interview Preparation
      └── Career Gap Analysis

Downstream outputs should reference Candidate Knowledge rather than becoming new independent sources of candidate truth.

A resume bullet may use an Evidence Story. The resume itself does not become proof that the story is true.

3.11 Candidate Knowledge History

Candidate Knowledge is living data and may improve over time.

Later improvements should affect future work without rewriting historical submissions or communications.

Example:

September
Evidence Story v1
    ↓
Application submitted

December
Candidate adds stronger metric
    ↓
Candidate Knowledge improves
    ↓
Future applications improve

The September Application remains unchanged.

3.12 Candidate Knowledge Design Principle

The Candidate Knowledge Base should model professional reality rather than resume formatting.

The system should understand where the candidate worked, what they built, what they personally did, which tools they used, what outcomes occurred, and which evidence supports each professional capability.

Professional translation may clarify the work but must not overstate the underlying evidence.

4. Evaluation and Career Gaps Schema

This section defines how the system stores Opportunity Evaluations, Application Gaps, and Career Development Gaps.

The goal is to preserve reasoning over time without overwriting the underlying Opportunity, Company Intelligence, or Candidate Knowledge.

Evaluations should be treated as time-stamped analytical snapshots.

4.1 evaluations

Represents one assessment of an Opportunity at a specific point in time.

An Opportunity may have multiple Evaluations over time.

Suggested fields:

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

opportunity_id

uuid

Related Opportunity

version_number

integer

Evaluation version

candidate_fit_score

numeric nullable

You → Them

opportunity_fit_score

numeric nullable

Them → You

pursuit_score

numeric nullable

Hidden internal ranking score

opportunity_type

text nullable

Mutual Fit, Strong Practical Fit, High-Value Stretch, Bridge Opportunity, Low Priority

evidence_confidence

text nullable

High, medium, low or equivalent

problem_translation

text nullable

Plain-language explanation of the work/problem

problem_fit_summary

text nullable

How closely the work resembles problems the candidate has solved

strengths_summary

text nullable

Strongest reasons to pursue

tradeoffs_summary

text nullable

Important pros and cons

company_fit_summary

text nullable

Company/culture assessment

career_optionality_summary

text nullable

What future access this role may create

required_decision_authority

text nullable

Level of ownership/authority required

recommended_next_action

text nullable

Best next step

unresolved_questions

text nullable

Remaining unknowns

evaluation_status

text

Draft, complete, superseded

evaluated_at

timestamptz

Evaluation timestamp

created_by_principal_id

uuid

Human or agent that created it

created_at

timestamptz

Record creation

Design notes:

Evaluations should not overwrite prior versions.

A new Evaluation should be created when materially new information changes the assessment.

The latest Evaluation may be marked current, but earlier versions should remain preserved.

Scores should remain provisional until calibrated against real candidate reactions.

4.2 evaluation_evidence

Links an Evaluation to the Candidate Knowledge used to support it.

This provides traceability for why the system reached its conclusions.

Suggested fields:

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

evaluation_id

uuid

Related Evaluation

evidence_story_id

uuid nullable

Related Evidence Story

project_id

uuid nullable

Related Project

skill_id

uuid nullable

Related Skill

evidence_role

text

Strength, gap support, context, comparison

relevance_summary

text nullable

Why this evidence matters

confidence_level

text nullable

High, medium, low

created_at

timestamptz

Record creation

Design note:

At least one evidence reference should normally exist when the Evaluation makes a material claim about candidate capability.

4.3 evaluation_company_intelligence

Links an Evaluation to Company Intelligence records used during assessment.

Suggested fields:

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

evaluation_id

uuid

Related Evaluation

company_intelligence_id

uuid

Related Company Intelligence

relevance_summary

text nullable

Why the intelligence mattered

created_at

timestamptz

Record creation

Design note:

This allows the system to later explain:

“This evaluation used these company signals.”

4.4 application_gaps

Represents a gap affecting one specific Opportunity.

An Application Gap may be:

Missing evidence

Missing terminology

Adjacent experience

Positioning issue

Clarification needed

One-off employer preference

Suggested fields:

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

opportunity_id

uuid

Related Opportunity

evaluation_id

uuid nullable

Evaluation that identified the gap

skill_id

uuid nullable

Related Skill

gap_type

text

Missing evidence, terminology, adjacent experience, employer preference, capability gap

description

text

Gap description

severity

text nullable

Low, medium, high

blocking_status

text nullable

Blocking, non-blocking, unknown

resolution_type

text nullable

Evidence discovery, clarification, resume positioning, learning, other

resolution_status

text

Open, investigating, resolved, dismissed

resolution_notes

text nullable

How it was resolved

created_at

timestamptz

Record creation

updated_at

timestamptz

Last update

created_by_principal_id

uuid

Actor that created it

Design rule:

An Application Gap should not automatically become a Career Development Gap.

4.5 career_development_gaps

Represents a recurring or meaningful capability gap that affects future career access.

Examples:

Repeated lack of enterprise SaaS presales experience

No direct experience owning final architecture decisions

Repeated requirement for a specific technical capability

Missing scale or leadership experience appearing across desirable roles

Suggested fields:

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

skill_id

uuid nullable

Related Skill

title

text

Short gap name

description

text

Gap description

importance

text nullable

Low, medium, high

frequency_count

integer

Number of relevant Opportunities where observed

blocking_status

text nullable

Blocking, developmental, mixed

development_path

text nullable

Suggested path to close the gap

status

text

Active, improving, resolved, archived

first_observed_at

timestamptz

First observed

last_observed_at

timestamptz

Most recent observation

created_at

timestamptz

Record creation

updated_at

timestamptz

Last update

created_by_principal_id

uuid

Actor that created it

4.6 career_gap_opportunities

Links Career Development Gaps to Opportunities contributing evidence.

Suggested fields:

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

career_development_gap_id

uuid

Related Career Development Gap

opportunity_id

uuid

Related Opportunity

evaluation_id

uuid nullable

Evaluation that surfaced the gap

importance_in_role

text nullable

Minor, meaningful, central

notes

text nullable

Why the gap mattered in this role

created_at

timestamptz

Record creation

This allows the system to answer:

“How often is this gap actually showing up?”

4.7 Gap Promotion Logic

The system should not promote every missing requirement into a Career Development Gap.

Conceptually:

Potential gap appears
        ↓
Is evidence simply missing?
        ↓
Yes → Application Gap / evidence discovery

No
        ↓
Is this mainly terminology?
        ↓
Yes → Application Gap / translation

No
        ↓
Is experience adjacent?
        ↓
Yes → Application Gap / positioning

No
        ↓
Is this a one-off employer preference?
        ↓
Yes → keep local to Opportunity

No
        ↓
Is the capability repeatedly important across desirable Opportunities?
        ↓
Yes → Career Development Gap

4.8 Evaluation Versioning

Evaluations are historical analytical snapshots.

Example:

Evaluation v1
Candidate Fit: 72
Evidence Confidence: Medium

Candidate adds new validated evidence

Evaluation v2
Candidate Fit: 84
Evidence Confidence: High

Evaluation v1 remains preserved.

4.9 Evaluation Traceability

A completed Evaluation should make it possible to determine:

Which Candidate Knowledge supported the conclusions

Which Company Intelligence influenced the assessment

What was known versus inferred

Which gaps existed

Why a score changed

What action the system recommended at that point in time

Evidence-reference rows containing evidence_story_id, project_id, and skill_id should enforce a check constraint requiring exactly one referenced Candidate Knowledge object per row.

4.10 Current Evaluation Reference

For performance and usability, an Opportunity may later retain current_evaluation_id as a convenience pointer to the latest active Evaluation.

The complete Evaluation history remains authoritative for understanding how reasoning changed.

4.11 Evaluation Design Principle

Opportunity data describes the job.

Candidate Knowledge describes the candidate.

Company Intelligence describes employer context.

Evaluation combines those inputs into a time-specific interpretation and should never become the permanent source of truth for the underlying candidate or company data.

5. Application Schema

This section defines reusable Application Templates, working Application Packages, versioned materials and answers, and historical submission attempts.

The Application domain preserves the distinction between:

Living Candidate Knowledge

Working preparation

Final submitted materials and answers

Historical submission records

The system should never silently rewrite what an employer actually received.

5.1 application_templates

Represents a reusable application foundation for a Job Family or closely related role type.

Suggested fields:

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

job_family_id

uuid nullable

Related Job Family

name

text

Template name

description

text nullable

Purpose

resume_strategy

text nullable

Resume structure and emphasis

cover_letter_strategy

text nullable

Cover-letter strategy

outreach_positioning

text nullable

Typical positioning

interview_themes

text nullable

Common interview themes

status

text

Active, inactive, archived

version_number

integer

Template version

created_at

timestamptz

Record creation

updated_at

timestamptz

Last update

created_by_principal_id

uuid

Creator

updated_by_principal_id

uuid nullable

Last updater

Templates define reusable structure and retrieval strategy. They do not become an independent source of candidate truth.

5.2 application_packages

Represents the working preparation workspace for one Opportunity.

This is the working RO.

Suggested fields:

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

opportunity_id

uuid

Related Opportunity

application_template_id

uuid nullable

Template used

evaluation_id

uuid nullable

Evaluation supporting preparation

status

text

Draft, preparing, ready_for_review, approved, archived

candidate_notes

text nullable

Candidate notes

prepared_by_principal_id

uuid nullable

Human or agent preparing package

approved_by_principal_id

uuid nullable

Human approving package

approved_at

timestamptz nullable

Approval timestamp

created_at

timestamptz

Record creation

updated_at

timestamptz

Last update

Preparation status belongs here, not on the historical Application submission record.

5.3 application_materials

Represents one immutable content version of a prepared artifact.

Examples:

Resume

Cover letter

Project summary

Portfolio attachment

Supporting document

Suggested fields:

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

application_package_id

uuid

Related Package

material_type

text

Resume, cover letter, etc.

version_number

integer

Version within Package

content_text

text nullable

Exact text content when applicable

file_url

text nullable

File reference

storage_path

text nullable

Storage path

content_hash

text nullable

Optional integrity fingerprint

source_template_id

uuid nullable

Template used

status

text

Draft, candidate_review, approved, rejected, submitted

is_current_package_version

boolean

Current working version

created_at

timestamptz

Record creation

created_by_principal_id

uuid

Creator

Design rule:

Material content should not be edited in place after creation. A substantive change creates a new version row. Status metadata may change without changing the underlying content.

5.4 application_material_evidence

Links Application Materials to Candidate Knowledge.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

application_material_id

uuid

Related Material

evidence_story_id

uuid nullable

Evidence Story

project_id

uuid nullable

Project

skill_id

uuid nullable

Skill

usage_context

text nullable

How evidence was used

created_at

timestamptz

Record creation

Constraint:

Exactly one of evidence_story_id, project_id, or skill_id should be populated per row.

5.5 application_answer_packets

Represents one versioned set of employer application questions and prepared answers associated with an Application Package.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

application_package_id

uuid

Related Package

version_number

integer

Packet version

status

text

Draft, review, approved, submitted

created_at

timestamptz

Record creation

updated_at

timestamptz

Last update

created_by_principal_id

uuid

Creator

5.6 application_answers

Represents one employer question and the current prepared/final response inside a versioned Answer Packet.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

application_answer_packet_id

uuid

Related Answer Packet

question_order

integer nullable

Employer order

question_text

text

Exact question

question_type

text nullable

Text, yes/no, select, numeric, etc.

draft_answer

text nullable

Prepared answer

final_answer

text nullable

Approved answer

confidence_level

text nullable

High, medium, low

requires_candidate_input

boolean

Candidate judgment required

requires_candidate_approval

boolean

Approval required

approval_status

text nullable

Pending, approved, rejected

created_at

timestamptz

Record creation

updated_at

timestamptz

Last update

Unknown, sensitive, or unsupported answers must remain unresolved until appropriate candidate input is available.

5.7 application_answer_evidence

Links an Application Answer to supporting Candidate Knowledge.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

application_answer_id

uuid

Related Answer

evidence_story_id

uuid nullable

Evidence Story

project_id

uuid nullable

Project

skill_id

uuid nullable

Skill

relevance_summary

text nullable

Why the evidence supports the answer

created_at

timestamptz

Record creation

Constraint:

Exactly one of evidence_story_id, project_id, or skill_id should be populated per row.

5.8 applications

Represents one actual submission attempt for an Opportunity.

This is the finalized-RO side of the model. Working preparation belongs to application_packages.

Suggested fields:

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

opportunity_id

uuid

Related Opportunity

application_package_id

uuid nullable

Package used

submission_status

text

Submission_started, submitted, confirmed, submission_failed, withdrawn

submission_method

text nullable

ATS, email, recruiter, referral, etc.

application_url

text nullable

Submission URL

submission_started_at

timestamptz nullable

Attempt start

submitted_at

timestamptz nullable

Successful submission time

confirmed_at

timestamptz nullable

Confirmation time

submitted_by_principal_id

uuid nullable

Actor submitting

approved_by_principal_id

uuid nullable

Approver

confirmation_type

text nullable

Email, ATS page, recruiter, etc.

confirmation_reference

text nullable

Confirmation source

notes

text nullable

Submission notes

created_at

timestamptz

Record creation

updated_at

timestamptz

Last update

A new Application should be created for a materially new submission attempt. Submitted Applications are historical records.

5.9 application_submitted_materials

Represents the exact Material versions included in a specific Application submission.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

application_id

uuid

Related Application

application_material_id

uuid

Exact immutable Material version

material_type

text

Resume, cover letter, etc.

material_version_number

integer

Version submitted

content_hash

text nullable

Integrity fingerprint

submitted_at

timestamptz

Submission timestamp

created_at

timestamptz

Record creation

Once recorded, this relationship should not be silently changed.

5.10 application_submitted_answers

Represents the exact questions and answers sent in a specific Application submission.

This preserves answer history independently from later edits to working Answer Packets.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

application_id

uuid

Related Application

application_answer_id

uuid nullable

Source working Answer when available

question_order

integer nullable

Employer order

question_text

text

Exact question at submission time

answer_text

text nullable

Exact submitted answer

submitted_at

timestamptz

Submission timestamp

created_at

timestamptz

Record creation

Design rule:

Submitted Answers are immutable historical snapshots.

5.11 Working Package vs. Submitted Application

Candidate Knowledge
        ↓
Application Template
        ↓
Application Package
        ↓
Working Material / Answer Versions
        ↓
Candidate Approval
        ↓
Submission Attempt
        ↓
Application
        ↓
Exact Submitted Materials + Answers

The Package may continue evolving for a later submission. The historical Application does not.

5.12 Application Reuse

Application preparation should reuse validated Candidate Knowledge, Job Family strategy, approved writing patterns, prior question context, and current Opportunity information without blindly copying outdated content.

5.13 Application Approval and Autonomy

Preparation and submission are separate capabilities.

application.prepare
application.submit

The Application history should preserve who prepared, approved, and submitted the package.

5.14 Application History Principle

The system should always be able to answer:

What was submitted?

Which exact material versions did the employer receive?

What exact application answers were given?

Who approved the submission?

Who submitted it?

When did it happen?

Which Candidate Knowledge supported the preparation?

6. Outreach and Relationship Schema

This section defines professional relationships, outreach efforts, communication history, and follow-up state.

Outreach exists independently from Applications because relationships may begin before an application, survive after a role closes, and matter across several Opportunities.

6.1 outreach_engagements

Represents an ongoing relationship-building effort with a Contact.

Suggested fields:

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

contact_id

uuid

Related Contact

company_id

uuid nullable

Related Company

goal

text nullable

Relationship objective

relationship_context

text nullable

Existing history or connection

relationship_state

text nullable

Cold, warm, known, active, dormant, strong

outreach_state

text

Not_started, target_identified, warming, message_ready, contacted, engaged, waiting, closed

last_meaningful_interaction_at

timestamptz nullable

Last meaningful interaction

next_follow_up_at

timestamptz nullable

Convenience next-follow-up timestamp

status

text

Active, dormant, closed, archived

created_at

timestamptz

Record creation

updated_at

timestamptz

Last update

created_by_principal_id

uuid

Creator

updated_by_principal_id

uuid nullable

Last updater

An Outreach Engagement does not contain a single opportunity_id because one durable relationship may matter to multiple Opportunities.

6.2 outreach_engagement_opportunities

Links Outreach Engagements to zero, one, or many Opportunities.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

outreach_engagement_id

uuid

Related Engagement

opportunity_id

uuid

Related Opportunity

relationship_type

text nullable

Primary opportunity, referral path, future role, etc.

is_current

boolean

Whether currently relevant

created_at

timestamptz

Record creation

created_by_principal_id

uuid

Creator

6.3 outreach_messages

Represents one communication or proposed communication.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

outreach_engagement_id

uuid

Related Engagement

contact_id

uuid

Related Contact

opportunity_id

uuid nullable

Specific Opportunity referenced by this message

channel

text

LinkedIn, email, phone, SMS, other

direction

text

Inbound, outbound

purpose

text nullable

Intro, referral, follow-up, thank-you, recruiter response, etc.

content

text

Exact message content

version_number

integer nullable

Draft version

message_status

text

Draft, review, approved, sent, received, rejected, archived

approval_status

text nullable

Pending, approved, rejected

prepared_by_principal_id

uuid nullable

Drafting actor

approved_by_principal_id

uuid nullable

Approver

sent_by_principal_id

uuid nullable

Sending actor

sent_at

timestamptz nullable

Send time

received_at

timestamptz nullable

Receive time

response_status

text nullable

None, waiting, responded

response_at

timestamptz nullable

Response time

external_reference

text nullable

Email ID, message ID, thread URL, etc.

created_at

timestamptz

Record creation

The exact sent or received content should be preserved as history.

6.4 outreach_message_evidence

Links an Outreach Message to Candidate Knowledge used in the communication.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

outreach_message_id

uuid

Related Message

evidence_story_id

uuid nullable

Evidence Story

project_id

uuid nullable

Project

skill_id

uuid nullable

Skill

usage_context

text nullable

Why the evidence was selected

created_at

timestamptz

Record creation

Exactly one Candidate Knowledge reference should be populated per row.

6.5 outreach_interactions

Represents meaningful relationship activity that is not necessarily a direct message.

Examples include following a Contact, connection acceptance, comments, phone calls, referrals, meetings, or introductions.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

outreach_engagement_id

uuid

Related Engagement

contact_id

uuid

Related Contact

opportunity_id

uuid nullable

Related Opportunity when specific

interaction_type

text

Follow, connect, comment, call, referral, meeting, etc.

summary

text nullable

What happened

occurred_at

timestamptz

Interaction timestamp

source_system

text nullable

LinkedIn, Gmail, phone, event, etc.

source_reference

text nullable

External reference

created_by_principal_id

uuid

Recording actor

created_at

timestamptz

Record creation

6.6 relationship_notes

Represents durable professional context about a Contact or relationship.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

contact_id

uuid

Related Contact

outreach_engagement_id

uuid nullable

Related Engagement

note_type

text nullable

Relationship, preference, history, context

note_text

text

Durable note

validation_status

text

Confirmed, inferred, candidate_review_needed

created_by_principal_id

uuid

Creator

created_at

timestamptz

Record creation

updated_at

timestamptz

Last update

Unrelated personal information should not automatically become professional relationship data.

6.7 Outreach Follow-Up

Follow-up scheduling should primarily use Internal Tasks rather than creating a second task engine inside Outreach.

Message sent
    ↓
Activity Event
    ↓
Internal Task waits
    ↓
Response OR waiting period expires
    ↓
Next Action only if candidate attention is required

next_follow_up_at on the Engagement is a convenience value, not the authoritative workflow engine.

6.8 Relationship State vs. Outreach State

Relationship State describes the durable relationship. Outreach State describes the current workflow.

Example:

Jason Boomer
Relationship State: known
Outreach State: message_ready

6.9 Historical Relationship Continuity

Contacts and Engagements survive Opportunity closure.

A later Opportunity may reuse prior messages, relationship notes, referrals, and communication preferences without treating old context as automatically correct for the new situation.

6.10 Outreach and Candidate Knowledge

Candidate Knowledge
+
Opportunity
+
Company Intelligence
+
Contact / relationship history
    ↓
Outreach Draft

6.11 Outreach Approval and Agent Foundation

Drafting and sending are separate permissions. A future Outreach Agent should read and write shared RLS-governed records rather than maintain private relationship memory.

6.12 Outreach Design Principle

The Outreach domain is a lightweight professional relationship CRM. Its purpose is not to maximize message volume. Its purpose is to preserve relationship intelligence and help use genuine relationships at high-leverage moments.

7. Interview Schema

This section defines hiring processes, individual interviews, interviewers, preparation, debriefs, and follow-up.

7.1 interview_processes

Represents the employer's overall hiring process for one Opportunity.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

opportunity_id

uuid

Related Opportunity

status

text

Active, paused, completed, closed

current_stage

text nullable

Current stage

known_process_structure

text nullable

Known employer process

recruiter_contact_id

uuid nullable

Recruiter/coordinator

started_at

timestamptz nullable

Process start

completed_at

timestamptz nullable

Process end

candidate_notes

text nullable

Notes

created_at

timestamptz

Record creation

updated_at

timestamptz

Last update

created_by_principal_id

uuid

Creator

updated_by_principal_id

uuid nullable

Last updater

Normally only one Interview Process should be active for an Opportunity at a time.

7.2 interviews

Represents one specific interview, assessment, case study, or employer meeting.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

interview_process_id

uuid

Related Interview Process

opportunity_id

uuid

Related Opportunity

interview_type

text

Recruiter screen, panel, case study, etc.

stage_name

text nullable

Employer-specific stage

scheduled_start_at

timestamptz nullable

Start

scheduled_end_at

timestamptz nullable

End

duration_minutes

integer nullable

Planned duration

format

text nullable

Video, phone, onsite, take-home, etc.

meeting_url

text nullable

Meeting link

location_text

text nullable

Physical location

calendar_event_id

text nullable

External Calendar reference

instructions

text nullable

Employer instructions

preparation_status

text

Not_started, preparing, ready, completed

interview_status

text

Scheduled, completed, cancelled, rescheduled, no_show

outcome

text nullable

Advanced, rejected, pending, unknown

candidate_notes

text nullable

Notes

created_at

timestamptz

Record creation

updated_at

timestamptz

Last update

created_by_principal_id

uuid

Creator

7.3 interview_contacts

Many-to-many relationship between Interviews and Contacts.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

interview_id

uuid

Related Interview

contact_id

uuid

Related Contact

interviewer_role

text nullable

Recruiter, hiring manager, panelist, executive, etc.

is_primary

boolean

Primary interviewer when known

created_at

timestamptz

Record creation

7.4 interview_preparations

Represents a structured preparation package for one Interview.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

interview_id

uuid

Related Interview

evaluation_id

uuid nullable

Evaluation used

summary

text nullable

Concise brief

what_they_are_likely_evaluating

text nullable

Plain-language interpretation

company_context

text nullable

Relevant company context

known_risks

text nullable

Gaps or challenge areas

candidate_questions

text nullable

Questions to ask

status

text

Draft, ready, reviewed, completed

prepared_by_principal_id

uuid nullable

Human or agent

created_at

timestamptz

Record creation

updated_at

timestamptz

Last update

7.5 interview_questions

Represents predicted or actual Interview questions.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

interview_id

uuid

Related Interview

interview_preparation_id

uuid nullable

Prep package

question_text

text

Question

question_source

text

Predicted, actual, prior_interview, employer_provided

question_category

text nullable

Behavioral, technical, leadership, sales, etc.

what_they_are_evaluating

text nullable

Underlying capability

priority

text nullable

High, medium, low

created_at

timestamptz

Record creation

Predicted questions and actual questions must remain distinguishable.

7.6 interview_question_evidence

Links Interview Questions to recommended Candidate Knowledge.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

interview_question_id

uuid

Related Question

evidence_story_id

uuid nullable

Evidence Story

project_id

uuid nullable

Project

skill_id

uuid nullable

Skill

relevance_summary

text nullable

Why this evidence fits

priority_rank

integer nullable

Preferred order

created_at

timestamptz

Record creation

Exactly one Candidate Knowledge reference should be populated per row.

7.7 interview_debriefs

Represents the candidate's post-interview debrief.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

interview_id

uuid

Related Interview

candidate_summary

text nullable

How the conversation went

questions_asked

text nullable

Actual questions

important_information_learned

text nullable

New role/company context

positive_signals

text nullable

Positive signals

concerns

text nullable

Concerns

new_requirements

text nullable

Requirements learned

follow_up_commitments

text nullable

Commitments

evidence_that_worked

text nullable

Stories that landed well

evidence_gaps_discovered

text nullable

Missing evidence exposed

candidate_interest_change

text nullable

Increased, decreased, unchanged

created_at

timestamptz

Record creation

created_by_principal_id

uuid

Creator

7.8 Debrief Feedback Loop

A debrief may create or update downstream structured records after review:

Interview completed
      ↓
Debrief
      ↓
      ├── New Evaluation
      ├── Candidate Knowledge review
      ├── Company Intelligence
      ├── Application / Career Gaps
      ├── Outreach context
      └── Future interview preparation

7.9 interview_followups

Tracks interview-specific follow-up obligations.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

interview_id

uuid

Related Interview

contact_id

uuid nullable

Recipient

followup_type

text

Thank_you, document, scheduling, other

status

text

Needed, drafted, approved, sent, completed

outreach_message_id

uuid nullable

Related exact communication

due_at

timestamptz nullable

Deadline

completed_at

timestamptz nullable

Completion

created_at

timestamptz

Record creation

Actual communication content belongs in outreach_messages; this record tracks the interview obligation.

7.10 Calendar Integration Reference

Google Calendar remains an external system. interviews.calendar_event_id stores the external reference while Supabase remains authoritative for structured interview state.

Scheduling actions should be recorded through External Actions when performed by the system.

7.11 Interview Scheduling Workflow

Recruiter request
    ↓
Opportunity matched
    ↓
Calendar checked
    ↓
Response prepared
    ↓
Approval if required
    ↓
External Action sends response / creates event
    ↓
Interview record updated
    ↓
Preparation Task created

7.12 Interview History

Interview records remain historical after Opportunity closure so the system can later answer who interviewed the candidate, what was asked, which stories were used, what was learned, what follow-up occurred, and which gaps appeared.

7.13 Interview Agent Permissions

Interview preparation, Calendar reads, Calendar writes, and employer communication are separate capabilities governed through the Principal/RBAC and Automation Policy model.

7.14 Interview Design Principle

An Interview is both a hiring-process event and a source of learning. The system should capture that value without forcing the candidate to maintain a complicated tracker manually.

8. Workflow and Activity Schema

This section defines the workflow engine beneath the candidate-facing Activity Feed and Daily Work Queue.

The schema intentionally separates what happened, what the system needs to do, what the candidate needs to do, and what real-world external action is being executed.

8.1 Workflow Model

Something happens
        ↓
Activity Event
        ↓
Internal workflow decision
        ↓
Internal Task created or updated
        ↓
Does human attention matter?
       /   \
     No     Yes
     ↓       ↓
Continue   Next Action
in system      ↓
           Candidate acts
                ↓
         New Activity Event

For external side effects:

Internal Task
    ↓
External Action proposed
    ↓
Permission + Policy + Approval + Safety checks
    ↓
Execution
    ↓
Result
    ↓
Activity Event

8.2 activity_events

Represents something that happened, was discovered, decided, or materially changed.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

opportunity_id

uuid nullable

Related Opportunity/feed context

event_type

text

Event type

event_timestamp

timestamptz

When it occurred

actor_principal_id

uuid nullable

Human/agent actor

summary

text

Short candidate-facing description

details

text nullable

Additional content

source_system

text nullable

Gmail, LinkedIn, ATS, candidate, system, etc.

source_reference

text nullable

External reference

requires_candidate_attention

boolean

Attention flag

created_at

timestamptz

Record creation

Historical facts should not be silently rewritten. Corrections normally create a new Event.

8.3 activity_event_links

Provides optional non-authoritative links from an Activity Event to related domain records without adding dozens of nullable columns to activity_events.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

activity_event_id

uuid

Related Event

entity_type

text

Application, Evaluation, Contact, Interview, Task, etc.

entity_id

uuid

Related record identifier

relationship_type

text nullable

Subject, source, result, related

created_at

timestamptz

Record creation

Design rule:

This polymorphic link is convenience metadata, not an authorization boundary. Access to the referenced entity remains governed by its own RLS. Application logic must validate Workspace consistency before writing the link.

8.4 activity_replies

Represents a shallow contextual reply attached to one Activity Event.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

activity_event_id

uuid

Parent Event

author_principal_id

uuid

Human/agent author

content

text

Reply content

created_at

timestamptz

Creation time

updated_at

timestamptz nullable

Last edit

Material decisions made in Replies should be written back into structured state when appropriate.

8.5 internal_tasks

Represents mutable machine-facing workflow state.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

opportunity_id

uuid nullable

Related Opportunity

task_type

text

Evaluation, outreach, application, interview, verification, etc.

title

text

Short description

description

text nullable

Detailed instructions

owner_principal_id

uuid nullable

Responsible Principal

domain

text

Evaluation, Application, Outreach, Interview, System, etc.

status

text

Pending, ready, running, waiting, blocked, completed, failed, cancelled

priority

integer nullable

Machine priority

trigger_type

text nullable

Event, schedule, human, agent

trigger_reference

text nullable

Trigger identifier

due_at

timestamptz nullable

Due time

not_before

timestamptz nullable

Earliest resume time

waiting_condition

text nullable

Awaited condition

approval_required

boolean

Whether human approval is required

max_attempts

integer nullable

Retry limit

attempt_count

integer

Attempt count

last_attempt_at

timestamptz nullable

Last attempt

completed_at

timestamptz nullable

Completion

result_summary

text nullable

Outcome

idempotency_key

text nullable

Duplicate-prevention key

created_at

timestamptz

Record creation

updated_at

timestamptz

Last update

created_by_principal_id

uuid

Creator

Waiting Tasks are active workflow state, not unfinished candidate work.

8.6 task_dependencies

Represents Task prerequisites.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

task_id

uuid

Dependent Task

depends_on_task_id

uuid

Predecessor

dependency_type

text

Must_complete, must_succeed, informational

created_at

timestamptz

Record creation

Circular dependencies should be prevented.

Dependency types are operational execution rules, not descriptive labels:

- `informational`: does not block execution.
- `must_succeed`: predecessor Task must reach `completed`.
- `must_complete`: predecessor Task must be finished before the dependent Task may run. It is satisfied by `completed`, `cancelled`, or `failed` only when the predecessor has exhausted `max_attempts`.

A retryable failed predecessor therefore continues to block a dependent Task. Dependency checks should run whenever a Task attempts to enter `running` state so direct state changes and Task Attempt creation cannot bypass prerequisites.

8.7 task_attempts

Represents one execution attempt for an Internal Task.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

internal_task_id

uuid

Related Task

attempt_number

integer

Sequential attempt

executed_by_principal_id

uuid nullable

Agent/system actor

started_at

timestamptz

Attempt start

completed_at

timestamptz nullable

Attempt end

status

text

Running, succeeded, failed, cancelled

error_code

text nullable

Machine-readable error

error_message

text nullable

Human-readable failure

result_summary

text nullable

Result

created_at

timestamptz

Record creation

8.8 next_actions

Represents simplified work that currently requires candidate attention.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

opportunity_id

uuid nullable

Related Opportunity

internal_task_id

uuid nullable

Underlying Task

source_activity_event_id

uuid nullable

Source Event

action_type

text

Review, approve, answer, send, prepare, decide, etc.

title

text

Candidate-facing action

context_summary

text nullable

Minimum useful context

priority

integer

Candidate-facing priority

due_at

timestamptz nullable

Deadline

estimated_minutes

integer nullable

Effort estimate

approval_required

boolean

Approval action

todays_one_thing_eligible

boolean

Eligibility flag

status

text

Open, completed, dismissed, superseded

completed_at

timestamptz nullable

Completion

created_at

timestamptz

Record creation

updated_at

timestamptz

Last update

The Daily Work Queue is a view of active Next Actions, not raw Internal Tasks.

8.9 external_actions

Represents a proposed or executed real-world side effect outside the system.

Examples:

Send email

Submit application

Create Calendar event

Apply Gmail label

Archive Gmail message

Future LinkedIn send action when supported/authorized

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

opportunity_id

uuid nullable

Related Opportunity

internal_task_id

uuid nullable

Requesting Task

action_type

text

Email_send, application_submit, calendar_create, etc.

target_system

text

Gmail, ATS, Google Calendar, etc.

target_reference

text nullable

Recipient, URL, event ID, etc.

payload_snapshot

jsonb

Exact action payload at execution time

required_permission

text

Required permission key

approval_requirement

text

None, explicit_approval, rule_based

status

text

Proposed, awaiting_approval, approved, executing, succeeded, failed, cancelled

requested_by_principal_id

uuid

Requesting actor

approved_by_principal_id

uuid nullable

Approver

approved_at

timestamptz nullable

Approval time

performed_by_principal_id

uuid nullable

Executing actor

performed_at

timestamptz nullable

Execution time

external_result_reference

text nullable

Message ID, confirmation ID, etc.

idempotency_key

text

Duplicate-prevention key

error_message

text nullable

Failure reason

created_at

timestamptz

Record creation

updated_at

timestamptz

Last update

Once an External Action succeeds, its executed payload and result are historical and should not be silently rewritten.

8.10 workflow_runs

Represents one scheduled, event-driven, or manually triggered workflow run.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

workflow_type

text

Morning intake, queue generation, Gmail sync, etc.

trigger_type

text

Scheduled, event, manual

trigger_reference

text nullable

Trigger details

status

text

Running, completed, partial, failed

started_at

timestamptz

Start

completed_at

timestamptz nullable

Completion

items_processed

integer

Successful count

items_failed

integer

Failed count

summary

text nullable

Run summary

error_summary

text nullable

Failure summary

executed_by_principal_id

uuid nullable

Actor

created_at

timestamptz

Record creation

Partial runs must remain distinguishable from complete success.

8.11 daily_plans

Represents one candidate-facing daily plan snapshot.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

plan_date

date

Date

status

text

Draft, active, completed

todays_one_thing_action_id

uuid nullable

Selected Next Action

grade

text nullable

A+, A, B, C, Needs Attention

score

numeric nullable

Numeric score

summary

text nullable

Progress summary

generated_at

timestamptz

Generation time

completed_at

timestamptz nullable

Completion

created_by_principal_id

uuid

Generator

created_at

timestamptz

Record creation

Normally one active Daily Plan should exist per Workspace per date.

8.12 work_blocks

Represents a focused group of candidate-facing work inside a Daily Plan.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

daily_plan_id

uuid

Related Daily Plan

name

text

Block name

block_order

integer

Display order

planned_start_at

timestamptz nullable

Optional planned time

estimated_minutes

integer nullable

Planned duration

status

text

Planned, active, completed, skipped

created_at

timestamptz

Record creation

8.13 daily_plan_items

Preserves how a Next Action was presented within one Daily Plan.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

daily_plan_id

uuid

Related Daily Plan

work_block_id

uuid nullable

Work Block

next_action_id

uuid

Related Next Action

display_order

integer

Display order

priority_snapshot

integer

Priority at generation

reason_for_priority

text nullable

Why surfaced

planned_status

text

Required, later, optional

completion_status

text

Pending, completed, carried_forward, removed

created_at

timestamptz

Record creation

This preserves what the candidate actually saw without making the Daily Plan a competing task system.

8.14 Waiting States

Waiting is an explicit Internal Task state using status, not_before, and waiting_condition.

Waiting Tasks do not appear in the candidate queue unless human attention is required.

8.15 Idempotency

Any workflow capable of creating duplicate records or real-world side effects should use stable idempotency keys where appropriate.

This includes Opportunity ingestion, email processing, Calendar creation, application submission, messages, follow-ups, and retries.

8.16 Mutable State vs. Historical Records

Mutable workflow state includes:

internal_tasks
next_actions
daily_plans
work_blocks

Historical execution records include:

activity_events
task_attempts
successful external_actions
daily_plan_items

Historical facts should not be rewritten simply because current state changes.

8.17 Agent Coordination

Agents coordinate through shared records, Tasks, Events, permissions, and External Actions.

They should not require private peer-to-peer memory to hand work off reliably.

8.18 Workflow RLS Principle

All tenant-owned workflow records contain workspace_id and use the shared RLS model.

Backend execution does not automatically imply unrestricted service-role access.

8.19 Candidate Experience Principle

The backend may contain many Tasks, waits, retries, Events, and agent operations while the candidate sees one clear Next Action.

Workflow complexity should be absorbed by the system rather than transferred to the candidate.

8.20 Workflow Design Principle

Four concepts remain separate:

Activity Event: What happened?

Internal Task: What does the system need to do?

Next Action: What does the candidate need to do?

External Action: What real-world side effect is being proposed or executed?

9. Candidate Settings and Automation Policy Schema

This section stores candidate preferences and action-specific autonomy as structured configuration rather than hard-coded application logic.

9.1 candidate_settings

Represents versioned Workspace-level candidate preferences.

Settings may include:

Approved locations and relocation areas

Remote / hybrid / onsite preferences

Travel preference

Compensation preferences

Search strategy mode

Daily Opportunity target

Preference-strength values

Work-block preferences

Notification preferences

Career-direction preferences

Suggested fields:

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

settings_schema_version

integer

Settings structure version

settings

jsonb

Structured configuration payload

version_number

integer

Candidate Settings version

status

text

Draft, active, superseded

effective_at

timestamptz

Effective time

created_at

timestamptz

Record creation

created_by_principal_id

uuid

Creator

Design note:

JSONB is appropriate here because settings are heterogeneous and evolve more quickly than the core relational model. Frequently queried settings may later be promoted to typed columns if needed.

9.2 automation_policies

Represents the allowed autonomy level for a specific class of action.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

action_type

text

Application_submit, email_send, calendar_write, Gmail_label, etc.

autonomy_level

text

Prepare_only, approve_before_action, act_within_rules, autonomous

rules

jsonb nullable

Conditions or limits

enabled

boolean

Whether policy is active

effective_at

timestamptz

Effective time

created_at

timestamptz

Record creation

updated_at

timestamptz

Last update

created_by_principal_id

uuid

Creator

updated_by_principal_id

uuid nullable

Last updater

Design rules:

An agent cannot grant itself a higher autonomy level.

Changes to Automation Policies should be auditable.

Permission and Automation Policy are separate checks.

9.3 Configuration Design Principle

Preferences and autonomy are data.

The system should be able to change how it ranks Opportunities or which external actions require approval without rewriting business logic throughout the application.

10. Integration, Sync, and Audit Schema

This section defines minimal structured state needed to coordinate external integrations and maintain security-relevant audit history.

Secrets and provider authentication tokens should not be stored in ordinary application tables when the integration platform or secure secret storage already manages them.

10.1 integration_connections

Represents a Workspace's logical connection to an external provider.

Examples:

Gmail

Google Calendar

LinkedIn source context

Indeed source context

Future ATS or browser automation provider

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

provider

text

Provider name

external_account_reference

text nullable

Non-secret provider account reference

status

text

Connected, disconnected, degraded, disabled

capabilities

jsonb nullable

Read/write capabilities available

last_successful_sync_at

timestamptz nullable

Last successful sync

last_error_at

timestamptz nullable

Last error

last_error_summary

text nullable

Error summary

connected_by_principal_id

uuid nullable

Connecting human/system actor

created_at

timestamptz

Record creation

updated_at

timestamptz

Last update

10.2 integration_sync_state

Stores cursor/checkpoint state for incremental processing without treating external systems as the system of record.

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid

Owning Workspace

integration_connection_id

uuid

Related Connection

sync_type

text

Job alerts, employer mail, Calendar, etc.

cursor_value

text nullable

Provider-specific non-secret checkpoint

last_checked_at

timestamptz nullable

Last check

last_successful_at

timestamptz nullable

Last success

status

text

Ready, syncing, failed, paused

created_at

timestamptz

Record creation

updated_at

timestamptz

Last update

10.3 audit_events

Represents append-only security and governance history that is broader than the candidate-facing Activity Feed.

Examples:

Role assignment changed

Permission configuration changed

Automation Policy changed

Agent performed privileged action

Record ownership or security-sensitive setting changed

Field

Type

Purpose

id

uuid

Primary key

workspace_id

uuid nullable

Related Workspace when applicable

actor_principal_id

uuid nullable

Acting Principal

action_key

text

Audited action

entity_type

text nullable

Affected entity type

entity_id

uuid nullable

Affected entity

old_values

jsonb nullable

Relevant prior values

new_values

jsonb nullable

Relevant new values

request_id

text nullable

Correlation identifier

source_system

text nullable

App, agent, backend, integration, etc.

occurred_at

timestamptz

Event time

created_at

timestamptz

Record creation

Audit Events should be append-only and access-controlled separately from ordinary candidate-facing history.

10.4 Integration and Audit Design Principle

External providers own their native messages, Calendar events, job pages, and accounts.

Supabase stores enough structured references, checkpoints, and outcomes to coordinate workflow, recover safely, and explain what the system did without unnecessarily duplicating every external object.

### 9. V1 Implementation Scope

The complete database schema describes the intended architecture of the Job Search AI Agent.

V1 should not implement every designed table immediately.

The initial implementation should include only the data structures required to prove the core job-search workflow while preserving an architecture that can expand without major redesign.

The V1 implementation goal is:

**Opportunity Intake → Verification → Translation → Candidate Knowledge Retrieval → Evaluation → Prioritization → Daily Work Queue → Application Preparation**

---

#### 9.1 V1 Security Foundation

These tables should be implemented first because all business data depends on the Workspace, Principal, and permission model.

Build in V1:

- `workspaces`
- `principals`
- `workspace_memberships`
- `roles`
- `permissions`
- `role_permissions`
- `candidate_settings`
- `automation_policies`

Purpose:

```text
Workspace
    ↓
Principal
    ↓
Membership
    ↓
Role
    ↓
Permission
Both humans and agents should operate through this access model.

All later V1 tables should inherit the Workspace and RLS architecture established here.

9.2 V1 Opportunity Foundation

Build in V1:

companies
job_families
opportunities
opportunity_sources
company_intelligence

These tables support:

Job Alert
    ↓
Company
    ↓
Opportunity
    ↓
Opportunity Sources
    ↓
Verification and enrichment

V1 should be able to:

Identify Opportunities
Deduplicate Opportunities
Preserve multiple Sources
Find canonical job postings
Store current Company context
Preserve historical Opportunities
9.3 V1 Candidate Knowledge Foundation

Build in V1:

work_experiences
projects
project_work_experiences
evidence_stories
skills
tools
project_skills
evidence_story_skills
project_tools
evidence_story_tools

These tables provide the initial Candidate Knowledge Base.

Conceptually:

Work Experience
      ↓
Project
      ↓
Evidence Story
   ↙         ↘
Skill        Tool

Candidate Knowledge should provide the evidence used by Evaluations and Application preparation.

V1 does not require a complete Candidate Profile management interface.

Initial records may be seeded from existing resumes, LinkedIn information, project documentation, and candidate-provided information.

9.4 V1 Evaluation

Build in V1:

evaluations
evaluation_evidence
evaluation_company_intelligence
application_gaps

These tables allow the system to combine:

Opportunity
      +
Candidate Knowledge
      +
Company Intelligence
      ↓
Evaluation

V1 Evaluation should support:

Candidate Fit: You → Them
Opportunity Fit: Them → You
Problem translation
Evidence confidence
Strengths
Tradeoffs
Important gaps
Unknowns
Recommended next action

Evaluation history should remain versioned.

9.5 V1 Workflow Engine

Build in V1:

activity_events
activity_event_links
activity_replies
internal_tasks
task_dependencies
task_attempts
next_actions

These tables support the core workflow:

Something happens
        ↓
Activity Event
        ↓
Internal Task
        ↓
Human attention needed?
      /           \
    No             Yes
    ↓               ↓
Continue        Next Action

The candidate should interact primarily with Activity Events and Next Actions.

Internal Tasks should remain primarily machine-managed.

9.6 V1 Daily Work Queue

Build in V1:

daily_plans
work_blocks
daily_plan_items

These tables support:

Today's One Thing
Prioritized Next Actions
Focus Blocks
Daily progress
Carry-forward work
Historical queue snapshots

The Daily Work Queue should answer:

What should I do today, and why?

9.7 V1 Application Foundation

Build in V1:

application_templates
application_packages
application_materials
application_material_evidence
applications
application_submitted_materials

These tables support the initial application workflow:

Candidate Knowledge
        +
Application Template
        +
Opportunity
        ↓
Application Package
        ↓
Application Materials
        ↓
Candidate Review
        ↓
Application

Application Packages represent working preparation.

Applications represent actual submission history.

Submitted materials should remain immutable historical records.

9.8 Deferred After Core V1

The following tables remain part of the intended architecture but should not be required before the core V1 workflow is operational.

Candidate Knowledge Expansion

Defer:

artifacts
project_artifacts
evidence_story_artifacts

These become valuable when portfolio and supporting-material workflows are added.

Career Development

Defer:

career_development_gaps
career_gap_opportunities

Reason:

Career Development Gaps become more useful after multiple real Opportunities have been evaluated and recurring patterns can be identified.

Application Question Automation

Defer:

application_answer_packets
application_answers
application_answer_evidence
application_submitted_answers

Reason:

The first V1 should prove Opportunity evaluation and application-material preparation before automating complex ATS question handling.

The schema should remain ready for these tables so exact submitted answers can later be preserved.

Contact and Outreach CRM

Defer:

contacts
opportunity_contacts
outreach_engagements
outreach_engagement_opportunities
outreach_messages
outreach_message_evidence
outreach_interactions
relationship_notes

Reason:

Outreach is expected to be an important early expansion, but the core Opportunity intake and evaluation loop should be proven first.

Interview Management

Defer:

interview_processes
interviews
interview_contacts
interview_preparations
interview_questions
interview_question_evidence
interview_debriefs
interview_followups

Reason:

Interview automation becomes useful after active Opportunities begin progressing into interviews.

The architecture already defines where these records will fit.

Advanced Automation Infrastructure

Defer:

external_actions
workflow_runs
integration connection and synchronization state

Reason:

V1 should initially emphasize preparation, recommendation, and human approval.

Advanced external execution becomes necessary when the system begins performing more actions autonomously.

9.9 V1 Dependency Order

The V1 database should be implemented in dependency order.

Conceptually:

1. SECURITY
   Workspace
   Principals
   Roles
   Permissions
        ↓

2. OPPORTUNITY
   Companies
   Job Families
   Opportunities
   Sources
        ↓

3. CANDIDATE KNOWLEDGE
   Work Experience
   Projects
   Evidence
   Skills
   Tools
        ↓

4. EVALUATION
   Evaluations
   Evidence Links
   Application Gaps
        ↓

5. WORKFLOW
   Activity Events
   Internal Tasks
   Next Actions
        ↓

6. DAILY QUEUE
   Daily Plans
   Work Blocks
   Plan Items
        ↓

7. APPLICATION
   Templates
   Packages
   Materials
   Applications

Each layer should be tested before the next dependent layer is added.

9.10 V1 Expansion Path

Once the core loop is working reliably, expansion should follow actual candidate workflow needs rather than simply implementing the remaining schema in order.

A likely expansion sequence is:

Core V1
   ↓
Outreach
   ↓
Application Question Automation
   ↓
Interview Management
   ↓
Career Development
   ↓
Higher Autonomy / External Actions

The exact sequence may change based on real usage.

9.11 V1 Scope Principle

The full schema represents what the system is designed to become.

The V1 schema represents what the system needs to prove first.

A deferred table is not rejected architecture.

It is architecture that does not yet need to carry implementation cost.

The system should build the smallest useful layer while protecting the relationships, security boundaries, and historical model required for future expansion.


And the **org-chart instinct is actually useful from here on out**.

When we're about to build a table, you can ask:

> “Who is this table's boss?”

Meaning, what does it belong to?

And:

> “Who reports to it?”

Meaning, what depends on it?

That will make foreign keys, dependency order, and even RLS much easier to reason about.

Once you paste this in, **we are done designing the schema for now**.

The next step is our first actual build step: **turn Section 1, the Security Foundation, into Supabase SQL.**
