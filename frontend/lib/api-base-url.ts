const DEFAULT_PUBLIC_API_BASE_URL = "http://localhost:8000";

export function getPublicApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_PUBLIC_API_BASE_URL;
}

export function getServerApiBaseUrl() {
  return process.env.API_INTERNAL_BASE_URL || getPublicApiBaseUrl();
}
