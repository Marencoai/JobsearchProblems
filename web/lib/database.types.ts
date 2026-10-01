export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_event_links: {
        Row: {
          activity_event_id: string
          created_at: string
          created_by_principal_id: string | null
          entity_id: string
          entity_type: string
          id: string
          relationship_type: string | null
          workspace_id: string
        }
        Insert: {
          activity_event_id: string
          created_at?: string
          created_by_principal_id?: string | null
          entity_id: string
          entity_type: string
          id?: string
          relationship_type?: string | null
          workspace_id: string
        }
        Update: {
          activity_event_id?: string
          created_at?: string
          created_by_principal_id?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          relationship_type?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_event_links_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_event_links_event_workspace_fk"
            columns: ["workspace_id", "activity_event_id"]
            isOneToOne: false
            referencedRelation: "activity_events"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "activity_event_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_events: {
        Row: {
          actor_principal_id: string | null
          created_at: string
          created_by_principal_id: string | null
          details: string | null
          event_timestamp: string
          event_type: string
          id: string
          idempotency_key: string | null
          opportunity_id: string | null
          requires_candidate_attention: boolean
          source_reference: string | null
          source_system: string | null
          summary: string
          workspace_id: string
        }
        Insert: {
          actor_principal_id?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          details?: string | null
          event_timestamp?: string
          event_type: string
          id?: string
          idempotency_key?: string | null
          opportunity_id?: string | null
          requires_candidate_attention?: boolean
          source_reference?: string | null
          source_system?: string | null
          summary: string
          workspace_id: string
        }
        Update: {
          actor_principal_id?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          details?: string | null
          event_timestamp?: string
          event_type?: string
          id?: string
          idempotency_key?: string | null
          opportunity_id?: string | null
          requires_candidate_attention?: boolean
          source_reference?: string | null
          source_system?: string | null
          summary?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_actor_principal_id_fkey"
            columns: ["actor_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_opportunity_workspace_fk"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "activity_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_replies: {
        Row: {
          activity_event_id: string
          author_principal_id: string
          content: string
          created_at: string
          id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          activity_event_id: string
          author_principal_id: string
          content: string
          created_at?: string
          id?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          activity_event_id?: string
          author_principal_id?: string
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_replies_author_principal_id_fkey"
            columns: ["author_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_replies_event_workspace_fk"
            columns: ["workspace_id", "activity_event_id"]
            isOneToOne: false
            referencedRelation: "activity_events"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "activity_replies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      application_gaps: {
        Row: {
          blocking_status: string | null
          created_at: string
          created_by_principal_id: string | null
          description: string
          evaluation_id: string | null
          gap_type: string
          id: string
          opportunity_id: string
          resolution_notes: string | null
          resolution_status: string
          resolution_type: string | null
          resolved_at: string | null
          severity: string | null
          skill_id: string | null
          updated_at: string
          updated_by_principal_id: string | null
          workspace_id: string
        }
        Insert: {
          blocking_status?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          description: string
          evaluation_id?: string | null
          gap_type: string
          id?: string
          opportunity_id: string
          resolution_notes?: string | null
          resolution_status?: string
          resolution_type?: string | null
          resolved_at?: string | null
          severity?: string | null
          skill_id?: string | null
          updated_at?: string
          updated_by_principal_id?: string | null
          workspace_id: string
        }
        Update: {
          blocking_status?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          description?: string
          evaluation_id?: string | null
          gap_type?: string
          id?: string
          opportunity_id?: string
          resolution_notes?: string | null
          resolution_status?: string
          resolution_type?: string | null
          resolved_at?: string | null
          severity?: string | null
          skill_id?: string | null
          updated_at?: string
          updated_by_principal_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_gaps_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_gaps_evaluation_workspace_fk"
            columns: ["workspace_id", "evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "application_gaps_opportunity_workspace_fk"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "application_gaps_skill_workspace_fk"
            columns: ["workspace_id", "skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "application_gaps_updated_by_principal_id_fkey"
            columns: ["updated_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_gaps_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      application_material_evidence: {
        Row: {
          application_material_id: string
          created_at: string
          created_by_principal_id: string | null
          evidence_snapshot: Json | null
          evidence_story_id: string | null
          id: string
          project_id: string | null
          skill_id: string | null
          usage_context: string | null
          workspace_id: string
        }
        Insert: {
          application_material_id: string
          created_at?: string
          created_by_principal_id?: string | null
          evidence_snapshot?: Json | null
          evidence_story_id?: string | null
          id?: string
          project_id?: string | null
          skill_id?: string | null
          usage_context?: string | null
          workspace_id: string
        }
        Update: {
          application_material_id?: string
          created_at?: string
          created_by_principal_id?: string | null
          evidence_snapshot?: Json | null
          evidence_story_id?: string | null
          id?: string
          project_id?: string | null
          skill_id?: string | null
          usage_context?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_material_evidence_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_material_evidence_material_workspace_fk"
            columns: ["workspace_id", "application_material_id"]
            isOneToOne: false
            referencedRelation: "application_materials"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "application_material_evidence_project_workspace_fk"
            columns: ["workspace_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "application_material_evidence_skill_workspace_fk"
            columns: ["workspace_id", "skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "application_material_evidence_story_workspace_fk"
            columns: ["workspace_id", "evidence_story_id"]
            isOneToOne: false
            referencedRelation: "evidence_stories"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "application_material_evidence_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      application_materials: {
        Row: {
          application_package_id: string
          content_text: string | null
          created_at: string
          created_by_principal_id: string | null
          file_url: string | null
          id: string
          is_current_package_version: boolean
          material_type: string
          source_template_id: string | null
          status: string
          storage_path: string | null
          updated_at: string
          updated_by_principal_id: string | null
          version_number: number
          workspace_id: string
        }
        Insert: {
          application_package_id: string
          content_text?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          file_url?: string | null
          id?: string
          is_current_package_version?: boolean
          material_type: string
          source_template_id?: string | null
          status?: string
          storage_path?: string | null
          updated_at?: string
          updated_by_principal_id?: string | null
          version_number: number
          workspace_id: string
        }
        Update: {
          application_package_id?: string
          content_text?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          file_url?: string | null
          id?: string
          is_current_package_version?: boolean
          material_type?: string
          source_template_id?: string | null
          status?: string
          storage_path?: string | null
          updated_at?: string
          updated_by_principal_id?: string | null
          version_number?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_materials_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_materials_package_workspace_fk"
            columns: ["workspace_id", "application_package_id"]
            isOneToOne: false
            referencedRelation: "application_packages"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "application_materials_template_workspace_fk"
            columns: ["workspace_id", "source_template_id"]
            isOneToOne: false
            referencedRelation: "application_templates"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "application_materials_updated_by_principal_id_fkey"
            columns: ["updated_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_materials_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      application_packages: {
        Row: {
          application_template_id: string | null
          approved_at: string | null
          approved_by_principal_id: string | null
          candidate_notes: string | null
          created_at: string
          created_by_principal_id: string | null
          evaluation_id: string | null
          id: string
          opportunity_id: string
          package_number: number
          prepared_by_principal_id: string | null
          status: string
          updated_at: string
          updated_by_principal_id: string | null
          workspace_id: string
        }
        Insert: {
          application_template_id?: string | null
          approved_at?: string | null
          approved_by_principal_id?: string | null
          candidate_notes?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          evaluation_id?: string | null
          id?: string
          opportunity_id: string
          package_number: number
          prepared_by_principal_id?: string | null
          status?: string
          updated_at?: string
          updated_by_principal_id?: string | null
          workspace_id: string
        }
        Update: {
          application_template_id?: string | null
          approved_at?: string | null
          approved_by_principal_id?: string | null
          candidate_notes?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          evaluation_id?: string | null
          id?: string
          opportunity_id?: string
          package_number?: number
          prepared_by_principal_id?: string | null
          status?: string
          updated_at?: string
          updated_by_principal_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_packages_approved_by_principal_id_fkey"
            columns: ["approved_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_packages_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_packages_evaluation_workspace_fk"
            columns: ["workspace_id", "evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "application_packages_opportunity_workspace_fk"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "application_packages_prepared_by_principal_id_fkey"
            columns: ["prepared_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_packages_template_workspace_fk"
            columns: ["workspace_id", "application_template_id"]
            isOneToOne: false
            referencedRelation: "application_templates"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "application_packages_updated_by_principal_id_fkey"
            columns: ["updated_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_packages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      application_submitted_materials: {
        Row: {
          application_id: string
          application_material_id: string
          created_at: string
          created_by_principal_id: string | null
          id: string
          material_type: string
          submitted_at: string
          submitted_material_snapshot: Json
          workspace_id: string
        }
        Insert: {
          application_id: string
          application_material_id: string
          created_at?: string
          created_by_principal_id?: string | null
          id?: string
          material_type: string
          submitted_at?: string
          submitted_material_snapshot: Json
          workspace_id: string
        }
        Update: {
          application_id?: string
          application_material_id?: string
          created_at?: string
          created_by_principal_id?: string | null
          id?: string
          material_type?: string
          submitted_at?: string
          submitted_material_snapshot?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_submitted_materials_application_workspace_fk"
            columns: ["workspace_id", "application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "application_submitted_materials_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_submitted_materials_material_workspace_fk"
            columns: ["workspace_id", "application_material_id"]
            isOneToOne: false
            referencedRelation: "application_materials"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "application_submitted_materials_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      application_templates: {
        Row: {
          cover_letter_strategy: string | null
          created_at: string
          created_by_principal_id: string | null
          description: string | null
          id: string
          interview_themes: string | null
          job_family_id: string | null
          name: string
          outreach_positioning: string | null
          resume_strategy: string | null
          status: string
          template_key: string
          updated_at: string
          updated_by_principal_id: string | null
          version_number: number
          workspace_id: string
        }
        Insert: {
          cover_letter_strategy?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          description?: string | null
          id?: string
          interview_themes?: string | null
          job_family_id?: string | null
          name: string
          outreach_positioning?: string | null
          resume_strategy?: string | null
          status?: string
          template_key: string
          updated_at?: string
          updated_by_principal_id?: string | null
          version_number: number
          workspace_id: string
        }
        Update: {
          cover_letter_strategy?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          description?: string | null
          id?: string
          interview_themes?: string | null
          job_family_id?: string | null
          name?: string
          outreach_positioning?: string | null
          resume_strategy?: string | null
          status?: string
          template_key?: string
          updated_at?: string
          updated_by_principal_id?: string | null
          version_number?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_templates_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_templates_job_family_workspace_fk"
            columns: ["workspace_id", "job_family_id"]
            isOneToOne: false
            referencedRelation: "job_families"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "application_templates_updated_by_principal_id_fkey"
            columns: ["updated_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          application_package_id: string | null
          application_stage: string
          application_url: string | null
          approved_by_principal_id: string | null
          attempt_number: number
          confirmation_reference: string | null
          confirmation_type: string | null
          confirmed_at: string | null
          created_at: string
          created_by_principal_id: string | null
          id: string
          notes: string | null
          opportunity_id: string
          submission_method: string | null
          submitted_at: string | null
          submitted_by_principal_id: string | null
          updated_at: string
          updated_by_principal_id: string | null
          workspace_id: string
        }
        Insert: {
          application_package_id?: string | null
          application_stage?: string
          application_url?: string | null
          approved_by_principal_id?: string | null
          attempt_number: number
          confirmation_reference?: string | null
          confirmation_type?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          id?: string
          notes?: string | null
          opportunity_id: string
          submission_method?: string | null
          submitted_at?: string | null
          submitted_by_principal_id?: string | null
          updated_at?: string
          updated_by_principal_id?: string | null
          workspace_id: string
        }
        Update: {
          application_package_id?: string | null
          application_stage?: string
          application_url?: string | null
          approved_by_principal_id?: string | null
          attempt_number?: number
          confirmation_reference?: string | null
          confirmation_type?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          id?: string
          notes?: string | null
          opportunity_id?: string
          submission_method?: string | null
          submitted_at?: string | null
          submitted_by_principal_id?: string | null
          updated_at?: string
          updated_by_principal_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_approved_by_principal_id_fkey"
            columns: ["approved_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_opportunity_workspace_fk"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "applications_package_workspace_fk"
            columns: ["workspace_id", "application_package_id"]
            isOneToOne: false
            referencedRelation: "application_packages"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "applications_submitted_by_principal_id_fkey"
            columns: ["submitted_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_updated_by_principal_id_fkey"
            columns: ["updated_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_policies: {
        Row: {
          action_key: string
          autonomy_level: string
          created_at: string
          created_by_principal_id: string | null
          id: string
          is_enabled: boolean
          notes: string | null
          rules: Json
          updated_at: string
          updated_by_principal_id: string | null
          workspace_id: string
        }
        Insert: {
          action_key: string
          autonomy_level?: string
          created_at?: string
          created_by_principal_id?: string | null
          id?: string
          is_enabled?: boolean
          notes?: string | null
          rules?: Json
          updated_at?: string
          updated_by_principal_id?: string | null
          workspace_id: string
        }
        Update: {
          action_key?: string
          autonomy_level?: string
          created_at?: string
          created_by_principal_id?: string | null
          id?: string
          is_enabled?: boolean
          notes?: string | null
          rules?: Json
          updated_at?: string
          updated_by_principal_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_policies_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_policies_updated_by_principal_id_fkey"
            columns: ["updated_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_policies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_settings: {
        Row: {
          application_defaults: Json
          candidate_profile: Json
          company_preferences: Json
          compensation_preferences: Json
          created_at: string
          created_by_principal_id: string | null
          daily_opportunity_target: number
          id: string
          location_preferences: Json
          minimum_successful_grade: string
          queue_preferences: Json
          role_preferences: Json
          search_strategy: string
          timezone: string | null
          travel_preferences: Json
          updated_at: string
          updated_by_principal_id: string | null
          work_style_preferences: Json
          workspace_id: string
        }
        Insert: {
          application_defaults?: Json
          candidate_profile?: Json
          company_preferences?: Json
          compensation_preferences?: Json
          created_at?: string
          created_by_principal_id?: string | null
          daily_opportunity_target?: number
          id?: string
          location_preferences?: Json
          minimum_successful_grade?: string
          queue_preferences?: Json
          role_preferences?: Json
          search_strategy?: string
          timezone?: string | null
          travel_preferences?: Json
          updated_at?: string
          updated_by_principal_id?: string | null
          work_style_preferences?: Json
          workspace_id: string
        }
        Update: {
          application_defaults?: Json
          candidate_profile?: Json
          company_preferences?: Json
          compensation_preferences?: Json
          created_at?: string
          created_by_principal_id?: string | null
          daily_opportunity_target?: number
          id?: string
          location_preferences?: Json
          minimum_successful_grade?: string
          queue_preferences?: Json
          role_preferences?: Json
          search_strategy?: string
          timezone?: string | null
          travel_preferences?: Json
          updated_at?: string
          updated_by_principal_id?: string | null
          work_style_preferences?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_settings_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_settings_updated_by_principal_id_fkey"
            columns: ["updated_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          careers_url: string | null
          company_size: string | null
          created_at: string
          created_by_principal_id: string | null
          headquarters_location: string | null
          id: string
          industry: string | null
          linkedin_url: string | null
          name: string
          normalized_name: string | null
          status: string
          updated_at: string
          updated_by_principal_id: string | null
          website_url: string | null
          workspace_id: string
        }
        Insert: {
          careers_url?: string | null
          company_size?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          headquarters_location?: string | null
          id?: string
          industry?: string | null
          linkedin_url?: string | null
          name: string
          normalized_name?: string | null
          status?: string
          updated_at?: string
          updated_by_principal_id?: string | null
          website_url?: string | null
          workspace_id: string
        }
        Update: {
          careers_url?: string | null
          company_size?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          headquarters_location?: string | null
          id?: string
          industry?: string | null
          linkedin_url?: string | null
          name?: string
          normalized_name?: string | null
          status?: string
          updated_at?: string
          updated_by_principal_id?: string | null
          website_url?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_updated_by_principal_id_fkey"
            columns: ["updated_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      company_intelligence: {
        Row: {
          company_id: string
          confidence_level: string | null
          created_at: string
          created_by_principal_id: string | null
          evidence_type: string
          expires_at: string | null
          id: string
          intelligence_type: string
          is_active: boolean
          published_at: string | null
          researched_at: string
          source_name: string | null
          source_url: string | null
          summary: string
          title: string | null
          updated_at: string
          updated_by_principal_id: string | null
          workspace_id: string
        }
        Insert: {
          company_id: string
          confidence_level?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          evidence_type?: string
          expires_at?: string | null
          id?: string
          intelligence_type: string
          is_active?: boolean
          published_at?: string | null
          researched_at?: string
          source_name?: string | null
          source_url?: string | null
          summary: string
          title?: string | null
          updated_at?: string
          updated_by_principal_id?: string | null
          workspace_id: string
        }
        Update: {
          company_id?: string
          confidence_level?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          evidence_type?: string
          expires_at?: string | null
          id?: string
          intelligence_type?: string
          is_active?: boolean
          published_at?: string | null
          researched_at?: string
          source_name?: string | null
          source_url?: string | null
          summary?: string
          title?: string | null
          updated_at?: string
          updated_by_principal_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_intelligence_company_workspace_fk"
            columns: ["workspace_id", "company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "company_intelligence_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_intelligence_updated_by_principal_id_fkey"
            columns: ["updated_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_intelligence_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_plan_items: {
        Row: {
          action_snapshot: Json
          completion_status: string
          created_at: string
          created_by_principal_id: string | null
          daily_plan_id: string
          display_order: number
          id: string
          next_action_id: string
          planned_status: string
          priority_snapshot: number
          reason_for_priority: string | null
          updated_at: string
          updated_by_principal_id: string | null
          work_block_id: string | null
          workspace_id: string
        }
        Insert: {
          action_snapshot: Json
          completion_status?: string
          created_at?: string
          created_by_principal_id?: string | null
          daily_plan_id: string
          display_order: number
          id?: string
          next_action_id: string
          planned_status?: string
          priority_snapshot: number
          reason_for_priority?: string | null
          updated_at?: string
          updated_by_principal_id?: string | null
          work_block_id?: string | null
          workspace_id: string
        }
        Update: {
          action_snapshot?: Json
          completion_status?: string
          created_at?: string
          created_by_principal_id?: string | null
          daily_plan_id?: string
          display_order?: number
          id?: string
          next_action_id?: string
          planned_status?: string
          priority_snapshot?: number
          reason_for_priority?: string | null
          updated_at?: string
          updated_by_principal_id?: string | null
          work_block_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_plan_items_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_plan_items_daily_plan_workspace_fk"
            columns: ["workspace_id", "daily_plan_id"]
            isOneToOne: false
            referencedRelation: "daily_plans"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "daily_plan_items_next_action_workspace_fk"
            columns: ["workspace_id", "next_action_id"]
            isOneToOne: false
            referencedRelation: "next_actions"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "daily_plan_items_updated_by_principal_id_fkey"
            columns: ["updated_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_plan_items_work_block_workspace_fk"
            columns: ["workspace_id", "work_block_id"]
            isOneToOne: false
            referencedRelation: "work_blocks"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "daily_plan_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_plans: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by_principal_id: string | null
          generated_at: string
          grade: string | null
          id: string
          plan_date: string
          score: number | null
          status: string
          summary: string | null
          todays_one_thing_action_id: string | null
          updated_at: string
          updated_by_principal_id: string | null
          version_number: number
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          generated_at?: string
          grade?: string | null
          id?: string
          plan_date: string
          score?: number | null
          status?: string
          summary?: string | null
          todays_one_thing_action_id?: string | null
          updated_at?: string
          updated_by_principal_id?: string | null
          version_number: number
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          generated_at?: string
          grade?: string | null
          id?: string
          plan_date?: string
          score?: number | null
          status?: string
          summary?: string | null
          todays_one_thing_action_id?: string | null
          updated_at?: string
          updated_by_principal_id?: string | null
          version_number?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_plans_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_plans_todays_one_thing_workspace_fk"
            columns: ["workspace_id", "todays_one_thing_action_id"]
            isOneToOne: false
            referencedRelation: "next_actions"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "daily_plans_updated_by_principal_id_fkey"
            columns: ["updated_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_plans_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_company_intelligence: {
        Row: {
          company_intelligence_id: string
          created_at: string
          created_by_principal_id: string | null
          evaluation_id: string
          id: string
          intelligence_snapshot: Json
          relevance_summary: string | null
          workspace_id: string
        }
        Insert: {
          company_intelligence_id: string
          created_at?: string
          created_by_principal_id?: string | null
          evaluation_id: string
          id?: string
          intelligence_snapshot: Json
          relevance_summary?: string | null
          workspace_id: string
        }
        Update: {
          company_intelligence_id?: string
          created_at?: string
          created_by_principal_id?: string | null
          evaluation_id?: string
          id?: string
          intelligence_snapshot?: Json
          relevance_summary?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eval_company_intel_evaluation_workspace_fk"
            columns: ["workspace_id", "evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "eval_company_intel_intelligence_workspace_fk"
            columns: ["workspace_id", "company_intelligence_id"]
            isOneToOne: false
            referencedRelation: "company_intelligence"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "evaluation_company_intelligence_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_company_intelligence_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_evidence: {
        Row: {
          confidence_level: string | null
          created_at: string
          created_by_principal_id: string | null
          evaluation_id: string
          evidence_role: string
          evidence_snapshot: Json
          evidence_story_id: string | null
          id: string
          project_id: string | null
          relevance_summary: string | null
          skill_id: string | null
          workspace_id: string
        }
        Insert: {
          confidence_level?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          evaluation_id: string
          evidence_role: string
          evidence_snapshot: Json
          evidence_story_id?: string | null
          id?: string
          project_id?: string | null
          relevance_summary?: string | null
          skill_id?: string | null
          workspace_id: string
        }
        Update: {
          confidence_level?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          evaluation_id?: string
          evidence_role?: string
          evidence_snapshot?: Json
          evidence_story_id?: string | null
          id?: string
          project_id?: string | null
          relevance_summary?: string | null
          skill_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_evidence_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_evidence_evaluation_workspace_fk"
            columns: ["workspace_id", "evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "evaluation_evidence_project_workspace_fk"
            columns: ["workspace_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "evaluation_evidence_skill_workspace_fk"
            columns: ["workspace_id", "skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "evaluation_evidence_story_workspace_fk"
            columns: ["workspace_id", "evidence_story_id"]
            isOneToOne: false
            referencedRelation: "evidence_stories"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "evaluation_evidence_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          candidate_fit_score: number | null
          career_optionality_summary: string | null
          company_fit_summary: string | null
          created_at: string
          created_by_principal_id: string | null
          evaluated_at: string | null
          evaluation_method_version: string | null
          evaluation_status: string
          evidence_confidence: string | null
          id: string
          opportunity_fit_score: number | null
          opportunity_id: string
          opportunity_snapshot: Json
          opportunity_type: string | null
          problem_fit_summary: string | null
          problem_translation: string | null
          pursuit_score: number | null
          recommended_next_action: string | null
          required_decision_authority: string | null
          strengths_summary: string | null
          tradeoffs_summary: string | null
          unresolved_questions: string | null
          updated_at: string
          updated_by_principal_id: string | null
          version_number: number
          workspace_id: string
        }
        Insert: {
          candidate_fit_score?: number | null
          career_optionality_summary?: string | null
          company_fit_summary?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          evaluated_at?: string | null
          evaluation_method_version?: string | null
          evaluation_status?: string
          evidence_confidence?: string | null
          id?: string
          opportunity_fit_score?: number | null
          opportunity_id: string
          opportunity_snapshot: Json
          opportunity_type?: string | null
          problem_fit_summary?: string | null
          problem_translation?: string | null
          pursuit_score?: number | null
          recommended_next_action?: string | null
          required_decision_authority?: string | null
          strengths_summary?: string | null
          tradeoffs_summary?: string | null
          unresolved_questions?: string | null
          updated_at?: string
          updated_by_principal_id?: string | null
          version_number: number
          workspace_id: string
        }
        Update: {
          candidate_fit_score?: number | null
          career_optionality_summary?: string | null
          company_fit_summary?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          evaluated_at?: string | null
          evaluation_method_version?: string | null
          evaluation_status?: string
          evidence_confidence?: string | null
          id?: string
          opportunity_fit_score?: number | null
          opportunity_id?: string
          opportunity_snapshot?: Json
          opportunity_type?: string | null
          problem_fit_summary?: string | null
          problem_translation?: string | null
          pursuit_score?: number | null
          recommended_next_action?: string | null
          required_decision_authority?: string | null
          strengths_summary?: string | null
          tradeoffs_summary?: string | null
          unresolved_questions?: string | null
          updated_at?: string
          updated_by_principal_id?: string | null
          version_number?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_opportunity_workspace_fk"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "evaluations_updated_by_principal_id_fkey"
            columns: ["updated_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_stories: {
        Row: {
          actions_taken: string | null
          candidate_role: string | null
          confidence_level: string | null
          created_at: string
          created_by_principal_id: string | null
          evidence_type: string
          id: string
          outcome: string | null
          professional_translation: string | null
          project_id: string | null
          quantitative_impact: string | null
          situation: string | null
          source_reference: string | null
          source_type: string | null
          stakeholders: string | null
          title: string
          updated_at: string
          updated_by_principal_id: string | null
          validation_status: string
          work_experience_id: string | null
          workspace_id: string
        }
        Insert: {
          actions_taken?: string | null
          candidate_role?: string | null
          confidence_level?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          evidence_type?: string
          id?: string
          outcome?: string | null
          professional_translation?: string | null
          project_id?: string | null
          quantitative_impact?: string | null
          situation?: string | null
          source_reference?: string | null
          source_type?: string | null
          stakeholders?: string | null
          title: string
          updated_at?: string
          updated_by_principal_id?: string | null
          validation_status?: string
          work_experience_id?: string | null
          workspace_id: string
        }
        Update: {
          actions_taken?: string | null
          candidate_role?: string | null
          confidence_level?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          evidence_type?: string
          id?: string
          outcome?: string | null
          professional_translation?: string | null
          project_id?: string | null
          quantitative_impact?: string | null
          situation?: string | null
          source_reference?: string | null
          source_type?: string | null
          stakeholders?: string | null
          title?: string
          updated_at?: string
          updated_by_principal_id?: string | null
          validation_status?: string
          work_experience_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_stories_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_stories_project_workspace_fk"
            columns: ["workspace_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "evidence_stories_updated_by_principal_id_fkey"
            columns: ["updated_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_stories_work_experience_workspace_fk"
            columns: ["workspace_id", "work_experience_id"]
            isOneToOne: false
            referencedRelation: "work_experiences"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "evidence_stories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_story_skills: {
        Row: {
          created_at: string
          created_by_principal_id: string | null
          evidence_story_id: string
          evidence_strength: string
          id: string
          skill_id: string
          updated_at: string
          updated_by_principal_id: string | null
          validation_status: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by_principal_id?: string | null
          evidence_story_id: string
          evidence_strength: string
          id?: string
          skill_id: string
          updated_at?: string
          updated_by_principal_id?: string | null
          validation_status?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by_principal_id?: string | null
          evidence_story_id?: string
          evidence_strength?: string
          id?: string
          skill_id?: string
          updated_at?: string
          updated_by_principal_id?: string | null
          validation_status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_story_skills_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_story_skills_skill_workspace_fk"
            columns: ["workspace_id", "skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "evidence_story_skills_story_workspace_fk"
            columns: ["workspace_id", "evidence_story_id"]
            isOneToOne: false
            referencedRelation: "evidence_stories"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "evidence_story_skills_updated_by_principal_id_fkey"
            columns: ["updated_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_story_skills_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_story_tools: {
        Row: {
          created_at: string
          created_by_principal_id: string | null
          evidence_story_id: string
          id: string
          tool_id: string
          updated_at: string
          updated_by_principal_id: string | null
          usage_context: string | null
          validation_status: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by_principal_id?: string | null
          evidence_story_id: string
          id?: string
          tool_id: string
          updated_at?: string
          updated_by_principal_id?: string | null
          usage_context?: string | null
          validation_status?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by_principal_id?: string | null
          evidence_story_id?: string
          id?: string
          tool_id?: string
          updated_at?: string
          updated_by_principal_id?: string | null
          usage_context?: string | null
          validation_status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_story_tools_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_story_tools_story_workspace_fk"
            columns: ["workspace_id", "evidence_story_id"]
            isOneToOne: false
            referencedRelation: "evidence_stories"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "evidence_story_tools_tool_workspace_fk"
            columns: ["workspace_id", "tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "evidence_story_tools_updated_by_principal_id_fkey"
            columns: ["updated_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_story_tools_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_tasks: {
        Row: {
          approval_required: boolean
          attempt_count: number
          completed_at: string | null
          created_at: string
          created_by_principal_id: string | null
          description: string | null
          domain: string
          due_at: string | null
          id: string
          idempotency_key: string | null
          last_attempt_at: string | null
          max_attempts: number
          not_before: string | null
          opportunity_id: string | null
          owner_principal_id: string | null
          priority: number
          result_summary: string | null
          source_activity_event_id: string | null
          status: string
          task_type: string
          title: string
          trigger_reference: string | null
          trigger_type: string | null
          updated_at: string
          updated_by_principal_id: string | null
          waiting_condition: string | null
          workspace_id: string
        }
        Insert: {
          approval_required?: boolean
          attempt_count?: number
          completed_at?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          description?: string | null
          domain: string
          due_at?: string | null
          id?: string
          idempotency_key?: string | null
          last_attempt_at?: string | null
          max_attempts?: number
          not_before?: string | null
          opportunity_id?: string | null
          owner_principal_id?: string | null
          priority?: number
          result_summary?: string | null
          source_activity_event_id?: string | null
          status?: string
          task_type: string
          title: string
          trigger_reference?: string | null
          trigger_type?: string | null
          updated_at?: string
          updated_by_principal_id?: string | null
          waiting_condition?: string | null
          workspace_id: string
        }
        Update: {
          approval_required?: boolean
          attempt_count?: number
          completed_at?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          description?: string | null
          domain?: string
          due_at?: string | null
          id?: string
          idempotency_key?: string | null
          last_attempt_at?: string | null
          max_attempts?: number
          not_before?: string | null
          opportunity_id?: string | null
          owner_principal_id?: string | null
          priority?: number
          result_summary?: string | null
          source_activity_event_id?: string | null
          status?: string
          task_type?: string
          title?: string
          trigger_reference?: string | null
          trigger_type?: string | null
          updated_at?: string
          updated_by_principal_id?: string | null
          waiting_condition?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_tasks_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_tasks_opportunity_workspace_fk"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "internal_tasks_owner_principal_id_fkey"
            columns: ["owner_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_tasks_source_event_workspace_fk"
            columns: ["workspace_id", "source_activity_event_id"]
            isOneToOne: false
            referencedRelation: "activity_events"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "internal_tasks_updated_by_principal_id_fkey"
            columns: ["updated_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      job_families: {
        Row: {
          created_at: string
          created_by_principal_id: string | null
          description: string | null
          id: string
          name: string
          status: string
          updated_at: string
          updated_by_principal_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by_principal_id?: string | null
          description?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
          updated_by_principal_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by_principal_id?: string | null
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
          updated_by_principal_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_families_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_families_updated_by_principal_id_fkey"
            columns: ["updated_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_families_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      next_actions: {
        Row: {
          action_type: string
          approval_required: boolean
          assigned_to_principal_id: string | null
          completed_at: string | null
          context_summary: string | null
          created_at: string
          created_by_principal_id: string | null
          due_at: string | null
          estimated_minutes: number | null
          id: string
          internal_task_id: string | null
          opportunity_id: string | null
          priority: number
          source_activity_event_id: string | null
          status: string
          title: string
          todays_one_thing_eligible: boolean
          updated_at: string
          updated_by_principal_id: string | null
          workspace_id: string
        }
        Insert: {
          action_type: string
          approval_required?: boolean
          assigned_to_principal_id?: string | null
          completed_at?: string | null
          context_summary?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          due_at?: string | null
          estimated_minutes?: number | null
          id?: string
          internal_task_id?: string | null
          opportunity_id?: string | null
          priority?: number
          source_activity_event_id?: string | null
          status?: string
          title: string
          todays_one_thing_eligible?: boolean
          updated_at?: string
          updated_by_principal_id?: string | null
          workspace_id: string
        }
        Update: {
          action_type?: string
          approval_required?: boolean
          assigned_to_principal_id?: string | null
          completed_at?: string | null
          context_summary?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          due_at?: string | null
          estimated_minutes?: number | null
          id?: string
          internal_task_id?: string | null
          opportunity_id?: string | null
          priority?: number
          source_activity_event_id?: string | null
          status?: string
          title?: string
          todays_one_thing_eligible?: boolean
          updated_at?: string
          updated_by_principal_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "next_actions_assigned_to_principal_id_fkey"
            columns: ["assigned_to_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "next_actions_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "next_actions_event_workspace_fk"
            columns: ["workspace_id", "source_activity_event_id"]
            isOneToOne: false
            referencedRelation: "activity_events"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "next_actions_opportunity_workspace_fk"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "next_actions_task_workspace_fk"
            columns: ["workspace_id", "internal_task_id"]
            isOneToOne: false
            referencedRelation: "internal_tasks"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "next_actions_updated_by_principal_id_fkey"
            columns: ["updated_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "next_actions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          canonical_url: string | null
          closed_reason: string | null
          closing_date: string | null
          company_id: string
          created_at: string
          created_by_principal_id: string | null
          employment_type: string | null
          first_discovered_at: string
          id: string
          is_currently_active: boolean
          job_description_text: string | null
          job_family_id: string | null
          last_verified_at: string | null
          location_text: string | null
          normalized_title: string | null
          opportunity_stage: string
          posting_date: string | null
          previous_opportunity_id: string | null
          requisition_id: string | null
          salary_currency: string | null
          salary_max: number | null
          salary_min: number | null
          salary_period: string | null
          title: string
          updated_at: string
          updated_by_principal_id: string | null
          work_arrangement: string | null
          workspace_id: string
        }
        Insert: {
          canonical_url?: string | null
          closed_reason?: string | null
          closing_date?: string | null
          company_id: string
          created_at?: string
          created_by_principal_id?: string | null
          employment_type?: string | null
          first_discovered_at?: string
          id?: string
          is_currently_active?: boolean
          job_description_text?: string | null
          job_family_id?: string | null
          last_verified_at?: string | null
          location_text?: string | null
          normalized_title?: string | null
          opportunity_stage?: string
          posting_date?: string | null
          previous_opportunity_id?: string | null
          requisition_id?: string | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_period?: string | null
          title: string
          updated_at?: string
          updated_by_principal_id?: string | null
          work_arrangement?: string | null
          workspace_id: string
        }
        Update: {
          canonical_url?: string | null
          closed_reason?: string | null
          closing_date?: string | null
          company_id?: string
          created_at?: string
          created_by_principal_id?: string | null
          employment_type?: string | null
          first_discovered_at?: string
          id?: string
          is_currently_active?: boolean
          job_description_text?: string | null
          job_family_id?: string | null
          last_verified_at?: string | null
          location_text?: string | null
          normalized_title?: string | null
          opportunity_stage?: string
          posting_date?: string | null
          previous_opportunity_id?: string | null
          requisition_id?: string | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_period?: string | null
          title?: string
          updated_at?: string
          updated_by_principal_id?: string | null
          work_arrangement?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_company_workspace_fk"
            columns: ["workspace_id", "company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "opportunities_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_job_family_workspace_fk"
            columns: ["workspace_id", "job_family_id"]
            isOneToOne: false
            referencedRelation: "job_families"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "opportunities_previous_opportunity_workspace_fk"
            columns: ["workspace_id", "previous_opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "opportunities_updated_by_principal_id_fkey"
            columns: ["updated_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_sources: {
        Row: {
          created_at: string
          created_by_principal_id: string | null
          discovered_at: string
          external_job_id: string | null
          id: string
          is_active: boolean
          last_checked_at: string | null
          opportunity_id: string
          source_company_name: string | null
          source_job_description_text: string | null
          source_location: string | null
          source_reference: string | null
          source_salary_text: string | null
          source_title: string | null
          source_type: string
          source_url: string | null
          updated_at: string
          updated_by_principal_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by_principal_id?: string | null
          discovered_at?: string
          external_job_id?: string | null
          id?: string
          is_active?: boolean
          last_checked_at?: string | null
          opportunity_id: string
          source_company_name?: string | null
          source_job_description_text?: string | null
          source_location?: string | null
          source_reference?: string | null
          source_salary_text?: string | null
          source_title?: string | null
          source_type: string
          source_url?: string | null
          updated_at?: string
          updated_by_principal_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by_principal_id?: string | null
          discovered_at?: string
          external_job_id?: string | null
          id?: string
          is_active?: boolean
          last_checked_at?: string | null
          opportunity_id?: string
          source_company_name?: string | null
          source_job_description_text?: string | null
          source_location?: string | null
          source_reference?: string | null
          source_salary_text?: string | null
          source_title?: string | null
          source_type?: string
          source_url?: string | null
          updated_at?: string
          updated_by_principal_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_sources_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_sources_opportunity_workspace_fk"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "opportunity_sources_updated_by_principal_id_fkey"
            columns: ["updated_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_sources_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          created_at: string
          description: string | null
          domain: string
          id: string
          permission_key: string
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          domain: string
          id?: string
          permission_key: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          domain?: string
          id?: string
          permission_key?: string
        }
        Relationships: []
      }
      principals: {
        Row: {
          auth_user_id: string | null
          created_at: string
          id: string
          name: string
          principal_type: string
          status: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          id?: string
          name: string
          principal_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          id?: string
          name?: string
          principal_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      professional_references: {
        Row: {
          created_at: string
          created_by_principal_id: string | null
          email: string | null
          full_name: string
          id: string
          may_contact: boolean
          notes: string | null
          phone: string | null
          preferred_contact_method: string | null
          reference_company: string | null
          reference_title: string | null
          relationship_summary: string | null
          source_reference: string | null
          source_type: string | null
          status: string
          updated_at: string
          updated_by_principal_id: string | null
          validation_status: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by_principal_id?: string | null
          email?: string | null
          full_name: string
          id?: string
          may_contact?: boolean
          notes?: string | null
          phone?: string | null
          preferred_contact_method?: string | null
          reference_company?: string | null
          reference_title?: string | null
          relationship_summary?: string | null
          source_reference?: string | null
          source_type?: string | null
          status?: string
          updated_at?: string
          updated_by_principal_id?: string | null
          validation_status?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by_principal_id?: string | null
          email?: string | null
          full_name?: string
          id?: string
          may_contact?: boolean
          notes?: string | null
          phone?: string | null
          preferred_contact_method?: string | null
          reference_company?: string | null
          reference_title?: string | null
          relationship_summary?: string | null
          source_reference?: string | null
          source_type?: string | null
          status?: string
          updated_at?: string
          updated_by_principal_id?: string | null
          validation_status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_references_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_references_updated_by_principal_id_fkey"
            columns: ["updated_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_references_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_skills: {
        Row: {
          created_at: string
          created_by_principal_id: string | null
          evidence_strength: string | null
          id: string
          project_id: string
          skill_id: string
          updated_at: string
          updated_by_principal_id: string | null
          validation_status: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by_principal_id?: string | null
          evidence_strength?: string | null
          id?: string
          project_id: string
          skill_id: string
          updated_at?: string
          updated_by_principal_id?: string | null
          validation_status?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by_principal_id?: string | null
          evidence_strength?: string | null
          id?: string
          project_id?: string
          skill_id?: string
          updated_at?: string
          updated_by_principal_id?: string | null
          validation_status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_skills_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_skills_project_workspace_fk"
            columns: ["workspace_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "project_skills_skill_workspace_fk"
            columns: ["workspace_id", "skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "project_skills_updated_by_principal_id_fkey"
            columns: ["updated_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_skills_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tools: {
        Row: {
          created_at: string
          created_by_principal_id: string | null
          id: string
          project_id: string
          tool_id: string
          updated_at: string
          updated_by_principal_id: string | null
          usage_context: string | null
          validation_status: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by_principal_id?: string | null
          id?: string
          project_id: string
          tool_id: string
          updated_at?: string
          updated_by_principal_id?: string | null
          usage_context?: string | null
          validation_status?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by_principal_id?: string | null
          id?: string
          project_id?: string
          tool_id?: string
          updated_at?: string
          updated_by_principal_id?: string | null
          usage_context?: string | null
          validation_status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tools_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tools_project_workspace_fk"
            columns: ["workspace_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "project_tools_tool_workspace_fk"
            columns: ["workspace_id", "tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "project_tools_updated_by_principal_id_fkey"
            columns: ["updated_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tools_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_work_experiences: {
        Row: {
          contribution_context: string | null
          created_at: string
          created_by_principal_id: string | null
          id: string
          is_primary: boolean
          project_id: string
          relationship_type: string | null
          updated_at: string
          updated_by_principal_id: string | null
          validation_status: string
          work_experience_id: string
          workspace_id: string
        }
        Insert: {
          contribution_context?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          id?: string
          is_primary?: boolean
          project_id: string
          relationship_type?: string | null
          updated_at?: string
          updated_by_principal_id?: string | null
          validation_status?: string
          work_experience_id: string
          workspace_id: string
        }
        Update: {
          contribution_context?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          id?: string
          is_primary?: boolean
          project_id?: string
          relationship_type?: string | null
          updated_at?: string
          updated_by_principal_id?: string | null
          validation_status?: string
          work_experience_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_work_experiences_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_work_experiences_project_workspace_fk"
            columns: ["workspace_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "project_work_experiences_updated_by_principal_id_fkey"
            columns: ["updated_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_work_experiences_work_workspace_fk"
            columns: ["workspace_id", "work_experience_id"]
            isOneToOne: false
            referencedRelation: "work_experiences"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "project_work_experiences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          architecture_summary: string | null
          candidate_role: string | null
          created_at: string
          created_by_principal_id: string | null
          end_date: string | null
          id: string
          name: string
          outcomes: string | null
          problem_statement: string | null
          quantitative_results: string | null
          responsibilities: string | null
          scale_complexity: string | null
          source_reference: string | null
          source_type: string | null
          stakeholders: string | null
          start_date: string | null
          status: string
          summary: string | null
          updated_at: string
          updated_by_principal_id: string | null
          validation_status: string
          workspace_id: string
        }
        Insert: {
          architecture_summary?: string | null
          candidate_role?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          end_date?: string | null
          id?: string
          name: string
          outcomes?: string | null
          problem_statement?: string | null
          quantitative_results?: string | null
          responsibilities?: string | null
          scale_complexity?: string | null
          source_reference?: string | null
          source_type?: string | null
          stakeholders?: string | null
          start_date?: string | null
          status?: string
          summary?: string | null
          updated_at?: string
          updated_by_principal_id?: string | null
          validation_status?: string
          workspace_id: string
        }
        Update: {
          architecture_summary?: string | null
          candidate_role?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          end_date?: string | null
          id?: string
          name?: string
          outcomes?: string | null
          problem_statement?: string | null
          quantitative_results?: string | null
          responsibilities?: string | null
          scale_complexity?: string | null
          source_reference?: string | null
          source_type?: string | null
          stakeholders?: string | null
          start_date?: string | null
          status?: string
          summary?: string | null
          updated_at?: string
          updated_by_principal_id?: string | null
          validation_status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_updated_by_principal_id_fkey"
            columns: ["updated_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system_role: boolean
          name: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system_role?: boolean
          name: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system_role?: boolean
          name?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          category: string | null
          created_at: string
          created_by_principal_id: string | null
          description: string | null
          id: string
          name: string
          normalized_name: string | null
          status: string
          updated_at: string
          updated_by_principal_id: string | null
          workspace_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          description?: string | null
          id?: string
          name: string
          normalized_name?: string | null
          status?: string
          updated_at?: string
          updated_by_principal_id?: string | null
          workspace_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          description?: string | null
          id?: string
          name?: string
          normalized_name?: string | null
          status?: string
          updated_at?: string
          updated_by_principal_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skills_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skills_updated_by_principal_id_fkey"
            columns: ["updated_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skills_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attempts: {
        Row: {
          attempt_number: number
          completed_at: string | null
          created_at: string
          error_code: string | null
          error_message: string | null
          executed_by_principal_id: string | null
          id: string
          internal_task_id: string
          result_summary: string | null
          started_at: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          attempt_number: number
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          executed_by_principal_id?: string | null
          id?: string
          internal_task_id: string
          result_summary?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          attempt_number?: number
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          executed_by_principal_id?: string | null
          id?: string
          internal_task_id?: string
          result_summary?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_attempts_executed_by_principal_id_fkey"
            columns: ["executed_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attempts_task_workspace_fk"
            columns: ["workspace_id", "internal_task_id"]
            isOneToOne: false
            referencedRelation: "internal_tasks"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "task_attempts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      task_dependencies: {
        Row: {
          created_at: string
          created_by_principal_id: string | null
          dependency_type: string
          depends_on_task_id: string
          id: string
          task_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by_principal_id?: string | null
          dependency_type?: string
          depends_on_task_id: string
          id?: string
          task_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by_principal_id?: string | null
          dependency_type?: string
          depends_on_task_id?: string
          id?: string
          task_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_dependencies_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_parent_workspace_fk"
            columns: ["workspace_id", "depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "internal_tasks"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "task_dependencies_task_workspace_fk"
            columns: ["workspace_id", "task_id"]
            isOneToOne: false
            referencedRelation: "internal_tasks"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "task_dependencies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tools: {
        Row: {
          category: string | null
          created_at: string
          created_by_principal_id: string | null
          description: string | null
          id: string
          name: string
          normalized_name: string | null
          status: string
          updated_at: string
          updated_by_principal_id: string | null
          workspace_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          description?: string | null
          id?: string
          name: string
          normalized_name?: string | null
          status?: string
          updated_at?: string
          updated_by_principal_id?: string | null
          workspace_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by_principal_id?: string | null
          description?: string | null
          id?: string
          name?: string
          normalized_name?: string | null
          status?: string
          updated_at?: string
          updated_by_principal_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_updated_by_principal_id_fkey"
            columns: ["updated_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      work_blocks: {
        Row: {
          block_order: number
          created_at: string
          created_by_principal_id: string | null
          daily_plan_id: string
          estimated_minutes: number | null
          id: string
          name: string
          planned_start_at: string | null
          status: string
          updated_at: string
          updated_by_principal_id: string | null
          workspace_id: string
        }
        Insert: {
          block_order: number
          created_at?: string
          created_by_principal_id?: string | null
          daily_plan_id: string
          estimated_minutes?: number | null
          id?: string
          name: string
          planned_start_at?: string | null
          status?: string
          updated_at?: string
          updated_by_principal_id?: string | null
          workspace_id: string
        }
        Update: {
          block_order?: number
          created_at?: string
          created_by_principal_id?: string | null
          daily_plan_id?: string
          estimated_minutes?: number | null
          id?: string
          name?: string
          planned_start_at?: string | null
          status?: string
          updated_at?: string
          updated_by_principal_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_blocks_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_blocks_daily_plan_workspace_fk"
            columns: ["workspace_id", "daily_plan_id"]
            isOneToOne: false
            referencedRelation: "daily_plans"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "work_blocks_updated_by_principal_id_fkey"
            columns: ["updated_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_blocks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      work_experience_application_details: {
        Row: {
          created_at: string
          created_by_principal_id: string | null
          employer_contact_note: string | null
          id: string
          may_contact_employer: boolean | null
          reason_for_leaving: string | null
          source_reference: string | null
          source_type: string | null
          updated_at: string
          updated_by_principal_id: string | null
          validation_status: string
          work_experience_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by_principal_id?: string | null
          employer_contact_note?: string | null
          id?: string
          may_contact_employer?: boolean | null
          reason_for_leaving?: string | null
          source_reference?: string | null
          source_type?: string | null
          updated_at?: string
          updated_by_principal_id?: string | null
          validation_status?: string
          work_experience_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by_principal_id?: string | null
          employer_contact_note?: string | null
          id?: string
          may_contact_employer?: boolean | null
          reason_for_leaving?: string | null
          source_reference?: string | null
          source_type?: string | null
          updated_at?: string
          updated_by_principal_id?: string | null
          validation_status?: string
          work_experience_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_experience_application_detail_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_experience_application_detail_updated_by_principal_id_fkey"
            columns: ["updated_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_experience_application_details_work_workspace_fk"
            columns: ["workspace_id", "work_experience_id"]
            isOneToOne: true
            referencedRelation: "work_experiences"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "work_experience_application_details_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      work_experience_references: {
        Row: {
          created_at: string
          created_by_principal_id: string | null
          id: string
          is_active: boolean
          is_primary: boolean
          professional_reference_id: string
          relationship_context: string | null
          relationship_type: string
          title_at_time: string | null
          updated_at: string
          updated_by_principal_id: string | null
          validation_status: string
          work_experience_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by_principal_id?: string | null
          id?: string
          is_active?: boolean
          is_primary?: boolean
          professional_reference_id: string
          relationship_context?: string | null
          relationship_type: string
          title_at_time?: string | null
          updated_at?: string
          updated_by_principal_id?: string | null
          validation_status?: string
          work_experience_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by_principal_id?: string | null
          id?: string
          is_active?: boolean
          is_primary?: boolean
          professional_reference_id?: string
          relationship_context?: string | null
          relationship_type?: string
          title_at_time?: string | null
          updated_at?: string
          updated_by_principal_id?: string | null
          validation_status?: string
          work_experience_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_experience_references_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_experience_references_reference_workspace_fk"
            columns: ["workspace_id", "professional_reference_id"]
            isOneToOne: false
            referencedRelation: "professional_references"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "work_experience_references_updated_by_principal_id_fkey"
            columns: ["updated_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_experience_references_work_workspace_fk"
            columns: ["workspace_id", "work_experience_id"]
            isOneToOne: false
            referencedRelation: "work_experiences"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "work_experience_references_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      work_experiences: {
        Row: {
          company_id: string | null
          company_name: string
          created_at: string
          created_by_principal_id: string | null
          employment_type: string | null
          end_date: string | null
          id: string
          is_current: boolean
          major_outcomes: string | null
          promotion_history: string | null
          responsibilities: string | null
          role_title: string
          scope: string | null
          source_reference: string | null
          source_type: string | null
          start_date: string | null
          summary: string | null
          systems_owned: string | null
          team_context: string | null
          updated_at: string
          updated_by_principal_id: string | null
          validation_status: string
          workspace_id: string
        }
        Insert: {
          company_id?: string | null
          company_name: string
          created_at?: string
          created_by_principal_id?: string | null
          employment_type?: string | null
          end_date?: string | null
          id?: string
          is_current?: boolean
          major_outcomes?: string | null
          promotion_history?: string | null
          responsibilities?: string | null
          role_title: string
          scope?: string | null
          source_reference?: string | null
          source_type?: string | null
          start_date?: string | null
          summary?: string | null
          systems_owned?: string | null
          team_context?: string | null
          updated_at?: string
          updated_by_principal_id?: string | null
          validation_status?: string
          workspace_id: string
        }
        Update: {
          company_id?: string | null
          company_name?: string
          created_at?: string
          created_by_principal_id?: string | null
          employment_type?: string | null
          end_date?: string | null
          id?: string
          is_current?: boolean
          major_outcomes?: string | null
          promotion_history?: string | null
          responsibilities?: string | null
          role_title?: string
          scope?: string | null
          source_reference?: string | null
          source_type?: string | null
          start_date?: string | null
          summary?: string | null
          systems_owned?: string | null
          team_context?: string | null
          updated_at?: string
          updated_by_principal_id?: string | null
          validation_status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_experiences_company_workspace_fk"
            columns: ["workspace_id", "company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "work_experiences_created_by_principal_id_fkey"
            columns: ["created_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_experiences_updated_by_principal_id_fkey"
            columns: ["updated_by_principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_experiences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_memberships: {
        Row: {
          created_at: string
          id: string
          joined_at: string
          principal_id: string
          role_id: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          joined_at?: string
          principal_id: string
          role_id: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          joined_at?: string
          principal_id?: string
          role_id?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_memberships_principal_id_fkey"
            columns: ["principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_memberships_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_memberships_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_personal_workspace: {
        Args: { workspace_name: string; workspace_slug: string }
        Returns: string
      }
      current_principal_id: { Args: never; Returns: string }
      current_principal_is_human: { Args: never; Returns: boolean }
      get_application_package_status: {
        Args: { target_package_id: string; target_workspace_id: string }
        Returns: string
      }
      get_daily_plan_status: {
        Args: { target_daily_plan_id: string; target_workspace_id: string }
        Returns: string
      }
      has_permission: {
        Args: { required_permission_key: string; target_workspace_id: string }
        Returns: boolean
      }
      is_active_workspace_human: {
        Args: { target_principal_id: string; target_workspace_id: string }
        Returns: boolean
      }
      is_active_workspace_principal: {
        Args: { target_principal_id: string; target_workspace_id: string }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { target_workspace_id: string }
        Returns: boolean
      }
      shares_workspace_with_principal: {
        Args: { target_principal_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
