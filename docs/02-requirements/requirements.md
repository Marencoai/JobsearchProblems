Job Search AI Agent

Requirements

Purpose and Scope

This document defines the intended behavior of the full Job Search AI Agent.

The system is designed to be reusable. Candidate-specific values such as location preferences, work-block timing, compensation preferences, autonomy permissions, and search strategy must live in configurable settings rather than being hard-coded into the requirements.

Implementation scope for V1 will be defined separately during Design. V1 may implement only a subset of these requirements without changing the long-term behavior defined here.

Candidate Settings and Configuration
REQ-SETTINGS-001 - Centralize Candidate Settings

The system must provide one centralized Settings area for changeable candidate preferences and operating rules.

Settings should be grouped into logical sections such as:

Career preferences

Location and travel

Compensation

Daily routine and work blocks

Search strategy

Outreach

Automation permissions

Application defaults

Grading and progress

The interface should allow the candidate to move quickly between settings groups without navigating through multiple unrelated pages.

REQ-SETTINGS-002 - Support Preference Strength

Configurable candidate preferences must support a preference-strength scale:

Hard No - exclude or block unless the candidate changes the setting

Strong Preference - materially favor

Open to It - acceptable with limited penalty

Neutral - no meaningful effect

Nice Bonus - small positive signal

Hard No settings must act as gates before opportunity scoring and must not be overridden by a high fit score.

REQ-SETTINGS-003 - Support Search Strategy Modes

The system must support configurable search strategies that change how viable opportunities are ranked after evaluation.

Required modes:

Balanced - give meaningful weight to both Candidate Fit and Opportunity Fit

Opportunity-First - favor roles the candidate most wants, including selected stretch opportunities

Hireability-First - favor roles where current evidence suggests the candidate has the strongest immediate case

Balanced must be the default for new users.

Search Strategy must affect ranking and resource allocation, not whether an otherwise viable opportunity is allowed to be evaluated or stored.

REQ-SETTINGS-004 - Support a Daily Opportunity Target

The system must allow the candidate to configure a target number or range of strong new opportunities to identify per day.

The system must never lower its quality threshold solely to meet the configured target.

REQ-SETTINGS-005 - Support Configurable Work Blocks

The candidate must be able to configure:

Number of daily work blocks

Preferred timing

Target duration

Available days

Whether blocks may be moved automatically

Whether optional work should be shown after priority work is complete

REQ-SETTINGS-006 - Support Configurable Autonomy by Action Type

The candidate must be able to configure the autonomy level for different action types, including:

Application submission

Recruiter email

Interview scheduling

Outreach email

LinkedIn outreach

Calendar actions

Inbox organization

Tracker updates

REQ-SETTINGS-007 - Store Reusable Candidate Answers

The system should maintain validated reusable answers for recurring application questions when the candidate chooses to store them.

Examples include:

Work authorization

Sponsorship

Travel willingness

Relocation preference

Compensation approach

Start availability

Contact information

Standard location information

Sensitive or uncertain answers must not be inferred.

Opportunity Discovery and Intake
REQ-INTAKE-001 - Identify Job Opportunities

The system must identify individual job opportunities contained in configured job-alert sources.

REQ-INTAKE-002 - Retrieve the Complete Job Posting

The system must attempt to retrieve the complete job posting before evaluating candidate fit.

An alert, email preview, or search-result snippet must not be treated as the complete job description when a fuller posting can reasonably be found.

REQ-INTAKE-003 - Verify the Job Posting

The system must attempt to verify the opportunity against at least one source beyond the original alert, prioritizing the employer's official careers site when available.

REQ-INTAKE-004 - Handle Unverified Opportunities

If the system cannot retrieve or verify enough information to evaluate an opportunity reliably, it must preserve the opportunity and mark it for verification rather than automatically rejecting it or evaluating it from incomplete information.

REQ-INTAKE-005 - Deduplicate Opportunities

The system must identify when multiple alerts or postings refer to the same real-world opportunity and maintain one opportunity record.

Deduplication may use:

Employer

Job title

Location

Job or requisition ID

Authoritative URL

Job-description similarity

Posting date

Other reliable identifying information

REQ-INTAKE-006 - Apply Hard Constraints Before Scoring

The system must check configured Hard No constraints before performing full evaluation.

If an opportunity violates a confirmed Hard No, the system should stop deeper evaluation unless the candidate manually overrides or changes the setting.

REQ-INTAKE-007 - Use Adaptive Discovery

The system must begin with configured incoming sources such as LinkedIn and Indeed alerts.

After deduplication and basic screening, the system must determine whether those sources produced enough unique, viable opportunities to meet the configured Daily Opportunity Target.

If the target is not met, the system should activate proactive discovery.

REQ-INTAKE-008 - Support Proactive Discovery

When proactive discovery is needed, the system should search for:

Known target roles

Similar roles to high-scoring opportunities

Companies already showing strong candidate alignment

Companies where the candidate already has relevant relationships

