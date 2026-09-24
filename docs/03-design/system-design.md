Job Search AI Agent

System Design

This document defines the intended architecture of the Job Search AI Agent.

It describes how the major system components should work together, where authoritative state should live, how humans and AI agents should interact with the system, how historical records should be preserved, and how V1 can remain intentionally smaller than the long-term architecture.

The system should optimize for candidate attention rather than activity volume.

1. System Components

1.1 Opportunity Activity Feed

Each Opportunity should have one primary chronological Activity Feed representing the complete history of the candidate's relationship with that Opportunity.

The feed may contain events related to:

Discovery

Research

Evaluation

Candidate Knowledge and evidence

Application preparation

Application submission

Outreach

Employer communication

Interviews

Follow-up

System actions

Human notes

Agent actions

The system should not require separate conversation threads for each workstream.

Instead, individual Activity Events may support shallow replies so the candidate and agents can discuss or resolve a specific item without breaking the continuity of the Opportunity history.

Structured objects such as Applications, Evaluations, Contacts, Outreach Engagements, Interview records, Internal Tasks, Next Actions, and External Actions remain separate records in the data model. Relevant activity from those objects may be surfaced into the shared Opportunity Activity Feed.

The Activity Feed is a collaboration and history surface. It is not the primary workflow engine.

1.2 Shared Agent Foundation

The architecture should support future specialized agents without requiring V1 to implement a full multi-agent system.

Potential future agents include:

Opportunity Discovery Agent

Evaluation Agent

Company Intelligence Agent

Application Agent

Outreach Agent

Interview Agent

Career Development Agent

Safety and Verification Agent

Agents should coordinate through shared structured records, Internal Tasks, Activity Events, permissions, and workflow state rather than through private agent memory.

V1 may use one orchestrating AI workflow while preserving a data model that allows specialized agents to be added later.

1.3 Identity, Workspace, and Access-Control Foundation

The Workspace is the primary tenancy boundary.

Every major business record should belong to a Workspace.

Humans and AI agents should participate in the system as governed actors called Principals.

Conceptually:

Principal
├── Human User
├── AI Agent
└── Trusted System Actor

A Principal may belong to one or more Workspaces through Workspace Membership.

Workspace Membership should assign a Role.

Roles should grant Permissions.

Conceptually:

authenticated identity
        ↓
Principal
        ↓
Workspace Membership
        ↓
Role
        ↓
Permissions

This shared access model should govern humans and agents rather than giving agents unrestricted backend access.

Examples of permissions may include:

opportunity.read
opportunity.update
candidate_knowledge.read
candidate_knowledge.write
evaluation.create
application.prepare
application.submit
outreach.draft
outreach.send
interview.prepare
email.read
email.send
calendar.read
calendar.write

External actions such as sending, submitting, or scheduling should use separate permissions from internal preparation actions.

Normal agent activity should be subject to the same Workspace and permission boundaries as human activity.

Unrestricted service-role access should be reserved for narrowly defined trusted backend operations where bypassing RLS is intentional.

1.4 Workflow Layers

The system should distinguish four different workflow concepts.

Activity Event

Answers:

What happened?

Activity Events preserve history.

Examples:

Job discovered

Evaluation completed

Application submitted

Recruiter replied

Interview scheduled

Internal Task

Answers:

What does the system need to do?

Internal Tasks support orchestration, waiting states, retries, dependencies, scheduling, ownership, and future agent coordination.

Tasks exist primarily for the machine.

Next Action

Answers:

What does the candidate need to do?

Next Actions are simplified human-facing actions derived from workflow state.

Examples:

Review application package

Approve outreach draft

Answer one evidence question

Reply to recruiter

Prepare for interview

Next Actions exist primarily for the candidate.

External Action

Answers:

What real-world side effect is the system about to perform?

Examples:

Send an email

Submit an application

Send a LinkedIn message

Create a Calendar event

Apply a Gmail label

External Actions require stronger execution controls than ordinary Internal Tasks.

Before an External Action executes, the system should verify:

Database permission
+
Automation policy
+
Required approval
+
Safety conditions
=
External action allowed

Successful External Actions should preserve the exact executed payload and result as historical records.

1.5 Candidate Experience Principle

The backend may contain many Tasks, retries, agent actions, waiting conditions, and system records.

The candidate should not have to manage that complexity.

The candidate should primarily understand:

What changed

Why it matters

What the system already handled

What needs attention now

What should happen next

The system should absorb workflow complexity and surface attention.

2. Data and System of Record

Supabase will serve as the primary structured system of record for the Job Search AI Agent.

The system should store structured information about:

Access and Governance

Workspaces

Principals

Workspace Memberships

Roles

Permissions

Candidate Settings

Automation Policies

Opportunity Domain

Companies

Company Intelligence

Job Families

Opportunities

Opportunity Sources

Contacts

Opportunity-Contact relationships

Opportunity Evaluations

Application Gaps

Career Development Gaps

Candidate Knowledge Domain

Work Experiences

Projects

Evidence Stories

Skills

Tools and Technologies

Artifacts

Relationships connecting those records

Application Domain

Application Templates

Application Packages

Application Materials

Application Answer Packets

Applications

Submitted Material history

Submitted Answer history

Outreach Domain

Outreach Engagements

Outreach-Opportunity relationships

Outreach Messages

Outreach Interactions

Relationship Notes

Interview Domain

Interview Processes

Interviews

Interview Contacts

Interview Preparations

Interview Questions

Interview Debriefs

Interview Follow-ups

Workflow Domain

Activity Events

Activity Replies

Internal Tasks

Task Dependencies

Task Attempts

Next Actions

External Actions

Workflow Runs

Daily Plans

Work Blocks

Daily Plan Items

External systems such as Gmail, LinkedIn, Indeed, company career sites, ATS platforms, and Google Calendar remain sources of information or destinations for actions.

Supabase maintains the structured state needed to understand how external information relates to each Company, Opportunity, Contact, Application, relationship, interview, and workflow.

