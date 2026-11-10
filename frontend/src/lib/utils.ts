import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const maybeAxios = error as {
      response?: { data?: { error?: { message?: string }; detail?: string; message?: string } };
      message?: string;
    };
    return (
      maybeAxios.response?.data?.error?.message ||
      maybeAxios.response?.data?.detail ||
      maybeAxios.response?.data?.message ||
      maybeAxios.message ||
      fallback
    );
  }
  return fallback;
}
