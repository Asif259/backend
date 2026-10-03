import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add missing columns
 *
 * This migration adds columns that exist in the TypeORM entities but were
 * missing from the initial migration:
 *
 * links:
 *   - is_active  (boolean, default true) — enables link enable/disable
 *   - expires_at (timestamptz, nullable) — future link expiration support
 *
 * clicks:
 *   - device  (varchar 50, nullable) — parsed device type from user-agent
 *   - browser (varchar 50, nullable) — parsed browser name from user-agent
 *   - country (varchar 100, nullable) — geo-resolved country code
 *
 * All new columns are non-breaking:
 *   - Existing rows get is_active=true (no links disabled by default).
 *   - Existing rows get null for device/browser/country (no geo data yet).
 */
export class AddMissingColumns1790800000000 implements MigrationInterface {
  name = 'AddMissingColumns1790800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // links: enable/disable support
    await queryRunner.query(
      `ALTER TABLE "links" ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true`,
    );

    // links: optional expiration timestamp
    await queryRunner.query(
      `ALTER TABLE "links" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP WITH TIME ZONE`,
    );

    // clicks: device/browser/country for analytics breakdown
    await queryRunner.query(
      `ALTER TABLE "clicks" ADD COLUMN IF NOT EXISTS "device" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "clicks" ADD COLUMN IF NOT EXISTS "browser" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "clicks" ADD COLUMN IF NOT EXISTS "country" character varying(100)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "clicks" DROP COLUMN IF EXISTS "country"`);
    await queryRunner.query(`ALTER TABLE "clicks" DROP COLUMN IF EXISTS "browser"`);
    await queryRunner.query(`ALTER TABLE "clicks" DROP COLUMN IF EXISTS "device"`);
    await queryRunner.query(`ALTER TABLE "links" DROP COLUMN IF EXISTS "expires_at"`);
    await queryRunner.query(`ALTER TABLE "links" DROP COLUMN IF EXISTS "is_active"`);
  }
}
