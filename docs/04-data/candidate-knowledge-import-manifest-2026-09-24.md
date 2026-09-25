# Candidate Knowledge Import Manifest

**Project:** JobsearchProblems  
**Candidate:** Diana Marenco  
**Prepared:** 2026-09-24  
**Status:** APPROVED FOR INITIAL IMPORT — import script generated; no Candidate Knowledge rows have been written yet.

## 1. Purpose

This manifest converts the candidate's existing resume, LinkedIn/context material, and the 2026-09-24 calibration review into the structured Candidate Knowledge model already deployed in Supabase.

The import target is:

- `work_experiences`
- `projects`
- `project_work_experiences`
- `evidence_stories`
- `skills`
- `tools`
- `project_skills`
- `evidence_story_skills`
- `project_tools`
- `evidence_story_tools`

This is not a resume import. The goal is to preserve reusable professional truth at the level needed for evaluation, application preparation, outreach, and interview preparation.

## 2. Source and validation rules

Use sources in this order:

1. Candidate corrections and confirmations from the 2026-09-24 calibration session.
2. Current LinkedIn / master-context material.
3. Recent role-specific and AI-strategy resume versions.
4. Professional translation derived from the above, clearly marked as translation/inference rather than a new factual claim.

Rules:

- Candidate-confirmed facts override older resume wording.
- Do not silently average, merge, or "clean up" conflicting metrics.
- Do not create unsupported capabilities from related experience.
- Professional terminology may describe confirmed work but must not replace the underlying candidate story.
- Source-derived records not directly reviewed during calibration remain `candidate_review_needed`.
- Inferred skill links remain `inferred` or `candidate_review_needed` until confirmed.
- Do not invent exact day-level dates when the source provides only month/year.

## 3. Calibration decisions already confirmed by candidate

The following decisions were explicitly confirmed during the calibration review:

- Alpine Development Collaborative engagement ended September 2026.
- Alpine is the canonical Work Experience for the recent affordable-housing engagement; do not duplicate the same body of work as a second MarencoAI Work Experience in this import.
- Levo's Zoho → Salesforce Migration and Salesforce Business Logic / Lending Platform are separate Projects.
- Reliant average monthly funding should be represented as approximately **$4.5M → $9M average monthly funding**. A $9.5M month may be retained only if separately described as a specific achieved level, not the ongoing average.
- Backd's **$1M → $3.5M monthly funding** refers specifically to the direct sales team that was launched.
- Ferrari should distinguish internal service-operations redesign from customer-experience redesign.
- Choice's approximately **$2.2M additional revenue** was the result of improving lead-to-close conversion from **18% → 25%**, not a separate revenue initiative.
- Park Place Mercedes-Benz promotion from Service Advisor to Assistant Service Manager is accurate.
- Not every Work Experience requires Projects; Park Place will rely primarily on Evidence Stories.

---

# 4. Proposed Work Experiences

## WE-01 — Alpine Development Collaborative

**company_name:** Alpine Development Collaborative  
**role_title:** AI Operations Strategist  
**employment_type:** Contract  
**start:** May 2025  
**end:** September 2026  
**is_current:** false  
**validation_status:** confirmed

**Summary:**  
Led AI strategy, operational transformation, and systems implementation for an affordable-housing developer. Worked directly with leadership and staff to identify workflow, information, and decision-making bottlenecks; implemented AI-enabled workflows; and designed/deployed Housing Compass as a structured operating system for the business.

**Scope / responsibilities:**
- workflow and operational discovery
- AI implementation and user enablement
- connected workplace-tool setup
- process redesign
- system architecture and production implementation
- training and adoption
- operational continuity / knowledge access

**Major outcomes:**
- Housing Compass production deployment
- AI-assisted workflows adopted by nontechnical staff
- reduced dependence on manually searching email/folders and on individual institutional memory
- additional source-derived productivity metrics remain listed in the review queue below

**Source labels:** current LinkedIn/master context; AI Strategist resume; candidate calibration 2026-09-24

---

## WE-02 — Levo Funding

**company_name:** Levo Funding  
**role_title:** Director of Founding Operations  
**employment_type:** Full-time  
**start:** October 2023  
**end:** April 2025  
**is_current:** false  
**validation_status:** confirmed

**Summary:**  
Founding operations leader and primary systems owner for a fully online merchant-cash-advance lender. Built and supported the operational technology stack across sales and underwriting, led CRM migration and automation, managed vendors and deployments, and redesigned workflows around structured data and exception-based human review.

**Team / environment:**
- one of 13 founding hires
- no internal CTO / IT team
- reported directly to COO
- cross-functional work across sales, underwriting, marketing, finance/accounting, and operations

**Major outcomes:**
- approval time 48 hours → 24 hours
- merchant onboarding time reduced 40%
- Salesforce Administrator certification earned during role
- additional source-derived throughput/cost metrics remain in review queue

**Source labels:** current LinkedIn/master context; AI Strategist resume; candidate calibration 2026-09-24

---

## WE-03 — Backd Business Funding

**company_name:** Backd Business Funding  
**role_title:** Director of Sales Operations  
**employment_type:** Freelance / consulting engagement  
**start:** May 2023  
**end:** October 2023  
**is_current:** false  
**validation_status:** confirmed

**Summary:**  
Recruited to launch and scale a new direct-sales operation from the ground up. Owned site selection, budgeting, contract negotiation, hiring, onboarding, operating systems, reporting, and day-to-day sales-operations support while managing a bi-coastal team.

