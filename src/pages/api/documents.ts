export const prerender = false;

import type { APIRoute } from 'astro';
import type { DocumentItem } from '../../types/documents';

export const GET: APIRoute = async ({ locals }) => {
  const bucket: R2Bucket = (locals as App.Locals).runtime.env.DOKUMENTUMTAR;

  const documents: DocumentItem[] = [];
  let cursor: string | undefined;

  do {
    const listed: R2Objects = cursor
      ? await bucket.list({ cursor })
      : await bucket.list();

    for (const obj of listed.objects) {
      const parts = obj.key.split('/');
      const filename = parts[parts.length - 1];
      // Skip folder-like keys (empty filename or no category segment)
      if (!filename || !parts[0]) continue;

      const category = parts[0];
      const subcategory = parts.length >= 3 ? parts[1] : null;

      documents.push({
        key: obj.key,
        name: filename,
        category,
        subcategory,
        size: obj.size,
        uploaded: obj.uploaded,
        downloadUrl: `/api/download/${obj.key}`,
      });
    }

    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  return new Response(JSON.stringify(documents), {
    headers: { 'Content-Type': 'application/json' },
  });
};
