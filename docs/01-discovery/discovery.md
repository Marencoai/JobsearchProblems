# Job Search AI Agent
## Discovery

### 1. Problem Statement

The current job-search process requires too much time identifying, understanding, evaluating, and applying to opportunities, leaving less time for targeted outreach and other activities that are more likely to move an opportunity forward.

Job descriptions also create an evaluation problem. Roles are frequently described using industry terminology, technical requirements, and hiring language that can make unfamiliar work appear outside the candidate's capabilities even when the underlying problem or responsibility is similar to work the candidate has already performed.

As a result, potentially relevant opportunities may be rejected too early, while significant time is spent manually interpreting job descriptions, determining actual qualification gaps, preparing applications, and deciding what deserves attention.

The lack of a consistent daily job-search workflow also creates unnecessary cognitive load. The candidate must repeatedly decide what to search, what to evaluate, what to apply to, who to contact, and what to follow up on rather than beginning each day with a prioritized set of actions.

#### Discovery Findings
- Candidate's experience spans multiple potential job categories, making prioritization difficult.
- Reviewing and evaluating individual opportunities requires significant manual effort.
- Direct outreach has resulted in interviews, while applications submitted without outreach have not produced the same results.
- Time spent processing applications reduces time available for targeted outreach.
- Job descriptions frequently use technical terminology, acronyms, and hiring language that makes it difficult for the candidate to recognize when unfamiliar requirements represent work she already understands or could realistically learn.
- The candidate needs job requirements translated into the underlying problem, actual day-to-day work, and purpose of the requested skill before accurately evaluating her own fit.
- The current job-search process lacks a consistent daily operating rhythm, requiring the candidate to repeatedly determine what deserves attention instead of beginning with prioritized actions.


### 2. Current State

Jobs currently enter the process primarily through LinkedIn and Indeed job alerts, as well as hiring posts encountered on LinkedIn.

#### Current Workflow

1. A job or hiring opportunity is discovered through LinkedIn or Indeed.
2. If the opportunity comes from a hiring post, the candidate may follow people associated with the company.
3. The candidate visits the company's careers website and reviews available roles.
4. Potentially relevant job descriptions are copied into the ChatGPT Job Hunting project.
5. ChatGPT compares the roles against the candidate's work history, project experience, and transferable skills.
6. Once a strong match is identified, ChatGPT creates a tailored resume and cover letter.
7. The documents may be moved into Claude for additional formatting and polishing.
8. The application is submitted.
9. The candidate attempts to identify someone at the company who could help move the application forward.
10. When someone has publicly posted about hiring, that person is currently the primary outreach target. When no obvious person exists, there is no consistent outreach process.

#### Current Tools

- LinkedIn
- Indeed
- Company career websites
- ChatGPT
- Claude

#### Current Process Gaps

- No consistent method exists for prioritizing incoming job alerts.
- Job fit evaluation relies on manual review through ChatGPT.
- Resume and cover letter creation requires multiple tools.
- No consistent method exists for identifying the best person for outreach.
- The overall workflow is largely manual and repeated for each opportunity.

### 3. Desired State

The desired job-search process reduces the candidate's daily administrative workload while preserving human control over important decisions and communication.

The goal is to reduce job searching, evaluation, application preparation, and outreach from a large portion of the workday to approximately 1–2 focused hours per day.

#### Desired Experience

Each morning, the candidate should receive a prioritized Daily Job Search Work Queue containing the actions most likely to move the job search forward. New opportunities should already be researched and evaluated before they enter that queue.

For each recommended opportunity, the candidate should be able to quickly understand:

- What the job is and what the company does.
- Why the candidate is qualified.
- Why the opportunity may be personally attractive based on validated work preferences.
- Where meaningful qualification gaps exist.
- What application materials have been prepared.
- Who may be valuable to contact and why.
- What actions require candidate review or approval.

