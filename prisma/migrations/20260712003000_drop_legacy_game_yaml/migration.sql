DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Game" WHERE "project" IS NULL) THEN
    RAISE EXCEPTION 'cloud_game_project_migration_required';
  END IF;
END $$;

ALTER TABLE "Game"
ALTER COLUMN "project" SET NOT NULL;

ALTER TABLE "Game"
DROP COLUMN "yaml";
