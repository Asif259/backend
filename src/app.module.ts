import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
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
})
export class AppModule {}