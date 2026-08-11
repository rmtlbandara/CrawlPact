import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./identity";
import { registryVersions } from "./registry";

// Mirrors packages/database/migrations/0035_research_publications.sql.
export const researchPublications = sqliteTable("research_publications", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  kind: text("kind").notNull().$type<"registry_landscape">(),
  status: text("status")
    .notNull()
    .$type<"draft" | "review" | "published" | "corrected" | "superseded" | "withdrawn">()
    .default("draft"),
  title: text("title").notNull(),
  methodologyVersion: text("methodology_version").notNull(),
  registryVersionId: text("registry_version_id")
    .notNull()
    .references(() => registryVersions.id),
  /** Deterministic, code-generated publication body — see registry-observatory.ts. */
  contentJson: text("content_json").notNull(),
  checksum: text("checksum").notNull(),
  /** JSON array of {date, what, why, conclusionsChanged} — never a silent edit. */
  correctionLog: text("correction_log").notNull().default("[]"),
  supersededByPublicationId: text("superseded_by_publication_id"),
  withdrawalReason: text("withdrawal_reason"),
  createdByUserId: text("created_by_user_id").references(() => users.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  publishedAt: text("published_at"),
  correctedAt: text("corrected_at"),
});
