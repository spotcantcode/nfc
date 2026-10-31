-- Run once in the Supabase SQL editor as postgres, after enabling Supabase Cron.
-- The named schedule is updated if this script is run again. Runs inside the DB:
-- Vercel requires no cron endpoint, cron secret, or management credential.
select cron.schedule('nfc-retention', '0 3 * * *', 'select public.nfc_prune_history()');
