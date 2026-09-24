Job Search AI Agent

System Design

1. System Components

Opportunity Activity Feed

Each Opportunity should have one primary chronological Activity Feed representing the complete history of the candidate's relationship with that Opportunity.

The feed may contain events related to:

Discovery

Research

Evaluation

Candidate knowledge and evidence

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

Instead, individual Activity Events may support shallow nested replies so the candidate and agents can discuss or resolve a specific item without breaking the continuity of the full Opportunity history.

Structured objects such as Applications, Evaluations, Contacts, Outreach Engagements, Internal Tasks, and Next Actions remain separate records in the data model. Their relevant activity is surfaced into the shared Opportunity Activity Feed.

Future specialized agents should read from and write to the same shared system records and activity history rather than maintaining isolated private conversation histories.

Shared Agent Foundation

The architecture should support future specialized agents without requiring V1 to implement a full multi-agent system.

Potential future agents include:

Evaluation Agent

Application Agent

Outreach Agent

Interview Agent

Safety Agent

Agents should coordinate through shared structured records, Internal Tasks, Activity Events, and permissions rather than through private agent memory.

V1 may use one orchestrator or general AI workflow while preserving a data model that allows specialized agents to be added later.

2. Data and System of Record

Supabase will serve as the primary system of record for the Job Search AI Agent.

The database will store structured information about:

Companies

Company Intelligence

Job Families

Opportunities

Opportunity Sources

Contacts

Opportunity Evaluations

Candidate Knowledge

Career Gaps

Application Templates

Application Packages

Applications

Application Materials

Outreach Engagements

Outreach Messages

Interview Processes

Interviews

Activity Events

Activity Replies

Internal Tasks

Next Actions

Candidate Settings

Action history

External systems such as Gmail, LinkedIn, Indeed, company career sites, ATS platforms, and Google Calendar remain sources of information and actions. Supabase maintains the structured state needed to understand how those external events relate to each Company, Opportunity, Contact, Application, and workflow.

Large source files or unnecessary copies of external content should not be stored in the database when a structured record, source reference, artifact link, or external URL is sufficient.

Core Opportunity Data Model

The system should separate the real-world Company and Opportunity from the external sources through which the Opportunity was discovered.

Company

Represents the employer.

Example:

Mor Furniture For Less

A Company record should contain relatively stable company information. Time-sensitive research should be stored separately as Company Intelligence.

Relationships:

One Company may have many Opportunities.

One Company may have many Contacts.

One Company may have many Company Intelligence records over time.

One Company may have Outreach Engagements that are not tied to a single Opportunity.

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

Date researched

Relationships:

One Company may have multiple Company Intelligence records over time.

Company Intelligence may support multiple Opportunity Evaluations.

New Opportunities at an existing Company should reuse current Company Intelligence when still relevant rather than repeating the same research unnecessarily.

Time-sensitive intelligence should be refreshed when its age or new evidence could materially change an Evaluation.

The Company describes who the employer is.

Company Intelligence describes what appears to be happening at the employer over time.

Job Family

Represents a reusable role type or closely related group of roles across companies.

Examples:

Strategic Solutions Engineer

Enterprise Account Executive

Director of Operations

AI Transformation

Revenue Operations

A Job Family allows the system to reuse role-specific knowledge across different Opportunities without treating different companies' openings as the same Opportunity.

Relationships:

One Job Family may relate to many Opportunities.

One Job Family may have one or more Application Templates.

One Job Family may accumulate recurring interview themes, common requirements, terminology, and Career Development signals.

Opportunity

Represents one specific job opening at one specific Company.

Example:

Mor Furniture For Less, AI Solutions Manager

A different company hiring a similar role is a different Opportunity, even when both Opportunities belong to the same Job Family.

The Opportunity should contain factual information about the specific opening, such as:

Company

Job title

Job Family

Location

Work arrangement

Compensation information

Employment type

Canonical job description

Canonical job URL

Current Opportunity Stage

Date discovered

Date last verified

Current availability

Relationships:

One Company may have many Opportunities.

One Opportunity may have many Opportunity Sources.

One Opportunity may have multiple Evaluations over time.

One Opportunity may have zero, one, or multiple Applications over time.

One Opportunity may involve many Contacts.

One Opportunity may have one primary Activity Feed containing many Activity Events.

Opportunity Source

Represents a place where an Opportunity was found, observed, or verified.

Examples:

Indeed job-alert email

LinkedIn posting

Employer careers page

Recruiter email

Referral

Multiple sources for the same real-world job should enrich one Opportunity record rather than create duplicate Opportunities.

Different sources may contribute different information, such as:

Salary from Indeed

Full job description from the employer careers page

Hiring-manager context from LinkedIn

Confirmation that the role is active from a recruiter

Contact

Represents an individual person associated with a Company, Opportunity, or professional relationship.

Examples:

Recruiter

Hiring manager

Functional leader

Employee who posted about hiring

Referral or warm connection

Outreach target

Relationships:

One Company may have many Contacts.

One Opportunity may involve many Contacts.

One Contact may be relevant to multiple Opportunities.

One Contact may participate in multiple Outreach Engagements over time.

The relationship between a Contact and an Opportunity should describe why the person matters, such as recruiter, hiring manager, referral, outreach target, interviewer, or team leader.

Opportunity Evaluation

An Opportunity Evaluation represents the system's assessment of an Opportunity at a specific point in time.

Evaluations should be stored separately from the Opportunity so changes in Candidate Knowledge, Company Intelligence, or job information do not overwrite previous reasoning.

An Evaluation may include:

Candidate Fit score: You → Them

Opportunity Fit score: Them → You

Hidden Pursuit Score

Opportunity type

Evidence confidence

Plain-language problem translation

Problem Fit

Qualification gaps

Application gaps

Career Development signals

Company and culture signals

Important tradeoffs

Recommended next action

Unresolved candidate questions

Evidence and sources used

Evaluation date

Evaluation version

Relationships:

One Opportunity may have multiple Evaluations over time.

One Evaluation belongs to one Opportunity.

A new Evaluation should be created when materially new information changes the assessment.

Evaluations should record which Candidate Knowledge and Company Intelligence materially influenced the assessment.

The Opportunity describes what the job is.

The Evaluation describes what the system currently believes about the job and why.

Candidate Knowledge Base

The Candidate Knowledge Base is the system's structured source of truth for the candidate's professional history, projects, capabilities, tools, accomplishments, artifacts, and validated evidence.

It should provide richer context than a resume and should allow the system to understand not only what the candidate claims to know, but where that knowledge came from, how it was applied, and what evidence supports it.

Core entities may include:

Work Experience

Represents a role, contract, company, or professional engagement.

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

Represents a substantial body of work that may span one or more capabilities, tools, and Evidence Stories.

A Project may include:

Project name

Summary

Problem being solved

Users or stakeholders

Candidate role

Responsibilities

Architecture or system description

Tools and technologies used

Skills and capabilities demonstrated

Scale or complexity

Outcomes

Quantitative results

Current status

Related Work Experience

Related Evidence Stories

Related Artifacts

Links

Candidate notes

Projects should provide enough context for the system to explain what the candidate built or accomplished without reconstructing the project from individual stories every time.

Evidence Story

Represents a specific example that demonstrates how the candidate handled a problem, decision, interaction, or outcome.

An Evidence Story may include:

Related Work Experience

Related Project

Situation or problem

Candidate actions

Tools or systems used

Stakeholders involved

Outcome

Quantitative impact

Professional terminology

Skills demonstrated

Evidence type

Validation status

Source

Evidence types may include:

Direct experience

Adjacent experience

Demonstrated understanding

Inference

Unknown

Evidence Stories provide proof and detail beneath broader Work Experience and Project records.

Skill or Capability

Represents a professional capability that may be supported by multiple Projects and Evidence Stories.

Examples:

Discovery

Solution design

Salesforce administration

Consultative selling

Workflow design

Systems integration

AI enablement

Stakeholder management

Skills should not exist only as unsupported keywords.

Where possible, Skills should link to the Projects and Evidence Stories that demonstrate them.

Tool or Technology

Represents a platform, system, framework, or technology the candidate has used.

Examples:

Supabase

Salesforce

Jira

GitHub

Claude

ChatGPT

Microsoft Graph

SharePoint

A Tool record may include:

Tool name

Experience level or familiarity

Context of use

Related Projects

Related Work Experiences

Related Evidence Stories

Artifact

Represents tangible proof or supporting material created through the candidate's work.

Examples:

Demo videos

Project screenshots

User guides

Architecture diagrams

GitHub repositories

Case studies

Presentations

LinkedIn posts

Documentation

Artifacts may support Projects, Evidence Stories, Applications, interviews, and outreach.

Candidate Knowledge Relationships

The Candidate Knowledge Base should be relational rather than a collection of isolated notes.

Examples:

One Work Experience may contain many Projects.

One Project may contain many Evidence Stories.

One Evidence Story may demonstrate many Skills.

One Skill may be demonstrated across many Projects.

One Project may use many Tools.

One Artifact may support one or more Projects or Evidence Stories.

Application materials, Opportunity Evaluations, interview preparation, and outreach should reference the Candidate Knowledge Base rather than relying only on resume text.

Candidate Knowledge Design Principle

The system should understand the candidate's professional history as connected context, not as a flat list of resume bullets.

The Candidate Knowledge Base should make it possible to answer:

What has this candidate done?

Where did they do it?

What did they build?

What tools did they use?

What problems did they solve?

What evidence proves it?

What artifacts can demonstrate it?

The system should translate:

Candidate story → professional terminology

without replacing or overstating what the candidate actually did.

Missing evidence is not automatically proof of missing capability.

Career Gaps

Career Gaps represent missing evidence, missing experience, or capabilities that may limit the candidate's fit for current or future Opportunities.

The system should distinguish between different types of gaps rather than treating every unmet requirement as the same problem.

Application Gap

Represents something that weakens a specific Opportunity but may be solvable through better evidence, translation, positioning, or clarification.

Examples:

Relevant experience exists but has not been documented

Candidate has adjacent experience but not the employer's terminology

Resume does not currently show the required capability

Candidate needs one clarifying example before applying

A Project demonstrates the capability but has not yet been linked to the Opportunity

Application Gaps should primarily trigger evidence discovery, Candidate Knowledge Base updates, or application customization.

Career Development Gap

Represents a recurring or meaningful capability gap that may require learning, practice, certification, project work, or future job experience.

Examples:

No direct experience owning production architecture decisions

Repeated lack of enterprise SaaS presales experience

Missing technical depth that appears across high-value target roles

Repeated requirement for a tool or domain the candidate has never used

A Career Development Gap may include:

Gap description

Related Skill or Capability

Related Opportunities

Frequency of occurrence

Importance

Evidence supporting the gap

Whether the gap is blocking or developmental

Suggested development path

Current status

Date first identified

Date last observed

Gap Promotion

A gap identified during one Opportunity should not automatically become a Career Development Gap.

The system should first determine whether the issue is:

Missing evidence

Missing terminology

Adjacent experience

A one-off employer preference

A recurring capability gap

Only meaningful recurring gaps should be promoted into the Career Development Gap Library.

Relationships:

One Opportunity may identify many Application Gaps.

One Application Gap belongs primarily to one Opportunity.

Multiple Opportunities may contribute evidence to one Career Development Gap.

Career Development Gaps may link to Skills, Projects, learning activities, and future Evidence Stories.

Design Principle:

The system should not tell the candidate they lack a capability simply because the current Candidate Knowledge Base does not contain evidence for it.

Missing evidence is not the same as missing ability.

Application Templates and Reusable Application Foundations

The system should separate reusable job-family Application Templates from opportunity-specific application work.

Application Template

Represents a reusable application foundation for a Job Family or closely related type of role.

Examples:

Strategic Solutions Engineer

Enterprise Account Executive

Director of Operations

AI Transformation

Revenue Operations

An Application Template may define:

Preferred resume structure

Standard formatting

Relevant Candidate Knowledge categories

Common accomplishments and stories

Typical skills and terminology

Common application-question responses

Likely qualification gaps

Common interview themes

Typical outreach positioning

Templates should pull validated information from the Candidate Knowledge Base rather than becoming independent sources of candidate truth.

Formatting standards should remain consistent across templates so opportunity-specific customization does not result in inconsistent or lower-quality application materials.

Application

An Application represents a specific submission attempt for an Opportunity.

The Opportunity exists independently of whether the candidate applies.

An Application should represent what actually happened, not what was merely prepared or recommended.

An Application may retain:

Opportunity

Application date

Application Stage

Application Template used

Exact resume version submitted

Exact cover letter submitted

Exact application-answer packet used

Application or ATS URL

Submission method

Whether the candidate or system submitted it

Confirmation email or submission evidence

Notes specific to that submission attempt

Relationships:

One Opportunity may have zero, one, or multiple Applications over time.

One Application belongs to one Opportunity.

One Application may use one Application Template as its starting point.

One Application may have multiple Application Materials.

Submitted materials must be preserved exactly as they existed at the time of submission.

Application Preparation and Submission

Application preparation should be modeled as a structured workflow that produces opportunity-specific materials while preserving the exact version ultimately submitted.

The system should support both human-submitted and future system-submitted applications according to configured automation permissions.

Application Package

An Application Package represents the set of materials prepared for one Opportunity.

It may include:

Related Opportunity

Related Application Template

Related Evaluation

