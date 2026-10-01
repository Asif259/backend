import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateInitialEntities1790786897488 implements MigrationInterface {
    name = 'CreateInitialEntities1790786897488'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "email" character varying(255) NOT NULL, "password_hash" character varying(255) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "links" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "short_code" character varying(50) NOT NULL, "original_url" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_e310b9137c352dac8806d5ccbd7" UNIQUE ("short_code"), CONSTRAINT "PK_ecf17f4a741d3c5ba0b4c5ab4b6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "idx_links_short_code" ON "links"  ("short_code") `);
        await queryRunner.query(`CREATE INDEX "idx_links_user_id" ON "links"  ("user_id") `);
        await queryRunner.query(`CREATE TABLE "clicks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "link_id" uuid NOT NULL, "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ip_address" character varying(45), "user_agent" text, "referrer" text, CONSTRAINT "PK_7765d7ffdeb0ed2675651020814" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_clicks_link_id_timestamp" ON "clicks"  ("link_id", "timestamp") `);
        await queryRunner.query(`CREATE INDEX "idx_clicks_link_id" ON "clicks"  ("link_id") `);
        await queryRunner.query(`ALTER TABLE "links" ADD CONSTRAINT "FK_9f8dea86e48a7216c4f5369c1e4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "clicks" ADD CONSTRAINT "FK_3e477bfbdf3a572363b65bc4525" FOREIGN KEY ("link_id") REFERENCES "links"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "clicks" DROP CONSTRAINT "FK_3e477bfbdf3a572363b65bc4525"`);
        await queryRunner.query(`ALTER TABLE "links" DROP CONSTRAINT "FK_9f8dea86e48a7216c4f5369c1e4"`);
        await queryRunner.query(`DROP INDEX "public"."idx_clicks_link_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_clicks_link_id_timestamp"`);
        await queryRunner.query(`DROP TABLE "clicks"`);
        await queryRunner.query(`DROP INDEX "public"."idx_links_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_links_short_code"`);
        await queryRunner.query(`DROP TABLE "links"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
