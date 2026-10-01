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