Resume

Cover letter

Application Answer Packet

Supporting documents

Candidate notes

Preparation status

Review status

Approval status

Submission readiness

Created timestamp

Last updated timestamp

The Application Package may exist before an Application is formally submitted.

Application Material

An Application Material represents one specific artifact prepared for an Opportunity.

Examples:

Resume

Cover letter

Screening answer packet

Portfolio attachment

Project summary

Supporting document

An Application Material may include:

Material type

Related Opportunity

Related Application Package

Source Template

Version

Exact content or file reference

Candidate approval status

Created timestamp

Submitted status

Submitted version indicator

The system should preserve the exact version that was submitted.

Draft and rejected versions should remain distinguishable from the final submitted version.

Application Answer Packet

The Application Answer Packet should collect known application questions and supported responses in the order required by the employer.

It may include:

Question text

Question type

Draft response

Evidence used

Confidence

Candidate verification requirement

Final approved response

Submission status

Frequently reused answers may reference validated Candidate Knowledge rather than being recreated from scratch.

The system should not invent unsupported answers.

If a required question cannot be answered truthfully from available information, the system should flag it for candidate input.

Application Preparation Workflow

The system should generally follow this pattern:

Opportunity is actively being pursued and is ready for application preparation.

Appropriate Application Template is selected.

Relevant Candidate Knowledge is retrieved.

Opportunity-specific resume is generated or selected.

Cover letter is prepared when useful.

Application questions are collected.

Answer Packet is prepared.

ATS and consistency checks are performed.

Candidate reviews only the items requiring attention.

Application Package is approved for submission.

Submission occurs manually or automatically according to permissions.

Exact submitted materials and confirmation evidence are preserved.

Opportunity and Application states are updated.

Activity Events are written to the shared Opportunity Feed.

Human Review

The system should minimize review burden by surfacing only material decisions.

Candidate review should focus on:

Unsupported or uncertain claims

Material changes in positioning

New application questions

Compensation or legal attestations

Required personal judgment

Final submission approval when configured

Submission Evidence

A completed Application should preserve evidence that submission occurred.

Examples:

Confirmation page

Confirmation email

ATS confirmation

Submitted timestamp

Submitted URL

Submission actor

The system should distinguish between:

Prepared

Approved

Submitted

Confirmed

Preparation should never be treated as proof of submission.

Application Agent Foundation

A future Application Agent should operate on shared system records rather than maintain isolated private history.

The Application Agent may:

Select the appropriate Job Family template

Retrieve Candidate Knowledge

Generate opportunity-specific materials

Prepare application answers

Run consistency and ATS checks

Surface only questions requiring candidate judgment

Submit applications when authorized

Record submission evidence

Create or update Internal Tasks

Surface Next Actions

Write meaningful application activity into the shared Opportunity Activity Feed

Outreach and Relationship Management

Outreach should be modeled as a reusable relationship workflow rather than only as tasks attached to individual Opportunities.

The architecture should support a future specialized Outreach Agent while allowing V1 outreach preparation to be handled through the general system.

Outreach Engagement

An Outreach Engagement represents an ongoing relationship-building effort with a Contact.

An Engagement may relate to:

A specific Opportunity

A Company

Multiple Opportunities over time

General networking or relationship development

An Outreach Engagement may include:

Contact

Company

Related Opportunity when applicable

Relationship context

Outreach goal

Current relationship state

Outreach state

Relevant Candidate Knowledge

Relevant Company Intelligence

Last meaningful interaction

Next Action

Opportunity should be optional because professional relationships may exist independently of a specific job opening.

Outreach Message

An Outreach Message represents an individual communication or proposed communication.

It may include:

Related Outreach Engagement

Related Contact

Related Opportunity when applicable

Channel

Direction: inbound or outbound

Purpose

Message content

Draft status

Version

Candidate approval status

Sent timestamp

Response status

Response timestamp

Outcome

Actor that created the message

The system should preserve the exact version that was actually sent.

Drafts that were rejected, revised, or approved should remain distinguishable from sent communications.

Outreach History and Reuse

Future outreach generation should retrieve relevant prior communications rather than depend on private agent memory.

Relevant context may include:

Previous messages with the same Contact

Previous communications with the same Company

Similar outreach situations

Candidate-approved messages

Successful outreach patterns

Candidate writing preferences

Contact relationship history

Opportunity context

Candidate Knowledge

Company Intelligence

Historical outreach should be used as contextual evidence, not automatically copied or reused without considering the new situation.

Outreach Agent Foundation

A future Outreach Agent should operate on shared system records rather than maintain an isolated private history.

The Outreach Agent may:

Identify appropriate outreach targets

Retrieve relationship history

Draft messages

Revise messages through candidate conversation

Record candidate preferences

Detect responses

Recommend follow-up timing

Create or update Internal Tasks

Surface Next Actions

Write meaningful Outreach activity into the shared Activity Feed

External messages should follow the system's configured automation permissions and approval requirements.

Interview Management

Interview activity should be modeled as a structured workflow associated with an Opportunity.

The system should support a future Interview Agent while allowing V1 interview preparation and tracking to operate through the shared system.

Interview Process

An Interview Process represents the employer's hiring process for one Opportunity.

It may include:

Related Opportunity

Current Interview Stage

Overall process status

Recruiter or coordinator

Known interview stages

Expected process structure

Important employer instructions

Scheduling status

Candidate notes

Date process began

Date process ended

One Opportunity may have zero or one active Interview Process at a time.

Interview

An Interview represents one specific meeting, assessment, or hiring interaction within an Interview Process.

Examples:

Recruiter screen

Hiring manager interview

Technical interview

Case study

Panel interview

Executive interview

Final interview

An Interview may include:

Related Interview Process

Related Opportunity

Interview type

Stage

Date and time

Duration

Format

Meeting link or location

Interviewers

Interviewer roles

Instructions

Preparation status

Outcome

Candidate notes

Follow-up status

Interview Preparation

Interview preparation should be generated using the Opportunity, Evaluation, Candidate Knowledge Base, Company Intelligence, and known interviewer context.

Preparation may include:

Plain-language explanation of what the interviewer is likely evaluating

Relevant Candidate Evidence Stories

Likely questions

Candidate talking points

Questions for the interviewer

Known gaps or risks

Company context

Role-specific terminology

Previous interview feedback

Information requiring candidate clarification

The system should prioritize useful talking points and evidence rather than forcing rigid scripted answers.

Interview Activity and Follow-Up

Meaningful interview events should appear in the shared Opportunity Activity Feed.

Examples:

Interview scheduled

Preparation ready

Candidate completed practice

Interview completed

Candidate debrief recorded

Thank-you message drafted

Follow-up sent

Employer feedback received

Next interview scheduled

