-- Admin panel -- accounts and roles.
--
-- Additive only: nothing here touches `registration` or `real_account_request`.
-- Every statement is idempotent, so re-running is safe.
--
--     psql "$DATABASE_URL" -f db/admin_schema.sql
--     .venv/bin/python scripts/seed_admin.py    # creates the one admin

-- Roles are rows, not an enum: adding a third one later is an INSERT rather
-- than an ALTER TYPE that has to be done outside a transaction.
create table if not exists user_roles (
    id    smallserial primary key,
    name  text        not null unique
);

insert into user_roles (name) values ('admin'), ('staff')
    on conflict (name) do nothing;

-- Deliberately generic: this is the accounts table, not the admins table, so
-- end-user signup later is a row with a different role rather than a second
-- table with a parallel login path.
create table if not exists users (
    id             bigserial   primary key,
    email          text        not null,
    password_hash  text        not null,   -- pbkdf2, see api/index.py
    role_id        smallint    not null references user_roles (id),
    is_active      boolean     not null default true,
    created_at     timestamptz not null default now(),
    last_login_at  timestamptz
);

-- Same case-insensitive rule the entrant tables use.
create unique index if not exists users_email_key on users (lower(email));
