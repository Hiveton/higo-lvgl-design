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
    const payload = (await response.clone().json()) as ErrorPayload;
    code = payload.error?.code || code;
    message = payload.error?.message || message;
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
  const code = payload?.error?.code || fallbackCode;
  const message = payload?.error?.message || fallbackMessage;
  return new ApiError(message, response.status, code, message);
}