Internal Tasks may manage reminders, preparation, scheduling checks, and follow-up timing.

Candidate-facing Next Actions should surface only when human attention is required.

Interview Debrief

After an interview, the system should be able to capture a lightweight debrief while the information is still fresh.

The debrief may include:

Questions asked

Candidate's perception of the conversation

Important information learned

Concerns or positive signals

New company context

New role requirements

Follow-up commitments

Interviewer-specific context

Candidate evidence that worked well

Evidence gaps discovered

Interview debrief information may update:

Opportunity Evaluation

Candidate Knowledge Base

Company Intelligence

Career Gaps

Outreach context

Future interview preparation

Interview Agent Foundation

A future Interview Agent should operate on shared system records rather than maintain an isolated private history.

The Interview Agent may:

Detect newly scheduled interviews

Generate preparation briefs

Identify likely questions

Retrieve relevant Candidate Evidence

Run interactive practice

Capture debriefs

Draft thank-you messages

Track follow-up

Create or update Internal Tasks

Surface Next Actions

Write meaningful interview activity into the shared Opportunity Activity Feed

Opportunity Activity, Tasks, Replies, and Next Actions

The system should separate human-facing workflow from machine-facing workflow.

The candidate should primarily interact with a simple Activity Feed and Daily Work Queue.

The system may maintain more detailed Internal Task records to support orchestration, scheduling, reporting, agent coordination, dependencies, retries, and timestamps without requiring the candidate to manually manage those fields.

Activity Event

Represents something that happened, was discovered, was decided, or materially changed within an Opportunity.

Examples:

Job discovered

Evaluation completed

Candidate Knowledge added

Resume prepared

Application submitted

Outreach recommended

LinkedIn connection accepted

Recruiter email received

Interview scheduled

Follow-up completed

Agent recommendation

Candidate note

An Activity Event may include:

Related Opportunity

Event type

Event timestamp

Actor

Summary

Detailed content

Related Contact

Related Application

Related Evaluation

Related Internal Task

Related source or evidence

Whether candidate attention is required

Activity Events form the chronological history shown in the Opportunity Activity Feed.

Activity Reply

Represents a reply to a specific Activity Event.

Replies allow the candidate, system, or future agents to discuss or resolve one item without creating a separate conversation thread.

Examples:

Candidate: "Done, I messaged Jane."

Outreach Agent: "Logged. I'll check again in four days."

Safety Agent: "This application answer needs verification."

Candidate: "Use the Reliant example."

Relationships:

One Activity Event may have many Replies.

One Reply belongs to one Activity Event.

Replies remain associated with the event they concern.

Replies should remain relatively shallow rather than creating deeply nested conversation trees.

Internal Task

Represents a structured unit of work maintained primarily by the system.

Tasks are not required to be the candidate's primary interface.

They exist to support reliable workflow execution and may include:

Related Opportunity

Related Company

Related Contact

Related Application

Task type

Task owner

Responsible agent or human

Trigger

Status

Created timestamp

Due timestamp

Completion timestamp

Priority

Dependencies

Waiting condition

Retry state

Approval requirement

Source Activity Event

Result or completion evidence

Next workflow step

Examples:

Wait four days after outreach

Check whether recruiter replied

Prepare application packet

Refresh Company Intelligence

Generate interview brief

Verify candidate answer

Schedule follow-up

Re-run Evaluation after new Candidate Knowledge is added

The system should maintain Internal Task state automatically whenever possible.

The candidate should not be required to manually update operational fields such as timestamps, dependencies, retry state, or workflow status.

Tasks may be visible through an optional detail view when the candidate wants to inspect the underlying workflow.

Next Action

Represents the simplified human-facing action that currently requires attention.

A Next Action is derived from the underlying workflow and should contain only the information needed to make progress.

Examples:

Review application packet

Follow Jane on LinkedIn

Reply to recruiter

Answer one evidence question

Approve outreach draft

Prepare for interview

A Next Action may include:

Related Opportunity

Related Internal Task

Related Activity Event

Recommended action

Priority

Due or target date

Estimated effort

Whether candidate approval is required

Whether it is eligible to become Today's One Thing

Short supporting context

The Daily Work Queue is a prioritized view of active Next Actions.

Workflow Pattern

The system should generally follow this pattern:

Something happens → Activity Event is recorded → Internal Task state is created or updated → Next Action is surfaced only if human attention is required → Candidate or system acts → Result is recorded as a new Activity Event → Workflow continues automatically where possible.

Example:

Candidate sends outreach message.

Activity Event records that the message was sent.

Internal Task enters a waiting state for four days.

Nothing appears in the candidate's queue during the waiting period.

If a response arrives, the waiting Task is resolved.

A new Activity Event records the reply.

A Next Action appears only if the candidate needs to respond.

If no reply arrives after four days, a follow-up Next Action may be created.

Activity and Task Design Principle

Tasks exist primarily for the machine.

Next Actions exist primarily for the candidate.

Activity Events preserve history.

Replies preserve contextual conversation.

The Activity Feed provides the shared human-and-agent collaboration surface while structured Internal Tasks provide the reliable workflow engine underneath it.

3. Opportunity Lifecycle

An Opportunity represents one specific job opening at one specific Company.

The system should not force application activity, outreach activity, interview activity, and overall Opportunity state into one status field.

Instead, the system should maintain separate but related workflow states.

Opportunity Stage

Opportunity Stage represents the overall relationship with the job.

Recommended Opportunity Stages:

Discovered

Opportunity has been found from an alert, proactive search, referral, company careers page, or other source.

Verified

The system has confirmed that the Opportunity is real, current enough to pursue, and not a duplicate of an existing Opportunity.

Evaluating

The system is translating the job, researching the Company, matching Candidate Knowledge, and identifying gaps.

Pursuing

The candidate has decided the Opportunity is worth active effort.

Application preparation, outreach, or both may occur during this stage.

Interviewing

The candidate has entered an employer interview, assessment, or formal hiring-process stage.

Offer

A formal or verbal offer has been received.

Closed

The Opportunity is no longer being actively pursued.

Closed reason should be stored separately, for example:

Rejected

Withdrawn

Role Closed

No Response

Accepted Elsewhere

Other

Application Stage

Application Stage represents the state of the submission process for a specific Application.

Recommended stages:

Not Started

Preparing

Ready for Review

Ready to Submit

Submitted

Confirmed

Withdrawn

Application preparation should not be confused with submission.

Outreach State

Outreach State represents the state of relationship-building activity.

Recommended states:

Not Started

Target Identified

Warming

Message Ready

Contacted

Engaged

Waiting

Closed

Outreach may occur before or after an Application is submitted.

Interview Stage

Interview Stage should be managed within the Interview Process and may vary by employer.

Examples:

Recruiter Screen

Hiring Manager

Technical or Functional Interview

