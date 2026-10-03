import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import type { User } from '../../users/entities/user.entity.js';
import type { Click } from '../../analytics/entities/click.entity.js';

@Entity('links')
@Index('idx_links_user_id', ['userId'])
export class Link {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'short_code', type: 'varchar', length: 50, unique: true })
  @Index('idx_links_short_code', { unique: true })
  shortCode!: string;

  @Column({ name: 'original_url', type: 'text' })
  originalUrl!: string;

  /**
   * Whether this link is currently active.
   *
   * When false the redirect endpoint returns 410 Gone instead of redirecting.
   * This prevents disabled links from functioning while preserving analytics.
   */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  /**
   * Optional expiration timestamp.
   *
   * When set and in the past, the redirect endpoint returns 410 Gone.
   * Not enforced at the DB level — enforced in the service layer.
   */
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne('User', (user: User) => user.links, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @OneToMany('Click', (click: Click) => click.link)
  clicks!: Click[];
}