Roles involving recurring problem types the candidate enjoys

Adjacent or emerging roles that may use unfamiliar titles

Roles connected to recurring Career Development Gaps

REQ-INTAKE-009 - Label Adjacent and Emerging Roles

When the system surfaces an adjacent or emerging role the candidate may not have searched for directly, it must explain why the underlying work appears relevant.

The system should clearly distinguish these from known-role searches.

REQ-INTAKE-010 - Protect the Quality Bar

If the system cannot find enough strong opportunities to meet the Daily Opportunity Target, it must return fewer opportunities rather than lower the quality threshold.

REQ-INTAKE-011 - Use Lightweight Verification for Stale Opportunities

When an otherwise promising opportunity appears stale or uncertain, the system should prefer a low-cost verification step before performing expensive research or application preparation.

Possible verification actions include:

Checking the current careers site

Checking recent recruiter or hiring-team activity

Identifying an employee connected to the role

Preparing a short message asking whether the role is still active

Career Signals and Gap Library
REQ-CAREER-001 - Separate Application Gaps From Career Development Gaps

The system must distinguish between:

Application Gap - a gap that matters to one specific opportunity

Career Development Gap - a capability that appears repeatedly across attractive opportunities or is explicitly identified by the candidate as strategically interesting

One isolated job requirement must not automatically become a Career Development Gap.

REQ-CAREER-002 - Capture Relevant Capability Gaps

The system must retain capability gaps discovered during opportunity evaluation when they may be useful for future applications or career planning.

REQ-CAREER-003 - Identify Recurring Career Signals

The system must identify when the same or related capability gaps repeatedly appear across attractive opportunities.

The system must distinguish isolated requirements from recurring patterns.

REQ-CAREER-004 - Maintain a Career Gap Library

For Career Development Gaps, the system should retain information such as:

Capability or experience area

Plain-language explanation

Why employers appear to want it

Roles in which it appeared

Frequency across attractive opportunities

Current candidate evidence

Candidate interest

Status such as Explore, Learning, Building Evidence, or Demonstrated

Potential ways to gain the experience

REQ-CAREER-005 - Connect Gaps to Career Optionality

The system must explain how gaining a recurring capability could expand the candidate's access to future opportunities.

The system should not attempt to predict a specific future job title when the market may change.

REQ-CAREER-006 - Use Gaps to Inform Development Work

Career Development Gaps may be used to generate optional learning, exploration, project, networking, or stepping-stone-role activities.

The system must not treat every gap as something the candidate is required to learn.

Job Translation and Company Context
REQ-TRANSLATE-001 - Translate Job Requirements

The system must translate responsibilities, qualifications, technical terminology, acronyms, and hiring language into plain language explaining what the employee would actually be expected to accomplish.

Replacing one technical term with another technical term does not count as translation.

REQ-TRANSLATE-002 - Explain Why Requirements Matter

For meaningful job requirements, the system must explain:

Why the employer likely included the requirement

What risk, responsibility, or business need the requirement may address

What using the capability would look like in the actual work

REQ-TRANSLATE-003 - Research Company Hiring Context

The system must review other current openings at the company when available and use relevant hiring patterns as additional context for understanding why the target role may exist.

Hiring-pattern conclusions must be labeled as inference unless confirmed.

REQ-TRANSLATE-004 - Distinguish Evidence From Inference

The system must distinguish:

Information directly supported by the job posting

Information supported by company sources

Publicly reported information

Employee or customer opinion

Reasonable inference

Unknown information

Inferred conclusions must not be presented as confirmed facts.

REQ-TRANSLATE-005 - Simulate the Work Problem

When a responsibility or qualification remains abstract, the system must translate it into a concrete scenario that allows the candidate to visualize the problem she would actually encounter in the role.

When sufficient context is available, the scenario should show:

What the company sells or provides

Who the customer or internal user could be

What they are trying to accomplish

Who is involved

What each stakeholder may need or care about

Where conflict, bottleneck, uncertainty, or risk occurs

What is preventing the work from moving forward

The scenario should present the problem before explaining how the candidate might solve it.

Illustrative details must be clearly separated from confirmed facts.

REQ-TRANSLATE-006 - Explain Material Requirements Before Escalation

Before asking the candidate to resolve an uncertain qualification, the system must first explain the requirement in problem-first language.

The explanation should include:

Why the employer may care

What performing the work could look like

What candidate evidence appears relevant

What remains unverified

Whether the gap appears to be terminology, implementation, experience, or foundational

Candidate Evidence Library
REQ-EVIDENCE-001 - Compare Problems, Not Just Keywords

The system must compare the underlying problem and work described by a job against documented candidate evidence rather than relying primarily on resume-to-JD keyword matching.

REQ-EVIDENCE-002 - Distinguish Missing Evidence From Missing Capability

When a potentially relevant capability is not supported by the Candidate Evidence Library, the system must distinguish between:

Evidence that the candidate does not have the experience