The system should prepare as much of the application process as possible, including job-specific materials and application questions, while allowing the candidate to review before submission.

LinkedIn outreach should be researched and drafted, but reviewed by the candidate before being sent.

Application responses should be monitored. If an interview is requested, the process should support scheduling based on calendar availability and trigger an interview-preparation workflow so the candidate understands the company, role, and reasons the opportunity was originally recommended.

#### Validated Work Preferences

The candidate is most likely to thrive in roles that provide:

1. Autonomy with clear leadership direction and priorities.
2. Complex or ambiguous problems to investigate and solve.
3. High learning velocity and exposure to new systems, technologies, or domains.
4. Opportunities to build systems that make other people more capable or effective.
5. Visible and measurable impact from the work.
6. Access to organizational context and leadership.
7. Fair compensation, supportive culture, employee investment, and growth opportunities.
8. Ethical alignment with company leadership and business practices.

The preferred operating environment is not micromanagement or complete lack of direction. The ideal environment provides clear goals, context, and priorities while giving the candidate authority to determine how those goals are achieved.

### 4. Inputs

The system requires information from five primary input categories.

#### 1. Candidate Profile

- Contact information
- Location
- Employment history
- Project history
- Education and certifications
- LinkedIn profile and professional presence
- Skills and capabilities
- Achievements and measurable outcomes
- Detailed evidence supporting skills and capabilities
- Existing resumes and career materials

The candidate profile should extend beyond a traditional resume. It should preserve enough evidence for the system to identify transferable capabilities even when an exact skill, technology, or responsibility is not explicitly listed on the resume.

#### 2. Candidate Preferences and Career Direction

Validated preferences include:

- Autonomy with clear leadership direction
- Complex and ambiguous problems
- High learning velocity
- Opportunities to improve systems and enable people
- Visible and measurable impact
- Proximity to leadership and organizational decision-making
- Supportive culture and investment in employees
- Fair compensation and benefits
- Ethical alignment with leadership
- Opportunities for increased responsibility and influence
- Remote work, hybrid or onsite work in San Diego, with flexibility for exceptional opportunities requiring occasional travel
- Opportunities that improve long-term career optionality

The candidate has an aspirational financial goal of building significant financial security by 2030. This should be treated as directional context rather than a strict compensation requirement.

Career opportunities should also be evaluated for what new experience, credibility, capabilities, relationships, or exposure they could provide for future roles that may not exist today.

#### 3. Job Opportunity Data

- Job title
- Full job description
- Responsibilities
- Required and preferred qualifications
- Compensation
- Benefits when available
- Location
- Remote, hybrid, or onsite requirements
- Travel requirements
- Reporting structure when available
- Application requirements and questions
- Original job posting URL
- Source of the opportunity

#### 4. Company Intelligence

- Company size and stage
- Product or service
- Business model
- Mission and stated values
- Leadership
- Recent company news
- Growth or funding information when relevant
- Current open positions
- Hiring patterns across the organization
- Employee reviews and recurring themes
- Recent layoffs or leadership changes
- Available information about organizational structure
- Signals that may help explain why the position is being hired

Company and hiring-pattern analysis should be treated as evidence for informed hypotheses, not as confirmed facts about internal company conditions.

#### 5. Application Activity

The system should maintain the history and current state of each opportunity, including:

- Date discovered
- Date evaluated
- Fit evaluation
- Application materials prepared
- Date applied
- Application confirmation
- Outreach target
- Outreach status
- Follow-up activity
- Employer responses
- Interview requests
- Interview dates
- Rejections
- Offers
- Final outcome

Email activity may provide evidence that changes the status of an opportunity, such as an application confirmation, interview request, rejection, or follow-up.

### 5. Decisions

The system must support a series of decisions about whether an opportunity is worth pursuing. Evaluation should not rely solely on literal keyword matching between the candidate's resume and the job description.

#### 1. Is this opportunity worth investigating?

