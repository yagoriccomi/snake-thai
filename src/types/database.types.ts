export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      absence_justifications: {
        Row: {
          class_id: string
          created_at: string
          id: string
          message: string | null
          proof_provider: Database["public"]["Enums"]["media_provider"] | null
          proof_public_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["justification_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          message?: string | null
          proof_provider?: Database["public"]["Enums"]["media_provider"] | null
          proof_public_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["justification_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          message?: string | null
          proof_provider?: Database["public"]["Enums"]["media_provider"] | null
          proof_public_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["justification_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "absence_justifications_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_justifications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "diretorio_perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_justifications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_justifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "diretorio_perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_justifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_secrets: {
        Row: {
          default_student_password: string
          id: boolean
          updated_at: string
        }
        Insert: {
          default_student_password: string
          id?: boolean
          updated_at?: string
        }
        Update: {
          default_student_password?: string
          id?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      academy_settings: {
        Row: {
          academy_name: string
          address: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          default_due_day: number
          default_plan_id: string | null
          default_student_password: string
          id: boolean
          logo_url: string | null
          pix_holder_name: string | null
          pix_key: string | null
          primary_color: string
          proof_retention_days: number | null
          updated_at: string
        }
        Insert: {
          academy_name?: string
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          default_due_day?: number
          default_plan_id?: string | null
          default_student_password?: string
          id?: boolean
          logo_url?: string | null
          pix_holder_name?: string | null
          pix_key?: string | null
          primary_color?: string
          proof_retention_days?: number | null
          updated_at?: string
        }
        Update: {
          academy_name?: string
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          default_due_day?: number
          default_plan_id?: string | null
          default_student_password?: string
          id?: boolean
          logo_url?: string | null
          pix_holder_name?: string | null
          pix_key?: string | null
          primary_color?: string
          proof_retention_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_settings_default_plan_id_fkey"
            columns: ["default_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          class_id: string
          created_at: string
          declared_status:
            | Database["public"]["Enums"]["attendance_status"]
            | null
          id: string
          status: Database["public"]["Enums"]["attendance_status"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          declared_status?:
            | Database["public"]["Enums"]["attendance_status"]
            | null
          id?: string
          status?: Database["public"]["Enums"]["attendance_status"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          declared_status?:
            | Database["public"]["Enums"]["attendance_status"]
            | null
          id?: string
          status?: Database["public"]["Enums"]["attendance_status"] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "diretorio_perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_monthly: {
        Row: {
          attended: number
          closed_at: string
          counted_classes: number
          frequency_percent: number
          group_id: string | null
          id: string
          justified: number
          reference_month: string
          total_classes: number
          user_id: string
        }
        Insert: {
          attended: number
          closed_at?: string
          counted_classes: number
          frequency_percent: number
          group_id?: string | null
          id?: string
          justified: number
          reference_month: string
          total_classes: number
          user_id: string
        }
        Update: {
          attended?: number
          closed_at?: string
          counted_classes?: number
          frequency_percent?: number
          group_id?: string | null
          id?: string
          justified?: number
          reference_month?: string
          total_classes?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_monthly_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_monthly_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "diretorio_perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_monthly_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          changes: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          changes?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: never
        }
        Update: {
          action?: string
          actor_id?: string | null
          changes?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: never
        }
        Relationships: []
      }
      class_schedule_skips: {
        Row: {
          created_at: string
          occurrence_date: string
          schedule_id: string
        }
        Insert: {
          created_at?: string
          occurrence_date: string
          schedule_id: string
        }
        Update: {
          created_at?: string
          occurrence_date?: string
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_schedule_skips_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "class_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      class_schedule_teachers: {
        Row: {
          created_at: string
          schedule_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          schedule_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          schedule_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_schedule_teachers_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "class_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedule_teachers_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "diretorio_perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedule_teachers_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_schedules: {
        Row: {
          created_at: string
          created_by: string | null
          group_id: string
          id: string
          start_time: string
          title: string
          updated_at: string
          valid_from: string
          valid_until: string | null
          weekday: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          group_id: string
          id?: string
          start_time: string
          title: string
          updated_at?: string
          valid_from: string
          valid_until?: string | null
          weekday: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          group_id?: string
          id?: string
          start_time?: string
          title?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "diretorio_perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedules_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      class_teachers: {
        Row: {
          class_id: string
          created_at: string
          teacher_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          teacher_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_teachers_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_teachers_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "diretorio_perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_teachers_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          attendance_taken_at: string | null
          created_at: string
          date_time: string
          group_id: string | null
          id: string
          occurrence_date: string | null
          schedule_detached: boolean
          schedule_id: string | null
          title: string
          type: Database["public"]["Enums"]["class_type"]
          updated_at: string
        }
        Insert: {
          attendance_taken_at?: string | null
          created_at?: string
          date_time: string
          group_id?: string | null
          id?: string
          occurrence_date?: string | null
          schedule_detached?: boolean
          schedule_id?: string | null
          title: string
          type?: Database["public"]["Enums"]["class_type"]
          updated_at?: string
        }
        Update: {
          attendance_taken_at?: string | null
          created_at?: string
          date_time?: string
          group_id?: string | null
          id?: string
          occurrence_date?: string | null
          schedule_detached?: boolean
          schedule_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["class_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "class_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          accepted_at: string
          document_id: string
          id: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          document_id: string
          id?: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          document_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      legal_documents: {
        Row: {
          content: string
          id: string
          is_current: boolean
          kind: Database["public"]["Enums"]["legal_document_kind"]
          published_at: string
          version: string
        }
        Insert: {
          content: string
          id?: string
          is_current?: boolean
          kind: Database["public"]["Enums"]["legal_document_kind"]
          published_at?: string
          version: string
        }
        Update: {
          content?: string
          id?: string
          is_current?: boolean
          kind?: Database["public"]["Enums"]["legal_document_kind"]
          published_at?: string
          version?: string
        }
        Relationships: []
      }
      media_deletion_queue: {
        Row: {
          asset_ref: string
          enfileirado_em: string
          id: string
          justification_id: string | null
          motivo: Database["public"]["Enums"]["media_deletion_reason"]
          payment_id: string | null
          processado_em: string | null
          provider: Database["public"]["Enums"]["media_provider"]
          tentativas: number
          ultimo_erro: string | null
        }
        Insert: {
          asset_ref: string
          enfileirado_em?: string
          id?: string
          justification_id?: string | null
          motivo: Database["public"]["Enums"]["media_deletion_reason"]
          payment_id?: string | null
          processado_em?: string | null
          provider: Database["public"]["Enums"]["media_provider"]
          tentativas?: number
          ultimo_erro?: string | null
        }
        Update: {
          asset_ref?: string
          enfileirado_em?: string
          id?: string
          justification_id?: string | null
          motivo?: Database["public"]["Enums"]["media_deletion_reason"]
          payment_id?: string | null
          processado_em?: string | null
          provider?: Database["public"]["Enums"]["media_provider"]
          tentativas?: number
          ultimo_erro?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_deletion_queue_justification_id_fkey"
            columns: ["justification_id"]
            isOneToOne: false
            referencedRelation: "absence_justifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_deletion_queue_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          created_at: string
          device_id: string | null
          error_code: string | null
          expo_ticket_id: string | null
          id: string
          outbox_id: string
          receipt_checked_at: string | null
          ticket_status: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          error_code?: string | null
          expo_ticket_id?: string | null
          id?: string
          outbox_id: string
          receipt_checked_at?: string | null
          ticket_status: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          error_code?: string | null
          expo_ticket_id?: string | null
          id?: string
          outbox_id?: string
          receipt_checked_at?: string | null
          ticket_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "push_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_outbox_id_fkey"
            columns: ["outbox_id"]
            isOneToOne: false
            referencedRelation: "notification_outbox"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_outbox: {
        Row: {
          attempts: number
          claimed_at: string | null
          class_id: string | null
          created_at: string
          data: Json
          dedupe_key: string
          id: string
          justification_id: string | null
          kind: Database["public"]["Enums"]["notification_kind"]
          last_error: string | null
          payment_id: string | null
          recipient_id: string
          send_after: string
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
        }
        Insert: {
          attempts?: number
          claimed_at?: string | null
          class_id?: string | null
          created_at?: string
          data?: Json
          dedupe_key: string
          id?: string
          justification_id?: string | null
          kind: Database["public"]["Enums"]["notification_kind"]
          last_error?: string | null
          payment_id?: string | null
          recipient_id: string
          send_after?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
        }
        Update: {
          attempts?: number
          claimed_at?: string | null
          class_id?: string | null
          created_at?: string
          data?: Json
          dedupe_key?: string
          id?: string
          justification_id?: string | null
          kind?: Database["public"]["Enums"]["notification_kind"]
          last_error?: string | null
          payment_id?: string | null
          recipient_id?: string
          send_after?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_outbox_justification_id_fkey"
            columns: ["justification_id"]
            isOneToOne: false
            referencedRelation: "absence_justifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_outbox_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_outbox_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "diretorio_perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_outbox_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          due_date: string
          id: string
          paid_at: string | null
          plan_id: string | null
          proof_provider: Database["public"]["Enums"]["media_provider"] | null
          proof_public_id: string | null
          proof_storage_path: string | null
          proof_url: string | null
          reference_month: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          due_date: string
          id?: string
          paid_at?: string | null
          plan_id?: string | null
          proof_provider?: Database["public"]["Enums"]["media_provider"] | null
          proof_public_id?: string | null
          proof_storage_path?: string | null
          proof_url?: string | null
          reference_month: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          due_date?: string
          id?: string
          paid_at?: string | null
          plan_id?: string | null
          proof_provider?: Database["public"]["Enums"]["media_provider"] | null
          proof_public_id?: string | null
          proof_storage_path?: string | null
          proof_url?: string | null
          reference_month?: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "diretorio_perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          billing_period: Database["public"]["Enums"]["billing_period"]
          created_at: string
          description: string | null
          due_day: number
          id: string
          is_active: boolean
          name: string
          price_cents: number
          updated_at: string
        }
        Insert: {
          billing_period?: Database["public"]["Enums"]["billing_period"]
          created_at?: string
          description?: string | null
          due_day?: number
          id?: string
          is_active?: boolean
          name: string
          price_cents: number
          updated_at?: string
        }
        Update: {
          billing_period?: Database["public"]["Enums"]["billing_period"]
          created_at?: string
          description?: string | null
          due_day?: number
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          anonymized_at: string | null
          color: string | null
          cpf: string | null
          created_at: string
          deactivated_at: string | null
          dob: string | null
          group_id: string | null
          id: string
          is_first_login: boolean
          name: string | null
          phone: string | null
          plan_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["profile_status"]
          updated_at: string
        }
        Insert: {
          anonymized_at?: string | null
          color?: string | null
          cpf?: string | null
          created_at?: string
          deactivated_at?: string | null
          dob?: string | null
          group_id?: string | null
          id: string
          is_first_login?: boolean
          name?: string | null
          phone?: string | null
          plan_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Update: {
          anonymized_at?: string | null
          color?: string | null
          cpf?: string | null
          created_at?: string
          deactivated_at?: string | null
          dob?: string | null
          group_id?: string | null
          id?: string
          is_first_login?: boolean
          name?: string | null
          phone?: string | null
          plan_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      push_devices: {
        Row: {
          app_variant: Database["public"]["Enums"]["app_variant"]
          created_at: string
          expo_token: string
          id: string
          last_seen_at: string
          platform: Database["public"]["Enums"]["push_platform"]
          updated_at: string
          user_id: string
        }
        Insert: {
          app_variant: Database["public"]["Enums"]["app_variant"]
          created_at?: string
          expo_token: string
          id?: string
          last_seen_at?: string
          platform: Database["public"]["Enums"]["push_platform"]
          updated_at?: string
          user_id: string
        }
        Update: {
          app_variant?: Database["public"]["Enums"]["app_variant"]
          created_at?: string
          expo_token?: string
          id?: string
          last_seen_at?: string
          platform?: Database["public"]["Enums"]["push_platform"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "diretorio_perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      diretorio_perfis: {
        Row: {
          color: string | null
          group_id: string | null
          id: string | null
          name: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          status: Database["public"]["Enums"]["profile_status"] | null
        }
        Insert: {
          color?: string | null
          group_id?: string | null
          id?: string | null
          name?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          status?: Database["public"]["Enums"]["profile_status"] | null
        }
        Update: {
          color?: string | null
          group_id?: string | null
          id?: string | null
          name?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          status?: Database["public"]["Enums"]["profile_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      anonimizar_titular: {
        Args: { p_solicitante: string; p_user_id: string }
        Returns: Json
      }
      aulas_sem_chamada: {
        Args: { p_referencia?: string }
        Returns: {
          class_id: string
          date_time: string
          group_id: string
          title: string
        }[]
      }
      concluir_chamada: { Args: { p_class_id: string }; Returns: string }
      contas_sem_primeiro_acesso: { Args: never; Returns: number }
      definir_senha_padrao_da_academia: {
        Args: { p_senha: string }
        Returns: undefined
      }
      disparar_envio_de_push: { Args: never; Returns: undefined }
      eliminar_comprovantes_do_titular: {
        Args: { p_user_id: string }
        Returns: number
      }
      email_do_usuario: { Args: { p_user_id: string }; Returns: string }
      email_ja_cadastrado: {
        Args: { p_email: string; p_exceto: string }
        Returns: boolean
      }
      encerrar_horario_da_grade: {
        Args: { p_id: string; p_ultimo_dia: string }
        Returns: Json
      }
      enfileirar_avisos_aula_sem_chamada: {
        Args: { p_agora?: string }
        Returns: number
      }
      enfileirar_comprovantes_expirados: { Args: never; Returns: number }
      enfileirar_lembretes_de_mensalidade: {
        Args: { p_agora?: string }
        Returns: number
      }
      enfileirar_notificacao: {
        Args: {
          p_agora?: string
          p_chave: string
          p_class_id?: string
          p_data?: Json
          p_destinatario: string
          p_justification_id?: string
          p_payment_id?: string
          p_tipo: Database["public"]["Enums"]["notification_kind"]
        }
        Returns: boolean
      }
      enfileirar_resumo_aulas_sem_chamada: {
        Args: { p_agora?: string }
        Returns: number
      }
      excluir_turma: {
        Args: {
          p_deixar_sem_turma?: boolean
          p_destino?: string
          p_group_id: string
        }
        Returns: Json
      }
      export_my_data: { Args: never; Returns: Json }
      fechar_frequencia_do_mes: {
        Args: { p_agora?: string; p_mes?: string }
        Returns: number
      }
      frequencia_mensal: {
        Args: { p_referencia?: string; p_user_ids: string[] }
        Returns: {
          attended: number
          counted_classes: number
          frequency_percent: number
          justified: number
          reference_month: string
          total_classes: number
          user_id: string
        }[]
      }
      gerar_aulas_da_grade: {
        Args: { p_agora?: string; p_schedule_id?: string }
        Returns: number
      }
      gerar_mensalidades_do_mes: {
        Args: { p_referencia?: string }
        Returns: number
      }
      horario_permitido_para_push: {
        Args: { p_agora: string }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      is_professor: { Args: never; Returns: boolean }
      limpar_notificacoes_antigas: {
        Args: { p_agora?: string }
        Returns: number
      }
      mark_overdue_payments: { Args: never; Returns: undefined }
      ocorrencias_da_grade: {
        Args: { p_agora: string; p_schedule_id: string }
        Returns: {
          date_time: string
          group_id: string
          occurrence_date: string
          schedule_id: string
          title: string
        }[]
      }
      painel_admin_resumo: {
        Args: { p_referencia?: string }
        Returns: {
          alunos_ativos: number
          alunos_ativos_sem_plano: number
          alunos_com_aula_no_mes: number
          alunos_com_aula_ultimo_mes: number
          alunos_inadimplentes: number
          alunos_inativos: number
          competencia: string
          em_aberto_cents: number
          em_analise_cents: number
          esperado_cents: number
          frequencia_media_mes: number
          frequencia_media_ultimo_mes: number
          inadimplencia_cents: number
          inadimplencia_contas_encerradas_cents: number
          mensalidades_pagas: number
          mensalidades_total: number
          recebido_cents: number
          saidas_no_mes: number
          ultimo_mes_fechado: string
          vencido_cents: number
        }[]
      }
      painel_alunos_em_risco: {
        Args: {
          p_limite_percent?: number
          p_min_aulas?: number
          p_referencia?: string
        }
        Returns: {
          frequencia_mes_atual: number
          frequencia_ultimo_mes: number
          nome: string
          turma: string
          user_id: string
        }[]
      }
      painel_faturamento_mensal: {
        Args: { p_meses?: number; p_referencia?: string }
        Returns: {
          esperado_cents: number
          pendente_cents: number
          recebido_cents: number
          reference_month: string
        }[]
      }
      painel_inadimplencia_faixas: {
        Args: { p_referencia?: string }
        Returns: {
          faixa: string
          mensalidades: number
          ordem: number
          valor_cents: number
        }[]
      }
      pendencias_de_recibo_push: {
        Args: { p_limite: number }
        Returns: {
          delivery_id: string
          ticket_id: string
        }[]
      }
      previa_exclusao_turma: { Args: { p_group_id: string }; Returns: Json }
      reativar_turma: { Args: { p_group_id: string }; Returns: undefined }
      registrar_dispositivo_push: {
        Args: {
          p_plataforma: Database["public"]["Enums"]["push_platform"]
          p_token: string
          p_variante: Database["public"]["Enums"]["app_variant"]
        }
        Returns: string
      }
      registrar_envio_de_push: {
        Args: { p_entregas: Json }
        Returns: undefined
      }
      registrar_fatura_de_entrada: {
        Args: { p_data: string; p_user_id: string }
        Returns: boolean
      }
      registrar_recibos_de_push: {
        Args: { p_recibos: Json }
        Returns: undefined
      }
      reivindicar_notificacoes: {
        Args: {
          p_limite: number
          p_variante: Database["public"]["Enums"]["app_variant"]
        }
        Returns: {
          class_date_time: string
          class_id: string
          class_title: string
          data: Json
          device_id: string
          expo_token: string
          justification_id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          outbox_id: string
          payment_id: string
          recipient_id: string
        }[]
      }
      relatorio_inadimplencia: {
        Args: { p_referencia?: string }
        Returns: {
          aluno_ativo: boolean
          maior_atraso_dias: number
          mensalidades: number
          nome: string
          total_devido_cents: number
          turma: string
          user_id: string
          vencimento_mais_antigo: string
        }[]
      }
      salvar_chamada: {
        Args: {
          p_ausentes: string[]
          p_class_id: string
          p_presentes: string[]
        }
        Returns: string
      }
      salvar_horario_da_grade: {
        Args: {
          p_group_id: string
          p_id?: string
          p_start_time: string
          p_teacher_ids?: string[]
          p_title: string
          p_valid_from: string
          p_valid_until?: string
          p_weekday: number
        }
        Returns: Json
      }
      senha_padrao_da_academia: { Args: never; Returns: string }
      valor_proporcional: {
        Args: { dia_entrada: number; dias_no_mes: number; preco_cents: number }
        Returns: number
      }
    }
    Enums: {
      app_variant: "production" | "development"
      attendance_status: "present" | "absent"
      billing_period: "monthly" | "quarterly" | "semiannual" | "annual"
      class_type: "routine" | "event"
      justification_status: "pending" | "approved" | "rejected"
      legal_document_kind: "terms_of_use" | "privacy_policy"
      media_deletion_reason:
        | "conta_excluida"
        | "comprovante_recusado"
        | "retencao_expirada"
        | "migrado_de_provedor"
        | "justificativa_removida"
      media_provider: "supabase_storage" | "cloudinary"
      notification_kind:
        | "mensalidade_vence_em_breve"
        | "mensalidade_vence_hoje"
        | "mensalidade_atrasada"
        | "comprovante_enviado"
        | "comprovante_aprovado"
        | "comprovante_recusado"
        | "justificativa_pendente"
        | "aula_sem_chamada"
        | "aulas_sem_chamada_resumo"
      notification_status:
        | "pending"
        | "sending"
        | "sent"
        | "cancelled"
        | "failed"
      payment_status: "pending_approval" | "open" | "overdue" | "paid"
      profile_status: "active" | "inactive"
      push_platform: "android" | "ios"
      user_role: "user" | "admin" | "professor"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      iceberg_namespaces: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_namespaces_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      iceberg_tables: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          location: string
          name: string
          namespace_id: string
          remote_table_id: string | null
          shard_id: string | null
          shard_key: string | null
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          location: string
          name: string
          namespace_id: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          namespace_id?: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_tables_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iceberg_tables_namespace_id_fkey"
            columns: ["namespace_id"]
            isOneToOne: false
            referencedRelation: "iceberg_namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          metadata: Json | null
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] }
        Returns: boolean
      }
      allow_only_operation: {
        Args: { expected_operation: string }
        Returns: boolean
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_variant: ["production", "development"],
      attendance_status: ["present", "absent"],
      billing_period: ["monthly", "quarterly", "semiannual", "annual"],
      class_type: ["routine", "event"],
      justification_status: ["pending", "approved", "rejected"],
      legal_document_kind: ["terms_of_use", "privacy_policy"],
      media_deletion_reason: [
        "conta_excluida",
        "comprovante_recusado",
        "retencao_expirada",
        "migrado_de_provedor",
        "justificativa_removida",
      ],
      media_provider: ["supabase_storage", "cloudinary"],
      notification_kind: [
        "mensalidade_vence_em_breve",
        "mensalidade_vence_hoje",
        "mensalidade_atrasada",
        "comprovante_enviado",
        "comprovante_aprovado",
        "comprovante_recusado",
        "justificativa_pendente",
        "aula_sem_chamada",
        "aulas_sem_chamada_resumo",
      ],
      notification_status: [
        "pending",
        "sending",
        "sent",
        "cancelled",
        "failed",
      ],
      payment_status: ["pending_approval", "open", "overdue", "paid"],
      profile_status: ["active", "inactive"],
      push_platform: ["android", "ios"],
      user_role: ["user", "admin", "professor"],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const

