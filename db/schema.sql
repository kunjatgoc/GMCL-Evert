-- Global Market League -- tables and indexes.
-- Procedures live one-per-file in db/procedures/ and are applied after this.
--
--     psql "$DATABASE_URL" -f db/schema.sql
--     for f in db/procedures/*.sql; do psql "$DATABASE_URL" -f "$f"; done
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

-- Real-money interest, captured by the card under the registration form. Kept
-- in its own table rather than a flag on `registration`: these people have not
-- entered the league, and many will never fill the form above it.
create table if not exists real_account_request (
    id           bigserial   primary key,
    email        text        not null,
    created_at   timestamptz not null default now()
);

-- Same case-insensitive one-per-person rule as `registration`, and for the
-- same reason: sp_request_real_account leans on the index, not a prior SELECT.
create unique index if not exists real_account_request_email_key
    on real_account_request (lower(email));

-- Whether MT5 has actually created the trading account for this address.
-- Signing up here and holding a login are two different facts: the platform
-- creates the account on its own schedule, and some people never get one.
--
-- Kept as YES/NO text rather than a boolean because the value is read far more
-- often than it is queried -- it lands in spreadsheets handed to people who
-- are not going to translate `t` and `f`. The CHECK is what keeps it honest.
--
-- Defaults to NO: a row is written the moment someone submits the form, and
-- nobody holds a login at that point. Backfilled from the platform's
-- account-created exports by db/backfill_is_id_given.sql.
alter table registration
    add column if not exists is_id_given text not null default 'NO';
alter table registration drop constraint if exists registration_is_id_given_chk;
alter table registration add constraint registration_is_id_given_chk
    check (is_id_given in ('YES', 'NO'));

alter table real_account_request
    add column if not exists is_id_given text not null default 'NO';
alter table real_account_request
    drop constraint if exists real_account_request_is_id_given_chk;
alter table real_account_request add constraint real_account_request_is_id_given_chk
    check (is_id_given in ('YES', 'NO'));
