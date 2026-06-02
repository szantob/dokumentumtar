export const prerender = false;

import type { APIRoute } from 'astro';
import { getEnv, json, listDocumentTypes } from '../../../lib/documents-db';

export const GET: APIRoute = async ({ locals }) => {
  const { DB } = getEnv(locals as App.Locals);
  return json(await listDocumentTypes(DB));
};
