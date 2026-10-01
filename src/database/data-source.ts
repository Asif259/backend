import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from '../users/entities/user.entity.js';
import { Link } from '../links/entities/link.entity.js';
import { Click } from '../analytics/entities/click.entity.js';

config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5433', 10),
  username: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'link_shortener',
  entities: [User, Link, Click],
  migrations: ['dist/database/migrations/*.js'],
  synchronize: false,
});
