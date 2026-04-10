import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as express from 'express';
import { CORS_ALLOWED_HEADERS, getAllowedCorsOrigin } from './common/cors-allow.util';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false, // Disable automatic body parsing to allow Multer to handle multipart/form-data
  });

  // CORS must run before other middleware so preflight and cross-port localhost work reliably.
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowed = getAllowedCorsOrigin(origin);
      if (allowed) return callback(null, allowed);
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: CORS_ALLOWED_HEADERS,
    exposedHeaders: ['Content-Disposition'],
    optionsSuccessStatus: 200,
  });

  // Manually add JSON and URL-encoded body parsers, but skip multipart/form-data
  // This allows Multer to handle multipart/form-data without interference
  app.use((req, res, next) => {
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
      // Skip body parsing for multipart requests - let Multer handle it
      return next();
    }
    // For other content types, use JSON parser
    return express.json()(req, res, next);
  });
  
  app.use((req, res, next) => {
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
      // Skip body parsing for multipart requests - let Multer handle it
      return next();
    }
    // For URL-encoded requests, use URL-encoded parser
    return express.urlencoded({ extended: true })(req, res, next);
  });

  // Backward compatibility: old frontend calls /admin/* while backend uses /api/admin/*.
  app.use((req, res, next) => {
    const url = req.url || '';
    if (url.startsWith('/admin/')) {
      req.url = `/api${url}`;
    }
    next();
  });

  // Legacy assessor profile update aliases used by frontend:
  // /api/admin/assessors/:id/profile and /api/admin/assessors/:id/public -> /api/admin/assessors/:id/edit
  app.use((req, res, next) => {
    const url = req.url || '';
    const profileAlias = /^\/api\/admin\/assessors\/([^/]+)\/(profile|public)(\/?|\?.*)$/i;
    if (profileAlias.test(url)) {
      req.url = url.replace(profileAlias, '/api/admin/assessors/$1/edit$3');
    }
    next();
  });

  // Response time logging (skip static and health)
  app.use((req, res, next) => {
    const start = Date.now();
    const url = req.originalUrl || req.url;
    res.on('finish', () => {
      const ms = Date.now() - start;
      const slow = ms > 1000;
      if (slow || process.env.NODE_ENV !== 'production') {
        console.log(`[API] ${req.method} ${url} ${res.statusCode} ${ms}ms${slow ? ' (slow)' : ''}`);
      }
    });
    next();
  });

  // Serve static files from uploads directory
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  // Ensure OPTIONS (preflight) never returns 404: handle it early so browser gets 200 and sends the real request.
  app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
      const originStr =
        typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
      const allowed = originStr ? getAllowedCorsOrigin(originStr) : false;
      const corsOrigin = allowed || (!originStr ? 'http://localhost:3000' : false);
      if (!corsOrigin) {
        res.status(403).end();
        return;
      }
      const requested = req.headers['access-control-request-headers'];
      const reqHeaders =
        typeof requested === 'string' && requested.trim()
          ? requested
          : CORS_ALLOWED_HEADERS;
      const reqMethod = req.headers['access-control-request-method'] || 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
      res.setHeader('Access-Control-Allow-Origin', corsOrigin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', Array.isArray(reqMethod) ? reqMethod.join(', ') : reqMethod);
      res.setHeader('Access-Control-Allow-Headers', Array.isArray(reqHeaders) ? reqHeaders.join(', ') : reqHeaders);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.status(200).end();
      return;
    }
    next();
  });

  // Global exception filter to format all errors consistently
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Set timeout for requests (30 seconds)
  const server = app.getHttpServer();
  server.timeout = 30000;
  server.keepAliveTimeout = 30000;

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: http://localhost:${port} (and on 0.0.0.0 for network access)`);
}
bootstrap();

