import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import type { Link } from '../../links/entities/link.entity.js';

/**
 * User entity.
 *
 * The `passwordHash` field is decorated with @Exclude() so that when
 * a response is serialized via ClassSerializerInterceptor (or manually
 * via `instanceToPlain`), the hash is never included.
 *
 * The service layer also manually omits this field using destructuring:
 *   const { passwordHash: _, ...safeUser } = user;
 * This double-guard ensures the hash cannot leak even if serialization
 * configuration changes in the future.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  /** Never serialized in responses — excluded at both entity and service level. */
  @Exclude()
  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany('Link', (link: Link) => link.user)
  links!: Link[];
}
