import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { LinksModule } from './links/links.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { User } from './users/entities/user.entity.js';
import { Link } from './links/entities/link.entity.js';
import { Click } from './analytics/entities/click.entity.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    /**
     * Global rate-limiter (IP-based, in-memory store).
     *
     * Three named throttlers with different limits:
     * - default  : 100 req / 60 s   — general API protection
     * - auth     : 10 req / 60 s    — login / register (brute-force prevention)
     * - links    : 30 req / 60 s    — link creation
     *
     * Apply the correct throttler per endpoint with @Throttle().
     * No Redis required — in-memory is fine for this MVP.
     */
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,   // ms
        limit: 100,
      },
      {
        name: 'auth',
        ttl: 60_000,
        limit: 10,
      },
      {
        name: 'links',
        ttl: 60_000,
        limit: 30,
      },
    ]),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',

        host: configService.get<string>('DATABASE_HOST', 'localhost'),
        port: configService.get<number>('DATABASE_PORT', 5432),
        username: configService.get<string>('DATABASE_USER', 'postgres'),
        password: configService.get<string>('DATABASE_PASSWORD', 'postgres'),
        database: configService.get<string>('DATABASE_NAME', 'link_shortener'),

        entities: [User, Link, Click],
        autoLoadEntities: true,

        // Set to false in production & development when using migrations
        synchronize: false,
      }),
    }),

    UsersModule,
    AuthModule,
    LinksModule,
    AnalyticsModule,
  ],
  /**
   * Global ThrottlerGuard applies the 'default' throttler to every route.
   *
   * Individual controllers override with @Throttle({ auth: ... }) or
   * @Throttle({ links: ... }) for tighter limits on sensitive endpoints.
   * This ensures no endpoint is accidentally left without rate limiting.
   */
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}