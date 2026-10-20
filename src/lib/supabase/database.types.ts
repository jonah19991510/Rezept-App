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
          recipe_id: string
          servings: number
          slot: Database["public"]["Enums"]["meal_slot"]
          user_id: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          date: string
          id?: string
          is_leftover?: boolean
          position?: number
          recipe_id: string
          servings?: number
          slot: Database["public"]["Enums"]["meal_slot"]
          user_id?: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          date?: string
          id?: string
          is_leftover?: boolean
          position?: number
          recipe_id?: string
          servings?: number
          slot?: Database["public"]["Enums"]["meal_slot"]
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
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
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
          timer_seconds: number | null
        }
        Insert: {
          id?: string
          position: number
          recipe_id: string
          text: string
          timer_seconds?: number | null
        }
        Update: {
          id?: string
          position?: number
          recipe_id?: string
          text?: string
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
          source_url: string | null
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["recipe_category"] | null
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
          source_url?: string | null
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["recipe_category"] | null
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
          hide_staples: boolean
          long_not_cooked_weeks: number
          shopping_sort: string
          training_weekdays: number[]
          updated_at: string
          user_id: string
        }
        Insert: {
          hide_staples?: boolean
          long_not_cooked_weeks?: number
          shopping_sort?: string
          training_weekdays?: number[]
          updated_at?: string
          user_id?: string
        }
        Update: {
          hide_staples?: boolean
          long_not_cooked_weeks?: number
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
      copy_plan_week: {
        Args: { p_from_monday: string; p_replace: boolean; p_to_monday: string }
        Returns: number
      }
      duplicate_recipe: { Args: { p_recipe_id: string }; Returns: string }
      fork_shared_recipe: { Args: { p_token: string }; Returns: string }
      get_shared_recipe: { Args: { p_token: string }; Returns: Json }
      replace_plan_shopping_items: { Args: { p_items: Json }; Returns: number }
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
    },
  },
} as const