Before performing deep research, determine whether the opportunity has enough potential alignment to justify further evaluation.

This should consider:

- General role and responsibilities
- Location and work arrangement
- Compensation when available
- Relevant candidate experience
- Potentially transferable experience
- Career direction and future optionality

The purpose of this stage is to prioritize opportunities, not make a final apply/skip decision.

#### 2. What problem is the company actually hiring someone to solve?

Translate the job description from hiring language into plain English.

The evaluation should identify:

- The underlying business problem
- What the employee would actually spend time doing
- Why the listed skills or technologies are necessary
- What successful performance would likely look like

Technical terminology should not simply be defined.

For example, rather than:

"Apex is Salesforce's programming language."

The translation should explain:

"They need someone who can create custom backend business logic when Salesforce's standard configuration and automation tools cannot handle the required behavior."

#### 3. Has the candidate solved this problem or a structurally similar problem before?

Compare the underlying problem against the Candidate Evidence Library, including:

- Direct experience
- Project experience
- Transferable experience
- Similar problems solved in different industries
- Demonstrated learning ability
- Relevant technical foundations
- AI-assisted implementation experience

Job titles and exact keyword matches should not be treated as the only evidence of capability.

#### 4. What is actually missing?

For requirements without direct evidence, determine the nature of the gap.

Classify gaps as:

**Terminology Gap**
The candidate understands or has performed the underlying work but does not use the terminology appearing in the job description.

**Implementation Gap**
The candidate understands the underlying problem and system but would need to learn a specific tool, language, platform, or implementation method.

**Experience Gap**
The candidate has related capabilities but has not yet operated at the scale, complexity, or depth expected by the role.

**Foundational Gap**
The role depends heavily on expertise the candidate does not currently possess and could not reasonably acquire while becoming productive in the role.

A missing requirement should not automatically disqualify an opportunity.

#### 5. Is the gap realistically bridgeable?

Consider:

- Existing foundational knowledge
- Similar work previously completed
- Demonstrated speed of learning
- Ability to use AI, documentation, and other resources to close implementation gaps
- How central the missing capability is to the role
- Whether the employer likely needs that expertise immediately

The system should distinguish between:

"I have not done this exact thing before."

and:

"I do not currently have the foundation required to perform this job."

#### 6. Is the opportunity worth pursuing?

The final decision should consider both candidate fit and opportunity value.

This includes:

- Ability to perform the role
- Size and severity of remaining gaps
- Work preferences
- Company environment
- Compensation and benefits
- Learning opportunity
- Proximity to meaningful problems and decision-makers
- Potential for increased responsibility
- Career optionality
- Experience and credibility the candidate could gain for future roles

The evaluation should answer both:

"Can I reasonably do this job?"

and:

"Where could doing this job take me next?"

#### 7. What action should happen next?

Each evaluated opportunity should result in a recommended next step, such as:

- Research further
- Prepare for candidate review
- Apply
- Identify outreach target
- Follow up
- Prepare for interview
- Close or archive opportunity

Important external actions, including application submission and LinkedIn outreach, should remain subject to candidate review unless explicitly approved for automation.
#### Communication Standard

All job evaluations must be written in plain, everyday language.

The system should assume the candidate may not know industry terminology, technical terminology, or acronyms, even when the candidate understands the underlying work.

Translation should explain:

- What the company actually needs someone to do.
- Why a specific skill or technology is needed.
- What using that skill would look like in the actual job.
- What similar work the candidate has already done.
- What the candidate would genuinely need to learn.

Replacing one technical term with another technical term does not count as translation.

The final recommendation should explain the opportunity as if a knowledgeable person were sitting beside the candidate and helping them decide whether the job is worth their time.

### 6. Outputs

The primary output should not be a large report of every job the system discovers.

The primary output should be a prioritized Daily Job Search Work Queue that tells the candidate exactly what deserves attention today.

