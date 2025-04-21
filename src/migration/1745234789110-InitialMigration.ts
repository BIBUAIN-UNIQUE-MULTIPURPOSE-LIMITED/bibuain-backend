import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1745234789110 implements MigrationInterface {
    name = 'InitialMigration1745234789110'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trades" ALTER COLUMN "status" SET DEFAULT 'Active Funded'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trades" ALTER COLUMN "status" DROP DEFAULT`);
    }

}
