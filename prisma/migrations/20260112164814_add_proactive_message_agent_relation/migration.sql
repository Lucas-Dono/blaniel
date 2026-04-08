-- AddForeignKey
ALTER TABLE "ProactiveMessage" ADD CONSTRAINT "ProactiveMessage_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