Large source files or unnecessary copies of external content should not be stored when a structured record, source reference, artifact reference, or external URL is sufficient.

2.1 Workspace Ownership and RLS Boundary

Every major tenant-owned record should contain an explicit workspace_id.

This supports:

Consistent RLS

Debugging

Query performance

Auditability

Future multi-tenant use

RLS should primarily answer:

Who is making the request?

Which Workspace owns the record?

Is that Principal an active member of the Workspace?

Does the Principal have the required Permission?

Permission logic should be centralized in reusable database access helpers where practical rather than duplicated independently across every table policy.

Conceptual helpers may include:

can_access_workspace(workspace_id)
has_permission(workspace_id, permission_key)

RLS should not be the only tenant-isolation safeguard.

Relationships between tenant-owned tables should also prevent cross-Workspace references at the relational level.

Conceptually, a child record should not be able to claim one workspace_id while pointing to a parent record in another Workspace.

The schema should therefore support Workspace-safe foreign-key relationships where appropriate.

2.2 Core Opportunity Data Model

The system should separate the real-world Company and Opportunity from the external sources through which the Opportunity was discovered.

Company

Represents the employer.

Example:

Mor Furniture For Less

A Company record should contain relatively stable company information.

Time-sensitive research should be stored separately as Company Intelligence.

Relationships:

One Company may have many Opportunities.

One Company may have many Contacts.

One Company may have many Company Intelligence records over time.

One Company may have Outreach Engagements that are not tied to a specific Opportunity.

Company Intelligence

Represents time-sensitive research and observations about a Company that may be reused across multiple Opportunities.

Company Intelligence may include:

Recent company news

Hiring patterns

Leadership changes

Layoffs or growth signals

Funding, acquisitions, or expansion

Product or strategic changes

Employee-review themes

Relevant LinkedIn activity

Customer or market signals

Inferences about current company priorities

Sources supporting each observation

Research date and freshness

The Company describes who the employer is.

Company Intelligence describes what appears to be happening at the employer over time.

Job Family

Represents a reusable role type or closely related group of roles across Companies.

Examples:

Strategic Solutions Engineer

Enterprise Account Executive

Director of Operations

AI Transformation

Revenue Operations

A Job Family allows role-specific knowledge to be reused without treating separate job openings as the same Opportunity.

Relationships:

One Job Family may relate to many Opportunities.

One Job Family may have one or more Application Templates.

One Job Family may accumulate recurring requirements, terminology, interview themes, and Career Development signals.

Opportunity

Represents one specific hiring event at one specific Company.

Example:

Mor Furniture For Less
AI Solutions Manager
September 2026 hiring event

The Opportunity should contain factual information about the specific opening, such as:

Company

Job title

Job Family

Requisition identifier when available

Location

Work arrangement

Compensation

Employment type

Canonical job description

Canonical job URL

Current Opportunity Stage

Date discovered

Date last verified

Posting date

Closing date when known

Current availability

A role title is not an Opportunity forever.

If the same or similar role appears again months later, the system should determine whether it is:

The same posting still active

The same requisition reopened

A repost of the previous hiring event

A genuinely new hiring event

When it is a new hiring event, the system should create a new Opportunity while preserving and optionally linking the earlier Opportunity.

This allows historical application and relationship context to be reused without rewriting the past.

Opportunity Source

Represents a place where an Opportunity was found, observed, or verified.

Examples:

Indeed alert

LinkedIn posting

Employer careers page

Recruiter email

Referral

Multiple sources for the same real-world opening should enrich one Opportunity rather than create duplicate Opportunities.

Different sources may contribute different information.

For example:

Salary from Indeed

Full job description from the employer careers page

Hiring-manager context from LinkedIn

Confirmation that the role is active from a recruiter

Contact

Represents an individual professional contact.

Examples:

Recruiter

Hiring manager

Functional leader

Employee publicly posting about hiring

Referral or warm connection

Former colleague

Networking contact

A Contact should exist independently from a single Opportunity.

One Contact may be relevant to multiple Opportunities over time.

The relationship between a Contact and Opportunity should be modeled separately so the same Contact may serve different roles for different Opportunities.

2.3 Opportunity Evaluation

An Opportunity Evaluation represents the system's assessment of an Opportunity at a specific point in time.

Evaluations should remain separate from Opportunities so changes in Candidate Knowledge, Company Intelligence, or job information do not overwrite previous reasoning.

An Evaluation may include:

Candidate Fit: You → Them

Opportunity Fit: Them → You

Hidden Pursuit Score

Opportunity type

Evidence confidence

Plain-language problem translation

Problem Fit

Qualification or Application Gaps

Career Development signals

Company and culture signals

Required decision authority

Important tradeoffs

Recommended next action

Unresolved questions

Evidence and sources used

Evaluation date and version

One Opportunity may have multiple Evaluations over time.

A materially changed assessment should create a new Evaluation rather than overwrite the previous one.

The Opportunity describes what the job is.

The Evaluation describes what the system believed about that job at that point in time and why.

2.4 Candidate Knowledge Base

The Candidate Knowledge Base is the system's structured source of truth for the candidate's professional history, projects, capabilities, tools, accomplishments, artifacts, and validated evidence.

A resume is an output of Candidate Knowledge, not the primary source of truth.

Core Candidate Knowledge entities include:

Work Experience

Represents a role, contract, company, client engagement, or substantial work period.

May include:

Employer or client

Role title

Employment type

Dates

Responsibilities

Scope

Promotions

Team context

Systems owned

Major outcomes

Related Projects

Related Evidence Stories

Project

Represents a substantial body of work.

A Project may include:

Project name

Summary

Problem being solved

Users or stakeholders

Candidate role

Responsibilities

Architecture or system description

Tools and technologies

Skills demonstrated

Scale or complexity

Outcomes

Quantitative results

Status

Related Work Experience

Related Evidence Stories

Related Artifacts

