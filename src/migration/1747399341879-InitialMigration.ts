import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1747399341879 implements MigrationInterface {
    name = 'InitialMigration1747399341879'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trades" ADD "platformCreatedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`COMMENT ON COLUMN "trades"."platformCreatedAt" IS 'Original trade time from platform'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`COMMENT ON COLUMN "trades"."platformCreatedAt" IS 'Original trade time from platform'`);
        await queryRunner.query(`ALTER TABLE "trades" DROP COLUMN "platformCreatedAt"`);
    }

}
