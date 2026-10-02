import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { User } from '../users/entities/user.entity.js';
import {
  AnalyticsService,
  AnalyticsSummary,
  GroupedAnalyticsItem,
  TimelineItem,
} from './analytics.service.js';

@Controller('links/:id/analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  async getSummary(
    @Param('id') id: string,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
  ): Promise<AnalyticsSummary> {
    return this.analyticsService.getSummary(id, user.id);
  }

  @Get('timeline')
  async getTimeline(
    @Param('id') id: string,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
  ): Promise<TimelineItem[]> {
    return this.analyticsService.getTimeline(id, user.id);
  }

  @Get('devices')
  async getDevices(
    @Param('id') id: string,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
  ): Promise<GroupedAnalyticsItem[]> {
    return this.analyticsService.getDevices(id, user.id);
  }

  @Get('browsers')
  async getBrowsers(
    @Param('id') id: string,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
  ): Promise<GroupedAnalyticsItem[]> {
    return this.analyticsService.getBrowsers(id, user.id);
  }

  @Get('referrers')
  async getReferrers(
    @Param('id') id: string,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
  ): Promise<GroupedAnalyticsItem[]> {
    return this.analyticsService.getReferrers(id, user.id);
  }

  @Get('countries')
  async getCountries(
    @Param('id') id: string,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
  ): Promise<GroupedAnalyticsItem[]> {
    return this.analyticsService.getCountries(id, user.id);
  }
}
