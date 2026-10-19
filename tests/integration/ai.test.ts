import pg from "pg";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { EXPLAINER_PROMPT_VERSION } from "@/lib/ai/explainer";
import { AiUnavailable, type ChatModel, type ChatRequest } from "@/lib/ai/nvidia-client";
import { closeDb } from "@/lib/db/client";
import { explainerFor, latestEditionBriefing } from "@/lib/queries/ai";
import { askAboutStory } from "@/lib/services/ask";
import { runEnrichment } from "@/lib/services/enrichment";

import { createVerifiedUser } from "./auth-helpers";

/*
 * The AI layer against the real test database, with a scripted model in
 * place of the hosted one: the same ChatModel seam production uses, so every
 * query, rule and write here is the production code. Every record is invented
 * test text. None of it is news.
 */

afterAll(async () => {
  await closeDb();
});

async function ownerQuery<T extends pg.QueryResultRow>(text: string, values: unknown[] = []): Promise<T[]> {
  const owner = new pg.Client({ connectionString: process.env.DATABASE_URL_TEST_OWNER });
  await owner.connect();
  try {
    return (await owner.query<T>(text, values)).rows;
  } finally {
    await owner.end();
  }
}

/** A model that answers from a script, and remembers what it was asked. */
function scriptedModel(answers: (string | Error)[]): ChatModel & { requests: ChatRequest[] } {
  const requests: ChatRequest[] = [];
  return {
    requestId: "scripted",
    requests,
    async complete(request) {
      requests.push(structuredClone(request));
      const next = answers.length > 1 ? answers.shift()! : answers[0]!;
      if (next instanceof Error) throw next;
      return { content: next, toolCalls: [], model: "scripted/test", usage: { promptTokens: 100, completionTokens: 50 } };
    },
  };
}

const explainer = (oneMinute: { text: string; cites: string[] }[], categories: string[] = []) =>
  JSON.stringify({ oneMinute, whatHappened: [], whyItMatters: [], keyDetails: [], whatsNext: [], categories });

type Seeded = { storyId: string; officialItem: string; reportItem: string };

/** One story, two publishers: an official bureau whose terms permit AI over its text, and a news index whose terms do not. */
async function seedStory({ categories = ["climate"], excerptOnIndex = "The index's own text, which its terms forbid a model to read." } = {}): Promise<Seeded> {
  const source = async (key: string, type: string, official: boolean, ai: boolean) =>
    (
      await ownerQuery<{ id: string }>(
        `insert into sources (id, key, name, canonical_domain, source_type, provider, feed_url, country_or_region, is_official, rights_status,
                              headline_display_allowed, excerpt_display_allowed, ai_summary_allowed, enabled)
         values (gen_random_uuid(), $1 || '-' || gen_random_uuid(), $1, $1 || '.example', $2, 'rss', 'https://fixtures.invalid/feed', 'IN', $3, 'cleared', true, true, $4, true)
         returning id`,
        [key, type, official, ai],
      )
    )[0]!.id;
  const bureau = await source("ai-bureau", "official", true, true);
  const index = await source("ai-index", "aggregator", false, false);
  const item = async (sourceId: string, title: string, excerpt: string | null, type: string, domain: string) =>
    (
      await ownerQuery<{ id: string }>(
        `insert into raw_source_items (id, source_id, provider_item_id, canonical_url, url_hash, publisher_domain, publisher_name, title, normalized_title, excerpt, content_type, published_at)
         values (gen_random_uuid(), $1, gen_random_uuid()::text, 'https://' || $5 || '/' || gen_random_uuid(), md5(random()::text), $5, $5, $2, lower($2), $3, $4, now() - interval '1 hour')
         returning id`,
        [sourceId, title, excerpt, type, domain],
      )
    )[0]!.id;
  const officialItem = await item(bureau, "Bureau releases ₹25 crore for flood relief in 14 villages", "The bureau said relief reaches 14 villages this week.", "official_statement", "bureau.example");
  const reportItem = await item(index, "Floods cut off 14 hill villages after three days of rain", excerptOnIndex, "report", "paper.example");
  const storyId = (
    await ownerQuery<{ id: string }>(
      `insert into stories (id, headline, headline_item_id, signature, categories, primary_category, scope, source_count, item_count, official_count, importance, heat, last_updated_at)
       values (gen_random_uuid(), 'Floods cut off 14 hill villages after three days of rain', $1, 'floods ' || gen_random_uuid(), $2, $3, 'india', 2, 2, 1, 90, 60, now())
       returning id`,
      [reportItem, categories, categories[0] ?? null],
    )
  )[0]!.id;
  for (const id of [officialItem, reportItem]) await ownerQuery(`insert into story_items (id, story_id, item_id, association_confidence, method) values (gen_random_uuid(), $1, $2, 90, 'title')`, [storyId, id]);
  return { storyId, officialItem, reportItem };
}

