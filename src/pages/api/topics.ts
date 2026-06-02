export const prerender = false;

import type { APIRoute } from 'astro';
import { getEnv, json, listTopics } from '../../lib/documents-db';

export const GET: APIRoute = async ({ locals }) => {
  const { DB } = getEnv(locals as App.Locals);
  const topics = await listTopics(DB);
  return json(topics);
};