#### Daily Work Queue

Each morning, the system should prioritize the actions most likely to move the candidate toward employment.

Examples include:

- Review and submit a prepared application
- Review and send an outreach message
- Follow up with an existing contact
- Respond to an employer
- Schedule an interview
- Prepare for an upcoming interview

Each task should explain:

- What needs to be done
- Why it matters
- What work has already been completed
- What the candidate needs to review or decide
- Estimated time required

The system should prioritize tasks rather than requiring the candidate to determine what to work on first.

The candidate can override the prioritization when desired.

#### Opportunity Brief

When a job requires candidate review, the system should explain it in plain language, including:

- What the company actually needs someone to do
- Why the opportunity was selected
- Why the candidate may be able to do the job
- Relevant previous experience
- What the candidate does not currently know
- Whether those gaps appear realistically bridgeable
- Why the candidate may enjoy the role
- Potential concerns or risks
- What experience or career opportunities the role could unlock
- Recommended next action

#### Definition of Done

The system should create a clear definition of when the important job-search work for the day has been completed.

Once priority work is complete, the candidate should be told that everything requiring attention has been handled.

The system should not create an endless stream of required work simply because additional tasks exist.

#### Optional Work

If the candidate wants to continue working after priority tasks are complete, the system may provide optional activities organized by effort or environment.

Examples:

**Coffee Shop / Low Pressure**
- Research an interesting company
- Connect with relevant professionals
- Explore emerging roles
- Add experience to the Candidate Evidence Library

**Deep Focus**
- Interview preparation
- Career research
- Improve application materials
- Complete detailed company research

**Quick Tasks**
- Send a follow-up
- Review an outreach message
- Update an application status
- Respond to a recruiter

#### Tomorrow Preview

The system should provide a short preview of known upcoming work, such as:

- Applications likely to be ready
- Follow-ups becoming due
- Upcoming interviews
- Employer responses requiring attention

The purpose is to provide visibility without requiring the candidate to begin tomorrow's work today.

### 7. Pain Points

#### Opportunity Discovery and Evaluation

- Significant time is spent reviewing job alerts and job boards before identifying opportunities worth pursuing.
- Job descriptions are difficult to evaluate because terminology and requirements often obscure what the employee would actually be expected to accomplish.
- The candidate may reject potentially viable opportunities because an unfamiliar term appears to represent a larger capability gap than actually exists.
- Researching the company, role, reviews, leadership, and other signals is repeated manually for every opportunity.
- By the time a promising opportunity is identified, significant time and mental energy have already been spent.

#### Application Preparation

- The current resume is an incomplete and compressed representation of the candidate's actual experience.
- Important experience may be missing, simplified, or described inaccurately when reused across applications.
- Tailoring a resume can take approximately one hour per opportunity.
- Additional time is spent reviewing ATS alignment and completing application forms.
- The candidate's resume is currently being used as both an input and an output, causing relevant experience to be lost through repeated summarization.
- Application preparation often consumes the energy needed for higher-value outreach.

#### Opportunity Tracking and Outreach

- Applications are not consistently tracked beyond email labels.
- Managing multiple active opportunities creates significant cognitive load.
- The candidate has therefore tended to focus on one serious opportunity at a time.
- There is no consistent process for identifying the best person to contact after applying.
- Relationship building with target companies is currently opportunistic rather than systematic.
- Follow-ups and next actions depend heavily on the candidate remembering what needs attention.

#### Daily Structure

- The candidate currently lacks the external operating rhythm previously provided by a workplace.
- Each day begins with deciding what to work on rather than executing an already-prioritized set of actions.
- The absence of a clear definition of "done" can create pressure to continue working even when important work has been completed.

#### Interview Preparation

- Traditional competency-based interview language can make it difficult for the candidate to immediately connect a question with relevant experience.
- Interview preparation is more effective when requirements and questions are translated into the underlying business problem first.
- Existing research and evaluation performed earlier in the application process is not currently reused systematically for interview preparation.

