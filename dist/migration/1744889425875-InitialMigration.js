"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InitialMigration1744889425875 = void 0;
class InitialMigration1744889425875 {
    constructor() {
        this.name = 'InitialMigration1744889425875';
    }
    up(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            yield queryRunner.query(`ALTER TYPE "public"."trades_status_enum" RENAME TO "trades_status_enum_old"`);
            yield queryRunner.query(`CREATE TYPE "public"."trades_status_enum" AS ENUM('pending', 'Active Funded', 'assigned', 'completed', 'cancelled', 'disputed', 'escalated', 'paid', 'successful')`);
            yield queryRunner.query(`ALTER TABLE "trades" ALTER COLUMN "status" DROP DEFAULT`);
            yield queryRunner.query(`ALTER TABLE "trades" ALTER COLUMN "status" TYPE "public"."trades_status_enum" USING "status"::"text"::"public"."trades_status_enum"`);
            yield queryRunner.query(`ALTER TABLE "trades" ALTER COLUMN "status" SET DEFAULT 'pending'`);
            yield queryRunner.query(`DROP TYPE "public"."trades_status_enum_old"`);
        });
    }
    down(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            yield queryRunner.query(`CREATE TYPE "public"."trades_status_enum_old" AS ENUM('pending', 'Active Funded', 'assigned', 'completed', 'cancelled', 'disputed', 'escalated', 'paid')`);
            yield queryRunner.query(`ALTER TABLE "trades" ALTER COLUMN "status" DROP DEFAULT`);
            yield queryRunner.query(`ALTER TABLE "trades" ALTER COLUMN "status" TYPE "public"."trades_status_enum_old" USING "status"::"text"::"public"."trades_status_enum_old"`);
            yield queryRunner.query(`ALTER TABLE "trades" ALTER COLUMN "status" SET DEFAULT 'pending'`);
            yield queryRunner.query(`DROP TYPE "public"."trades_status_enum"`);
            yield queryRunner.query(`ALTER TYPE "public"."trades_status_enum_old" RENAME TO "trades_status_enum"`);
        });
    }
}
exports.InitialMigration1744889425875 = InitialMigration1744889425875;
