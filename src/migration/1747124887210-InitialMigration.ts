import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1747124887210 implements MigrationInterface {
    name = 'InitialMigration1747124887210'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "shifts" DROP CONSTRAINT "FK_b7ee999d6ca8d98eecfcaa673ba"`);
        await queryRunner.query(`ALTER TABLE "shifts" DROP COLUMN "bank_id"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "lastResetAt"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "lastResetAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "shifts" ADD "bank_id" uuid`);
        await queryRunner.query(`ALTER TABLE "shifts" ADD CONSTRAINT "FK_b7ee999d6ca8d98eecfcaa673ba" FOREIGN KEY ("bank_id") REFERENCES "banks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
