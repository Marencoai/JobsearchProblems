# Job Search AI Agent
## Database Schema

### 1. Identity, Workspace, and Permissions

This section defines the access-control foundation for the Job Search AI Agent.

The goal is to ensure that both human users and AI agents operate through explicit identities, workspace membership, roles, and permissions rather than relying on unrestricted system access.

The workspace is the primary tenancy boundary.

All major business records should belong to a workspace.

---

#### 1.1 `workspaces`

Represents one isolated job-search environment.

For V1, there may be only one workspace.

Future versions may support:

- Individual users
- Career coaches
- Recruiting teams
- Shared career programs
- Multi-user organizations

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `name` | text | Workspace name |
| `slug` | text | Human-readable unique identifier |
| `status` | text | Active, inactive, archived |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Last update timestamp |

Design rule:

Every major business record should ultimately be associated with a `workspace_id`.

---

#### 1.2 `principals`

Represents an actor that may access data or perform actions.

A Principal may be:

- Human user
- AI agent
- Trusted system actor

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `principal_type` | text | Human, agent, system |
| `auth_user_id` | uuid nullable | Links to authenticated Supabase user when applicable |
| `name` | text | Display name |
| `status` | text | Active, inactive, suspended |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Last update timestamp |

Examples:

```text
Diana
principal_type = human

Evaluation Agent
principal_type = agent

Outreach Agent
principal_type = agent

Application Agent
principal_type = agent
### 2. Core Opportunity Schema

This section defines the core records used to represent employers, job openings, sources, role families, and professional contacts.

These tables form the foundation for Opportunity discovery, evaluation, outreach, application tracking, and interview workflows.

All major records in this section belong to a Workspace and should participate in the shared RLS model defined in Section 1.

---

#### 2.1 `companies`

Represents an employer or organization.

A Company may have many Opportunities, Contacts, Company Intelligence records, Applications, and Outreach Engagements over time.

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `name` | text | Company name |
| `normalized_name` | text | Standardized name used for matching and deduplication |
| `website_url` | text nullable | Company website |
| `careers_url` | text nullable | Main careers page |
| `linkedin_url` | text nullable | Company LinkedIn page |
| `industry` | text nullable | Industry or sector |
| `company_size` | text nullable | Company size when known |
| `headquarters_location` | text nullable | Headquarters |
| `status` | text | Active, inactive, archived |
| `created_at` | timestamptz | Record creation |
| `updated_at` | timestamptz | Last update |
| `created_by_principal_id` | uuid | Actor that created the record |
| `updated_by_principal_id` | uuid nullable | Actor that last updated the record |

Design notes:

- Company identity should remain stable across multiple Opportunities.
- Historical Opportunity activity should not be deleted if a Company later becomes inactive.
- `normalized_name` may support duplicate detection.

---

#### 2.2 `company_intelligence`

Represents time-stamped research, observations, or signals about a Company.

Company Intelligence should remain separate from the Company's stable core record because this information changes over time.

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `company_id` | uuid | Related Company |
| `intelligence_type` | text | News, hiring signal, leadership change, review theme, strategy signal, etc. |
| `title` | text nullable | Short label |
| `summary` | text | Intelligence summary |
| `evidence_type` | text | Confirmed, public report, employee opinion, inference, unknown |
| `confidence_level` | text nullable | High, medium, low or equivalent |
| `source_url` | text nullable | Supporting source |
| `source_name` | text nullable | Source name |
| `published_at` | timestamptz nullable | Source publication date |
| `researched_at` | timestamptz | When the system retrieved or recorded it |
| `expires_at` | timestamptz nullable | Optional freshness boundary |
| `is_active` | boolean | Whether intelligence should currently be considered |
| `created_by_principal_id` | uuid | Human or agent that created it |
| `created_at` | timestamptz | Record creation |

Design notes:

- Intelligence should be reusable across multiple Opportunities at the same Company.
- Old intelligence should usually be preserved rather than overwritten.
- Freshness matters. Historical intelligence may remain valuable even after it is no longer considered current.

---

#### 2.3 `job_families`

Represents a reusable role category across Companies.

Examples:

- Enterprise Account Executive
- Strategic Solutions Engineer
- Director of Operations
- Revenue Operations
- AI Transformation

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `name` | text | Job Family name |
| `description` | text nullable | Plain-language description |
| `status` | text | Active, inactive |
| `created_at` | timestamptz | Record creation |
| `updated_at` | timestamptz | Last update |
| `created_by_principal_id` | uuid | Actor that created the record |

Design notes:

- Job Family is reusable across Companies.
- Job Family should not be confused with a specific Opportunity.
- Application Templates may later be linked to Job Families.

---

#### 2.4 `opportunities`

Represents one specific job opening at one specific Company.

This is the central business object in the system.

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `company_id` | uuid | Related Company |
| `job_family_id` | uuid nullable | Related Job Family |
| `title` | text | Job title |
| `normalized_title` | text nullable | Standardized title used for matching |
| `requisition_id` | text nullable | Employer or ATS requisition identifier |
| `canonical_url` | text nullable | Preferred authoritative posting URL |
| `location_text` | text nullable | Job location |
| `work_arrangement` | text nullable | Remote, hybrid, onsite |
| `employment_type` | text nullable | Full-time, contract, part-time, etc. |
| `salary_min` | numeric nullable | Minimum compensation |
| `salary_max` | numeric nullable | Maximum compensation |
| `salary_currency` | text nullable | Currency |
| `salary_period` | text nullable | Annual, hourly, etc. |
| `job_description_text` | text nullable | Canonical job-description text |
| `opportunity_stage` | text | Discovered, Verified, Evaluating, Pursuing, Interviewing, Offer, Closed |
| `closed_reason` | text nullable | Rejected, Withdrawn, Role Closed, No Response, etc. |
| `first_discovered_at` | timestamptz | First discovery timestamp |
| `last_verified_at` | timestamptz nullable | Most recent verification |
| `posting_date` | date nullable | Posting date when known |
| `closing_date` | date nullable | Deadline when known |
| `is_currently_active` | boolean | Whether role appears active |
| `previous_opportunity_id` | uuid nullable | Optional link to earlier related Opportunity |
| `created_at` | timestamptz | Record creation |
| `updated_at` | timestamptz | Last update |
| `created_by_principal_id` | uuid | Actor that created it |
| `updated_by_principal_id` | uuid nullable | Actor that last updated it |

Design notes:

- One Opportunity represents one hiring event, not one job title forever.
- If the same role is reposted months later as a new hiring event, a new Opportunity may be created.
- `previous_opportunity_id` may link a new Opportunity to an earlier related posting when useful.
- Closed Opportunities should normally be preserved for history rather than reactivated blindly.
- Requisition ID and canonical URL should help distinguish a reopened posting from a new Opportunity.

---

#### 2.5 `opportunity_sources`

Represents each external place where an Opportunity was discovered, observed, or verified.

Examples:

- Indeed alert
- LinkedIn posting
- Employer careers page
- Recruiter email
- Referral

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `opportunity_id` | uuid | Related Opportunity |
| `source_type` | text | Indeed, LinkedIn, Employer Site, Gmail, Referral, etc. |
| `source_url` | text nullable | Source URL |
| `external_job_id` | text nullable | Source-specific identifier |
| `source_title` | text nullable | Title as presented by source |
| `source_company_name` | text nullable | Company name as presented |
| `source_location` | text nullable | Location as presented |
| `source_salary_text` | text nullable | Raw salary text |
| `source_job_description_text` | text nullable | Source-specific JD text when useful |
| `discovered_at` | timestamptz | When source was first observed |
| `last_checked_at` | timestamptz nullable | Most recent verification |
| `is_active` | boolean | Whether source is still live |
| `created_by_principal_id` | uuid | Actor that created it |
| `created_at` | timestamptz | Record creation |

Design notes:

- Multiple Sources should enrich one Opportunity rather than create duplicate Opportunities.
- Source-specific data may be retained when it helps resolve conflicts or preserve evidence.
- Employer-controlled sources should generally be treated as more authoritative for current job facts.

---

#### 2.6 `contacts`

Represents an individual professional contact.

Examples:

- Recruiter
- Hiring manager
- Functional leader
- Employee
- Referral
- Former colleague
- Networking contact

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `company_id` | uuid nullable | Current related Company |
| `first_name` | text | First name |
| `last_name` | text nullable | Last name |
| `full_name` | text | Display name |
| `title` | text nullable | Current role title |
| `email` | text nullable | Email address |
| `linkedin_url` | text nullable | LinkedIn profile |
| `phone` | text nullable | Phone number |
| `location_text` | text nullable | Location |
| `relationship_type` | text nullable | Recruiter, hiring manager, referral, former colleague, etc. |
| `relationship_context` | text nullable | Why the relationship matters |
| `status` | text | Active, inactive, archived |
| `created_at` | timestamptz | Record creation |
| `updated_at` | timestamptz | Last update |
| `created_by_principal_id` | uuid | Actor that created it |
| `updated_by_principal_id` | uuid nullable | Actor that last updated it |

Design notes:

- A Contact should exist independently of a single Opportunity.
- One Contact may matter to many Opportunities over time.
- Current Company should not erase historical relationship context if the person later changes employers.
- A future Contact history model may be added if employer changes become important.

---

### 2.7 Opportunity-Contact Relationship

A Contact may relate to multiple Opportunities, and an Opportunity may involve multiple Contacts.

This should be modeled through a junction table rather than a single `contact_id` field on Opportunity.

Suggested table:

#### `opportunity_contacts`

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `opportunity_id` | uuid | Related Opportunity |
| `contact_id` | uuid | Related Contact |
| `relationship_role` | text | Recruiter, hiring manager, interviewer, referral, outreach target, etc. |
| `is_primary` | boolean | Whether this is the primary contact for that role |
| `notes` | text nullable | Relationship-specific context |
| `created_at` | timestamptz | Record creation |
| `created_by_principal_id` | uuid | Actor that created the relationship |

Constraint:

The same Contact and Opportunity should not receive duplicate identical relationship records unless there is a meaningful reason.

---

### 2.8 Core Relationship Map

Conceptually:

```text
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
### 3. Candidate Knowledge Schema

