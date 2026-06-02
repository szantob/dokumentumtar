export interface DocumentItem {
  key: string;
  name: string;
  category: string;
  subcategory: string | null;
  size: number;
  uploaded: Date;
  downloadUrl: string;
}

export interface Topic {
  id: number;
  title: string;
  event_date: string | null;
  document_count: number | null;
  sort_order: number;
  is_public: number;
  created_at: string;
  updated_at: string;
  tags?: Tag[];
  documents?: Document[];
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
  color: string | null;
  sort_order: number;
}

export interface DocumentType {
  id: number;
  name: string;
  slug: string;
  color: string | null;
  sort_order: number;
}

export interface Document {
  id: number;
  topic_id: number;
  parent_id: number | null;
  document_type_id: number;
  title: string;
  reference_no: string | null;
  r2_key: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  sort_order: number;
  is_active: number;
  created_at: string;
  document_type?: DocumentType;
  attachments?: Document[];
}
