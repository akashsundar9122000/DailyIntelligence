import "server-only";

import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import type { Tx } from "@/lib/db/scope";
import { textArray } from "@/lib/db/sql";
import type { Provider } from "@/lib/db/schema/news";
import { SOURCE_CATALOGUE, type SourceDefinition } from "@/lib/sources/catalogue";

import { gdeltGkgAdapter } from "./adapters/gdelt-gkg";
import { rssAdapter } from "./adapters/rss";
import type { SourceAdapter } from "./types";

/** The adapters that exist. A cleared source whose provider has none yet stays off, with that reason. */
export const ADAPTERS: Partial<Record<Provider, SourceAdapter>> = {
  gdelt_gkg: gdeltGkgAdapter,
  rss: rssAdapter,
};

/** The prefix an administrator's own "switched off" carries. The catalogue never switches such a source back on. */
export const ADMIN_DISABLED = "admin:";

function wanted(source: SourceDefinition): { enabled: boolean; reason: string | null } {
  if (source.rights.status !== "cleared") return { enabled: false, reason: `rights: ${source.rights.status.replace("_", " ")}` };
  if (!ADAPTERS[source.provider]) return { enabled: false, reason: "no adapter for this provider yet" };
  return { enabled: true, reason: null };
}

/**
 * Mirror the catalogue into `sources`. Rights, names and cadence come from the
 * catalogue every time, so a rights decision made in code reaches the
 * database on the next tick. What the database learned by running -- cursor,
 * ETag, health, failures -- is never touched here, and neither is a source an
 * administrator switched off.
 */
export async function syncCatalogue(tx: Tx): Promise<number> {
  for (const source of SOURCE_CATALOGUE) {
    const r = source.rights;
    const { enabled, reason } = wanted(source);
    await tx.execute(sql`
      insert into sources (id, key, name, canonical_domain, source_type, provider, feed_url, country_or_region, language, categories, is_official,
                           rights_status, terms_url, rights_checked_on, rights_note, commercial_use_allowed, headline_display_allowed,
                           excerpt_display_allowed, ai_summary_allowed, media_reuse_allowed, retention_days, attribution_text,
                           enabled, disable_reason, priority, poll_interval_seconds, config, health_status)
      values (${uuidv7()}::uuid, ${source.key}, ${source.name}, ${source.canonicalDomain}, ${source.sourceType}, ${source.provider}, ${source.feedUrl},
              ${source.countryOrRegion}, ${source.language}, ${textArray(source.categories)}, ${source.isOfficial},
              ${r.status}, ${r.termsUrl}, ${r.checkedOn}, ${r.note}, ${r.commercialUse}, ${r.headline},
              ${r.excerpt}, ${r.aiSummary}, ${r.media}, ${r.retentionDays}, ${r.attribution},
              ${enabled}, ${reason}, ${source.priority}, ${source.pollIntervalSeconds}, ${JSON.stringify(source.config ?? {})}::jsonb,
              ${enabled ? "unknown" : "disabled"})
      on conflict (key) do update set
        name = excluded.name, canonical_domain = excluded.canonical_domain, source_type = excluded.source_type, provider = excluded.provider,
        feed_url = excluded.feed_url, country_or_region = excluded.country_or_region, language = excluded.language,
        categories = excluded.categories, is_official = excluded.is_official,
        rights_status = excluded.rights_status, terms_url = excluded.terms_url, rights_checked_on = excluded.rights_checked_on,
        rights_note = excluded.rights_note, commercial_use_allowed = excluded.commercial_use_allowed,
        headline_display_allowed = excluded.headline_display_allowed, excerpt_display_allowed = excluded.excerpt_display_allowed,
        ai_summary_allowed = excluded.ai_summary_allowed, media_reuse_allowed = excluded.media_reuse_allowed,
        retention_days = excluded.retention_days, attribution_text = excluded.attribution_text,
        priority = excluded.priority, poll_interval_seconds = excluded.poll_interval_seconds, config = excluded.config,
        enabled = case when sources.disable_reason like ${`${ADMIN_DISABLED}%`} then false else excluded.enabled end,
        disable_reason = case when sources.disable_reason like ${`${ADMIN_DISABLED}%`} then sources.disable_reason else excluded.disable_reason end,
        health_status = case when sources.disable_reason like ${`${ADMIN_DISABLED}%`} then 'disabled'
                             when excluded.enabled and sources.health_status = 'disabled' then 'unknown'
                             when not excluded.enabled then 'disabled' else sources.health_status end,
        updated_at = now()`);
  }
  return SOURCE_CATALOGUE.length;
}
