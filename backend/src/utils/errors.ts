/** Error type that carries the HTTP status we want to return to the client. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, "BAD_REQUEST", message, details);
  }

  static unauthorized(message = "Missing or invalid API key.") {
    return new ApiError(401, "UNAUTHORIZED", message);
  }

  static notFound(message = "Profile not found.") {
    return new ApiError(404, "PROFILE_NOT_FOUND", message);
  }

  static upstream(message: string, details?: unknown) {
    return new ApiError(502, "LINKEDIN_ERROR", message, details);
  }

  static notConfigured(message: string) {
    return new ApiError(503, "NOT_CONFIGURED", message);
  }
}