Case Study

Panel

Executive or Final

The system should preserve the employer's actual process rather than forcing every company into an identical interview-stage sequence.

Parallel Workflow States

Opportunity Stage, Application Stage, Outreach State, and Interview Stage may progress independently.

Example:

Opportunity Stage: Pursuing

Application Stage: Not Started

Outreach State: Engaged

Another valid example:

Opportunity Stage: Pursuing

Application Stage: Submitted

Outreach State: Not Started

Another valid example:

Opportunity Stage: Interviewing

Application Stage: Confirmed

Outreach State: Engaged

Interview Stage: Hiring Manager

Lifecycle Design Rules

The Opportunity Stage should represent the Opportunity's current business state.

Detailed actions should remain in Activity Events, Internal Tasks, Applications, Outreach records, and Interview records.

The system should avoid creating excessive lifecycle statuses for every small action.

For example:

"Resume drafted" is an Activity Event, not an Opportunity Stage.

"Follow-up scheduled" is an Internal Task, not an Opportunity Stage.

"Recruiter replied" is an Activity Event that may trigger a state change.

"Application submitted" updates Application Stage and creates an Activity Event.

Lifecycle state changes should create Activity Events so the history remains visible.

Where possible, lifecycle state should be updated automatically from structured system activity rather than requiring manual candidate maintenance.

4. Automation and Scheduling

The system should support background automation, scheduled workflows, and future agent behavior while preserving human control over meaningful external actions.

Automation should reduce candidate effort rather than create additional administrative work.

Automation Principles

The system should:

Perform routine background work automatically when safe

Create or update Internal Tasks without requiring candidate maintenance

Surface Next Actions only when human attention is needed

Preserve meaningful Activity Events for traceability

Avoid excessive notifications or agent chatter

Respect configured approval requirements

Never grant itself additional permissions

Automation should be progressive.

The candidate may begin with:

Prepare only

Draft only

Recommend only

and later authorize:

Submit

Send

Schedule

Follow up

Perform other external actions

Permissions should be configurable by action type.

Scheduled Work

Scheduled automation may include:

Morning Opportunity intake

Job alert processing

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

Scheduled work should create output only when useful.

For example:

If no outreach follow-up is due, the Outreach workflow should not create a candidate-facing action simply because its scheduled check ran.

Event-Driven Work

Not all automation should depend on a clock.

The system should respond to meaningful events.

Examples:

New job alert arrives

Application confirmation received

Recruiter replies

Interview is scheduled

Candidate adds new Knowledge or Evidence

Contact responds to outreach

Opportunity closes

New Company information materially affects an Evaluation

An event may:

Create an Activity Event.

Update structured state.

Create or update an Internal Task.

Trigger an agent or workflow.

Surface a Next Action when human attention is required.

Waiting States

The system should support Internal Tasks that are intentionally waiting rather than incorrectly treating them as incomplete candidate work.

Examples:

Waiting four days for outreach response

Waiting for recruiter reply

Waiting for scheduled interview

Waiting for candidate approval

Waiting for company application portal availability

Waiting Tasks should not appear in the Daily Work Queue unless candidate action is required.

The system should resume the workflow automatically when the waiting condition expires or the relevant event occurs.

Daily Work Queue Generation

The Daily Work Queue should be generated from current system state, open Next Actions, deadlines, and configured candidate priorities.

The queue should consider:

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

Today's One Thing

The system should identify one highest-leverage action when appropriate.

Today's One Thing should represent the action most likely to materially advance the candidate's job search.

It may include:

Applying to a high-value Opportunity

Preparing for an imminent interview

Responding to an engaged hiring contact

Completing a critical application requirement

Resolving a blocker preventing a strong Opportunity from moving forward

Today's One Thing should not be selected solely because it is urgent.

It should reflect leverage, timing, and importance.

Dynamic Reprioritization

The Daily Work Queue should be allowed to change when new information arrives.

Examples:

Recruiter requests same-day response

Interview is scheduled

High-value job closes soon

Outreach Contact responds

Application deadline changes

The system may reprioritize remaining work automatically.

When a significant reprioritization affects the candidate's day, the system should explain:

What changed

Why it matters

What moved

What action now requires attention

Interruptions

The system should interrupt the candidate only when delay could materially reduce Opportunity value or create a missed commitment.

An interruption should be pre-processed.

Instead of:

Recruiter emailed you.

Prefer:

Recruiter asked for interview availability. I checked your calendar, Thursday at 2 PM is open, and I drafted the reply. Review and send?

Work Blocks

Candidate Settings may define preferred work blocks such as:

Morning review

Application block

Outreach block

Interview preparation

Deep-focus work

Quick tasks

Next Actions may be assigned to an appropriate work block automatically.

Work blocks should support focus without preventing urgent reprioritization.

Completion and Verification

The system should determine completion from system evidence whenever possible.

Examples:

Application confirmation email

Sent outreach message

Calendar event created

Candidate confirmation

External system status

The candidate should not be required to manually mark something complete when the system can reliably determine that it occurred.

Failure Handling

Automated workflows should fail visibly and safely.

If a workflow cannot complete:

Preserve completed work

Record the failure

Avoid duplicate external actions

Retry when appropriate

Surface candidate attention only if needed

The system should not silently assume success.

Agent Scheduling Foundation

Future specialized agents may run on schedules, events, or both.

Evaluation Agent:

Runs when a new Opportunity is verified

Re-runs when material Candidate Knowledge changes

Outreach Agent:

Reviews active Outreach Engagements

Responds to incoming communication

Checks follow-up timing

Application Agent:

Prepares materials when an Opportunity is ready for application work

Watches for required candidate decisions

Interview Agent:

Activates when an interview is scheduled

Prepares materials before the meeting

Requests debrief afterward

Safety Agent:

Reviews selected external actions or unsupported claims before execution

Agents should use shared system state, Internal Tasks, Activity Events, and configured permissions rather than maintain isolated workflow logic.

5. Integrations

Gmail Status Synchronization

Supabase is the authoritative source for Opportunity and workflow state.

Gmail labels should provide a secondary visual representation of that state so job-search email can be organized without requiring the candidate to manually manage the inbox.

Example labels may include:

Job Search/Evaluated

Job Search/Applied

Job Search/Outreach

Job Search/Interview

Job Search/Rejected

Job Search/Offer

When relevant email activity changes system state, the system should:

Interpret the email.

Update the appropriate structured record in Supabase.

Apply the corresponding Gmail label when appropriate.

Archive informational messages that no longer require candidate attention.

Preserve the original email so it remains searchable and retrievable.

Gmail labels are a convenience and organizational layer, not the authoritative source of system state.

Other integration behavior will be designed in this section as the architecture continues.
### 5. Integrations

External systems should remain responsible for the information and actions they naturally own.

