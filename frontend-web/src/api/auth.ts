import client from "./client";
import type { AppUser } from "../store/authStore";

/**
 * After a successful Firebase Google Sign-In, call this to register / verify
 * the user on our backend and retrieve the DB user record.
 */
export async function verifyWithBackend(idToken: string): Promise<AppUser> {
  const { data } = await client.post<AppUser>("/auth/verify", { id_token: idToken });
  return data;
}