Evidence that the library may simply be incomplete

Missing documentation must not automatically be treated as lack of capability.

REQ-EVIDENCE-003 - Ask Problem-Based Evidence Questions

When additional candidate information could materially change an opportunity evaluation, the system must ask a plain-language, problem-based question rather than asking whether the candidate has an abstract competency.

REQ-EVIDENCE-004 - Extract Capabilities From Candidate Stories

When the candidate provides an experience or explains how she would approach a problem, the system must identify:

What actually happened

What the candidate personally did

Outcome when known

Professional or technical terminology that describes the work

Capabilities directly supported by the evidence

Capabilities that are only inferred

REQ-EVIDENCE-005 - Require Candidate Validation

New evidence or professionally translated capabilities derived from candidate responses must be available for candidate validation or correction before being treated as confirmed evidence.

REQ-EVIDENCE-006 - Reuse Validated Evidence

Once evidence has been validated, the system must reuse it across future evaluations, application preparation, resume generation, outreach preparation, and interview preparation.

When a capability already has evidence, the system should identify the example it intends to use and allow the candidate to add a stronger, newer, or more relevant example.

The system should ask follow-up questions only when existing evidence is insufficient for the current opportunity.

REQ-EVIDENCE-007 - Support Clarifying Questions During Problem Simulation

When the candidate needs more context to reason through a simulated problem, the system must allow clarifying questions.

When the answer is known, the system should provide it. When it is unknown, the system must say so rather than inventing details.

The candidate's clarifying questions may be retained as evidence of how she decomposes problems.

REQ-EVIDENCE-008 - Prevent Capability Overstatement

The system must distinguish between:

Direct prior experience

Related or adjacent experience

Demonstrated understanding

Reasonable inference

Unknown or unverified experience

The system must not convert related experience or good hypothetical reasoning into a stronger claim than the evidence supports.

When evidence supports only part of a requirement, the remaining gap must remain visible.

REQ-EVIDENCE-009 - Evaluate Demonstrated Solution Reasoning

When a problem simulation causes the candidate to reason through how she would approach the work, the system may treat that reasoning as evidence of understanding and problem-solving ability.

The system should identify demonstrated reasoning such as:

Systems thinking

Integration thinking

Workflow design

Measurement and baseline creation

Cost or ROI analysis

Technical tradeoff evaluation

Proof-of-concept design

Risk identification

Validation strategy

Demonstrated reasoning must remain distinct from direct prior execution.

Opportunity Evaluation and Scoring
REQ-EVAL-001 - Produce Two-Way Fit Scores

Every fully evaluated opportunity must support two headline scores:

Candidate Fit: You -> Them - how strong the evidence is that the candidate can do the work and presents a credible case for the employer

Opportunity Fit: Them -> You - how well the role, environment, and trajectory align with what the candidate wants and values

The compact display should use the format:

74 / 91 - High-Value Stretch

with the score order clearly defined as:

You -> Them / Them -> You

These scores are decision aids, not probabilities of receiving an interview or offer.

REQ-EVAL-002 - Support Provisional Scores

When important evidence is incomplete, the system may show provisional scores rather than withholding evaluation entirely.

Provisional scoring must clearly indicate:

That the score may change

Which evidence is missing

Whether answering a candidate question could materially change the result

Confidence when useful in the expanded view

REQ-EVAL-003 - Calculate a Hidden Pursuit Score

The system must calculate an internal Pursuit Score used for ranking viable opportunities.

The Pursuit Score should incorporate both Candidate Fit and Opportunity Fit.

The exact weighting must remain configurable or calibratable and must not be treated as final until tested against real candidate decisions.

The Pursuit Score should not be shown by default in the candidate-facing compact view.

REQ-EVAL-004 - Apply Search Strategy to Pursuit Ranking

Balanced, Opportunity-First, and Hireability-First settings must change how Candidate Fit and Opportunity Fit influence ranking.

Search Strategy must not override Hard No constraints.

REQ-EVAL-005 - Assign an Opportunity Type

The system should assign a plain-language opportunity type to help explain the relationship between the two fit scores.

Supported types should include:

Mutual Fit - strong on both sides

Strong Practical Fit - the candidate presents a strong case and the opportunity is acceptable or useful

High-Value Stretch - the candidate strongly wants the opportunity but has meaningful qualification or scale gaps

Bridge Opportunity - useful for income, experience, positioning, or a next step even if it is not an ideal long-term role

Low Priority - viable, but not compelling enough to justify significant effort right now

Opportunity types should support, not replace, the underlying evidence and scores.

REQ-EVAL-006 - Evaluate Problem Fit

The system must evaluate whether the underlying problem resembles problems the candidate has previously solved and enjoyed solving.

The evaluation should consider:

Similarity to previously solved problems

Strength of supporting evidence

Whether the candidate explicitly enjoyed similar work

Confidence in the interpretation of the underlying problem

REQ-EVAL-007 - Evaluate Operating Scope

