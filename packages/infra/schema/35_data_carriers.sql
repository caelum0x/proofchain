-- =============================================================================
-- DPP — Data carrier registry read model. Populated by the @proofchain/api
-- indexer from the DPPDataCarrier contract. Maps physical GS1/QR/NFC/RFID
-- carriers to a passport token so a scan resolves to the on-chain DPP.
-- Conventions mirror 00_core.sql (hex CHECKs, RLS, idempotent DDL).
-- =============================================================================

create table if not exists dpp_data_carriers (
  id            text        primary key,
  token_id      text        not null,
  passport_id   text        check (passport_id is null or passport_id ~ '^0x[0-9a-f]{64}$'),
  carrier_type  text        not null default 'qr'
                            check (carrier_type in ('qr', 'datamatrix', 'nfc', 'rfid', 'gs1_digital_link')),
  code          text        not null,
  gtin          text,
  resolve_url   text,
  status        text        not null default 'active'
                            check (status in ('active', 'deactivated', 'reissued')),
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists dpp_data_carriers_code_key on dpp_data_carriers (code);
create index if not exists dpp_data_carriers_token_idx        on dpp_data_carriers (token_id);
create index if not exists dpp_data_carriers_gtin_idx          on dpp_data_carriers (gtin);

do $$
declare
  t text;
  tables text[] := array['dpp_data_carriers'];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists %I_set_updated_at on %I', t, t);
    execute format('create trigger %I_set_updated_at before update on %I for each row execute function set_updated_at()', t, t);
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I_read_all on %I', t, t);
    execute format('create policy %I_read_all on %I for select to anon, authenticated using (true)', t, t);
  end loop;
end
$$;
