export const prerender = false;

import type { APIRoute } from 'astro';
import { getEnv, getTopic, json, listTopics } from '../../../lib/documents-db';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export const GET: APIRoute = async ({ locals }) => {
  const { DB } = getEnv(locals as App.Locals);
  const topics = await listTopics(DB, true);
  return json(topics);
};

export const POST: APIRoute = async ({ request, locals }) => {
  const payload = await request.json().catch(() => null);
  if (!isRecord(payload)) {
    return json({ error: 'Érvénytelen kérés.' }, { status: 400 });
  }

  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const eventDate = typeof payload.event_date === 'string' && payload.event_date.trim() ? payload.event_date : null;
  const sortOrder = typeof payload.sort_order === 'number' && Number.isFinite(payload.sort_order) ? payload.sort_order : 0;
  const tagIds = Array.isArray(payload.tag_ids)
    ? payload.tag_ids.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)
    : [];

  if (!title) {
    return json({ error: 'A cím megadása kötelező.' }, { status: 400 });
  }

  const { DB } = getEnv(locals as App.Locals);
  const insert = await DB.prepare(
    'INSERT INTO topics (title, event_date, document_count, sort_order, is_public) VALUES (?, ?, 0, ?, 1)',
  )
    .bind(title, eventDate, sortOrder)
    .run();

  const topicId = Number(insert.meta.last_row_id);

  for (const tagId of [...new Set(tagIds)]) {
    await DB.prepare('INSERT INTO topic_tags (topic_id, tag_id) VALUES (?, ?)').bind(topicId, tagId).run();
  }

  const topic = await getTopic(DB, topicId);
  return json(topic ?? { id: topicId, title, event_date: eventDate, sort_order: sortOrder, is_public: 1, document_count: 0, tags: [] }, { status: 201 });
};
