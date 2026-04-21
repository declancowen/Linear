/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as app from "../app.js";
import type * as app_access from "../app/access.js";
import type * as app_assets from "../app/assets.js";
import type * as app_audit from "../app/audit.js";
import type * as app_auth_bootstrap from "../app/auth_bootstrap.js";
import type * as app_claim_utils from "../app/claim_utils.js";
import type * as app_cleanup from "../app/cleanup.js";
import type * as app_collaboration_handlers from "../app/collaboration_handlers.js";
import type * as app_collaboration_utils from "../app/collaboration_utils.js";
import type * as app_comment_handlers from "../app/comment_handlers.js";
import type * as app_conversations from "../app/conversations.js";
import type * as app_core from "../app/core.js";
import type * as app_data from "../app/data.js";
import type * as app_document_handlers from "../app/document_handlers.js";
import type * as app_email_job_handlers from "../app/email_job_handlers.js";
import type * as app_invite_handlers from "../app/invite_handlers.js";
import type * as app_label_workspace from "../app/label_workspace.js";
import type * as app_lifecycle from "../app/lifecycle.js";
import type * as app_maintenance from "../app/maintenance.js";
import type * as app_normalization from "../app/normalization.js";
import type * as app_notification_handlers from "../app/notification_handlers.js";
import type * as app_notifications from "../app/notifications.js";
import type * as app_project_handlers from "../app/project_handlers.js";
import type * as app_server_users from "../app/server_users.js";
import type * as app_team_feature_guards from "../app/team_feature_guards.js";
import type * as app_view_handlers from "../app/view_handlers.js";
import type * as app_work_helpers from "../app/work_helpers.js";
import type * as app_work_item_handlers from "../app/work_item_handlers.js";
import type * as app_workspace_team_handlers from "../app/workspace_team_handlers.js";
import type * as email_job_mutations from "../email_job_mutations.js";
import type * as email_jobs from "../email_jobs.js";
import type * as validators from "../validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  app: typeof app;
  "app/access": typeof app_access;
  "app/assets": typeof app_assets;
  "app/audit": typeof app_audit;
  "app/auth_bootstrap": typeof app_auth_bootstrap;
  "app/claim_utils": typeof app_claim_utils;
  "app/cleanup": typeof app_cleanup;
  "app/collaboration_handlers": typeof app_collaboration_handlers;
  "app/collaboration_utils": typeof app_collaboration_utils;
  "app/comment_handlers": typeof app_comment_handlers;
  "app/conversations": typeof app_conversations;
  "app/core": typeof app_core;
  "app/data": typeof app_data;
  "app/document_handlers": typeof app_document_handlers;
  "app/email_job_handlers": typeof app_email_job_handlers;
  "app/invite_handlers": typeof app_invite_handlers;
  "app/label_workspace": typeof app_label_workspace;
  "app/lifecycle": typeof app_lifecycle;
  "app/maintenance": typeof app_maintenance;
  "app/normalization": typeof app_normalization;
  "app/notification_handlers": typeof app_notification_handlers;
  "app/notifications": typeof app_notifications;
  "app/project_handlers": typeof app_project_handlers;
  "app/server_users": typeof app_server_users;
  "app/team_feature_guards": typeof app_team_feature_guards;
  "app/view_handlers": typeof app_view_handlers;
  "app/work_helpers": typeof app_work_helpers;
  "app/work_item_handlers": typeof app_work_item_handlers;
  "app/workspace_team_handlers": typeof app_workspace_team_handlers;
  email_job_mutations: typeof email_job_mutations;
  email_jobs: typeof email_jobs;
  validators: typeof validators;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