The system must evaluate whether the role gives the candidate meaningful ownership over a defined part of the business, regardless of total company size.

REQ-EVAL-008 - Evaluate Organizational Proximity

The system must evaluate how close the role appears to be to meaningful business decisions, leadership context, and organizational priorities.

REQ-EVAL-009 - Evaluate Change Latitude

The system must evaluate whether the candidate is expected and permitted to question, test, and improve existing ways of working.

The system should distinguish:

Following an established process

Limited improvement authority

Explicit responsibility to challenge assumptions and redesign work

REQ-EVAL-010 - Evaluate Outcome Clarity

The system must evaluate whether the role provides enough direction, goals, or success measures for the candidate to understand what good performance looks like.

The candidate's preferred environment provides clear goals and context while allowing flexibility in how the result is achieved.

REQ-EVAL-011 - Evaluate Cross-Functional Access

The system must evaluate whether the role allows meaningful access to the people and functions involved in the problem being solved.

Possible signals include access to:

Frontline employees

Sales

Operations

Product

Engineering

Finance

Customer-facing teams

Executive leadership

REQ-EVAL-012 - Evaluate Learning Value

The system must evaluate what meaningful new knowledge, systems, technologies, industries, or business capabilities the candidate could gain.

The system should distinguish learning that builds on an existing foundation from a foundational capability the role expects the candidate to already possess.

REQ-EVAL-013 - Evaluate Career Optionality

The system must evaluate what the candidate could credibly claim after succeeding in the role that she cannot credibly claim today.

Possible examples include:

Greater scale

Enterprise experience

New technical exposure

Leadership scope

Revenue ownership

AI implementation experience

New customer types

New industry access

New decision authority

REQ-EVAL-014 - Evaluate Qualification Gaps

The system must classify meaningful gaps as:

Terminology gap

Implementation gap

Experience gap

Foundational gap

A gap should be evaluated based on:

How central it is to the work

Candidate foundations

Related experience

Expected time to productivity

Whether immediate expertise is required

Whether learning, documentation, AI assistance, or practice could reasonably close it

REQ-EVAL-015 - Separate Candidate Fit From Evidence Confidence

The system must distinguish:

Evidence that the candidate is a poor fit

Evidence that the candidate may be a fit but the Candidate Evidence Library is incomplete

When an opportunity is promising but important evidence is missing, the system must preserve it and identify the smallest useful set of candidate questions.

REQ-EVAL-016 - Evaluate Required Decision Authority

The system must determine whether the role requires the candidate to:

Understand a decision

Gather information and support a decision

Draft or recommend an approach

Coordinate experts

Independently make the final decision

Set standards or mentor others in that area

The system must not treat understanding, coordination, or first-draft capability as equivalent to final technical or business authority.

REQ-EVAL-017 - Evaluate Company and Culture Signals

The system must evaluate available evidence about whether the environment is likely to support the candidate's preferred way of working.

Possible signals include:

Leadership stability

Employee investment

Ethical alignment

Growth opportunities

Organizational support

Employee-review patterns

Recent layoffs

Leadership changes

Micromanagement signals

Lack-of-direction signals

Willingness to support experimentation

REQ-EVAL-018 - Preserve Tradeoffs

The system must preserve meaningful tradeoffs rather than collapsing an opportunity into one unexplained good/bad conclusion.

Examples include:

High learning value but higher company risk

Strong Candidate Fit but weaker Opportunity Fit

Strong Opportunity Fit but meaningful experience gaps

Strong compensation but limited change latitude

REQ-EVAL-019 - Calibrate Scoring With Real Jobs

The scoring model must be calibrated against the candidate's reactions to real opportunities before final weights are treated as reliable.

Daily Work Queue and Prioritization
REQ-QUEUE-001 - Identify Today's One Thing

Every Daily Work Queue must identify one highest-leverage action:

If the candidate completes only one thing today, which action is most likely to move the job search forward, unblock later work, or make other work easier or unnecessary?

The system must explain briefly why that action is Today's One Thing.

A High-Value Stretch opportunity may become Today's One Thing when there is a concrete reason to act now.

REQ-QUEUE-002 - Provide a Checkable Task List

The Daily Work Queue must present candidate actions as discrete, checkable tasks.

Completing a task should update, when applicable:

Opportunity state

Daily grade

Next priority

Follow-up timing

Calendar plan

REQ-QUEUE-003 - Sequence Work for Completion

The system must prioritize and sequence tasks based on both business importance and likelihood of completion.

Relevant signals include:

Urgency

Leverage

Opportunity value

Time sensitivity

Cognitive effort

Estimated completion time

Readiness

Dependency or unblocking value

Existing employer momentum

The system should not rely on a fixed rule such as highest-effort task first.

REQ-QUEUE-004 - Organize Work Into Focus Blocks

The system must be able to organize priority work into defined focus blocks instead of one continuous task list.

Each block should:

Group a manageable amount of work

