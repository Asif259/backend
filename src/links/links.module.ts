import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Link } from './entities/link.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Link])],
  exports: [TypeOrmModule],
})
export class LinksModule {}
