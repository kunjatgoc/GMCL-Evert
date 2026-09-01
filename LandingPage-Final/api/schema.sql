-- Global Market League -- tables and indexes.
-- Procedures live one-per-file in api/procedures/ and are applied after this.
--
--     psql "$DATABASE_URL" -f api/schema.sql
--     for f in api/procedures/*.sql; do psql "$DATABASE_URL" -f "$f"; done
--
-- Re-running either step is safe; every statement is idempotent.

-- Entries are timed in IST, so every session renders timestamptz in IST rather
-- than whatever the host happens to be set to. This changes display only:
-- created_at still stores an absolute instant, so comparisons and DST are the
-- server's problem, not ours.
do $$
begin
    execute format('alter database %I set timezone = %L',
                   current_database(), 'Asia/Kolkata');
end;
$$;

create table if not exists registration (
    id           bigserial   primary key,
    full_name    text        not null,
    email        text        not null,
    mobile       text        not null,          -- E.164, normalised by the API
    country      text        not null,          -- ISO 3166-1 alpha-2
    created_at   timestamptz not null default now()
);

-- One entry per person, case-insensitive: Alex@x.com and alex@x.com are the
-- same entrant. sp_register relies on this index rather than checking first.
create unique index if not exists registration_email_key
    on registration (lower(email));
