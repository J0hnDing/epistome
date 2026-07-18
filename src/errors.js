export class AppError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(code, message, details) {
  return new AppError(400, code, message, details);
}

export function notFound(message) {
  return new AppError(404, "not_found", message);
}

export function conflict(code, message, details) {
  return new AppError(409, code, message, details);
}