#### Core Cognitive Friction

The candidate appears to reason most effectively from concrete problems rather than abstract competencies or terminology.

The preferred reasoning sequence is:

**What problem are they dealing with? → What are they trying to accomplish? → Have I dealt with something similar? → What did I do?**

The system should preserve this problem-first structure throughout job evaluation, application preparation, and interview preparation.

### 8. Open Questions

#### Candidate Evidence Library

How should the Candidate Evidence Library be structured so the system has a complete and accurate understanding of the candidate's experience, capabilities, projects, accomplishments, transferable skills, and demonstrated learning ability?

The library must contain significantly more detail than a traditional resume while remaining structured enough for the system to reliably compare candidate evidence against job requirements.

#### Job Description Translation

How should the system translate job descriptions into the underlying business problem, actual day-to-day work, and purpose of individual requirements?

The translation process must determine:

- What can be stated directly from the job description.
- What additional company research should be used.
- When an underlying business problem can reasonably be inferred.
- How inferred conclusions should be labeled.
- How technical requirements should be translated into what the employee would actually use them to accomplish.
- How much detail is necessary for the candidate to accurately understand the work without creating unnecessary cognitive load.

The system must distinguish between confirmed information and reasonable inference rather than presenting assumptions as facts.
The evidence-capture process must also address a two-way terminology problem.

The candidate may describe experience in plain language without knowing the professional or technical terminology commonly used to describe the work.

For example, the candidate may describe:

"I interviewed the user about the current process, identified where it was breaking down, and documented what the new system needed before building it."

That experience may demonstrate professionally recognized capabilities such as:

- Requirements elicitation
- Current-state process mapping
- User needs analysis
- Gap analysis
- Functional requirements definition

The Candidate Evidence Library should therefore support the following process:

**Candidate story → What actually happened → Actions performed → Outcome → Professional/technical capabilities demonstrated → Candidate validation**

Professional terminology should be generated from documented evidence, not assumed solely because it appears plausible.

This creates translation in both directions:

**Job requirement → Plain-language explanation**

and

**Candidate experience → Professional terminology**

#### Qualification Gap Evaluation

How should the system determine whether a missing qualification represents a terminology gap, implementation gap, experience gap, or foundational gap?

The evaluation must consider:

- How central the missing capability is to the actual job.
- Whether the candidate understands the underlying problem the skill is used to solve.
- Relevant foundational knowledge and adjacent experience.
- Evidence of similar skills being learned successfully in the past.
- Whether AI, documentation, training, or practice could realistically close the gap.
- How quickly the employer likely expects the employee to be productive.
- Whether the role requires the candidate to perform the skill personally or primarily understand, manage, or collaborate around it.

The system must avoid both automatically rejecting unfamiliar requirements and overstating the candidate's ability to perform work for which there is insufficient evidence.

#### Opportunity and Work Prioritization

How should the system determine which opportunities and actions deserve the candidate's attention first?

Prioritization may need to consider:

- Strength of candidate fit
- Quality of the opportunity
- Career optionality
- Application deadlines or posting age
- Existing relationships or warm connections
- Employer responses requiring action
- Interviews and scheduled commitments
- Follow-ups that are due
- Time required to complete the task
- Potential value of acting quickly
- Candidate energy or task environment when relevant

The system must distinguish between:

- Important work that should be completed today
- Work that can wait
- Optional work that may be useful if additional time is available

The prioritization method and weighting have not yet been determined.
#### Opportunity Tracking and System of Record

Where should the system maintain the authoritative record of jobs, applications, outreach, employer responses, interviews, and next actions?

The solution must determine:

