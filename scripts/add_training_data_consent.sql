-- Opt-in flag for using uploaded audio to improve the processing pipeline.
-- NULL / missing = not consented (opt-out). No backfill of existing rows.
alter table public.profiles
  add column if not exists training_data_consent boolean default null;
