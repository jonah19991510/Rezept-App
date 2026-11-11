// Automatisch aus dem Supabase-Schema generiert (Supabase „generate types“).
// Nach jeder Migration neu erzeugen, nicht von Hand ändern.

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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      workout_posts: {
        Row: {
          body: string | null
          created_at: string
          id: string
          summary: Json
          trained_at: string
          updated_at: string
          user_id: string
          workout_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          summary: Json
          trained_at: string
          updated_at?: string
          user_id?: string
          workout_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          summary?: Json
          trained_at?: string
          updated_at?: string
          user_id?: string
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_posts_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: true
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_kudos: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_kudos_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "workout_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_kudos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id: string
          user_id?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "workout_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          backfill_days: number
          color: string
          created_at: string
          created_by: string | null
          daily_target: number | null
          days_per_week: number | null
          description: string | null
          duration_days: number
          extra_rules: string | null
          frequency: string
          icon: string
          id: string
          is_public: boolean
          jokers: number
          late_join_days: number
          metric: string
          min_periods: number | null
          missed_rule: string
          period_kind: string
          repeats: boolean
          source: string
          start_mode: string
          starts_on: string | null
          title: string
          total_target: number | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          backfill_days?: number
          color: string
          created_at?: string
          created_by?: string | null
          daily_target?: number | null
          days_per_week?: number | null
          description?: string | null
          duration_days: number
          extra_rules?: string | null
          frequency?: string
          icon: string
          id?: string
          is_public?: boolean
          jokers?: number
          late_join_days?: number
          metric: string
          min_periods?: number | null
          missed_rule?: string
          period_kind?: string
          repeats?: boolean
          source?: string
          start_mode: string
          starts_on?: string | null
          title: string
          total_target?: number | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          backfill_days?: number
          color?: string
          created_at?: string
          created_by?: string | null
          daily_target?: number | null
          days_per_week?: number | null
          description?: string | null
          duration_days?: number
          extra_rules?: string | null
          frequency?: string
          icon?: string
          id?: string
          is_public?: boolean
          jokers?: number
          late_join_days?: number
          metric?: string
          min_periods?: number | null
          missed_rule?: string
          period_kind?: string
          repeats?: boolean
          source?: string
          start_mode?: string
          starts_on?: string | null
          title?: string
          total_target?: number | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_participants: {
        Row: {
          challenge_id: string
          joined_at: string
          start_date: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          joined_at?: string
          start_date?: string
          user_id?: string
        }
        Update: {
          challenge_id?: string
          joined_at?: string
          start_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_participants_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_entries: {
        Row: {
          challenge_id: string
          created_at: string
          day: string
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          challenge_id: string
          created_at?: string
          day: string
          updated_at?: string
          user_id?: string
          value: number
        }
        Update: {
          challenge_id?: string
          created_at?: string
          day?: string
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "challenge_entries_challenge_id_user_id_fkey"
            columns: ["challenge_id", "user_id"]
            isOneToOne: false
            referencedRelation: "challenge_participants"
            referencedColumns: ["challenge_id", "user_id"]
          },
        ]
      }
      lexicon_categories: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          parent_id: string | null
          position: number
          updated_at: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          position?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lexicon_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "lexicon_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      lexicon_entries: {
        Row: {
          blocks: Json
          created_at: string
          created_by: string | null
          facts: Json
          id: string
          is_public: boolean
          keywords: string[]
          source: string | null
          term: string
          updated_at: string
        }
        Insert: {
          blocks?: Json
          created_at?: string
          created_by?: string | null
          facts?: Json
          id?: string
          is_public?: boolean
          keywords?: string[]
          source?: string | null
          term: string
          updated_at?: string
        }
        Update: {
          blocks?: Json
          created_at?: string
          created_by?: string | null
          facts?: Json
          id?: string
          is_public?: boolean
          keywords?: string[]
          source?: string | null
          term?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lexicon_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lexicon_entry_categories: {
        Row: {
          category_id: string
          entry_id: string
        }
        Insert: {
          category_id: string
          entry_id: string
        }
        Update: {
          category_id?: string
          entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lexicon_entry_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "lexicon_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lexicon_entry_categories_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "lexicon_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      supplements: {
        Row: {
          active: boolean
          brand: string | null
          created_at: string
          form: string
          id: string
          ingredients: Json
          name: string
          note: string | null
          pack_amount: number | null
          price_eur: number | null
          serving_amount: number
          serving_label: string | null
          servings_per_day: number
          servings_per_pack: number | null
          shop: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          brand?: string | null
          created_at?: string
          form?: string
          id?: string
          ingredients?: Json
          name: string
          note?: string | null
          pack_amount?: number | null
          price_eur?: number | null
          serving_amount?: number
          serving_label?: string | null
          servings_per_day?: number
          servings_per_pack?: number | null
          shop?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          active?: boolean
          brand?: string | null
          created_at?: string
          form?: string
          id?: string
          ingredients?: Json
          name?: string
          note?: string | null
          pack_amount?: number | null
          price_eur?: number | null
          serving_amount?: number
          serving_label?: string | null
          servings_per_day?: number
          servings_per_pack?: number | null
          shop?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blood_tests: {
        Row: {
          created_at: string
          id: string
          lab: string | null
          note: string | null
          results: Json
          taken_on: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lab?: string | null
          note?: string | null
          results?: Json
          taken_on: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          lab?: string | null
          note?: string | null
          results?: Json
          taken_on?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blood_tests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sick_episodes: {
        Row: {
          created_at: string
          ended_on: string | null
          id: string
          note: string | null
          sick_note: boolean
          started_on: string
          symptoms: string[]
          temperatures: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_on?: string | null
          id?: string
          note?: string | null
          sick_note?: boolean
          started_on: string
          symptoms?: string[]
          temperatures?: Json
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          ended_on?: string | null
          id?: string
          note?: string | null
          sick_note?: boolean
          started_on?: string
          symptoms?: string[]
          temperatures?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sick_episodes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_intakes: {
        Row: {
          created_at: string
          dose: string | null
          episode_id: string | null
          id: string
          name: string
          note: string | null
          reason: string | null
          taken_on: string
          taken_time: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dose?: string | null
          episode_id?: string | null
          id?: string
          name: string
          note?: string | null
          reason?: string | null
          taken_on: string
          taken_time?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          dose?: string | null
          episode_id?: string | null
          id?: string
          name?: string
          note?: string | null
          reason?: string | null
          taken_on?: string
          taken_time?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_intakes_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "sick_episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_intakes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checkups: {
        Row: {
          created_at: string
          doctor: string | null
          id: string
          interval_months: number | null
          name: string
          next_on: string | null
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          doctor?: string | null
          id?: string
          interval_months?: number | null
          name: string
          next_on?: string | null
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          doctor?: string | null
          id?: string
          interval_months?: number | null
          name?: string
          next_on?: string | null
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkups_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checkup_visits: {
        Row: {
          checkup_id: string
          created_at: string
          id: string
          note: string | null
          user_id: string
          visited_on: string
        }
        Insert: {
          checkup_id: string
          created_at?: string
          id?: string
          note?: string | null
          user_id?: string
          visited_on: string
        }
        Update: {
          checkup_id?: string
          created_at?: string
          id?: string
          note?: string | null
          user_id?: string
          visited_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkup_visits_checkup_id_fkey"
            columns: ["checkup_id"]
            isOneToOne: false
            referencedRelation: "checkups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkup_visits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      body_measurements: {
        Row: {
          belly_cm: number | null
          calf_cm: number | null
          chest_cm: number | null
          created_at: string
          hip_cm: number | null
          id: string
          measured_on: string
          neck_cm: number | null
          note: string | null
          shoulder_cm: number | null
          thigh_cm: number | null
          updated_at: string
          upper_arm_cm: number | null
          user_id: string
          waist_cm: number | null
          weight_kg: number | null
        }
        Insert: {
          belly_cm?: number | null
          calf_cm?: number | null
          chest_cm?: number | null
          created_at?: string
          hip_cm?: number | null
          id?: string
          measured_on: string
          neck_cm?: number | null
          note?: string | null
          shoulder_cm?: number | null
          thigh_cm?: number | null
          updated_at?: string
          upper_arm_cm?: number | null
          user_id?: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Update: {
          belly_cm?: number | null
          calf_cm?: number | null
          chest_cm?: number | null
          created_at?: string
          hip_cm?: number | null
          id?: string
          measured_on?: string
          neck_cm?: number | null
          note?: string | null
          shoulder_cm?: number | null
          thigh_cm?: number | null
          updated_at?: string
          upper_arm_cm?: number | null
          user_id?: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "body_measurements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drinks: {
        Row: {
          caffeine_mg_per_100ml: number
          color: string
          created_at: string
          id: string
          ingredients: Json | null
          name: string
          position: number
          sugar_g_per_100ml: number
          updated_at: string
          user_id: string
          water_percent: number
        }
        Insert: {
          caffeine_mg_per_100ml?: number
          color: string
          created_at?: string
          id?: string
          ingredients?: Json | null
          name: string
          position?: number
          sugar_g_per_100ml?: number
          updated_at?: string
          user_id?: string
          water_percent?: number
        }
        Update: {
          caffeine_mg_per_100ml?: number
          color?: string
          created_at?: string
          id?: string
          ingredients?: Json | null
          name?: string
          position?: number
          sugar_g_per_100ml?: number
          updated_at?: string
          user_id?: string
          water_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "drinks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drink_entries: {
        Row: {
          amount_ml: number
          caffeine_mg: number
          created_at: string
          drink_color: string
          drink_id: string | null
          drink_name: string
          drunk_at: string
          id: string
          sugar_g: number
          user_id: string
          water_ml: number
        }
        Insert: {
          amount_ml: number
          caffeine_mg?: number
          created_at?: string
          drink_color: string
          drink_id?: string | null
          drink_name: string
          drunk_at?: string
          id?: string
          sugar_g?: number
          user_id?: string
          water_ml?: number
        }
        Update: {
          amount_ml?: number
          caffeine_mg?: number
          created_at?: string
          drink_color?: string
          drink_id?: string | null
          drink_name?: string
          drunk_at?: string
          id?: string
          sugar_g?: number
          user_id?: string
          water_ml?: number
        }
        Relationships: [
          {
            foreignKeyName: "drink_entries_drink_id_fkey"
            columns: ["drink_id"]
            isOneToOne: false
            referencedRelation: "drinks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drink_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          at_time: string | null
          color: string
          created_at: string
          daytime: string | null
          dose: string | null
          frequency: string
          id: string
          kind: string
          name: string
          notes: string | null
          paused_at: string | null
          position: number
          routine: string | null
          target: number
          updated_at: string
          user_id: string
          weekdays: number[]
        }
        Insert: {
          at_time?: string | null
          color: string
          created_at?: string
          daytime?: string | null
          dose?: string | null
          frequency?: string
          id?: string
          kind?: string
          name: string
          notes?: string | null
          paused_at?: string | null
          position?: number
          routine?: string | null
          target?: number
          updated_at?: string
          user_id?: string
          weekdays?: number[]
        }
        Update: {
          at_time?: string | null
          color?: string
          created_at?: string
          daytime?: string | null
          dose?: string | null
          frequency?: string
          id?: string
          kind?: string
          name?: string
          notes?: string | null
          paused_at?: string | null
          position?: number
          routine?: string | null
          target?: number
          updated_at?: string
          user_id?: string
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "habits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_checks: {
        Row: {
          count: number
          created_at: string
          day: string
          habit_id: string
          user_id: string
        }
        Insert: {
          count?: number
          created_at?: string
          day: string
          habit_id: string
          user_id?: string
        }
        Update: {
          count?: number
          created_at?: string
          day?: string
          habit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_checks_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "habit_checks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_routines: {
        Row: {
          color: string
          created_at: string
          daytime: string
          id: string
          legacy_key: string | null
          name: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color: string
          created_at?: string
          daytime: string
          id?: string
          legacy_key?: string | null
          name: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          color?: string
          created_at?: string
          daytime?: string
          id?: string
          legacy_key?: string | null
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_routines_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_routine_items: {
        Row: {
          created_at: string
          habit_id: string
          position: number
          routine_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          habit_id: string
          position?: number
          routine_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          habit_id?: string
          position?: number
          routine_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_routine_items_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "habit_routine_items_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "habit_routines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "habit_routine_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_routine_checks: {
        Row: {
          created_at: string
          day: string
          habit_id: string
          routine_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day: string
          habit_id: string
          routine_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          day?: string
          habit_id?: string
          routine_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_routine_checks_routine_id_habit_id_fkey"
            columns: ["routine_id", "habit_id"]
            isOneToOne: false
            referencedRelation: "habit_routine_items"
            referencedColumns: ["routine_id", "habit_id"]
          },
          {
            foreignKeyName: "habit_routine_checks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      training_schedule: {
        Row: {
          at_time: string | null
          category: string
          created_at: string
          daytime: string | null
          duration_min: number | null
          id: string
          notes: string | null
          position: number
          title: string
          updated_at: string
          user_id: string
          weekday: number
        }
        Insert: {
          at_time?: string | null
          category?: string
          created_at?: string
          daytime?: string | null
          duration_min?: number | null
          id?: string
          notes?: string | null
          position?: number
          title: string
          updated_at?: string
          user_id?: string
          weekday: number
        }
        Update: {
          at_time?: string | null
          category?: string
          created_at?: string
          daytime?: string | null
          duration_min?: number | null
          id?: string
          notes?: string | null
          position?: number
          title?: string
          updated_at?: string
          user_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "training_schedule_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_exercises: {
        Row: {
          exercise_id: string
          id: string
          note: string | null
          position: number
          reps_max: number | null
          reps_min: number | null
          rest_seconds: number | null
          target_seconds: number | null
          warmup: boolean
          workout_id: string
        }
        Insert: {
          exercise_id: string
          id: string
          note?: string | null
          position: number
          reps_max?: number | null
          reps_min?: number | null
          rest_seconds?: number | null
          target_seconds?: number | null
          warmup?: boolean
          workout_id: string
        }
        Update: {
          exercise_id?: string
          id?: string
          note?: string | null
          position?: number
          reps_max?: number | null
          reps_min?: number | null
          rest_seconds?: number | null
          target_seconds?: number | null
          warmup?: boolean
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sets: {
        Row: {
          avg_heart_rate: number | null
          distance_m: number | null
          done: boolean
          done_at: string | null
          id: string
          kind: Database["public"]["Enums"]["workout_set_kind"]
          position: number
          reps: number | null
          seconds: number | null
          speed_kmh: number | null
          weight_kg: number | null
          workout_exercise_id: string
        }
        Insert: {
          avg_heart_rate?: number | null
          distance_m?: number | null
          done?: boolean
          done_at?: string | null
          id: string
          kind?: Database["public"]["Enums"]["workout_set_kind"]
          position: number
          reps?: number | null
          seconds?: number | null
          speed_kmh?: number | null
          weight_kg?: number | null
          workout_exercise_id: string
        }
        Update: {
          avg_heart_rate?: number | null
          distance_m?: number | null
          done?: boolean
          done_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["workout_set_kind"]
          position?: number
          reps?: number | null
          seconds?: number | null
          speed_kmh?: number | null
          weight_kg?: number | null
          workout_exercise_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sets_workout_exercise_id_fkey"
            columns: ["workout_exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          note: string | null
          plan_day_id: string | null
          plan_id: string | null
          started_at: string
          title: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          note?: string | null
          plan_day_id?: string | null
          plan_id?: string | null
          started_at: string
          title: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          note?: string | null
          plan_day_id?: string | null
          plan_id?: string | null
          started_at?: string
          title?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "workouts_plan_day_id_fkey"
            columns: ["plan_day_id"]
            isOneToOne: false
            referencedRelation: "training_plan_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workouts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workouts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          category: Database["public"]["Enums"]["exercise_category"]
          created_at: string
          created_by: string | null
          equipment: Database["public"]["Enums"]["exercise_equipment"]
          id: string
          instructions: string | null
          muscle_group: Database["public"]["Enums"]["muscle_group"]
          name: string
          secondary_muscles: Database["public"]["Enums"]["muscle_group"][]
          tracking: Database["public"]["Enums"]["exercise_tracking"]
        }
        Insert: {
          category?: Database["public"]["Enums"]["exercise_category"]
          created_at?: string
          created_by?: string | null
          equipment: Database["public"]["Enums"]["exercise_equipment"]
          id?: string
          instructions?: string | null
          muscle_group: Database["public"]["Enums"]["muscle_group"]
          name: string
          secondary_muscles?: Database["public"]["Enums"]["muscle_group"][]
          tracking?: Database["public"]["Enums"]["exercise_tracking"]
        }
        Update: {
          category?: Database["public"]["Enums"]["exercise_category"]
          created_at?: string
          created_by?: string | null
          equipment?: Database["public"]["Enums"]["exercise_equipment"]
          id?: string
          instructions?: string | null
          muscle_group?: Database["public"]["Enums"]["muscle_group"]
          name?: string
          secondary_muscles?: Database["public"]["Enums"]["muscle_group"][]
          tracking?: Database["public"]["Enums"]["exercise_tracking"]
        }
        Relationships: [
          {
            foreignKeyName: "exercises_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      training_plan_days: {
        Row: {
          focus: string | null
          id: string
          name: string
          plan_id: string
          position: number
        }
        Insert: {
          focus?: string | null
          id?: string
          name: string
          plan_id: string
          position: number
        }
        Update: {
          focus?: string | null
          id?: string
          name?: string
          plan_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "training_plan_days_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      training_plan_exercises: {
        Row: {
          day_id: string
          exercise_id: string
          id: string
          note: string | null
          position: number
          reps_max: number | null
          reps_min: number | null
          rest_seconds: number | null
          sets: number
          target_seconds: number | null
          warmup: boolean
        }
        Insert: {
          day_id: string
          exercise_id: string
          id?: string
          note?: string | null
          position: number
          reps_max?: number | null
          reps_min?: number | null
          rest_seconds?: number | null
          sets?: number
          target_seconds?: number | null
          warmup?: boolean
        }
        Update: {
          day_id?: string
          exercise_id?: string
          id?: string
          note?: string | null
          position?: number
          reps_max?: number | null
          reps_min?: number | null
          rest_seconds?: number | null
          sets?: number
          target_seconds?: number | null
          warmup?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "training_plan_exercises_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "training_plan_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_plan_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      training_plans: {
        Row: {
          created_at: string
          description: string | null
          forked_from_id: string | null
          id: string
          is_archived: boolean
          is_public: boolean
          kind: Database["public"]["Enums"]["training_plan_kind"]
          owner_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          forked_from_id?: string | null
          id?: string
          is_archived?: boolean
          is_public?: boolean
          kind?: Database["public"]["Enums"]["training_plan_kind"]
          owner_id?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          forked_from_id?: string | null
          id?: string
          is_archived?: boolean
          is_public?: boolean
          kind?: Database["public"]["Enums"]["training_plan_kind"]
          owner_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_plans_forked_from_id_fkey"
            columns: ["forked_from_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_plans_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_config: {
        Row: {
          description: string | null
          key: string
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          value?: Json
        }
        Relationships: []
      }
      cocktail_details: {
        Row: {
          garnish: string | null
          glass: Database["public"]["Enums"]["glass"] | null
          ice: string | null
          method: Database["public"]["Enums"]["cocktail_method"] | null
          recipe_id: string
        }
        Insert: {
          garnish?: string | null
          glass?: Database["public"]["Enums"]["glass"] | null
          ice?: string | null
          method?: Database["public"]["Enums"]["cocktail_method"] | null
          recipe_id: string
        }
        Update: {
          garnish?: string | null
          glass?: Database["public"]["Enums"]["glass"] | null
          ice?: string | null
          method?: Database["public"]["Enums"]["cocktail_method"] | null
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cocktail_details_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: true
            referencedRelation: "recipe_costs"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "cocktail_details_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: true
            referencedRelation: "recipe_nutrition"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "cocktail_details_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: true
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      cook_logs: {
        Row: {
          cooked_at: string
          id: string
          note: string | null
          rating: number | null
          recipe_id: string
          recipe_version: number | null
          servings: number | null
          user_id: string
        }
        Insert: {
          cooked_at?: string
          id?: string
          note?: string | null
          rating?: number | null
          recipe_id: string
          recipe_version?: number | null
          servings?: number | null
          user_id?: string
        }
        Update: {
          cooked_at?: string
          id?: string
          note?: string | null
          rating?: number | null
          recipe_id?: string
          recipe_version?: number | null
          servings?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cook_logs_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe_costs"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "cook_logs_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe_nutrition"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "cook_logs_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cook_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          recipe_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          recipe_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          recipe_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe_costs"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "favorites_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe_nutrition"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "favorites_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredient_prices: {
        Row: {
          id: string
          ingredient_id: string
          package_amount: number
          package_unit: Database["public"]["Enums"]["unit"]
          price: number
          store: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          ingredient_id: string
          package_amount: number
          package_unit?: Database["public"]["Enums"]["unit"]
          price: number
          store?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          id?: string
          ingredient_id?: string
          package_amount?: number
          package_unit?: Database["public"]["Enums"]["unit"]
          price?: number
          store?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_prices_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_prices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          abv: number | null
          carbs: number
          created_at: string
          created_by: string | null
          density_g_per_ml: number | null
          diet: Database["public"]["Enums"]["ingredient_diet"]
          display_name: string | null
          external_id: string | null
          fat: number
          fiber: number
          food_group: Database["public"]["Enums"]["food_group"]
          id: string
          is_staple: boolean
          kcal: number
          name: string
          piece_weight_g: number | null
          protein: number
          source: Database["public"]["Enums"]["ingredient_source"]
          sugar: number
        }
        Insert: {
          abv?: number | null
          carbs?: number
          created_at?: string
          created_by?: string | null
          density_g_per_ml?: number | null
          diet: Database["public"]["Enums"]["ingredient_diet"]
          display_name?: string | null
          external_id?: string | null
          fat?: number
          fiber?: number
          food_group?: Database["public"]["Enums"]["food_group"]
          id?: string
          is_staple?: boolean
          kcal?: number
          name: string
          piece_weight_g?: number | null
          protein?: number
          source?: Database["public"]["Enums"]["ingredient_source"]
          sugar?: number
        }
        Update: {
          abv?: number | null
          carbs?: number
          created_at?: string
          created_by?: string | null
          density_g_per_ml?: number | null
          diet?: Database["public"]["Enums"]["ingredient_diet"]
          display_name?: string | null
          external_id?: string | null
          fat?: number
          fiber?: number
          food_group?: Database["public"]["Enums"]["food_group"]
          id?: string
          is_staple?: boolean
          kcal?: number
          name?: string
          piece_weight_g?: number | null
          protein?: number
          source?: Database["public"]["Enums"]["ingredient_source"]
          sugar?: number
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plan_entries: {
        Row: {
          batch_id: string | null
          created_at: string
          date: string
          id: string
          is_leftover: boolean
          position: number
          recipe_id: string | null
          servings: number
          slot: Database["public"]["Enums"]["meal_slot"]
          title: string | null
          user_id: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          date: string
          id?: string
          is_leftover?: boolean
          position?: number
          recipe_id?: string | null
          servings?: number
          slot: Database["public"]["Enums"]["meal_slot"]
          title?: string | null
          user_id?: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          date?: string
          id?: string
          is_leftover?: boolean
          position?: number
          recipe_id?: string | null
          servings?: number
          slot?: Database["public"]["Enums"]["meal_slot"]
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_entries_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "meal_prep_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_entries_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe_costs"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "meal_plan_entries_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe_nutrition"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "meal_plan_entries_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_prep_batches: {
        Row: {
          cook_date: string
          created_at: string
          id: string
          recipe_id: string
          servings_cooked: number
          user_id: string
        }
        Insert: {
          cook_date: string
          created_at?: string
          id?: string
          recipe_id: string
          servings_cooked: number
          user_id?: string
        }
        Update: {
          cook_date?: string
          created_at?: string
          id?: string
          recipe_id?: string
          servings_cooked?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_prep_batches_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe_costs"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "meal_prep_batches_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe_nutrition"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "meal_prep_batches_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_prep_batches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pantry_items: {
        Row: {
          amount: number | null
          expires_on: string | null
          id: string
          ingredient_id: string
          location: Database["public"]["Enums"]["pantry_location"]
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          expires_on?: string | null
          id?: string
          ingredient_id: string
          location?: Database["public"]["Enums"]["pantry_location"]
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          amount?: number | null
          expires_on?: string | null
          id?: string
          ingredient_id?: string
          location?: Database["public"]["Enums"]["pantry_location"]
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pantry_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pantry_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_days: {
        Row: {
          date: string
          is_training_day: boolean
          user_id: string
        }
        Insert: {
          date: string
          is_training_day: boolean
          user_id?: string
        }
        Update: {
          date?: string
          is_training_day?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_days_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          hide_from_leaderboard: boolean
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          hide_from_leaderboard?: boolean
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          hide_from_leaderboard?: boolean
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      recipe_ingredients: {
        Row: {
          amount: number | null
          grams: number | null
          id: string
          ingredient_id: string
          is_optional: boolean
          note: string | null
          position: number
          recipe_id: string
          step_position: number | null
          unit: Database["public"]["Enums"]["unit"] | null
        }
        Insert: {
          amount?: number | null
          grams?: number | null
          id?: string
          ingredient_id: string
          is_optional?: boolean
          note?: string | null
          position?: number
          recipe_id: string
          step_position?: number | null
          unit?: Database["public"]["Enums"]["unit"] | null
        }
        Update: {
          amount?: number | null
          grams?: number | null
          id?: string
          ingredient_id?: string
          is_optional?: boolean
          note?: string | null
          position?: number
          recipe_id?: string
          step_position?: number | null
          unit?: Database["public"]["Enums"]["unit"] | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe_costs"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe_nutrition"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_steps: {
        Row: {
          id: string
          position: number
          recipe_id: string
          text: string
          timer_from_text: boolean
          timer_seconds: number | null
        }
        Insert: {
          id?: string
          position: number
          recipe_id: string
          text: string
          timer_from_text?: boolean
          timer_seconds?: number | null
        }
        Update: {
          id?: string
          position?: number
          recipe_id?: string
          text?: string
          timer_from_text?: boolean
          timer_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_steps_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe_costs"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "recipe_steps_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe_nutrition"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "recipe_steps_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_versions: {
        Row: {
          change_note: string | null
          created_at: string
          id: string
          recipe_id: string
          snapshot: Json
          version: number
        }
        Insert: {
          change_note?: string | null
          created_at?: string
          id?: string
          recipe_id: string
          snapshot: Json
          version: number
        }
        Update: {
          change_note?: string | null
          created_at?: string
          id?: string
          recipe_id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipe_versions_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe_costs"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "recipe_versions_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe_nutrition"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "recipe_versions_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          category: Database["public"]["Enums"]["recipe_category"] | null
          category_name: string | null
          cook_minutes: number | null
          created_at: string
          current_version: number
          description: string | null
          forked_from_id: string | null
          id: string
          image_url: string | null
          is_meal_prep: boolean
          is_public: boolean
          owner_id: string
          prep_minutes: number | null
          recipe_type: Database["public"]["Enums"]["recipe_type"]
          servings: number
          share_token: string | null
          side_dishes: string[]
          source_url: string | null
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["recipe_category"] | null
          category_name?: string | null
          cook_minutes?: number | null
          created_at?: string
          current_version?: number
          description?: string | null
          forked_from_id?: string | null
          id?: string
          image_url?: string | null
          is_meal_prep?: boolean
          is_public?: boolean
          owner_id?: string
          prep_minutes?: number | null
          recipe_type?: Database["public"]["Enums"]["recipe_type"]
          servings?: number
          share_token?: string | null
          side_dishes?: string[]
          source_url?: string | null
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["recipe_category"] | null
          category_name?: string | null
          cook_minutes?: number | null
          created_at?: string
          current_version?: number
          description?: string | null
          forked_from_id?: string | null
          id?: string
          image_url?: string | null
          is_meal_prep?: boolean
          is_public?: boolean
          owner_id?: string
          prep_minutes?: number | null
          recipe_type?: Database["public"]["Enums"]["recipe_type"]
          servings?: number
          share_token?: string | null
          side_dishes?: string[]
          source_url?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_forked_from_id_fkey"
            columns: ["forked_from_id"]
            isOneToOne: false
            referencedRelation: "recipe_costs"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "recipes_forked_from_id_fkey"
            columns: ["forked_from_id"]
            isOneToOne: false
            referencedRelation: "recipe_nutrition"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "recipes_forked_from_id_fkey"
            columns: ["forked_from_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_list_items: {
        Row: {
          amount: number | null
          checked: boolean
          created_at: string
          id: string
          ingredient_id: string | null
          name: string
          source: Database["public"]["Enums"]["shopping_source"]
          unit: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          checked?: boolean
          created_at?: string
          id?: string
          ingredient_id?: string | null
          name: string
          source?: Database["public"]["Enums"]["shopping_source"]
          unit?: string | null
          user_id?: string
        }
        Update: {
          amount?: number | null
          checked?: boolean
          created_at?: string
          id?: string
          ingredient_id?: string | null
          name?: string
          source?: Database["public"]["Enums"]["shopping_source"]
          unit?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_list_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_list_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_goals: {
        Row: {
          carbs: number | null
          fat: number | null
          goal_type: Database["public"]["Enums"]["goal_type"]
          kcal: number | null
          protein: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          carbs?: number | null
          fat?: number | null
          goal_type: Database["public"]["Enums"]["goal_type"]
          kcal?: number | null
          protein?: number | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          carbs?: number | null
          fat?: number | null
          goal_type?: Database["public"]["Enums"]["goal_type"]
          kcal?: number | null
          protein?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          body_settings: Json | null
          cocktail_sort: string
          drink_goal_ml: number | null
          energy_profile: Json | null
          hide_staples: boolean
          home_widgets: Json | null
          long_not_cooked_weeks: number
          recipe_sort: string
          recipe_view: string
          shopping_sort: string
          training_weekdays: number[]
          updated_at: string
          user_id: string
        }
        Insert: {
          body_settings?: Json | null
          cocktail_sort?: string
          drink_goal_ml?: number | null
          energy_profile?: Json | null
          hide_staples?: boolean
          home_widgets?: Json | null
          long_not_cooked_weeks?: number
          recipe_sort?: string
          recipe_view?: string
          shopping_sort?: string
          training_weekdays?: number[]
          updated_at?: string
          user_id?: string
        }
        Update: {
          body_settings?: Json | null
          cocktail_sort?: string
          drink_goal_ml?: number | null
          energy_profile?: Json | null
          hide_staples?: boolean
          home_widgets?: Json | null
          long_not_cooked_weeks?: number
          recipe_sort?: string
          recipe_view?: string
          shopping_sort?: string
          training_weekdays?: number[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      recipe_alcohol: {
        Row: {
          abv_percent: number | null
          alcohol_g_per_drink: number | null
          alcohol_ml_per_drink: number | null
          dilution: number | null
          drink_volume_ml: number | null
          method: Database["public"]["Enums"]["cocktail_method"] | null
          recipe_id: string | null
          servings: number | null
        }
        Relationships: []
      }
      recipe_costs: {
        Row: {
          cost_per_serving: number | null
          cost_total: number | null
          ingredient_count: number | null
          priced_count: number | null
          recipe_id: string | null
          servings: number | null
        }
        Relationships: []
      }
      recipe_nutrition: {
        Row: {
          carbs_per_serving: number | null
          carbs_total: number | null
          fat_per_serving: number | null
          fat_total: number | null
          fiber_per_serving: number | null
          fiber_total: number | null
          grams_by_food_group: Json | null
          grams_total: number | null
          ingredient_count: number | null
          is_high_protein: boolean | null
          is_low_carb: boolean | null
          is_vegan: boolean | null
          is_vegetarian: boolean | null
          kcal_per_serving: number | null
          kcal_total: number | null
          protein_per_serving: number | null
          protein_total: number | null
          recipe_id: string | null
          servings: number | null
          sugar_per_serving: number | null
          sugar_total: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      challenge_workout_days: {
        Args: { p_challenge_id: string }
        Returns: {
          day: string
          user_id: string
          workouts: number
        }[]
      }
      drink_days: {
        Args: { p_from: string; p_to: string }
        Returns: {
          amount_ml: number
          caffeine_mg: number
          day: string
          entries: number
          sugar_g: number
        }[]
      }
      last_exercise_sets: {
        Args: { p_exclude?: string; p_exercise_ids: string[] }
        Returns: {
          distance_m: number
          exercise_id: string
          reps: number
          seconds: number
          set_index: number
          speed_kmh: number
          started_at: string
          weight_kg: number
        }[]
      }
      sync_workout: {
        Args: { p_workout: Json }
        Returns: number
      }
      copy_training_plan: {
        Args: { p_plan_id: string; p_title?: string }
        Returns: string
      }
      save_training_plan: {
        Args: { p_days: Json; p_plan: Json }
        Returns: string
      }
      copy_plan_week: {
        Args: { p_from_monday: string; p_replace: boolean; p_to_monday: string }
        Returns: number
      }
      duplicate_recipe: { Args: { p_recipe_id: string }; Returns: string }
      fork_shared_recipe: { Args: { p_token: string }; Returns: string }
      get_shared_recipe: { Args: { p_token: string }; Returns: Json }
      replace_plan_shopping_items: { Args: { p_items: Json }; Returns: number }
      delete_recipe_category: {
        Args: { p_id: string; p_move_to?: string }
        Returns: number
      }
      rename_recipe_category: {
        Args: { p_id: string; p_name: string }
        Returns: undefined
      }
      set_ingredient_display_name: {
        Args: { p_display_name: string; p_ingredient_id: string }
        Returns: undefined
      }
      save_recipe: {
        Args: {
          p_change_note?: string
          p_ingredients: Json
          p_recipe: Json
          p_steps: Json
        }
        Returns: string
      }
      search_ingredients: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          abv: number | null
          carbs: number
          created_at: string
          created_by: string | null
          density_g_per_ml: number | null
          diet: Database["public"]["Enums"]["ingredient_diet"]
          display_name: string | null
          external_id: string | null
          fat: number
          fiber: number
          food_group: Database["public"]["Enums"]["food_group"]
          id: string
          is_staple: boolean
          kcal: number
          name: string
          piece_weight_g: number | null
          protein: number
          source: Database["public"]["Enums"]["ingredient_source"]
          sugar: number
        }[]
        SetofOptions: {
          from: "*"
          to: "ingredients"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      set_recipe_share: {
        Args: { p_enabled: boolean; p_recipe_id: string }
        Returns: string
      }
    }
    Enums: {
      cocktail_method: "shaken" | "stirred" | "built" | "blended"
      exercise_category: "training" | "stretching" | "rehab"
      exercise_equipment:
        | "barbell"
        | "dumbbell"
        | "ez_bar"
        | "machine"
        | "smith_machine"
        | "cable"
        | "bodyweight"
        | "kettlebell"
        | "band"
        | "other"
      exercise_tracking: "weight_reps" | "bodyweight_reps" | "time" | "distance_time"
      training_plan_kind: "strength" | "strength_endurance" | "cardio"
      muscle_group:
        | "chest"
        | "back"
        | "shoulders"
        | "biceps"
        | "triceps"
        | "forearms"
        | "core"
        | "quads"
        | "hamstrings"
        | "glutes"
        | "adductors"
        | "calves"
        | "full_body"
        | "cardio"
        | "neck"
        | "hip_flexors"
        | "shins"
        | "feet"
      food_group:
        | "vegetables"
        | "fruit"
        | "meat"
        | "fish"
        | "dairy"
        | "egg"
        | "grains"
        | "legumes"
        | "nuts_seeds"
        | "oils_fats"
        | "spices_sauces"
        | "spirits"
        | "liqueurs_wine"
        | "syrups_juices"
        | "other"
      glass: "tumbler" | "coupette" | "highball" | "martini" | "tiki" | "other"
      goal_type: "default" | "training"
      ingredient_diet: "vegan" | "vegetarian" | "none"
      ingredient_source: "seed" | "openfoodfacts" | "user"
      meal_slot: "breakfast" | "lunch" | "dinner" | "snack"
      pantry_location: "kitchen" | "bar"
      recipe_category:
        | "pasta"
        | "rice"
        | "bowl"
        | "soup"
        | "salad"
        | "casserole"
        | "meat"
        | "fish"
        | "breakfast"
        | "snack"
        | "dessert"
        | "drink"
      recipe_type: "dish" | "cocktail"
      shopping_source: "plan" | "manual"
      unit:
        | "g"
        | "ml"
        | "cl"
        | "piece"
        | "tbsp"
        | "tsp"
        | "pinch"
        | "dash"
        | "barspoon"
      user_role: "user" | "admin"
      workout_set_kind: "warmup" | "normal"
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
    Enums: {
      cocktail_method: ["shaken", "stirred", "built", "blended"],
      exercise_category: ["training", "stretching", "rehab"],
      exercise_equipment: [
        "barbell",
        "dumbbell",
        "ez_bar",
        "machine",
        "smith_machine",
        "cable",
        "bodyweight",
        "kettlebell",
        "band",
        "other",
      ],
      exercise_tracking: ["weight_reps", "bodyweight_reps", "time", "distance_time"],
      training_plan_kind: ["strength", "strength_endurance", "cardio"],
      muscle_group: [
        "chest",
        "back",
        "shoulders",
        "biceps",
        "triceps",
        "forearms",
        "core",
        "quads",
        "hamstrings",
        "glutes",
        "adductors",
        "calves",
        "full_body",
        "cardio",
        "neck",
        "hip_flexors",
        "shins",
        "feet",
      ],
      food_group: [
        "vegetables",
        "fruit",
        "meat",
        "fish",
        "dairy",
        "egg",
        "grains",
        "legumes",
        "nuts_seeds",
        "oils_fats",
        "spices_sauces",
        "spirits",
        "liqueurs_wine",
        "syrups_juices",
        "other",
      ],
      glass: ["tumbler", "coupette", "highball", "martini", "tiki", "other"],
      goal_type: ["default", "training"],
      ingredient_diet: ["vegan", "vegetarian", "none"],
      ingredient_source: ["seed", "openfoodfacts", "user"],
      meal_slot: ["breakfast", "lunch", "dinner", "snack"],
      pantry_location: ["kitchen", "bar"],
      recipe_category: [
        "pasta",
        "rice",
        "bowl",
        "soup",
        "salad",
        "casserole",
        "meat",
        "fish",
        "breakfast",
        "snack",
        "dessert",
        "drink",
      ],
      recipe_type: ["dish", "cocktail"],
      shopping_source: ["plan", "manual"],
      unit: [
        "g",
        "ml",
        "cl",
        "piece",
        "tbsp",
        "tsp",
        "pinch",
        "dash",
        "barspoon",
      ],
      user_role: ["user", "admin"],
      workout_set_kind: ["warmup", "normal"],
    },
  },
} as const
