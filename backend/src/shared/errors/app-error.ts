export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 400, code = 'BAD_REQUEST', details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(message, 400, 'BAD_REQUEST', details);
  }

  static unauthorized(message = 'Unauthorized access') {
    return new AppError(message, 401, 'UNAUTHORIZED');
  }

  static forbidden(message = 'Access forbidden') {
    return new AppError(message, 403, 'FORBIDDEN');
  }

  static notFound(message = 'Resource not found') {
    return new AppError(message, 404, 'NOT_FOUND');
  }

  static conflict(message: string, details?: unknown) {
    return new AppError(message, 409, 'CONFLICT', details);
  }

  static unprocessable(message: string, details?: unknown) {
    return new AppError(message, 422, 'UNPROCESSABLE_ENTITY', details);
  }

  static internal(message = 'Internal server error') {
    return new AppError(message, 500, 'INTERNAL_SERVER_ERROR');
  }
}
