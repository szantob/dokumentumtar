export const prerender = false;

import type { APIRoute } from 'astro';
import { getEnv, json, queryFirst, refreshTopicDocumentCount } from '../../../../lib/documents-db';

interface DocumentRow {
  id: number;
  topic_id: number;
  r2_key: string;
  is_active: number;
}

export const DELETE: APIRoute = async ({ params, locals }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return json({ error: 'Érvénytelen azonosító.' }, { status: 400 });
  }

  const { DB, DOKUMENTUMTAR } = getEnv(locals as App.Locals);

  const document = await queryFirst<DocumentRow>(
    DB,
    'SELECT id, topic_id, r2_key, is_active FROM documents WHERE id = ?',
    id,
  );

  if (!document) {
    return json({ error: 'A dokumentum nem található.' }, { status: 404 });
  }

  await DB.prepare('UPDATE documents SET is_active = 0 WHERE id = ?').bind(id).run();
  await refreshTopicDocumentCount(DB, document.topic_id);

  try {
    await DOKUMENTUMTAR.delete(document.r2_key);
  } catch {
    // Non-fatal: DB record is already deactivated
  }

  return new Response(null, { status: 204 });
};