beforeEach(async () => {
  await ownerQuery("truncate sources, raw_source_items, stories, story_items, story_updates, story_scores, ai_briefings, ingestion_runs, job_runs cascade");
});

const GOOD = explainer([
  { text: "Floods have cut off 14 hill villages after three days of rain.", cites: ["S2"] },
  { text: "The bureau said ₹25 crore has been released for relief.", cites: ["S1"] },
]);

describe("story explainers", () => {
  it("writes one from the story's records, keeps what it was written from, and shows it", async () => {
    const { storyId, officialItem, reportItem } = await seedStory();
    const model = scriptedModel([GOOD]);
    const { detail } = await runEnrichment({ trigger: "test", model });
    expect(detail).toMatchObject({ configured: true, explained: 1, rejected: 0, failed: 0 });

    const row = (await ownerQuery<{ status: string; model: string; prompt_version: string; source_item_ids: string[] }>("select status, model, prompt_version, source_item_ids from ai_briefings"))[0]!;
    expect(row).toMatchObject({ status: "ready", model: "scripted/test", prompt_version: EXPLAINER_PROMPT_VERSION });
    // Official first: S1 is the bureau, S2 the report. The order is how a citation finds its source on the page.
    expect(row.source_item_ids).toEqual([officialItem, reportItem]);

    const shown = await explainerFor(storyId);
    expect(shown?.content.oneMinute[0]!.text).toBe("Floods have cut off 14 hill villages after three days of rain.");
    expect(shown?.content.textRead).toBe(true);
  });

  it("never sends a model text whose source's terms forbid it", async () => {
    await seedStory();
    const model = scriptedModel([GOOD]);
    await runEnrichment({ trigger: "test", model });
    const sent = model.requests[0]!.messages.map((message) => message.content ?? "").join("\n");
    expect(sent).toContain("The bureau said relief reaches 14 villages this week.");
    expect(sent).toContain("Floods cut off 14 hill villages after three days of rain");
    expect(sent).not.toContain("The index's own text");
  });

  it("does not ask again for the same records", async () => {
    await seedStory();
    const model = scriptedModel([GOOD]);
    await runEnrichment({ trigger: "test", model });
    await runEnrichment({ trigger: "test", model });
    expect(model.requests).toHaveLength(1);
  });

  it("rejects an invented figure after one chance to correct it, keeps the record, and shows the reader nothing", async () => {
    const { storyId } = await seedStory();
    const invented = explainer([{ text: "Floods have killed 37 people in the hill villages.", cites: ["S2"] }]);
    const model = scriptedModel([invented, invented]);
    const { detail } = await runEnrichment({ trigger: "test", model });
    expect(detail).toMatchObject({ explained: 0, rejected: 1 });
    expect(model.requests).toHaveLength(2);
    // The second request told the model exactly what was wrong.
    expect(model.requests[1]!.messages.at(-1)!.content).toContain("37");

    const rows = await ownerQuery<{ status: string; rejection: string }>("select status, rejection from ai_briefings");
    expect(rows).toEqual([{ status: "rejected", rejection: expect.stringContaining("unsupported-number: 37") }]);
    expect(await explainerFor(storyId)).toBeNull();
  });

  it("hides a rejected output from a reader's query at the database, not only in the WHERE clause", async () => {
    await seedStory();
    const invented = explainer([{ text: "Floods have killed 37 people.", cites: ["S2"] }]);
    await runEnrichment({ trigger: "test", model: scriptedModel([invented]) });
    const app = new pg.Client({ connectionString: process.env.DATABASE_URL_TEST });
    await app.connect();
    try {
      const rows = (await app.query("select count(*)::int as n from ai_briefings")).rows;
      expect(rows[0].n).toBe(0);
    } finally {
      await app.end();
    }
  });

  it("records a model that cannot be reached, and does not ask again within the hour", async () => {
    const { storyId } = await seedStory();
    const model = scriptedModel([new AiUnavailable()]);
    const { detail } = await runEnrichment({ trigger: "test", model });
    expect(detail).toMatchObject({ failed: 1 });
    await runEnrichment({ trigger: "test", model });
    expect(model.requests).toHaveLength(1);
    expect(await explainerFor(storyId)).toBeNull();
  });

  it("puts a story in a section the model chose only when the rules found none, and says so", async () => {
    const { storyId } = await seedStory({ categories: [] });
    await runEnrichment({ trigger: "test", model: scriptedModel([explainer(JSON.parse(GOOD).oneMinute, ["climate"])]) });
    expect((await ownerQuery<{ categories: string[]; categories_by: string }>("select categories, categories_by from stories where id = $1", [storyId]))[0]).toEqual({
      categories: ["climate"],
      categories_by: "ai",
    });
  });

  it("keeps a sound explainer whose suggested section is not on the paper's list, and drops the section", async () => {
    const { storyId } = await seedStory({ categories: [] });
    const { detail } = await runEnrichment({ trigger: "test", model: scriptedModel([explainer(JSON.parse(GOOD).oneMinute, ["us-politics"])]) });
    expect(detail).toMatchObject({ explained: 1, rejected: 0 });
    expect((await ownerQuery<{ categories: string[]; categories_by: string }>("select categories, categories_by from stories where id = $1", [storyId]))[0]).toEqual({ categories: [], categories_by: "rules" });
  });

  it("is withdrawn from the page when a source it cited is withdrawn", async () => {
    const { storyId, officialItem } = await seedStory();
    await runEnrichment({ trigger: "test", model: scriptedModel([GOOD]) });
    await ownerQuery("update sources set rights_status = 'excluded', enabled = false where id = (select source_id from raw_source_items where id = $1)", [officialItem]);
    expect(await explainerFor(storyId)).toBeNull();
  });
});

