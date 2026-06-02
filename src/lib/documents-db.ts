import type { Document, DocumentType, Tag, Topic } from '../types/documents';

interface TopicRow extends Omit<Topic, 'tags' | 'documents'> {}

interface DocumentRow extends Omit<Document, 'document_type' | 'attachments'> {
  updated_at: string;
  dt_id: number;
  dt_name: string;
  dt_slug: string;
  dt_color: string | null;
  dt_sort_order: number;
}

export function getEnv(locals: App.Locals): Env {
  return locals.runtime.env as Env;
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

export async function queryAll<T>(
  db: D1Database,
  sql: string,
  ...bindings: unknown[]
): Promise<T[]> {
  const statement = bindings.length > 0 ? db.prepare(sql).bind(...bindings) : db.prepare(sql);
  const result = await statement.all<T>();
  return (result.results ?? []) as T[];
}

export async function queryFirst<T>(
  db: D1Database,
  sql: string,
  ...bindings: unknown[]
): Promise<T | null> {
  const rows = await queryAll<T>(db, sql, ...bindings);
  return rows[0] ?? null;
}

export async function fetchTopicTags(db: D1Database, topicId: number): Promise<Tag[]> {
  return queryAll<Tag>(
    db,
    `SELECT t.* FROM tags t
    JOIN topic_tags tt ON tt.tag_id = t.id
    WHERE tt.topic_id = ?
    ORDER BY t.sort_order ASC, t.name ASC`,
    topicId,
  );
}

export async function listTopics(db: D1Database, includePrivate = false): Promise<Topic[]> {
  const topics = await queryAll<TopicRow>(
    db,
    `SELECT * FROM topics
    ${includePrivate ? '' : 'WHERE is_public = 1'}
    ORDER BY event_date IS NULL ASC, event_date DESC, created_at DESC`,
  );

  return Promise.all(
    topics.map(async (topic) => ({
      ...topic,
      tags: await fetchTopicTags(db, topic.id),
    })),
  );
}

export async function getTopic(db: D1Database, topicId: number): Promise<Topic | null> {
  const topic = await queryFirst<TopicRow>(db, 'SELECT * FROM topics WHERE id = ?', topicId);
  if (!topic) {
    return null;
  }

  return {
    ...topic,
    tags: await fetchTopicTags(db, topicId),
  };
}

function mapDocumentRow(row: DocumentRow): Document {
  return {
    id: row.id,
    topic_id: row.topic_id,
    parent_id: row.parent_id,
    document_type_id: row.document_type_id,
    title: row.title,
    reference_no: row.reference_no,
    r2_key: row.r2_key,
    file_name: row.file_name,
    file_size: row.file_size,
    mime_type: row.mime_type,
    sort_order: row.sort_order,
    is_active: row.is_active,
    created_at: row.created_at,
    document_type: {
      id: row.dt_id,
      name: row.dt_name,
      slug: row.dt_slug,
      color: row.dt_color,
      sort_order: row.dt_sort_order,
    },
    attachments: [],
  };
}

export async function listTopicDocuments(db: D1Database, topicId: number): Promise<Document[]> {
  const rows = await queryAll<DocumentRow>(
    db,
    `SELECT
      d.*,
      dt.id AS dt_id,
      dt.name AS dt_name,
      dt.slug AS dt_slug,
      dt.color AS dt_color,
      dt.sort_order AS dt_sort_order
    FROM documents d
    JOIN document_types dt ON dt.id = d.document_type_id
    WHERE d.topic_id = ? AND d.is_active = 1
    ORDER BY d.parent_id IS NOT NULL ASC, d.parent_id ASC, d.sort_order ASC, d.created_at ASC`,
    topicId,
  );

  const documents = rows.map(mapDocumentRow);
  const byId = new Map(documents.map((document) => [document.id, document]));
  const roots: Document[] = [];

  for (const document of documents) {
    if (document.parent_id == null) {
      roots.push(document);
      continue;
    }

    const parent = byId.get(document.parent_id);
    if (parent) {
      parent.attachments = [...(parent.attachments ?? []), document];
    }
  }

  return roots;
}

export async function getTopicWithDocuments(db: D1Database, topicId: number): Promise<Topic | null> {
  const topic = await getTopic(db, topicId);
  if (!topic) {
    return null;
  }

  return {
    ...topic,
    documents: await listTopicDocuments(db, topicId),
  };
}

export async function listTags(db: D1Database): Promise<Tag[]> {
  return queryAll<Tag>(db, 'SELECT * FROM tags ORDER BY sort_order ASC, name ASC');
}

export async function listDocumentTypes(db: D1Database): Promise<DocumentType[]> {
  return queryAll<DocumentType>(db, 'SELECT * FROM document_types ORDER BY sort_order ASC, name ASC');
}

export async function getDocumentById(db: D1Database, documentId: number): Promise<Document | null> {
  const row = await queryFirst<DocumentRow>(
    db,
    `SELECT
      d.*,
      dt.id AS dt_id,
      dt.name AS dt_name,
      dt.slug AS dt_slug,
      dt.color AS dt_color,
      dt.sort_order AS dt_sort_order
    FROM documents d
    JOIN document_types dt ON dt.id = d.document_type_id
    WHERE d.id = ?`,
    documentId,
  );

  if (!row) {
    return null;
  }

  const document = mapDocumentRow(row);
  document.attachments = await queryAll<DocumentRow>(
    db,
    `SELECT
      d.*,
      dt.id AS dt_id,
      dt.name AS dt_name,
      dt.slug AS dt_slug,
      dt.color AS dt_color,
      dt.sort_order AS dt_sort_order
    FROM documents d
    JOIN document_types dt ON dt.id = d.document_type_id
    WHERE d.parent_id = ? AND d.is_active = 1
    ORDER BY d.sort_order ASC, d.created_at ASC`,
    documentId,
  ).then((attachments) => attachments.map(mapDocumentRow));

  return document;
}

export async function refreshTopicDocumentCount(db: D1Database, topicId: number): Promise<void> {
  await db
    .prepare(
      `UPDATE topics
      SET document_count = (
        SELECT COUNT(*) FROM documents WHERE topic_id = ? AND is_active = 1
      ),
      updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    )
    .bind(topicId, topicId)
    .run();
}
