import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1746536543851 implements MigrationInterface {
    name = 'InitialMigration1746536543851'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."banks_tag_enum" AS ENUM('fresh', 'unfunded', 'funded', 'used', 'rollover')`);
        await queryRunner.query(`ALTER TABLE "banks" ADD "tag" "public"."banks_tag_enum" NOT NULL DEFAULT 'unfunded'`);
        await queryRunner.query(`ALTER TABLE "banks" ADD "shift_id" uuid`);
        await queryRunner.query(`ALTER TABLE "banks" ADD CONSTRAINT "FK_703c435e39af3c7516d3cc60863" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "banks" DROP CONSTRAINT "FK_703c435e39af3c7516d3cc60863"`);
        await queryRunner.query(`ALTER TABLE "banks" DROP COLUMN "shift_id"`);
        await queryRunner.query(`ALTER TABLE "banks" DROP COLUMN "tag"`);
        await queryRunner.query(`DROP TYPE "public"."banks_tag_enum"`);
    }

}
