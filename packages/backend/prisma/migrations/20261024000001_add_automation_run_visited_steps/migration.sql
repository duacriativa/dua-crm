-- Passos por onde cada sessão do bot passou (contadores "passaram por" do editor)
ALTER TABLE "AutomationRun" ADD COLUMN "visitedSteps" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