**Major outcomes:**
- direct-sales team monthly funding grew from $1M → $3.5M within six months
- team productivity improved 15% through automation/process standardization
- engagement led directly to recruitment into Levo's founding team

**Source labels:** current LinkedIn/master context; recent resumes; candidate calibration 2026-09-24

---

## WE-04 — Reliant Funding

**company_name:** Reliant Funding  
**role_title:** Director of Sales Operations  
**employment_type:** Full-time  
**start:** June 2020  
**end:** April 2023  
**is_current:** false  
**promotion_history:** Sales Manager → Director of Sales Operations  
**validation_status:** confirmed

**Summary:**  
Led sales operations and team performance in a high-volume alternative-finance organization. Managed 60+ sales representatives and four managers, built Salesforce reporting to expose revenue bottlenecks, redesigned lead distribution and sales workflows, and partnered with BI/marketing on routing and acquisition strategy.

**Major outcomes:**
- average monthly funding approximately $4.5M → $9M
- same lead volume with fewer reps
- promotion from Sales Manager to Director of Sales Operations

**Important metric rule:**  
Do not import older source wording of "$4M → $9.5M monthly revenue" as the average. Candidate confirmed approximately $4.5M → $9M average monthly funding. A $9.5M level may only be used as a separately supported peak/specific month.

**Source labels:** LinkedIn/master context; AI Strategist resume; candidate calibration 2026-09-24

---

## WE-05 — Ferrari & Maserati of San Diego

**company_name:** Ferrari & Maserati of San Diego  
**role_title:** Service Manager  
**employment_type:** Full-time  
**start:** February 2018  
**end:** April 2020  
**is_current:** false  
**promotion_history:** Service Advisor → Service Manager  
**validation_status:** confirmed

**Summary:**  
Progressed from Service Advisor to Service Manager in a high-touch luxury automotive environment. Led the turnaround of the Maserati service operation by redesigning internal service flow and the client-facing service experience while helping customers make informed decisions about expensive, technically complex repairs.

**Major outcomes:**
- underperforming Maserati service line became dealership's top performer
- annual gross profit increased 40%+
- customer satisfaction reached 96%
- Google/Yelp ratings improved 3.0 → 4.6
- repeat business increased 25%

**Source labels:** LinkedIn/master context; Apple resume; candidate calibration 2026-09-24

---

## WE-06 — Choice Financial Debt Relief

**company_name:** Choice Financial Debt Relief  
**role_title:** Sales Manager  
**employment_type:** Full-time  
**start:** July 2016  
**end:** February 2018  
**is_current:** false  
**promotion_history:** Account Executive → Sales Manager  
**validation_status:** confirmed

**Summary:**  
Progressed from individual sales into management in consumer debt validation, ultimately leading a remote team of 10–12 account executives. Improved conversion through individualized coaching, sales enablement, objection handling, and performance management in a sensitive financial-services environment.

**Major outcomes:**
- lead-to-close conversion 18% → 25%
- 25% conversion was a company record
- conversion improvement produced approximately $2.2M in additional revenue
- team consistently outperformed peer teams

**Source labels:** LinkedIn/master context; Apple resume; candidate calibration 2026-09-24

---

## WE-07 — Park Place Mercedes-Benz

**company_name:** Park Place Mercedes-Benz  
**role_title:** Assistant Service Manager  
**employment_type:** Full-time  
**start:** June 2012  
**end:** May 2016  
**is_current:** false  
**promotion_history:** Service Advisor → Assistant Service Manager  
**validation_status:** confirmed

**Summary:**  
Progressed from Service Advisor to Assistant Service Manager in a high-volume Mercedes-Benz service operation. Owned customer relationships from write-up through delivery, translated technician diagnoses into understandable options, coordinated work across advisors/technicians, and maintained a high-touch luxury-service experience.

**Scale / outcomes:**
- environment handled 200+ vehicles/day
- approximately 24 advisors and 80+ technicians
- maintained 96.3 customer-satisfaction average
- trained within Park Place's Ritz-Carlton-based service model

**Source labels:** Apple resume; candidate calibration 2026-09-24

---

# 5. Proposed Projects

## Alpine

### PR-01 — Housing Compass

**Primary Work Experience:** WE-01 Alpine  
**status:** completed  
**validation_status:** confirmed

**Problem:**  
Critical project, funding, document, financial, task, and operational knowledge was fragmented across SharePoint, spreadsheets, Outlook, and institutional memory.

**Candidate role:**  
Discovery lead, system designer, builder, implementation lead, trainer.

**Architecture / scale:**  
Use the candidate-confirmed/current canonical figures:
- React
- TypeScript
- PostgreSQL / Supabase
- 60+ database tables
- 500+ row-level security policies
- role-based permissions
- financial modeling across 15+ funding sources
- 17 Edge Functions where a function count is needed and context supports it

**Outcomes:**  
One structured operating system spanning projects, funding, documents, tasks, financials, and operational knowledge.

**Primary skill links:**  
Business Systems Architecture; Requirements Discovery; Process Mapping; Workflow Design; Data Modeling; Access-Control Design; Systems Integration; AI Enablement; Change Management; User Adoption & Training; Stakeholder Management.

**Primary tool links:**  
React; TypeScript; PostgreSQL; Supabase; SharePoint.

---

### PR-02 — AI Workflow Enablement & Adoption

**Primary Work Experience:** WE-01 Alpine  
**status:** completed  
**validation_status:** confirmed

