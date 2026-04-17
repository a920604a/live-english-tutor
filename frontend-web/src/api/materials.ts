import client from "./client";

export interface Material {
  id: number;
  title: string;
  page_count: number | null;
  word_count: number | null;
  tts_status: "pending" | "processing" | "ready" | "error";
  tts_chunk_count: number | null;
  created_at: string;
  listen_count: number;
  last_listened_at: string | null;
}

export interface ListeningSession {
  id: number;
  material_id: number;
  listened_at: string;
  duration_sec: number;
  completed: boolean;
}

export async function getMaterials(): Promise<Material[]> {
  const { data } = await client.get<Material[]>("/materials/");
  return data;
}

export async function uploadMaterial(file: File, title: string): Promise<Material> {
  const form = new FormData();
  form.append("file", file);
  form.append("title", title);
  const { data } = await client.post<Material>("/materials/", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function deleteMaterial(id: number): Promise<void> {
  await client.delete(`/materials/${id}`);
}

export async function recordListeningSession(
  materialId: number,
  durationSec: number,
  completed: boolean
): Promise<ListeningSession> {
  const { data } = await client.post<ListeningSession>(
    `/materials/${materialId}/sessions`,
    { duration_sec: durationSec, completed }
  );
  return data;
}

export async function getListeningSessions(materialId: number): Promise<ListeningSession[]> {
  const { data } = await client.get<ListeningSession[]>(`/materials/${materialId}/sessions`);
  return data;
}
