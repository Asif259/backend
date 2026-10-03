import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { LinksService } from './links.service.js';
import { Link } from './entities/link.entity.js';

describe('LinksService', () => {
  let service: LinksService;
  let linkRepo: any;

  const makeLink = (overrides: Partial<Link> = {}): Link =>
    ({
      id: 'link-uuid',
      userId: 'user-uuid',
      shortCode: 'abc1234',
      originalUrl: 'https://example.com',
      isActive: true,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      clicks: [],
      user: {} as any,
      ...overrides,
    }) as Link;

  const mockQb = () => {
    const qb: any = {
      leftJoin: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      getRawAndEntities: vi.fn().mockResolvedValue({ entities: [], raw: [] }),
      getRawOne: vi.fn().mockResolvedValue({ clickCount: 0 }),
    };
    return qb;
  };

  beforeEach(async () => {
    linkRepo = {
      findOne: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      remove: vi.fn(),
      createQueryBuilder: vi.fn(() => mockQb()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinksService,
        { provide: getRepositoryToken(Link), useValue: linkRepo },
      ],
    }).compile();

    service = module.get<LinksService>(LinksService);
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should reject a custom short code that is already taken', async () => {
      linkRepo.findOne.mockResolvedValue(makeLink());

      await expect(
        service.create('user-uuid', {
          originalUrl: 'https://example.com',
          shortCode: 'abc1234',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create a link with an auto-generated short code when none is provided', async () => {
      linkRepo.findOne.mockResolvedValue(null); // no collision
      const savedLink = makeLink();
      linkRepo.create.mockReturnValue(savedLink);
      linkRepo.save.mockResolvedValue(savedLink);

      const result = await service.create('user-uuid', {
        originalUrl: 'https://example.com',
      });

      expect(result.shortCode).toBeDefined();
      expect(result.status).toBe('active');
      expect(result.clickCount).toBe(0);
    });
  });

  // ─── Ownership enforcement ─────────────────────────────────────────────────

  describe('findOne — ownership', () => {
    it('should throw NotFoundException for a non-existent link', async () => {
      const qb = mockQb();
      qb.getRawAndEntities.mockResolvedValue({ entities: [], raw: [] });
      linkRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(service.findOne('missing-id', 'user-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when the requesting user does not own the link', async () => {
      const link = makeLink({ userId: 'other-user' });
      const qb = mockQb();
      qb.getRawAndEntities.mockResolvedValue({
        entities: [link],
        raw: [{ clickCount: 5 }],
      });
      linkRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(service.findOne('link-uuid', 'user-uuid')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return the link when the requesting user owns it', async () => {
      const link = makeLink({ userId: 'user-uuid' });
      const qb = mockQb();
      qb.getRawAndEntities.mockResolvedValue({
        entities: [link],
        raw: [{ clickCount: 10 }],
      });
      linkRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findOne('link-uuid', 'user-uuid');
      expect(result.id).toBe('link-uuid');
      expect(result.clickCount).toBe(10);
    });
  });

  describe('update — ownership', () => {
    it('should throw ForbiddenException if user does not own the link', async () => {
      linkRepo.findOne.mockResolvedValue(makeLink({ userId: 'other-user' }));

      await expect(
        service.update('link-uuid', 'user-uuid', {
          originalUrl: 'https://updated.com',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject a duplicate short code on update', async () => {
      // findOne for the link being updated
      linkRepo.findOne.mockResolvedValueOnce(makeLink({ userId: 'user-uuid' }));
      // findOne for the collision check
      linkRepo.findOne.mockResolvedValueOnce(makeLink({ shortCode: 'taken' }));

      await expect(
        service.update('link-uuid', 'user-uuid', { shortCode: 'taken' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove — ownership', () => {
    it('should throw ForbiddenException if user does not own the link', async () => {
      linkRepo.findOne.mockResolvedValue(makeLink({ userId: 'different-user' }));

      await expect(service.remove('link-uuid', 'user-uuid')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should delete the link and return { success: true }', async () => {
      linkRepo.findOne.mockResolvedValue(makeLink({ userId: 'user-uuid' }));
      linkRepo.remove.mockResolvedValue(undefined);

      const result = await service.remove('link-uuid', 'user-uuid');
      expect(result).toEqual({ success: true });
    });
  });

  // ─── setActive ─────────────────────────────────────────────────────────────

  describe('setActive — ownership', () => {
    it('should throw ForbiddenException if user does not own the link', async () => {
      linkRepo.findOne.mockResolvedValue(makeLink({ userId: 'other-user' }));

      await expect(service.setActive('link-uuid', 'user-uuid', false)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should set isActive=false and return status=disabled', async () => {
      const link = makeLink({ userId: 'user-uuid', isActive: true });
      linkRepo.findOne.mockResolvedValue(link);

      const savedLink = { ...link, isActive: false };
      linkRepo.save.mockResolvedValue(savedLink);

      const qb = mockQb();
      qb.getRawOne.mockResolvedValue({ clickCount: 5 });
      linkRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.setActive('link-uuid', 'user-uuid', false);
      expect(result.status).toBe('disabled');
    });

    it('should set isActive=true and return status=active', async () => {
      const link = makeLink({ userId: 'user-uuid', isActive: false });
      linkRepo.findOne.mockResolvedValue(link);

      const savedLink = { ...link, isActive: true };
      linkRepo.save.mockResolvedValue(savedLink);

      const qb = mockQb();
      qb.getRawOne.mockResolvedValue({ clickCount: 0 });
      linkRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.setActive('link-uuid', 'user-uuid', true);
      expect(result.status).toBe('active');
    });
  });

  // ─── status derivation ─────────────────────────────────────────────────────

  describe('status field', () => {
    it('should derive status=active from isActive=true', async () => {
      const link = makeLink({ userId: 'user-uuid', isActive: true });
      const qb = mockQb();
      qb.getRawAndEntities.mockResolvedValue({
        entities: [link],
        raw: [{ clickCount: 0 }],
      });
      linkRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findOne('link-uuid', 'user-uuid');
      expect(result.status).toBe('active');
    });

    it('should derive status=disabled from isActive=false', async () => {
      const link = makeLink({ userId: 'user-uuid', isActive: false });
      const qb = mockQb();
      qb.getRawAndEntities.mockResolvedValue({
        entities: [link],
        raw: [{ clickCount: 0 }],
      });
      linkRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findOne('link-uuid', 'user-uuid');
      expect(result.status).toBe('disabled');
    });
  });
});