**Problem:**  
Employees needed immediate relief from manual information retrieval, email/document searching, meeting follow-up, and fragmented operational context while the larger platform was being built.

**Candidate role:**  
AI workflow designer, trainer, adoption lead, troubleshooter.

**Responsibilities / approach:**
- implemented ChatGPT and Claude
- connected workflows with Outlook, SharePoint, Read.ai and company context
- trained nontechnical staff
- built reusable skills / natural-language workflows
- created repeatable ways to retrieve priorities and project context

**Primary skill links:**  
AI Enablement; Workflow Automation; Change Management; User Adoption & Training; Knowledge Management; Process Improvement; Technical Translation; Stakeholder Management.

**Primary tool links:**  
ChatGPT; Claude; Outlook; SharePoint; Read.ai.

---

### PR-03 — Secure SharePoint-to-Claude MCP Connector

**Primary Work Experience:** WE-01 Alpine  
**status:** completed  
**validation_status:** candidate_review_needed

**Problem:**  
AI needed secure, attributable access to live SharePoint documents without bypassing user-level authorization.

**Candidate role:**  
Solution designer / builder.

**Source-supported behavior:**
- Claude reads live SharePoint documents
- classifies/tags content
- registers structured records
- forwards the user's own authentication token so access follows the same authorization boundary as the human user

**Primary skill links:**  
Systems Integration; AI Enablement; Access-Control Design; API Integration; Security-Conscious Architecture; Workflow Automation.

**Primary tool links:**  
Claude; MCP; SharePoint; REST/API integration; token-forwarded authentication.

---

## Levo

### PR-04 — Zoho → Salesforce Migration

**Primary Work Experience:** WE-02 Levo  
**status:** completed  
**validation_status:** confirmed

**Scope:**
- company-wide requirements discovery
- process mapping
- migration from Zoho to Salesforce
- 100+ reports / dynamic dashboards / automated workflows
- user adoption, UAT, documentation, rollout

**Primary skill links:**  
Requirements Discovery; CRM Strategy; Salesforce Administration; Process Mapping; Systems Integration; UAT; Change Management; User Adoption & Training; Cross-Functional Leadership.

**Primary tool links:**  
Zoho; Salesforce.

---

### PR-05 — Salesforce Business Logic / Lending Platform

**Primary Work Experience:** WE-02 Levo  
**status:** completed  
**validation_status:** confirmed

**Scope:**
- formulas and flows
- payback calculations
- decline routing / notifications
- commissions and clawbacks
- risk-tiered products/pricing
- approval workflows
- DocuSign routing
- user provisioning and supporting platform configuration

**Primary skill links:**  
Salesforce Administration; Workflow Design; Workflow Automation; Business Systems Architecture; Process Improvement; Data/Business Logic Design.

**Primary tool links:**  
Salesforce; Flow Builder; DocuSign.

---

### PR-06 — Underwriting Automation

**Primary Work Experience:** WE-02 Levo  
**status:** completed  
**validation_status:** confirmed

**Scope:**
- OCR integrated into intake/CRM workflow
- structured bank-statement data
- FICO, time in business, address and annual revenue synchronized into Salesforce
- automated decline flows before human underwriting
- exception-based human review

**Primary skill links:**  
Workflow Automation; Process Redesign; Systems Integration; Underwriting Operations; Data Integration; AI/Automation Enablement.

**Primary tool links:**  
Salesforce; Azure AI Builder; OCR; Heron Data; Experian; CLEAR where applicable.

---

### PR-07 — Systems & Infrastructure Ownership

**Primary Work Experience:** WE-02 Levo  
**status:** completed  
**validation_status:** confirmed

**Scope:**
- vendor management
- UAT for major deployments
- phone/distribution/offer-presentation systems
- DNS/domains/whitelisting
- user provisioning
- license management
- supporting operational infrastructure

**Primary skill links:**  
Vendor Management; UAT; Systems Ownership; Operational Design; Cross-Functional Coordination; Troubleshooting; Change Management.

**Primary tool links:**  
AWS S3; Salesforce; Zoho; DocuSign; relevant phone/distribution systems where named.

---

## Backd

### PR-08 — San Diego Direct-Sales Office Launch

**Primary Work Experience:** WE-03 Backd  
**status:** completed  
**validation_status:** confirmed

**Scope:**
- site selection
- budget
- WeWork contract negotiation
- hiring
- onboarding
- systems / operating buildout
- bi-coastal team coordination

**Outcome:**  
Direct-sales team monthly funding $1M → $3.5M in six months.

**Primary skill links:**  
Zero-to-One Operations; Operational Launch; Sales Operations; Hiring; Budget Management; Vendor Negotiation; Team Leadership; Cross-Functional Operations.

---

### PR-09 — Performance & Sales-Ops Infrastructure

**Primary Work Experience:** WE-03 Backd  
**status:** completed  
**validation_status:** confirmed

**Scope:**
- performance dashboards
- reporting infrastructure
- automation tools
- process standardization

**Outcome:**  
15% productivity improvement reported in source material and accepted during calibration review.

**Primary skill links:**  
Performance Analytics; Sales Operations; Dashboard/Reporting Design; Process Standardization; Workflow Automation; Team Performance Management.

---

## Reliant

### PR-10 — Sales Performance Analytics

**Primary Work Experience:** WE-04 Reliant  
**status:** completed  
**validation_status:** confirmed

