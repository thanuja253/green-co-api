import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { Request, Response } from 'express';
import {
  applyCorsHeadersToResponse,
  CORS_ALLOWED_HEADERS,
  getAllowedCorsOrigin,
} from '../cors-allow.util';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Special case: never return an error for CORS preflight.
    // If an OPTIONS request accidentally reaches this filter (e.g. no route),
    // answer with 200 so the browser can proceed with the real request.
    if (request.method === 'OPTIONS') {
      const originStr =
        typeof request.headers.origin === 'string' ? request.headers.origin : undefined;
      const allowed = originStr ? getAllowedCorsOrigin(originStr) : false;
      const corsOrigin = allowed || (!originStr ? 'http://localhost:3000' : false);
      if (!corsOrigin) {
        response.status(403).end();
        return;
      }
      response
        .status(200)
        .setHeader('Access-Control-Allow-Origin', corsOrigin)
        .setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
        .setHeader(
          'Access-Control-Allow-Headers',
          (() => {
            const requested = request.headers['access-control-request-headers'];
            return typeof requested === 'string' && requested.trim()
              ? requested
              : CORS_ALLOWED_HEADERS;
          })(),
        )
        .setHeader('Access-Control-Allow-Credentials', 'true')
        .end();
      return;
    }

    // If exception already has our custom format, use it
    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'status' in exceptionResponse
    ) {
      applyCorsHeadersToResponse(
        typeof request.headers.origin === 'string' ? request.headers.origin : undefined,
        (n, v) => response.setHeader(n, v),
      );
      return response.status(status).json(exceptionResponse);
    }

    // Otherwise, format it to match our spec
    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as any)?.message || exception.message || 'An error occurred';

    applyCorsHeadersToResponse(
      typeof request.headers.origin === 'string' ? request.headers.origin : undefined,
      (n, v) => response.setHeader(n, v),
    );
    return response.status(status).json({
      status: 'error',
      message: message,
    });
  }
}