This section defines the structured Candidate Knowledge Base.

The Candidate Knowledge Base stores the candidate's professional history, projects, evidence, skills, tools, and supporting artifacts.

It should serve as the primary source of truth for:

- Opportunity Evaluation
- Resume generation
- Application preparation
- Outreach
- Interview preparation
- Career Gap analysis

Candidate Knowledge should be reusable across Opportunities rather than recreated for every application.

All Candidate Knowledge records belong to a Workspace and should participate in the shared RLS and Principal audit model.

---

#### 3.1 `work_experiences`

Represents a professional role, contract, company, client engagement, or substantial work period.

Examples:

- Ferrari & Maserati of San Diego
- Reliant Funding
- Backd Business Funding
- Levo Funding
- Alpine Development Collaborative
- MarencoAI

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `company_name` | text | Employer or client |
| `company_id` | uuid nullable | Link to Company when useful |
| `role_title` | text | Primary title |
| `employment_type` | text nullable | Full-time, contract, self-employed, etc. |
| `start_date` | date nullable | Start date |
| `end_date` | date nullable | End date |
| `is_current` | boolean | Whether currently active |
| `summary` | text nullable | Plain-language overview |
| `scope` | text nullable | Organizational or operational scope |
| `team_context` | text nullable | Team size, reporting structure, environment |
| `responsibilities` | text nullable | Main responsibilities |
| `systems_owned` | text nullable | Systems or platforms owned |
| `major_outcomes` | text nullable | High-level outcomes |
| `promotion_history` | text nullable | Promotions or title progression |
| `source_type` | text nullable | Resume, LinkedIn, candidate-provided, etc. |
| `validation_status` | text | Confirmed, needs review, inferred |
| `created_at` | timestamptz | Record creation |
| `updated_at` | timestamptz | Last update |
| `created_by_principal_id` | uuid | Actor that created it |
| `updated_by_principal_id` | uuid nullable | Actor that last updated it |