**Problem:**  
Management saw stalled revenue but lacked visibility into where performance was breaking down.

**Approach:**
- taught self Salesforce to expose the funnel
- rep-level reporting for leads received, submitted, approved, funded and converted
- dashboards for managers/reps/executives

**Primary skill links:**  
Salesforce Reporting; Performance Analytics; Root-Cause Analysis; Revenue Operations; Data-Driven Decision Making.

**Primary tool links:**  
Salesforce.

---

### PR-11 — Lead Distribution Redesign

**Primary Work Experience:** WE-04 Reliant  
**status:** completed  
**validation_status:** confirmed

**Problem:**  
Large purchased lead volume sat in a shared pool that rewarded speed/hoarding rather than fit and performance.

**Approach:**
- partnered with BI
- implemented performance-based routing by lead grade
- created elite-team handling for highest-grade leads
- connected performance data back to lead-acquisition decisions

**Outcome:**  
Average monthly funding approximately $4.5M → $9M with the same lead volume and fewer reps.

**Primary skill links:**  
Revenue Operations; Lead Distribution Strategy; Sales Process Design; Root-Cause Analysis; Change Management; Sales Leadership; Marketing Alignment.

**Primary tool links:**  
Salesforce; Distribution Engine.

---

### PR-12 — Sales Gamification & Execution Visibility

**Primary Work Experience:** WE-04 Reliant  
**status:** completed  
**validation_status:** confirmed

**Scope:**  
Live performance visibility / leaderboards using Spinify.

**Primary skill links:**  
Sales Enablement; Performance Management; Change Adoption; Performance Analytics.

**Primary tool links:**  
Spinify.

---

### PR-13 — Revenue-Organization Phone-System Migration

**Primary Work Experience:** WE-04 Reliant  
**status:** completed  
**validation_status:** confirmed for migration occurrence and scale

**Scale:**  
Approximately 150 users / 60 lines.

**Primary skill links:**  
Implementation Management; Change Management; Cross-Functional Coordination; UAT; Operational Continuity.

**Tool link:**  
Phone platform/vendor not yet canonically identified.

---

## Ferrari & Maserati

### PR-14 — Maserati Service Operations Redesign

**Primary Work Experience:** WE-05 Ferrari & Maserati  
**status:** completed  
**validation_status:** confirmed

**Internal process scope:**
- appointment system
- intake system
- RO flow
- moving vehicles into shop work
- internal handoffs
- wash/detail readiness
- delivery preparation
- parts coordination / readiness
- end-to-end internal vehicle flow

**Primary skill links:**  
Service Operations; Process Mapping; Workflow Design; Process Improvement; Cross-Functional Coordination; Operational Turnaround.

---

### PR-15 — Maserati Customer Experience Redesign

**Primary Work Experience:** WE-05 Ferrari & Maserati  
**status:** completed  
**validation_status:** confirmed

**Client-facing scope:**
- redesigned appointment experience
- introduced/improved loaner-car experience
- proactive customer communication
- technical recommendation explanation
- delivery experience
- premium-service consistency

**Outcomes linked at Work Experience level:**
- customer satisfaction 96%
- public ratings 3.0 → 4.6
- repeat business +25%

**Primary skill links:**  
Customer Experience Design; Consultative Selling; Technical Translation; Customer Discovery; Customer Retention; Luxury Client Management; Objection Handling; Service Design.

**Note:**  
The overall "Maserati business-line turnaround" should live in WE-05 `major_outcomes` rather than adding a third parent Project. The current schema does not need a project hierarchy for this case.

---

## Choice

### PR-16 — Sales Team Performance & Coaching System

**Primary Work Experience:** WE-06 Choice  
**status:** completed  
**validation_status:** confirmed

**Scope:**
- managed 10–12 account executives
- individualized coaching
- color-coded coaching/performance system
- development of underperformers
- performance accountability

**Outcomes:**
- lead-to-close 18% → 25%
- company record
- approximately $2.2M additional revenue from the conversion improvement
- team consistently outperformed peer teams

**Primary skill links:**  
Sales Leadership; Sales Coaching; Performance Management; Conversion Optimization; Team Development; Data-Driven Management.

---

### PR-17 — Sales Enablement & Personalized Playbooks

**Primary Work Experience:** WE-06 Choice  
**status:** completed  
**validation_status:** confirmed

**Scope:**
- OneNote knowledge library
- scripts
- objection handling
- rebuttals
- individualized versions aligned to how each rep actually sold

**Primary skill links:**  
Sales Enablement; Knowledge Management; Objection Handling; Playbook Development; Adaptive Coaching; Consultative Selling.

**Primary tool links:**  
Microsoft OneNote.

---

## Park Place Mercedes-Benz

No formal Projects proposed for V1.

The repeated operating experience itself is more useful as Evidence Stories. Do not create Projects solely to fill the table.

---

# 6. Proposed Evidence Stories

These are the reusable story units that should sit underneath the Work Experience / Projects.

## Alpine

### ES-01 — Embed Before Building
**Project:** PR-01  
**evidence_type:** direct  
**validation_status:** confirmed  
**Story:** Worked directly with leadership and staff to understand how work actually moved before designing Housing Compass.  
**Skills:** Requirements Discovery; Process Mapping; Stakeholder Management; Business Systems Architecture.

