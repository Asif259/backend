import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
  timestamp: string;
  path: string;
}

/**
 * Global exception filter.
 *
 * Rules:
 * - HttpException → return its status + message as-is (already safe from NestJS).
 * - QueryFailedError → log full error server-side, return generic 500 to client.
 * - Everything else → generic 500 with no internal details.
 *
 * Never exposes: stack traces, SQL details, TypeORM internals, or passwordHash.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string | string[];
    let errorName: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp['message'] as string | string[]) ?? exception.message;
        errorName = resp['error'] as string | undefined;
      } else {
        message = String(exceptionResponse);
      }
    } else if (exception instanceof QueryFailedError) {
      // Database errors — log full details, return generic 500
      this.logger.error(
        `Database error on ${request.method} ${request.path}`,
        (exception as Error).stack,
      );
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'A server error occurred. Please try again later.';
    } else {
      // Unknown errors — log, return generic 500
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.path}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'A server error occurred. Please try again later.';
    }

    const body: ErrorResponse = {
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (errorName) {
      body.error = errorName;
    }

    response.status(status).json(body);
  }
}
