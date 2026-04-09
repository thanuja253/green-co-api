import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false, // Disable automatic body parsing to allow Multer to handle multipart/form-data
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

  // CORS: in development allow all origins to avoid "network error"; in production use allowlist
  const isProduction = process.env.NODE_ENV === 'production';
  const envOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((url) => url.trim())
    : [];
  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:3002',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002',
    'https://cursor-greenco-mern.vercel.app',
    'https://cursor-greenco-admin.mern.vercel.app',
    'https://greenco-admin.mern.vercel.app',
  ];
  const allowedOrigins = envOrigins.length > 0 ? envOrigins : defaultOrigins;

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      // In development: allow every origin to rule out CORS as cause of network error
      if (!isProduction) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return callback(null, true);
      if (origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:')) return callback(null, true);
      if (origin.startsWith('http://127.0.0.1:') || origin.startsWith('https://127.0.0.1:')) return callback(null, true);
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: '*',
    optionsSuccessStatus: 200,
  });

  // Ensure OPTIONS (preflight) never returns 404: handle it early so browser gets 200 and sends the real request.
  app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
      const origin = req.headers.origin || 'http://localhost:3000';
      const reqHeaders = req.headers['access-control-request-headers'] || 'Content-Type, Authorization, Accept, X-Requested-With';
      const reqMethod = req.headers['access-control-request-method'] || 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
      res.setHeader('Access-Control-Allow-Origin', origin);
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

