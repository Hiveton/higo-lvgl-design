import { isRecord, isNonEmptyString } from "./utils";

export type ErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code = "API_ERROR",
    readonly detail?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiError(response: Response, fallbackCode: string, fallbackMessage: string): Promise<ApiError> {
  let code = fallbackCode;
  let message = fallbackMessage;
  try {
    const payload = await response.clone().json();
    const error = errorBodyFromPayload(payload);
    code = error?.code ?? code;
    message = error?.message ?? message;
  } catch {
    // Keep the endpoint-specific fallback when the body is not JSON.
  }
  return new ApiError(message, response.status, code, message);
}

export async function parseJsonPayload<T>(response: Response): Promise<T | undefined> {
  try {
    return (await response.clone().json()) as T;
  } catch {
    return undefined;
  }
}

export function apiErrorFromPayload(
  response: Response,
  payload: ErrorPayload | undefined,
  fallbackCode: string,
  fallbackMessage: string
): ApiError {
  const error = errorBodyFromPayload(payload);
  const code = error?.code ?? fallbackCode;
  const message = error?.message ?? fallbackMessage;
  return new ApiError(message, response.status, code, message);
}

function errorBodyFromPayload(payload: unknown): Required<ErrorPayload>["error"] | undefined {
  if (!isRecord(payload) || !isRecord(payload.error)) {
    return undefined;
  }
  if (!isNonEmptyString(payload.error.code) || !isNonEmptyString(payload.error.message)) {
    return undefined;
  }
  return {
    code: payload.error.code,
    message: payload.error.message
  };
}