Supabase should maintain the structured system state that connects those external systems together.

The architecture should distinguish whether each integration is:

- A source of information
- A destination for actions
- Both
- Read-only
- Write-enabled
- Human-approved
- System-authorized

The system should avoid duplicating external data unnecessarily when a structured reference or source link is sufficient.

#### Gmail

Gmail may serve as:

- Source of job alerts
- Source of application confirmations
- Source of recruiter communication
- Source of interview communication
- Source of rejection and offer messages
- Destination for organizational actions such as labels and archiving

Supabase remains authoritative for Opportunity and Application state.

Gmail labels may mirror system state for candidate convenience.

Meaningful Gmail events should create Activity Events and may update Internal Tasks, Next Actions, Application state, Outreach state, or Interview state.

The original email should remain retrievable.

#### LinkedIn

LinkedIn may serve as:

- Source of job Opportunities
- Source of hiring posts
- Source of Company and Contact context
- Source of public professional activity
- Source of potential outreach targets
- Future destination for candidate-approved outreach actions

LinkedIn information should be linked to structured Companies, Contacts, Opportunities, and Outreach Engagements rather than stored as isolated notes.

V1 should prioritize candidate review for external LinkedIn communication.

#### Indeed

Indeed may serve primarily as an Opportunity discovery source.

The system may process:

- Job alerts
- Job postings
- Salary information
- Location and work arrangement
- Employer information
- Job links

Indeed should not become the source of truth for Opportunity state.

If the same job is later found through another source, the additional source should enrich the existing Opportunity rather than create a duplicate.

#### Google Calendar

Google Calendar may serve as both a source and destination.

The system may:

- Read candidate availability
- Detect scheduled interviews
- Create or update interview events when authorized
- Support interview preparation timing
- Help identify scheduling conflicts

Calendar events should link back to the relevant Opportunity and Interview records.

#### Employer Career Sites and ATS Platforms

Employer career sites and ATS platforms may serve as:

- Verification sources
- Canonical job-description sources
- Application destinations
- Sources of application questions
- Sources of submission confirmation

The system should prefer the employer's canonical posting when available for final job-description verification.

Application submission should follow configured automation permissions.

#### Supabase

Supabase is the primary system of record.

It should store structured state for:

- Candidate settings
- Companies
- Opportunities
- Opportunity Sources
- Contacts
- Company Intelligence
- Evaluations
- Candidate Knowledge
- Career Gaps
- Applications
- Application Materials
- Outreach
- Interviews
- Activity Events
- Activity Replies
- Internal Tasks
- Next Actions
- Workflow state
- Action history

External systems may change or disappear.

The system should therefore preserve enough structured context in Supabase to understand the candidate's job-search history without depending entirely on an external provider's interface.

### 6. V1 Architecture

V1 should prove the core job-search workflow before introducing specialized agents or high levels of autonomous external action.

The primary V1 objective is:

**Convert incoming job Opportunities into structured, evaluated, prioritized work that reduces candidate decision-making and administrative effort.**

#### V1 Core Flow

The initial system should support:

1. Opportunity enters from a supported source.
2. System extracts basic job information.
3. System checks for duplicates.
4. Existing Opportunity Sources are linked when the same job appears again.
5. Canonical employer posting is identified when available.
6. Opportunity record is created or updated in Supabase.
7. Job description is translated into plain-language work and problems.
8. Relevant Company context is collected.
9. Candidate Knowledge is retrieved.
10. Opportunity is evaluated.
11. Candidate Fit and Opportunity Fit are calculated.
12. Gaps and unanswered questions are identified.
13. Internal Tasks and Next Actions are created when needed.
14. Opportunity is ranked against other active Opportunities.
15. Daily Work Queue is generated.
16. Candidate reviews and acts on the prioritized work.
17. Meaningful activity is written to the Opportunity Activity Feed.

---

#### V1 System Components

V1 should include:

##### Supabase

Primary system of record for structured data.

Initial V1 data should support:

- Candidate Settings
- Companies
- Opportunities
- Opportunity Sources
- Opportunity Evaluations
- Candidate Knowledge Base
- Career Gaps
- Activity Events
- Activity Replies
- Internal Tasks
- Next Actions
- Applications
- Application Materials
- Contacts
- Outreach Engagements
- Interviews

Not every object needs a complete user interface in V1.

Some may initially exist only as structured backend records.

---

##### Opportunity Intake

Opportunity Intake should initially focus on known job-alert sources.

Initial priority:

- LinkedIn job-alert emails
- Indeed job-alert emails

V1 should:

- Detect job Opportunities
- Extract available structured information
- Identify the originating source
- Check whether the Opportunity already exists
- Add additional Sources rather than creating duplicates
- Attempt to locate the canonical employer posting
- Create or update the Opportunity record

---

##### Job Translation

V1 should translate job descriptions from employer language into understandable work.

Translation should identify:

- What problem the employer appears to be solving
- What the person would actually do
- Major responsibilities
- Important requirements
- Important terminology
- Likely success measures
- Potential unknowns

The translation should help prevent terminology alone from causing the candidate to incorrectly reject an Opportunity.

---

##### Opportunity Evaluation

V1 should evaluate Opportunities using:

- Job description
- Company context
- Candidate Settings
- Candidate Knowledge Base
- Existing Career Gaps
- Relevant prior evaluations

V1 should produce:

- Candidate Fit: You → Them
- Opportunity Fit: Them → You
- Opportunity type
- Evidence confidence
- Major strengths
- Important gaps
- Unknowns
- Recommended next action

The Hidden Pursuit Score may be used internally for ranking.

---

##### Candidate Knowledge Base

V1 does not need a complete professional profile-builder interface.

The initial Candidate Knowledge Base may be populated from:

- Existing resume
- Existing LinkedIn profile
- Known work history
- Projects
- Candidate conversation
- Candidate-provided artifacts

The system should support continued enrichment as new evidence is discovered.

---

##### Activity Feed

Each Opportunity should have one primary Activity Feed.

V1 should support:

- System-generated Activity Events
- Candidate notes
- Activity Replies
- Meaningful workflow changes
- Next Actions surfaced within context

The Activity Feed should not be required to control underlying workflow state.

Structured records remain authoritative.

---

##### Internal Task Engine

V1 should support basic Internal Tasks for:

- Evaluation
- Candidate questions
- Application preparation
- Follow-up
- Outreach
- Interview preparation
- Waiting states

Tasks should primarily be maintained by the system.

The candidate should interact mainly with Next Actions.

---

##### Daily Work Queue

V1 should generate a prioritized candidate-facing Work Queue.

The queue should include:

- Today's One Thing
- High-priority Next Actions
- Application work
- Outreach work
- Interview work
- Candidate evidence questions
- Time-sensitive follow-ups

