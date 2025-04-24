import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1745422413940 implements MigrationInterface {
    name = 'InitialMigration1745422413940'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trades" ALTER COLUMN "flagged" SET DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "trades" ALTER COLUMN "isEscalated" SET DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trades" ALTER COLUMN "isEscalated" SET DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "trades" ALTER COLUMN "flagged" SET DEFAULT true`);
    }

}