### ES-02 — Build Housing Compass for an Unfamiliar Industry
**Project:** PR-01  
**evidence_type:** direct  
**validation_status:** confirmed  
**Story:** Learned affordable-housing workflows deeply enough to design and deploy a production operating system spanning funding, projects, documents, tasks, financials and permissions.  
**Skills:** Rapid Learning; Business Systems Architecture; Solution Design; Data Modeling; Workflow Design.

### ES-03 — Design Enterprise-Grade Permissions
**Project:** PR-01  
**evidence_type:** direct  
**validation_status:** confirmed  
**Story:** Designed role-based access and 500+ row-level security policies across a 76-table production system.  
**Skills:** Access-Control Design; Security-Conscious Architecture; Data Architecture.

### ES-04 — Move Nontechnical Staff Into AI-Assisted Work
**Project:** PR-02  
**evidence_type:** direct  
**validation_status:** confirmed  
**Story:** Implemented AI workflows and trained nontechnical staff until they could independently use and, in at least one case, create their own workflow/tooling.  
**Skills:** AI Enablement; User Adoption & Training; Change Management; Technical Translation.

### ES-05 — Preserve Operational Continuity Through Searchable Institutional Knowledge
**Project:** PR-02  
**evidence_type:** direct  
**validation_status:** confirmed  
**Story:** Connected AI/workplace tools so staff could retrieve project context and priorities without depending on manual folder/email searching or one person's memory.  
**Skills:** Knowledge Management; Operational Resilience; Workflow Design; AI Enablement.

### ES-06 — Secure User-Scoped AI Access to SharePoint
**Project:** PR-03  
**evidence_type:** direct  
**validation_status:** candidate_review_needed  
**Story:** Built a custom MCP-based connector that let Claude work with live SharePoint content while forwarding each user's authentication context.  
**Skills:** Systems Integration; API Integration; Access-Control Design; AI Engineering / Enablement.

---

## Levo

### ES-07 — Translate Company-Wide Requirements Into CRM Design
**Project:** PR-04  
**evidence_type:** direct  
**validation_status:** confirmed  
**Skills:** Requirements Discovery; Process Mapping; Cross-Functional Leadership; CRM Strategy.

### ES-08 — Make Salesforce Run the Business, Not Just Store Fields
**Project:** PR-05  
**evidence_type:** direct  
**validation_status:** confirmed  
**Story:** Extended a specialist-built Salesforce implementation with formulas, flows, pricing, approvals, notifications, commissions/clawbacks and contract routing so business logic could execute inside the system.  
**Skills:** Salesforce Administration; Workflow Automation; Business Logic Design; Systems Architecture.

### ES-09 — Interim Zoho Workflow Was Preferred by End Users
**Project:** PR-04 / PR-05  
**evidence_type:** direct  
**validation_status:** confirmed  
**Story:** An interim Zoho workflow carried the business end-to-end; after the paid Salesforce build launched, sales and underwriting asked to return to the candidate's workflow design.  
**Skills:** Workflow Design; User-Centered Systems Design; Adoption; Process Improvement.

### ES-10 — Automate Underwriting Intake Before Human Review
**Project:** PR-06  
**evidence_type:** direct  
**validation_status:** confirmed  
**Skills:** Workflow Automation; Data Integration; Underwriting Operations; Process Redesign.

### ES-11 — Cut Approval and Onboarding Time
**Project:** PR-06  
**evidence_type:** direct  
**validation_status:** confirmed  
**Outcome:** approval time 48h → 24h; onboarding time -40%.  
**Skills:** Process Improvement; Operational Efficiency; Workflow Automation.

### ES-12 — Own the Plumbing Nobody Else Owned
**Project:** PR-07  
**evidence_type:** direct  
**validation_status:** confirmed  
**Story:** Managed vendors, UAT, user provisioning, licenses, domains/DNS/whitelisting and other systems infrastructure in a company without internal IT leadership.  
**Skills:** Systems Ownership; Vendor Management; Troubleshooting; UAT; Operational Leadership.

---

## Backd

### ES-13 — Launch a New Sales Operation From Zero
**Project:** PR-08  
**evidence_type:** direct  
**validation_status:** confirmed  
**Skills:** Zero-to-One Operations; Operational Launch; Hiring; Budgeting; Vendor Negotiation; Team Leadership.

### ES-14 — Scale Direct-Team Funding $1M → $3.5M
**Project:** PR-08  
**evidence_type:** direct  
**validation_status:** confirmed  
**Skills:** Sales Operations; Team Performance; Revenue Growth.

### ES-15 — Standardize and Automate a New Office
**Project:** PR-09  
**evidence_type:** direct  
**validation_status:** confirmed  
**Outcome:** 15% productivity improvement.  
**Skills:** Process Standardization; Performance Analytics; Workflow Automation; Sales Operations.

---

## Reliant

### ES-16 — Make a Revenue Problem Visible Before Changing It
**Project:** PR-10  
**evidence_type:** direct  
**validation_status:** confirmed  
**Story:** Taught self Salesforce to build rep-level funnel visibility rather than accepting "push harder" as the explanation for stalled revenue.  
**Skills:** Root-Cause Analysis; Salesforce Reporting; Performance Analytics; Data-Driven Decision Making.

### ES-17 — Redesign Lead Routing Around Performance
**Project:** PR-11  
**evidence_type:** direct  
**validation_status:** confirmed  
**Skills:** Lead Distribution Strategy; Revenue Operations; Sales Process Design; Change Management.