Links

Candidate notes

Evidence Story

Represents a specific example showing how the candidate handled a problem, decision, interaction, project, or outcome.

An Evidence Story may contain:

Situation or problem

Candidate role

Actions taken

Stakeholders

Tools used

Outcome

Quantitative impact

Professional translation

Skills demonstrated

Evidence type

Validation status

Source

Evidence types may include:

Direct experience

Adjacent experience

Demonstrated understanding

Reasonable inference

Unknown

The system must distinguish what the candidate actually did from professional terminology inferred from that work.

Professional translation should not overwrite the original evidence.

Skill or Capability

Represents a reusable professional capability supported by Projects and Evidence Stories.

Skills should not exist only as unsupported keywords.

Tool or Technology

Represents a platform, technology, framework, or system used by the candidate.

Experience depth should come from linked evidence rather than a generic unsupported proficiency label.

Artifact

Represents tangible supporting proof.

Examples:

Demo video

GitHub repository

Screenshot

User guide

Architecture diagram

Presentation

Case study

LinkedIn post

Documentation

Candidate Knowledge should feed:

Candidate Knowledge
      ↓
      ├── Opportunity Evaluation
      ├── Application Preparation
      ├── Outreach
      ├── Interview Preparation
      └── Career Gap Analysis

Downstream outputs should reference Candidate Knowledge rather than becoming independent sources of candidate truth.

2.5 Career Gaps

The system should distinguish between Application Gaps and Career Development Gaps.

Application Gap

Represents something affecting one specific Opportunity that may be solvable through:

Better evidence

Terminology translation

Positioning

Clarification

Opportunity-specific preparation

Career Development Gap

Represents a recurring or meaningful capability gap that may require:

Learning

Practice

Certification

Project experience

Future job experience

A gap identified during one Opportunity should not automatically become a Career Development Gap.

The system should first determine whether the issue is:

Missing evidence

Missing terminology

Adjacent experience

A one-off employer preference

A recurring capability gap

Only meaningful recurring gaps should be promoted into the Career Development Gap Library.

Design principle:

Missing evidence is not the same as missing ability.

2.6 Application Domain

The Application domain should distinguish reusable templates, working preparation, and historical submission records.

Application Template

Represents a reusable application foundation for a Job Family.

Templates may define:

Preferred resume structure

Standard formatting

Relevant Candidate Knowledge categories

Typical skills and terminology

Common application-question patterns

Likely qualification gaps

Common interview themes

Typical outreach positioning

Templates should pull from validated Candidate Knowledge rather than becoming an independent source of candidate truth.

Application Package

Represents the working preparation workspace for one Opportunity.

The Application Package is mutable while being prepared.

It may contain:

Resume drafts

Cover letter drafts

Answer packets

Supporting documents

Candidate notes

Review status

Approval status

The Application Package is the equivalent of a working service record before finalization.

Application Material

Represents a specific version of a prepared artifact.

Examples:

Resume

Cover letter

Answer packet

Project summary

Portfolio document

Supporting attachment

Important edits should generally create new versions rather than silently overwrite prior material versions.

Application

Represents an actual submission attempt.

The Application should represent what actually happened, not what was merely prepared.

The Application is the historical record equivalent of the finalized service record.

Application preparation states belong primarily to the Application Package.

The Application begins when a real submission attempt occurs and may record states such as:

Submission in progress

Submitted

Confirmed

Submission failed

Withdrawn

The system should preserve:

Exact submitted material versions

Exact submitted application answers

Submission method

Submission timestamp

Who approved the submission

Who performed the submission

Confirmation evidence

Later improvements to Candidate Knowledge, templates, materials, or answers must not rewrite what was historically submitted.

Conceptually:

Candidate Knowledge
        ↓
Application Template
        ↓
Application Package
        ↓
Working versions
        ↓
Approval
        ↓
Application submission
        ↓
Historical submission snapshot

2.7 Outreach and Relationship Management

Outreach should be modeled as a reusable relationship domain rather than only as tasks attached to individual Opportunities.

Outreach Engagement

Represents an ongoing relationship-building effort with a Contact.

An Outreach Engagement may relate to:

A Contact

A Company

No specific Opportunity

One Opportunity

Multiple Opportunities over time

Because one professional relationship may become relevant to several Opportunities, Opportunity relationships should be modeled separately from the Engagement rather than assuming one opportunity_id permanently defines the relationship.

For example:

Jason Boomer
      ↓
Outreach Engagement
      ├── General Salesforce networking
      ├── Opportunity A
      └── Opportunity B

Outreach Message

Represents one communication or proposed communication.

The system should preserve:

Exact message content

Draft version

Approval state

Who prepared it

Who approved it

Who sent it

Send timestamp

Response state

External reference

The exact sent version should be historical and should not be overwritten by later drafts.

Outreach History and Reuse

Future outreach generation should retrieve relevant prior communications from shared system records.

Relevant context may include:

Previous messages with the same Contact

Previous communications with the same Company

Similar outreach situations

Candidate-approved messages

Successful outreach patterns

Candidate writing preferences

Relationship history

Opportunity context

Candidate Knowledge

Company Intelligence

Historical outreach is context, not text to copy blindly.

2.8 Interview Management

Interview activity should be modeled as structured workflow associated with an Opportunity.

Interview Process

Represents the employer's hiring process for one Opportunity.

It may include:

Current interview stage

Recruiter or coordinator

Known interview stages

Expected process structure

Scheduling status

Candidate notes

Start and completion dates

Interview

Represents one specific interview, assessment, case study, or hiring interaction.

Examples:

Recruiter screen

Hiring manager interview

Technical or functional interview

Case study

Panel

Executive interview

Final interview

Interview Preparation

Preparation should use:

Opportunity

Current Evaluation

Candidate Knowledge

Company Intelligence

Known interviewer context

Prior interview activity in the same process

Preparation may include:

What the interviewer is likely evaluating

Relevant Evidence Stories