describe("the edition briefing", () => {
  it("is written from three or more explained stories, each line checked against its own story", async () => {
    for (let n = 0; n < 3; n++) await seedStory();
    const briefing = JSON.stringify({
      lines: [
        { ref: "B1", text: "Floods have cut off 14 hill villages." },
        { ref: "B2", text: "The bureau said relief reaches 14 villages." },
        { ref: "B3", text: "Floods cut off 14 hill villages after three days of rain." },
      ],
    });
    const { detail } = await runEnrichment({ trigger: "test", model: scriptedModel([GOOD, GOOD, GOOD, briefing]) });
    expect(detail.explained).toBe(3);
    expect(detail.briefing?.status).toBe("ready");
    const shown = await latestEditionBriefing();
    expect(shown?.lines).toHaveLength(3);
    expect(shown?.lines[0]!.text).toBe("Floods have cut off 14 hill villages.");
  });

  it("waits when fewer than three stories are explained", async () => {
    await seedStory();
    const { detail } = await runEnrichment({ trigger: "test", model: scriptedModel([GOOD]) });
    expect(detail.briefing?.status).toBe("not due");
  });
});

describe("asking about a story", () => {
  it("answers from the records, with citations that lead to them", async () => {
    const { storyId, officialItem } = await seedStory();
    const { userId } = await createVerifiedUser();
    const model = scriptedModel([JSON.stringify({ answerable: true, answer: [{ text: "The bureau said ₹25 crore was released.", cites: ["S1"] }] })]);
    const result = await askAboutStory(userId, storyId, "How much money was released?", model);
    expect(result).toEqual({ kind: "answer", claims: [{ text: "The bureau said ₹25 crore was released.", cites: ["S1"] }], refs: { S1: { itemId: officialItem, publisher: "bureau.example" } }, model: "scripted/test" });
  });

  it("says the sources do not say, rather than show an answer that failed its checks", async () => {
    const { storyId } = await seedStory();
    const { userId } = await createVerifiedUser();
    const invented = JSON.stringify({ answerable: true, answer: [{ text: "The chief minister visited on Tuesday with 40 officials.", cites: ["S2"] }] });
    expect(await askAboutStory(userId, storyId, "Who visited?", scriptedModel([invented]))).toEqual({ kind: "not-in-sources" });
    expect(await askAboutStory(userId, storyId, "Who visited?", scriptedModel([JSON.stringify({ answerable: false, answer: [] })]))).toEqual({ kind: "not-in-sources" });
  });

  it("is limited per reader, and an unknown story is not found", async () => {
    vi.stubEnv("AI_LIMIT_PER_USER", "1");
    vi.resetModules();
    const fresh = await import("@/lib/services/ask");
    const { storyId } = await seedStory();
    const { userId } = await createVerifiedUser();
    const model = scriptedModel([JSON.stringify({ answerable: false, answer: [] })]);
    await fresh.askAboutStory(userId, storyId, "Who said it?", model);
    await expect(fresh.askAboutStory(userId, storyId, "Who said it?", model)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    vi.unstubAllEnvs();
    await (await import("@/lib/db/client")).closeDb();
    const other = await createVerifiedUser();
    await expect(askAboutStory(other.userId, "00000000-0000-4000-8000-000000000000", "Who said it?", model)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