The queue should answer:

**What should I do today, and why?**

rather than present the candidate with a large report of everything the system found.

---

#### V1 Human Control

V1 should default to human approval for meaningful external actions.

The system may:

- Research
- Evaluate
- Draft
- Recommend
- Prepare
- Organize
- Create Internal Tasks
- Create Next Actions

The candidate should initially perform or explicitly approve:

- Application submission
- LinkedIn messages
- Emails to employers or contacts
- Interview scheduling responses
- Other meaningful external communications

The architecture should allow these permissions to become more autonomous later without redesigning the underlying data model.

---

#### V1 Agent Strategy

V1 should not require multiple independent agents.

A single orchestrating AI workflow may initially perform:

- Intake
- Translation
- Evaluation
- Application preparation
- Outreach drafting
- Interview preparation

The underlying data model should still identify the workflow domain responsible for each Task or Activity Event.

This allows specialized agents to be introduced later without changing the core system architecture.

---

#### V1 Success Criteria

V1 should be considered successful if it can reliably:

- Process incoming job Opportunities
- Avoid duplicate Opportunities
- Preserve multiple Sources
- Translate unfamiliar job language
- Evaluate Opportunities against real candidate evidence
- Surface useful evidence gaps
- Prioritize stronger Opportunities
- Produce a manageable Daily Work Queue
- Preserve Opportunity history
- Reduce the candidate's manual job-search workload

V1 does not need to automate every part of the job search to provide meaningful value.

Its first job is to make the candidate's attention significantly more effective.

### 7. Future Architecture

The future architecture may evolve from a single orchestrating AI workflow into a coordinated set of specialized agents.

The system should preserve a shared source of truth so specialized agents can collaborate without maintaining isolated private histories.

Future agents should operate through:

- Shared Supabase records
- Internal Tasks
- Activity Events
- Activity Replies
- Next Actions
- Candidate Settings
- Automation permissions
- Structured domain objects

Agents should communicate through shared state and recorded events rather than undocumented private memory.

---

#### Specialized Agents

Potential future agents may include:

### Opportunity Discovery Agent

Responsibilities may include:

- Monitor job-alert sources
- Perform proactive discovery
- Identify adjacent or emerging roles
- Verify canonical job postings
- Detect duplicates
- Create or enrich Opportunity records
- Monitor closing dates or posting changes

---

### Evaluation Agent

Responsibilities may include:

- Translate job descriptions
- Retrieve relevant Candidate Knowledge
- Evaluate Candidate Fit
- Evaluate Opportunity Fit
- Identify Application Gaps
- Identify recurring Career Development Gaps
- Update evaluations when new evidence appears
- Explain why a score changed

---

### Company Intelligence Agent

Responsibilities may include:

- Research Companies
- Monitor meaningful Company changes
- Maintain time-stamped Company Intelligence
- Identify hiring patterns
- Surface strategic signals
- Refresh stale intelligence when relevant to an active Opportunity

---

### Application Agent

Responsibilities may include:

- Select the appropriate Application Template
- Retrieve supporting Candidate Knowledge
- Generate opportunity-specific materials
- Prepare application answers
- Check consistency
- Preserve exact submitted versions
- Submit applications when authorized
- Record submission confirmation

---

### Outreach Agent

Responsibilities may include:

- Identify relevant Contacts
- Maintain Outreach Engagement history
- Retrieve similar prior communications
- Draft and revise outreach
- Monitor responses
- Recommend follow-up timing
- Track relationship progression
- Surface appropriate Next Actions
- Send communication when authorized

---

### Interview Agent

Responsibilities may include:

- Detect interview activity
- Research interviewers
- Generate preparation briefs
- Retrieve relevant Evidence Stories
- Conduct interactive practice
- Capture interview debriefs
- Draft follow-up communication
- Track interview stages and commitments

---

### Career Development Agent

Responsibilities may include:

- Monitor recurring Career Development Gaps
- Identify patterns across target roles
- Recommend focused learning or project opportunities
- Track whether gaps are resolving
- Connect newly developed capabilities back into the Candidate Knowledge Base

The agent should prioritize development that improves future opportunity access rather than suggesting generic learning activity.

---

### Safety and Verification Agent

Responsibilities may include:

- Review unsupported candidate claims
- Detect contradictions
- Verify sensitive or material application responses
- Review selected external actions before execution
- Enforce configured automation permissions
- Prevent duplicate submissions or messages
- Flag uncertain identity matches
- Ensure that system actions are traceable

The Safety Agent should act as a control layer rather than a general decision-maker.

---

#### Agent Coordination

Specialized agents should be able to hand work to one another through structured system state.

Example:

1. Discovery Agent creates an Opportunity.
2. Evaluation Agent evaluates it.
3. Evaluation Agent identifies missing evidence.
4. Candidate Knowledge workflow requests clarification.
5. Candidate provides evidence.
6. Evaluation Agent updates the assessment.
7. Application Agent prepares materials.
8. Outreach Agent identifies a Contact.
9. Safety Agent verifies external actions.
10. Meaningful activity is written to the shared Opportunity Feed.

Agents should not require direct peer-to-peer private conversation to coordinate work.

Shared records should provide the durable handoff mechanism.

---

#### Agent Ownership of Internal Tasks

Internal Tasks may include a responsible domain or agent.

Examples:

- evaluation
- outreach
- application
- interview
- company intelligence
- career development
- safety

Task ownership should help route work without exposing unnecessary operational complexity to the candidate.

The candidate should continue to see simplified Next Actions rather than agent-specific task queues.

---

#### Event-Driven Agent Activation

Future agents may activate when relevant events occur.

Examples:

- New Opportunity → Evaluation Agent
- New Candidate Evidence → Evaluation Agent
- Application submitted → Outreach Agent
- Contact reply received → Outreach Agent
- Interview scheduled → Interview Agent
- Repeated capability gap detected → Career Development Agent
- External action pending → Safety Agent

This allows the system to respond to meaningful changes instead of relying only on scheduled polling.

---

#### Agent Memory

Long-term agent memory should primarily come from structured shared records.

Agents may use temporary working context while performing a task, but durable facts, decisions, messages, evaluations, and outcomes should be written back into the system.

This reduces dependence on model-specific memory and allows future models or agents to continue work from the same shared history.

---

#### Progressive Autonomy

Future versions may allow higher levels of automation.

Examples:

Level 1:
- Research
- Recommend
- Draft

Level 2:
- Prepare
- Organize
- Schedule internal workflows
- Request approval

Level 3:
- Perform selected external actions with configured permission

Level 4:
- Execute approved classes of recurring actions autonomously

Autonomy should be configurable by action type rather than enabled globally.

For example, the candidate may allow:

- Automatic Gmail labeling
- Automatic company research
- Automatic interview-prep generation