Likely questions

Candidate talking points

Candidate questions

Known gaps or risks

Company context

Role terminology

The system should prioritize useful talking points rather than forcing rigid scripts.

Interview Debrief

The system should capture a lightweight post-interview debrief while information is fresh.

The debrief may produce new information for:

Evaluation

Candidate Knowledge

Company Intelligence

Career Gaps

Outreach context

Future interview preparation

An interview is both a hiring event and a source of system learning.

2.9 Workflow and Historical State

The system should intentionally distinguish living or mutable state from historical snapshots.

Examples of living or mutable state:

Candidate Knowledge

Current Opportunity state

Internal Tasks

Next Actions

Current Outreach state

Current Company Intelligence relevance

Examples of historical records:

Evaluation versions

Activity Events

Submitted application materials

Submitted application answers

Sent outreach messages

Completed interviews and debriefs

Successful External Actions

Task Attempts

Daily Plan snapshots

Historical records should not be silently rewritten to make them match current state.

2.10 Candidate Settings and Automation Policies

Candidate Settings should be stored as structured configuration rather than scattered hard-coded assumptions.

Settings may include:

Location preferences

Approved relocation areas

Compensation preferences

Work-arrangement preferences

Travel preferences

Search strategy mode

Work-block preferences

Daily Opportunity Target

Notification preferences

Candidate communication preferences

Preference strength may use:

Hard No

Strong Preference

Open to It

Neutral

Nice Bonus

Automation Policies should be stored separately from general candidate preferences.

Automation Policies should define what classes of action the system may perform and what approval is required.

Example levels:

Prepare Only

Approve Before Action

Act Within Rules

Autonomous

Permissions determine whether a Principal has technical authority to perform an action.

Automation Policies determine whether the candidate has authorized that action under the current rules.

The system must never grant itself additional autonomy.

3. Opportunity Lifecycle

An Opportunity represents one specific hiring event at one specific Company.

The system should not force application activity, outreach activity, interview activity, and overall Opportunity state into one status field.

Instead, these workflows should progress independently while remaining connected.

3.1 Opportunity Stage

Opportunity Stage represents the overall relationship with the job.

Recommended stages:

Discovered

Opportunity has been found.

Verified

The system has confirmed the Opportunity is sufficiently real/current and has addressed obvious duplicate risk.

Evaluating

The system is translating the job, researching context, retrieving Candidate Knowledge, and identifying gaps.

Pursuing

The candidate has decided the Opportunity is worth active effort.

Interviewing

The candidate has entered the employer's formal interview, assessment, or hiring process.

Offer

A formal or verbal offer has been received.

Closed

The Opportunity is no longer being actively pursued.

Closed reason should remain separate, for example:

Rejected

Withdrawn

Role Closed

No Response

Accepted Elsewhere

Other

3.2 Application Workflow State

Application preparation and actual Application history should remain distinct underneath the interface.

Candidate-facing application state may be derived from both the Application Package and Application records.

Conceptually:

No package
→ Preparing
→ Ready for Review
→ Approved
→ Submission in Progress
→ Submitted
→ Confirmed

The working states belong primarily to the Application Package.

Historical submission states belong to the Application.

3.3 Outreach State

Recommended states may include:

Not Started

Target Identified

Warming

Message Ready

Contacted

Engaged

Waiting

Closed

Outreach may occur before or after application submission.

3.4 Interview Stage

Interview Stage should be managed within the Interview Process and may vary by employer.

Examples:

Recruiter Screen

Hiring Manager

Technical or Functional Interview

Case Study

Panel

Executive or Final

The system should preserve the employer's actual process rather than forcing every Company into the same sequence.

3.5 Parallel Workflow States

Opportunity Stage, application state, Outreach State, and Interview Stage may progress independently.

Example:

Opportunity Stage: Pursuing
Application State: Preparing
Outreach State: Engaged

Another valid example:

Opportunity Stage: Interviewing
Application State: Confirmed
Outreach State: Engaged
Interview Stage: Hiring Manager

Detailed actions should remain in Activity Events, Internal Tasks, Applications, Outreach records, and Interview records rather than becoming excessive lifecycle statuses.

Lifecycle changes should create Activity Events so history remains visible.

Where possible, lifecycle state should be updated automatically from structured system activity rather than requiring manual candidate maintenance.

4. Automation and Scheduling

The system should support background automation, scheduled workflows, event-driven workflows, and future agent behavior while preserving human control over meaningful external actions.

Automation should reduce candidate effort rather than create additional administrative work.

4.1 Automation Principles

The system should:

Perform routine background work automatically when safe

Create or update Internal Tasks without candidate maintenance

Surface Next Actions only when human attention is required

Preserve meaningful Activity Events

Preserve External Action audit history

Avoid excessive notifications and agent chatter

Respect permissions and Automation Policies

Never grant itself additional permissions or autonomy

4.2 Scheduled Work

Scheduled automation may include:

Morning Opportunity intake

Job-alert processing

Proactive Opportunity discovery

Company Intelligence refreshes

Follow-up checks

Outreach timing

Employer-response monitoring

Interview preparation

Daily Work Queue generation

End-of-day review

Tomorrow Preview

Career Gap review

Candidate Knowledge enrichment

Scheduled checks should create candidate-facing output only when useful.

4.3 Event-Driven Work

Not all automation should depend on a clock.

Meaningful events may include:

New job alert

Application confirmation

Recruiter reply

Interview scheduled

New Candidate Knowledge

Contact response

Opportunity closure

Material new Company Intelligence

An event may:

Create an Activity Event.

Update structured state.

Create or update an Internal Task.

Trigger an agent or workflow.

Create an External Action request when appropriate.

Surface a Next Action when human attention is required.

4.4 Waiting States

The system should support Internal Tasks that are intentionally waiting.

Examples:

Waiting four days for outreach response

Waiting for recruiter reply

Waiting for scheduled interview

Waiting for candidate approval

Waiting for application portal availability

