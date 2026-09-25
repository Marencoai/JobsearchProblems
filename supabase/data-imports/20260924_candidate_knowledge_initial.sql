-- Candidate Knowledge initial import
-- Generated 2026-09-24 from docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md
-- REVIEW ONLY: not a migration and not executed automatically.
-- Target workspace: "Diana Job Search".
begin;

do $guard$
declare
  v_workspace uuid := '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid;
  v_principal uuid := '5d469573-deae-4500-bacb-4bbecffad83b'::uuid;
  v_auth uuid;
  v_existing integer;
begin
  if not exists (
    select 1 from public.workspace_memberships wm
    join public.principals p on p.id=wm.principal_id
    where wm.workspace_id=v_workspace and wm.principal_id=v_principal
      and wm.status='active' and p.status='active' and p.principal_type='human'
  ) then raise exception 'Target active human membership not found'; end if;

  select auth_user_id into v_auth from public.principals where id=v_principal;
  if v_auth is null then raise exception 'Target Principal has no auth_user_id'; end if;

  perform set_config('request.jwt.claims',
    jsonb_build_object('sub',v_auth::text,'role','authenticated')::text,true);

  select
    (select count(*) from public.work_experiences where workspace_id=v_workspace) +
    (select count(*) from public.projects where workspace_id=v_workspace) +
    (select count(*) from public.evidence_stories where workspace_id=v_workspace) +
    (select count(*) from public.skills where workspace_id=v_workspace) +
    (select count(*) from public.tools where workspace_id=v_workspace)
  into v_existing;

  if v_existing <> 0 then
    raise exception 'Candidate Knowledge already exists in target workspace; aborting initial import';
  end if;
end
$guard$;

create temporary table _ck_we(code text primary key,id uuid not null default gen_random_uuid()) on commit drop;
create temporary table _ck_pr(code text primary key,id uuid not null default gen_random_uuid()) on commit drop;
create temporary table _ck_es(code text primary key,id uuid not null default gen_random_uuid()) on commit drop;

insert into _ck_we(code) values ('WE-01'),('WE-02'),('WE-03'),('WE-04'),('WE-05'),('WE-06'),('WE-07');
insert into _ck_pr(code) values ('PR-01'),('PR-02'),('PR-03'),('PR-04'),('PR-05'),('PR-06'),('PR-07'),('PR-08'),('PR-09'),('PR-10'),('PR-11'),('PR-12'),('PR-13'),('PR-14'),('PR-15'),('PR-16'),('PR-17');
insert into _ck_es(code) values ('ES-01'),('ES-02'),('ES-03'),('ES-04'),('ES-05'),('ES-06'),('ES-07'),('ES-08'),('ES-09'),('ES-10'),('ES-11'),('ES-12'),('ES-13'),('ES-14'),('ES-15'),('ES-16'),('ES-17'),('ES-18'),('ES-19'),('ES-20'),('ES-21'),('ES-22'),('ES-23'),('ES-24'),('ES-25'),('ES-26'),('ES-27'),('ES-28'),('ES-29'),('ES-30'),('ES-31'),('ES-32');

-- Work Experiences

insert into public.work_experiences(
 id,workspace_id,company_name,role_title,employment_type,start_date,end_date,is_current,
 summary,responsibilities,systems_owned,major_outcomes,promotion_history,source_type,source_reference,validation_status)
select m.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,'Alpine Development Collaborative','AI Operations Strategist','Contract','2025-05-01'::date,'2026-09-01'::date,false,
'Led AI strategy, operational transformation, and systems implementation for an affordable-housing developer. Worked directly with leadership and staff to identify workflow, information, and decision-making bottlenecks; implemented AI-enabled workflows; and designed/deployed Housing Compass as a structured operating system for the business.','Workflow and operational discovery; AI implementation; process redesign; systems architecture; training and adoption; operational continuity and knowledge access.','Housing Compass; ChatGPT; Claude; Outlook; SharePoint; Read.ai.','Housing Compass production deployment; zero missed funding application deadlines after the AI layer went live; funding applications completed in about half the time; vicinity maps reduced from about 8 hours to under 1 hour; proforma consolidation reduced from days to under a day; status-update email volume reduced about 20%.',null,
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#WE-01','confirmed'
from _ck_we m where m.code='WE-01';

insert into public.work_experiences(
 id,workspace_id,company_name,role_title,employment_type,start_date,end_date,is_current,
 summary,responsibilities,systems_owned,major_outcomes,promotion_history,source_type,source_reference,validation_status)
select m.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,'Levo Funding','Director of Founding Operations','Full-time','2023-10-01'::date,'2025-04-01'::date,false,
'Founding operations leader and primary systems owner for a fully online merchant-cash-advance lender. Built and supported the operating technology stack, led CRM migration and automation, managed vendors and deployments, and redesigned workflows around structured data and exception-based human review.','CRM migration; requirements discovery; workflow design; underwriting automation; Salesforce business logic; vendor management; UAT; infrastructure; user provisioning; adoption and training.','Zoho; Salesforce; Azure AI Builder; Heron Data; Experian; CLEAR; DocuSign; AWS S3.','Approval time 48h → 24h; merchant onboarding -40%; three underwriters handled roughly 2,000 monthly submissions; eliminated a $6K/month offshore processing team; Salesforce Administrator certification earned during the role.',null,
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#WE-02','confirmed'
from _ck_we m where m.code='WE-02';

insert into public.work_experiences(
 id,workspace_id,company_name,role_title,employment_type,start_date,end_date,is_current,
 summary,responsibilities,systems_owned,major_outcomes,promotion_history,source_type,source_reference,validation_status)
select m.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,'Backd Business Funding','Director of Sales Operations','Freelance / consulting engagement','2023-05-01'::date,'2023-10-01'::date,false,
'Recruited to launch and scale a new direct-sales operation from the ground up. Owned site selection, budgeting, contract negotiation, hiring, onboarding, operating systems, reporting, and day-to-day sales-operations support while managing a bi-coastal team.','Site selection; budgeting; WeWork negotiation; hiring; onboarding; systems buildout; reporting; automation; process standardization; sales operations.','Performance dashboards and reporting infrastructure.','Direct-sales team monthly funding grew from $1M to $3.5M within six months; productivity improved 15%; engagement led directly to recruitment into Levo''s founding team.',null,
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#WE-03','confirmed'
from _ck_we m where m.code='WE-03';

insert into public.work_experiences(
 id,workspace_id,company_name,role_title,employment_type,start_date,end_date,is_current,
 summary,responsibilities,systems_owned,major_outcomes,promotion_history,source_type,source_reference,validation_status)
select m.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,'Reliant Funding','Director of Sales Operations','Full-time','2020-06-01'::date,'2023-04-01'::date,false,
'Led sales operations and team performance in a high-volume alternative-finance organization. Managed 60+ sales representatives and four managers, built Salesforce reporting to expose revenue bottlenecks, redesigned lead distribution, and partnered with BI and marketing on routing and acquisition strategy.','Sales leadership; Salesforce reporting; analytics; lead-routing redesign; BI partnership; marketing feedback loops; sales enablement; phone-system migration.','Salesforce; Distribution Engine; Spinify; revenue-organization phone system.','Average monthly funding approximately $4.5M → $9M with the same lead volume and fewer reps; funded units 230 → 270/month; average deal size $22K → $28K; operating costs -11%; marketing expenses -6%; submissions 1,800 → 2,300/month; Spinify-related productivity +17%.','Sales Manager → Director of Sales Operations',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#WE-04','confirmed'
from _ck_we m where m.code='WE-04';

insert into public.work_experiences(
 id,workspace_id,company_name,role_title,employment_type,start_date,end_date,is_current,
 summary,responsibilities,systems_owned,major_outcomes,promotion_history,source_type,source_reference,validation_status)
select m.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,'Ferrari & Maserati of San Diego','Service Manager','Full-time','2018-02-01'::date,'2020-04-01'::date,false,
'Progressed from Service Advisor to Service Manager in a luxury automotive environment. Led the Maserati service turnaround by redesigning internal service flow and the client-facing experience while helping customers make informed decisions about expensive technical repairs.','Service operations; appointment/intake/RO workflow; shop and parts coordination; customer communication; loaner experience; delivery; technical explanation; turnaround leadership.','Dealer service appointment, repair-order, parts, shop-flow, and customer-communication processes.','Underperforming Maserati service line became the dealership''s top performer; gross profit +40%+; CSAT 96%; public ratings 3.0 → 4.6; repeat business +25%; service turnaround -20%; service revenue +15% YoY; retention improvements contributed an additional 35% gross profit.','Service Advisor → Service Manager',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#WE-05','confirmed'
from _ck_we m where m.code='WE-05';

insert into public.work_experiences(
 id,workspace_id,company_name,role_title,employment_type,start_date,end_date,is_current,
 summary,responsibilities,systems_owned,major_outcomes,promotion_history,source_type,source_reference,validation_status)
select m.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,'Choice Financial Debt Relief','Sales Manager','Full-time','2016-07-01'::date,'2018-02-01'::date,false,
'Progressed from individual sales into management in consumer debt validation, ultimately leading a remote team of 10–12 account executives. Improved conversion through individualized coaching, sales enablement, objection handling, and performance management.','Consultative sales; coaching; performance management; scripts and rebuttals; objection handling; team development; sensitive financial-service communication.','Microsoft OneNote sales-enablement library and internal coaching system.','Lead-to-close conversion 18% → 25%, a company record; approximately $2.2M additional revenue from the conversion improvement; team consistently outperformed peer teams.','Account Executive → Sales Manager',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#WE-06','confirmed'
from _ck_we m where m.code='WE-06';

