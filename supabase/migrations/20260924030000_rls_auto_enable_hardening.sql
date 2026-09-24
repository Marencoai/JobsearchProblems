-- ============================================================
-- Job Search AI Agent
-- Migration 019: RLS Auto-Enable Function Hardening
-- ============================================================
--
-- Supabase's security advisor identified public.rls_auto_enable()
-- as a SECURITY DEFINER function callable by API roles.
--
-- The function is used by the ensure_rls event trigger and does
-- not need to be called directly by anonymous or authenticated
-- application users.
--
-- Keep the event-trigger behavior while removing direct RPC
-- execution from exposed roles.
-- ============================================================

revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;

-- ============================================================
-- MIGRATION 019 COMPLETE
-- ============================================================
