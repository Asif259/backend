import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Click } from './entities/click.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Click])],
  exports: [TypeOrmModule],
})
export class AnalyticsModule {}
