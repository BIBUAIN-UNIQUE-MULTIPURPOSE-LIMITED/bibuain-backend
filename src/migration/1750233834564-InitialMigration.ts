import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1750233834564 implements MigrationInterface {
  name = "InitialMigration1750233834564";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "trades" RENAME COLUMN "platformCreatedAt" TO "platform_created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_templates" DROP COLUMN "comment"`,
    );
    await queryRunner.query(
      `ALTER TABLE "banks" ALTER COLUMN "bankName" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "banks" ALTER COLUMN "bankName" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_templates" ADD "comment" text NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "trades" RENAME COLUMN "platform_created_at" TO "platformCreatedAt"`,
    );
  }
}