insert into public.work_experiences(
 id,workspace_id,company_name,role_title,employment_type,start_date,end_date,is_current,
 summary,responsibilities,systems_owned,major_outcomes,promotion_history,source_type,source_reference,validation_status)
select m.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,'Park Place Mercedes-Benz','Assistant Service Manager','Full-time','2012-06-01'::date,'2016-05-01'::date,false,
'Progressed from Service Advisor to Assistant Service Manager in a high-volume Mercedes-Benz service operation. Owned customer relationships from write-up through delivery, translated technician diagnoses into understandable options, and coordinated work across advisors and technicians.','Customer discovery; write-up; recommendation; technical translation; coordination; status communication; delivery; service-management support.','Luxury automotive service-drive workflows.','Environment handled 200+ vehicles/day across about 24 advisors and 80+ technicians; maintained 96.3 customer-satisfaction average; trained within Park Place''s Ritz-Carlton-based service model.','Service Advisor → Assistant Service Manager',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#WE-07','confirmed'
from _ck_we m where m.code='WE-07';

-- Projects and primary Work Experience links

insert into public.projects(
 id,workspace_id,name,summary,problem_statement,candidate_role,architecture_summary,outcomes,quantitative_results,
 status,source_type,source_reference,validation_status)
select pm.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,'Housing Compass','Critical project, funding, document, financial, task, and operational knowledge was fragmented across SharePoint, spreadsheets, Outlook, and institutional memory.','Critical project, funding, document, financial, task, and operational knowledge was fragmented across SharePoint, spreadsheets, Outlook, and institutional memory.','Discovery lead, system designer, builder, implementation lead, trainer.','React, TypeScript, PostgreSQL/Supabase; 60+ tables; 500+ RLS policies; 15+ Edge Functions; role-based permissions; financial modeling across 15+ funding sources.','One structured operating system spanning projects, funding, documents, tasks, financials, and operational knowledge.','60+ tables; 500+ RLS policies; 15+ Edge Functions; 15+ funding sources.',
'completed','approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#PR-01','confirmed'
from _ck_pr pm where pm.code='PR-01';

