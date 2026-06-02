export const prerender = false;

import type { APIRoute } from 'astro';
import { getEnv, getTopicWithDocuments, json } from '../../../lib/documents-db';

export const GET: APIRoute = async ({ params, locals }) => {
  const topicId = Number(params.id);
  if (!Number.isInteger(topicId) || topicId <= 0) {
    return json({ error: 'Érvénytelen azonosító.' }, { status: 400 });
  }

  const { DB } = getEnv(locals as App.Locals);
  const topic = await getTopicWithDocuments(DB, topicId);

  if (!topic) {
    return json({ error: 'A téma nem található.' }, { status: 404 });
  }

  return json(topic);
};
