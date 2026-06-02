export const prerender = false;

import type { APIRoute } from 'astro';
import { getEnv, json, listTags, queryFirst } from '../../../lib/documents-db';
import type { Tag } from '../../../types/documents';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export const GET: APIRoute = async ({ locals }) => {
  const { DB } = getEnv(locals as App.Locals);
  return json(await listTags(DB));
};

export const POST: APIRoute = async ({ request, locals }) => {
  const payload = await request.json().catch(() => null);
  if (!isRecord(payload)) {
    return json({ error: 'Érvénytelen kérés.' }, { status: 400 });
  }

  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const slug = typeof payload.slug === 'string' ? payload.slug.trim() : '';
  const color = typeof payload.color === 'string' && payload.color.trim() ? payload.color.trim() : null;
  const sortOrder = typeof payload.sort_order === 'number' && Number.isFinite(payload.sort_order) ? payload.sort_order : 0;

  if (!name || !slug) {
    return json({ error: 'A név és a slug megadása kötelező.' }, { status: 400 });
  }

  const { DB } = getEnv(locals as App.Locals);
  const insert = await DB.prepare('INSERT INTO tags (name, slug, color, sort_order) VALUES (?, ?, ?, ?)')
    .bind(name, slug, color, sortOrder)
    .run();

  const tag = await queryFirst<Tag>(DB, 'SELECT * FROM tags WHERE id = ?', Number(insert.meta.last_row_id));
  return json(tag ?? { id: Number(insert.meta.last_row_id), name, slug, color, sort_order: sortOrder }, { status: 201 });
};
