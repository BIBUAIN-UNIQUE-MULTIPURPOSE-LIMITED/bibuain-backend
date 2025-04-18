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
exports.AddRLS1741943931058 = void 0;
class AddRLS1741943931058 {
    up(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            // Enable Row-Level Security on messages table
            yield queryRunner.query(`ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY`);
            // Policy: Users can only see their own messages
            yield queryRunner.query(`
            CREATE POLICY user_can_view_own_messages
            ON "messages"
            FOR SELECT
            USING ("senderId" = auth.uid())
        `);
            // Policy: Users can only insert their own messages
            yield queryRunner.query(`
            CREATE POLICY user_can_insert_messages
            ON "messages"
            FOR INSERT
            WITH CHECK ("senderId" = auth.uid())
        `);
        });
    }
    down(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            // Remove policies if migration is rolled back
            yield queryRunner.query(`DROP POLICY user_can_view_own_messages ON "messages"`);
            yield queryRunner.query(`DROP POLICY user_can_insert_messages ON "messages"`);
            // Disable Row-Level Security (optional)
            yield queryRunner.query(`ALTER TABLE "messages" DISABLE ROW LEVEL SECURITY`);
        });
    }
}
exports.AddRLS1741943931058 = AddRLS1741943931058;
