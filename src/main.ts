import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as express from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

function corsAllowedOrigin(
  origin: string | undefined,
  isProduction: boolean,
  allowedOrigins: string[],
  localhostOriginOk: (o: string) => boolean,
): string | null {
  if (!origin) return null;
  if (!isProduction) return origin;
  if (allowedOrigins.includes(origin)) return origin;
  if (localhostOriginOk(origin)) return origin;
  return null;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  const isProduction = process.env.NODE_ENV === 'production';
  const envOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((url) => url.trim()).filter(Boolean)
    : [];
  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3015',
    'http://localhost:3019',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002',
    'http://127.0.0.1:3015',
    'https://cursor-greenco-mern.vercel.app',
  ];
  const allowedOrigins = envOrigins.length > 0 ? envOrigins : defaultOrigins;
  const localhostOriginOk = (o: string) =>
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(o);

  /**
   * First middleware on the stack: CORS + OPTIONS preflight.
   * Runs before Nest’s router and before JSON parsers (bodyParser: false + our parsers below).
   */
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    const origin = req.headers.origin as string | undefined;
    const allowed = corsAllowedOrigin(origin, isProduction, allowedOrigins, localhostOriginOk);

    if (allowed) {
      res.setHeader('Access-Control-Allow-Origin', allowed);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
      const reqHdr = req.headers['access-control-request-headers'];
      res.setHeader(
        'Access-Control-Allow-Headers',
        typeof reqHdr === 'string' && reqHdr.trim() !== ''
          ? reqHdr
          : 'Content-Type, Authorization, Accept, X-Requested-With, Origin, Cache-Control, Pragma',
      );
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS',
      );
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      res.setHeader('Access-Control-Max-Age', '86400');
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // Manually add JSON and URL-encoded body parsers, but skip multipart/form-data
  app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
      return next();
    }
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
      return next();
    }
    return express.json()(req, res, next);
  });

  app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
      return next();
    }
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
      return next();
    }
    return express.urlencoded({ extended: true })(req, res, next);
  });

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

  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  app.useGlobalFilters(new HttpExceptionFilter());

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

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Green Co API')
    .setDescription('Green Co backend API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  const server = app.getHttpServer();
  server.timeout = 30000;
  server.keepAliveTimeout = 30000;

  const port = process.env.PORT || 3019;
  await app.listen(port, '0.0.0.0');
  console.log(
    `[API] Listening on http://localhost:${port} | CORS: ${isProduction ? 'allowlist' : 'any Origin (dev)'}`,
  );
}
bootstrap();
