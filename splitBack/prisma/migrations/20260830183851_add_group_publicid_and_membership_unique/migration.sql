-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "publicId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Group_publicId_key" ON "Group"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "UserOnGroup_groupId_userId_key" ON "UserOnGroup"("groupId", "userId");
