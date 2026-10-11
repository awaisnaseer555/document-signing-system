import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createApp } from './create-app';

async function bootstrap() {
  const app = await createApp();
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Vercel injects PORT; local default remains 3001
  const port = Number(process.env.PORT) || configService.get<number>('PORT') || 3001;
  await app.listen(port);

  logger.log(`API listening on http://localhost:${port}/api`);
  logger.log(`Swagger docs at http://localhost:${port}/api/docs`);
}

void bootstrap();