### ES-18 — Grow Average Monthly Funding $4.5M → $9M
**Project:** PR-11  
**evidence_type:** direct  
**validation_status:** confirmed  
**Outcome:** approximately doubled average monthly funding with the same lead volume and fewer reps.  
**Skills:** Revenue Operations; Sales Leadership; Conversion Optimization; Operational Efficiency.

### ES-19 — Connect Sales Performance Back to Marketing
**Project:** PR-11  
**evidence_type:** direct  
**validation_status:** confirmed  
**Story:** Closed the loop with marketing on which leads should be purchased using downstream performance data.  
**Skills:** Marketing Alignment; Revenue Operations; Performance Analytics; Cross-Functional Collaboration.

### ES-20 — Deploy Live Sales Leaderboards
**Project:** PR-12  
**evidence_type:** direct  
**validation_status:** confirmed  
**Skills:** Sales Enablement; Performance Management; Change Adoption.

### ES-21 — Migrate a 150-Person / 60-Line Phone System
**Project:** PR-13  
**evidence_type:** direct  
**validation_status:** confirmed  
**Skills:** Implementation Management; UAT; Change Management; Operational Continuity.

---

## Ferrari & Maserati

### ES-22 — Redesign the Internal Vehicle-Service Flow
**Project:** PR-14  
**evidence_type:** direct  
**validation_status:** confirmed  
**Story:** Redesigned the appointment, intake, RO, shop, wash, readiness and handoff process so cars moved through service more predictably.  
**Skills:** Process Mapping; Workflow Design; Service Operations; Process Improvement.

### ES-23 — Redesign the Client Experience
**Project:** PR-15  
**evidence_type:** direct  
**validation_status:** confirmed  
**Story:** Redesigned how clients experienced service, including loaner access, appointment experience, communication and delivery.  
**Skills:** Customer Experience Design; Service Design; Customer Retention; Luxury Client Management.

### ES-24 — Translate Expensive Technical Work Into a Confident Decision
**Project:** PR-15  
**evidence_type:** direct  
**validation_status:** confirmed  
**Story:** Explained technical diagnoses, cost, timing and tradeoffs in plain language so clients could make informed decisions without feeling pressured.  
**Skills:** Consultative Selling; Technical Translation; Customer Discovery; Objection Handling; Decision Support.

### ES-25 — Turn Around the Maserati Business Line
**Work Experience:** WE-05  
**evidence_type:** direct  
**validation_status:** confirmed  
**Outcome:** underperforming service line → top performer; gross profit +40%+, CSAT 96%, ratings 3.0 → 4.6, repeat business +25%.  
**Skills:** Operational Turnaround; Customer Experience; Revenue Growth; Leadership.

---

## Choice

### ES-26 — Turn Underperformers Into Producers
**Project:** PR-16  
**evidence_type:** direct  
**validation_status:** confirmed  
**Story:** Used individualized coaching and a color-coded performance system rather than a one-size-fits-all management approach.  
**Skills:** Sales Coaching; Performance Management; Team Development; Adaptive Leadership.

### ES-27 — Raise Conversion 18% → 25%
**Project:** PR-16  
**evidence_type:** direct  
**validation_status:** confirmed  
**Outcome:** company-record 25% lead-to-close conversion; approximately $2.2M additional revenue attributed to the conversion improvement.  
**Skills:** Conversion Optimization; Sales Leadership; Performance Analytics.

### ES-28 — Build Personalized Sales Playbooks
**Project:** PR-17  
**evidence_type:** direct  
**validation_status:** confirmed  
**Story:** Built a OneNote library of scripts, objections and rebuttals, then adapted versions to how individual reps actually sold.  
**Skills:** Sales Enablement; Knowledge Management; Objection Handling; Playbook Development; Adaptive Coaching.

---

## Park Place Mercedes-Benz

### ES-29 — Diagnose the Customer's Real Problem
**Work Experience:** WE-07  
**evidence_type:** direct  
**validation_status:** confirmed  
**Story:** Interviewed customers to understand the actual service need rather than treating the first description as the full problem.  
**Skills:** Customer Discovery; Active Listening; Problem Diagnosis; Consultative Selling.

### ES-30 — Translate Technician Diagnosis Into Customer Options
**Work Experience:** WE-07  
**evidence_type:** direct  
**validation_status:** confirmed  
**Skills:** Technical Translation; Customer Education; Consultative Selling; Decision Support.

### ES-31 — Own the Customer From Write-Up Through Delivery
**Work Experience:** WE-07  
**evidence_type:** direct  
**validation_status:** confirmed  
**Story:** Maintained end-to-end ownership across intake, recommendation, status communication, coordination and final delivery.  
**Skills:** Relationship Management; End-to-End Ownership; High-Volume Operations; Cross-Functional Coordination.

### ES-32 — Maintain High Satisfaction in a High-Volume Luxury Operation
**Work Experience:** WE-07  
**evidence_type:** direct  
**validation_status:** confirmed  
**Scale/outcome:** 200+ vehicles/day environment; 24 advisors; 80+ technicians; 96.3 CSAT average.  
**Skills:** Prioritization; High-Volume Operations; Customer Experience; Team Collaboration.

---

# 7. Proposed Skill Taxonomy

Create one reusable Skill row per normalized capability. Do not create job-specific duplicates.

## Discovery / problem solving
- Requirements Discovery
- Customer Discovery
- Process Mapping
- Root-Cause Analysis
- Problem Diagnosis
- Data-Driven Decision Making
- Rapid Learning