Waiting Tasks should not appear in the Daily Work Queue unless candidate attention is required.

The system should resume workflow automatically when the waiting condition expires or the relevant event occurs.

4.5 Daily Work Queue

The Daily Work Queue should be generated from current system state and active Next Actions.

It should consider:

Urgency

Opportunity value

Candidate Fit

Opportunity Fit

Application deadlines

Employer activity

Interview timing

Outreach timing

Candidate effort

Dependencies

Today's One Thing eligibility

Work-block preferences

The queue should not simply sort Tasks by creation date.

The system may preserve a lightweight Daily Plan snapshot of what was actually presented to the candidate for later progress review and calibration.

4.6 Today's One Thing

The system should identify one highest-leverage action when appropriate.

Today's One Thing should answer:

If this is the only meaningful job-search action completed today, which action creates the most leverage?

It may include:

Applying to a high-value Opportunity

Preparing for an imminent interview

Responding to an engaged hiring contact

Completing a critical application requirement

Resolving a blocker preventing a strong Opportunity from moving forward

It should reflect leverage, timing, importance, dependencies, and candidate effort rather than urgency alone.

4.7 Dynamic Reprioritization

The Daily Work Queue should be allowed to change when new information arrives.

Examples:

Recruiter requests same-day response

Interview is scheduled

High-value job closes soon

Outreach Contact responds

Application deadline changes

When significant reprioritization affects the candidate's day, the system should explain:

What changed

Why it matters

What moved

What now requires attention

4.8 Interruptions

The system should interrupt the candidate only when delay could materially reduce Opportunity value or create a missed commitment.

Interruptions should be pre-processed.

Instead of:

Recruiter emailed you.

Prefer:

Recruiter asked for interview availability. I checked your calendar, identified open times, and drafted the reply. Review and send?

4.9 Work Blocks

Candidate Settings may define preferred work blocks such as:

Morning review

Application block

Outreach block

Interview preparation

Deep-focus work

Quick tasks

Next Actions may be assigned to appropriate blocks automatically.

Work blocks should support focus without preventing urgent reprioritization.

4.10 Completion and Verification

The system should determine completion from system evidence whenever possible.

Examples:

Application confirmation email

Sent outreach message

Calendar event created

Candidate confirmation

External system state

The candidate should not be required to manually mark something complete when reliable evidence already exists.

4.11 Failure Handling and Idempotency

Automated workflows should fail visibly and safely.

If a workflow cannot complete, the system should:

Preserve completed work

Record the failure

Isolate unrelated processing

Retry when appropriate

Avoid duplicate records and external actions

Surface candidate attention only if needed

External Actions and other retry-sensitive operations should use idempotency controls where appropriate.

The system should never silently assume success.

4.12 External Action Execution

External Actions should have an explicit lifecycle separate from ordinary Internal Tasks.

Conceptually:

Internal Task
      ↓
External Action proposed
      ↓
Permission check
      ↓
Automation Policy check
      ↓
Approval check
      ↓
Safety check
      ↓
Execution
      ↓
Result recorded
      ↓
Activity Event

Successful execution records should preserve the exact payload and external result reference.

4.13 Agent Scheduling Foundation

Future specialized agents may activate through schedules, events, or both.

Examples:

Evaluation Agent

Runs when a new Opportunity is verified

Re-runs when material Candidate Knowledge or Company Intelligence changes

Outreach Agent

Reviews active Outreach Engagements

Responds to new relationship activity

Checks follow-up timing

Application Agent

Prepares materials when an Opportunity enters application preparation

Watches for candidate decisions and approvals

Interview Agent

Activates when an interview is scheduled

Prepares materials before the meeting

Requests debrief afterward

Safety and Verification Agent

Reviews unsupported claims

Reviews selected External Actions

Enforces safety and approval conditions

Agents should use shared system state and governed permissions rather than isolated workflow logic.

5. Integrations

External systems should remain responsible for the information and actions they naturally own.

Supabase should maintain the structured state that connects those external systems together.

For each integration, the architecture should distinguish whether it is:

A source of information

A destination for actions

Both

Read-only

Write-enabled

Human-approved

System-authorized

The system should avoid duplicating external data unnecessarily when a structured reference or source link is sufficient.

5.1 Gmail

Gmail may serve as:

Source of job alerts

Source of application confirmations

Source of recruiter communication

Source of interview communication

Source of rejection and offer messages

Destination for organizational actions such as labels and archiving

Supabase remains authoritative for Opportunity and workflow state.

Gmail labels may mirror system state for candidate convenience.

Example labels may include:

Job Search/Evaluated

Job Search/Applied

Job Search/Outreach

Job Search/Interview

Job Search/Rejected

Job Search/Offer

Meaningful Gmail events should create Activity Events and may update Applications, Outreach state, Interview state, Internal Tasks, Next Actions, or External Actions.

The original email should remain retrievable.

5.2 LinkedIn

LinkedIn may serve as:

Source of job Opportunities

Source of hiring posts

Source of Company and Contact context

Source of public professional activity

Source of outreach targets

Future destination for candidate-authorized outreach actions

LinkedIn information should be connected to structured Companies, Contacts, Opportunities, and Outreach Engagements rather than stored as isolated notes.

V1 should prioritize human control for LinkedIn external communication.

5.3 Indeed

Indeed may serve primarily as an Opportunity discovery source.

The system may process:

Job alerts

Job postings

Salary information

Location and work arrangement

Employer information

Job links

Indeed should not become the source of truth for Opportunity state.

If the same job appears through another source, the additional source should enrich the existing Opportunity rather than create a duplicate.

5.4 Google Calendar

Google Calendar may serve as both source and destination.

The system may:

Read candidate availability

Detect scheduled interviews

Create or update interview events when authorized

Support interview-preparation timing

Identify scheduling conflicts

Calendar events should link to structured Interview and Opportunity records.

Supabase remains authoritative for interview workflow state.

