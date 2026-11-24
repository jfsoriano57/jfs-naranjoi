export type Subject = {
  id: string;
  user_id: string;
  name: string;
  career: string | null;
  term: string | null;
  color: string;
  exam_date: string | null;
  created_at: string;
};

export type DocumentKind = "programa" | "texto_basico" | "apuntes" | "ejercicios" | "otro";
export type DocumentSource = "subido" | "internet";
export type DocumentStatus = "pendiente" | "procesando" | "listo" | "error";

export type DocumentItem = {
  id: string;
  user_id: string;
  subject_id: string;
  title: string;
  kind: DocumentKind;
  source: DocumentSource;
  source_url: string | null;
  storage_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  pages: number | null;
  status: DocumentStatus;
  error: string | null;
  created_at: string;
};

export type ChunkCitation = {
  document_id: string;
  document_title: string;
  page: number | null;
  snippet: string;
};

export type MessageRole = "user" | "assistant";

export type Message = {
  id: number;
  conversation_id: string;
  user_id: string;
  role: MessageRole;
  content: string;
  citations: ChunkCitation[];
  created_at: string;
};

export type Conversation = {
  id: string;
  user_id: string;
  title: string;
  subject_ids: string[];
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  display_name: string | null;
  has_gemini_key: boolean;
  daily_quota: number;
  created_at: string;
};
