
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "absence_justification_attempts": {
                  Row: {
                    "justification_id": string,"message": string | null,"proof_provider": Database["public"]['Enums']["media_provider"] | null,"proof_public_id": string | null,"review_note": string | null,"reviewed_at": string | null,"reviewer_id": string | null
                  }
                  Insert: {
                    "justification_id": string,"message"?: string | null,"proof_provider"?: Database["public"]['Enums']["media_provider"] | null,"proof_public_id"?: string | null,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewer_id"?: string | null
                  }
                  Update: {
                    "justification_id"?: string,"message"?: string | null,"proof_provider"?: Database["public"]['Enums']["media_provider"] | null,"proof_public_id"?: string | null,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewer_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "absence_justification_attempts_justification_id_fkey"
      columns: ["justification_id"]
isOneToOne: true
      referencedRelation: "absence_justifications"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "absence_justification_attempts_reviewer_id_fkey"
      columns: ["reviewer_id"]
isOneToOne: false
      referencedRelation: "diretorio_perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "absence_justification_attempts_reviewer_id_fkey"
      columns: ["reviewer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"absence_justification_reviews": {
                  Row: {
                    "decided_at": string,"justification_id": string,"review_note": string,"reviewer_id": string | null
                  }
                  Insert: {
                    "decided_at": string,"justification_id": string,"review_note": string,"reviewer_id"?: string | null
                  }
                  Update: {
                    "decided_at"?: string,"justification_id"?: string,"review_note"?: string,"reviewer_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "absence_justification_reviews_justification_id_fkey"
      columns: ["justification_id"]
isOneToOne: true
      referencedRelation: "absence_justifications"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "absence_justification_reviews_reviewer_id_fkey"
      columns: ["reviewer_id"]
isOneToOne: false
      referencedRelation: "diretorio_perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "absence_justification_reviews_reviewer_id_fkey"
      columns: ["reviewer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"absence_justifications": {
                  Row: {
                    "attempt": number,"class_id": string | null,"created_at": string,"id": string,"message": string | null,"proof_provider": Database["public"]['Enums']["media_provider"] | null,"proof_public_id": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"scope": Database["public"]['Enums']["justification_scope"],"status": Database["public"]['Enums']["justification_status"],"updated_at": string,"user_id": string,"week_start": string
                  }
                  Insert: {
                    "attempt"?: number,"class_id"?: string | null,"created_at"?: string,"id"?: string,"message"?: string | null,"proof_provider"?: Database["public"]['Enums']["media_provider"] | null,"proof_public_id"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"scope"?: Database["public"]['Enums']["justification_scope"],"status"?: Database["public"]['Enums']["justification_status"],"updated_at"?: string,"user_id": string,"week_start"?: string
                  }
                  Update: {
                    "attempt"?: number,"class_id"?: string | null,"created_at"?: string,"id"?: string,"message"?: string | null,"proof_provider"?: Database["public"]['Enums']["media_provider"] | null,"proof_public_id"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"scope"?: Database["public"]['Enums']["justification_scope"],"status"?: Database["public"]['Enums']["justification_status"],"updated_at"?: string,"user_id"?: string,"week_start"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "absence_justifications_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "absence_justifications_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "diretorio_perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "absence_justifications_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "absence_justifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "diretorio_perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "absence_justifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"academy_secrets": {
                  Row: {
                    "default_student_password": string,"id": boolean,"updated_at": string
                  }
                  Insert: {
                    "default_student_password": string,"id"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "default_student_password"?: string,"id"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"academy_settings": {
                  Row: {
                    "academy_name": string,"address": string | null,"attachment_retention_days": number,"class_weekdays": (number)[],"contact_email": string | null,"contact_phone": string | null,"contact_whatsapp": string | null,"created_at": string,"default_due_day": number,"default_plan_id": string | null,"default_student_password": string,"default_weekly_goal": number,"id": boolean,"logo_url": string | null,"pix_holder_name": string | null,"pix_key": string | null,"primary_color": string,"proof_retention_days": number | null,"updated_at": string
                  }
                  Insert: {
                    "academy_name"?: string,"address"?: string | null,"attachment_retention_days"?: number,"class_weekdays"?: (number)[],"contact_email"?: string | null,"contact_phone"?: string | null,"contact_whatsapp"?: string | null,"created_at"?: string,"default_due_day"?: number,"default_plan_id"?: string | null,"default_student_password"?: string,"default_weekly_goal"?: number,"id"?: boolean,"logo_url"?: string | null,"pix_holder_name"?: string | null,"pix_key"?: string | null,"primary_color"?: string,"proof_retention_days"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "academy_name"?: string,"address"?: string | null,"attachment_retention_days"?: number,"class_weekdays"?: (number)[],"contact_email"?: string | null,"contact_phone"?: string | null,"contact_whatsapp"?: string | null,"created_at"?: string,"default_due_day"?: number,"default_plan_id"?: string | null,"default_student_password"?: string,"default_weekly_goal"?: number,"id"?: boolean,"logo_url"?: string | null,"pix_holder_name"?: string | null,"pix_key"?: string | null,"primary_color"?: string,"proof_retention_days"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "academy_settings_default_plan_id_fkey"
      columns: ["default_plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    }
                  ]
                },"action_reason_attachments": {
                  Row: {
                    "created_at": string,"id": string,"provider": Database["public"]['Enums']["media_provider"],"public_id": string,"reason_id": string,"uploaded_by": string
                  }
                  Insert: {
                    "created_at"?: string,"id": string,"provider": Database["public"]['Enums']["media_provider"],"public_id": string,"reason_id": string,"uploaded_by": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"provider"?: Database["public"]['Enums']["media_provider"],"public_id"?: string,"reason_id"?: string,"uploaded_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "action_reason_attachments_reason_id_fkey"
      columns: ["reason_id"]
isOneToOne: false
      referencedRelation: "action_reasons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "action_reason_attachments_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "diretorio_perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "action_reason_attachments_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"action_reasons": {
                  Row: {
                    "audited_at": string | null,"audited_by": string | null,"author_id": string | null,"body": string,"class_id": string | null,"created_at": string,"id": string,"kind": Database["public"]['Enums']["action_reason_kind"],"used_at": string | null
                  }
                  Insert: {
                    "audited_at"?: string | null,"audited_by"?: string | null,"author_id"?: string | null,"body": string,"class_id"?: string | null,"created_at"?: string,"id"?: string,"kind": Database["public"]['Enums']["action_reason_kind"],"used_at"?: string | null
                  }
                  Update: {
                    "audited_at"?: string | null,"audited_by"?: string | null,"author_id"?: string | null,"body"?: string,"class_id"?: string | null,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["action_reason_kind"],"used_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "action_reasons_audited_by_fkey"
      columns: ["audited_by"]
isOneToOne: false
      referencedRelation: "diretorio_perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "action_reasons_audited_by_fkey"
      columns: ["audited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "action_reasons_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "diretorio_perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "action_reasons_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "action_reasons_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id"]
    }
                  ]
                },"attendance": {
                  Row: {
                    "class_id": string,"created_at": string,"declared_at": string | null,"declared_status": Database["public"]['Enums']["attendance_status"] | null,"edited": boolean,"id": string,"included": boolean,"status": Database["public"]['Enums']["attendance_status"] | null,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "class_id": string,"created_at"?: string,"declared_at"?: string | null,"declared_status"?: Database["public"]['Enums']["attendance_status"] | null,"edited"?: boolean,"id"?: string,"included"?: boolean,"status"?: Database["public"]['Enums']["attendance_status"] | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "class_id"?: string,"created_at"?: string,"declared_at"?: string | null,"declared_status"?: Database["public"]['Enums']["attendance_status"] | null,"edited"?: boolean,"id"?: string,"included"?: boolean,"status"?: Database["public"]['Enums']["attendance_status"] | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendance_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "diretorio_perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"attendance_audit": {
                  Row: {
                    "added_by": string | null,"attendance_id": string,"edit_reason_id": string | null,"edited_at": string | null,"edited_by": string | null,"previous_status": Database["public"]['Enums']["attendance_status"] | null,"taken_by": string | null
                  }
                  Insert: {
                    "added_by"?: string | null,"attendance_id": string,"edit_reason_id"?: string | null,"edited_at"?: string | null,"edited_by"?: string | null,"previous_status"?: Database["public"]['Enums']["attendance_status"] | null,"taken_by"?: string | null
                  }
                  Update: {
                    "added_by"?: string | null,"attendance_id"?: string,"edit_reason_id"?: string | null,"edited_at"?: string | null,"edited_by"?: string | null,"previous_status"?: Database["public"]['Enums']["attendance_status"] | null,"taken_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendance_audit_added_by_fkey"
      columns: ["added_by"]
isOneToOne: false
      referencedRelation: "diretorio_perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_audit_added_by_fkey"
      columns: ["added_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_audit_attendance_id_fkey"
      columns: ["attendance_id"]
isOneToOne: true
      referencedRelation: "attendance"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_audit_edit_reason_id_fkey"
      columns: ["edit_reason_id"]
isOneToOne: false
      referencedRelation: "action_reasons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_audit_edited_by_fkey"
      columns: ["edited_by"]
isOneToOne: false
      referencedRelation: "diretorio_perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_audit_edited_by_fkey"
      columns: ["edited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_audit_taken_by_fkey"
      columns: ["taken_by"]
isOneToOne: false
      referencedRelation: "diretorio_perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_audit_taken_by_fkey"
      columns: ["taken_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"attendance_monthly": {
                  Row: {
                    "attended": number,"closed_at": string,"counted_classes": number,"frequency_percent": number,"group_id": string | null,"id": string,"justified": number,"reference_month": string,"total_classes": number,"user_id": string
                  }
                  Insert: {
                    "attended": number,"closed_at"?: string,"counted_classes": number,"frequency_percent": number,"group_id"?: string | null,"id"?: string,"justified": number,"reference_month": string,"total_classes": number,"user_id": string
                  }
                  Update: {
                    "attended"?: number,"closed_at"?: string,"counted_classes"?: number,"frequency_percent"?: number,"group_id"?: string | null,"id"?: string,"justified"?: number,"reference_month"?: string,"total_classes"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendance_monthly_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_monthly_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "diretorio_perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_monthly_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"changes": Json | null,"created_at": string,"entity": string,"entity_id": string | null,"id": number
                  }
                  Insert: {
                    "action": string,"actor_id"?: string | null,"changes"?: Json | null,"created_at"?: string,"entity": string,"entity_id"?: string | null,"id"?: never
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"changes"?: Json | null,"created_at"?: string,"entity"?: string,"entity_id"?: string | null,"id"?: never
                  }
                  Relationships: [
                    
                  ]
                },"class_audit": {
                  Row: {
                    "attendance_edited_at": string | null,"attendance_edited_by": string | null,"attendance_taken_by": string | null,"cancel_reason_id": string | null,"cancelled_by": string | null,"class_id": string
                  }
                  Insert: {
                    "attendance_edited_at"?: string | null,"attendance_edited_by"?: string | null,"attendance_taken_by"?: string | null,"cancel_reason_id"?: string | null,"cancelled_by"?: string | null,"class_id": string
                  }
                  Update: {
                    "attendance_edited_at"?: string | null,"attendance_edited_by"?: string | null,"attendance_taken_by"?: string | null,"cancel_reason_id"?: string | null,"cancelled_by"?: string | null,"class_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_audit_attendance_edited_by_fkey"
      columns: ["attendance_edited_by"]
isOneToOne: false
      referencedRelation: "diretorio_perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_audit_attendance_edited_by_fkey"
      columns: ["attendance_edited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_audit_attendance_taken_by_fkey"
      columns: ["attendance_taken_by"]
isOneToOne: false
      referencedRelation: "diretorio_perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_audit_attendance_taken_by_fkey"
      columns: ["attendance_taken_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_audit_cancel_reason_id_fkey"
      columns: ["cancel_reason_id"]
isOneToOne: false
      referencedRelation: "action_reasons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_audit_cancelled_by_fkey"
      columns: ["cancelled_by"]
isOneToOne: false
      referencedRelation: "diretorio_perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_audit_cancelled_by_fkey"
      columns: ["cancelled_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_audit_class_id_fkey"
      columns: ["class_id"]
isOneToOne: true
      referencedRelation: "classes"
      referencedColumns: ["id"]
    }
                  ]
                },"class_schedule_skips": {
                  Row: {
                    "created_at": string,"occurrence_date": string,"schedule_id": string
                  }
                  Insert: {
                    "created_at"?: string,"occurrence_date": string,"schedule_id": string
                  }
                  Update: {
                    "created_at"?: string,"occurrence_date"?: string,"schedule_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_schedule_skips_schedule_id_fkey"
      columns: ["schedule_id"]
isOneToOne: false
      referencedRelation: "class_schedules"
      referencedColumns: ["id"]
    }
                  ]
                },"class_schedule_teachers": {
                  Row: {
                    "created_at": string,"schedule_id": string,"teacher_id": string
                  }
                  Insert: {
                    "created_at"?: string,"schedule_id": string,"teacher_id": string
                  }
                  Update: {
                    "created_at"?: string,"schedule_id"?: string,"teacher_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_schedule_teachers_schedule_id_fkey"
      columns: ["schedule_id"]
isOneToOne: false
      referencedRelation: "class_schedules"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_schedule_teachers_teacher_id_fkey"
      columns: ["teacher_id"]
isOneToOne: false
      referencedRelation: "diretorio_perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_schedule_teachers_teacher_id_fkey"
      columns: ["teacher_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"class_schedules": {
                  Row: {
                    "audience": Database["public"]['Enums']["class_audience"],"created_at": string,"created_by": string | null,"group_id": string | null,"id": string,"start_time": string,"title": string,"updated_at": string,"valid_from": string,"valid_until": string | null,"weekday": number
                  }
                  Insert: {
                    "audience"?: Database["public"]['Enums']["class_audience"],"created_at"?: string,"created_by"?: string | null,"group_id"?: string | null,"id"?: string,"start_time": string,"title": string,"updated_at"?: string,"valid_from": string,"valid_until"?: string | null,"weekday": number
                  }
                  Update: {
                    "audience"?: Database["public"]['Enums']["class_audience"],"created_at"?: string,"created_by"?: string | null,"group_id"?: string | null,"id"?: string,"start_time"?: string,"title"?: string,"updated_at"?: string,"valid_from"?: string,"valid_until"?: string | null,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_schedules_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "diretorio_perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_schedules_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_schedules_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"class_swap_periods": {
                  Row: {
                    "end_reason": string | null,"ended_at": string | null,"from_schedule_id": string,"id": string,"started_at": string,"swap_id": string | null,"to_schedule_id": string,"user_id": string
                  }
                  Insert: {
                    "end_reason"?: string | null,"ended_at"?: string | null,"from_schedule_id": string,"id"?: string,"started_at": string,"swap_id"?: string | null,"to_schedule_id": string,"user_id": string
                  }
                  Update: {
                    "end_reason"?: string | null,"ended_at"?: string | null,"from_schedule_id"?: string,"id"?: string,"started_at"?: string,"swap_id"?: string | null,"to_schedule_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_swap_periods_from_schedule_id_fkey"
      columns: ["from_schedule_id"]
isOneToOne: false
      referencedRelation: "class_schedules"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_swap_periods_swap_id_fkey"
      columns: ["swap_id"]
isOneToOne: false
      referencedRelation: "class_swaps"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_swap_periods_to_schedule_id_fkey"
      columns: ["to_schedule_id"]
isOneToOne: false
      referencedRelation: "class_schedules"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_swap_periods_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "diretorio_perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_swap_periods_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"class_swap_reviews": {
                  Row: {
                    "decided_at": string,"decided_via": string,"review_note": string | null,"reviewer_id": string | null,"swap_id": string
                  }
                  Insert: {
                    "decided_at": string,"decided_via": string,"review_note"?: string | null,"reviewer_id"?: string | null,"swap_id": string
                  }
                  Update: {
                    "decided_at"?: string,"decided_via"?: string,"review_note"?: string | null,"reviewer_id"?: string | null,"swap_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_swap_reviews_reviewer_id_fkey"
      columns: ["reviewer_id"]
isOneToOne: false
      referencedRelation: "diretorio_perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_swap_reviews_reviewer_id_fkey"
      columns: ["reviewer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_swap_reviews_swap_id_fkey"
      columns: ["swap_id"]
isOneToOne: true
      referencedRelation: "class_swaps"
      referencedColumns: ["id"]
    }
                  ]
                },"class_swaps": {
                  Row: {
                    "created_at": string,"decided_at": string | null,"decided_by": string | null,"decided_via": string | null,"from_class_id": string | null,"from_schedule_id": string | null,"id": string,"kind": Database["public"]['Enums']["class_swap_kind"],"motivo_id": string | null,"status": Database["public"]['Enums']["class_swap_status"],"to_class_id": string | null,"to_schedule_id": string | null,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decided_via"?: string | null,"from_class_id"?: string | null,"from_schedule_id"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["class_swap_kind"],"motivo_id"?: string | null,"status"?: Database["public"]['Enums']["class_swap_status"],"to_class_id"?: string | null,"to_schedule_id"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decided_via"?: string | null,"from_class_id"?: string | null,"from_schedule_id"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["class_swap_kind"],"motivo_id"?: string | null,"status"?: Database["public"]['Enums']["class_swap_status"],"to_class_id"?: string | null,"to_schedule_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_swaps_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "diretorio_perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_swaps_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_swaps_from_class_id_fkey"
      columns: ["from_class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_swaps_from_schedule_id_fkey"
      columns: ["from_schedule_id"]
isOneToOne: false
      referencedRelation: "class_schedules"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_swaps_motivo_id_fkey"
      columns: ["motivo_id"]
isOneToOne: false
      referencedRelation: "action_reasons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_swaps_to_class_id_fkey"
      columns: ["to_class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_swaps_to_schedule_id_fkey"
      columns: ["to_schedule_id"]
isOneToOne: false
      referencedRelation: "class_schedules"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_swaps_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "diretorio_perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_swaps_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"class_teacher_presence": {
                  Row: {
                    "added_in_roll_call": boolean,"class_id": string,"edit_reason_id": string | null,"edited_at": string | null,"edited_by": string | null,"present": boolean,"previous": boolean | null,"set_by": string | null,"teacher_id": string
                  }
                  Insert: {
                    "added_in_roll_call"?: boolean,"class_id": string,"edit_reason_id"?: string | null,"edited_at"?: string | null,"edited_by"?: string | null,"present": boolean,"previous"?: boolean | null,"set_by"?: string | null,"teacher_id": string
                  }
                  Update: {
                    "added_in_roll_call"?: boolean,"class_id"?: string,"edit_reason_id"?: string | null,"edited_at"?: string | null,"edited_by"?: string | null,"present"?: boolean,"previous"?: boolean | null,"set_by"?: string | null,"teacher_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_teacher_presence_class_id_teacher_id_fkey"
      columns: ["class_id","teacher_id"]
isOneToOne: true
      referencedRelation: "class_teachers"
      referencedColumns: ["class_id","teacher_id"]
    },{
      foreignKeyName: "class_teacher_presence_edit_reason_id_fkey"
      columns: ["edit_reason_id"]
isOneToOne: false
      referencedRelation: "action_reasons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_teacher_presence_edited_by_fkey"
      columns: ["edited_by"]
isOneToOne: false
      referencedRelation: "diretorio_perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_teacher_presence_edited_by_fkey"
      columns: ["edited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_teacher_presence_set_by_fkey"
      columns: ["set_by"]
isOneToOne: false
      referencedRelation: "diretorio_perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_teacher_presence_set_by_fkey"
      columns: ["set_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"class_teachers": {
                  Row: {
                    "class_id": string,"created_at": string,"teacher_id": string
                  }
                  Insert: {
                    "class_id": string,"created_at"?: string,"teacher_id": string
                  }
                  Update: {
                    "class_id"?: string,"created_at"?: string,"teacher_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_teachers_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_teachers_teacher_id_fkey"
      columns: ["teacher_id"]
isOneToOne: false
      referencedRelation: "diretorio_perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_teachers_teacher_id_fkey"
      columns: ["teacher_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"classes": {
                  Row: {
                    "attendance_edited": boolean,"attendance_taken_at": string | null,"audience": Database["public"]['Enums']["class_audience"],"cancelled_at": string | null,"created_at": string,"date_time": string,"group_id": string | null,"id": string,"occurrence_date": string | null,"schedule_detached": boolean,"schedule_id": string | null,"title": string,"type": Database["public"]['Enums']["class_type"],"updated_at": string
                  }
                  Insert: {
                    "attendance_edited"?: boolean,"attendance_taken_at"?: string | null,"audience"?: Database["public"]['Enums']["class_audience"],"cancelled_at"?: string | null,"created_at"?: string,"date_time": string,"group_id"?: string | null,"id"?: string,"occurrence_date"?: string | null,"schedule_detached"?: boolean,"schedule_id"?: string | null,"title": string,"type"?: Database["public"]['Enums']["class_type"],"updated_at"?: string
                  }
                  Update: {
                    "attendance_edited"?: boolean,"attendance_taken_at"?: string | null,"audience"?: Database["public"]['Enums']["class_audience"],"cancelled_at"?: string | null,"created_at"?: string,"date_time"?: string,"group_id"?: string | null,"id"?: string,"occurrence_date"?: string | null,"schedule_detached"?: boolean,"schedule_id"?: string | null,"title"?: string,"type"?: Database["public"]['Enums']["class_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "classes_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "classes_schedule_id_fkey"
      columns: ["schedule_id"]
isOneToOne: false
      referencedRelation: "class_schedules"
      referencedColumns: ["id"]
    }
                  ]
                },"consents": {
                  Row: {
                    "accepted_at": string,"document_id": string,"id": string,"user_id": string
                  }
                  Insert: {
                    "accepted_at"?: string,"document_id": string,"id"?: string,"user_id": string
                  }
                  Update: {
                    "accepted_at"?: string,"document_id"?: string,"id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "consents_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "legal_documents"
      referencedColumns: ["id"]
    }
                  ]
                },"groups": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"id": string,"name": string
                  }
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"name": string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"inactive_periods": {
                  Row: {
                    "ended_at": string | null,"id": string,"started_at": string,"user_id": string
                  }
                  Insert: {
                    "ended_at"?: string | null,"id"?: string,"started_at": string,"user_id": string
                  }
                  Update: {
                    "ended_at"?: string | null,"id"?: string,"started_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inactive_periods_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "diretorio_perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inactive_periods_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"legal_documents": {
                  Row: {
                    "content": string,"id": string,"is_current": boolean,"kind": Database["public"]['Enums']["legal_document_kind"],"published_at": string,"version": string
                  }
                  Insert: {
                    "content": string,"id"?: string,"is_current"?: boolean,"kind": Database["public"]['Enums']["legal_document_kind"],"published_at"?: string,"version": string
                  }
                  Update: {
                    "content"?: string,"id"?: string,"is_current"?: boolean,"kind"?: Database["public"]['Enums']["legal_document_kind"],"published_at"?: string,"version"?: string
                  }
                  Relationships: [
                    
                  ]
                },"legal_field_values": {
                  Row: {
                    "id": string,"updated_at": string,"value": string
                  }
                  Insert: {
                    "id": string,"updated_at"?: string,"value": string
                  }
                  Update: {
                    "id"?: string,"updated_at"?: string,"value"?: string
                  }
                  Relationships: [
                    
                  ]
                },"legal_templates": {
                  Row: {
                    "body": string,"kind": Database["public"]['Enums']["legal_document_kind"],"updated_at": string
                  }
                  Insert: {
                    "body": string,"kind": Database["public"]['Enums']["legal_document_kind"],"updated_at"?: string
                  }
                  Update: {
                    "body"?: string,"kind"?: Database["public"]['Enums']["legal_document_kind"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"media_deletion_queue": {
                  Row: {
                    "asset_ref": string,"enfileirado_em": string,"id": string,"justification_id": string | null,"motivo": Database["public"]['Enums']["media_deletion_reason"],"payment_id": string | null,"processado_em": string | null,"provider": Database["public"]['Enums']["media_provider"],"tentativas": number,"ultimo_erro": string | null
                  }
                  Insert: {
                    "asset_ref": string,"enfileirado_em"?: string,"id"?: string,"justification_id"?: string | null,"motivo": Database["public"]['Enums']["media_deletion_reason"],"payment_id"?: string | null,"processado_em"?: string | null,"provider": Database["public"]['Enums']["media_provider"],"tentativas"?: number,"ultimo_erro"?: string | null
                  }
                  Update: {
                    "asset_ref"?: string,"enfileirado_em"?: string,"id"?: string,"justification_id"?: string | null,"motivo"?: Database["public"]['Enums']["media_deletion_reason"],"payment_id"?: string | null,"processado_em"?: string | null,"provider"?: Database["public"]['Enums']["media_provider"],"tentativas"?: number,"ultimo_erro"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "media_deletion_queue_justification_id_fkey"
      columns: ["justification_id"]
isOneToOne: false
      referencedRelation: "absence_justifications"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "media_deletion_queue_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_deliveries": {
                  Row: {
                    "created_at": string,"device_id": string | null,"error_code": string | null,"expo_ticket_id": string | null,"id": string,"outbox_id": string,"receipt_checked_at": string | null,"ticket_status": string
                  }
                  Insert: {
                    "created_at"?: string,"device_id"?: string | null,"error_code"?: string | null,"expo_ticket_id"?: string | null,"id"?: string,"outbox_id": string,"receipt_checked_at"?: string | null,"ticket_status": string
                  }
                  Update: {
                    "created_at"?: string,"device_id"?: string | null,"error_code"?: string | null,"expo_ticket_id"?: string | null,"id"?: string,"outbox_id"?: string,"receipt_checked_at"?: string | null,"ticket_status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_deliveries_device_id_fkey"
      columns: ["device_id"]
isOneToOne: false
      referencedRelation: "push_devices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_deliveries_outbox_id_fkey"
      columns: ["outbox_id"]
isOneToOne: false
      referencedRelation: "notification_outbox"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_outbox": {
                  Row: {
                    "attempts": number,"claimed_at": string | null,"class_id": string | null,"created_at": string,"data": NonNullable<Json>,"dedupe_key": string,"id": string,"justification_id": string | null,"kind": Database["public"]['Enums']["notification_kind"],"last_error": string | null,"payment_id": string | null,"recipient_id": string,"send_after": string,"sent_at": string | null,"status": Database["public"]['Enums']["notification_status"]
                  }
                  Insert: {
                    "attempts"?: number,"claimed_at"?: string | null,"class_id"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"dedupe_key": string,"id"?: string,"justification_id"?: string | null,"kind": Database["public"]['Enums']["notification_kind"],"last_error"?: string | null,"payment_id"?: string | null,"recipient_id": string,"send_after"?: string,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["notification_status"]
                  }
                  Update: {
                    "attempts"?: number,"claimed_at"?: string | null,"class_id"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"dedupe_key"?: string,"id"?: string,"justification_id"?: string | null,"kind"?: Database["public"]['Enums']["notification_kind"],"last_error"?: string | null,"payment_id"?: string | null,"recipient_id"?: string,"send_after"?: string,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["notification_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_outbox_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_outbox_justification_id_fkey"
      columns: ["justification_id"]
isOneToOne: false
      referencedRelation: "absence_justifications"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_outbox_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_outbox_recipient_id_fkey"
      columns: ["recipient_id"]
isOneToOne: false
      referencedRelation: "diretorio_perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_outbox_recipient_id_fkey"
      columns: ["recipient_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount_cents": number,"created_at": string,"due_date": string,"id": string,"paid_at": string | null,"plan_id": string | null,"proof_provider": Database["public"]['Enums']["media_provider"] | null,"proof_public_id": string | null,"proof_storage_path": string | null,"proof_url": string | null,"reference_month": string,"status": Database["public"]['Enums']["payment_status"],"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "amount_cents"?: number,"created_at"?: string,"due_date": string,"id"?: string,"paid_at"?: string | null,"plan_id"?: string | null,"proof_provider"?: Database["public"]['Enums']["media_provider"] | null,"proof_public_id"?: string | null,"proof_storage_path"?: string | null,"proof_url"?: string | null,"reference_month": string,"status"?: Database["public"]['Enums']["payment_status"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "amount_cents"?: number,"created_at"?: string,"due_date"?: string,"id"?: string,"paid_at"?: string | null,"plan_id"?: string | null,"proof_provider"?: Database["public"]['Enums']["media_provider"] | null,"proof_public_id"?: string | null,"proof_storage_path"?: string | null,"proof_url"?: string | null,"reference_month"?: string,"status"?: Database["public"]['Enums']["payment_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "diretorio_perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"plan_periods": {
                  Row: {
                    "ended_at": string | null,"id": string,"plan_id": string,"started_at": string,"user_id": string
                  }
                  Insert: {
                    "ended_at"?: string | null,"id"?: string,"plan_id": string,"started_at": string,"user_id": string
                  }
                  Update: {
                    "ended_at"?: string | null,"id"?: string,"plan_id"?: string,"started_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "plan_periods_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "plan_periods_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "diretorio_perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "plan_periods_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"plans": {
                  Row: {
                    "billing_period": Database["public"]['Enums']["billing_period"],"created_at": string,"description": string | null,"due_day": number,"id": string,"is_active": boolean,"name": string,"price_cents": number,"schedule_mode": Database["public"]['Enums']["plan_schedule_mode"],"updated_at": string,"weekly_quota": number | null
                  }
                  Insert: {
                    "billing_period"?: Database["public"]['Enums']["billing_period"],"created_at"?: string,"description"?: string | null,"due_day"?: number,"id"?: string,"is_active"?: boolean,"name": string,"price_cents": number,"schedule_mode"?: Database["public"]['Enums']["plan_schedule_mode"],"updated_at"?: string,"weekly_quota"?: number | null
                  }
                  Update: {
                    "billing_period"?: Database["public"]['Enums']["billing_period"],"created_at"?: string,"description"?: string | null,"due_day"?: number,"id"?: string,"is_active"?: boolean,"name"?: string,"price_cents"?: number,"schedule_mode"?: Database["public"]['Enums']["plan_schedule_mode"],"updated_at"?: string,"weekly_quota"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "access_channel": string,"anonymized_at": string | null,"color": string | null,"cpf": string | null,"created_at": string,"deactivated_at": string | null,"dob": string | null,"group_id": string | null,"group_since": string | null,"id": string,"is_first_login": boolean,"name": string | null,"phone": string | null,"plan_id": string | null,"role": Database["public"]['Enums']["user_role"],"status": Database["public"]['Enums']["profile_status"],"updated_at": string
                  }
                  Insert: {
                    "access_channel"?: string,"anonymized_at"?: string | null,"color"?: string | null,"cpf"?: string | null,"created_at"?: string,"deactivated_at"?: string | null,"dob"?: string | null,"group_id"?: string | null,"group_since"?: string | null,"id": string,"is_first_login"?: boolean,"name"?: string | null,"phone"?: string | null,"plan_id"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"status"?: Database["public"]['Enums']["profile_status"],"updated_at"?: string
                  }
                  Update: {
                    "access_channel"?: string,"anonymized_at"?: string | null,"color"?: string | null,"cpf"?: string | null,"created_at"?: string,"deactivated_at"?: string | null,"dob"?: string | null,"group_id"?: string | null,"group_since"?: string | null,"id"?: string,"is_first_login"?: boolean,"name"?: string | null,"phone"?: string | null,"plan_id"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"status"?: Database["public"]['Enums']["profile_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profiles_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    }
                  ]
                },"push_devices": {
                  Row: {
                    "app_variant": Database["public"]['Enums']["app_variant"],"created_at": string,"expo_token": string,"id": string,"last_seen_at": string,"platform": Database["public"]['Enums']["push_platform"],"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "app_variant": Database["public"]['Enums']["app_variant"],"created_at"?: string,"expo_token": string,"id"?: string,"last_seen_at"?: string,"platform": Database["public"]['Enums']["push_platform"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "app_variant"?: Database["public"]['Enums']["app_variant"],"created_at"?: string,"expo_token"?: string,"id"?: string,"last_seen_at"?: string,"platform"?: Database["public"]['Enums']["push_platform"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_devices_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "diretorio_perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "push_devices_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"roll_call_requests": {
                  Row: {
                    "class_id": string,"created_at": string,"id": string,"kind": Database["public"]['Enums']["roll_call_request_kind"],"motivo_id": string,"requester_id": string | null,"review_note": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"status": Database["public"]['Enums']["justification_status"],"subject_id": string
                  }
                  Insert: {
                    "class_id": string,"created_at"?: string,"id"?: string,"kind": Database["public"]['Enums']["roll_call_request_kind"],"motivo_id": string,"requester_id"?: string | null,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["justification_status"],"subject_id": string
                  }
                  Update: {
                    "class_id"?: string,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["roll_call_request_kind"],"motivo_id"?: string,"requester_id"?: string | null,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["justification_status"],"subject_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "roll_call_requests_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "roll_call_requests_motivo_id_fkey"
      columns: ["motivo_id"]
isOneToOne: false
      referencedRelation: "action_reasons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "roll_call_requests_requester_id_fkey"
      columns: ["requester_id"]
isOneToOne: false
      referencedRelation: "diretorio_perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "roll_call_requests_requester_id_fkey"
      columns: ["requester_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "roll_call_requests_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "diretorio_perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "roll_call_requests_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "roll_call_requests_subject_id_fkey"
      columns: ["subject_id"]
isOneToOne: false
      referencedRelation: "diretorio_perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "roll_call_requests_subject_id_fkey"
      columns: ["subject_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"student_group_periods": {
                  Row: {
                    "end_reason": string | null,"ended_at": string | null,"group_id": string,"id": string,"start_reason": string,"started_at": string,"user_id": string
                  }
                  Insert: {
                    "end_reason"?: string | null,"ended_at"?: string | null,"group_id": string,"id"?: string,"start_reason": string,"started_at": string,"user_id": string
                  }
                  Update: {
                    "end_reason"?: string | null,"ended_at"?: string | null,"group_id"?: string,"id"?: string,"start_reason"?: string,"started_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "student_group_periods_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_group_periods_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "diretorio_perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_group_periods_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"weekly_goals": {
                  Row: {
                    "effective_week_start": string,"goal": number,"set_at": string,"set_by": string | null,"user_id": string
                  }
                  Insert: {
                    "effective_week_start": string,"goal": number,"set_at"?: string,"set_by"?: string | null,"user_id": string
                  }
                  Update: {
                    "effective_week_start"?: string,"goal"?: number,"set_at"?: string,"set_by"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "weekly_goals_set_by_fkey"
      columns: ["set_by"]
isOneToOne: false
      referencedRelation: "diretorio_perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "weekly_goals_set_by_fkey"
      columns: ["set_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "weekly_goals_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "diretorio_perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "weekly_goals_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "diretorio_perfis": {
                  Row: {
                    "color": string | null,"group_id": string | null,"id": string | null,"name": string | null,"role": Database["public"]['Enums']["user_role"] | null,"status": Database["public"]['Enums']["profile_status"] | null
                  }
                  Insert: {
                           "color"?: string | null,"group_id"?: string | null,"id"?: string | null,"name"?: string | null,"role"?: Database["public"]['Enums']["user_role"] | null,"status"?: Database["public"]['Enums']["profile_status"] | null
                         }
                        Update: {
                           "color"?: string | null,"group_id"?: string | null,"id"?: string | null,"name"?: string | null,"role"?: Database["public"]['Enums']["user_role"] | null,"status"?: Database["public"]['Enums']["profile_status"] | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "profiles_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "aceitar_documentos_legais":
{ Args: { "p_documentos": (string)[] }; Returns: number
                           },
"anonimizar_titular":
{ Args: { "p_solicitante": string,"p_user_id": string }; Returns: Json
                           },
"aulas_sem_chamada":
{ Args: { "p_referencia"?: string }; Returns: {
              "class_id": string,"date_time": string,"group_id": string,"title": string
            }[]
                           },
"concluir_chamada":
{ Args: { "p_class_id": string }; Returns: string
                           },
"contas_sem_primeiro_acesso":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"cota_da_semana":
{ Args: { "p_segunda": string,"p_user_id": string }; Returns: number
                           },
"definir_senha_padrao_da_academia":
{ Args: { "p_senha": string }; Returns: undefined
                           },
"disparar_envio_de_push":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"documentos_legais_pendentes":
{ Args: Record<PropertyKey, never>; Returns: {
              "id": string,"publicado_em": string,"tipo": Database["public"]['Enums']["legal_document_kind"],"versao": string
            }[]
                           },
"documentos_legais_vigentes":
{ Args: Record<PropertyKey, never>; Returns: {
              "aceito_em": string,"conteudo": string,"id": string,"publicado_em": string,"tipo": Database["public"]['Enums']["legal_document_kind"],"versao": string
            }[]
                           },
"eliminar_comprovantes_do_titular":
{ Args: { "p_user_id": string }; Returns: number
                           },
"email_do_usuario":
{ Args: { "p_user_id": string }; Returns: string
                           },
"email_ja_cadastrado":
{ Args: { "p_email": string,"p_exceto": string }; Returns: boolean
                           },
"encerrar_horario_da_grade":
{ Args: { "p_id": string,"p_ultimo_dia": string }; Returns: Json
                           },
"enfileirar_avisos_aula_sem_chamada":
{ Args: { "p_agora"?: string }; Returns: number
                           },
"enfileirar_comprovantes_expirados":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"enfileirar_lembretes_de_mensalidade":
{ Args: { "p_agora"?: string }; Returns: number
                           },
"enfileirar_notificacao":
{ Args: { "p_agora"?: string,"p_chave": string,"p_class_id"?: string,"p_data"?: Json,"p_destinatario": string,"p_justification_id"?: string,"p_payment_id"?: string,"p_tipo": Database["public"]['Enums']["notification_kind"] }; Returns: boolean
                           },
"enfileirar_resumo_aulas_sem_chamada":
{ Args: { "p_agora"?: string }; Returns: number
                           },
"excluir_turma":
{ Args: { "p_deixar_sem_turma"?: boolean,"p_destino"?: string,"p_group_id": string }; Returns: Json
                           },
"export_my_data":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"fechar_frequencia_do_mes":
{ Args: { "p_agora"?: string,"p_mes"?: string }; Returns: number
                           },
"frequencia_mensal":
{ Args: { "p_referencia"?: string,"p_user_ids": (string)[] }; Returns: {
              "attended": number,"counted_classes": number,"frequency_percent": number,"justified": number,"reference_month": string,"total_classes": number,"user_id": string
            }[]
                           },
"gerar_aulas_da_grade":
{ Args: { "p_agora"?: string,"p_schedule_id"?: string }; Returns: number
                           },
"gerar_mensalidades_do_mes":
{ Args: { "p_referencia"?: string }; Returns: number
                           },
"grade_efetiva_do_fixo":
{ Args: { "p_ate": string,"p_de": string,"p_user_ids": (string)[] }; Returns: {
              "class_id": string,"fonte": string,"user_id": string
            }[]
                           },
"horario_permitido_para_push":
{ Args: { "p_agora": string }; Returns: string
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_professor":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"limpar_notificacoes_antigas":
{ Args: { "p_agora"?: string }; Returns: number
                           },
"mark_overdue_payments":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"modalidade_da_semana":
{ Args: { "p_segunda": string,"p_user_id": string }; Returns: Database["public"]['Enums']["plan_schedule_mode"]
                           },
"ocorrencias_da_grade":
{ Args: { "p_agora": string,"p_schedule_id": string }; Returns: {
              "date_time": string,"group_id": string,"occurrence_date": string,"schedule_id": string,"title": string
            }[]
                           },
"painel_admin_resumo":
{ Args: { "p_referencia"?: string }; Returns: {
              "alunos_ativos": number,"alunos_ativos_sem_plano": number,"alunos_com_aula_no_mes": number,"alunos_com_aula_ultimo_mes": number,"alunos_inadimplentes": number,"alunos_inativos": number,"competencia": string,"em_aberto_cents": number,"em_analise_cents": number,"esperado_cents": number,"frequencia_media_mes": number,"frequencia_media_ultimo_mes": number,"inadimplencia_cents": number,"inadimplencia_contas_encerradas_cents": number,"mensalidades_pagas": number,"mensalidades_total": number,"recebido_cents": number,"saidas_no_mes": number,"ultimo_mes_fechado": string,"vencido_cents": number
            }[]
                           },
"painel_alunos_em_risco":
{ Args: { "p_limite_percent"?: number,"p_min_aulas"?: number,"p_referencia"?: string }; Returns: {
              "frequencia_mes_atual": number,"frequencia_ultimo_mes": number,"nome": string,"turma": string,"user_id": string
            }[]
                           },
"painel_faturamento_mensal":
{ Args: { "p_meses"?: number,"p_referencia"?: string }; Returns: {
              "esperado_cents": number,"pendente_cents": number,"recebido_cents": number,"reference_month": string
            }[]
                           },
"painel_inadimplencia_faixas":
{ Args: { "p_referencia"?: string }; Returns: {
              "faixa": string,"mensalidades": number,"ordem": number,"valor_cents": number
            }[]
                           },
"pendencias_de_recibo_push":
{ Args: { "p_limite": number }; Returns: {
              "delivery_id": string,"ticket_id": string
            }[]
                           },
"plano_da_semana":
{ Args: { "p_segunda": string,"p_user_id": string }; Returns: {
              "inicio_na_semana": string,"plan_id": string,"schedule_mode": Database["public"]['Enums']["plan_schedule_mode"],"weekly_quota": number
            }[]
                           },
"pode_decidir_troca":
{ Args: { "p_id": string }; Returns: boolean
                           },
"pode_ler_motivo":
{ Args: { "p_motivo_id": string }; Returns: boolean
                           },
"previa_exclusao_turma":
{ Args: { "p_group_id": string }; Returns: Json
                           },
"publicar_documento_legal":
{ Args: { "p_conteudo": string,"p_tipo": Database["public"]['Enums']["legal_document_kind"],"p_versao": string }; Returns: string
                           },
"publicar_documento_legal_do_modelo":
{ Args: { "p_tipo": Database["public"]['Enums']["legal_document_kind"],"p_versao": string }; Returns: string
                           },
"reativar_turma":
{ Args: { "p_group_id": string }; Returns: undefined
                           },
"registrar_dispositivo_push":
{ Args: { "p_plataforma": Database["public"]['Enums']["push_platform"],"p_token": string,"p_variante": Database["public"]['Enums']["app_variant"] }; Returns: string
                           },
"registrar_envio_de_push":
{ Args: { "p_entregas": Json }; Returns: undefined
                           },
"registrar_fatura_de_entrada":
{ Args: { "p_data": string,"p_user_id": string }; Returns: boolean
                           },
"registrar_recibos_de_push":
{ Args: { "p_recibos": Json }; Returns: undefined
                           },
"reivindicar_notificacoes":
{ Args: { "p_limite": number,"p_variante": Database["public"]['Enums']["app_variant"] }; Returns: {
              "class_date_time": string,"class_id": string,"class_title": string,"data": Json,"device_id": string,"expo_token": string,"justification_id": string,"kind": Database["public"]['Enums']["notification_kind"],"outbox_id": string,"payment_id": string,"recipient_id": string
            }[]
                           },
"relatorio_inadimplencia":
{ Args: { "p_referencia"?: string }; Returns: {
              "aluno_ativo": boolean,"maior_atraso_dias": number,"mensalidades": number,"nome": string,"total_devido_cents": number,"turma": string,"user_id": string,"vencimento_mais_antigo": string
            }[]
                           },
"renderizar_documento_legal":
{ Args: { "p_tipo": Database["public"]['Enums']["legal_document_kind"] }; Returns: {
              "conteudo": string,"faltando": (string)[]
            }[]
                           },
"salvar_chamada":
{ Args: { "p_ausentes": (string)[],"p_class_id": string,"p_presentes": (string)[] }; Returns: string
                           },
"salvar_horario_da_grade":
{ Args: { "p_group_id": string,"p_id"?: string,"p_start_time": string,"p_teacher_ids"?: (string)[],"p_title": string,"p_valid_from": string,"p_valid_until"?: string,"p_weekday": number }; Returns: Json
                           },
"saude_das_rotinas":
{ Args: { "p_referencia"?: string }; Returns: {
              "agenda": string,"falhas_24h": number,"rotina": string,"ultima_execucao": string,"ultimo_status": string
            }[]
                           },
"sem_repeticao":
{ Args: { "p_valores": (number)[] }; Returns: boolean
                           },
"senha_padrao_da_academia":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"valor_proporcional":
{ Args: { "dia_entrada": number,"dias_no_mes": number,"preco_cents": number }; Returns: number
                           }
          }
          Enums: {
            "action_reason_kind": "roll_call_edit"|"class_cancel"|"class_reactivate"|"request_evidence"|"class_swap_evidence","app_variant": "production"|"development","attendance_status": "present"|"absent","billing_period": "monthly"|"quarterly"|"semiannual"|"annual","class_audience": "fixed"|"free"|"both","class_swap_kind": "once"|"permanent","class_swap_status": "pending"|"approved"|"rejected"|"expired"|"cancelled","class_type": "routine"|"event","justification_scope": "class"|"week","justification_status": "pending"|"approved"|"rejected","legal_document_kind": "terms_of_use"|"privacy_policy","media_deletion_reason": "conta_excluida"|"comprovante_recusado"|"retencao_expirada"|"migrado_de_provedor"|"justificativa_removida"|"anexo_de_motivo_removido"|"anexo_expirado","media_provider": "supabase_storage"|"cloudinary","notification_kind": "mensalidade_vence_em_breve"|"mensalidade_vence_hoje"|"mensalidade_atrasada"|"comprovante_enviado"|"comprovante_aprovado"|"comprovante_recusado"|"justificativa_pendente"|"aula_sem_chamada"|"aulas_sem_chamada_resumo"|"aula_cancelada"|"aula_reativada"|"justificativa_aprovada"|"justificativa_negada"|"chamada_retificada"|"solicitacao_pendente"|"troca_pendente"|"troca_aprovada"|"troca_negada"|"troca_aprovada_equipe","notification_status": "pending"|"sending"|"sent"|"cancelled"|"failed","payment_status": "pending_approval"|"open"|"overdue"|"paid","plan_schedule_mode": "fixed"|"free"|"unlimited","profile_status": "active"|"inactive","push_platform": "android"|"ios","roll_call_request_kind": "student_was_present"|"teacher_was_present"|"teacher_absence"|"teacher_asks_edit"|"teacher_asks_inclusion","user_role": "user"|"admin"|"professor"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"storage": {
          Tables: {
            "buckets": {
                  Row: {
                    "allowed_mime_types": (string)[] | null,"avif_autodetection": boolean | null,"created_at": string | null,"file_size_limit": number | null,"id": string,"name": string,"owner": string | null,"owner_id": string | null,"public": boolean | null,"type": Database["storage"]['Enums']["buckettype"],"updated_at": string | null
                  }
                  Insert: {
                    "allowed_mime_types"?: (string)[] | null,"avif_autodetection"?: boolean | null,"created_at"?: string | null,"file_size_limit"?: number | null,"id": string,"name": string,"owner"?: string | null,"owner_id"?: string | null,"public"?: boolean | null,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string | null
                  }
                  Update: {
                    "allowed_mime_types"?: (string)[] | null,"avif_autodetection"?: boolean | null,"created_at"?: string | null,"file_size_limit"?: number | null,"id"?: string,"name"?: string,"owner"?: string | null,"owner_id"?: string | null,"public"?: boolean | null,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"buckets_analytics": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"format": string,"id": string,"name": string,"type": Database["storage"]['Enums']["buckettype"],"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"format"?: string,"id"?: string,"name": string,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"format"?: string,"id"?: string,"name"?: string,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"buckets_vectors": {
                  Row: {
                    "created_at": string,"id": string,"type": Database["storage"]['Enums']["buckettype"],"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"id": string,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"iceberg_namespaces": {
                  Row: {
                    "bucket_name": string,"catalog_id": string,"created_at": string,"id": string,"metadata": NonNullable<Json>,"name": string,"updated_at": string
                  }
                  Insert: {
                    "bucket_name": string,"catalog_id": string,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "bucket_name"?: string,"catalog_id"?: string,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "iceberg_namespaces_catalog_id_fkey"
      columns: ["catalog_id"]
isOneToOne: false
      referencedRelation: "buckets_analytics"
      referencedColumns: ["id"]
    }
                  ]
                },"iceberg_tables": {
                  Row: {
                    "bucket_name": string,"catalog_id": string,"created_at": string,"id": string,"location": string,"name": string,"namespace_id": string,"remote_table_id": string | null,"shard_id": string | null,"shard_key": string | null,"updated_at": string
                  }
                  Insert: {
                    "bucket_name": string,"catalog_id": string,"created_at"?: string,"id"?: string,"location": string,"name": string,"namespace_id": string,"remote_table_id"?: string | null,"shard_id"?: string | null,"shard_key"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "bucket_name"?: string,"catalog_id"?: string,"created_at"?: string,"id"?: string,"location"?: string,"name"?: string,"namespace_id"?: string,"remote_table_id"?: string | null,"shard_id"?: string | null,"shard_key"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "iceberg_tables_catalog_id_fkey"
      columns: ["catalog_id"]
isOneToOne: false
      referencedRelation: "buckets_analytics"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "iceberg_tables_namespace_id_fkey"
      columns: ["namespace_id"]
isOneToOne: false
      referencedRelation: "iceberg_namespaces"
      referencedColumns: ["id"]
    }
                  ]
                },"migrations": {
                  Row: {
                    "executed_at": string | null,"hash": string,"id": number,"name": string
                  }
                  Insert: {
                    "executed_at"?: string | null,"hash": string,"id": number,"name": string
                  }
                  Update: {
                    "executed_at"?: string | null,"hash"?: string,"id"?: number,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"objects": {
                  Row: {
                    "bucket_id": string | null,"created_at": string | null,"id": string,"last_accessed_at": string | null,"metadata": Json | null,"name": string | null,"owner": string | null,"owner_id": string | null,"path_tokens": (string)[] | null,"updated_at": string | null,"user_metadata": Json | null,"version": string | null
                  }
                  Insert: {
                    "bucket_id"?: string | null,"created_at"?: string | null,"id"?: string,"last_accessed_at"?: string | null,"metadata"?: Json | null,"name"?: string | null,"owner"?: string | null,"owner_id"?: string | null,"path_tokens"?: never,"updated_at"?: string | null,"user_metadata"?: Json | null,"version"?: string | null
                  }
                  Update: {
                    "bucket_id"?: string | null,"created_at"?: string | null,"id"?: string,"last_accessed_at"?: string | null,"metadata"?: Json | null,"name"?: string | null,"owner"?: string | null,"owner_id"?: string | null,"path_tokens"?: never,"updated_at"?: string | null,"user_metadata"?: Json | null,"version"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "objects_bucketId_fkey"
      columns: ["bucket_id"]
isOneToOne: false
      referencedRelation: "buckets"
      referencedColumns: ["id"]
    }
                  ]
                },"s3_multipart_uploads": {
                  Row: {
                    "bucket_id": string,"created_at": string,"id": string,"in_progress_size": number,"key": string,"metadata": Json | null,"owner_id": string | null,"upload_signature": string,"user_metadata": Json | null,"version": string
                  }
                  Insert: {
                    "bucket_id": string,"created_at"?: string,"id": string,"in_progress_size"?: number,"key": string,"metadata"?: Json | null,"owner_id"?: string | null,"upload_signature": string,"user_metadata"?: Json | null,"version": string
                  }
                  Update: {
                    "bucket_id"?: string,"created_at"?: string,"id"?: string,"in_progress_size"?: number,"key"?: string,"metadata"?: Json | null,"owner_id"?: string | null,"upload_signature"?: string,"user_metadata"?: Json | null,"version"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
      columns: ["bucket_id"]
isOneToOne: false
      referencedRelation: "buckets"
      referencedColumns: ["id"]
    }
                  ]
                },"s3_multipart_uploads_parts": {
                  Row: {
                    "bucket_id": string,"created_at": string,"etag": string,"id": string,"key": string,"owner_id": string | null,"part_number": number,"size": number,"upload_id": string,"version": string
                  }
                  Insert: {
                    "bucket_id": string,"created_at"?: string,"etag": string,"id"?: string,"key": string,"owner_id"?: string | null,"part_number": number,"size"?: number,"upload_id": string,"version": string
                  }
                  Update: {
                    "bucket_id"?: string,"created_at"?: string,"etag"?: string,"id"?: string,"key"?: string,"owner_id"?: string | null,"part_number"?: number,"size"?: number,"upload_id"?: string,"version"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
      columns: ["bucket_id"]
isOneToOne: false
      referencedRelation: "buckets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
      columns: ["upload_id"]
isOneToOne: false
      referencedRelation: "s3_multipart_uploads"
      referencedColumns: ["id"]
    }
                  ]
                },"vector_indexes": {
                  Row: {
                    "bucket_id": string,"created_at": string,"data_type": string,"dimension": number,"distance_metric": string,"id": string,"metadata_configuration": Json | null,"name": string,"updated_at": string
                  }
                  Insert: {
                    "bucket_id": string,"created_at"?: string,"data_type": string,"dimension": number,"distance_metric": string,"id"?: string,"metadata_configuration"?: Json | null,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "bucket_id"?: string,"created_at"?: string,"data_type"?: string,"dimension"?: number,"distance_metric"?: string,"id"?: string,"metadata_configuration"?: Json | null,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vector_indexes_bucket_id_fkey"
      columns: ["bucket_id"]
isOneToOne: false
      referencedRelation: "buckets_vectors"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "allow_any_operation":
{ Args: { "expected_operations": (string)[] }; Returns: boolean
                           },
"allow_only_operation":
{ Args: { "expected_operation": string }; Returns: boolean
                           },
"can_insert_object":
{ Args: { "bucketid": string,"metadata": Json,"name": string,"owner": string }; Returns: undefined
                           },
"extension":
{ Args: { "name": string }; Returns: string
                           },
"filename":
{ Args: { "name": string }; Returns: string
                           },
"foldername":
{ Args: { "name": string }; Returns: (string)[]
                           },
"get_common_prefix":
{ Args: { "p_delimiter": string,"p_key": string,"p_prefix": string }; Returns: string
                           },
"get_size_by_bucket":
{ Args: Record<PropertyKey, never>; Returns: {
              "bucket_id": string,"size": number
            }[]
                           },
"list_multipart_uploads_with_delimiter":
{ Args: { "bucket_id": string,"delimiter_param": string,"max_keys"?: number,"next_key_token"?: string,"next_upload_token"?: string,"prefix_param": string }; Returns: {
              "created_at": string,"id": string,"key": string
            }[]
                           },
"list_objects_with_delimiter":
{ Args: { "_bucket_id": string,"delimiter_param": string,"max_keys"?: number,"next_token"?: string,"prefix_param": string,"sort_order"?: string,"start_after"?: string }; Returns: {
              "created_at": string,"id": string,"last_accessed_at": string,"metadata": Json,"name": string,"updated_at": string
            }[]
                           },
"operation":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"search":
{ Args: { "bucketname": string,"levels"?: number,"limits"?: number,"offsets"?: number,"prefix": string,"search"?: string,"sortcolumn"?: string,"sortorder"?: string }; Returns: {
              "created_at": string,"id": string,"last_accessed_at": string,"metadata": Json,"name": string,"updated_at": string
            }[]
                           },
"search_by_timestamp":
{ Args: { "p_bucket_id": string,"p_level": number,"p_limit": number,"p_prefix": string,"p_sort_column": string,"p_sort_column_after": string,"p_sort_order": string,"p_start_after": string }; Returns: {
              "created_at": string,"id": string,"key": string,"last_accessed_at": string,"metadata": Json,"name": string,"updated_at": string
            }[]
                           },
"search_v2":
{ Args: { "bucket_name": string,"levels"?: number,"limits"?: number,"prefix": string,"sort_column"?: string,"sort_column_after"?: string,"sort_order"?: string,"start_after"?: string }; Returns: {
              "created_at": string,"id": string,"key": string,"last_accessed_at": string,"metadata": Json,"name": string,"updated_at": string
            }[]
                           }
          }
          Enums: {
            "buckettype": "STANDARD"|"ANALYTICS"|"VECTOR"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "action_reason_kind": ["roll_call_edit", "class_cancel", "class_reactivate", "request_evidence", "class_swap_evidence"],"app_variant": ["production", "development"],"attendance_status": ["present", "absent"],"billing_period": ["monthly", "quarterly", "semiannual", "annual"],"class_audience": ["fixed", "free", "both"],"class_swap_kind": ["once", "permanent"],"class_swap_status": ["pending", "approved", "rejected", "expired", "cancelled"],"class_type": ["routine", "event"],"justification_scope": ["class", "week"],"justification_status": ["pending", "approved", "rejected"],"legal_document_kind": ["terms_of_use", "privacy_policy"],"media_deletion_reason": ["conta_excluida", "comprovante_recusado", "retencao_expirada", "migrado_de_provedor", "justificativa_removida", "anexo_de_motivo_removido", "anexo_expirado"],"media_provider": ["supabase_storage", "cloudinary"],"notification_kind": ["mensalidade_vence_em_breve", "mensalidade_vence_hoje", "mensalidade_atrasada", "comprovante_enviado", "comprovante_aprovado", "comprovante_recusado", "justificativa_pendente", "aula_sem_chamada", "aulas_sem_chamada_resumo", "aula_cancelada", "aula_reativada", "justificativa_aprovada", "justificativa_negada", "chamada_retificada", "solicitacao_pendente", "troca_pendente", "troca_aprovada", "troca_negada", "troca_aprovada_equipe"],"notification_status": ["pending", "sending", "sent", "cancelled", "failed"],"payment_status": ["pending_approval", "open", "overdue", "paid"],"plan_schedule_mode": ["fixed", "free", "unlimited"],"profile_status": ["active", "inactive"],"push_platform": ["android", "ios"],"roll_call_request_kind": ["student_was_present", "teacher_was_present", "teacher_absence", "teacher_asks_edit", "teacher_asks_inclusion"],"user_role": ["user", "admin", "professor"]
          }
        },"storage": {
          Enums: {
            "buckettype": ["STANDARD", "ANALYTICS", "VECTOR"]
          }
        }
} as const