Include an estimated duration

Provide a clear stopping point

Preserve unfinished work for later reprioritization

REQ-QUEUE-005 - Include a Daily Question

The Daily Work Queue must include one primary question intended to improve future evaluation or preparation while the candidate still has mental energy.

Question priority should be:

Active-opportunity evidence question that could materially change a decision

Recurring Career Development Gap question

Candidate Evidence Library expansion question

Additional questions may appear when answering them materially unblocks real opportunities, but the system should not turn evidence-building into unnecessary homework.

REQ-QUEUE-006 - Prepare Time-Sensitive Tasks Without Unnecessary Interruption

The system must monitor for important new activity while protecting active focus blocks.

When possible, it should prepare the next action in the background and surface it at the next appropriate block.

REQ-QUEUE-007 - Interrupt Only With Prepared Decisions

When an interruption is necessary, the system must provide:

What changed

Why it matters now

What context has already been checked

What preparation has already been completed

What decision or action is required

The system should not interrupt the candidate with raw information when it can reasonably reduce the issue to a decision.

REQ-QUEUE-008 - Reprioritize Unfinished Work

Unfinished tasks must be carried forward and reprioritized against new information rather than remaining tied to the original day.

REQ-QUEUE-009 - Maintain a Dynamic Work Calendar

The system should be able to reserve flexible job-search blocks on the candidate's calendar and update those blocks as priorities, interviews, deadlines, and other commitments change.

Fixed commitments should be preserved unless the candidate explicitly chooses otherwise.

REQ-QUEUE-010 - Verify Task Completion and Debrief

At the end of a work block, the system must determine which planned actions were completed before creating later work.

When possible, completion should be verified from evidence such as:

Sent email

Application confirmation

Calendar event

Employer response

Updated opportunity state

When completion cannot be verified automatically, the system should ask a short confirmation question.

REQ-QUEUE-011 - Provide a Daily Progress Grade

The system must provide a daily grade based on meaningful progress rather than hours worked.

Default grading thresholds:

A+ = 95-100

A = 90-94

B = 80-89 - Successful day

C = 70-79

Below 70 = Needs Attention

Critical and high-leverage work must be completed or appropriately handled before the candidate can earn B or above.

Evidence questions, learning, networking, and other growth work may raise a successful day toward A or A+, but must not compensate for leaving critical work unaddressed.

REQ-QUEUE-012 - Define Done

A grade of B or higher must indicate that required job-search work for the day is sufficiently handled.

The system may offer optional work after that point, but optional work must not make the candidate feel that required work remains incomplete.

REQ-QUEUE-013 - Separate Optional Work

Optional activities should be available in categories such as:

Coffee Shop / Low Pressure

Deep Focus

Quick Tasks

Career Development

REQ-QUEUE-014 - Provide a Tomorrow Preview

The system should provide a concise preview of known upcoming items such as:

Applications likely to be ready

Follow-ups becoming due

Interviews

Employer responses

Evidence questions likely to matter

The preview should provide visibility without pressuring the candidate to begin tomorrow's work today.

Application Preparation and Submission
REQ-APP-001 - Prepare an Application Brief

Before the candidate begins an application, the system must provide a concise brief explaining:

What the company does

What the role is

What problem the company appears to need this person to solve

Why the candidate is being recommended

Strongest supporting evidence

Important qualification gaps or risks

Why the role may be attractive

Recommended next action

REQ-APP-002 - Select or Create the Best Resume

The system must determine whether an existing validated resume is sufficiently aligned.

If yes, it should recommend that resume.

If no, it must prepare a tailored resume using validated Candidate Evidence Library information.

Resume content must not introduce unsupported claims.

REQ-APP-003 - Perform an ATS Readiness Check

Before a resume is marked ready, the system should review:

Parseability

Clear section structure

Relevant terminology

Alignment to important job requirements

Missing supporting evidence

Formatting risks likely to interfere with common applicant-tracking systems

The system must not invent a fake probability of passing ATS or present an unsupported ATS percentage as fact.

REQ-APP-004 - Prepare a Cover Letter When Useful

When a cover letter is requested or likely to add meaningful value, the system should prepare a tailored draft.

The system should avoid unnecessary cover letters when they are not requested and provide little value.

REQ-APP-005 - Review the Application Form

When technically possible, the system must inspect the application process before the candidate begins.

The system should identify:

Required fields

Screening questions

Work authorization questions

Compensation questions

Location and travel questions

Experience questions

Open-text questions

Required documents

Unusual role-specific steps

REQ-APP-006 - Prepare an Application Answer Packet

For questions answerable from validated information, the system must prepare ready-to-review responses in application order when possible.

Responses must:

Remain truthful

Use validated evidence

Answer the specific question

Preserve important nuance

Avoid overstatement

Use the candidate's voice for open-text responses

Reusable validated answers from Settings should be used where appropriate.

REQ-APP-007 - Surface Unresolved Questions

