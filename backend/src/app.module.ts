import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { HealthModule } from './modules/health/health.module';
import { SignaturesModule } from './modules/signatures/signatures.module';
import { StorageModule } from './modules/storage/storage.module';
import { SupabaseModule } from './modules/supabase/supabase.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      validate: validateEnv,
    }),
    SupabaseModule,
    StorageModule,
    AuditModule,
    HealthModule,
    AuthModule,
    UsersModule,
    DocumentsModule,
    AssignmentsModule,
    SignaturesModule,
  ],
})
export class AppModule {}
