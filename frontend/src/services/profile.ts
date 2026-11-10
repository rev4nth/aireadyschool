import { api } from "@/lib/api";
import type { Profile } from "@/types";

export async function getProfile() {
  const { data } = await api.get<Profile>("/profile");
  return data;
}

export async function updateProfile(payload: {
  full_name?: string | null;
  avatar_url?: string | null;
  preferences?: Record<string, unknown>;
}) {
  const { data } = await api.patch<Profile>("/profile", payload);
  return data;
}