## Systems / technical
- Business Systems Architecture
- Solution Design
- CRM Strategy
- Salesforce Administration
- Workflow Design
- Workflow Automation
- Systems Integration
- API Integration
- Data Modeling
- Business Logic Design
- Access-Control Design
- Security-Conscious Architecture
- Troubleshooting
- UAT
- Implementation Management

## AI / transformation
- AI Strategy & Use Case Prioritization
- AI Enablement
- AI Workflow Design
- Knowledge Management
- Change Management
- User Adoption & Training
- Operational Resilience

## Revenue / sales
- Revenue Operations
- Sales Operations
- Sales Leadership
- Consultative Selling
- Lead Distribution Strategy
- Conversion Optimization
- Performance Analytics
- Sales Coaching
- Sales Enablement
- Objection Handling
- Marketing Alignment
- Playbook Development

## Operations / leadership
- Zero-to-One Operations
- Operational Launch
- Operational Turnaround
- Process Improvement
- Process Standardization
- Operational Efficiency
- Vendor Management
- Budget Management
- Hiring
- Team Leadership
- Cross-Functional Leadership
- Cross-Functional Coordination
- Performance Management

## Customer / communication
- Technical Translation
- Customer Experience Design
- Customer Education
- Decision Support
- Customer Retention
- Luxury Client Management
- Relationship Management
- Active Listening
- Executive Communication
- Stakeholder Management
- Prioritization
- High-Volume Operations
- End-to-End Ownership

### Skill-link validation rule

Skills are taxonomy labels, not independent proof.

For import:
- links derived from explicit reviewed stories may be `confirmed`
- links that are professional translation but not explicitly reviewed should be `candidate_review_needed` or `inferred`
- do not use an unconfirmed skill as direct Evaluation evidence until the supporting Project/Evidence relationship is confirmed

---

# 8. Proposed Tool Taxonomy

## AI / agentic
- ChatGPT / OpenAI
- Claude
- Claude Skills
- MCP
- RAG
- Read.ai
- Azure AI Builder

## CRM / business systems
- Salesforce
- Salesforce Flow Builder
- Zoho
- Distribution Engine
- Spinify
- DocuSign
- Microsoft OneNote

## Data / integration / infrastructure
- Supabase
- PostgreSQL
- REST APIs
- Heron Data
- Experian
- CLEAR
- AWS S3
- Azure
- SharePoint
- Outlook
- Power Automate
- OCR pipelines
- token-forwarded authentication

## Development
- React
- TypeScript
- Python
- Claude Code
- Cursor
- Lovable
- GitHub

### Tool-link rule

A Tool may exist as a taxonomy row even when the exact Work Experience relationship has not yet been validated.

Do not claim depth or proficiency from the Tool row alone. Depth should come from linked Projects and Evidence Stories.

---

# 9. Relationship Plan

## Work Experience → Projects

- WE-01 Alpine → PR-01 Housing Compass
- WE-01 Alpine → PR-02 AI Workflow Enablement & Adoption
- WE-01 Alpine → PR-03 Secure SharePoint-to-Claude MCP Connector
- WE-02 Levo → PR-04 Zoho → Salesforce Migration
- WE-02 Levo → PR-05 Salesforce Business Logic / Lending Platform
- WE-02 Levo → PR-06 Underwriting Automation
- WE-02 Levo → PR-07 Systems & Infrastructure Ownership
- WE-03 Backd → PR-08 San Diego Direct-Sales Office Launch
- WE-03 Backd → PR-09 Performance & Sales-Ops Infrastructure
- WE-04 Reliant → PR-10 Sales Performance Analytics
- WE-04 Reliant → PR-11 Lead Distribution Redesign
- WE-04 Reliant → PR-12 Sales Gamification & Execution Visibility
- WE-04 Reliant → PR-13 Revenue-Organization Phone-System Migration
- WE-05 Ferrari → PR-14 Maserati Service Operations Redesign
- WE-05 Ferrari → PR-15 Maserati Customer Experience Redesign
- WE-06 Choice → PR-16 Sales Team Performance & Coaching System
- WE-06 Choice → PR-17 Sales Enablement & Personalized Playbooks
- WE-07 Park Place → no Projects required for V1

All above relationships should use `relationship_type='primary'`, `is_primary=true` unless future cross-role Projects require otherwise.

## Evidence → Work Experience / Project

Use the ES-01 through ES-32 mapping above.

Where a story naturally describes the whole role rather than one discrete Project (for example Ferrari business-line turnaround or Park Place repeated service work), populate `work_experience_id` and leave `project_id` null.

---

# 10. Source-Derived Items Requiring Candidate Review Before Import

These are useful claims present in source material but were not individually calibrated in this session. Keep them out of `confirmed` state until reviewed.

## RV-01 — Alpine productivity metrics

**Disposition: confirmed by candidate on 2026-09-24.**

Confirmed:
- zero missed application deadlines after AI layer went live
- funding applications completed in half the time
- vicinity maps reduced from ~8 hours to under 1
- proforma consolidation reduced from days to under a day
- status-update email volume reduced 20%

These may be imported as confirmed Candidate Knowledge.

## RV-02 — Alpine / Housing Compass historical count variants

**Disposition: resolved with durable scale wording, confirmed by candidate on 2026-09-24.**

Candidate Knowledge should use:

- 60+ tables
- 500+ row-level security policies
- 15+ Edge Functions

Exact historical counts may remain in source/reference history when useful, but reusable Candidate Knowledge should communicate stable scale rather than depend on one point-in-time count.

