CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_action_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"conversation_id" uuid,
	"tool" text NOT NULL,
	"target_type" text,
	"target_id" uuid,
	"status" text NOT NULL,
	"confirmation_token_hash" text,
	"confirmed_at" timestamp with time zone,
	"idempotency_key" text NOT NULL,
	"expires_at" timestamp with time zone DEFAULT now() + interval '7 days' NOT NULL,
	"undo_data" jsonb,
	CONSTRAINT "ai_action_owner_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "ai_action_status_check" CHECK ("ai_action_logs"."status" in ('pending','confirmed','completed','failed','undone'))
);
--> statement-breakpoint
CREATE TABLE "ai_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"title" text NOT NULL,
	"expires_at" timestamp with time zone DEFAULT now() + interval '7 days' NOT NULL,
	CONSTRAINT "ai_conversation_owner_id_unique" UNIQUE("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "ai_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"expires_at" timestamp with time zone DEFAULT now() + interval '7 days' NOT NULL,
	CONSTRAINT "ai_message_owner_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "ai_message_role_check" CHECK ("ai_messages"."role" in ('user','assistant','tool'))
);
--> statement-breakpoint
CREATE TABLE "ai_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"tasks" boolean DEFAULT false NOT NULL,
	"calendar" boolean DEFAULT false NOT NULL,
	"habits" boolean DEFAULT false NOT NULL,
	"finance" boolean DEFAULT false NOT NULL,
	"health" boolean DEFAULT false NOT NULL,
	"drive" boolean DEFAULT false NOT NULL,
	"inbox" boolean DEFAULT false NOT NULL,
	"projects" boolean DEFAULT false NOT NULL,
	CONSTRAINT "ai_permission_owner_id_unique" UNIQUE("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"request_id" text NOT NULL,
	"network_hash" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "background_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"idempotency_key" text NOT NULL,
	"target_id" uuid,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"error_code" text,
	"completed_at" timestamp with time zone,
	CONSTRAINT "job_owner_id_unique" UNIQUE("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "body_measurements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"date" date NOT NULL,
	"weight_kg" numeric(12, 4),
	"waist_cm" numeric(12, 4),
	"chest_cm" numeric(12, 4),
	"hip_cm" numeric(12, 4),
	"note" text,
	CONSTRAINT "body_measurement_owner_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "body_measurement_values_check" CHECK (coalesce("body_measurements"."weight_kg",0) >= 0 and coalesce("body_measurements"."waist_cm",0) >= 0 and coalesce("body_measurements"."chest_cm",0) >= 0 and coalesce("body_measurements"."hip_cm",0) >= 0)
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"category_id" uuid,
	"month" date NOT NULL,
	"amount" numeric(20, 4) NOT NULL,
	"currency" text NOT NULL,
	"warning_threshold" integer DEFAULT 80 NOT NULL,
	CONSTRAINT "budget_owner_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "budget_amount_check" CHECK ("budgets"."amount" > 0 and "budgets"."warning_threshold" between 1 and 100),
	CONSTRAINT "budget_month_check" CHECK (extract(day from "budgets"."month") = 1)
);
--> statement-breakpoint
CREATE TABLE "calendar_event_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"event_id" uuid NOT NULL,
	"calendar_id" uuid NOT NULL,
	"external_event_id" text NOT NULL,
	"etag" text,
	"google_updated_at" timestamp with time zone,
	"local_synced_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"conflict" boolean DEFAULT false NOT NULL,
	"google_deleted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "event_mapping_owner_id_unique" UNIQUE("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"title" text NOT NULL,
	"description" text,
	"project_id" uuid,
	"all_day" boolean DEFAULT false NOT NULL,
	"start_date" date,
	"end_date" date,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"location" text,
	"meet_url" text,
	"recurrence_rule" text,
	"timezone" text DEFAULT 'Europe/Kyiv' NOT NULL,
	CONSTRAINT "calendar_event_owner_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "calendar_event_interval_check" CHECK (("calendar_events"."all_day" and "calendar_events"."start_date" is not null and "calendar_events"."end_date" is not null and "calendar_events"."end_date" > "calendar_events"."start_date" and "calendar_events"."starts_at" is null and "calendar_events"."ends_at" is null) or (not "calendar_events"."all_day" and "calendar_events"."starts_at" is not null and "calendar_events"."ends_at" is not null and "calendar_events"."ends_at" > "calendar_events"."starts_at" and "calendar_events"."start_date" is null and "calendar_events"."end_date" is null))
);
--> statement-breakpoint
CREATE TABLE "calendar_sync_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"calendar_id" uuid NOT NULL,
	"sync_token" text,
	"last_reconciled_at" timestamp with time zone,
	"last_successful_at" timestamp with time zone,
	"error_code" text,
	"lock_expires_at" timestamp with time zone,
	CONSTRAINT "calendar_sync_owner_id_unique" UNIQUE("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "custom_foods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"calories" numeric(12, 4) NOT NULL,
	"protein" numeric(12, 4) NOT NULL,
	"fat" numeric(12, 4) NOT NULL,
	"carbohydrates" numeric(12, 4) NOT NULL,
	"serving_grams" numeric(12, 4) DEFAULT '100' NOT NULL,
	"favorite" boolean DEFAULT false NOT NULL,
	CONSTRAINT "custom_food_owner_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "food_macros_check" CHECK ("custom_foods"."serving_grams" > 0 and "custom_foods"."calories" >= 0 and "custom_foods"."protein" >= 0 and "custom_foods"."fat" >= 0 and "custom_foods"."carbohydrates" >= 0)
);
--> statement-breakpoint
CREATE TABLE "daily_product_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"metric" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "metric_count_check" CHECK ("daily_product_metrics"."count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "daily_usage_counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"date" date NOT NULL,
	"timezone" text NOT NULL,
	"successful" integer DEFAULT 0 NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	"rejected" integer DEFAULT 0 NOT NULL,
	"provider_errors" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "daily_usage_owner_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "daily_usage_nonnegative" CHECK ("daily_usage_counters"."successful" >= 0 and "daily_usage_counters"."reserved" >= 0 and "daily_usage_counters"."rejected" >= 0 and "daily_usage_counters"."provider_errors" >= 0)
);
--> statement-breakpoint
CREATE TABLE "drive_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"google_file_id" text NOT NULL,
	"name" text NOT NULL,
	"mime_type" text NOT NULL,
	"web_view_url" text NOT NULL,
	"icon" text,
	"modified_at" timestamp with time zone,
	"project_id" uuid,
	"task_id" uuid,
	"event_id" uuid,
	"transaction_id" uuid,
	"inbox_item_id" uuid,
	"habit_id" uuid,
	CONSTRAINT "drive_link_owner_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "drive_link_one_target_check" CHECK (num_nonnulls("drive_links"."project_id","drive_links"."task_id","drive_links"."event_id","drive_links"."transaction_id","drive_links"."inbox_item_id","drive_links"."habit_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "entitlement_plans" (
	"code" text PRIMARY KEY NOT NULL,
	"ai_daily_limit" integer,
	"inbox_box_limit" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_limits_check" CHECK (("entitlement_plans"."ai_daily_limit" is null or "entitlement_plans"."ai_daily_limit" >= 0) and "entitlement_plans"."inbox_box_limit" > 0)
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"currency" text NOT NULL,
	"date" date NOT NULL,
	"rate_to_uah" numeric(24, 10) NOT NULL,
	"source" text DEFAULT 'NBU' NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exchange_rate_positive" CHECK ("exchange_rates"."rate_to_uah" > 0)
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"description" text,
	"muscle_group" text,
	"type" text DEFAULT 'strength' NOT NULL,
	CONSTRAINT "exercise_owner_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "exercise_type_check" CHECK ("exercises"."type" in ('strength','cardio','mobility','other'))
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"key" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"color" text,
	"icon" text,
	CONSTRAINT "finance_category_owner_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "finance_category_type_check" CHECK ("finance_categories"."type" in ('income','expense'))
);
--> statement-breakpoint
CREATE TABLE "finance_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"account_id" uuid NOT NULL,
	"category_id" uuid,
	"type" text NOT NULL,
	"amount" numeric(20, 4) NOT NULL,
	"currency" text NOT NULL,
	"transaction_date" date NOT NULL,
	"note" text,
	"merchant" text,
	"destination_account_id" uuid,
	"destination_amount" numeric(20, 4),
	"exchange_rate_id" uuid,
	"recurring_transaction_id" uuid,
	"occurrence_date" date,
	CONSTRAINT "finance_transaction_owner_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "transaction_amount_check" CHECK ("finance_transactions"."amount" > 0 and "finance_transactions"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "transaction_type_check" CHECK ("finance_transactions"."type" in ('income','expense','transfer')),
	CONSTRAINT "transaction_transfer_check" CHECK (("finance_transactions"."type" = 'transfer' and "finance_transactions"."destination_account_id" is not null and "finance_transactions"."destination_account_id" <> "finance_transactions"."account_id" and "finance_transactions"."destination_amount" is not null and "finance_transactions"."destination_amount" > 0) or ("finance_transactions"."type" <> 'transfer' and "finance_transactions"."destination_account_id" is null and "finance_transactions"."destination_amount" is null))
);
--> statement-breakpoint
CREATE TABLE "financial_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"currency" text NOT NULL,
	"type" text DEFAULT 'bank' NOT NULL,
	"opening_balance" numeric(20, 4) DEFAULT '0' NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"color" text,
	CONSTRAINT "financial_account_owner_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "financial_account_currency_check" CHECK ("financial_accounts"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "financial_account_type_check" CHECK ("financial_accounts"."type" in ('cash','bank','savings','other'))
);
--> statement-breakpoint
CREATE TABLE "google_calendars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"connection_id" uuid NOT NULL,
	"external_calendar_id" text NOT NULL,
	"name" text NOT NULL,
	"timezone" text NOT NULL,
	"selected" boolean DEFAULT false NOT NULL,
	"access_role" text NOT NULL,
	CONSTRAINT "google_calendar_owner_id_unique" UNIQUE("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "google_watch_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"calendar_id" uuid NOT NULL,
	"channel_id" text NOT NULL,
	"resource_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_message_number" numeric(30, 0) DEFAULT '0' NOT NULL,
	CONSTRAINT "google_watch_channels_channel_id_unique" UNIQUE("channel_id"),
	CONSTRAINT "watch_channel_owner_id_unique" UNIQUE("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "google_workspace_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"google_subject" text NOT NULL,
	"email" text NOT NULL,
	"avatar_url" text,
	"encrypted_refresh_token" text NOT NULL,
	"encrypted_access_token" text,
	"token_key_version" integer DEFAULT 1 NOT NULL,
	"access_token_expires_at" timestamp with time zone,
	"scopes" text[] NOT NULL,
	"calendar_enabled" boolean DEFAULT false NOT NULL,
	"drive_enabled" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'connected' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"error_code" text,
	CONSTRAINT "google_connection_owner_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "google_connection_status_check" CHECK ("google_workspace_connections"."status" in ('connected','reconnect_required','disconnected'))
);
--> statement-breakpoint
CREATE TABLE "habit_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"habit_id" uuid NOT NULL,
	"date" date NOT NULL,
	"count" numeric(12, 4) DEFAULT '1' NOT NULL,
	"note" text,
	CONSTRAINT "habit_entry_owner_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "habit_entry_count_check" CHECK ("habit_entries"."count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "habits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"description" text,
	"schedule" text DEFAULT 'daily' NOT NULL,
	"weekdays" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"weekly_goal" integer DEFAULT 7 NOT NULL,
	"target_count" numeric(12, 4) DEFAULT '1' NOT NULL,
	"unit" text DEFAULT 'count' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"archived" boolean DEFAULT false NOT NULL,
	"recurrence_rule" text,
	"timezone" text DEFAULT 'Europe/Kyiv' NOT NULL,
	CONSTRAINT "habit_owner_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "habit_schedule_check" CHECK ("habits"."schedule" in ('daily','weekdays','weekly_goal')),
	CONSTRAINT "habit_goal_check" CHECK ("habits"."weekly_goal" between 1 and 7 and "habits"."target_count" > 0),
	CONSTRAINT "habit_weekdays_check" CHECK ("habits"."weekdays" <@ ARRAY[0,1,2,3,4,5,6]),
	CONSTRAINT "habit_dates_check" CHECK ("habits"."end_date" is null or "habits"."end_date" >= "habits"."start_date")
);
--> statement-breakpoint
CREATE TABLE "health_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"height_cm" numeric(12, 4),
	"current_weight_kg" numeric(12, 4),
	"goal_weight_kg" numeric(12, 4),
	"activity_level" text,
	"calorie_target" integer,
	"protein_target" numeric(12, 4),
	"fat_target" numeric(12, 4),
	"carbohydrate_target" numeric(12, 4),
	"water_target_ml" integer,
	CONSTRAINT "health_profile_owner_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "health_profile_targets_check" CHECK (coalesce("health_profiles"."height_cm",0) >= 0 and coalesce("health_profiles"."current_weight_kg",0) >= 0 and coalesce("health_profiles"."goal_weight_kg",0) >= 0 and coalesce("health_profiles"."calorie_target",0) >= 0 and coalesce("health_profiles"."water_target_ml",0) >= 0)
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"key" text NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"request_hash" text NOT NULL,
	"resource_id" uuid,
	"status_code" integer,
	"response_body" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "idempotency_owner_id_unique" UNIQUE("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "inbox_boxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"color" text,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "inbox_box_owner_id_unique" UNIQUE("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "inbox_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"box_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"source" text,
	"pinned" boolean DEFAULT false NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"converted_type" text,
	"converted_id" uuid,
	"converted_at" timestamp with time zone,
	CONSTRAINT "inbox_item_owner_id_unique" UNIQUE("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "meal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"date" date NOT NULL,
	"meal" text NOT NULL,
	"note" text,
	CONSTRAINT "meal_entry_owner_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "meal_type_check" CHECK ("meal_entries"."meal" in ('breakfast','lunch','dinner','snack'))
);
--> statement-breakpoint
CREATE TABLE "meal_entry_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"meal_entry_id" uuid NOT NULL,
	"food_id" uuid,
	"name" text NOT NULL,
	"quantity_grams" numeric(12, 4) NOT NULL,
	"calories" numeric(12, 4) NOT NULL,
	"protein" numeric(12, 4) NOT NULL,
	"fat" numeric(12, 4) NOT NULL,
	"carbohydrates" numeric(12, 4) NOT NULL,
	CONSTRAINT "meal_item_owner_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "meal_item_macros_check" CHECK ("meal_entry_items"."quantity_grams" > 0 and "meal_entry_items"."calories" >= 0 and "meal_entry_items"."protein" >= 0 and "meal_entry_items"."fat" >= 0 and "meal_entry_items"."carbohydrates" >= 0)
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"kind" text NOT NULL,
	"target_type" text,
	"target_id" uuid,
	"read_at" timestamp with time zone,
	"delivery_key" text,
	CONSTRAINT "notification_owner_id_unique" UNIQUE("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"description" text,
	"icon" text,
	"color" text,
	"status" text DEFAULT 'active' NOT NULL,
	"start_date" date,
	"target_date" date,
	"archived" boolean DEFAULT false NOT NULL,
	CONSTRAINT "project_owner_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "project_status_check" CHECK ("projects"."status" in ('active','paused','completed'))
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"device_name" text,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint"),
	CONSTRAINT "push_owner_id_unique" UNIQUE("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"last_request" numeric(20, 0) NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "recurring_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"account_id" uuid NOT NULL,
	"category_id" uuid,
	"type" text NOT NULL,
	"amount" numeric(20, 4) NOT NULL,
	"currency" text NOT NULL,
	"recurrence_rule" text NOT NULL,
	"timezone" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"next_date" date NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"note" text,
	CONSTRAINT "recurring_transaction_owner_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "recurring_type_check" CHECK ("recurring_transactions"."type" in ('income','expense')),
	CONSTRAINT "recurring_amount_check" CHECK ("recurring_transactions"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "reminder_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"reminder_id" uuid NOT NULL,
	"occurrence_at" timestamp with time zone NOT NULL,
	"channel" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"delivered_at" timestamp with time zone,
	"error_code" text,
	CONSTRAINT "reminder_delivery_owner_id_unique" UNIQUE("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "reminder_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"project_id" uuid,
	"task_id" uuid,
	"event_id" uuid,
	"transaction_id" uuid,
	"inbox_item_id" uuid,
	"habit_id" uuid,
	"trigger_type" text NOT NULL,
	"offset_minutes" integer,
	"exact_at" timestamp with time zone,
	"channels" text[] NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	CONSTRAINT "reminder_owner_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "reminder_one_target_check" CHECK (num_nonnulls("reminder_rules"."project_id","reminder_rules"."task_id","reminder_rules"."event_id","reminder_rules"."transaction_id","reminder_rules"."inbox_item_id","reminder_rules"."habit_id") = 1),
	CONSTRAINT "reminder_trigger_check" CHECK (("reminder_rules"."trigger_type" = 'offset' and "reminder_rules"."offset_minutes" >= 0 and "reminder_rules"."exact_at" is null) or ("reminder_rules"."trigger_type" = 'exact' and "reminder_rules"."exact_at" is not null and "reminder_rules"."offset_minutes" is null)),
	CONSTRAINT "reminder_channels_check" CHECK (cardinality("reminder_rules"."channels") > 0 and "reminder_rules"."channels" <@ ARRAY['in_app','push'])
);
--> statement-breakpoint
CREATE TABLE "savings_contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"goal_id" uuid NOT NULL,
	"amount" numeric(20, 4) NOT NULL,
	"currency" text NOT NULL,
	"date" date NOT NULL,
	"transaction_id" uuid,
	"note" text,
	CONSTRAINT "savings_contribution_owner_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "contribution_amount_positive" CHECK ("savings_contributions"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "savings_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"target_amount" numeric(20, 4) NOT NULL,
	"currency" text NOT NULL,
	"target_date" date,
	"archived" boolean DEFAULT false NOT NULL,
	CONSTRAINT "savings_goal_owner_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "savings_target_positive" CHECK ("savings_goals"."target_amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"color" text,
	CONSTRAINT "tag_owner_id_unique" UNIQUE("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "task_checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"task_id" uuid NOT NULL,
	"title" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "checklist_owner_id_unique" UNIQUE("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "task_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"task_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "task_tag_owner_id_unique" UNIQUE("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"title" text NOT NULL,
	"description" text,
	"project_id" uuid,
	"parent_task_id" uuid,
	"status" text DEFAULT 'todo' NOT NULL,
	"priority" text DEFAULT 'none' NOT NULL,
	"starts_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"due_date" date,
	"completed_at" timestamp with time zone,
	"position" integer DEFAULT 0 NOT NULL,
	"recurrence_source_id" uuid,
	"occurrence_date" date,
	"recurrence_rule" text,
	"timezone" text DEFAULT 'Europe/Kyiv' NOT NULL,
	CONSTRAINT "task_owner_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "task_status_check" CHECK ("tasks"."status" in ('inbox','todo','in_progress','done','cancelled')),
	CONSTRAINT "task_priority_check" CHECK ("tasks"."priority" in ('none','low','medium','high','urgent')),
	CONSTRAINT "task_not_self_parent" CHECK ("tasks"."parent_task_id" is null or "tasks"."parent_task_id" <> "tasks"."id"),
	CONSTRAINT "task_due_exclusive" CHECK ("tasks"."due_at" is null or "tasks"."due_date" is null)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'user' NOT NULL,
	"disabled" boolean DEFAULT false NOT NULL,
	"terms_accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "user_role_check" CHECK ("users"."role" in ('user','admin'))
);
--> statement-breakpoint
CREATE TABLE "user_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"plan" text DEFAULT 'FREE' NOT NULL,
	"ai_daily_limit" integer,
	"inbox_box_limit" integer DEFAULT 2 NOT NULL,
	"expires_at" timestamp with time zone,
	"granted_by" uuid,
	CONSTRAINT "entitlement_owner_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "entitlement_limits_check" CHECK (("user_entitlements"."ai_daily_limit" is null or "user_entitlements"."ai_daily_limit" >= 0) and "user_entitlements"."inbox_box_limit" > 0)
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"timezone" text DEFAULT 'Europe/Kyiv' NOT NULL,
	"locale" text DEFAULT 'uk' NOT NULL,
	"base_currency" text DEFAULT 'UAH' NOT NULL,
	"week_start" integer DEFAULT 1 NOT NULL,
	"date_format" text DEFAULT 'DD.MM.YYYY' NOT NULL,
	"time_format" text DEFAULT '24h' NOT NULL,
	"theme" text DEFAULT 'system' NOT NULL,
	"hidden_modules" text[] DEFAULT '{}'::text[] NOT NULL,
	"web_push_enabled" boolean DEFAULT false NOT NULL,
	"notification_offsets" integer[] DEFAULT ARRAY[10] NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"dashboard_layout" jsonb,
	CONSTRAINT "preferences_owner_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "preferences_locale_check" CHECK ("user_preferences"."locale" in ('uk','en')),
	CONSTRAINT "preferences_theme_check" CHECK ("user_preferences"."theme" in ('light','dark','system')),
	CONSTRAINT "preferences_week_check" CHECK ("user_preferences"."week_start" in (0,1))
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"display_name" text,
	"avatar_url" text,
	"bio" text,
	CONSTRAINT "profile_owner_id_unique" UNIQUE("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "water_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"date" date NOT NULL,
	"amount_ml" integer NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "water_entry_owner_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "water_amount_check" CHECK ("water_entries"."amount_ml" > 0)
);
--> statement-breakpoint
CREATE TABLE "workout_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"template_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"note" text,
	"calories_estimate" integer,
	CONSTRAINT "workout_session_owner_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "workout_session_interval_check" CHECK ("workout_sessions"."ends_at" is null or "workout_sessions"."ends_at" >= "workout_sessions"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "workout_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"session_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"reps" integer,
	"load_kg" numeric(12, 4),
	"duration_seconds" integer,
	"distance_meters" numeric(12, 4),
	"completed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "workout_set_owner_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "workout_set_values_check" CHECK (coalesce("workout_sets"."reps",0) >= 0 and coalesce("workout_sets"."load_kg",0) >= 0 and coalesce("workout_sets"."duration_seconds",0) >= 0 and coalesce("workout_sets"."distance_meters",0) >= 0)
);
--> statement-breakpoint
CREATE TABLE "workout_template_exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"template_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"sets" integer DEFAULT 3 NOT NULL,
	"reps" integer,
	"load_kg" numeric(12, 4),
	"duration_seconds" integer,
	CONSTRAINT "template_exercise_owner_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "template_exercise_values_check" CHECK ("workout_template_exercises"."sets" > 0 and coalesce("workout_template_exercises"."reps",0) >= 0 and coalesce("workout_template_exercises"."load_kg",0) >= 0 and coalesce("workout_template_exercises"."duration_seconds",0) >= 0)
);
--> statement-breakpoint
CREATE TABLE "workout_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "workout_template_owner_id_unique" UNIQUE("user_id","id")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_action_logs" ADD CONSTRAINT "ai_action_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_action_logs" ADD CONSTRAINT "action_conversation_fk" FOREIGN KEY ("user_id","conversation_id") REFERENCES "public"."ai_conversations"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "message_conversation_fk" FOREIGN KEY ("user_id","conversation_id") REFERENCES "public"."ai_conversations"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_permissions" ADD CONSTRAINT "ai_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "background_jobs" ADD CONSTRAINT "background_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "body_measurements" ADD CONSTRAINT "body_measurements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budget_category_fk" FOREIGN KEY ("user_id","category_id") REFERENCES "public"."finance_categories"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event_mappings" ADD CONSTRAINT "calendar_event_mappings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event_mappings" ADD CONSTRAINT "mapping_event_fk" FOREIGN KEY ("user_id","event_id") REFERENCES "public"."calendar_events"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event_mappings" ADD CONSTRAINT "mapping_calendar_fk" FOREIGN KEY ("user_id","calendar_id") REFERENCES "public"."google_calendars"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_event_project_fk" FOREIGN KEY ("user_id","project_id") REFERENCES "public"."projects"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_sync_state" ADD CONSTRAINT "calendar_sync_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_sync_state" ADD CONSTRAINT "sync_calendar_fk" FOREIGN KEY ("user_id","calendar_id") REFERENCES "public"."google_calendars"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_foods" ADD CONSTRAINT "custom_foods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_usage_counters" ADD CONSTRAINT "daily_usage_counters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_links" ADD CONSTRAINT "drive_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_links" ADD CONSTRAINT "drive_link_project_fk" FOREIGN KEY ("user_id","project_id") REFERENCES "public"."projects"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_links" ADD CONSTRAINT "drive_link_task_fk" FOREIGN KEY ("user_id","task_id") REFERENCES "public"."tasks"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_links" ADD CONSTRAINT "drive_link_event_fk" FOREIGN KEY ("user_id","event_id") REFERENCES "public"."calendar_events"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_links" ADD CONSTRAINT "drive_link_transaction_fk" FOREIGN KEY ("user_id","transaction_id") REFERENCES "public"."finance_transactions"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_links" ADD CONSTRAINT "drive_link_inbox_fk" FOREIGN KEY ("user_id","inbox_item_id") REFERENCES "public"."inbox_items"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_links" ADD CONSTRAINT "drive_link_habit_fk" FOREIGN KEY ("user_id","habit_id") REFERENCES "public"."habits"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_categories" ADD CONSTRAINT "finance_categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_exchange_rate_id_exchange_rates_id_fk" FOREIGN KEY ("exchange_rate_id") REFERENCES "public"."exchange_rates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transactions" ADD CONSTRAINT "transaction_account_fk" FOREIGN KEY ("user_id","account_id") REFERENCES "public"."financial_accounts"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transactions" ADD CONSTRAINT "transaction_destination_fk" FOREIGN KEY ("user_id","destination_account_id") REFERENCES "public"."financial_accounts"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transactions" ADD CONSTRAINT "transaction_category_fk" FOREIGN KEY ("user_id","category_id") REFERENCES "public"."finance_categories"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transactions" ADD CONSTRAINT "transaction_recurrence_fk" FOREIGN KEY ("user_id","recurring_transaction_id") REFERENCES "public"."recurring_transactions"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_calendars" ADD CONSTRAINT "google_calendars_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_calendars" ADD CONSTRAINT "google_calendar_connection_fk" FOREIGN KEY ("user_id","connection_id") REFERENCES "public"."google_workspace_connections"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_watch_channels" ADD CONSTRAINT "google_watch_channels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_watch_channels" ADD CONSTRAINT "watch_calendar_fk" FOREIGN KEY ("user_id","calendar_id") REFERENCES "public"."google_calendars"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_workspace_connections" ADD CONSTRAINT "google_workspace_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_entries" ADD CONSTRAINT "habit_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_entries" ADD CONSTRAINT "habit_entry_habit_fk" FOREIGN KEY ("user_id","habit_id") REFERENCES "public"."habits"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_profiles" ADD CONSTRAINT "health_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_boxes" ADD CONSTRAINT "inbox_boxes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_items" ADD CONSTRAINT "inbox_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_items" ADD CONSTRAINT "inbox_item_box_fk" FOREIGN KEY ("user_id","box_id") REFERENCES "public"."inbox_boxes"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_entries" ADD CONSTRAINT "meal_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_entry_items" ADD CONSTRAINT "meal_entry_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_entry_items" ADD CONSTRAINT "meal_item_meal_fk" FOREIGN KEY ("user_id","meal_entry_id") REFERENCES "public"."meal_entries"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_entry_items" ADD CONSTRAINT "meal_item_food_fk" FOREIGN KEY ("user_id","food_id") REFERENCES "public"."custom_foods"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_account_fk" FOREIGN KEY ("user_id","account_id") REFERENCES "public"."financial_accounts"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_category_fk" FOREIGN KEY ("user_id","category_id") REFERENCES "public"."finance_categories"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_deliveries" ADD CONSTRAINT "reminder_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_deliveries" ADD CONSTRAINT "delivery_reminder_fk" FOREIGN KEY ("user_id","reminder_id") REFERENCES "public"."reminder_rules"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_rules" ADD CONSTRAINT "reminder_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_rules" ADD CONSTRAINT "reminder_project_fk" FOREIGN KEY ("user_id","project_id") REFERENCES "public"."projects"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_rules" ADD CONSTRAINT "reminder_task_fk" FOREIGN KEY ("user_id","task_id") REFERENCES "public"."tasks"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_rules" ADD CONSTRAINT "reminder_event_fk" FOREIGN KEY ("user_id","event_id") REFERENCES "public"."calendar_events"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_rules" ADD CONSTRAINT "reminder_transaction_fk" FOREIGN KEY ("user_id","transaction_id") REFERENCES "public"."finance_transactions"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_rules" ADD CONSTRAINT "reminder_inbox_fk" FOREIGN KEY ("user_id","inbox_item_id") REFERENCES "public"."inbox_items"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_rules" ADD CONSTRAINT "reminder_habit_fk" FOREIGN KEY ("user_id","habit_id") REFERENCES "public"."habits"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_contributions" ADD CONSTRAINT "savings_contributions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_contributions" ADD CONSTRAINT "contribution_goal_fk" FOREIGN KEY ("user_id","goal_id") REFERENCES "public"."savings_goals"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_contributions" ADD CONSTRAINT "contribution_transaction_fk" FOREIGN KEY ("user_id","transaction_id") REFERENCES "public"."finance_transactions"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_goals" ADD CONSTRAINT "savings_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "checklist_task_fk" FOREIGN KEY ("user_id","task_id") REFERENCES "public"."tasks"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tag_task_fk" FOREIGN KEY ("user_id","task_id") REFERENCES "public"."tasks"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tag_tag_fk" FOREIGN KEY ("user_id","tag_id") REFERENCES "public"."tags"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "task_project_fk" FOREIGN KEY ("user_id","project_id") REFERENCES "public"."projects"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "task_parent_fk" FOREIGN KEY ("user_id","parent_task_id") REFERENCES "public"."tasks"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "task_recurrence_fk" FOREIGN KEY ("user_id","recurrence_source_id") REFERENCES "public"."tasks"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_entitlements" ADD CONSTRAINT "user_entitlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_entitlements" ADD CONSTRAINT "user_entitlements_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "water_entries" ADD CONSTRAINT "water_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD CONSTRAINT "session_template_fk" FOREIGN KEY ("user_id","template_id") REFERENCES "public"."workout_templates"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD CONSTRAINT "set_session_fk" FOREIGN KEY ("user_id","session_id") REFERENCES "public"."workout_sessions"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD CONSTRAINT "set_exercise_fk" FOREIGN KEY ("user_id","exercise_id") REFERENCES "public"."exercises"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_template_exercises" ADD CONSTRAINT "workout_template_exercises_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_template_exercises" ADD CONSTRAINT "template_exercise_template_fk" FOREIGN KEY ("user_id","template_id") REFERENCES "public"."workout_templates"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_template_exercises" ADD CONSTRAINT "template_exercise_exercise_fk" FOREIGN KEY ("user_id","exercise_id") REFERENCES "public"."exercises"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_templates" ADD CONSTRAINT "workout_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_unique" ON "accounts" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "account_owner_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_action_owner_created_idx" ON "ai_action_logs" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ai_action_trash_idx" ON "ai_action_logs" USING btree ("deleted_at") WHERE "ai_action_logs"."deleted_at" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_action_idempotency_unique" ON "ai_action_logs" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "ai_conversation_owner_created_idx" ON "ai_conversations" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ai_conversation_trash_idx" ON "ai_conversations" USING btree ("deleted_at") WHERE "ai_conversations"."deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "ai_conversation_expiry_idx" ON "ai_conversations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ai_message_owner_created_idx" ON "ai_messages" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ai_message_trash_idx" ON "ai_messages" USING btree ("deleted_at") WHERE "ai_messages"."deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "ai_message_expiry_idx" ON "ai_messages" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ai_permission_owner_created_idx" ON "ai_permissions" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ai_permission_trash_idx" ON "ai_permissions" USING btree ("deleted_at") WHERE "ai_permissions"."deleted_at" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_permission_owner_unique" ON "ai_permissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_actor_created_idx" ON "audit_logs" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "job_owner_created_idx" ON "background_jobs" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "job_trash_idx" ON "background_jobs" USING btree ("deleted_at") WHERE "background_jobs"."deleted_at" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "job_idempotency_unique" ON "background_jobs" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "job_run_idx" ON "background_jobs" USING btree ("status","run_at");--> statement-breakpoint
CREATE INDEX "body_measurement_owner_created_idx" ON "body_measurements" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "body_measurement_trash_idx" ON "body_measurements" USING btree ("deleted_at") WHERE "body_measurements"."deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "body_measurement_date_idx" ON "body_measurements" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "budget_owner_created_idx" ON "budgets" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "budget_trash_idx" ON "budgets" USING btree ("deleted_at") WHERE "budgets"."deleted_at" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "budget_category_month_unique" ON "budgets" USING btree ("user_id","month","category_id","currency") WHERE "budgets"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "budget_overall_month_unique" ON "budgets" USING btree ("user_id","month","currency") WHERE "budgets"."category_id" is null and "budgets"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "event_mapping_owner_created_idx" ON "calendar_event_mappings" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "event_mapping_trash_idx" ON "calendar_event_mappings" USING btree ("deleted_at") WHERE "calendar_event_mappings"."deleted_at" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "mapping_external_unique" ON "calendar_event_mappings" USING btree ("user_id","calendar_id","external_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mapping_local_unique" ON "calendar_event_mappings" USING btree ("user_id","event_id","calendar_id");--> statement-breakpoint
CREATE INDEX "calendar_event_owner_created_idx" ON "calendar_events" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "calendar_event_trash_idx" ON "calendar_events" USING btree ("deleted_at") WHERE "calendar_events"."deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "calendar_event_start_idx" ON "calendar_events" USING btree ("user_id","starts_at");--> statement-breakpoint
CREATE INDEX "calendar_event_date_idx" ON "calendar_events" USING btree ("user_id","start_date");--> statement-breakpoint
CREATE INDEX "calendar_sync_owner_created_idx" ON "calendar_sync_state" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "calendar_sync_trash_idx" ON "calendar_sync_state" USING btree ("deleted_at") WHERE "calendar_sync_state"."deleted_at" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_sync_unique" ON "calendar_sync_state" USING btree ("user_id","calendar_id");--> statement-breakpoint
CREATE INDEX "custom_food_owner_created_idx" ON "custom_foods" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "custom_food_trash_idx" ON "custom_foods" USING btree ("deleted_at") WHERE "custom_foods"."deleted_at" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_metric_unique" ON "daily_product_metrics" USING btree ("date","metric");--> statement-breakpoint
CREATE INDEX "daily_usage_owner_created_idx" ON "daily_usage_counters" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "daily_usage_trash_idx" ON "daily_usage_counters" USING btree ("deleted_at") WHERE "daily_usage_counters"."deleted_at" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_usage_day_unique" ON "daily_usage_counters" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "drive_link_owner_created_idx" ON "drive_links" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "drive_link_trash_idx" ON "drive_links" USING btree ("deleted_at") WHERE "drive_links"."deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "drive_file_idx" ON "drive_links" USING btree ("user_id","google_file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exchange_rate_date_unique" ON "exchange_rates" USING btree ("currency","date","source");--> statement-breakpoint
CREATE INDEX "exercise_owner_created_idx" ON "exercises" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "exercise_trash_idx" ON "exercises" USING btree ("deleted_at") WHERE "exercises"."deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "finance_category_owner_created_idx" ON "finance_categories" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "finance_category_trash_idx" ON "finance_categories" USING btree ("deleted_at") WHERE "finance_categories"."deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "finance_transaction_owner_created_idx" ON "finance_transactions" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "finance_transaction_trash_idx" ON "finance_transactions" USING btree ("deleted_at") WHERE "finance_transactions"."deleted_at" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "transaction_occurrence_unique" ON "finance_transactions" USING btree ("user_id","recurring_transaction_id","occurrence_date");--> statement-breakpoint
CREATE INDEX "transaction_owner_date_idx" ON "finance_transactions" USING btree ("user_id","transaction_date");--> statement-breakpoint
CREATE INDEX "financial_account_owner_created_idx" ON "financial_accounts" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "financial_account_trash_idx" ON "financial_accounts" USING btree ("deleted_at") WHERE "financial_accounts"."deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "google_calendar_owner_created_idx" ON "google_calendars" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "google_calendar_trash_idx" ON "google_calendars" USING btree ("deleted_at") WHERE "google_calendars"."deleted_at" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "google_calendar_external_unique" ON "google_calendars" USING btree ("user_id","external_calendar_id");--> statement-breakpoint
CREATE INDEX "watch_channel_owner_created_idx" ON "google_watch_channels" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "watch_channel_trash_idx" ON "google_watch_channels" USING btree ("deleted_at") WHERE "google_watch_channels"."deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "watch_expiry_idx" ON "google_watch_channels" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "google_connection_owner_created_idx" ON "google_workspace_connections" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "google_connection_trash_idx" ON "google_workspace_connections" USING btree ("deleted_at") WHERE "google_workspace_connections"."deleted_at" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "google_connection_owner_unique" ON "google_workspace_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "habit_entry_owner_created_idx" ON "habit_entries" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "habit_entry_trash_idx" ON "habit_entries" USING btree ("deleted_at") WHERE "habit_entries"."deleted_at" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "habit_entry_day_unique" ON "habit_entries" USING btree ("user_id","habit_id","date");--> statement-breakpoint
CREATE INDEX "habit_owner_created_idx" ON "habits" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "habit_trash_idx" ON "habits" USING btree ("deleted_at") WHERE "habits"."deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "health_profile_owner_created_idx" ON "health_profiles" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "health_profile_trash_idx" ON "health_profiles" USING btree ("deleted_at") WHERE "health_profiles"."deleted_at" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "health_profile_user_unique" ON "health_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idempotency_owner_created_idx" ON "idempotency_keys" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "idempotency_trash_idx" ON "idempotency_keys" USING btree ("deleted_at") WHERE "idempotency_keys"."deleted_at" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_owner_key_unique" ON "idempotency_keys" USING btree ("user_id","key");--> statement-breakpoint
CREATE INDEX "idempotency_expiry_idx" ON "idempotency_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "inbox_box_owner_created_idx" ON "inbox_boxes" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "inbox_box_trash_idx" ON "inbox_boxes" USING btree ("deleted_at") WHERE "inbox_boxes"."deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "inbox_item_owner_created_idx" ON "inbox_items" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "inbox_item_trash_idx" ON "inbox_items" USING btree ("deleted_at") WHERE "inbox_items"."deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "inbox_item_box_idx" ON "inbox_items" USING btree ("user_id","box_id");--> statement-breakpoint
CREATE INDEX "meal_entry_owner_created_idx" ON "meal_entries" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "meal_entry_trash_idx" ON "meal_entries" USING btree ("deleted_at") WHERE "meal_entries"."deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "meal_day_idx" ON "meal_entries" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "meal_item_owner_created_idx" ON "meal_entry_items" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "meal_item_trash_idx" ON "meal_entry_items" USING btree ("deleted_at") WHERE "meal_entry_items"."deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "notification_owner_created_idx" ON "notifications" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "notification_trash_idx" ON "notifications" USING btree ("deleted_at") WHERE "notifications"."deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "notification_unread_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_delivery_unique" ON "notifications" USING btree ("user_id","delivery_key");--> statement-breakpoint
CREATE INDEX "project_owner_created_idx" ON "projects" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "project_trash_idx" ON "projects" USING btree ("deleted_at") WHERE "projects"."deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "push_owner_created_idx" ON "push_subscriptions" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "push_trash_idx" ON "push_subscriptions" USING btree ("deleted_at") WHERE "push_subscriptions"."deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "recurring_transaction_owner_created_idx" ON "recurring_transactions" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "recurring_transaction_trash_idx" ON "recurring_transactions" USING btree ("deleted_at") WHERE "recurring_transactions"."deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "recurring_due_idx" ON "recurring_transactions" USING btree ("next_date","enabled");--> statement-breakpoint
CREATE INDEX "reminder_delivery_owner_created_idx" ON "reminder_deliveries" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "reminder_delivery_trash_idx" ON "reminder_deliveries" USING btree ("deleted_at") WHERE "reminder_deliveries"."deleted_at" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_delivery_occurrence_unique" ON "reminder_deliveries" USING btree ("user_id","reminder_id","occurrence_at","channel");--> statement-breakpoint
CREATE INDEX "reminder_owner_created_idx" ON "reminder_rules" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "reminder_trash_idx" ON "reminder_rules" USING btree ("deleted_at") WHERE "reminder_rules"."deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "savings_contribution_owner_created_idx" ON "savings_contributions" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "savings_contribution_trash_idx" ON "savings_contributions" USING btree ("deleted_at") WHERE "savings_contributions"."deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "savings_goal_owner_created_idx" ON "savings_goals" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "savings_goal_trash_idx" ON "savings_goals" USING btree ("deleted_at") WHERE "savings_goals"."deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "session_owner_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_expiry_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "tag_owner_created_idx" ON "tags" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "tag_trash_idx" ON "tags" USING btree ("deleted_at") WHERE "tags"."deleted_at" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "tag_name_unique" ON "tags" USING btree ("user_id","name") WHERE "tags"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "checklist_owner_created_idx" ON "task_checklist_items" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "checklist_trash_idx" ON "task_checklist_items" USING btree ("deleted_at") WHERE "task_checklist_items"."deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "checklist_task_position_idx" ON "task_checklist_items" USING btree ("user_id","task_id","position");--> statement-breakpoint
CREATE INDEX "task_tag_owner_created_idx" ON "task_tags" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "task_tag_trash_idx" ON "task_tags" USING btree ("deleted_at") WHERE "task_tags"."deleted_at" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "task_tag_unique" ON "task_tags" USING btree ("user_id","task_id","tag_id");--> statement-breakpoint
CREATE INDEX "task_owner_created_idx" ON "tasks" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "task_trash_idx" ON "tasks" USING btree ("deleted_at") WHERE "tasks"."deleted_at" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "task_occurrence_unique" ON "tasks" USING btree ("user_id","recurrence_source_id","occurrence_date");--> statement-breakpoint
CREATE INDEX "task_owner_status_due_idx" ON "tasks" USING btree ("user_id","status","due_at");--> statement-breakpoint
CREATE INDEX "task_project_idx" ON "tasks" USING btree ("user_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_lower_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "entitlement_owner_created_idx" ON "user_entitlements" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "entitlement_trash_idx" ON "user_entitlements" USING btree ("deleted_at") WHERE "user_entitlements"."deleted_at" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "entitlement_user_unique" ON "user_entitlements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "preferences_owner_created_idx" ON "user_preferences" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "preferences_trash_idx" ON "user_preferences" USING btree ("deleted_at") WHERE "user_preferences"."deleted_at" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "preferences_user_unique" ON "user_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "profile_owner_created_idx" ON "user_profiles" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "profile_trash_idx" ON "user_profiles" USING btree ("deleted_at") WHERE "user_profiles"."deleted_at" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "profile_user_unique" ON "user_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "verification_expiry_idx" ON "verifications" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "water_entry_owner_created_idx" ON "water_entries" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "water_entry_trash_idx" ON "water_entries" USING btree ("deleted_at") WHERE "water_entries"."deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "water_day_idx" ON "water_entries" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "workout_session_owner_created_idx" ON "workout_sessions" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "workout_session_trash_idx" ON "workout_sessions" USING btree ("deleted_at") WHERE "workout_sessions"."deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "workout_set_owner_created_idx" ON "workout_sets" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "workout_set_trash_idx" ON "workout_sets" USING btree ("deleted_at") WHERE "workout_sets"."deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "template_exercise_owner_created_idx" ON "workout_template_exercises" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "template_exercise_trash_idx" ON "workout_template_exercises" USING btree ("deleted_at") WHERE "workout_template_exercises"."deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "workout_template_owner_created_idx" ON "workout_templates" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "workout_template_trash_idx" ON "workout_templates" USING btree ("deleted_at") WHERE "workout_templates"."deleted_at" is not null;