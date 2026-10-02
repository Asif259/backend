import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Click } from './entities/click.entity.js';
import { Link } from '../links/entities/link.entity.js';

export interface AnalyticsSummary {
  totalClicks: number;
  clicksToday: number;
  clicksThisWeek: number;
  clicksThisMonth: number;
}

export interface TimelineItem {
  date: string;
  clicks: number;
}

export interface GroupedAnalyticsItem {
  name: string;
  clicks: number;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Click)
    private readonly clickRepository: Repository<Click>,
    @InjectRepository(Link)
    private readonly linkRepository: Repository<Link>,
  ) {}

  async validateLinkOwnership(linkId: string, userId: string): Promise<Link> {
    const link = await this.linkRepository.findOne({ where: { id: linkId } });
    if (!link) {
      throw new NotFoundException('Link not found');
    }
    if (link.userId !== userId) {
      throw new ForbiddenException('You do not have permission to access analytics for this link');
    }
    return link;
  }

  async getSummary(linkId: string, userId: string): Promise<AnalyticsSummary> {
    await this.validateLinkOwnership(linkId, userId);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);

    const startOfMonth = new Date(now);
    startOfMonth.setDate(now.getDate() - 30);

    const totalClicks = await this.clickRepository.count({ where: { linkId } });

    const clicksToday = await this.clickRepository
      .createQueryBuilder('click')
      .where('click.link_id = :linkId', { linkId })
      .andWhere('click.timestamp >= :startOfToday', { startOfToday })
      .getCount();

    const clicksThisWeek = await this.clickRepository
      .createQueryBuilder('click')
      .where('click.link_id = :linkId', { linkId })
      .andWhere('click.timestamp >= :startOfWeek', { startOfWeek })
      .getCount();

    const clicksThisMonth = await this.clickRepository
      .createQueryBuilder('click')
      .where('click.link_id = :linkId', { linkId })
      .andWhere('click.timestamp >= :startOfMonth', { startOfMonth })
      .getCount();

    return {
      totalClicks,
      clicksToday,
      clicksThisWeek,
      clicksThisMonth,
    };
  }

  async getTimeline(linkId: string, userId: string): Promise<TimelineItem[]> {
    await this.validateLinkOwnership(linkId, userId);

    const result = await this.clickRepository
      .createQueryBuilder('click')
      .select("TO_CHAR(click.timestamp, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)::int', 'clicks')
      .where('click.link_id = :linkId', { linkId })
      .groupBy("TO_CHAR(click.timestamp, 'YYYY-MM-DD')")
      .orderBy('date', 'ASC')
      .getRawMany<{ date: string; clicks: number }>();

    return result.map((row) => ({
      date: row.date,
      clicks: Number(row.clicks),
    }));
  }

  async getDevices(linkId: string, userId: string): Promise<GroupedAnalyticsItem[]> {
    await this.validateLinkOwnership(linkId, userId);

    const result = await this.clickRepository
      .createQueryBuilder('click')
      .select("COALESCE(click.device, 'Unknown')", 'name')
      .addSelect('COUNT(*)::int', 'clicks')
      .where('click.link_id = :linkId', { linkId })
      .groupBy("COALESCE(click.device, 'Unknown')")
      .orderBy('clicks', 'DESC')
      .getRawMany<{ name: string; clicks: number }>();

    return result.map((row) => ({
      name: row.name,
      clicks: Number(row.clicks),
    }));
  }

  async getBrowsers(linkId: string, userId: string): Promise<GroupedAnalyticsItem[]> {
    await this.validateLinkOwnership(linkId, userId);

    const result = await this.clickRepository
      .createQueryBuilder('click')
      .select("COALESCE(click.browser, 'Unknown')", 'name')
      .addSelect('COUNT(*)::int', 'clicks')
      .where('click.link_id = :linkId', { linkId })
      .groupBy("COALESCE(click.browser, 'Unknown')")
      .orderBy('clicks', 'DESC')
      .getRawMany<{ name: string; clicks: number }>();

    return result.map((row) => ({
      name: row.name,
      clicks: Number(row.clicks),
    }));
  }

  async getReferrers(linkId: string, userId: string): Promise<GroupedAnalyticsItem[]> {
    await this.validateLinkOwnership(linkId, userId);

    const result = await this.clickRepository
      .createQueryBuilder('click')
      .select("COALESCE(click.referrer, 'Direct / None')", 'name')
      .addSelect('COUNT(*)::int', 'clicks')
      .where('click.link_id = :linkId', { linkId })
      .groupBy("COALESCE(click.referrer, 'Direct / None')")
      .orderBy('clicks', 'DESC')
      .getRawMany<{ name: string; clicks: number }>();

    return result.map((row) => ({
      name: row.name,
      clicks: Number(row.clicks),
    }));
  }

  async getCountries(linkId: string, userId: string): Promise<GroupedAnalyticsItem[]> {
    await this.validateLinkOwnership(linkId, userId);

    const result = await this.clickRepository
      .createQueryBuilder('click')
      .select("COALESCE(click.country, 'Unknown')", 'name')
      .addSelect('COUNT(*)::int', 'clicks')
      .where('click.link_id = :linkId', { linkId })
      .groupBy("COALESCE(click.country, 'Unknown')")
      .orderBy('clicks', 'DESC')
      .getRawMany<{ name: string; clicks: number }>();

    return result.map((row) => ({
      name: row.name,
      clicks: Number(row.clicks),
    }));
  }
}