Design notes:

- One Work Experience may contain many Projects.
- One Work Experience may support many Evidence Stories.
- The record should preserve enough context to understand the environment in which the work occurred.

---

#### 3.2 `projects`

Represents a substantial body of work completed within or across one or more Work Experiences.

Examples:

- Housing Compass
- Zoho to Salesforce migration
- Reliant lead-distribution redesign
- Azure OCR workflow
- SharePoint taxonomy redesign

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `work_experience_id` | uuid nullable | Primary related Work Experience |
| `name` | text | Project name |
| `summary` | text nullable | Plain-language summary |
| `problem_statement` | text nullable | Problem being solved |
| `candidate_role` | text nullable | Candidate's role |
| `stakeholders` | text nullable | Users or stakeholders |
| `responsibilities` | text nullable | Candidate responsibilities |
| `architecture_summary` | text nullable | System or solution description |
| `scale_complexity` | text nullable | Scale, complexity, or operating environment |
| `outcomes` | text nullable | Results |
| `quantitative_results` | text nullable | Metrics |
| `status` | text | Active, completed, archived |
| `start_date` | date nullable | Start date |
| `end_date` | date nullable | End date |
| `validation_status` | text | Confirmed, needs review, inferred |
| `created_at` | timestamptz | Record creation |
| `updated_at` | timestamptz | Last update |
| `created_by_principal_id` | uuid | Actor that created it |
| `updated_by_principal_id` | uuid nullable | Actor that last updated it |

Design notes:

- Projects provide reusable context above individual stories.
- A Project should explain what was built or changed without requiring reconstruction from resume bullets.

---

#### 3.3 `evidence_stories`

Represents a specific example demonstrating how the candidate handled a problem, decision, project, interaction, or outcome.

Evidence Stories are the strongest unit for proving capabilities.

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `work_experience_id` | uuid nullable | Related Work Experience |
| `project_id` | uuid nullable | Related Project |
| `title` | text | Short story label |
| `situation` | text nullable | Situation or problem |
| `candidate_role` | text nullable | Candidate's responsibility |
| `actions_taken` | text | What the candidate actually did |
| `stakeholders` | text nullable | People involved |
| `tools_used` | text nullable | Tools used |
| `outcome` | text nullable | Result |
| `quantitative_impact` | text nullable | Measurable impact |
| `professional_translation` | text nullable | Professional terminology describing the work |
| `evidence_type` | text | Direct, adjacent, demonstrated understanding, inference, unknown |
| `validation_status` | text | Confirmed, candidate review needed, rejected |
| `confidence_level` | text nullable | High, medium, low |
| `source_type` | text nullable | Candidate conversation, resume, file, etc. |
| `source_reference` | text nullable | Reference to original supporting source |
| `created_at` | timestamptz | Record creation |
| `updated_at` | timestamptz | Last update |
| `created_by_principal_id` | uuid | Actor that created it |
| `updated_by_principal_id` | uuid nullable | Actor that last updated it |

Design rule:

The system must distinguish between what the candidate actually did and terminology inferred from that experience.

Professional translation should not overwrite the original candidate story.

---

#### 3.4 `skills`

Represents a reusable professional capability.

Examples:

- Discovery
- Solution Design
- Consultative Selling
- Salesforce Administration
- Workflow Design
- AI Enablement
- Change Management
- Systems Integration
- Stakeholder Management

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `name` | text | Skill name |
| `normalized_name` | text nullable | Standardized matching name |
| `category` | text nullable | Sales, operations, technical, leadership, etc. |
| `description` | text nullable | Plain-language meaning |
| `status` | text | Active, archived |
| `created_at` | timestamptz | Record creation |
| `updated_at` | timestamptz | Last update |

Design notes:

- Skills should not exist only as unsupported keywords.
- Skills should be connected to Evidence Stories and Projects demonstrating them.

---

#### 3.5 `tools`

Represents a platform, technology, framework, or system used by the candidate.

Examples:

- Salesforce
- Supabase
- GitHub
- ChatGPT
- Claude
- Microsoft Graph
- SharePoint
- Jira
- AWS
- Azure

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `name` | text | Tool name |
| `normalized_name` | text nullable | Standardized matching name |
| `category` | text nullable | CRM, AI, cloud, database, project management, etc. |
| `description` | text nullable | Optional context |
| `status` | text | Active, archived |
| `created_at` | timestamptz | Record creation |
| `updated_at` | timestamptz | Last update |

Design notes:

- Experience depth should come from linked evidence, not only from a generic proficiency label.
- A Tool may appear across many Projects and Evidence Stories.

---

#### 3.6 `artifacts`

Represents tangible proof or supporting material associated with Candidate Knowledge.

Examples:

- Demo video
- GitHub repository
- Screenshot
- User guide
- Architecture diagram
- Presentation
- Case study
- LinkedIn post
- PDF
- Project documentation

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `name` | text | Artifact name |
| `artifact_type` | text | Video, screenshot, repo, guide, document, etc. |
| `description` | text nullable | What the artifact demonstrates |
| `url` | text nullable | External URL |
| `storage_path` | text nullable | Internal storage reference |
| `source_system` | text nullable | GitHub, Drive, local upload, etc. |
| `status` | text | Active, archived |
| `created_at` | timestamptz | Record creation |
| `created_by_principal_id` | uuid | Actor that created it |

Design notes:

- Artifacts may support Projects, Evidence Stories, applications, outreach, and interviews.
- Artifact access may later require additional privacy controls depending on storage location.

---

### 3.7 Candidate Knowledge Relationship Tables

Candidate Knowledge contains several many-to-many relationships.

