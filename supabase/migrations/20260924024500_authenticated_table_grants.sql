-- ============================================================
-- Job Search AI Agent
-- Migration 018: Authenticated Table Grants
-- ============================================================
--
-- RLS policies answer:
--
--   "Which rows may this Principal access?"
--
-- PostgreSQL table privileges answer:
--
--   "May the authenticated role attempt this operation at all?"
--
-- Both layers are required.
--
-- This migration derives the authenticated table privileges from
-- the operations that have explicit RLS policies in migrations
-- 001–017.
--
-- No direct table privileges are granted to anon.
--
-- service_role / database-owner privileges are not modified.
--
-- ============================================================


-- ============================================================
-- 1. PRECISE TABLE PRIVILEGES
-- ============================================================

-- activity_event_links
revoke all on table public.activity_event_links from anon;
revoke all on table public.activity_event_links from authenticated;
grant SELECT, INSERT on table public.activity_event_links to authenticated;

-- activity_events
revoke all on table public.activity_events from anon;
revoke all on table public.activity_events from authenticated;
grant SELECT, INSERT on table public.activity_events to authenticated;

-- activity_replies
revoke all on table public.activity_replies from anon;
revoke all on table public.activity_replies from authenticated;
grant SELECT, INSERT, UPDATE on table public.activity_replies to authenticated;

-- application_gaps
revoke all on table public.application_gaps from anon;
revoke all on table public.application_gaps from authenticated;
grant SELECT, INSERT, UPDATE on table public.application_gaps to authenticated;

-- application_material_evidence
revoke all on table public.application_material_evidence from anon;
revoke all on table public.application_material_evidence from authenticated;
grant SELECT, INSERT, DELETE on table public.application_material_evidence to authenticated;

-- application_materials
revoke all on table public.application_materials from anon;
revoke all on table public.application_materials from authenticated;
grant SELECT, INSERT, UPDATE on table public.application_materials to authenticated;

-- application_packages
revoke all on table public.application_packages from anon;
revoke all on table public.application_packages from authenticated;
grant SELECT, INSERT, UPDATE on table public.application_packages to authenticated;

-- application_submitted_materials
revoke all on table public.application_submitted_materials from anon;
revoke all on table public.application_submitted_materials from authenticated;
grant SELECT on table public.application_submitted_materials to authenticated;

-- application_templates
revoke all on table public.application_templates from anon;
revoke all on table public.application_templates from authenticated;
grant SELECT, INSERT, UPDATE on table public.application_templates to authenticated;

-- applications
revoke all on table public.applications from anon;
revoke all on table public.applications from authenticated;
grant SELECT, INSERT, UPDATE on table public.applications to authenticated;

-- automation_policies
revoke all on table public.automation_policies from anon;
revoke all on table public.automation_policies from authenticated;
grant SELECT, INSERT, UPDATE on table public.automation_policies to authenticated;

-- candidate_settings
revoke all on table public.candidate_settings from anon;
revoke all on table public.candidate_settings from authenticated;
grant SELECT, INSERT, UPDATE on table public.candidate_settings to authenticated;

-- companies
revoke all on table public.companies from anon;
revoke all on table public.companies from authenticated;
grant SELECT, INSERT, UPDATE on table public.companies to authenticated;

-- company_intelligence
revoke all on table public.company_intelligence from anon;
revoke all on table public.company_intelligence from authenticated;
grant SELECT, INSERT, UPDATE on table public.company_intelligence to authenticated;

-- daily_plan_items
revoke all on table public.daily_plan_items from anon;
revoke all on table public.daily_plan_items from authenticated;
grant SELECT, INSERT, UPDATE, DELETE on table public.daily_plan_items to authenticated;

-- daily_plans
revoke all on table public.daily_plans from anon;
revoke all on table public.daily_plans from authenticated;
grant SELECT, INSERT, UPDATE on table public.daily_plans to authenticated;

-- evaluation_company_intelligence
revoke all on table public.evaluation_company_intelligence from anon;
revoke all on table public.evaluation_company_intelligence from authenticated;
grant SELECT, INSERT, UPDATE, DELETE on table public.evaluation_company_intelligence to authenticated;

-- evaluation_evidence
revoke all on table public.evaluation_evidence from anon;
revoke all on table public.evaluation_evidence from authenticated;
grant SELECT, INSERT, UPDATE, DELETE on table public.evaluation_evidence to authenticated;

-- evaluations
revoke all on table public.evaluations from anon;
revoke all on table public.evaluations from authenticated;
grant SELECT, INSERT, UPDATE on table public.evaluations to authenticated;

-- evidence_stories
revoke all on table public.evidence_stories from anon;
revoke all on table public.evidence_stories from authenticated;
grant SELECT, INSERT, UPDATE on table public.evidence_stories to authenticated;

