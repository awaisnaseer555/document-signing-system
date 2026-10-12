import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

/**
 * Shared Nest bootstrap used by local `main.ts` and Vercel serverless runtime.
 * Preserves /api prefix, CORS, validation, filters, and Swagger.
 */
export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, {
    // Keep Nest's default Express body parser; multer handles multipart uploads.
    bodyParser: true,
  });

  const configService = app.get(ConfigService);
  // Local defaults + production frontend. Override via FRONTEND_ORIGIN (comma-separated).
  const frontendOrigin =
    configService.get<string>('FRONTEND_ORIGIN') ??
    'http://localhost:3000,https://document-signing-system-six.vercel.app';

  const allowedOrigins = frontendOrigin
    .split(',')
    .map((o) => {
      const trimmed = o.trim();
      if (!trimmed) return '';
      try {
        // Origin must be scheme + host (+ port). Strip paths like /login if pasted by mistake.
        return new URL(trimmed).origin;
      } catch {
        return trimmed.replace(/\/$/, '');
      }
    })
    .filter(Boolean);

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean | string) => void,
    ) => {
      // Non-browser clients (health checks) send no Origin
      if (!origin) {
        callback(null, true);
        return;
      }
      const normalized = origin.replace(/\/$/, '');
      if (allowedOrigins.includes(normalized)) {
        // Echo the request origin (required with credentials: true)
        callback(null, normalized);
        return;
      }
      // Deny without throwing — throwing can surface as opaque "Failed to fetch"
      callback(null, false);
    },
    credentials: true,
  });

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

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.setGlobalPrefix('api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Document Signing API')
    .setDescription(
      'REST API for document assignment, electronic signature capture, and audit. Visual signatures are application evidence of intent — not a legal validity claim.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  return app;
}
