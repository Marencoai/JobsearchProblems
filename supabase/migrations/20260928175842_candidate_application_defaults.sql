alter table public.candidate_settings
add column application_defaults jsonb not null default '{}'::jsonb;

alter table public.candidate_settings
add constraint candidate_settings_application_defaults_object
check (jsonb_typeof(application_defaults) = 'object');

update public.candidate_settings
set
  application_defaults = jsonb_build_object(
    'schema_version', 1,
    'contact', jsonb_build_object(
      'full_name', 'Diana Marenco',
      'location', 'San Diego, CA',
      'phone', '817-705-8129',
      'email', 'diana@marencoai.com',
      'linkedin', 'linkedin.com/in/marencoai',
      'validation_status', 'confirmed'
    ),
    'work_authorization', jsonb_build_object(
      'value', null,
      'validation_status', 'candidate_review_needed'
    ),
    'sponsorship_required', jsonb_build_object(
      'value', null,
      'validation_status', 'candidate_review_needed'
    ),
    'start_availability', jsonb_build_object(
      'value', null,
      'validation_status', 'candidate_review_needed'
    ),
    'travel', jsonb_build_object(
      'answer_source', 'travel_preferences',
      'rule', 'derive_from_existing_preferences'
    ),
    'relocation', jsonb_build_object(
      'answer_source', 'location_preferences',
      'rule', 'derive_from_existing_preferences'
    )
  ),
  updated_by_principal_id = '5d469573-deae-4500-bacb-4bbecffad83b',
  updated_at = now()
where workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68';
