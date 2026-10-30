-- CreateTable
CREATE TABLE "SalesTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "conversationId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "source" TEXT NOT NULL DEFAULT 'RULE',
    "ruleKey" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesTask_tenantId_ruleKey_key" ON "SalesTask"("tenantId", "ruleKey");
CREATE INDEX "SalesTask_tenantId_status_dueAt_idx" ON "SalesTask"("tenantId", "status", "dueAt");
CREATE INDEX "SalesTask_contactId_idx" ON "SalesTask"("contactId");

-- AddForeignKey
ALTER TABLE "SalesTask" ADD CONSTRAINT "SalesTask_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesTask" ADD CONSTRAINT "SalesTask_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

REVOKE ALL ON TABLE "SalesTask" FROM anon, authenticated;
