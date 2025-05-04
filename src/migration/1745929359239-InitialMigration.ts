import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1745929359239 implements MigrationInterface {
    name = 'InitialMigration1745929359239'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "rates" ADD "platformCostPrices" jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "rates" DROP COLUMN "platformCostPrices"`);
    }

}
