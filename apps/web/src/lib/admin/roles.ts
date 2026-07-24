import { and, eq, isNull } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";

export type AdminRoleId = (typeof schema.adminRoles.$inferSelect)["id"];

/** SRS §28.18: initial release uses only Super Admin; the data model already
 * supports the other five roles for later assignment without code changes. */
export const ALL_ADMIN_ROLES: AdminRoleId[] = [
  "super_admin",
  "registry_manager",
  "billing_viewer",
  "support_viewer",
  "security_administrator",
  "content_manager",
];

export async function getActiveAdminRoles(db: Database, userId: string): Promise<AdminRoleId[]> {
  const rows = await db
    .select({ roleId: schema.adminRoleAssignments.roleId })
    .from(schema.adminRoleAssignments)
    .where(
      and(
        eq(schema.adminRoleAssignments.userId, userId),
        isNull(schema.adminRoleAssignments.revokedAt),
      ),
    );
  return rows.map((r) => r.roleId as AdminRoleId);
}

/** super_admin implicitly has every capability — a narrower role must be explicitly assigned. */
export function hasAdminRole(roles: AdminRoleId[], required: AdminRoleId): boolean {
  return roles.includes("super_admin") || roles.includes(required);
}
