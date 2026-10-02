import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
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

  /** Generate a random alphanumeric short code (7 chars). */
  private generateShortCode(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 7; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
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
    return this.toResponse(saved, 0, 'active');
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
      return this.toResponse(link, count, 'active');
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

    return this.toResponse(link, Number(raw[0]?.clickCount ?? 0), 'active');
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

    return this.toResponse(saved, Number(count?.clickCount ?? 0), dto.status ?? 'active');
  }

  async remove(id: string, userId: string): Promise<{ success: boolean }> {
    const link = await this.linkRepository.findOne({ where: { id } });
    if (!link) throw new NotFoundException('Link not found');
    if (link.userId !== userId) throw new ForbiddenException('Access denied');

    await this.linkRepository.remove(link);
    return { success: true };
  }

  private toResponse(link: Link, clickCount: number, status: 'active' | 'disabled'): LinkWithClickCount {
    return { ...link, clickCount, status };
  }
}
