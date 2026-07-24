import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { plans } from "./plans";

// Mirrors packages/database/migrations/0002_identity.sql.
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  status: text("status").notNull().$type<"active" | "suspended" | "pending_deletion">(),
  planId: text("plan_id")
    .notNull()
    .references(() => plans.id),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  deletionRequestedAt: text("deletion_requested_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at"),
});

export const passkeyCredentials = sqliteTable("passkey_credentials", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  label: text("label").notNull(),
  credentialId: text("credential_id").notNull(),
  publicKey: text("public_key").notNull(),
  signCount: integer("sign_count").notNull().default(0),
  transports: text("transports"),
  createdAt: text("created_at").notNull(),
  lastUsedAt: text("last_used_at"),
  removedAt: text("removed_at"),
});

export const recoveryCodes = sqliteTable("recovery_codes", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  codeHash: text("code_hash").notNull(),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  userAgent: text("user_agent"),
  ipHash: text("ip_hash"),
  isAdminSession: integer("is_admin_session", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  lastAuthenticatedAt: text("last_authenticated_at").notNull(),
  revokedAt: text("revoked_at"),
});

export const adminRoles = sqliteTable("admin_roles", {
  id: text("id")
    .primaryKey()
    .$type<
      | "super_admin"
      | "registry_manager"
      | "billing_viewer"
      | "support_viewer"
      | "security_administrator"
      | "content_manager"
    >(),
  name: text("name").notNull(),
  description: text("description").notNull(),
});

export const adminRoleAssignments = sqliteTable(
  "admin_role_assignments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    roleId: text("role_id")
      .notNull()
      .references(() => adminRoles.id),
    assignedByUserId: text("assigned_by_user_id").references(() => users.id),
    createdAt: text("created_at").notNull(),
    revokedAt: text("revoked_at"),
  },
  (table) => [uniqueIndex("idx_admin_role_assignments_user_role").on(table.userId, table.roleId)],
);
