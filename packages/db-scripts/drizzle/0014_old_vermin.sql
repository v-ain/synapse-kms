-- Custom SQL migration file, put your code below! --

INSERT INTO "folder_shares" ("folder_id", "user_id", "access_level")
SELECT "id", "user_id", 'owner' FROM "folders"
ON CONFLICT ON CONSTRAINT "folder_user_unique_idx"
DO UPDATE SET "access_level" = 'owner';