while still requiring approval for:

- Sending LinkedIn messages
- Submitting applications
- Sending employer emails

---

#### Future Analytics

Future versions may analyze accumulated system data to identify patterns such as:

- Which Opportunity types convert to interviews
- Which Candidate Evidence appears most often in successful applications
- Which outreach approaches receive responses
- Which Companies or role families produce stronger outcomes
- Where applications are dropping out of the funnel
- Which Career Gaps recur most often
- Which actions create the highest leverage

Analytics should support better candidate decisions rather than optimize for activity volume alone.

---

#### Future User Experience

The future system may provide:

- Opportunity Feed
- Daily Work Queue
- Candidate Profile
- Company relationship view
- Contact relationship view
- Application workspace
- Interview workspace
- Career development view
- Agent activity visibility
- Configurable automation permissions

The user experience should continue to hide unnecessary backend complexity.

The candidate should primarily understand:

- What changed
- Why it matters
- What the system handled
- What needs attention now
- What should happen next

---

#### Future Architecture Principle

The long-term goal is not to create many independent AI assistants.

The goal is to create one coherent job-search operating system in which specialized agents can work through a shared data model, shared history, and shared workflow engine.

The candidate should experience one system, not a collection of disconnected bots.

### 8. Design Decisions

This section records major architectural decisions so future changes can be evaluated against the original reasoning.

#### Supabase as Primary System of Record

Decision:

Supabase will serve as the authoritative structured system of record.

Reason:

The system requires relational data, reusable history, workflow state, structured candidate knowledge, and future agent coordination across many external systems.

External platforms such as Gmail, LinkedIn, Indeed, ATS systems, and Google Calendar remain sources of information or destinations for action.

---

#### Opportunity Represents One Specific Job Opening

Decision:

An Opportunity represents one specific job opening at one specific Company.

Reason:

Different Companies hiring for the same job family have different context, Contacts, salary, Company Intelligence, outreach history, and hiring outcomes.

Reusable role-specific knowledge should live in Job Families and Application Templates rather than combining separate jobs into one Opportunity.

---

#### Multiple Sources Enrich One Opportunity

Decision:

The same real-world job found through Indeed, LinkedIn, email, or the employer careers site should remain one Opportunity with multiple Opportunity Sources.

Reason:

This avoids duplicate evaluation and preserves the richer information provided by different sources.

---

#### Company Intelligence Is Separate From Opportunity Evaluation

Decision:

Company Intelligence should be stored independently from individual Opportunity Evaluations.

Reason:

Company research may remain useful across multiple Opportunities and should not need to be recreated for every job.

Time-sensitive Company Intelligence should retain timestamps and source context.

---

#### Candidate Knowledge Base Instead of Resume-Only Evidence

Decision:

The candidate's professional history should be modeled as a Candidate Knowledge Base rather than only as resume bullets or isolated Evidence Stories.

Reason:

Projects, Work Experiences, Skills, Tools, Artifacts, and Evidence Stories provide reusable context for evaluation, applications, outreach, interviews, and career development.

A resume is an output of this knowledge, not the primary source of truth.

---

#### Shared Opportunity Activity Feed

Decision:

Each Opportunity should have one primary chronological Activity Feed.

Reason:

The candidate should be able to understand the complete history of an Opportunity without navigating several disconnected conversations.

Individual Activity Events may support replies so humans and agents can discuss specific items while preserving the full timeline.

---

#### Structured State Remains Separate From the Feed

Decision:

The Activity Feed should not become the primary workflow engine.

Reason:

Conversation and chronological history are useful for humans, but reliable automation requires structured records.

Applications, Evaluations, Tasks, Outreach, Interviews, and other domain objects remain authoritative underneath the feed.

---

#### Internal Tasks Are Primarily Machine-Facing

Decision:

Internal Tasks remain part of the architecture even though they are not the candidate's primary task interface.

Reason:

Tasks provide reliable orchestration, timestamps, dependencies, waiting states, retries, reporting, ownership, and future agent handoffs.

The system should maintain these records automatically whenever possible.

---

#### Next Actions Are Human-Facing

Decision:

The candidate should interact primarily with simplified Next Actions rather than raw Internal Tasks.

Reason:

The candidate needs to know what requires attention now, not maintain system workflow metadata.

The Daily Work Queue should be generated from active Next Actions.

---

#### Opportunity, Application, Outreach, and Interview States Are Separate

Decision:

The system should not force every workflow into one Opportunity status field.

Reason:

These workflows may progress independently.

For example:

Opportunity Stage: Pursuing  
Application Stage: Not Started  
Outreach State: Engaged

This accurately represents relationship-building that happens before application submission.

---

#### Outreach Is a Reusable Relationship Domain

Decision:

Outreach should not exist only as tasks attached to a single Opportunity.

Reason:

Professional relationships often span multiple Opportunities or exist independently of a specific job.

Outreach history should remain reusable for future networking, message generation, and relationship context.

---

#### Exact Sent and Submitted Versions Must Be Preserved

Decision:

The system should distinguish drafts, approved versions, sent messages, and submitted application materials.

Reason:

Future analysis and agent behavior should learn from what the candidate actually approved and used, not from rejected drafts.

This also preserves an accurate historical record.

---

#### Missing Evidence Is Not Missing Capability

Decision:

The system must distinguish lack of documented evidence from lack of actual ability.

Reason:

Job descriptions often use terminology that does not match how candidates describe their real experience.

The system should first attempt evidence discovery and translation before treating a requirement as a true Career Development Gap.

---

#### V1 Uses One Orchestrator

Decision:

V1 should not require multiple independent specialized agents.

Reason:

The core workflow can be validated more quickly using one orchestrating AI workflow.

The underlying data model should still support future specialized agents without redesign.

---

#### Future Agents Use Shared State

Decision:

Future agents should operate on shared structured records rather than isolated private memory.

Reason:

Shared state improves traceability, agent handoffs, debugging, human participation, model replacement, and long-term continuity.

---

#### Progressive Autonomy

Decision:

Automation permissions should be configurable by action type.

Reason:

Research, drafting, labeling, application submission, outreach, and employer communication carry different levels of risk.

The system should be able to automate low-risk work while preserving human approval for higher-impact external actions.

---

#### Event-Driven Workflow

Decision:

The system should respond to meaningful events in addition to scheduled automation.

Reason:

Job-search workflows change when things happen, such as recruiter replies, application confirmations, interview scheduling, or new candidate evidence.

The system should not depend only on periodic polling.

---

#### Human Attention Is the Scarce Resource

Decision:

The system should optimize for candidate attention rather than activity volume.

Reason:

The purpose of the system is not to generate more tasks, applications, or notifications.

Its purpose is to identify and prepare the highest-leverage work so the candidate spends time where human judgment and action create the most value.
