-- Existing hours have no known timezone. Do not infer one from the server or browser.
-- Doctors must explicitly configure an IANA timezone before further bookings.
ALTER TABLE "doctors" ADD COLUMN "time_zone" TEXT;
