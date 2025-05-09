import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1746778609535 implements MigrationInterface {
    name = 'InitialMigration1746778609535'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "lastResetAt" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "lastResetAt"`);
    }

}
