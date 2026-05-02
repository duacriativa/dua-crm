-- Mover Rafaela Magalhães do "Fechado" para "Novo Cadastro"
-- Pegar o ID da stage "Novo Cadastro" do mesmo pipeline onde ela está
UPDATE "PipelineLead" pl
SET "stageId" = (
  SELECT ps2.id
  FROM "PipelineStage" ps2
  WHERE ps2."pipelineId" = (
    SELECT ps."pipelineId" FROM "PipelineStage" ps WHERE ps.id = pl."stageId"
  )
  AND ps2.position = 0
  ORDER BY ps2.position ASC
  LIMIT 1
)
WHERE pl."contactId" = (
  SELECT c.id FROM "Contact" c
  WHERE c.name ILIKE 'Rafaela Magal%'
  LIMIT 1
)
AND EXISTS (
  SELECT 1 FROM "PipelineStage" ps
  WHERE ps.id = pl."stageId" AND ps.name = 'Fechado'
);