insert into public.project_work_experiences(
 workspace_id,project_id,work_experience_id,relationship_type,is_primary,contribution_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,wm.id,'primary',true,'Primary work experience for Housing Compass','confirmed'
from _ck_pr pm join _ck_we wm on wm.code='WE-01'
where pm.code='PR-01';

insert into public.projects(
 id,workspace_id,name,summary,problem_statement,candidate_role,architecture_summary,outcomes,quantitative_results,
 status,source_type,source_reference,validation_status)
select pm.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,'AI Workflow Enablement & Adoption','Employees needed immediate relief from manual information retrieval, email/document searching, meeting follow-up, and fragmented operational context while the larger platform was being built.','Employees needed immediate relief from manual information retrieval, email/document searching, meeting follow-up, and fragmented operational context while the larger platform was being built.','AI workflow designer, trainer, adoption lead, troubleshooter.','ChatGPT/Claude connected with Outlook, SharePoint, Read.ai and company context; reusable skills and natural-language workflows.','AI-assisted workflows replaced significant manual searching and repetitive coordination.','Zero missed deadlines; applications about half the time; vicinity maps ~8h to <1h; proforma days to <1 day; status email volume -20%.',
'completed','approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#PR-02','confirmed'
from _ck_pr pm where pm.code='PR-02';

insert into public.project_work_experiences(
 workspace_id,project_id,work_experience_id,relationship_type,is_primary,contribution_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,wm.id,'primary',true,'Primary work experience for AI Workflow Enablement & Adoption','confirmed'
from _ck_pr pm join _ck_we wm on wm.code='WE-01'
where pm.code='PR-02';

insert into public.projects(
 id,workspace_id,name,summary,problem_statement,candidate_role,architecture_summary,outcomes,quantitative_results,
 status,source_type,source_reference,validation_status)
select pm.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,'Secure SharePoint-to-Claude MCP Connector','AI needed secure, attributable access to live SharePoint documents without bypassing user-level authorization.','AI needed secure, attributable access to live SharePoint documents without bypassing user-level authorization.','Solution designer / builder.','MCP-based integration with user-scoped authentication and SharePoint.','Claude could work with live SharePoint content while following the user''s access boundary.',null,
'completed','approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#PR-03','candidate_review_needed'
from _ck_pr pm where pm.code='PR-03';

insert into public.project_work_experiences(
 workspace_id,project_id,work_experience_id,relationship_type,is_primary,contribution_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,wm.id,'primary',true,'Primary work experience for Secure SharePoint-to-Claude MCP Connector','candidate_review_needed'
from _ck_pr pm join _ck_we wm on wm.code='WE-01'
where pm.code='PR-03';

insert into public.projects(
 id,workspace_id,name,summary,problem_statement,candidate_role,architecture_summary,outcomes,quantitative_results,
 status,source_type,source_reference,validation_status)
select pm.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,'Zoho → Salesforce Migration','The startup needed an enterprise CRM and operating model reflecting cross-functional requirements.','The startup needed an enterprise CRM and operating model reflecting cross-functional requirements.','Requirements-discovery lead and implementation owner.','Zoho and Salesforce across revenue and underwriting workflows.','Created the Salesforce foundation, reports, dashboards, workflows, UAT and rollout.','100+ reports/dashboards/workflows represented in source material.',
'completed','approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#PR-04','confirmed'
from _ck_pr pm where pm.code='PR-04';

insert into public.project_work_experiences(
 workspace_id,project_id,work_experience_id,relationship_type,is_primary,contribution_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,wm.id,'primary',true,'Primary work experience for Zoho → Salesforce Migration','confirmed'
from _ck_pr pm join _ck_we wm on wm.code='WE-02'
where pm.code='PR-04';

insert into public.projects(
 id,workspace_id,name,summary,problem_statement,candidate_role,architecture_summary,outcomes,quantitative_results,
 status,source_type,source_reference,validation_status)
select pm.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,'Salesforce Business Logic / Lending Platform','The specialist-built Salesforce implementation stored data but did not yet execute enough business logic.','The specialist-built Salesforce implementation stored data but did not yet execute enough business logic.','Business-systems owner / Salesforce administrator.','Salesforce formulas, flows, pricing, approvals, notifications, commissions/clawbacks and DocuSign routing.','Moved key operating logic into the CRM.',null,
'completed','approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#PR-05','confirmed'
from _ck_pr pm where pm.code='PR-05';

insert into public.project_work_experiences(
 workspace_id,project_id,work_experience_id,relationship_type,is_primary,contribution_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,wm.id,'primary',true,'Primary work experience for Salesforce Business Logic / Lending Platform','confirmed'
from _ck_pr pm join _ck_we wm on wm.code='WE-02'
where pm.code='PR-05';

insert into public.projects(
 id,workspace_id,name,summary,problem_statement,candidate_role,architecture_summary,outcomes,quantitative_results,
 status,source_type,source_reference,validation_status)
select pm.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,'Underwriting Automation','Manual intake and document processing created underwriting delay and unnecessary human data entry.','Manual intake and document processing created underwriting delay and unnecessary human data entry.','Operations/system owner.','Salesforce + Azure AI Builder/OCR + Heron Data + external data integrations.','Faster approvals/onboarding with higher throughput and exception-based review.','Approval 48h → 24h; onboarding -40%; 3 underwriters ~2,000 monthly submissions; $6K/month offshore team eliminated.',
'completed','approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#PR-06','confirmed'
from _ck_pr pm where pm.code='PR-06';

insert into public.project_work_experiences(
 workspace_id,project_id,work_experience_id,relationship_type,is_primary,contribution_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,wm.id,'primary',true,'Primary work experience for Underwriting Automation','confirmed'
from _ck_pr pm join _ck_we wm on wm.code='WE-02'
where pm.code='PR-06';

insert into public.projects(
 id,workspace_id,name,summary,problem_statement,candidate_role,architecture_summary,outcomes,quantitative_results,
 status,source_type,source_reference,validation_status)
select pm.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,'Systems & Infrastructure Ownership','The founding team lacked internal IT/CTO ownership for the systems required to run the company.','The founding team lacked internal IT/CTO ownership for the systems required to run the company.','Primary systems owner.','Cross-system operational infrastructure spanning CRM, communications and cloud services.','Provided coherent ownership for vendors, UAT, provisioning, licenses, DNS/domains/whitelisting and related systems.',null,
'completed','approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#PR-07','confirmed'
from _ck_pr pm where pm.code='PR-07';

insert into public.project_work_experiences(
 workspace_id,project_id,work_experience_id,relationship_type,is_primary,contribution_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,wm.id,'primary',true,'Primary work experience for Systems & Infrastructure Ownership','confirmed'
from _ck_pr pm join _ck_we wm on wm.code='WE-02'
where pm.code='PR-07';

insert into public.projects(
 id,workspace_id,name,summary,problem_statement,candidate_role,architecture_summary,outcomes,quantitative_results,
 status,source_type,source_reference,validation_status)
select pm.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,'San Diego Direct-Sales Office Launch','A new direct-sales operation needed to be launched from zero.','A new direct-sales operation needed to be launched from zero.','Director of Sales Operations / launch owner.','New office and sales-operation operating stack.','Launched and scaled the direct-sales team.','Monthly direct-team funding $1M → $3.5M in six months.',
'completed','approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#PR-08','confirmed'
from _ck_pr pm where pm.code='PR-08';

insert into public.project_work_experiences(
 workspace_id,project_id,work_experience_id,relationship_type,is_primary,contribution_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,wm.id,'primary',true,'Primary work experience for San Diego Direct-Sales Office Launch','confirmed'
from _ck_pr pm join _ck_we wm on wm.code='WE-03'
where pm.code='PR-08';

insert into public.projects(
 id,workspace_id,name,summary,problem_statement,candidate_role,architecture_summary,outcomes,quantitative_results,
 status,source_type,source_reference,validation_status)
select pm.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,'Performance & Sales-Ops Infrastructure','The new office needed repeatable reporting, performance visibility and standardized processes.','The new office needed repeatable reporting, performance visibility and standardized processes.','Sales-operations designer.','Performance-management and reporting infrastructure.','Improved productivity and management visibility.','15% productivity improvement.',
'completed','approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#PR-09','confirmed'
from _ck_pr pm where pm.code='PR-09';

insert into public.project_work_experiences(
 workspace_id,project_id,work_experience_id,relationship_type,is_primary,contribution_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,wm.id,'primary',true,'Primary work experience for Performance & Sales-Ops Infrastructure','confirmed'
from _ck_pr pm join _ck_we wm on wm.code='WE-03'
where pm.code='PR-09';

insert into public.projects(
 id,workspace_id,name,summary,problem_statement,candidate_role,architecture_summary,outcomes,quantitative_results,
 status,source_type,source_reference,validation_status)
select pm.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,'Sales Performance Analytics','Management saw stalled revenue but lacked visibility into where performance was breaking down.','Management saw stalled revenue but lacked visibility into where performance was breaking down.','Sales leader and self-taught Salesforce analyst/admin.','Salesforce reporting and performance dashboards.','Made the revenue bottleneck measurable enough to diagnose and redesign.',null,
'completed','approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#PR-10','confirmed'
from _ck_pr pm where pm.code='PR-10';

insert into public.project_work_experiences(
 workspace_id,project_id,work_experience_id,relationship_type,is_primary,contribution_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,wm.id,'primary',true,'Primary work experience for Sales Performance Analytics','confirmed'
from _ck_pr pm join _ck_we wm on wm.code='WE-04'
where pm.code='PR-10';

insert into public.projects(
 id,workspace_id,name,summary,problem_statement,candidate_role,architecture_summary,outcomes,quantitative_results,
 status,source_type,source_reference,validation_status)
select pm.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,'Lead Distribution Redesign','Large purchased lead volume sat in a shared pool that rewarded speed/hoarding rather than fit and performance.','Large purchased lead volume sat in a shared pool that rewarded speed/hoarding rather than fit and performance.','Sales operations leader.','Salesforce + Distribution Engine lead-routing model.','Improved conversion, funding volume and efficiency without increasing lead volume.','Average monthly funding ~$4.5M → ~$9M; funded units 230 → 270/month; average deal size $22K → $28K; operating costs -11%; marketing -6%; submissions 1,800 → 2,300/month.',
'completed','approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#PR-11','confirmed'
from _ck_pr pm where pm.code='PR-11';

insert into public.project_work_experiences(
 workspace_id,project_id,work_experience_id,relationship_type,is_primary,contribution_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,wm.id,'primary',true,'Primary work experience for Lead Distribution Redesign','confirmed'
from _ck_pr pm join _ck_we wm on wm.code='WE-04'
where pm.code='PR-11';

insert into public.projects(
 id,workspace_id,name,summary,problem_statement,candidate_role,architecture_summary,outcomes,quantitative_results,
 status,source_type,source_reference,validation_status)
select pm.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,'Sales Gamification & Execution Visibility','The sales floor needed more immediate visibility into performance and execution.','The sales floor needed more immediate visibility into performance and execution.','Sales operations leader.','Spinify leaderboards tied to sales-performance metrics.','Improved visibility and execution.','17% productivity improvement associated with Spinify.',
'completed','approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#PR-12','confirmed'
from _ck_pr pm where pm.code='PR-12';

insert into public.project_work_experiences(
 workspace_id,project_id,work_experience_id,relationship_type,is_primary,contribution_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,wm.id,'primary',true,'Primary work experience for Sales Gamification & Execution Visibility','confirmed'
from _ck_pr pm join _ck_we wm on wm.code='WE-04'
where pm.code='PR-12';

insert into public.projects(
 id,workspace_id,name,summary,problem_statement,candidate_role,architecture_summary,outcomes,quantitative_results,
 status,source_type,source_reference,validation_status)
select pm.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,'Revenue-Organization Phone-System Migration','The revenue organization needed a coordinated phone-system migration without disrupting sales operations.','The revenue organization needed a coordinated phone-system migration without disrupting sales operations.','Implementation lead.','Phone-system migration across approximately 60 lines.','Completed large-scale migration smoothly.','~150 users / ~60 lines.',
'completed','approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#PR-13','confirmed'
from _ck_pr pm where pm.code='PR-13';

insert into public.project_work_experiences(
 workspace_id,project_id,work_experience_id,relationship_type,is_primary,contribution_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,wm.id,'primary',true,'Primary work experience for Revenue-Organization Phone-System Migration','confirmed'
from _ck_pr pm join _ck_we wm on wm.code='WE-04'
where pm.code='PR-13';

insert into public.projects(
 id,workspace_id,name,summary,problem_statement,candidate_role,architecture_summary,outcomes,quantitative_results,
 status,source_type,source_reference,validation_status)
select pm.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,'Maserati Service Operations Redesign','Internal service flow created delays and inconsistency from appointment through delivery readiness.','Internal service flow created delays and inconsistency from appointment through delivery readiness.','Service Manager / operations redesign lead.','End-to-end internal vehicle-service workflow.','Vehicles moved through service more predictably and quickly.','Service turnaround -20%.',
'completed','approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#PR-14','confirmed'
from _ck_pr pm where pm.code='PR-14';

insert into public.project_work_experiences(
 workspace_id,project_id,work_experience_id,relationship_type,is_primary,contribution_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,wm.id,'primary',true,'Primary work experience for Maserati Service Operations Redesign','confirmed'
from _ck_pr pm join _ck_we wm on wm.code='WE-05'
where pm.code='PR-14';

insert into public.projects(
 id,workspace_id,name,summary,problem_statement,candidate_role,architecture_summary,outcomes,quantitative_results,
 status,source_type,source_reference,validation_status)
select pm.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,'Maserati Customer Experience Redesign','The client experience did not match premium-service expectations.','The client experience did not match premium-service expectations.','Service Manager / customer-experience redesign lead.','Client-facing service model layered onto the internal service process.','Improved satisfaction, ratings, repeat business and service economics.','CSAT 96%; ratings 3.0 → 4.6; repeat business +25%; service revenue +15% YoY; retention improvements contributed additional 35% gross profit.',
'completed','approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#PR-15','confirmed'
from _ck_pr pm where pm.code='PR-15';

insert into public.project_work_experiences(
 workspace_id,project_id,work_experience_id,relationship_type,is_primary,contribution_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,wm.id,'primary',true,'Primary work experience for Maserati Customer Experience Redesign','confirmed'
from _ck_pr pm join _ck_we wm on wm.code='WE-05'
where pm.code='PR-15';

insert into public.projects(
 id,workspace_id,name,summary,problem_statement,candidate_role,architecture_summary,outcomes,quantitative_results,
 status,source_type,source_reference,validation_status)
select pm.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,'Sales Team Performance & Coaching System','A sales team needed stronger and more individualized performance management.','A sales team needed stronger and more individualized performance management.','Sales Manager.','Coaching/performance-management system.','Raised conversion to a company record and consistently outperformed peer teams.','Lead-to-close 18% → 25%; ~$2.2M additional revenue.',
'completed','approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#PR-16','confirmed'
from _ck_pr pm where pm.code='PR-16';

insert into public.project_work_experiences(
 workspace_id,project_id,work_experience_id,relationship_type,is_primary,contribution_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,wm.id,'primary',true,'Primary work experience for Sales Team Performance & Coaching System','confirmed'
from _ck_pr pm join _ck_we wm on wm.code='WE-06'
where pm.code='PR-16';

insert into public.projects(
 id,workspace_id,name,summary,problem_statement,candidate_role,architecture_summary,outcomes,quantitative_results,
 status,source_type,source_reference,validation_status)
select pm.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,'Sales Enablement & Personalized Playbooks','Sales representatives needed reusable objection handling that could adapt to individual selling styles.','Sales representatives needed reusable objection handling that could adapt to individual selling styles.','Sales Manager / enablement builder.','Microsoft OneNote knowledge library.','Created reusable sales knowledge without forcing every rep into one rigid script.',null,
'completed','approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#PR-17','confirmed'
from _ck_pr pm where pm.code='PR-17';

insert into public.project_work_experiences(
 workspace_id,project_id,work_experience_id,relationship_type,is_primary,contribution_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,wm.id,'primary',true,'Primary work experience for Sales Enablement & Personalized Playbooks','confirmed'
from _ck_pr pm join _ck_we wm on wm.code='WE-06'
where pm.code='PR-17';

-- Skill taxonomy
insert into public.skills(workspace_id,name,normalized_name,category,description,status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,v.name,lower(v.name),'candidate capability','Reusable candidate capability: '||v.name,'active'
from unnest(array['Requirements Discovery','Customer Discovery','Process Mapping','Root-Cause Analysis','Problem Diagnosis','Data-Driven Decision Making','Rapid Learning','Business Systems Architecture','Solution Design','CRM Strategy','Salesforce Administration','Salesforce Reporting','Workflow Design','Workflow Automation','Systems Integration','API Integration','Data Integration','Data Modeling','Business Logic Design','Access-Control Design','Security-Conscious Architecture','Troubleshooting','UAT','Implementation Management','Systems Ownership','Underwriting Operations','AI Strategy & Use Case Prioritization','AI Enablement','AI Workflow Design','Knowledge Management','Change Management','User Adoption & Training','Operational Resilience','Revenue Operations','Sales Operations','Sales Leadership','Consultative Selling','Lead Distribution Strategy','Sales Process Design','Conversion Optimization','Performance Analytics','Sales Coaching','Sales Enablement','Objection Handling','Marketing Alignment','Playbook Development','Zero-to-One Operations','Operational Launch','Operational Turnaround','Process Improvement','Process Standardization','Operational Efficiency','Vendor Management','Budget Management','Hiring','Team Leadership','Cross-Functional Leadership','Cross-Functional Coordination','Performance Management','Operational Leadership','Technical Translation','Customer Experience Design','Service Design','Customer Education','Decision Support','Customer Retention','Luxury Client Management','Relationship Management','Active Listening','Executive Communication','Stakeholder Management','Prioritization','High-Volume Operations','End-to-End Ownership','Team Development','Adaptive Leadership','Adaptive Coaching','Customer Experience','Revenue Growth','Team Performance','Dashboard/Reporting Design','Cross-Functional Operations','User-Centered Systems Design','Change Adoption']::text[]) as v(name);

-- Tool taxonomy
insert into public.tools(workspace_id,name,normalized_name,category,description,status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,v.name,lower(v.name),'candidate tool','Supported candidate tool/technology: '||v.name,'active'
from unnest(array['ChatGPT / OpenAI','Claude','Claude Skills','MCP','RAG','Read.ai','Azure AI Builder','Salesforce','Salesforce Flow Builder','Zoho','Distribution Engine','Spinify','DocuSign','Microsoft OneNote','Supabase','PostgreSQL','REST APIs','Heron Data','Experian','CLEAR','AWS S3','Azure','SharePoint','Outlook','Power Automate','OCR pipelines','token-forwarded authentication','React','TypeScript','Python','Claude Code','Cursor','Lovable','GitHub']::text[]) as v(name);

-- Evidence Stories

insert into public.evidence_stories(
 id,workspace_id,work_experience_id,project_id,title,situation,actions_taken,outcome,quantitative_impact,
 professional_translation,evidence_type,validation_status,confidence_level,source_type,source_reference)
select em.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,wm.id,(select id from _ck_pr where code='PR-01'),'Embed Before Building','Worked directly with leadership and staff to understand how work actually moved before designing Housing Compass.','Observed the real workflow, mapped bottlenecks and translated operating reality into system requirements.','Created grounded requirements for the production system.',null,
'Requirements discovery; process mapping; stakeholder management; business systems architecture.','direct','confirmed','high',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#ES-01'
from _ck_es em join _ck_we wm on wm.code='WE-01'
where em.code='ES-01';

insert into public.evidence_stories(
 id,workspace_id,work_experience_id,project_id,title,situation,actions_taken,outcome,quantitative_impact,
 professional_translation,evidence_type,validation_status,confidence_level,source_type,source_reference)
select em.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,wm.id,(select id from _ck_pr where code='PR-01'),'Build Housing Compass for an Unfamiliar Industry','Entered affordable housing without prior domain expertise and needed to understand the operating model deeply enough to build for it.','Learned the domain, modeled workflows and built a production operating system.','Production system deployed and used.',null,
'Rapid learning; solution design; data modeling; workflow design.','direct','confirmed','high',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#ES-02'
from _ck_es em join _ck_we wm on wm.code='WE-01'
where em.code='ES-02';

insert into public.evidence_stories(
 id,workspace_id,work_experience_id,project_id,title,situation,actions_taken,outcome,quantitative_impact,
 professional_translation,evidence_type,validation_status,confidence_level,source_type,source_reference)
select em.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,wm.id,(select id from _ck_pr where code='PR-01'),'Design Enterprise-Grade Permissions','A multi-role operating system needed user-specific access boundaries.','Designed role-based permissions and a large RLS policy surface.','Established row-level access controls across the system.','60+ tables; 500+ RLS policies; 15+ Edge Functions in the broader system.',
'Access-control design; security-conscious architecture; data modeling.','direct','confirmed','high',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#ES-03'
from _ck_es em join _ck_we wm on wm.code='WE-01'
where em.code='ES-03';

insert into public.evidence_stories(
 id,workspace_id,work_experience_id,project_id,title,situation,actions_taken,outcome,quantitative_impact,
 professional_translation,evidence_type,validation_status,confidence_level,source_type,source_reference)
select em.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,wm.id,(select id from _ck_pr where code='PR-02'),'Move Nontechnical Staff Into AI-Assisted Work','Nontechnical staff needed practical help using AI in daily work.','Implemented AI workflows and trained staff until users could work independently.','Users adopted AI-assisted workflows; at least one user progressed to building her own workflow/tooling.',null,
'AI enablement; user adoption; training; change management; technical translation.','direct','confirmed','high',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#ES-04'
from _ck_es em join _ck_we wm on wm.code='WE-01'
where em.code='ES-04';

insert into public.evidence_stories(
 id,workspace_id,work_experience_id,project_id,title,situation,actions_taken,outcome,quantitative_impact,
 professional_translation,evidence_type,validation_status,confidence_level,source_type,source_reference)
select em.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,wm.id,(select id from _ck_pr where code='PR-02'),'Preserve Operational Continuity Through Searchable Institutional Knowledge','Critical operational context was difficult to retrieve and too dependent on where information lived or who remembered it.','Connected AI and workplace tools so staff could retrieve project context and priorities without manual search.','Reduced dependence on manual search and individual institutional memory.',null,
'Knowledge management; operational resilience; workflow design.','direct','confirmed','high',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#ES-05'
from _ck_es em join _ck_we wm on wm.code='WE-01'
where em.code='ES-05';

insert into public.evidence_stories(
 id,workspace_id,work_experience_id,project_id,title,situation,actions_taken,outcome,quantitative_impact,
 professional_translation,evidence_type,validation_status,confidence_level,source_type,source_reference)
select em.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,wm.id,(select id from _ck_pr where code='PR-03'),'Secure User-Scoped AI Access to SharePoint','AI needed access to live SharePoint content without bypassing user authorization.','Built an MCP-based connector forwarding user authentication context while enabling Claude to work with live content.','Enabled a user-scoped AI integration pattern.',null,
'Systems integration; API integration; access-control design; AI enablement.','direct','candidate_review_needed','medium',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#ES-06'
from _ck_es em join _ck_we wm on wm.code='WE-01'
where em.code='ES-06';

insert into public.evidence_stories(
 id,workspace_id,work_experience_id,project_id,title,situation,actions_taken,outcome,quantitative_impact,
 professional_translation,evidence_type,validation_status,confidence_level,source_type,source_reference)
select em.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,wm.id,(select id from _ck_pr where code='PR-04'),'Translate Company-Wide Requirements Into CRM Design','A new lender needed CRM workflows reflecting multiple departments.','Ran cross-functional discovery, mapped processes and translated them into CRM requirements.','Established a cross-functional Salesforce operating foundation.',null,
'Requirements discovery; process mapping; CRM strategy; cross-functional leadership.','direct','confirmed','high',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#ES-07'
from _ck_es em join _ck_we wm on wm.code='WE-02'
where em.code='ES-07';

insert into public.evidence_stories(
 id,workspace_id,work_experience_id,project_id,title,situation,actions_taken,outcome,quantitative_impact,
 professional_translation,evidence_type,validation_status,confidence_level,source_type,source_reference)
select em.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,wm.id,(select id from _ck_pr where code='PR-05'),'Make Salesforce Run the Business, Not Just Store Fields','The paid Salesforce build provided fields but not enough operating logic.','Built formulas, flows, pricing, approvals, notifications, commissions/clawbacks and contract routing.','Moved key business logic into the CRM.',null,
'Salesforce administration; workflow automation; business-logic design.','direct','confirmed','high',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#ES-08'
from _ck_es em join _ck_we wm on wm.code='WE-02'
where em.code='ES-08';

insert into public.evidence_stories(
 id,workspace_id,work_experience_id,project_id,title,situation,actions_taken,outcome,quantitative_impact,
 professional_translation,evidence_type,validation_status,confidence_level,source_type,source_reference)
select em.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,wm.id,(select id from _ck_pr where code='PR-04'),'Interim Zoho Workflow Was Preferred by End Users','The business needed an interim workflow while a paid Salesforce build was underway.','Built an end-to-end Zoho workflow that supported the business during transition.','After Salesforce launch, sales and underwriting asked to return to the candidate''s workflow design.',null,
'User-centered workflow design; adoption; process improvement.','direct','confirmed','high',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#ES-09'
from _ck_es em join _ck_we wm on wm.code='WE-02'
where em.code='ES-09';

insert into public.evidence_stories(
 id,workspace_id,work_experience_id,project_id,title,situation,actions_taken,outcome,quantitative_impact,
 professional_translation,evidence_type,validation_status,confidence_level,source_type,source_reference)
select em.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,wm.id,(select id from _ck_pr where code='PR-06'),'Automate Underwriting Intake Before Human Review','Manual document/data processing consumed underwriting capacity.','Integrated OCR, bank-statement structuring and business/credit data into Salesforce; automated decline paths and exception routing.','Shifted work from manual data entry toward structured, exception-based review.','3 underwriters ~2,000 monthly submissions; $6K/month offshore processing team eliminated.',
'Workflow automation; data integration; underwriting operations; process redesign.','direct','confirmed','high',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#ES-10'
from _ck_es em join _ck_we wm on wm.code='WE-02'
where em.code='ES-10';

insert into public.evidence_stories(
 id,workspace_id,work_experience_id,project_id,title,situation,actions_taken,outcome,quantitative_impact,
 professional_translation,evidence_type,validation_status,confidence_level,source_type,source_reference)
select em.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,wm.id,(select id from _ck_pr where code='PR-06'),'Cut Approval and Onboarding Time','Intake and underwriting turnaround were too slow.','Redesigned intake and underwriting workflows around automation and structured data.','Faster approvals and onboarding.','Approval 48h → 24h; onboarding -40%.',
'Process improvement; operational efficiency; workflow automation.','direct','confirmed','high',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#ES-11'
from _ck_es em join _ck_we wm on wm.code='WE-02'
where em.code='ES-11';

insert into public.evidence_stories(
 id,workspace_id,work_experience_id,project_id,title,situation,actions_taken,outcome,quantitative_impact,
 professional_translation,evidence_type,validation_status,confidence_level,source_type,source_reference)
select em.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,wm.id,(select id from _ck_pr where code='PR-07'),'Own the Plumbing Nobody Else Owned','The startup had no internal CTO/IT team to own the systems layer.','Managed vendors, UAT, provisioning, licenses, DNS/domains/whitelisting and other infrastructure.','Created coherent systems ownership where none existed.',null,
'Systems ownership; vendor management; troubleshooting; UAT; operational leadership.','direct','confirmed','high',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#ES-12'
from _ck_es em join _ck_we wm on wm.code='WE-02'
where em.code='ES-12';

insert into public.evidence_stories(
 id,workspace_id,work_experience_id,project_id,title,situation,actions_taken,outcome,quantitative_impact,
 professional_translation,evidence_type,validation_status,confidence_level,source_type,source_reference)
select em.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,wm.id,(select id from _ck_pr where code='PR-08'),'Launch a New Sales Operation From Zero','A satellite direct-sales operation had to be created from scratch.','Owned site, budget, contract negotiation, hiring, onboarding, systems and operating buildout.','Launched the new operation.',null,
'Zero-to-one operations; hiring; budgeting; vendor negotiation; team leadership.','direct','confirmed','high',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#ES-13'
from _ck_es em join _ck_we wm on wm.code='WE-03'
where em.code='ES-13';

insert into public.evidence_stories(
 id,workspace_id,work_experience_id,project_id,title,situation,actions_taken,outcome,quantitative_impact,
 professional_translation,evidence_type,validation_status,confidence_level,source_type,source_reference)
select em.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,wm.id,(select id from _ck_pr where code='PR-08'),'Scale Direct-Team Funding $1M → $3.5M','The newly launched direct-sales team needed to scale production.','Built and managed the operating environment, team and sales processes.','Scaled monthly funding materially within six months.','$1M → $3.5M monthly funding.',
'Sales operations; team performance; revenue growth.','direct','confirmed','high',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#ES-14'
from _ck_es em join _ck_we wm on wm.code='WE-03'
where em.code='ES-14';

insert into public.evidence_stories(
 id,workspace_id,work_experience_id,project_id,title,situation,actions_taken,outcome,quantitative_impact,
 professional_translation,evidence_type,validation_status,confidence_level,source_type,source_reference)
select em.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,wm.id,(select id from _ck_pr where code='PR-09'),'Standardize and Automate a New Office','The new office needed consistent processes and performance visibility.','Built reporting, introduced automation and standardized processes.','Improved productivity and repeatability.','15% productivity improvement.',
'Process standardization; analytics; workflow automation.','direct','confirmed','high',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#ES-15'
from _ck_es em join _ck_we wm on wm.code='WE-03'
where em.code='ES-15';

insert into public.evidence_stories(
 id,workspace_id,work_experience_id,project_id,title,situation,actions_taken,outcome,quantitative_impact,
 professional_translation,evidence_type,validation_status,confidence_level,source_type,source_reference)
select em.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,wm.id,(select id from _ck_pr where code='PR-10'),'Make a Revenue Problem Visible Before Changing It','Management saw stalled revenue and the default explanation was to push reps harder.','Taught self Salesforce and built rep-level funnel reporting to identify where performance actually broke down.','Made the lead-distribution bottleneck measurable.',null,
'Root-cause analysis; Salesforce reporting; performance analytics; data-driven decisions.','direct','confirmed','high',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#ES-16'
from _ck_es em join _ck_we wm on wm.code='WE-04'
where em.code='ES-16';

insert into public.evidence_stories(
 id,workspace_id,work_experience_id,project_id,title,situation,actions_taken,outcome,quantitative_impact,
 professional_translation,evidence_type,validation_status,confidence_level,source_type,source_reference)
select em.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,wm.id,(select id from _ck_pr where code='PR-11'),'Redesign Lead Routing Around Performance','Shared lead-pool behavior created hoarding and uneven access.','Partnered with BI, introduced performance-based routing by lead grade and built an elite-team model.','Created a more deliberate routing model tied to lead and rep performance.',null,
'Lead distribution strategy; revenue operations; sales-process design; change management.','direct','confirmed','high',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#ES-17'
from _ck_es em join _ck_we wm on wm.code='WE-04'
where em.code='ES-17';

insert into public.evidence_stories(
 id,workspace_id,work_experience_id,project_id,title,situation,actions_taken,outcome,quantitative_impact,
 professional_translation,evidence_type,validation_status,confidence_level,source_type,source_reference)
select em.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,wm.id,(select id from _ck_pr where code='PR-11'),'Grow Average Monthly Funding $4.5M → $9M','Revenue growth was constrained by lead allocation, not simply rep effort.','Redesigned routing and performance management while maintaining the same lead volume.','Approximately doubled average monthly funding with fewer reps.','Average monthly funding ~$4.5M → ~$9M.',
'Revenue operations; sales leadership; conversion optimization; operational efficiency.','direct','confirmed','high',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#ES-18'
from _ck_es em join _ck_we wm on wm.code='WE-04'
where em.code='ES-18';

insert into public.evidence_stories(
 id,workspace_id,work_experience_id,project_id,title,situation,actions_taken,outcome,quantitative_impact,
 professional_translation,evidence_type,validation_status,confidence_level,source_type,source_reference)
select em.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,wm.id,(select id from _ck_pr where code='PR-11'),'Connect Sales Performance Back to Marketing','Lead acquisition decisions needed downstream performance feedback.','Used funnel/funding performance to close the loop with marketing on which leads should be purchased.','Improved alignment between acquisition and sales outcomes.','Marketing expense -6%; submissions 1,800 → 2,300/month in broader optimization period.',
'Marketing alignment; revenue operations; performance analytics.','direct','confirmed','high',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#ES-19'
from _ck_es em join _ck_we wm on wm.code='WE-04'
where em.code='ES-19';

insert into public.evidence_stories(
 id,workspace_id,work_experience_id,project_id,title,situation,actions_taken,outcome,quantitative_impact,
 professional_translation,evidence_type,validation_status,confidence_level,source_type,source_reference)
select em.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,wm.id,(select id from _ck_pr where code='PR-12'),'Deploy Live Sales Leaderboards','Sales performance needed more immediate visibility.','Deployed Spinify leaderboards on sales-floor displays.','Improved visibility and execution.','17% productivity improvement associated with Spinify.',
'Sales enablement; performance management; change adoption.','direct','confirmed','high',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#ES-20'
from _ck_es em join _ck_we wm on wm.code='WE-04'
where em.code='ES-20';

insert into public.evidence_stories(
 id,workspace_id,work_experience_id,project_id,title,situation,actions_taken,outcome,quantitative_impact,
 professional_translation,evidence_type,validation_status,confidence_level,source_type,source_reference)
select em.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,wm.id,(select id from _ck_pr where code='PR-13'),'Migrate a 150-Person / 60-Line Phone System','The revenue organization needed a large phone migration without disrupting sales.','Coordinated migration and rollout.','Completed the migration smoothly.','~150 users / ~60 lines.',
'Implementation management; UAT; change management; continuity.','direct','confirmed','high',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#ES-21'
from _ck_es em join _ck_we wm on wm.code='WE-04'
where em.code='ES-21';

insert into public.evidence_stories(
 id,workspace_id,work_experience_id,project_id,title,situation,actions_taken,outcome,quantitative_impact,
 professional_translation,evidence_type,validation_status,confidence_level,source_type,source_reference)
select em.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,wm.id,(select id from _ck_pr where code='PR-14'),'Redesign the Internal Vehicle-Service Flow','Vehicle service moved through appointments, intake, RO, shop, parts, wash and delivery with avoidable friction.','Redesigned the internal flow and handoffs.','More predictable and faster service flow.','Service turnaround -20%.',
'Process mapping; workflow design; service operations; process improvement.','direct','confirmed','high',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#ES-22'
from _ck_es em join _ck_we wm on wm.code='WE-05'
where em.code='ES-22';

insert into public.evidence_stories(
 id,workspace_id,work_experience_id,project_id,title,situation,actions_taken,outcome,quantitative_impact,
 professional_translation,evidence_type,validation_status,confidence_level,source_type,source_reference)
select em.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,wm.id,(select id from _ck_pr where code='PR-15'),'Redesign the Client Experience','The Maserati client experience needed to match premium-service expectations.','Redesigned appointments, loaner access, communication and delivery experience.','Improved satisfaction, ratings and repeat business.','CSAT 96%; ratings 3.0 → 4.6; repeat business +25%.',
'Customer experience design; service design; customer retention; luxury client management.','direct','confirmed','high',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#ES-23'
from _ck_es em join _ck_we wm on wm.code='WE-05'
where em.code='ES-23';

insert into public.evidence_stories(
 id,workspace_id,work_experience_id,project_id,title,situation,actions_taken,outcome,quantitative_impact,
 professional_translation,evidence_type,validation_status,confidence_level,source_type,source_reference)
select em.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,wm.id,(select id from _ck_pr where code='PR-15'),'Translate Expensive Technical Work Into a Confident Decision','Customers had to make expensive decisions based on complex technical diagnoses.','Explained diagnosis, cost, timing and tradeoffs in plain language.','Improved trust and decision quality in high-stakes service conversations.',null,
'Consultative selling; technical translation; discovery; objection handling; decision support.','direct','confirmed','high',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#ES-24'
from _ck_es em join _ck_we wm on wm.code='WE-05'
where em.code='ES-24';

insert into public.evidence_stories(
 id,workspace_id,work_experience_id,project_id,title,situation,actions_taken,outcome,quantitative_impact,
 professional_translation,evidence_type,validation_status,confidence_level,source_type,source_reference)
select em.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,wm.id,null,'Turn Around the Maserati Business Line','The Maserati service line was underperforming.','Combined operational redesign, client-experience redesign and performance management.','Turned the service line into the dealership''s top performer.','Gross profit +40%+; CSAT 96%; ratings 3.0 → 4.6; repeat business +25%; service revenue +15% YoY; retention improvements added 35% gross profit.',
'Operational turnaround; customer experience; revenue growth; leadership.','direct','confirmed','high',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#ES-25'
from _ck_es em join _ck_we wm on wm.code='WE-05'
where em.code='ES-25';

insert into public.evidence_stories(
 id,workspace_id,work_experience_id,project_id,title,situation,actions_taken,outcome,quantitative_impact,
 professional_translation,evidence_type,validation_status,confidence_level,source_type,source_reference)
select em.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,wm.id,(select id from _ck_pr where code='PR-16'),'Turn Underperformers Into Producers','Some sales reps needed individualized coaching rather than a single script.','Used individualized coaching and a color-coded performance system.','Moved underperformers toward productive performance.',null,
'Sales coaching; performance management; team development; adaptive leadership.','direct','confirmed','high',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#ES-26'
from _ck_es em join _ck_we wm on wm.code='WE-06'
where em.code='ES-26';

insert into public.evidence_stories(
 id,workspace_id,work_experience_id,project_id,title,situation,actions_taken,outcome,quantitative_impact,
 professional_translation,evidence_type,validation_status,confidence_level,source_type,source_reference)
select em.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,wm.id,(select id from _ck_pr where code='PR-16'),'Raise Conversion 18% → 25%','Team conversion performance had room to improve.','Coached reps, managed performance and standardized/supportively personalized execution.','Reached a company-record conversion rate and materially increased revenue.','Lead-to-close 18% → 25%; ~$2.2M additional revenue.',
'Conversion optimization; sales leadership; performance analytics.','direct','confirmed','high',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#ES-27'
from _ck_es em join _ck_we wm on wm.code='WE-06'
where em.code='ES-27';

insert into public.evidence_stories(
 id,workspace_id,work_experience_id,project_id,title,situation,actions_taken,outcome,quantitative_impact,
 professional_translation,evidence_type,validation_status,confidence_level,source_type,source_reference)
select em.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,wm.id,(select id from _ck_pr where code='PR-17'),'Build Personalized Sales Playbooks','Reps needed reusable objection handling without being forced into one rigid style.','Built a OneNote library of scripts, objections and rebuttals and tailored versions to individual reps.','Created reusable enablement while preserving individual selling strengths.',null,
'Sales enablement; knowledge management; objection handling; playbook development; adaptive coaching.','direct','confirmed','high',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#ES-28'
from _ck_es em join _ck_we wm on wm.code='WE-06'
where em.code='ES-28';

insert into public.evidence_stories(
 id,workspace_id,work_experience_id,project_id,title,situation,actions_taken,outcome,quantitative_impact,
 professional_translation,evidence_type,validation_status,confidence_level,source_type,source_reference)
select em.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,wm.id,null,'Diagnose the Customer''s Real Problem','Customers often arrived with a symptom or incomplete description.','Interviewed customers to understand the actual service need before making recommendations.','Produced clearer problem definition for technician/customer coordination.',null,
'Customer discovery; active listening; problem diagnosis; consultative selling.','direct','confirmed','high',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#ES-29'
from _ck_es em join _ck_we wm on wm.code='WE-07'
where em.code='ES-29';

insert into public.evidence_stories(
 id,workspace_id,work_experience_id,project_id,title,situation,actions_taken,outcome,quantitative_impact,
 professional_translation,evidence_type,validation_status,confidence_level,source_type,source_reference)
select em.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,wm.id,null,'Translate Technician Diagnosis Into Customer Options','Customers needed to understand technical diagnoses well enough to decide.','Translated technician findings into clear options and recommendations.','Helped customers make informed service decisions.',null,
'Technical translation; customer education; consultative selling; decision support.','direct','confirmed','high',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#ES-30'
from _ck_es em join _ck_we wm on wm.code='WE-07'
where em.code='ES-30';

insert into public.evidence_stories(
 id,workspace_id,work_experience_id,project_id,title,situation,actions_taken,outcome,quantitative_impact,
 professional_translation,evidence_type,validation_status,confidence_level,source_type,source_reference)
select em.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,wm.id,null,'Own the Customer From Write-Up Through Delivery','High-volume service required continuity across multiple handoffs.','Maintained ownership across intake, recommendation, status communication, coordination and delivery.','Created end-to-end accountability and proactive communication.',null,
'Relationship management; end-to-end ownership; high-volume operations; cross-functional coordination.','direct','confirmed','high',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#ES-31'
from _ck_es em join _ck_we wm on wm.code='WE-07'
where em.code='ES-31';

insert into public.evidence_stories(
 id,workspace_id,work_experience_id,project_id,title,situation,actions_taken,outcome,quantitative_impact,
 professional_translation,evidence_type,validation_status,confidence_level,source_type,source_reference)
select em.id,'9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,wm.id,null,'Maintain High Satisfaction in a High-Volume Luxury Operation','The service drive operated at high daily volume while maintaining premium expectations.','Prioritized multiple customers and coordinated across a large advisor/technician environment.','Maintained strong customer satisfaction at scale.','200+ vehicles/day; ~24 advisors; 80+ technicians; 96.3 CSAT average.',
'Prioritization; high-volume operations; customer experience.','direct','confirmed','high',
'approved import manifest','docs/04-data/candidate-knowledge-import-manifest-2026-09-24.md#ES-32'
from _ck_es em join _ck_we wm on wm.code='WE-07'
where em.code='ES-32';

insert into public.project_skills(workspace_id,project_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,s.id,'strong','confirmed'
from _ck_pr pm
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Business Systems Architecture','Requirements Discovery','Process Mapping','Workflow Design','Data Modeling','Access-Control Design','Systems Integration','AI Enablement','Change Management','User Adoption & Training','Stakeholder Management','Solution Design']::text[])
where pm.code='PR-01';

insert into public.project_skills(workspace_id,project_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,s.id,'strong','confirmed'
from _ck_pr pm
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['AI Enablement','Workflow Automation','Change Management','User Adoption & Training','Knowledge Management','Process Improvement','Technical Translation','Stakeholder Management','AI Workflow Design','Operational Resilience']::text[])
where pm.code='PR-02';

insert into public.project_skills(workspace_id,project_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,s.id,'strong','candidate_review_needed'
from _ck_pr pm
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Systems Integration','AI Enablement','Access-Control Design','API Integration','Security-Conscious Architecture','Workflow Automation']::text[])
where pm.code='PR-03';

insert into public.project_skills(workspace_id,project_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,s.id,'strong','confirmed'
from _ck_pr pm
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Requirements Discovery','CRM Strategy','Salesforce Administration','Process Mapping','Systems Integration','UAT','Change Management','User Adoption & Training','Cross-Functional Leadership']::text[])
where pm.code='PR-04';

insert into public.project_skills(workspace_id,project_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,s.id,'strong','confirmed'
from _ck_pr pm
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Salesforce Administration','Workflow Design','Workflow Automation','Business Systems Architecture','Process Improvement','Business Logic Design']::text[])
where pm.code='PR-05';

insert into public.project_skills(workspace_id,project_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,s.id,'strong','confirmed'
from _ck_pr pm
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Workflow Automation','Process Improvement','Systems Integration','Underwriting Operations','Data Integration','AI Enablement','Operational Efficiency']::text[])
where pm.code='PR-06';

insert into public.project_skills(workspace_id,project_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,s.id,'strong','confirmed'
from _ck_pr pm
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Vendor Management','UAT','Systems Ownership','Cross-Functional Coordination','Troubleshooting','Change Management','Operational Leadership']::text[])
where pm.code='PR-07';

insert into public.project_skills(workspace_id,project_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,s.id,'strong','confirmed'
from _ck_pr pm
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Zero-to-One Operations','Operational Launch','Sales Operations','Hiring','Budget Management','Vendor Management','Team Leadership','Cross-Functional Operations']::text[])
where pm.code='PR-08';

insert into public.project_skills(workspace_id,project_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,s.id,'strong','confirmed'
from _ck_pr pm
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Performance Analytics','Sales Operations','Dashboard/Reporting Design','Process Standardization','Workflow Automation','Performance Management']::text[])
where pm.code='PR-09';

insert into public.project_skills(workspace_id,project_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,s.id,'strong','confirmed'
from _ck_pr pm
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Salesforce Reporting','Performance Analytics','Root-Cause Analysis','Revenue Operations','Data-Driven Decision Making']::text[])
where pm.code='PR-10';

insert into public.project_skills(workspace_id,project_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,s.id,'strong','confirmed'
from _ck_pr pm
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Revenue Operations','Lead Distribution Strategy','Sales Process Design','Root-Cause Analysis','Change Management','Sales Leadership','Marketing Alignment','Conversion Optimization']::text[])
where pm.code='PR-11';

insert into public.project_skills(workspace_id,project_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,s.id,'strong','confirmed'
from _ck_pr pm
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Sales Enablement','Performance Management','Change Adoption','Performance Analytics']::text[])
where pm.code='PR-12';

insert into public.project_skills(workspace_id,project_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,s.id,'strong','confirmed'
from _ck_pr pm
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Implementation Management','Change Management','Cross-Functional Coordination','UAT','Operational Resilience']::text[])
where pm.code='PR-13';

insert into public.project_skills(workspace_id,project_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,s.id,'strong','confirmed'
from _ck_pr pm
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Process Mapping','Workflow Design','Process Improvement','Cross-Functional Coordination','Operational Turnaround']::text[])
where pm.code='PR-14';

insert into public.project_skills(workspace_id,project_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,s.id,'strong','confirmed'
from _ck_pr pm
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Customer Experience Design','Consultative Selling','Technical Translation','Customer Discovery','Customer Retention','Luxury Client Management','Objection Handling','Service Design']::text[])
where pm.code='PR-15';

insert into public.project_skills(workspace_id,project_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,s.id,'strong','confirmed'
from _ck_pr pm
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Sales Leadership','Sales Coaching','Performance Management','Conversion Optimization','Team Development','Data-Driven Decision Making','Adaptive Leadership']::text[])
where pm.code='PR-16';

insert into public.project_skills(workspace_id,project_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,s.id,'strong','confirmed'
from _ck_pr pm
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Sales Enablement','Knowledge Management','Objection Handling','Playbook Development','Adaptive Coaching','Consultative Selling']::text[])
where pm.code='PR-17';

insert into public.evidence_story_skills(workspace_id,evidence_story_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,s.id,'direct','confirmed'
from _ck_es em
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Requirements Discovery','Process Mapping','Stakeholder Management','Business Systems Architecture']::text[])
where em.code='ES-01';

insert into public.evidence_story_skills(workspace_id,evidence_story_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,s.id,'direct','confirmed'
from _ck_es em
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Rapid Learning','Business Systems Architecture','Solution Design','Data Modeling','Workflow Design']::text[])
where em.code='ES-02';

insert into public.evidence_story_skills(workspace_id,evidence_story_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,s.id,'direct','confirmed'
from _ck_es em
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Access-Control Design','Security-Conscious Architecture','Data Modeling']::text[])
where em.code='ES-03';

insert into public.evidence_story_skills(workspace_id,evidence_story_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,s.id,'direct','confirmed'
from _ck_es em
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['AI Enablement','User Adoption & Training','Change Management','Technical Translation']::text[])
where em.code='ES-04';

insert into public.evidence_story_skills(workspace_id,evidence_story_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,s.id,'direct','confirmed'
from _ck_es em
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Knowledge Management','Operational Resilience','Workflow Design','AI Enablement']::text[])
where em.code='ES-05';

insert into public.evidence_story_skills(workspace_id,evidence_story_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,s.id,'direct','candidate_review_needed'
from _ck_es em
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Systems Integration','API Integration','Access-Control Design','AI Enablement']::text[])
where em.code='ES-06';

insert into public.evidence_story_skills(workspace_id,evidence_story_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,s.id,'direct','confirmed'
from _ck_es em
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Requirements Discovery','Process Mapping','Cross-Functional Leadership','CRM Strategy']::text[])
where em.code='ES-07';

insert into public.evidence_story_skills(workspace_id,evidence_story_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,s.id,'direct','confirmed'
from _ck_es em
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Salesforce Administration','Workflow Automation','Business Logic Design','Business Systems Architecture']::text[])
where em.code='ES-08';

insert into public.evidence_story_skills(workspace_id,evidence_story_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,s.id,'direct','confirmed'
from _ck_es em
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Workflow Design','User-Centered Systems Design','User Adoption & Training','Process Improvement']::text[])
where em.code='ES-09';

insert into public.evidence_story_skills(workspace_id,evidence_story_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,s.id,'direct','confirmed'
from _ck_es em
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Workflow Automation','Data Integration','Underwriting Operations','Process Improvement']::text[])
where em.code='ES-10';

insert into public.evidence_story_skills(workspace_id,evidence_story_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,s.id,'direct','confirmed'
from _ck_es em
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Process Improvement','Operational Efficiency','Workflow Automation']::text[])
where em.code='ES-11';

insert into public.evidence_story_skills(workspace_id,evidence_story_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,s.id,'direct','confirmed'
from _ck_es em
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Systems Ownership','Vendor Management','Troubleshooting','UAT','Operational Leadership']::text[])
where em.code='ES-12';

insert into public.evidence_story_skills(workspace_id,evidence_story_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,s.id,'direct','confirmed'
from _ck_es em
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Zero-to-One Operations','Operational Launch','Hiring','Budget Management','Vendor Management','Team Leadership']::text[])
where em.code='ES-13';

insert into public.evidence_story_skills(workspace_id,evidence_story_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,s.id,'direct','confirmed'
from _ck_es em
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Sales Operations','Team Performance','Revenue Growth']::text[])
where em.code='ES-14';

insert into public.evidence_story_skills(workspace_id,evidence_story_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,s.id,'direct','confirmed'
from _ck_es em
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Process Standardization','Performance Analytics','Workflow Automation','Sales Operations']::text[])
where em.code='ES-15';

insert into public.evidence_story_skills(workspace_id,evidence_story_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,s.id,'direct','confirmed'
from _ck_es em
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Root-Cause Analysis','Salesforce Reporting','Performance Analytics','Data-Driven Decision Making']::text[])
where em.code='ES-16';

insert into public.evidence_story_skills(workspace_id,evidence_story_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,s.id,'direct','confirmed'
from _ck_es em
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Lead Distribution Strategy','Revenue Operations','Sales Process Design','Change Management']::text[])
where em.code='ES-17';

insert into public.evidence_story_skills(workspace_id,evidence_story_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,s.id,'direct','confirmed'
from _ck_es em
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Revenue Operations','Sales Leadership','Conversion Optimization','Operational Efficiency']::text[])
where em.code='ES-18';

insert into public.evidence_story_skills(workspace_id,evidence_story_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,s.id,'direct','confirmed'
from _ck_es em
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Marketing Alignment','Revenue Operations','Performance Analytics','Cross-Functional Leadership']::text[])
where em.code='ES-19';

insert into public.evidence_story_skills(workspace_id,evidence_story_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,s.id,'direct','confirmed'
from _ck_es em
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Sales Enablement','Performance Management','Change Adoption']::text[])
where em.code='ES-20';

insert into public.evidence_story_skills(workspace_id,evidence_story_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,s.id,'direct','confirmed'
from _ck_es em
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Implementation Management','UAT','Change Management','Operational Resilience']::text[])
where em.code='ES-21';

insert into public.evidence_story_skills(workspace_id,evidence_story_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,s.id,'direct','confirmed'
from _ck_es em
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Process Mapping','Workflow Design','Process Improvement','Cross-Functional Coordination']::text[])
where em.code='ES-22';

insert into public.evidence_story_skills(workspace_id,evidence_story_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,s.id,'direct','confirmed'
from _ck_es em
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Customer Experience Design','Service Design','Customer Retention','Luxury Client Management']::text[])
where em.code='ES-23';

insert into public.evidence_story_skills(workspace_id,evidence_story_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,s.id,'direct','confirmed'
from _ck_es em
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Consultative Selling','Technical Translation','Customer Discovery','Objection Handling','Decision Support']::text[])
where em.code='ES-24';

insert into public.evidence_story_skills(workspace_id,evidence_story_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,s.id,'direct','confirmed'
from _ck_es em
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Operational Turnaround','Customer Experience','Revenue Growth','Team Leadership']::text[])
where em.code='ES-25';

insert into public.evidence_story_skills(workspace_id,evidence_story_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,s.id,'direct','confirmed'
from _ck_es em
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Sales Coaching','Performance Management','Team Development','Adaptive Leadership']::text[])
where em.code='ES-26';

insert into public.evidence_story_skills(workspace_id,evidence_story_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,s.id,'direct','confirmed'
from _ck_es em
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Conversion Optimization','Sales Leadership','Performance Analytics']::text[])
where em.code='ES-27';

insert into public.evidence_story_skills(workspace_id,evidence_story_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,s.id,'direct','confirmed'
from _ck_es em
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Sales Enablement','Knowledge Management','Objection Handling','Playbook Development','Adaptive Coaching']::text[])
where em.code='ES-28';

insert into public.evidence_story_skills(workspace_id,evidence_story_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,s.id,'direct','confirmed'
from _ck_es em
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Customer Discovery','Active Listening','Problem Diagnosis','Consultative Selling']::text[])
where em.code='ES-29';

insert into public.evidence_story_skills(workspace_id,evidence_story_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,s.id,'direct','confirmed'
from _ck_es em
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Technical Translation','Customer Education','Consultative Selling','Decision Support']::text[])
where em.code='ES-30';

insert into public.evidence_story_skills(workspace_id,evidence_story_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,s.id,'direct','confirmed'
from _ck_es em
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Relationship Management','End-to-End Ownership','High-Volume Operations','Cross-Functional Coordination']::text[])
where em.code='ES-31';

insert into public.evidence_story_skills(workspace_id,evidence_story_id,skill_id,evidence_strength,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,s.id,'direct','confirmed'
from _ck_es em
join public.skills s on s.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and s.name=any(array['Prioritization','High-Volume Operations','Customer Experience']::text[])
where em.code='ES-32';

insert into public.project_tools(workspace_id,project_id,tool_id,usage_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,t.id,'Explicitly supported by approved import manifest','confirmed'
from _ck_pr pm
join public.tools t on t.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and t.name=any(array['React','TypeScript','PostgreSQL','Supabase','SharePoint']::text[])
where pm.code='PR-01';

insert into public.project_tools(workspace_id,project_id,tool_id,usage_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,t.id,'Explicitly supported by approved import manifest','confirmed'
from _ck_pr pm
join public.tools t on t.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and t.name=any(array['ChatGPT / OpenAI','Claude','Claude Skills','Outlook','SharePoint','Read.ai']::text[])
where pm.code='PR-02';

insert into public.project_tools(workspace_id,project_id,tool_id,usage_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,t.id,'Explicitly supported by approved import manifest','candidate_review_needed'
from _ck_pr pm
join public.tools t on t.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and t.name=any(array['Claude','MCP','SharePoint','REST APIs','token-forwarded authentication']::text[])
where pm.code='PR-03';

insert into public.project_tools(workspace_id,project_id,tool_id,usage_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,t.id,'Explicitly supported by approved import manifest','confirmed'
from _ck_pr pm
join public.tools t on t.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and t.name=any(array['Zoho','Salesforce']::text[])
where pm.code='PR-04';

insert into public.project_tools(workspace_id,project_id,tool_id,usage_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,t.id,'Explicitly supported by approved import manifest','confirmed'
from _ck_pr pm
join public.tools t on t.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and t.name=any(array['Salesforce','Salesforce Flow Builder','DocuSign']::text[])
where pm.code='PR-05';

insert into public.project_tools(workspace_id,project_id,tool_id,usage_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,t.id,'Explicitly supported by approved import manifest','confirmed'
from _ck_pr pm
join public.tools t on t.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and t.name=any(array['Salesforce','Azure AI Builder','OCR pipelines','Heron Data','Experian','CLEAR']::text[])
where pm.code='PR-06';

insert into public.project_tools(workspace_id,project_id,tool_id,usage_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,t.id,'Explicitly supported by approved import manifest','confirmed'
from _ck_pr pm
join public.tools t on t.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and t.name=any(array['AWS S3','Salesforce','Zoho','DocuSign']::text[])
where pm.code='PR-07';

insert into public.project_tools(workspace_id,project_id,tool_id,usage_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,t.id,'Explicitly supported by approved import manifest','confirmed'
from _ck_pr pm
join public.tools t on t.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and t.name=any(array['Salesforce']::text[])
where pm.code='PR-10';

insert into public.project_tools(workspace_id,project_id,tool_id,usage_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,t.id,'Explicitly supported by approved import manifest','confirmed'
from _ck_pr pm
join public.tools t on t.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and t.name=any(array['Salesforce','Distribution Engine']::text[])
where pm.code='PR-11';

insert into public.project_tools(workspace_id,project_id,tool_id,usage_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,t.id,'Explicitly supported by approved import manifest','confirmed'
from _ck_pr pm
join public.tools t on t.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and t.name=any(array['Spinify']::text[])
where pm.code='PR-12';

insert into public.project_tools(workspace_id,project_id,tool_id,usage_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,pm.id,t.id,'Explicitly supported by approved import manifest','confirmed'
from _ck_pr pm
join public.tools t on t.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and t.name=any(array['Microsoft OneNote']::text[])
where pm.code='PR-17';

insert into public.evidence_story_tools(workspace_id,evidence_story_id,tool_id,usage_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,t.id,'Explicitly supported by approved import manifest','confirmed'
from _ck_es em
join public.tools t on t.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and t.name=any(array['Supabase','PostgreSQL']::text[])
where em.code='ES-03';

insert into public.evidence_story_tools(workspace_id,evidence_story_id,tool_id,usage_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,t.id,'Explicitly supported by approved import manifest','confirmed'
from _ck_es em
join public.tools t on t.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and t.name=any(array['ChatGPT / OpenAI','Claude','Claude Skills']::text[])
where em.code='ES-04';

insert into public.evidence_story_tools(workspace_id,evidence_story_id,tool_id,usage_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,t.id,'Explicitly supported by approved import manifest','confirmed'
from _ck_es em
join public.tools t on t.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and t.name=any(array['Claude','SharePoint','Outlook','Read.ai']::text[])
where em.code='ES-05';

insert into public.evidence_story_tools(workspace_id,evidence_story_id,tool_id,usage_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,t.id,'Explicitly supported by approved import manifest','candidate_review_needed'
from _ck_es em
join public.tools t on t.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and t.name=any(array['Claude','MCP','SharePoint','REST APIs','token-forwarded authentication']::text[])
where em.code='ES-06';

insert into public.evidence_story_tools(workspace_id,evidence_story_id,tool_id,usage_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,t.id,'Explicitly supported by approved import manifest','confirmed'
from _ck_es em
join public.tools t on t.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and t.name=any(array['Salesforce','Salesforce Flow Builder','DocuSign']::text[])
where em.code='ES-08';

insert into public.evidence_story_tools(workspace_id,evidence_story_id,tool_id,usage_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,t.id,'Explicitly supported by approved import manifest','confirmed'
from _ck_es em
join public.tools t on t.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and t.name=any(array['Zoho','Salesforce']::text[])
where em.code='ES-09';

insert into public.evidence_story_tools(workspace_id,evidence_story_id,tool_id,usage_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,t.id,'Explicitly supported by approved import manifest','confirmed'
from _ck_es em
join public.tools t on t.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and t.name=any(array['Salesforce','Azure AI Builder','OCR pipelines','Heron Data','Experian','CLEAR']::text[])
where em.code='ES-10';

insert into public.evidence_story_tools(workspace_id,evidence_story_id,tool_id,usage_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,t.id,'Explicitly supported by approved import manifest','confirmed'
from _ck_es em
join public.tools t on t.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and t.name=any(array['Salesforce']::text[])
where em.code='ES-16';

insert into public.evidence_story_tools(workspace_id,evidence_story_id,tool_id,usage_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,t.id,'Explicitly supported by approved import manifest','confirmed'
from _ck_es em
join public.tools t on t.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and t.name=any(array['Salesforce','Distribution Engine']::text[])
where em.code='ES-17';

insert into public.evidence_story_tools(workspace_id,evidence_story_id,tool_id,usage_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,t.id,'Explicitly supported by approved import manifest','confirmed'
from _ck_es em
join public.tools t on t.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and t.name=any(array['Spinify']::text[])
where em.code='ES-20';

insert into public.evidence_story_tools(workspace_id,evidence_story_id,tool_id,usage_context,validation_status)
select '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,em.id,t.id,'Explicitly supported by approved import manifest','confirmed'
from _ck_es em
join public.tools t on t.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid and t.name=any(array['Microsoft OneNote']::text[])
where em.code='ES-28';

-- Assertions
do $assert$
declare
 v_workspace uuid := '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid;
 v_n integer;
begin
 select count(*) into v_n from public.work_experiences where workspace_id=v_workspace;
 if v_n<>7 then raise exception 'Expected 7 work experiences, found %',v_n; end if;
 select count(*) into v_n from public.projects where workspace_id=v_workspace;
 if v_n<>17 then raise exception 'Expected 17 projects, found %',v_n; end if;
 select count(*) into v_n from public.evidence_stories where workspace_id=v_workspace;
 if v_n<>32 then raise exception 'Expected 32 evidence stories, found %',v_n; end if;
 select count(*) into v_n from public.skills where workspace_id=v_workspace;
 if v_n<>84 then raise exception 'Expected 84 skills, found %',v_n; end if;
 select count(*) into v_n from public.tools where workspace_id=v_workspace;
 if v_n<>34 then raise exception 'Expected 34 tools, found %',v_n; end if;

 if not exists (
   select 1 from public.projects
   where workspace_id=v_workspace and name='Secure SharePoint-to-Claude MCP Connector'
     and validation_status='candidate_review_needed'
 ) then raise exception 'Expected MCP connector project to remain candidate_review_needed'; end if;
end
$assert$;

commit;

-- Expected base counts after successful import:
-- work_experiences=7
-- projects=17
-- evidence_stories=32
-- skills=84
-- tools=34
--
-- Month-only source dates use the first day of the month as an internal placeholder.
-- Candidate-facing outputs must display month/year unless day precision is actually known.