5.5 Employer Career Sites and ATS Platforms

Employer career sites and ATS platforms may serve as:

Verification sources

Canonical job-description sources

Application destinations

Sources of application questions

Sources of submission confirmation

The system should prefer the employer's canonical posting when available for current job facts.

Submission should follow configured permissions, Automation Policies, approval requirements, and safety checks.

5.6 Supabase

Supabase is the primary structured system of record.

External systems may change, disappear, or become unavailable.

The system should preserve enough structured context to understand the candidate's job-search history without depending entirely on any external provider interface.

6. V1 Architecture

V1 should prove the core job-search workflow before introducing specialized agents or high levels of autonomous external action.

Primary V1 objective:

Convert incoming job Opportunities into structured, evaluated, prioritized work that reduces candidate decision-making and administrative effort.

6.1 V1 Core Flow

V1 should support:

Opportunity enters from a supported source.

System extracts basic job information.

System checks for duplicates.

Existing Opportunity Sources are linked when the same opening appears again.

Canonical employer posting is identified when available.

Opportunity is created or updated in Supabase.

Job description is translated into plain-language work and problems.

Relevant Company context is collected.

Candidate Knowledge is retrieved.

Opportunity is evaluated.

Candidate Fit and Opportunity Fit are calculated.

Gaps and unanswered questions are identified.

Internal Tasks and Next Actions are created when needed.

Opportunity is ranked against other active Opportunities.

Daily Work Queue is generated.

Candidate reviews and acts on prioritized work.

Meaningful activity is written to the Opportunity Activity Feed.

6.2 V1 Access Foundation

V1 should begin with the Workspace and Principal model rather than retrofit multi-tenant access later.

Even if V1 contains only one human user and one Workspace, the architecture should support:

Workspace ownership

Human Principal

System or orchestrator Principal

Role and Permission assignments

RLS-enforced access

Actor attribution

Specialized agents do not need to exist in V1, but the access model should already support them.

6.3 V1 System Components

V1 should include enough structured data to support:

Candidate Settings

Automation Policies

Companies

Opportunities

Opportunity Sources

Opportunity Evaluations

Candidate Knowledge Base

Career Gaps

Activity Events

Internal Tasks

Next Actions

Applications and submitted history when used

Contacts

Basic Outreach Engagements

Basic Interview records

Not every domain needs a complete user interface in V1.

Some records may initially exist only as backend structured data.

6.4 Opportunity Intake

Initial intake should focus on known job-alert sources.

Initial priority:

LinkedIn job-alert emails

Indeed job-alert emails

V1 should:

Detect individual Opportunities

Extract available structured information

Identify originating source

Check for duplicates

Link additional Sources

Locate canonical employer posting when possible

Create or update Opportunity state

6.5 Job Translation

V1 should translate job descriptions into understandable work.

Translation should identify:

What problem the employer appears to be solving

What the person would actually do

Major responsibilities

Important requirements

Important terminology

Likely success measures

Important unknowns

Terminology alone should not cause the candidate to incorrectly reject an Opportunity.

6.6 Opportunity Evaluation

V1 should evaluate Opportunities using:

Job description

Company context

Candidate Settings

Candidate Knowledge Base

Existing Career Gaps

Relevant prior evaluations

V1 should produce:

Candidate Fit: You → Them

Opportunity Fit: Them → You

Opportunity type

Evidence confidence

Major strengths

Important gaps

Unknowns

Recommended next action

The Hidden Pursuit Score may be used internally for ranking.

6.7 Candidate Knowledge Base

V1 does not need a complete profile-builder interface.

Initial Candidate Knowledge may be populated from:

Existing resume

LinkedIn profile

Known work history

Projects

Candidate conversation

Candidate-provided artifacts

The system should support continued enrichment as evidence is discovered.

6.8 Activity Feed and Workflow

V1 should support:

System-generated Activity Events

Candidate notes

Shallow Activity Replies when useful

Internal Tasks

Next Actions

Waiting states

Basic retry safety

External Action records for real-world side effects when automation is used

Structured records remain authoritative.

6.9 Daily Work Queue

V1 should generate a prioritized candidate-facing Work Queue including:

Today's One Thing

High-priority Next Actions

Application work

Outreach work

Interview work

Candidate evidence questions

Time-sensitive follow-ups

The queue should answer:

What should I do today, and why?

rather than present a large report of everything the system found.

6.10 V1 Human Control

V1 should default to human approval for meaningful external actions.

The system may automatically:

Research

Evaluate

Draft

Recommend

Prepare

Organize

Create Internal Tasks

Create Next Actions

The candidate should initially perform or explicitly approve:

Application submission

LinkedIn messages

Employer or Contact emails

Interview scheduling responses

Other meaningful external communications

The architecture should allow these permissions to become more autonomous later without redesigning the underlying system.

6.11 V1 Agent Strategy

V1 should not require multiple independent specialized agents.

A single orchestrating AI workflow may initially perform:

Intake

Translation

Evaluation

Application preparation

Outreach drafting

Interview preparation

The orchestrator should still operate as a governed Principal and write durable state back into the shared system.

6.12 V1 Success Criteria

V1 should be considered successful if it can reliably:

Process incoming job Opportunities

Avoid duplicate Opportunities

Preserve multiple Sources

Translate unfamiliar job language

Evaluate Opportunities against real candidate evidence

Surface useful evidence gaps

Prioritize stronger Opportunities

Produce a manageable Daily Work Queue

Preserve Opportunity history

Reduce manual job-search workload

V1 does not need to automate every part of the job search to create meaningful value.

Its first job is to make candidate attention significantly more effective.

7. Future Architecture

The future architecture may evolve from one orchestrating workflow into a coordinated set of specialized agents.

The candidate should still experience one coherent system.

Future agents should operate through:

Shared Supabase records

Principal identities

Workspace Memberships

Roles and Permissions

Internal Tasks

Activity Events

Next Actions

External Actions

Candidate Settings

Automation Policies