These should use junction tables rather than duplicating lists inside individual records.

---

#### `project_skills`

Links Projects to Skills.

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `project_id` | uuid | Related Project |
| `skill_id` | uuid | Related Skill |
| `evidence_strength` | text nullable | Direct, strong, moderate, inferred |
| `created_at` | timestamptz | Record creation |

---

#### `evidence_story_skills`

Links Evidence Stories to Skills.

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `evidence_story_id` | uuid | Related Evidence Story |
| `skill_id` | uuid | Related Skill |
| `evidence_strength` | text | Direct, adjacent, understanding, inferred |
| `created_at` | timestamptz | Record creation |

This relationship is especially important because it allows the system to answer:

> Which real examples prove that the candidate has this skill?

---

#### `project_tools`

Links Projects to Tools.

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `project_id` | uuid | Related Project |
| `tool_id` | uuid | Related Tool |
| `usage_context` | text nullable | How the tool was used |
| `created_at` | timestamptz | Record creation |

---

#### `evidence_story_tools`

Links Evidence Stories directly to Tools when the tool is part of a specific example.

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `evidence_story_id` | uuid | Related Evidence Story |
| `tool_id` | uuid | Related Tool |
| `usage_context` | text nullable | What the candidate did with the tool |
| `created_at` | timestamptz | Record creation |

---

#### `project_artifacts`

Links Projects to supporting Artifacts.

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `project_id` | uuid | Related Project |
| `artifact_id` | uuid | Related Artifact |
| `relationship_type` | text nullable | Demo, documentation, proof, output, etc. |
| `created_at` | timestamptz | Record creation |

---

#### `evidence_story_artifacts`

Links Evidence Stories to supporting Artifacts.

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `evidence_story_id` | uuid | Related Evidence Story |
| `artifact_id` | uuid | Related Artifact |
| `relationship_type` | text nullable | Proof, supporting document, demonstration |
| `created_at` | timestamptz | Record creation |

---

### 3.8 Candidate Knowledge Validation

Candidate Knowledge should support progressive enrichment without treating every AI interpretation as confirmed truth.

Recommended validation states:

```text
confirmed
candidate_review_needed
inferred
rejected
### 4. Evaluation and Career Gaps Schema

This section defines how the system stores Opportunity Evaluations, Application Gaps, and Career Development Gaps.

The goal is to preserve reasoning over time without overwriting the underlying Opportunity, Company Intelligence, or Candidate Knowledge.

Evaluations should be treated as time-stamped analytical snapshots.

---

#### 4.1 `evaluations`

Represents one assessment of an Opportunity at a specific point in time.

An Opportunity may have multiple Evaluations over time.

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `opportunity_id` | uuid | Related Opportunity |
| `version_number` | integer | Evaluation version |
| `candidate_fit_score` | numeric nullable | You → Them |
| `opportunity_fit_score` | numeric nullable | Them → You |
| `pursuit_score` | numeric nullable | Hidden internal ranking score |
| `opportunity_type` | text nullable | Mutual Fit, Strong Practical Fit, High-Value Stretch, Bridge Opportunity, Low Priority |
| `evidence_confidence` | text nullable | High, medium, low or equivalent |
| `problem_translation` | text nullable | Plain-language explanation of the work/problem |
| `problem_fit_summary` | text nullable | How closely the work resembles problems the candidate has solved |
| `strengths_summary` | text nullable | Strongest reasons to pursue |
| `tradeoffs_summary` | text nullable | Important pros and cons |
| `company_fit_summary` | text nullable | Company/culture assessment |
| `career_optionality_summary` | text nullable | What future access this role may create |
| `required_decision_authority` | text nullable | Level of ownership/authority required |
| `recommended_next_action` | text nullable | Best next step |
| `unresolved_questions` | text nullable | Remaining unknowns |
| `evaluation_status` | text | Draft, complete, superseded |
| `evaluated_at` | timestamptz | Evaluation timestamp |
| `created_by_principal_id` | uuid | Human or agent that created it |
| `created_at` | timestamptz | Record creation |

Design notes:

- Evaluations should not overwrite prior versions.
- A new Evaluation should be created when materially new information changes the assessment.
- The latest Evaluation may be marked current, but earlier versions should remain preserved.
- Scores should remain provisional until calibrated against real candidate reactions.

---

#### 4.2 `evaluation_evidence`

Links an Evaluation to the Candidate Knowledge used to support it.

This provides traceability for why the system reached its conclusions.

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `evaluation_id` | uuid | Related Evaluation |
| `evidence_story_id` | uuid nullable | Related Evidence Story |
| `project_id` | uuid nullable | Related Project |
| `skill_id` | uuid nullable | Related Skill |
| `evidence_role` | text | Strength, gap support, context, comparison |
| `relevance_summary` | text nullable | Why this evidence matters |
| `confidence_level` | text nullable | High, medium, low |
| `created_at` | timestamptz | Record creation |

Design note:

At least one evidence reference should normally exist when the Evaluation makes a material claim about candidate capability.

---

#### 4.3 `evaluation_company_intelligence`

Links an Evaluation to Company Intelligence records used during assessment.

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `evaluation_id` | uuid | Related Evaluation |
| `company_intelligence_id` | uuid | Related Company Intelligence |
| `relevance_summary` | text nullable | Why the intelligence mattered |
| `created_at` | timestamptz | Record creation |

Design note:

This allows the system to later explain:

> “This evaluation used these company signals.”

---

#### 4.4 `application_gaps`

Represents a gap affecting one specific Opportunity.

An Application Gap may be:

- Missing evidence
- Missing terminology
- Adjacent experience
- Positioning issue
- Clarification needed
- One-off employer preference

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `opportunity_id` | uuid | Related Opportunity |
| `evaluation_id` | uuid nullable | Evaluation that identified the gap |
| `skill_id` | uuid nullable | Related Skill |
| `gap_type` | text | Missing evidence, terminology, adjacent experience, employer preference, capability gap |
| `description` | text | Gap description |
| `severity` | text nullable | Low, medium, high |
| `blocking_status` | text nullable | Blocking, non-blocking, unknown |
| `resolution_type` | text nullable | Evidence discovery, clarification, resume positioning, learning, other |
| `resolution_status` | text | Open, investigating, resolved, dismissed |
| `resolution_notes` | text nullable | How it was resolved |
| `created_at` | timestamptz | Record creation |
| `updated_at` | timestamptz | Last update |
| `created_by_principal_id` | uuid | Actor that created it |

Design rule:

An Application Gap should not automatically become a Career Development Gap.

---

#### 4.5 `career_development_gaps`

Represents a recurring or meaningful capability gap that affects future career access.

Examples:

- Repeated lack of enterprise SaaS presales experience
- No direct experience owning final architecture decisions
- Repeated requirement for a specific technical capability
- Missing scale or leadership experience appearing across desirable roles

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `skill_id` | uuid nullable | Related Skill |
| `title` | text | Short gap name |
| `description` | text | Gap description |
| `importance` | text nullable | Low, medium, high |
| `frequency_count` | integer | Number of relevant Opportunities where observed |
| `blocking_status` | text nullable | Blocking, developmental, mixed |
| `development_path` | text nullable | Suggested path to close the gap |
| `status` | text | Active, improving, resolved, archived |
| `first_observed_at` | timestamptz | First observed |
| `last_observed_at` | timestamptz | Most recent observation |
| `created_at` | timestamptz | Record creation |
| `updated_at` | timestamptz | Last update |
| `created_by_principal_id` | uuid | Actor that created it |

---

#### 4.6 `career_gap_opportunities`

Links Career Development Gaps to Opportunities contributing evidence.

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `career_development_gap_id` | uuid | Related Career Development Gap |
| `opportunity_id` | uuid | Related Opportunity |
| `evaluation_id` | uuid nullable | Evaluation that surfaced the gap |
| `importance_in_role` | text nullable | Minor, meaningful, central |
| `notes` | text nullable | Why the gap mattered in this role |
| `created_at` | timestamptz | Record creation |

This allows the system to answer:

> “How often is this gap actually showing up?”

---

### 4.7 Gap Promotion Logic

The system should not promote every missing requirement into a Career Development Gap.

Conceptually:

```text
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
### 5. Application Schema

