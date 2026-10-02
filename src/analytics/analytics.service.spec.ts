import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { AnalyticsService } from './analytics.service.js';
import { Click } from './entities/click.entity.js';
import { Link } from '../links/entities/link.entity.js';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let linkRepo: any;
  let clickRepo: any;

  beforeEach(async () => {
    linkRepo = {
      findOne: vi.fn(),
    };

    clickRepo = {
      count: vi.fn(),
      createQueryBuilder: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(Link), useValue: linkRepo },
        { provide: getRepositoryToken(Click), useValue: clickRepo },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  describe('validateLinkOwnership', () => {
    it('should throw NotFoundException if link does not exist', async () => {
      linkRepo.findOne.mockResolvedValue(null);

      await expect(service.validateLinkOwnership('link-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if link does not belong to user', async () => {
      linkRepo.findOne.mockResolvedValue({ id: 'link-1', userId: 'other-user' });

      await expect(service.validateLinkOwnership('link-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return link if user owns it', async () => {
      const mockLink = { id: 'link-1', userId: 'user-1' };
      linkRepo.findOne.mockResolvedValue(mockLink);

      const result = await service.validateLinkOwnership('link-1', 'user-1');
      expect(result).toBe(mockLink);
    });
  });

  describe('getSummary', () => {
    it('should return aggregated click counts for today, week, and month', async () => {
      linkRepo.findOne.mockResolvedValue({ id: 'link-1', userId: 'user-1' });
      clickRepo.count.mockResolvedValue(128);

      const qbMock = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getCount: vi.fn().mockResolvedValueOnce(17).mockResolvedValueOnce(74).mockResolvedValueOnce(128),
      };
      clickRepo.createQueryBuilder.mockReturnValue(qbMock);

      const result = await service.getSummary('link-1', 'user-1');

      expect(result).toEqual({
        totalClicks: 128,
        clicksToday: 17,
        clicksThisWeek: 74,
        clicksThisMonth: 128,
      });
    });
  });
});
