import { apiErrorFromPayload, parseJsonPayload, type ErrorPayload } from "./errors";
import { isRecord, isNonEmptyString } from "./utils";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
};

export type LoginResponse = {
  token: string;
  user: AuthUser;
};

const tokenKey = "lvgl-editor-token";
let memoryToken: string | null = null;

export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });
  const payload = await parseJsonPayload<Partial<LoginResponse> & ErrorPayload>(response);
  const token = normalizeToken(payload?.token);
  if (!response.ok || token === "" || !isAuthUser(payload?.user)) {
    throw apiErrorFromPayload(response, payload, "LOGIN_FAILED", `login failed with status ${response.status}`);
  }
  setAuthToken(token);
  return { token, user: payload.user };
}

export async function getCurrentUser(): Promise<AuthUser> {
  const response = await fetch("/api/auth/me", {
    headers: authHeaders()
  });
  const payload = await parseJsonPayload<Partial<AuthUser> & ErrorPayload>(response);
  if (!response.ok || !isAuthUser(payload)) {
    clearAuthToken();
    throw apiErrorFromPayload(response, payload, "CURRENT_USER_LOOKUP_FAILED", `current user lookup failed with status ${response.status}`);
  }
  return payload;
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!isRecord(value)) {
    return false;
  }
  return isNonEmptyString(value.id)
    && isEmailString(value.email)
    && isNonEmptyString(value.displayName);
}

function isEmailString(value: unknown): value is string {
  return typeof value === "string"
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function setAuthToken(token: string): void {
  const normalizedToken = normalizeToken(token);
  memoryToken = normalizedToken;
  const storage = getBrowserStorage();
  if (typeof storage?.setItem === "function") {
    try {
      storage.setItem(tokenKey, normalizedToken);
    } catch {
      // Keep the in-memory token active when browser storage is unavailable.
    }
  }
}

export function clearAuthToken(): void {
  memoryToken = null;
  const storage = getBrowserStorage();
  if (typeof storage?.removeItem === "function") {
    try {
      storage.removeItem(tokenKey);
    } catch {
      // Clearing memoryToken is enough when browser storage cannot be updated.
    }
  }
}

export function getAuthToken(): string | null {
  const storage = getBrowserStorage();
  if (typeof storage?.getItem === "function") {
    try {
      return normalizeStoredToken(storage.getItem(tokenKey)) ?? normalizeStoredToken(memoryToken);
    } catch {
      return normalizeStoredToken(memoryToken);
    }
  }
  return normalizeStoredToken(memoryToken);
}

export function getBrowserStorage(): Storage | null {
  const globalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  if (globalStorageDescriptor && "value" in globalStorageDescriptor && isStorageLike(globalStorageDescriptor.value)) {
    return globalStorageDescriptor.value;
  }
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isStorageLike(value: unknown): value is Storage {
  return typeof value === "object"
    && value !== null
    && typeof (value as Storage).getItem === "function"
    && typeof (value as Storage).setItem === "function"
    && typeof (value as Storage).removeItem === "function";
}

function normalizeToken(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStoredToken(value: string | null): string | null {
  const token = normalizeToken(value);
  return token === "" ? null : token;
}

export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  if (!token) {
    return extra;
  }
  return {
    ...extra,
    Authorization: `Bearer ${token}`
  };
}