- What information should be stored for each opportunity.
- How duplicate job postings should be identified.
- How opportunity status should change over time.
- How email activity should update opportunity status.
- How outreach and follow-up activity should be tracked.
- How interview activity should connect back to the original job research and evaluation.
- How historical opportunities should be retained.
- Whether the candidate should be able to manually correct or override system-generated status changes.

The appropriate storage method and technology have not yet been determined.

#### Automation and Human Approval Boundaries

Which actions may the system perform automatically, and which actions require candidate review or approval?

Potential actions include:

- Reading job-alert emails
- Researching jobs and companies
- Evaluating opportunities
- Creating or updating opportunity records
- Preparing resumes and cover letters
- Drafting application-question responses
- Navigating application forms
- Submitting applications
- Identifying outreach targets
- Drafting outreach messages
- Sending email
- Sending LinkedIn messages
- Following up with contacts
- Reading employer responses
- Updating application status
- Checking calendar availability
- Responding with interview availability
- Creating calendar events

The system should minimize unnecessary candidate involvement while preserving human review for actions where errors, misrepresentation, or unwanted communication could have meaningful consequences.

The exact approval boundaries have not yet been determined.

#### Learning and Feedback

How should the system learn from job-search outcomes and candidate feedback over time?

The system should eventually be able to evaluate whether its recommendations are producing useful results.

Potential feedback signals include:

- Opportunities the candidate chooses to pursue or skip
- Applications that result in interviews
- Applications that result in rejection
- Outreach that receives responses
- Types of people or outreach approaches that produce conversations
- Candidate reactions after speaking with a company
- Qualification gaps that employers actually question
- Interview feedback
- Offers
- Roles the candidate ultimately accepts or rejects

Feedback should be used to improve future evaluation and prioritization without automatically treating every rejection as evidence that the candidate was unqualified.

The method for learning from these outcomes has not yet been determined.
### 9. Assumptions

#### Public Job Posting Represents an Available Opportunity

The current process assumes that a publicly listed job represents an opportunity that is actively available to external candidates.

This may not always be true. A posting may:

- Have a preferred or likely internal candidate.
- Be required to be posted despite an existing candidate.
- Remain published after hiring priorities have changed.
- Represent a role that is temporarily paused or no longer actively being filled.
- Provide insufficient public information to determine how actively the company is recruiting.

The system should not claim to know whether a posting is a "real" external opportunity without supporting evidence.

Where useful, the system may identify signals that suggest stronger or weaker hiring activity, but these should be presented as signals rather than facts.

#### Job Alerts Provide Sufficient Opportunity Coverage

The current process assumes that LinkedIn and Indeed job alerts provide a sufficiently useful pool of opportunities for the system to evaluate.

This has not yet been validated.

Relevant opportunities may be missed because:

- The candidate fits multiple job categories and titles.
- Similar work may be described using unfamiliar job titles.
- Job-alert algorithms may rely heavily on previous searches, profile information, or keywords.
- Emerging roles may not match traditional titles associated with the candidate's previous experience.
- Strong opportunities may exist at target companies without appearing in existing alerts.

The effectiveness of existing job alerts should be tested before they are treated as the system's primary or only source of opportunity discovery.

#### Candidate Evidence Can Be Captured Accurately

The system assumes that the candidate's experience can be documented with enough accuracy and detail for AI to make reliable comparisons against job requirements.

This has not yet been validated.

Potential issues include:

- Important experience may have been forgotten or never documented.
- Existing resumes and LinkedIn profiles contain only compressed versions of the candidate's experience.
- Previous descriptions may contain inaccuracies or oversimplifications.
- The candidate may understand or have performed work without knowing the terminology commonly used to describe it.
- The candidate may routinely perform professionally recognized practices or technical work without knowing the formal terminology used to describe those capabilities.
- AI may infer capabilities that are plausible but not actually supported by candidate evidence.

The Candidate Evidence Library should distinguish between documented experience, reasonable inference, and unsupported assumptions.

The candidate must be able to correct, expand, or invalidate evidence used by the system.
