import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1748363762418 implements MigrationInterface {
  name = "InitialMigration1748363762418";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "trades" ADD "queuePosition" integer`);
    await queryRunner.query(
      `COMMENT ON COLUMN "trades"."queuePosition" IS 'Position in the trade queue (1-based index)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "trades" ADD "queuedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "trades"."queuedAt" IS 'When the trade was added to the queue'`,
    );
    await queryRunner.query(
      `ALTER TABLE "trades" ADD "lastQueueCheck" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "trades"."lastQueueCheck" IS 'Last time the queue was checked/processed for this trade'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1d8d9ba7cc61741fad70bd958b" ON "trades" ("queuePosition") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_69b387869d7ff1d810be45b7b4" ON "trades" ("queuedAt") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_69b387869d7ff1d810be45b7b4"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1d8d9ba7cc61741fad70bd958b"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "trades"."lastQueueCheck" IS 'Last time the queue was checked/processed for this trade'`,
    );
    await queryRunner.query(
      `ALTER TABLE "trades" DROP COLUMN "lastQueueCheck"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "trades"."queuedAt" IS 'When the trade was added to the queue'`,
    );
    await queryRunner.query(`ALTER TABLE "trades" DROP COLUMN "queuedAt"`);
    await queryRunner.query(
      `COMMENT ON COLUMN "trades"."queuePosition" IS 'Position in the trade queue (1-based index)'`,
    );
    await queryRunner.query(`ALTER TABLE "trades" DROP COLUMN "queuePosition"`);
  }
}
