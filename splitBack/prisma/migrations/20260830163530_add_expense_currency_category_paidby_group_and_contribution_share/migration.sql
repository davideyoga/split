/*
  Warnings:

  - You are about to drop the `ExpenseOnGroup` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `paidById` to the `Expense` table without a default value. This is not possible if the table is not empty.
  - Added the required column `share` to the `ExpenseContribution` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ExpenseOnGroup" DROP CONSTRAINT "ExpenseOnGroup_expenseId_fkey";

-- DropForeignKey
ALTER TABLE "ExpenseOnGroup" DROP CONSTRAINT "ExpenseOnGroup_groupId_fkey";

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "category" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'EUR',
ADD COLUMN     "groupId" INTEGER,
ADD COLUMN     "paidById" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "ExpenseContribution" ADD COLUMN     "share" DECIMAL(65,30) NOT NULL;

-- DropTable
DROP TABLE "ExpenseOnGroup";

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