Questions requiring unknown information, personal judgment, or sensitive information must be clearly marked for candidate input.

The system should explain why the answer is unresolved and provide relevant evidence or context when useful.

REQ-APP-008 - Minimize Candidate Application Work

The target candidate experience is:

Read brief -> Review materials -> Resolve remaining questions -> Complete or approve submission

The system should aim to reduce a typical application from roughly 30-60+ minutes of preparation to about 10-15 minutes of candidate review when the application form allows it.

REQ-APP-009 - Support Progressive Application Submission

By default, the system may prepare the full application packet while the candidate retains submission control.

Under an approved higher-autonomy setting, the system may complete and submit an application after the candidate has approved the packet or when the configured rules explicitly permit it.

Approval to submit does not authorize the system to invent or materially change candidate claims.

REQ-APP-010 - Handle New Questions During Submission

If a new question appears after the packet has been approved, the system should:

Draft the best supported answer from validated evidence

Continue preparing the remaining application rather than abandoning the process

Flag the answer for verification when uncertainty matters

If a required question cannot be answered truthfully from available evidence and materially affects the application, the system must request candidate input before final submission.

Opportunity Tracking and Email Monitoring
REQ-TRACK-001 - Maintain Opportunity Status

The system must maintain a current record for every active opportunity.

The record should support states such as:

Discovered

Evaluating

Ready for Review

Applied

Outreach Needed

Outreach Sent

Interview Requested

Interview Scheduled

Interview Completed

Offer

Closed / Rejected

Archived

REQ-TRACK-002 - Update Status From Email Activity

The system must use relevant employer emails to update opportunity status when the message provides sufficient evidence.

Examples:

Application confirmation -> Applied

Interview request -> Interview Requested

Rejection -> Closed / Rejected

Offer -> Offer

Recruiter follow-up -> Action Required

When status cannot be determined confidently, the system must request review rather than guess.

REQ-TRACK-003 - Organize Low-Value Application Emails

Application confirmations and other informational emails that do not require action should be organized so they do not clutter the candidate's inbox.

Possible actions include:

Apply label

Archive email

Update opportunity record

The original email must remain retrievable.

REQ-TRACK-004 - Surface Actions, Not Notifications

The system should primarily surface employer updates when they require a decision or action.

Routine information may update the tracker quietly.

REQ-TRACK-005 - Handle Rejections Based on Usefulness

Routine rejections should update the tracker without becoming a priority task.

A rejection should be surfaced when it contains:

Actionable recruiter feedback

A meaningful recurring pattern

Information that should change strategy

A signal relevant to the Career Gap Library

REQ-TRACK-006 - Detect Stalled Opportunities

The system must identify active opportunities where expected progress has not occurred within an appropriate period.

Examples:

Applied but no outreach completed

Outreach sent but no response

Interview completed but no follow-up sent

Employer response expected but not received

The system should recommend a next step when additional action may help.

REQ-TRACK-007 - Preserve Full Opportunity History

The system must retain enough history to answer questions such as:

When did I apply?

What resume did I use?

Who did I contact?

What did I send?

Did they reject me?

When did I last follow up?

What interviews happened?

What feedback did I receive?

REQ-TRACK-008 - Keep Background Administration Out of the Work Queue

Administrative updates that do not require candidate input should happen in the background.

REQ-TRACK-009 - Coordinate Multiple Opportunities at the Same Company

Before recommending or preparing a new application, the system must check for active, historical, or recently closed opportunities at the same company.

When multiple roles exist, the system should evaluate:

Role similarity

Whether the opportunities tell a coherent candidate story

Current status of existing applications

Existing recruiter or hiring-team relationships

Whether multiple applications could create confusion

Whether one role appears materially stronger

Whether contacting an existing recruiter is more useful than submitting another application

The company must be treated as shared context across its opportunities.

Outreach and Relationship Building
REQ-OUTREACH-001 - Identify Relevant Outreach Targets

The system must identify people who may reasonably help move an opportunity forward.

Potential targets include:

Person publicly posting about the role or team

Recruiter

Hiring manager

Leader of the hiring team

Relevant local or functional leader

Existing or natural connection

REQ-OUTREACH-002 - Prioritize Natural Outreach Paths

When multiple targets exist, the system should prioritize the strongest natural reason for contact rather than seniority alone.

Priority signals may include:

Public hiring post

Direct recruiting responsibility

Likely ownership of the hiring decision

Existing relationship

Shared professional context

Relevant geographic or functional connection

REQ-OUTREACH-003 - Support Progressive Relationship Building

The system should support outreach as a progression rather than treating every opportunity as an immediate cold-message task.

Possible sequence:

Follow or connect

Observe relevant public activity

Engage naturally when useful

Send direct outreach when timing makes the message valuable

REQ-OUTREACH-004 - Time Outreach Based on Opportunity State

The system must determine when outreach is appropriate based on factors such as:

Whether the application was submitted

How recently it was submitted

Whether the target has interacted with the candidate

