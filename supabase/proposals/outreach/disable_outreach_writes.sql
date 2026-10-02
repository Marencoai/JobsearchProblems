-- PROPOSED FORWARD DISABLE ONLY; production application is separately gated.
-- Stop the future Outreach worker/UI consumer first. Preserve all history,
-- tables, SELECT policies, queued tasks, actor attribution and permissions.
begin;
revoke execute on function public.hq_outreach_action(uuid,uuid,text,jsonb) from authenticated;
revoke execute on function private.hq_outreach_action(uuid,uuid,text,jsonb) from authenticated;
commit;
