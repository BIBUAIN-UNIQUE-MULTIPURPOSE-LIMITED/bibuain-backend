import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1745934664130 implements MigrationInterface {
    name = 'InitialMigration1745934664130'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "rates" ALTER COLUMN "platformCostPrices" SET DEFAULT '{}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "rates" ALTER COLUMN "platformCostPrices" DROP DEFAULT`);
    }

}