Whether the target publicly discussed hiring

Whether the employer already responded

How long the opportunity has remained inactive

REQ-OUTREACH-005 - Prepare Outreach Actions

When outreach is recommended, the system should prepare:

Who to contact

Why that person was selected

Existing relationship or context

Recommended action

Draft message when useful

Actual sending is governed by the configured autonomy level.

Interview Preparation
REQ-INTERVIEW-001 - Trigger Interview Preparation

When an interview is scheduled, the system must create or prioritize an interview-preparation task and reuse all relevant research already performed for the opportunity.

REQ-INTERVIEW-002 - Prepare a Problem-First Interview Brief

The brief must explain:

What the company does

What the role appears to exist to solve

What the candidate would likely spend time doing

Why the candidate was originally recommended

Strongest supporting evidence

Important gaps likely to be questioned

REQ-INTERVIEW-003 - Generate Likely Interview Questions

Likely questions must be based on the actual job requirements and company context rather than primarily on generic interview templates.

For each question, the system should explain:

What problem or situation is behind the question

What the interviewer is likely trying to understand

Which candidate experience may be most relevant

REQ-INTERVIEW-004 - Provide "What's the Tea?" Company Context

The interview brief should include an engaging summary of relevant recent context such as:

Company news

Leadership changes

Layoffs or major hiring

Funding or acquisition activity

Product launches

Strategic changes

Employee-review themes

Customer or market reactions

Hiring patterns

Confirmed information, inference, opinion, and unverified claims must be distinguished.

REQ-INTERVIEW-005 - Select the Best Evidence for Each Question

For each likely question, the system must determine what the interviewer is actually trying to learn and choose the candidate story that best proves that capability.

Story selection should consider:

Problem similarity

Measurable outcome

Scale relevance

Recency when useful

Clarity of personal contribution

Evidence strength

Ease of accurate, natural explanation

REQ-INTERVIEW-006 - Prepare Talking Points Instead of Scripts

The system should prepare concise story talking points rather than full scripts unless explicitly requested.

Each story should include:

Situation or problem

Candidate's role

Key actions

Outcome

Important facts not to forget

Likely follow-up questions

REQ-INTERVIEW-007 - Support Interactive Practice

Interview practice should ask one question at a time, allow a natural response, and then provide focused feedback on:

Whether the question was answered

Whether the strongest evidence was used

Missing context

Unnecessary length or confusion

Unsupported claims

Likely follow-up questions

Automation Boundaries and External Actions
REQ-SAFETY-001 - Escalate Unverified Material Claims

When an external communication requires a material claim that is not supported by validated evidence, the system must not invent or overstate the answer.

It should provide:

Exact question or claim

Relevant supporting evidence

Specific uncertainty

Why confidence is limited

What candidate decision or verification is needed

REQ-SAFETY-002 - Support Progressive Autonomy

The system must support configurable autonomy levels by action type:

Prepare Only

Approve Before Action

Act Within Rules

Autonomous

The candidate must be able to change the permitted level for each action category without redesigning the workflow.

REQ-SAFETY-003 - Learn Without Self-Granting Permissions

The system may learn from approvals, edits, corrections, and repeated behavior.

It must never grant itself additional external-action authority.

Any increase in autonomy must be explicitly approved by the candidate.

REQ-SAFETY-004 - Apply the Same Evidence Rule Across External Actions

Applications, recruiter email, outreach, scheduling messages, and other external communications must use the same principle:

Use validated evidence to keep the work moving. Escalate uncertainty, not routine execution.

REQ-SAFETY-005 - Preserve Action History

For any action prepared or performed, the system must retain:

Proposed or performed action

Why it was recommended

Information used

Whether approval was required

Candidate edits or corrections

Final outcome when available

Research, Trust, and Source Handling
REQ-TRUST-001 - Distinguish Facts From Inference

The system must clearly distinguish:

Confirmed information

Candidate-provided information

Publicly reported information

Employee or customer opinion

Reasonable inference

Unknown or unverified information

REQ-TRUST-002 - Use Relevant LinkedIn Activity as Context

When access is available, the system should review relevant public LinkedIn activity associated with the company.

Priority may be given to:

People the candidate follows or is connected with

Hiring-team employees

People publicly discussing hiring

Relevant leaders

Recruiters associated with the role

LinkedIn activity is contextual evidence and must not be presented as confirmed internal company information unless directly supported.

REQ-TRUST-003 - Resolve Conflicting Information Transparently

When sources conflict, the system must not silently choose one value.

The system should consider:

Source authority

Freshness

Independent corroboration

Whether the source is employer-controlled

Whether the source may be stale or copied

Unresolved material conflicts must be shown to the candidate.

REQ-TRUST-004 - Evaluate Information Freshness

The system must consider freshness for:

Job postings

Compensation

Work arrangement

Hiring announcements

Leadership information

Company news

Employee activity

Open-role patterns

Older information may be used for background but must not be presented as current without support.

