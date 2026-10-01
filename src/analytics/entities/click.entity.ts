import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import type { Link } from '../../links/entities/link.entity.js';

@Entity('clicks')
@Index('idx_clicks_link_id', ['linkId'])
@Index('idx_clicks_link_id_timestamp', ['linkId', 'timestamp'])
export class Click {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'link_id', type: 'uuid' })
  linkId!: string;

  @CreateDateColumn({ name: 'timestamp', type: 'timestamptz' })
  timestamp!: Date;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress!: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent!: string | null;

  @Column({ type: 'text', nullable: true })
  referrer!: string | null;

  @ManyToOne('Link', (link: Link) => link.clicks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'link_id' })
  link!: Link;
}
