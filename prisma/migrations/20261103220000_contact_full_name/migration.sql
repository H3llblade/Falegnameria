-- Nome e cognome in un unico campo; attività facoltativa; codice missiva senza spazi
ALTER TABLE "Contact" ADD COLUMN "name" TEXT;
UPDATE "Contact" SET "name" = btrim(concat_ws(' ', btrim("firstName"), btrim("lastName")));
ALTER TABLE "Contact" ALTER COLUMN "name" SET NOT NULL;

DROP INDEX IF EXISTS "Contact_lastName_firstName_idx";
ALTER TABLE "Contact" DROP COLUMN "firstName", DROP COLUMN "lastName";
CREATE INDEX "Contact_name_idx" ON "Contact"("name");

ALTER TABLE "Contact" ALTER COLUMN "activity" DROP NOT NULL;
UPDATE "Contact" SET "activity" = NULL WHERE btrim("activity") = '';

UPDATE "Contact" SET "missiveCode" = regexp_replace("missiveCode", '\s+', '', 'g') WHERE "missiveCode" ~ '\s';