-- evidence_story_skills
revoke all on table public.evidence_story_skills from anon;
revoke all on table public.evidence_story_skills from authenticated;
grant SELECT, INSERT, UPDATE, DELETE on table public.evidence_story_skills to authenticated;

-- evidence_story_tools
revoke all on table public.evidence_story_tools from anon;
revoke all on table public.evidence_story_tools from authenticated;
grant SELECT, INSERT, UPDATE, DELETE on table public.evidence_story_tools to authenticated;

-- internal_tasks
revoke all on table public.internal_tasks from anon;
revoke all on table public.internal_tasks from authenticated;
grant SELECT, INSERT, UPDATE on table public.internal_tasks to authenticated;

-- job_families
revoke all on table public.job_families from anon;
revoke all on table public.job_families from authenticated;
grant SELECT, INSERT, UPDATE on table public.job_families to authenticated;

-- next_actions
revoke all on table public.next_actions from anon;
revoke all on table public.next_actions from authenticated;
grant SELECT, INSERT, UPDATE on table public.next_actions to authenticated;

-- opportunities
revoke all on table public.opportunities from anon;
revoke all on table public.opportunities from authenticated;
grant SELECT, INSERT, UPDATE on table public.opportunities to authenticated;

-- opportunity_sources
revoke all on table public.opportunity_sources from anon;
revoke all on table public.opportunity_sources from authenticated;
grant SELECT, INSERT, UPDATE on table public.opportunity_sources to authenticated;

-- permissions
revoke all on table public.permissions from anon;
revoke all on table public.permissions from authenticated;
grant SELECT on table public.permissions to authenticated;

-- principals
revoke all on table public.principals from anon;
revoke all on table public.principals from authenticated;
grant SELECT on table public.principals to authenticated;

-- project_skills
revoke all on table public.project_skills from anon;
revoke all on table public.project_skills from authenticated;
grant SELECT, INSERT, UPDATE, DELETE on table public.project_skills to authenticated;

-- project_tools
revoke all on table public.project_tools from anon;
revoke all on table public.project_tools from authenticated;
grant SELECT, INSERT, UPDATE, DELETE on table public.project_tools to authenticated;

-- project_work_experiences
revoke all on table public.project_work_experiences from anon;
revoke all on table public.project_work_experiences from authenticated;
grant SELECT, INSERT, UPDATE, DELETE on table public.project_work_experiences to authenticated;

-- projects
revoke all on table public.projects from anon;
revoke all on table public.projects from authenticated;
grant SELECT, INSERT, UPDATE on table public.projects to authenticated;

-- role_permissions
revoke all on table public.role_permissions from anon;
revoke all on table public.role_permissions from authenticated;
grant SELECT, INSERT, DELETE on table public.role_permissions to authenticated;

-- roles
revoke all on table public.roles from anon;
revoke all on table public.roles from authenticated;
grant SELECT, INSERT, UPDATE, DELETE on table public.roles to authenticated;

-- skills
revoke all on table public.skills from anon;
revoke all on table public.skills from authenticated;
grant SELECT, INSERT, UPDATE on table public.skills to authenticated;

-- task_attempts
revoke all on table public.task_attempts from anon;
revoke all on table public.task_attempts from authenticated;
grant SELECT, INSERT, UPDATE on table public.task_attempts to authenticated;

-- task_dependencies
revoke all on table public.task_dependencies from anon;
revoke all on table public.task_dependencies from authenticated;
grant SELECT, INSERT, DELETE on table public.task_dependencies to authenticated;

-- tools
revoke all on table public.tools from anon;
revoke all on table public.tools from authenticated;
grant SELECT, INSERT, UPDATE on table public.tools to authenticated;

-- work_blocks
revoke all on table public.work_blocks from anon;
revoke all on table public.work_blocks from authenticated;
grant SELECT, INSERT, UPDATE, DELETE on table public.work_blocks to authenticated;

-- work_experiences
revoke all on table public.work_experiences from anon;
revoke all on table public.work_experiences from authenticated;
grant SELECT, INSERT, UPDATE on table public.work_experiences to authenticated;

-- workspace_memberships
revoke all on table public.workspace_memberships from anon;
revoke all on table public.workspace_memberships from authenticated;
grant SELECT, INSERT, UPDATE, DELETE on table public.workspace_memberships to authenticated;

-- workspaces
revoke all on table public.workspaces from anon;
revoke all on table public.workspaces from authenticated;
grant SELECT, UPDATE on table public.workspaces to authenticated;


-- ============================================================
-- MIGRATION 018 COMPLETE
-- ============================================================
--
-- Every direct authenticated table operation now requires BOTH:
--
--   PostgreSQL table privilege
--        +
--   matching Row Level Security policy
--
-- Operations intentionally absent from RLS are also absent from
-- the authenticated role's table privileges.
--
-- ============================================================
