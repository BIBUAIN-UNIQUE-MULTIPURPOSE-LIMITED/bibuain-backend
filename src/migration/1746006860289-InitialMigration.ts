import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1746006860289 implements MigrationInterface {
    name = 'InitialMigration1746006860289'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trades" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "trades" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`COMMENT ON COLUMN "trades"."createdAt" IS 'UTC timestamp of when the row was created'`);
        await queryRunner.query(`ALTER TABLE "trades" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "trades" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`COMMENT ON COLUMN "trades"."updatedAt" IS 'UTC timestamp of last update'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`COMMENT ON COLUMN "trades"."updatedAt" IS 'UTC timestamp of last update'`);
        await queryRunner.query(`ALTER TABLE "trades" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "trades" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`COMMENT ON COLUMN "trades"."createdAt" IS 'UTC timestamp of when the row was created'`);
        await queryRunner.query(`ALTER TABLE "trades" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "trades" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
    }

}
