# Gmail Hiring Intake Sync

**Status:** V1 approved  
**Cadence:** Every 6 hours  
**Account:** diana@marencoai.com

## Purpose

Keep the job-search inbox organized while turning hiring-related email into structured Supabase events and candidate work.

Gmail is a sensing layer. Supabase remains the source of truth.

## Polling Model

V1 uses scheduled polling every 6 hours rather than push/webhook delivery.

Each run:
1. reads new hiring-related email plus a 12-hour reconciliation lookback;
2. skips any message already represented by an idempotent Gmail classification Activity Event;
3. classifies the email;
4. applies the correct Gmail label;
5. archives or keeps the message in Inbox according to policy;
6. matches the email to Company / Opportunity / Application when possible;
7. writes a Supabase Activity Event;
8. creates or updates job-search state only when the match is sufficiently confident.

Idempotency key:

`gmail:{message_id}:classification:v1`

A processed message must never create duplicate Activity Events or duplicate Next Actions.

## Gmail Taxonomy

### HR/Hiring/Job Alerts

Use for provider alerts and suggested roles such as Indeed, LinkedIn, Built In, Jobot, etc.

Inbox behavior:
- label;
- archive after processing.

Supabase behavior:
- record classification event;
- queue for later batched job intake;
- do not run Evaluation Agent during the Gmail polling run;
- never treat a job alert as proof of application.

### HR/Hiring/Applied

Use only when an employer/ATS/provider confirms that an application was submitted or received.

Inbox behavior:
- label;
- archive after processing.

Supabase behavior:
- exact Application match: confirm/reconcile Application;
- exact Opportunity but no Application: create reconciliation Next Action;
- ambiguous match: do not change application state.

### HR/Hiring/Action Needed

Use when the candidate must do something, including:
- finish an application;
- answer recruiter questions;
- complete an assessment;
- complete candidate-account setup;
- provide requested information.

Inbox behavior:
- label;
- keep in Inbox until resolved.

Supabase behavior:
- create high-priority Next Action;
- do not change Opportunity stage merely because an action is requested.

### HR/Hiring/Interviews

Use for:
- recruiter screens;
- hiring-manager screens;
- interview invitations;
- scheduling requests;
- interview confirmations.

Inbox behavior:
- label;
- keep in Inbox while active.

Supabase behavior:
- record interview/scheduling Activity Event;
- create candidate Next Action;
- future Interview domain may replace this temporary event/action behavior.

### HR/Hiring/Rejections

Use only for explicit employer/application decisions that the candidacy will not move forward.

Inbox behavior:
- label;
- archive after processing.

Supabase behavior:
- update exact matched Application/Opportunity;
- ambiguous match never closes an Opportunity;
- networking messages saying there is no current opening belong in Outreach, not Rejections.

### HR/Hiring/Offers

Use only for real employment offers or offer-related employer communication.

Inbox behavior:
- label;
- keep in Inbox.

Supabase behavior:
- urgent Activity Event;
- urgent Next Action;
- never classify marketing/sales "offers" as job offers.

### HR/Hiring/Outreach

Use for job-search networking, referrals, hiring-manager/recruiter outreach, and replies that are not formal application decisions.

Inbox behavior:
- keep in Inbox when a response is required;
- informational threads may be archived after processing.

Supabase behavior:
- record Activity Event;
- create Next Action only when a reply/follow-up is actually required.

## Confidence and Matching

Before mutating job state, prefer exact matching using:
1. existing Gmail confirmation reference;
2. requisition/job ID;
3. company + exact/normalized role title;
4. known Application Package / Opportunity;
5. provider-specific application reference.

If the email can be classified but cannot be matched confidently:
- apply the Gmail label when the category itself is clear;
- do not mutate Application or Opportunity lifecycle;
- create a review Next Action with the email reference.

## Activity Event Contract

Every successfully processed hiring email creates one Activity Event with:
- `source_system = gmail`;
- `source_reference = gmail_message:{message_id}`;
- `idempotency_key = gmail:{message_id}:classification:v1`;
- event timestamp from the email when available;
- event type `gmail_message_classified` for generic classification, or a more specific event type when appropriate;
- opportunity_id only when confidently matched;
- candidate-attention flag based on the label policy.

## Safety Boundaries

The Gmail sync may:
- read Gmail;
- apply/remove job-search labels;
- archive messages according to policy;
- write Activity Events;
- create Next Actions;
- reconcile confirmed application/rejection/interview state when exact.

The Gmail sync may not:
- send email;
- submit applications;
- approve Application Packages;
- invent Opportunity matches;
- close an Opportunity from an ambiguous email;
- run Evaluation Agent for every Job Alert during polling.

## Future Layers

After V1 classification is proven:
1. batched Job Alert intake and deduplication;
2. Morning Planner / Daily Work Queue;
3. Interview domain integration;
4. Outreach follow-up automation;
5. optional push/webhook intake if polling ever becomes insufficient.
