export const prerender = false;

import type { APIRoute } from 'astro';
import { getDocumentById, getEnv, json, refreshTopicDocumentCount } from '../../../lib/documents-db';

function parseOptionalInteger(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function sanitizeFilename(filename: string): string {
  const basename = filename.split(/[/\\]/).pop() ?? '';
  const sanitized = basename
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]+/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/\.\.+/g, '.')
    .replace(/^\.+/, '')
    .replace(/-+/g, '-');

  return sanitized || 'upload.bin';
}

export const POST: APIRoute = async ({ request, locals }) => {
  const formData = await request.formData();

  const topicId = parseOptionalInteger(formData.get('topic_id'));
  const documentTypeId = parseOptionalInteger(formData.get('document_type_id'));
  const parentId = parseOptionalInteger(formData.get('parent_id'));
  const sortOrderRaw = formData.get('sort_order');
  const sortOrder = typeof sortOrderRaw === 'string' && sortOrderRaw.trim() !== '' ? Number(sortOrderRaw) : 0;
  const titleValue = formData.get('title');
  const referenceNoValue = formData.get('reference_no');
  const file = formData.get('file');

  const title = typeof titleValue === 'string' ? titleValue.trim() : '';
  const referenceNo = typeof referenceNoValue === 'string' && referenceNoValue.trim() ? referenceNoValue.trim() : null;

  if (!topicId || !documentTypeId || !title || !(file instanceof File) || file.size === 0) {
    return json({ error: 'Hiányzó vagy érvénytelen mezők.' }, { status: 400 });
  }

  if (!Number.isFinite(sortOrder)) {
    return json({ error: 'Érvénytelen sorrend.' }, { status: 400 });
  }

  const { DB, DOKUMENTUMTAR } = getEnv(locals as App.Locals);
  const fileName = sanitizeFilename(file.name);
  const uploadId = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);
  const key = `${topicId}/${Date.now()}_${uploadId}_${fileName}`;

  await DOKUMENTUMTAR.put(key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type || 'application/octet-stream',
    },
  });

  try {
    const insert = await DB.prepare(
      `INSERT INTO documents (
        topic_id,
        parent_id,
        document_type_id,
        title,
        reference_no,
        r2_key,
        file_name,
        file_size,
        mime_type,
        sort_order,
        is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    )
      .bind(
        topicId,
        parentId,
        documentTypeId,
        title,
        referenceNo,
        key,
        fileName,
        file.size,
        file.type || 'application/octet-stream',
        sortOrder,
      )
      .run();

    const documentId = Number(insert.meta.last_row_id);
    await refreshTopicDocumentCount(DB, topicId);

    const document = await getDocumentById(DB, documentId);
    return json(document, { status: 201 });
  } catch (error) {
    await DOKUMENTUMTAR.delete(key);
    throw error;
  }
};