This section defines how the system stores reusable application templates, opportunity-specific preparation, application materials, application answers, and final submitted application history.

The Application domain should preserve the distinction between:

- Living Candidate Knowledge
- Working application preparation
- Final submitted materials
- Historical submission records

The system should never overwrite the historical record of what was actually submitted.

---

#### 5.1 `application_templates`

Represents a reusable application foundation for a Job Family or closely related role type.

Examples:

- Enterprise Account Executive
- Strategic Solutions Engineer
- Director of Operations
- AI Transformation
- Revenue Operations

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `job_family_id` | uuid nullable | Related Job Family |
| `name` | text | Template name |
| `description` | text nullable | Purpose of template |
| `resume_strategy` | text nullable | Guidance for resume structure and emphasis |
| `cover_letter_strategy` | text nullable | Guidance for cover letter use |
| `outreach_positioning` | text nullable | Typical positioning for this role family |
| `interview_themes` | text nullable | Common interview themes |
| `status` | text | Active, inactive, archived |
| `version_number` | integer | Template version |
| `created_at` | timestamptz | Record creation |
| `updated_at` | timestamptz | Last update |
| `created_by_principal_id` | uuid | Actor that created it |
| `updated_by_principal_id` | uuid nullable | Actor that last updated it |

Design notes:

- Templates should not contain unsupported candidate truth.
- Templates should define structure and retrieval strategy, not become a second Candidate Knowledge Base.
- Templates may evolve over time and should support versioning.

---

#### 5.2 `application_packages`

Represents the working application preparation workspace for one Opportunity.

This is the equivalent of the working RO before finalization.

An Application Package may contain multiple drafts and revisions before anything is submitted.

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `opportunity_id` | uuid | Related Opportunity |
| `application_template_id` | uuid nullable | Template used |
| `evaluation_id` | uuid nullable | Evaluation supporting preparation |
| `status` | text | Draft, preparing, ready for review, approved, archived |
| `candidate_notes` | text nullable | Candidate-specific notes |
| `prepared_by_principal_id` | uuid nullable | Human or agent preparing package |
| `approved_by_principal_id` | uuid nullable | Human approving package |
| `approved_at` | timestamptz nullable | Approval timestamp |
| `created_at` | timestamptz | Record creation |
| `updated_at` | timestamptz | Last update |

Design notes:

- One Opportunity may have multiple Application Packages over time.
- Application Packages may change freely while still in preparation.
- A Package should not be treated as evidence that an application was submitted.

---

#### 5.3 `application_materials`

Represents one specific prepared artifact within an Application Package.

Examples:

- Resume
- Cover letter
- Answer packet
- Project summary
- Portfolio document
- Supporting attachment

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `application_package_id` | uuid | Related Application Package |
| `material_type` | text | Resume, cover letter, answer packet, etc. |
| `version_number` | integer | Version within the package |
| `content_text` | text nullable | Material content when stored as text |
| `file_url` | text nullable | External or storage link |
| `storage_path` | text nullable | File storage reference |
| `source_template_id` | uuid nullable | Related Application Template |
| `status` | text | Draft, candidate review, approved, rejected, submitted |
| `is_current_package_version` | boolean | Current working version |
| `created_at` | timestamptz | Record creation |
| `created_by_principal_id` | uuid | Actor that created it |

Design rule:

Edits should generally create new material versions rather than silently overwriting important prior versions.

---

#### 5.4 `application_material_evidence`

Links prepared Application Materials to Candidate Knowledge.