Structured domain objects

Agents should communicate through shared state and durable recorded events rather than undocumented private memory.

7.1 Opportunity Discovery Agent

Potential responsibilities:

Monitor job-alert sources

Perform proactive discovery

Identify adjacent or emerging roles

Verify canonical postings

Detect duplicates

Create or enrich Opportunities

Monitor posting changes

7.2 Evaluation Agent

Potential responsibilities:

Translate job descriptions

Retrieve Candidate Knowledge

Evaluate Candidate Fit

Evaluate Opportunity Fit

Identify Application Gaps

Identify recurring Career Development Gaps

Re-evaluate when material evidence changes

Explain score changes

7.3 Company Intelligence Agent

Potential responsibilities:

Research Companies

Monitor meaningful Company changes

Maintain time-stamped Company Intelligence

Identify hiring patterns

Surface strategic signals

Refresh stale intelligence when relevant

7.4 Application Agent

Potential responsibilities:

Select Application Template

Retrieve Candidate Knowledge

Generate opportunity-specific materials

Prepare application answers

Check consistency

Preserve exact submitted versions

Request External Actions

Submit when authorized

Record confirmation

7.5 Outreach Agent

Potential responsibilities:

Identify relevant Contacts

Maintain relationship history

Retrieve previous communications

Draft and revise outreach

Monitor responses

Recommend follow-up timing

Track relationship progression

Request External Actions

Send communication when authorized

7.6 Interview Agent

Potential responsibilities:

Detect interview activity

Research interviewers

Generate preparation briefs

Retrieve relevant Evidence Stories

Conduct interactive practice

Capture debriefs

Draft follow-up communication

Track stages and commitments

7.7 Career Development Agent

Potential responsibilities:

Monitor recurring Career Development Gaps

Identify patterns across desirable roles

Recommend focused learning or project opportunities

Track whether gaps are resolving

Connect new capabilities back into Candidate Knowledge

Development should improve future opportunity access rather than generate generic learning activity.

7.8 Safety and Verification Agent

Potential responsibilities:

Review unsupported candidate claims

Detect contradictions

Verify sensitive or material responses

Review selected External Actions

Enforce configured permissions and Automation Policies

Prevent duplicate submissions or messages

Flag uncertain identity matches

Ensure actions are traceable

The Safety Agent should act as a control layer rather than a general decision-maker.

7.9 Agent Coordination

Specialized agents should hand work to one another through structured system state.

Example:

Discovery Agent creates Opportunity
        ↓
Evaluation Agent evaluates it
        ↓
Missing evidence identified
        ↓
Candidate Knowledge workflow requests clarification
        ↓
Candidate provides evidence
        ↓
Evaluation updated
        ↓
Application Agent prepares package
        ↓
Outreach Agent identifies Contact
        ↓
Safety layer verifies External Action
        ↓
Meaningful activity enters Activity Feed

Agents should not require private peer-to-peer conversations to coordinate work.

7.10 Agent Memory

Long-term agent memory should primarily come from shared structured records.

Agents may use temporary working context while performing a task, but durable facts, decisions, messages, evaluations, and outcomes should be written back into the system.

This supports:

Agent handoffs

Debugging

Model replacement

Human participation

Long-term continuity

7.11 Progressive Autonomy

Future versions may support increasing levels of automation.

Example levels:

Level 1

Research

Recommend

Draft

Level 2

Prepare

Organize

Schedule internal workflows

Request approval

Level 3

Perform selected External Actions with configured permission and approval rules

Level 4

Execute approved classes of recurring actions autonomously

Autonomy should be configurable by action type rather than enabled globally.

7.12 Future Analytics

Future versions may analyze accumulated system data to identify patterns such as:

Which Opportunity types convert to interviews

Which Candidate Evidence appears in successful applications

Which outreach approaches receive responses

Which Companies or Job Families produce stronger outcomes

Where applications drop out of the funnel

Which Career Gaps recur

Which actions create the highest leverage

Analytics should support better decisions rather than optimize for activity volume alone.

7.13 Future User Experience

The future system may provide:

Opportunity Feed

Daily Work Queue

Candidate Profile

Company relationship view

Contact relationship view

Application workspace

Interview workspace

Career development view

Agent activity visibility

Automation controls

The user experience should continue to hide unnecessary backend complexity.

7.14 Future Architecture Principle

The long-term goal is not to create many disconnected AI assistants.

The goal is one coherent job-search operating system in which specialized agents work through a shared data model, shared history, shared permissions, and shared workflow engine.

The candidate should experience one system, not a collection of bots.

8. Design Decisions

This section records major architectural decisions so future changes can be evaluated against the reasoning that produced them.

8.1 Supabase Is the Primary Structured System of Record

Decision:

Supabase will serve as the authoritative structured system of record.

Reason:

The system requires relational data, reusable history, workflow state, Candidate Knowledge, permissions, and future agent coordination across external systems.

External systems remain information sources or action destinations.

8.2 Workspace Is the Primary Tenancy Boundary

Decision:

Major tenant-owned data belongs explicitly to a Workspace.

Reason:

This creates one consistent security and ownership boundary for RLS, future multi-user support, coaches, teams, and agents.

8.3 Humans and Agents Are Governed Principals

Decision:

Humans, AI agents, and selected trusted system actors should be represented as Principals governed through Workspace Membership, Roles, and Permissions.

Reason:

Agents should be accountable actors rather than unrestricted backend processes.

This enables least-privilege access, RLS enforcement, auditability, and future agent specialization.

8.4 Normal Agent Activity Must Not Bypass RLS

Decision:

Routine agent work should operate under governed identities and should not rely on unrestricted service-role credentials.

Reason:

Using unrestricted credentials for normal agent work would bypass the permission architecture and weaken tenant isolation.

Service-role access should be reserved for narrowly defined trusted operations.

8.5 Tenant Isolation Should Be Enforced Beyond RLS

Decision:

Tenant-owned relationships should prevent cross-Workspace references at the relational level where practical.

Reason:

A child row should not be able to claim one Workspace while referencing a parent row owned by another Workspace.

RLS and relational integrity should work together rather than relying on policy logic alone.

8.6 Opportunity Represents One Specific Hiring Event

Decision:

An Opportunity represents one specific job opening or hiring event at one specific Company.

Reason:

A recurring job title may represent different hiring events over time.

Historical Opportunities should remain preserved so new postings can reuse context without rewriting prior history.

8.7 Multiple Sources Enrich One Opportunity

Decision:

The same real-world opening found through Indeed, LinkedIn, email, or an employer site should remain one Opportunity with multiple Opportunity Sources.

Reason:

This avoids duplicate evaluation while preserving richer source information.

8.8 Company Intelligence Is Separate From Evaluation

Decision:

Company Intelligence should be stored independently from individual Opportunity Evaluations.

Reason:

Company research may remain useful across multiple Opportunities and should retain time and source context.

8.9 Candidate Knowledge Base Is the Source of Candidate Truth

Decision:

Professional history should be modeled as Candidate Knowledge rather than only resume bullets or isolated documents.

Reason:

Projects, Work Experiences, Evidence Stories, Skills, Tools, and Artifacts provide reusable evidence for evaluation, applications, outreach, interviews, and career development.

A resume is an output of this knowledge.

8.10 Missing Evidence Is Not Missing Capability

Decision:

The system must distinguish lack of documented evidence from lack of actual ability.

Reason:

Job descriptions often use terminology that differs from how candidates describe equivalent or adjacent work.

The system should attempt evidence discovery and translation before treating a requirement as a true Career Development Gap.

8.11 Evaluation Is a Versioned Analytical Snapshot

Decision:

Evaluations should be preserved as time-specific versions rather than overwritten.

Reason:

Candidate Knowledge, Company Intelligence, and Opportunity facts may change.

Historical evaluation versions make score changes, reasoning, and calibration explainable.

8.12 Shared Opportunity Activity Feed

Decision:

Each Opportunity should have one primary chronological Activity Feed.

Reason:

The candidate should be able to understand the full history without navigating disconnected workstream conversations.

8.13 Structured State Remains Separate From the Feed

Decision:

The Activity Feed should not become the workflow engine.

Reason:

Chronological conversation is useful for humans, but reliable automation requires structured records.

8.14 Internal Tasks Are Machine-Facing

Decision:

Internal Tasks remain part of the architecture even though they are not the candidate's primary interface.

Reason:

Tasks support dependencies, waiting conditions, retries, scheduling, ownership, reporting, and agent handoffs.

8.15 Next Actions Are Human-Facing

Decision:

The candidate should interact primarily with simplified Next Actions.

Reason:

The candidate needs to know what requires attention, not maintain workflow metadata.

8.16 External Actions Are Separate From Internal Tasks

Decision:

Real-world side effects should have explicit External Action records.

Reason:

Sending, submitting, scheduling, and similar operations require stronger controls for permissions, approval, safety, idempotency, exact payload history, and external confirmation.

8.17 Opportunity, Application, Outreach, and Interview State Remain Separate

Decision:

The system should not force every workflow into one Opportunity status field.

Reason:

Application preparation, outreach, and interview activity may progress independently.

8.18 Application Package and Application Are Different Concepts

Decision:

Application Package represents mutable preparation.

Application represents an actual submission attempt and historical record.

Reason:

The distinction preserves the equivalent of a working record versus a finalized record.

Preparation should never be mistaken for submission.

8.19 Exact Submitted Materials and Answers Must Be Preserved

Decision:

The system should preserve exact submitted resume, cover letter, supporting material, and application-answer versions.

Reason:

Future Candidate Knowledge improvements must not rewrite what an employer actually received.

8.20 Outreach Is a Reusable Relationship Domain

Decision:

Outreach should not exist only as tasks attached to one Opportunity.

Reason:

Professional relationships may span multiple Opportunities or exist independently of a job opening.

8.21 Outreach Engagement May Relate to Multiple Opportunities

Decision:

Opportunity relationships should be modeled separately from the core Outreach Engagement.

Reason:

One relationship can become relevant to several job opportunities over time without becoming several disconnected relationship histories.

8.22 Candidate Settings and Automation Policies Are Structured Configuration

Decision:

Candidate preferences and autonomy rules should be stored as structured configuration rather than hard-coded throughout workflows.

Reason:

Preferences change, autonomy may increase over time, and action authorization needs a consistent source of truth.

8.23 Progressive Autonomy Is Action-Specific

Decision:

Automation authority should be configurable by action type.

Reason:

Research, drafting, Gmail labeling, application submission, outreach, and employer communication carry different levels of risk.

The system must never grant itself additional autonomy.

8.24 V1 Uses One Orchestrator

Decision:

V1 should not require multiple independent specialized agents.

Reason:

The core workflow can be validated more quickly with one orchestrating AI workflow while preserving architecture for future specialized agents.

8.25 Future Agents Use Shared State

Decision:

Future agents should operate on shared structured records rather than isolated private memory.

Reason:

Shared state improves traceability, handoffs, debugging, human participation, model replacement, and long-term continuity.

8.26 Event-Driven Workflow

Decision:

The system should respond to meaningful events in addition to scheduled automation.

Reason:

Job-search workflows change when recruiter replies, application confirmations, interviews, and new evidence arrive.

8.27 Historical Records Should Not Be Silently Rewritten

Decision:

Completed historical events and finalized snapshots should remain preserved.

Reason:

The system should be able to explain what was known, decided, submitted, sent, or performed at a specific point in time even after living data changes.

8.28 Human Attention Is the Scarce Resource

Decision:

The system should optimize for candidate attention rather than activity volume.

Reason:

The purpose is not to generate more tasks, applications, messages, or notifications.

The purpose is to identify and prepare the highest-leverage work so human judgment and action are spent where they create the most value.
