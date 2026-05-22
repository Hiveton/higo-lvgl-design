export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
};

export type LoginResponse = {
  token: string;
  user: AuthUser;
};

type ErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
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
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, `login failed with status ${response.status}`));
  }
  const payload = (await response.json()) as LoginResponse;
  setAuthToken(payload.token);
  return payload;
}

export async function getCurrentUser(): Promise<AuthUser> {
  const response = await fetch("/api/auth/me", {
    headers: authHeaders()
  });
  if (!response.ok) {
    clearAuthToken();
    throw new Error(`current user lookup failed with status ${response.status}`);
  }
  return response.json() as Promise<AuthUser>;
}

export function setAuthToken(token: string): void {
  memoryToken = token;
  const storage = getBrowserStorage();
  if (typeof storage?.setItem === "function") {
    storage.setItem(tokenKey, token);
  }
}

export function clearAuthToken(): void {
  memoryToken = null;
  const storage = getBrowserStorage();
  if (typeof storage?.removeItem === "function") {
    storage.removeItem(tokenKey);
  }
}

export function getAuthToken(): string | null {
  const storage = getBrowserStorage();
  if (typeof storage?.getItem === "function") {
    return storage.getItem(tokenKey) ?? memoryToken;
  }
  return memoryToken;
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

async function responseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.clone().json()) as ErrorPayload;
    return payload.error?.message || fallback;
  } catch {
    return fallback;
  }
}