This allows the system to trace statements in application materials back to validated evidence.

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `application_material_id` | uuid | Related Application Material |
| `evidence_story_id` | uuid nullable | Supporting Evidence Story |
| `project_id` | uuid nullable | Supporting Project |
| `skill_id` | uuid nullable | Supporting Skill |
| `usage_context` | text nullable | How the evidence was used |
| `created_at` | timestamptz | Record creation |

Design note:

This supports questions such as:

> Which Evidence Story produced this resume bullet?

---

#### 5.5 `application_answer_packets`

Represents the structured set of employer application questions and prepared answers associated with one Application Package.

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `application_package_id` | uuid | Related Application Package |
| `status` | text | Draft, review, approved, submitted |
| `created_at` | timestamptz | Record creation |
| `updated_at` | timestamptz | Last update |
| `created_by_principal_id` | uuid | Actor that created it |

---

#### 5.6 `application_answers`

Represents one employer application question and its prepared or final answer.

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `application_answer_packet_id` | uuid | Related Answer Packet |
| `question_order` | integer nullable | Order shown by employer |
| `question_text` | text | Exact question |
| `question_type` | text nullable | Text, yes/no, multiple choice, numeric, etc. |
| `draft_answer` | text nullable | Prepared answer |
| `final_answer` | text nullable | Final approved answer |
| `confidence_level` | text nullable | High, medium, low |
| `requires_candidate_input` | boolean | Whether candidate judgment is needed |
| `requires_candidate_approval` | boolean | Whether approval is required |
| `approval_status` | text nullable | Pending, approved, rejected |
| `created_at` | timestamptz | Record creation |
| `updated_at` | timestamptz | Last update |

Design rule:

The system must not invent unsupported responses.

Unknown or materially sensitive questions should remain unresolved until candidate input is provided.

---

#### 5.7 `application_answer_evidence`

Links an application answer to Candidate Knowledge supporting that answer.

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `application_answer_id` | uuid | Related answer |
| `evidence_story_id` | uuid nullable | Supporting Evidence Story |
| `project_id` | uuid nullable | Supporting Project |
| `skill_id` | uuid nullable | Supporting Skill |
| `relevance_summary` | text nullable | Why the evidence supports the answer |
| `created_at` | timestamptz | Record creation |

---

#### 5.8 `applications`

Represents one actual submission attempt for an Opportunity.

This is the equivalent of the finalized RO.

An Application should preserve what actually happened, not what was merely prepared.

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `opportunity_id` | uuid | Related Opportunity |
| `application_package_id` | uuid nullable | Package used for submission |
| `application_stage` | text | Preparing, ready to submit, submitted, confirmed, withdrawn |
| `submission_method` | text nullable | ATS, email, recruiter, referral, etc. |
| `application_url` | text nullable | Submission or ATS URL |
| `submitted_at` | timestamptz nullable | Submission time |
| `confirmed_at` | timestamptz nullable | Confirmation time |
| `submitted_by_principal_id` | uuid nullable | Human or agent that submitted |
| `approved_by_principal_id` | uuid nullable | Human approving submission |
| `confirmation_type` | text nullable | Email, ATS page, recruiter confirmation |
| `confirmation_reference` | text nullable | Link or source reference |
| `notes` | text nullable | Submission notes |
| `created_at` | timestamptz | Record creation |
| `updated_at` | timestamptz | Last update |

Design notes:

- One Opportunity may have zero, one, or multiple Applications over time.
- A new Application should be created for a materially new submission attempt.
- Submitted Applications should be treated as historical records.

---

#### 5.9 `application_submitted_materials`

Represents the exact material versions included in a specific Application submission.

This table creates the immutable historical snapshot.

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `application_id` | uuid | Related Application |
| `application_material_id` | uuid | Exact submitted material version |
| `material_type` | text | Resume, cover letter, etc. |
| `submitted_at` | timestamptz | Submission timestamp |
| `created_at` | timestamptz | Record creation |

Design rule:

Once a material is recorded as submitted for an Application, the relationship should not be silently changed.

Future improvements to Candidate Knowledge or newer material versions should not alter this historical record.

---

### 5.10 Working Package vs. Submitted Application

Conceptually:

```text
Candidate Knowledge
        ↓
Application Template
        ↓
Application Package
        ↓
Working Material Versions
        ↓
Candidate Approval
        ↓
Application Submitted
        ↓
Submitted Material Snapshot
### 6. Outreach and Relationship Schema

This section defines how the system stores professional relationships, outreach efforts, message history, and follow-up state.

Outreach should be modeled independently from Applications because professional relationships may begin before an application, continue after an application closes, or exist without any specific Opportunity at all.

The system should preserve durable relationship history so future Outreach Agents can use shared system records rather than private conversational memory.

---

#### 6.1 `outreach_engagements`

Represents an ongoing relationship-building effort with a Contact.

An Outreach Engagement may relate to:

- One specific Opportunity
- A Company
- Multiple Opportunities over time
- General networking or relationship development

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `contact_id` | uuid | Related Contact |
| `company_id` | uuid nullable | Related Company |
| `opportunity_id` | uuid nullable | Related Opportunity when applicable |
| `goal` | text nullable | Why the relationship is being developed |
| `relationship_context` | text nullable | Existing history or connection |
| `relationship_state` | text nullable | Cold, warm, known, active, dormant, etc. |
| `outreach_state` | text | Not Started, Target Identified, Warming, Message Ready, Contacted, Engaged, Waiting, Closed |
| `last_meaningful_interaction_at` | timestamptz nullable | Last meaningful interaction |
| `next_follow_up_at` | timestamptz nullable | Planned next follow-up |
| `status` | text | Active, dormant, closed, archived |
| `created_at` | timestamptz | Record creation |
| `updated_at` | timestamptz | Last update |
| `created_by_principal_id` | uuid | Actor that created it |
| `updated_by_principal_id` | uuid nullable | Actor that last updated it |

Design notes:

- `opportunity_id` should remain optional.
- A professional relationship may remain useful after an Opportunity closes.
- The Engagement should preserve the broader relationship context, not only one message sequence.

---

#### 6.2 `outreach_messages`

Represents one communication or proposed communication within an Outreach Engagement.

Examples:

- LinkedIn connection request
- LinkedIn direct message
- Email
- Recruiter response
- Referral request
- Follow-up
- Thank-you message

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `outreach_engagement_id` | uuid | Related Outreach Engagement |
| `contact_id` | uuid | Related Contact |
| `opportunity_id` | uuid nullable | Related Opportunity when applicable |
| `channel` | text | LinkedIn, email, phone, SMS, other |
| `direction` | text | Inbound or outbound |
| `purpose` | text nullable | Intro, referral, follow-up, thank-you, recruiter response, etc. |
| `content` | text | Exact message content |
| `version_number` | integer nullable | Draft version |
| `message_status` | text | Draft, review, approved, sent, received, rejected, archived |
| `approval_status` | text nullable | Pending, approved, rejected |
| `prepared_by_principal_id` | uuid nullable | Human or agent that drafted |
| `approved_by_principal_id` | uuid nullable | Human approving message |
| `sent_by_principal_id` | uuid nullable | Human or agent that sent |
| `sent_at` | timestamptz nullable | Send timestamp |
| `received_at` | timestamptz nullable | Receive timestamp |
| `response_status` | text nullable | None, waiting, responded |
| `response_at` | timestamptz nullable | Response timestamp |
| `external_reference` | text nullable | Email ID, message URL, thread ID, etc. |
| `created_at` | timestamptz | Record creation |

Design rule:

The exact sent version must be preserved.

Drafts and revisions should not replace the historical message that was actually sent.

---

#### 6.3 `outreach_message_evidence`

Links an Outreach Message to Candidate Knowledge used in the communication.

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `outreach_message_id` | uuid | Related Outreach Message |
| `evidence_story_id` | uuid nullable | Supporting Evidence Story |
| `project_id` | uuid nullable | Supporting Project |
| `skill_id` | uuid nullable | Supporting Skill |
| `usage_context` | text nullable | Why the evidence was selected |
| `created_at` | timestamptz | Record creation |

This allows the system to understand:

> Which professional experience did we use when positioning the candidate to this Contact?

---

#### 6.4 `outreach_interactions`

Represents meaningful relationship activity that may not be a direct message.

Examples:

- Followed Contact
- Connection request sent
- Connection accepted
- Candidate commented on a post
- Contact viewed profile
- Contact referred candidate
- Candidate met Contact at an event
- Phone conversation
- Introduction made by another person

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `outreach_engagement_id` | uuid | Related Engagement |
| `contact_id` | uuid | Related Contact |
| `opportunity_id` | uuid nullable | Related Opportunity |
| `interaction_type` | text | Follow, connect, comment, call, referral, meeting, etc. |
| `summary` | text nullable | What happened |
| `occurred_at` | timestamptz | Interaction timestamp |
| `source_system` | text nullable | LinkedIn, Gmail, phone, event, etc. |
| `source_reference` | text nullable | External reference |
| `created_by_principal_id` | uuid | Actor that recorded it |
| `created_at` | timestamptz | Record creation |

Design notes:

- Relationship building is broader than direct messaging.
- These interactions may contribute to relationship state and follow-up timing.

---

#### 6.5 `relationship_notes`

Represents durable context about a Contact or relationship that should remain useful across future Opportunities.

Examples:

- Former consultant from Levo
- Has Salesforce connections
- Previously offered business-startup advice
- Candidate met at an AI meetup
- Recruiter prefers email
- Contact mentioned upcoming travel

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `contact_id` | uuid | Related Contact |
| `outreach_engagement_id` | uuid nullable | Related Engagement |
| `note_type` | text nullable | Relationship, preference, history, context |
| `note_text` | text | Durable relationship note |
| `validation_status` | text | Confirmed, inferred, candidate review needed |
| `created_by_principal_id` | uuid | Actor that created it |
| `created_at` | timestamptz | Record creation |
| `updated_at` | timestamptz | Last update |

Design rule:

Relationship notes should contain professional context relevant to the job-search workflow.

Unrelated personal information should not automatically become part of the relationship record.

---

### 6.6 Outreach Follow-Up

Follow-up timing should generally be managed through Internal Tasks rather than creating a separate scheduling system inside Outreach.

Conceptually:

```text
Outreach Message sent
        ↓
Activity Event
        ↓
Internal Task
"Wait 4 days"
        ↓
No candidate action during wait
        ↓
Response arrives?
     /       \
   Yes       No
    ↓         ↓
Resolve    Create follow-up
Task       Next Action
### 7. Interview Schema

This section defines how the system stores employer interview processes, individual interview events, interviewer relationships, preparation, debriefs, and follow-up.

Interview data should remain structured enough to support a future Interview Agent while preserving the candidate-facing experience as one coherent Opportunity history.

---

#### 7.1 `interview_processes`

Represents the employer's overall interview or hiring process for one Opportunity.

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `opportunity_id` | uuid | Related Opportunity |
| `status` | text | Active, paused, completed, closed |
| `current_stage` | text nullable | Current interview stage |
| `known_process_structure` | text nullable | Known employer process |
| `recruiter_contact_id` | uuid nullable | Recruiter or coordinator |
| `started_at` | timestamptz nullable | Process start |
| `completed_at` | timestamptz nullable | Process completion |
| `candidate_notes` | text nullable | Candidate notes |
| `created_at` | timestamptz | Record creation |
| `updated_at` | timestamptz | Last update |
| `created_by_principal_id` | uuid | Actor that created it |
| `updated_by_principal_id` | uuid nullable | Actor that last updated it |

Design notes:

- One Opportunity may have zero or one active Interview Process at a time.
- Historical completed interview processes should be preserved.

---

#### 7.2 `interviews`

Represents one specific interview, assessment, case study, or employer meeting.

Examples:

