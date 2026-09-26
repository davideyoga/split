-- AlterTable: la colonna nasce nullable per poter valorizzare le spese gia'
-- presenti, poi diventa NOT NULL. Il default uuid() dello schema e' generato
-- dal client Prisma, non dal DB (come per User/Group).
ALTER TABLE "Expense" ADD COLUMN     "publicId" TEXT;

UPDATE "Expense" SET "publicId" = gen_random_uuid()::text WHERE "publicId" IS NULL;

ALTER TABLE "Expense" ALTER COLUMN "publicId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Expense_publicId_key" ON "Expense"("publicId");