## RV-03 — Levo underwriting scale/cost

**Disposition: confirmed by candidate on 2026-09-24.**

Confirmed:
- three underwriters handled roughly 2,000 monthly submissions
- the workflow eliminated a $6K/month offshore processing team

These may be imported as confirmed Candidate Knowledge.

## RV-04 — Reliant secondary metrics

**Disposition: confirmed by candidate on 2026-09-24.**

Confirmed:
- funded units 230 → 270/month
- average deal size $22K → $28K
- operating costs reduced 11%
- marketing expenses reduced 6%
- submissions increased 1,800 → 2,300/month
- Spinify-related productivity improved 17%
- the 37% conversion metric may be retained as confirmed where its original source context is preserved

These may be imported as confirmed Candidate Knowledge.

## RV-05 — Ferrari secondary operating metrics

**Disposition: confirmed by candidate on 2026-09-24.**

Confirmed:
- service turnaround reduced 20%
- service revenue increased 15% year over year
- customer-retention improvements contributed an additional 35% gross profit

These may be imported as confirmed Candidate Knowledge.

## RV-06 — Exact tool-to-project links for broad technical stack

**Disposition: approved by candidate on 2026-09-24.**

Create Tool taxonomy rows for supported tools such as Python, GitHub, Cursor, Claude Code, Lovable, Power Automate, AWS/Azure and others.

Only create Project or Evidence Story links when the source explicitly supports that relationship.

Do not infer project-specific tool usage merely because the candidate has used the tool elsewhere.

---

# 11. Schema / Import Decisions Exposed by Real Data

## 11.1 Month-only date convention

Most source records specify only month/year.

For V1, Candidate Knowledge career-history dates will use this convention:

- store the first day of the known month in PostgreSQL `date` fields;
- treat that day value as an implementation placeholder, not a factual day-level claim;
- format candidate-facing outputs as month/year only unless a source actually provides day-level precision;
- do not use the placeholder day for exact-tenure or exact-day assertions.

Examples:

- `June 2020` → `2020-06-01`
- `April 2023` → `2023-04-01`

No schema migration is required for V1. If future ingestion needs mixed date precision, add explicit precision metadata through a forward migration at that time.

## 11.2 Ferrari parent/child Projects

The calibration conversation naturally described "Maserati Business-Line Turnaround" as an umbrella over internal operations redesign and client-experience redesign.

The current schema has no `parent_project_id`.

No migration is required for V1:
- store the overall turnaround in WE-05 `major_outcomes`
- store PR-14 and PR-15 as the two discrete Projects
- link ES-25 directly to WE-05

Add project hierarchy later only if real future data repeatedly requires it.

## 11.3 MarencoAI vs Alpine

Current canonical import decision:
- use Alpine Development Collaborative as the Work Experience for the 2025–2026 engagement
- do not duplicate the same evidence under a separate MarencoAI Work Experience
- retain MarencoAI as source/business context outside the initial Candidate Knowledge import unless a future use case needs entrepreneurship/consulting-company identity as a separate record

---

# 12. Proposed Initial Import Counts

If the review-needed items remain excluded from confirmed state, the initial manifest contains approximately:

- **7 Work Experiences**
- **17 Projects**
- **32 Evidence Stories**
- **50+ reusable Skills**
- **30+ Tools / Technologies**
- project-to-work-experience relationships for all 17 Projects
- skill/tool links only where supported or explicitly marked review-needed/inferred

The goal is not maximum record count. The goal is enough structured truth that the system can retrieve the right evidence for a new Opportunity without reconstructing the candidate's career from resumes every time.

---

# 13. Import Gate

Do not write this manifest into the real Candidate Knowledge tables until:

1. the six review queues above are resolved;
2. the documented first-of-month convention is applied to month-only career dates;
3. the import script/SQL is generated from the finalized manifest;
4. import is executed under the real candidate Workspace/Principal;
5. post-import checks verify:
   - no duplicates
   - correct Workspace ownership
   - confirmed vs review-needed validation state
   - relationship integrity
   - RLS visibility
   - Evaluation evidence can retrieve only confirmed support

After that, run one real Opportunity through:

**Opportunity → translation → Candidate Knowledge retrieval → Evaluation → evidence trace → recommended next action**

That is the first product-level golden-path test.


# 14. Generated Import Script

Generated on 2026-09-24:

`supabase/data-imports/20260924_candidate_knowledge_initial.sql`

Static review findings:

- one transaction with commit only after assertions pass;
- refuses to run when Candidate Knowledge already exists in the target Workspace;
- establishes the authenticated human context from the target Principal's `auth_user_id` so validation/audit triggers run normally;
- uses the documented first-of-month convention for month-only career dates;
- creates 7 Work Experiences, 17 Projects, 32 Evidence Stories, 84 Skill taxonomy rows, and 34 Tool taxonomy rows;
- creates Project ↔ Work Experience, Project ↔ Skill, Evidence Story ↔ Skill, and explicit Tool relationships;
- keeps the Secure SharePoint-to-Claude MCP Connector Project and related Evidence Story at `candidate_review_needed`;
- contains no destructive DELETE or ALTER operations; temporary mapping tables are dropped automatically on commit.

**Target currently configured in script:** Workspace `9341c194-c4f6-45c4-b3b1-37a832a7fc68` (named `Diana Job Search`) and human Principal `5d469573-deae-4500-bacb-4bbecffad83b`.

The script has been generated and statically reviewed but has **not** been executed.