- Recruiter screen
- Hiring manager interview
- Technical interview
- Case study
- Panel
- Executive interview
- Final interview

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `interview_process_id` | uuid | Related Interview Process |
| `opportunity_id` | uuid | Related Opportunity |
| `interview_type` | text | Recruiter screen, panel, case study, etc. |
| `stage_name` | text nullable | Employer-specific stage name |
| `scheduled_start_at` | timestamptz nullable | Start time |
| `scheduled_end_at` | timestamptz nullable | End time |
| `duration_minutes` | integer nullable | Planned duration |
| `format` | text nullable | Video, phone, onsite, take-home, etc. |
| `meeting_url` | text nullable | Meeting link |
| `location_text` | text nullable | Physical location |
| `calendar_event_id` | text nullable | External Calendar event reference |
| `instructions` | text nullable | Employer instructions |
| `preparation_status` | text | Not started, preparing, ready, completed |
| `interview_status` | text | Scheduled, completed, cancelled, rescheduled, no-show |
| `outcome` | text nullable | Advanced, rejected, pending, unknown |
| `candidate_notes` | text nullable | Candidate notes |
| `created_at` | timestamptz | Record creation |
| `updated_at` | timestamptz | Last update |
| `created_by_principal_id` | uuid | Actor that created it |

---

#### 7.3 `interview_contacts`

Represents the many-to-many relationship between Interviews and Contacts.

One Interview may involve several interviewers.

One Contact may participate in multiple Interviews.

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `interview_id` | uuid | Related Interview |
| `contact_id` | uuid | Related Contact |
| `interviewer_role` | text nullable | Hiring manager, recruiter, panelist, executive, etc. |
| `is_primary` | boolean | Primary interviewer when known |
| `created_at` | timestamptz | Record creation |

---

#### 7.4 `interview_preparations`

Represents the structured preparation package for one Interview.

Preparation should be generated from:

- Opportunity
- Latest Evaluation
- Candidate Knowledge
- Company Intelligence
- Known interviewers
- Prior interviews in the same process

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `interview_id` | uuid | Related Interview |
| `evaluation_id` | uuid nullable | Evaluation used |
| `summary` | text nullable | Concise interview brief |
| `what_they_are_likely_evaluating` | text nullable | Plain-language interpretation |
| `company_context` | text nullable | Relevant current company context |
| `known_risks` | text nullable | Gaps or likely challenge areas |
| `candidate_questions` | text nullable | Suggested questions to ask |
| `status` | text | Draft, ready, reviewed, completed |
| `prepared_by_principal_id` | uuid nullable | Human or agent |
| `created_at` | timestamptz | Record creation |
| `updated_at` | timestamptz | Last update |

---

#### 7.5 `interview_questions`

Represents likely or actual interview questions.

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `interview_id` | uuid | Related Interview |
| `interview_preparation_id` | uuid nullable | Related prep package |
| `question_text` | text | Question |
| `question_source` | text | Predicted, actual, prior interview, employer-provided |
| `question_category` | text nullable | Behavioral, technical, leadership, sales, etc. |
| `what_they_are_evaluating` | text nullable | Underlying capability |
| `priority` | text nullable | High, medium, low |
| `created_at` | timestamptz | Record creation |

Design note:

Predicted questions and actual questions should remain distinguishable.

---

#### 7.6 `interview_question_evidence`

Links interview questions to Candidate Knowledge recommended for answering them.

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `interview_question_id` | uuid | Related question |
| `evidence_story_id` | uuid nullable | Recommended Evidence Story |
| `project_id` | uuid nullable | Related Project |
| `skill_id` | uuid nullable | Related Skill |
| `relevance_summary` | text nullable | Why this evidence fits |
| `priority_rank` | integer nullable | Preferred evidence order |
| `created_at` | timestamptz | Record creation |

This allows the system to answer:

> Which real story should the candidate use for this question?

---

#### 7.7 `interview_debriefs`

Represents the candidate's post-interview debrief.

The debrief should capture useful intelligence while the interview is still fresh.

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | Owning Workspace |
| `interview_id` | uuid | Related Interview |
| `candidate_summary` | text nullable | How the conversation went |
| `questions_asked` | text nullable | Actual questions asked |
| `important_information_learned` | text nullable | New role/company context |
| `positive_signals` | text nullable | Positive signals |
| `concerns` | text nullable | Concerns or risks |
| `new_requirements` | text nullable | Requirements learned during interview |
| `follow_up_commitments` | text nullable | Promises or next actions |
| `evidence_that_worked` | text nullable | Candidate stories that landed well |
| `evidence_gaps_discovered` | text nullable | Missing evidence exposed |
| `candidate_interest_change` | text nullable | Increased, decreased, unchanged |
| `created_at` | timestamptz | Record creation |
| `created_by_principal_id` | uuid | Actor creating debrief |

---

### 7.8 Debrief Feedback Loop

Interview debriefs may update other parts of the system.

Conceptually:

```text
Interview completed
      ↓
Debrief
      ↓
      ├── Evaluation
      ├── Candidate Knowledge
      ├── Company Intelligence
      ├── Application Gaps
      ├── Career Development Gaps
      ├── Outreach context
      └── Future interview preparation
### 8. Workflow and Activity Schema

This section defines the workflow engine beneath the candidate-facing Activity Feed and Daily Work Queue.

The system should separate:

- What happened
- What the system needs to do
- What the candidate needs to do
- What an agent attempted
- What external action was actually performed
- What the candidate saw in the Daily Work Queue

The candidate should not be required to manually maintain backend workflow state.

---

## 8.1 Workflow Model

The core workflow pattern is:

```text
Something happens
        ↓
Activity Event
        ↓
Internal workflow decision
        ↓
Internal Task created or updated
        ↓
Does a human need to act?
       /   \
     No     Yes
     ↓       ↓
Continue   Next Action
in system      ↓
           Candidate acts
                ↓
         New Activity Event
                ↓
        Workflow continues
