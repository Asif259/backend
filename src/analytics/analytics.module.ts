import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Click } from './entities/click.entity.js';
import { Link } from '../links/entities/link.entity.js';
import { AnalyticsService } from './analytics.service.js';
import { AnalyticsController } from './analytics.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Click, Link])],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService, TypeOrmModule],
})
export class AnalyticsModule {}
