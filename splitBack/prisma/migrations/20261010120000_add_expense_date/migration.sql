-- AlterTable: giorno della spesa scelto dall'utente. Il default CURRENT_DATE
-- serve solo a chi non lo manda (il frontend lo manda sempre).
ALTER TABLE "Expense" ADD COLUMN     "date" DATE NOT NULL DEFAULT CURRENT_DATE;

-- Le spese gia' presenti prendono il giorno in cui erano state inserite.
-- "createdDate" e' un timestamp senza fuso scritto in UTC: lo si riporta
-- all'ora italiana (quella degli alpha tester) prima di tenerne il giorno,
-- altrimenti una spesa inserita fra mezzanotte e le 2 finirebbe nel giorno
-- prima.
UPDATE "Expense" SET "date" = ("createdDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Rome')::date;
