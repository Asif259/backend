import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { Link } from './entities/link.entity.js';
import { CreateLinkDto } from './dto/create-link.dto.js';
import { UpdateLinkDto } from './dto/update-link.dto.js';

export interface LinkWithClickCount extends Link {
  clickCount: number;
  status: 'active' | 'disabled';
}

export interface GetLinksParams {
  search?: string;
  status?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class LinksService {
  constructor(
    @InjectRepository(Link)
    private readonly linkRepository: Repository<Link>,
  ) {}

  /**
   * Generate a cryptographically secure 7-character alphanumeric short code.
   *
   * Uses crypto.randomBytes instead of Math.random() to ensure codes cannot
   * be predicted even if an attacker knows the generation time or system state.
   * The rejection-sampling approach prevents modulo bias.
   */
  private generateShortCode(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const LENGTH = 7;
    let code = '';
    while (code.length < LENGTH) {
      const byte = randomBytes(1)[0];
      // Rejection sampling: discard values that would cause modulo bias
      if (byte !== undefined && byte < 256 - (256 % chars.length)) {
        code += chars[byte % chars.length];
      }
    }
    return code;
  }


  async create(userId: string, dto: CreateLinkDto): Promise<LinkWithClickCount> {
    let shortCode = dto.shortCode;

    if (shortCode) {
      const existing = await this.linkRepository.findOne({ where: { shortCode } });
      if (existing) {
        throw new ConflictException(`Short code "${shortCode}" is already taken`);
      }
    } else {
      // auto-generate, retry on collision
      let attempts = 0;
      do {
        shortCode = this.generateShortCode();
        attempts++;
        if (attempts > 10) throw new ConflictException('Could not generate unique short code');
      } while (await this.linkRepository.findOne({ where: { shortCode } }));
    }

    const link = this.linkRepository.create({
      userId,
      shortCode,
      originalUrl: dto.originalUrl,
    });

    const saved = await this.linkRepository.save(link);
    return this.toResponse(saved, 0);
  }

  async findAllByUser(userId: string, params: GetLinksParams = {}): Promise<LinkWithClickCount[]> {
    const { search, status, sort = 'newest', page = 1, limit = 50 } = params;

    const qb = this.linkRepository
      .createQueryBuilder('link')
      .leftJoin('link.clicks', 'click')
      .addSelect('COUNT(click.id)::int', 'clickCount')
      .where('link.user_id = :userId', { userId })
      .groupBy('link.id')
      .take(limit)
      .skip((page - 1) * limit);

    if (search) {
      qb.andWhere(
        '(link.short_code ILIKE :search OR link.original_url ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Status is stored as a virtual field (no DB column yet),
    // so we filter post-query. For now forward the column if it exists.
    // We handle sort:
    switch (sort) {
      case 'oldest':
        qb.orderBy('link.created_at', 'ASC');
        break;
      case 'most_clicks':
        qb.orderBy('clickCount', 'DESC');
        break;
      case 'least_clicks':
        qb.orderBy('clickCount', 'ASC');
        break;
      default: // newest
        qb.orderBy('link.created_at', 'DESC');
    }

    const raw = await qb.getRawAndEntities();

    return raw.entities.map((link, idx) => {
      const count = Number(raw.raw[idx]?.clickCount ?? 0);
      return this.toResponse(link, count);
    });
  }

  async findOne(id: string, userId: string): Promise<LinkWithClickCount> {
    const qb = this.linkRepository
      .createQueryBuilder('link')
      .leftJoin('link.clicks', 'click')
      .addSelect('COUNT(click.id)::int', 'clickCount')
      .where('link.id = :id', { id })
      .groupBy('link.id');

    const { entities, raw } = await qb.getRawAndEntities();
    const link = entities[0];

    if (!link) throw new NotFoundException('Link not found');
    if (link.userId !== userId) throw new ForbiddenException('Access denied');

    return this.toResponse(link, Number(raw[0]?.clickCount ?? 0));
  }

  async findByShortCode(shortCode: string): Promise<Link | null> {
    return this.linkRepository.findOne({ where: { shortCode } });
  }

  async update(id: string, userId: string, dto: UpdateLinkDto): Promise<LinkWithClickCount> {
    const link = await this.linkRepository.findOne({ where: { id } });
    if (!link) throw new NotFoundException('Link not found');
    if (link.userId !== userId) throw new ForbiddenException('Access denied');

    if (dto.shortCode && dto.shortCode !== link.shortCode) {
      const conflict = await this.linkRepository.findOne({ where: { shortCode: dto.shortCode } });
      if (conflict) throw new ConflictException(`Short code "${dto.shortCode}" is already taken`);
      link.shortCode = dto.shortCode;
    }

    if (dto.originalUrl) link.originalUrl = dto.originalUrl;

    const saved = await this.linkRepository.save(link);
    // preserve click count from before (do a fresh count query)
    const count = await this.linkRepository
      .createQueryBuilder('link')
      .leftJoin('link.clicks', 'click')
      .addSelect('COUNT(click.id)::int', 'clickCount')
      .where('link.id = :id', { id })
      .groupBy('link.id')
      .getRawOne<{ clickCount: number }>();

    return this.toResponse(saved, Number(count?.clickCount ?? 0));
  }

  async remove(id: string, userId: string): Promise<{ success: boolean }> {
    const link = await this.linkRepository.findOne({ where: { id } });
    if (!link) throw new NotFoundException('Link not found');
    if (link.userId !== userId) throw new ForbiddenException('Access denied');

    await this.linkRepository.remove(link);
    return { success: true };
  }

  /**
   * Enable or disable a link.
   *
   * Ownership is verified before any mutation.
   * Returns the updated link so the frontend can update its local state.
   */
  async setActive(id: string, userId: string, isActive: boolean): Promise<LinkWithClickCount> {
    const link = await this.linkRepository.findOne({ where: { id } });
    if (!link) throw new NotFoundException('Link not found');
    if (link.userId !== userId) throw new ForbiddenException('Access denied');

    link.isActive = isActive;
    const saved = await this.linkRepository.save(link);

    const count = await this.linkRepository
      .createQueryBuilder('link')
      .leftJoin('link.clicks', 'click')
      .addSelect('COUNT(click.id)::int', 'clickCount')
      .where('link.id = :id', { id })
      .groupBy('link.id')
      .getRawOne<{ clickCount: number }>();

    return this.toResponse(saved, Number(count?.clickCount ?? 0));
  }

  private toResponse(link: Link, clickCount: number): LinkWithClickCount {
    return {
      ...link,
      clickCount,
      status: link.isActive ? 'active' : 'disabled',
    };
  }
}
