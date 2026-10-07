ALTER TABLE "ai_action_logs" DROP CONSTRAINT "action_conversation_fk";
--> statement-breakpoint
ALTER TABLE "ai_messages" DROP CONSTRAINT "message_conversation_fk";
--> statement-breakpoint
ALTER TABLE "budgets" DROP CONSTRAINT "budget_category_fk";
--> statement-breakpoint
ALTER TABLE "calendar_event_mappings" DROP CONSTRAINT "mapping_event_fk";
--> statement-breakpoint
ALTER TABLE "calendar_event_mappings" DROP CONSTRAINT "mapping_calendar_fk";
--> statement-breakpoint
ALTER TABLE "calendar_events" DROP CONSTRAINT "calendar_event_project_fk";
--> statement-breakpoint
ALTER TABLE "calendar_sync_state" DROP CONSTRAINT "sync_calendar_fk";
--> statement-breakpoint
ALTER TABLE "drive_links" DROP CONSTRAINT "drive_link_project_fk";
--> statement-breakpoint
ALTER TABLE "drive_links" DROP CONSTRAINT "drive_link_task_fk";
--> statement-breakpoint
ALTER TABLE "drive_links" DROP CONSTRAINT "drive_link_event_fk";
--> statement-breakpoint
ALTER TABLE "drive_links" DROP CONSTRAINT "drive_link_transaction_fk";
--> statement-breakpoint
ALTER TABLE "drive_links" DROP CONSTRAINT "drive_link_inbox_fk";
--> statement-breakpoint
ALTER TABLE "drive_links" DROP CONSTRAINT "drive_link_habit_fk";
--> statement-breakpoint
ALTER TABLE "finance_transactions" DROP CONSTRAINT "transaction_account_fk";
--> statement-breakpoint
ALTER TABLE "finance_transactions" DROP CONSTRAINT "transaction_destination_fk";
--> statement-breakpoint
ALTER TABLE "finance_transactions" DROP CONSTRAINT "transaction_category_fk";
--> statement-breakpoint
ALTER TABLE "finance_transactions" DROP CONSTRAINT "transaction_recurrence_fk";
--> statement-breakpoint
ALTER TABLE "google_calendars" DROP CONSTRAINT "google_calendar_connection_fk";
--> statement-breakpoint
ALTER TABLE "google_watch_channels" DROP CONSTRAINT "watch_calendar_fk";
--> statement-breakpoint
ALTER TABLE "habit_entries" DROP CONSTRAINT "habit_entry_habit_fk";
--> statement-breakpoint
ALTER TABLE "inbox_items" DROP CONSTRAINT "inbox_item_box_fk";
--> statement-breakpoint
ALTER TABLE "meal_entry_items" DROP CONSTRAINT "meal_item_meal_fk";
--> statement-breakpoint
ALTER TABLE "meal_entry_items" DROP CONSTRAINT "meal_item_food_fk";
--> statement-breakpoint
ALTER TABLE "recurring_transactions" DROP CONSTRAINT "recurring_account_fk";
--> statement-breakpoint
ALTER TABLE "recurring_transactions" DROP CONSTRAINT "recurring_category_fk";
--> statement-breakpoint
ALTER TABLE "reminder_deliveries" DROP CONSTRAINT "delivery_reminder_fk";
--> statement-breakpoint
ALTER TABLE "reminder_rules" DROP CONSTRAINT "reminder_project_fk";
--> statement-breakpoint
ALTER TABLE "reminder_rules" DROP CONSTRAINT "reminder_task_fk";
--> statement-breakpoint
ALTER TABLE "reminder_rules" DROP CONSTRAINT "reminder_event_fk";
--> statement-breakpoint
ALTER TABLE "reminder_rules" DROP CONSTRAINT "reminder_transaction_fk";
--> statement-breakpoint
ALTER TABLE "reminder_rules" DROP CONSTRAINT "reminder_inbox_fk";
--> statement-breakpoint
ALTER TABLE "reminder_rules" DROP CONSTRAINT "reminder_habit_fk";
--> statement-breakpoint
ALTER TABLE "savings_contributions" DROP CONSTRAINT "contribution_goal_fk";
--> statement-breakpoint
ALTER TABLE "savings_contributions" DROP CONSTRAINT "contribution_transaction_fk";
--> statement-breakpoint
ALTER TABLE "task_checklist_items" DROP CONSTRAINT "checklist_task_fk";
--> statement-breakpoint
ALTER TABLE "task_tags" DROP CONSTRAINT "task_tag_task_fk";
--> statement-breakpoint
ALTER TABLE "task_tags" DROP CONSTRAINT "task_tag_tag_fk";
--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "task_project_fk";
--> statement-breakpoint
ALTER TABLE "workout_sessions" DROP CONSTRAINT "session_template_fk";
--> statement-breakpoint
ALTER TABLE "workout_sets" DROP CONSTRAINT "set_session_fk";
--> statement-breakpoint
ALTER TABLE "workout_sets" DROP CONSTRAINT "set_exercise_fk";
--> statement-breakpoint
ALTER TABLE "workout_template_exercises" DROP CONSTRAINT "template_exercise_template_fk";
--> statement-breakpoint
ALTER TABLE "workout_template_exercises" DROP CONSTRAINT "template_exercise_exercise_fk";
--> statement-breakpoint
ALTER TABLE "ai_action_logs" ADD CONSTRAINT "action_conversation_fk" FOREIGN KEY ("user_id","conversation_id") REFERENCES "public"."ai_conversations"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "message_conversation_fk" FOREIGN KEY ("user_id","conversation_id") REFERENCES "public"."ai_conversations"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budget_category_fk" FOREIGN KEY ("user_id","category_id") REFERENCES "public"."finance_categories"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event_mappings" ADD CONSTRAINT "mapping_event_fk" FOREIGN KEY ("user_id","event_id") REFERENCES "public"."calendar_events"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event_mappings" ADD CONSTRAINT "mapping_calendar_fk" FOREIGN KEY ("user_id","calendar_id") REFERENCES "public"."google_calendars"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_event_project_fk" FOREIGN KEY ("user_id","project_id") REFERENCES "public"."projects"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_sync_state" ADD CONSTRAINT "sync_calendar_fk" FOREIGN KEY ("user_id","calendar_id") REFERENCES "public"."google_calendars"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_links" ADD CONSTRAINT "drive_link_project_fk" FOREIGN KEY ("user_id","project_id") REFERENCES "public"."projects"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_links" ADD CONSTRAINT "drive_link_task_fk" FOREIGN KEY ("user_id","task_id") REFERENCES "public"."tasks"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_links" ADD CONSTRAINT "drive_link_event_fk" FOREIGN KEY ("user_id","event_id") REFERENCES "public"."calendar_events"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_links" ADD CONSTRAINT "drive_link_transaction_fk" FOREIGN KEY ("user_id","transaction_id") REFERENCES "public"."finance_transactions"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_links" ADD CONSTRAINT "drive_link_inbox_fk" FOREIGN KEY ("user_id","inbox_item_id") REFERENCES "public"."inbox_items"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_links" ADD CONSTRAINT "drive_link_habit_fk" FOREIGN KEY ("user_id","habit_id") REFERENCES "public"."habits"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transactions" ADD CONSTRAINT "transaction_account_fk" FOREIGN KEY ("user_id","account_id") REFERENCES "public"."financial_accounts"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transactions" ADD CONSTRAINT "transaction_destination_fk" FOREIGN KEY ("user_id","destination_account_id") REFERENCES "public"."financial_accounts"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transactions" ADD CONSTRAINT "transaction_category_fk" FOREIGN KEY ("user_id","category_id") REFERENCES "public"."finance_categories"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transactions" ADD CONSTRAINT "transaction_recurrence_fk" FOREIGN KEY ("user_id","recurring_transaction_id") REFERENCES "public"."recurring_transactions"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_calendars" ADD CONSTRAINT "google_calendar_connection_fk" FOREIGN KEY ("user_id","connection_id") REFERENCES "public"."google_workspace_connections"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_watch_channels" ADD CONSTRAINT "watch_calendar_fk" FOREIGN KEY ("user_id","calendar_id") REFERENCES "public"."google_calendars"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_entries" ADD CONSTRAINT "habit_entry_habit_fk" FOREIGN KEY ("user_id","habit_id") REFERENCES "public"."habits"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_items" ADD CONSTRAINT "inbox_item_box_fk" FOREIGN KEY ("user_id","box_id") REFERENCES "public"."inbox_boxes"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_entry_items" ADD CONSTRAINT "meal_item_meal_fk" FOREIGN KEY ("user_id","meal_entry_id") REFERENCES "public"."meal_entries"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_entry_items" ADD CONSTRAINT "meal_item_food_fk" FOREIGN KEY ("user_id","food_id") REFERENCES "public"."custom_foods"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_account_fk" FOREIGN KEY ("user_id","account_id") REFERENCES "public"."financial_accounts"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_category_fk" FOREIGN KEY ("user_id","category_id") REFERENCES "public"."finance_categories"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_deliveries" ADD CONSTRAINT "delivery_reminder_fk" FOREIGN KEY ("user_id","reminder_id") REFERENCES "public"."reminder_rules"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_rules" ADD CONSTRAINT "reminder_project_fk" FOREIGN KEY ("user_id","project_id") REFERENCES "public"."projects"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_rules" ADD CONSTRAINT "reminder_task_fk" FOREIGN KEY ("user_id","task_id") REFERENCES "public"."tasks"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_rules" ADD CONSTRAINT "reminder_event_fk" FOREIGN KEY ("user_id","event_id") REFERENCES "public"."calendar_events"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_rules" ADD CONSTRAINT "reminder_transaction_fk" FOREIGN KEY ("user_id","transaction_id") REFERENCES "public"."finance_transactions"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_rules" ADD CONSTRAINT "reminder_inbox_fk" FOREIGN KEY ("user_id","inbox_item_id") REFERENCES "public"."inbox_items"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_rules" ADD CONSTRAINT "reminder_habit_fk" FOREIGN KEY ("user_id","habit_id") REFERENCES "public"."habits"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_contributions" ADD CONSTRAINT "contribution_goal_fk" FOREIGN KEY ("user_id","goal_id") REFERENCES "public"."savings_goals"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_contributions" ADD CONSTRAINT "contribution_transaction_fk" FOREIGN KEY ("user_id","transaction_id") REFERENCES "public"."finance_transactions"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "checklist_task_fk" FOREIGN KEY ("user_id","task_id") REFERENCES "public"."tasks"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tag_task_fk" FOREIGN KEY ("user_id","task_id") REFERENCES "public"."tasks"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tag_tag_fk" FOREIGN KEY ("user_id","tag_id") REFERENCES "public"."tags"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "task_project_fk" FOREIGN KEY ("user_id","project_id") REFERENCES "public"."projects"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD CONSTRAINT "session_template_fk" FOREIGN KEY ("user_id","template_id") REFERENCES "public"."workout_templates"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD CONSTRAINT "set_session_fk" FOREIGN KEY ("user_id","session_id") REFERENCES "public"."workout_sessions"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD CONSTRAINT "set_exercise_fk" FOREIGN KEY ("user_id","exercise_id") REFERENCES "public"."exercises"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_template_exercises" ADD CONSTRAINT "template_exercise_template_fk" FOREIGN KEY ("user_id","template_id") REFERENCES "public"."workout_templates"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_template_exercises" ADD CONSTRAINT "template_exercise_exercise_fk" FOREIGN KEY ("user_id","exercise_id") REFERENCES "public"."exercises"("user_id","id") ON DELETE no action ON UPDATE no action;