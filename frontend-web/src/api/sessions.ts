import client from "./client";

export interface Session {
  id: number;
  room_name: string;
  topic: string;
  status: "pending" | "active" | "ended";
  report_text: string | null;
  created_at: string;
  ended_at: string | null;
}

export interface LiveKitToken {
  token: string;
  url: string;
}

export async function createSession(topic: string): Promise<Session> {
  const { data } = await client.post<Session>("/sessions/", { topic });
  return data;
}

export async function getSessions(): Promise<Session[]> {
  const { data } = await client.get<Session[]>("/sessions/");
  return data;
}

export async function getSession(id: number): Promise<Session> {
  const { data } = await client.get<Session>(`/sessions/${id}`);
  return data;
}

export async function getSessionToken(id: number): Promise<LiveKitToken> {
  const { data } = await client.post<LiveKitToken>(`/sessions/${id}/token`);
  return data;
}

export async function endSession(id: number): Promise<Session> {
  const { data } = await client.post<Session>(`/sessions/${id}/end`);
  return data;
}

export async function getReport(id: number): Promise<{ status: "pending" | "ready" | "disabled"; report: string | null }> {
  const { data } = await client.get(`/sessions/${id}/report`);
  return data;
}
