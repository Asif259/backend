import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  /**
   * Helmet sets security-relevant HTTP response headers.
   *
   * Key protections added:
   * - Content-Security-Policy   : restricts sources of scripts/styles (XSS mitigation)
   * - X-Frame-Options           : prevents clickjacking (DENY)
   * - X-Content-Type-Options    : prevents MIME sniffing (nosniff)
   * - Strict-Transport-Security : forces HTTPS after first visit (HSTS)
   * - X-XSS-Protection          : legacy XSS filter for older browsers
   * - Referrer-Policy           : limits referrer header leakage
   *
   * The CSP is intentionally permissive for the API (no HTML served),
   * but still blocks inline script execution if the API ever returns HTML.
   */
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false, // Allow embedding from CORS origins
    }),
  );

  /**
   * CORS — restrict to the configured frontend origin only.
   *
   * Using origin: '*' with credentialed requests is rejected by browsers.
   * The backend must specify an exact origin when cookies/Authorization
   * headers are involved. Misconfigured wildcard CORS + auth headers = ATO risk.
   */
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3001',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  /**
   * Global validation pipe.
   *
   * - whitelist: strip unknown properties from request bodies (defense against mass assignment)
   * - forbidNonWhitelisted: reject requests with unknown properties (not just strip)
   * - transform: coerce types (e.g. string → number for query params)
   */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  /**
   * Global exception filter — sanitizes error responses.
   *
   * Prevents TypeORM errors, stack traces, and SQL details from
   * leaking to API consumers. All unhandled errors return a clean 500.
   */
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