REQ-TRUST-005 - Use Low-Cost Verification Before Expensive Work

When an opportunity appears promising but uncertain, the system should use the cheapest reasonable verification step before committing substantial research or preparation resources.

REQ-TRUST-006 - Represent Uncertainty Explicitly

The system should distinguish:

Known

Strongly supported

Reasonably inferred

Unknown

When an unknown could materially affect a decision, the system should identify the lowest-cost useful way to resolve it.

REQ-TRUST-007 - Preserve Evidence Traceability

For material claims, the system must preserve:

Source

Source type

Retrieval or publication date when available

Whether the final statement is directly supported or inferred

Direct link when available

The candidate should be able to answer "How do you know that?" without repeating the research.

Non-Functional Requirements
Usability and Attention

NFR-USABILITY-001 - Keep Candidate-Facing Outputs Concise

Outputs must lead with the decision, conclusion, or required action.

The system should:

Use plain language

Avoid unnecessary repetition

Keep detailed research available on demand

Prefer short summaries over long reports

NFR-USABILITY-002 - Protect Candidate Attention

The system must avoid presenting too many items as equally important.

Work should be separated into:

Today's One Thing

Priority work

Later today

Tomorrow

Optional

Background

Accuracy and Trust

NFR-TRUST-001 - Prioritize Accuracy Over Speed

The system must prefer reliable, well-supported output over faster unsupported output.

Uncertain information must be qualified rather than presented confidently.

Memory and Retrieval

NFR-PRIVACY-001 - Use Indexed, Purpose-Driven Retrieval

The opportunity tracker or other system of record should act as an index for locating relevant context across connected sources.

Targeted retrieval should begin with known information such as:

Company

Role

Recruiter or contact

Email domain

Application date

Known threads

Previous company applications

Related opportunities

Existing outreach contacts

Broader retrieval should occur only when targeted context is insufficient.

NFR-PRIVACY-002 - Allow Relevant Cross-Context Research

The system may search across connected sources when doing so serves a defined job-search purpose.

Examples include:

Previous applications to the same company

Prior recruiter conversations

Similar roles previously pursued

Historical interview activity

Application confirmations or rejections

Relevant relationships

The system should not perform broad searches without a defined research question.

NFR-PRIVACY-003 - Separate Career Context From Unrelated Personal Context

Career-relevant information may be reused across evaluation, applications, outreach, tracking, and interview preparation.

Sensitive or unrelated personal information should not automatically appear in professional outputs or Candidate Evidence unless the candidate explicitly determines it is relevant.

Reliability

NFR-RELIABILITY-001 - Report Partial Processing Failures

When a scheduled run is incomplete, the next candidate-facing queue must show a concise system-status note including:

What completed

What remains

Whether priority work may be incomplete

Whether automatic retry will occur

Whether candidate action is needed

NFR-RELIABILITY-002 - Isolate and Retry Failures

A failure involving one opportunity, source, or external service must not stop unrelated processing.

The system should:

Record the failed step

Continue unrelated work

Retry when appropriate

Avoid duplicate work during retries

Mark the item incomplete when retries fail

Surface candidate action only when human input may help

NFR-RELIABILITY-003 - Prevent Duplicate Work During Retries

Repeated processing must not create duplicate:

Opportunity records

Application tasks

Outreach tasks

Resume drafts

Cover letters

Email drafts

Calendar events

Follow-up tasks

Interview-preparation tasks

Retries should resume or update existing work.

Performance

NFR-PERFORMANCE-001 - Keep Candidate-Facing Actions Responsive

Candidate-facing actions should feel immediately usable.

Long-running research, verification, company analysis, and batch processing should occur in the background whenever possible rather than blocking interaction.

Freshness

NFR-FRESHNESS-001 - Refresh Priority Context Before the Daily Queue

Before presenting the Daily Work Queue, the system must refresh time-sensitive information that could materially change priority or opportunity status.

Examples include:

New recruiter or employer email

Interview requests

Application confirmations

Rejections

Job closures or updates

Outreach responses

Recent hiring activity relevant to active opportunities

The system should refresh only information likely to affect immediate priorities rather than repeating full research every morning.

Requirement-Level Principles

The following principles apply across the entire system:

Translate first. Judge second.

Problem similarity matters more than keyword similarity.

Missing evidence is not the same as missing capability.

Demonstrated reasoning is useful evidence, but it is not the same as direct execution.

Hard constraints override scoring.

Preserve tradeoffs instead of hiding them inside one number.

Track everything. Surface only what needs attention.

The Daily Work Queue is for action. The tracker is for memory.

Today's One Thing is the highest-leverage action available.

Critical work establishes a successful day. Growth work improves the grade.

Use the cheapest useful verification before expensive research or preparation.

The system may learn from the candidate, but it may not grant itself more authority.

External claims must remain evidence-backed.

Accuracy is more important than speed.

The system should improve future career optionality without turning every missing skill into homework.
