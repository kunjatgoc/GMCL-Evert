-- Accounts, authentication and MetaID requests.
--
-- Additive only: nothing here touches `registration` or `real_account_request`,
-- which the live site writes to and which keep the shape they already have.
-- Every statement is idempotent, so re-running is safe.
--
--     psql "$DATABASE_URL" -f db/app_schema.sql
--     for f in db/procedures/*.sql; do psql "$DATABASE_URL" -f "$f"; done
--     .venv/bin/python scripts/seed_admin.py kunj.goc@gmail.com

-- Roles are rows, not an enum: adding a fifth later is an INSERT rather than
-- an ALTER TYPE that has to run outside a transaction.
create table if not exists user_roles (
    id    smallserial primary key,
    name  text        not null unique
);

insert into user_roles (name) values
    ('admin'), ('end_user'), ('gml_staff'), ('newera_staff')
    on conflict (name) do nothing;

-- One accounts table for everyone who signs in. Admin, staff and end users
-- differ by role_id rather than by table, so there is a single login path and
-- a single place a password can live. Which dashboard and menu a role sees is
-- the frontend's business; the database only says which role it is.
create table if not exists users (
    id             bigserial   primary key,
    email          text        not null,
    password_hash  text        not null,   -- pbkdf2, see api/index.py
    role_id        smallint    not null references user_roles (id),
    is_active      boolean     not null default true,
    created_at     timestamptz not null default now(),
    last_login_at  timestamptz
);

-- Added after the fact, because `users` shipped as the admin table and that
-- row has neither a name nor a phone. Both stay nullable rather than being
-- backfilled with a placeholder that would afterwards have to be told apart
-- from a real value; sp_signup supplies them for everyone created from here on.
alter table users add column if not exists full_name         text;
alter table users add column if not exists phone             text;
alter table users add column if not exists email_verified_at timestamptz;

-- `staff` predates the four-role model and nothing was ever given it. Dropped
-- only while it is genuinely unused, so this stays safe to re-run.
delete from user_roles
 where name = 'staff'
   and not exists (select 1 from users u where u.role_id = user_roles.id);

-- Case-insensitive, the same rule the entrant tables use: Alex@x.com and
-- alex@x.com are one account.
create unique index if not exists users_email_key on users (lower(email));

-- Phone is stored E.164 by sp_signup, so plain equality is the whole rule.
-- Postgres lets a unique index hold many NULLs, which is what keeps the
-- pre-existing admin -- and any staff account made without a number -- legal.
--
-- Both index names reach the API: psycopg puts the violated constraint in
-- diag.constraint_name, so a duplicate email and a duplicate phone can be
-- told apart and worded differently without a prior SELECT.
create unique index if not exists users_phone_key on users (phone);

-- btrim() in sp_signup turns "   " into "", not into null, so a blank name or
-- number would sail past a NOT NULL. Guarded here rather than in the caller:
-- this is the last place before the disk, and the API is not the only thing
-- that will ever hold this connection.
do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'users_no_blank_text') then
        alter table users add constraint users_no_blank_text check (
                (full_name is null or btrim(full_name) <> '')
            and (phone     is null or btrim(phone)     <> '')
            and btrim(email) <> ''
        );
    end if;
end;
$$;

-- Signup OTPs and password-reset links are the same object: a secret mailed to
-- the address on the account, good once, for a short while. One table with a
-- purpose column, rather than two that would differ only in their name.
--
-- token_hash is a keyed hash computed by the API, never the secret itself. A
-- six-digit OTP sitting in the clear is readable by anyone who reaches this
-- table, and a reset token in the clear is a live link.
create table if not exists auth_token (
    id           bigserial   primary key,
    user_id      bigint      not null references users (id) on delete cascade,
    purpose      text        not null
                 check (purpose in ('signup_otp', 'password_reset')),
    token_hash   text        not null,
    expires_at   timestamptz not null,
    consumed_at  timestamptz,
    attempts     smallint    not null default 0,
    created_at   timestamptz not null default now()
);

-- A `login_otp` purpose existed briefly, for a code asked for at every
-- sign-in. The code is now asked for once, to confirm the address, which is
-- what `signup_otp` already meant -- so the value goes, and the tokens issued
-- under it with it. They are all spent or expired; a live one would only be a
-- code for a screen that no longer asks.
do $$
begin
    if exists (
        select 1 from pg_constraint
         where conname = 'auth_token_purpose_check'
           and pg_get_constraintdef(oid) like '%login_otp%'
    ) then
        delete from auth_token where purpose = 'login_otp';
        alter table auth_token drop constraint auth_token_purpose_check;
        alter table auth_token add constraint auth_token_purpose_check
            check (purpose in ('signup_otp', 'password_reset'));
    end if;
end;
$$;

-- Both replaced by procedures with different signatures. `create or replace`
-- cannot change a parameter list, so the old shapes have to go or the database
-- would keep answering on them.
drop procedure if exists sp_verify_signup_otp(text, text, bigint);
drop procedure if exists sp_issue_auth_token(bigint, text, text, integer, bigint);

-- Every lookup is "the live token for this person and this purpose", so the
-- index carries the same filter the queries do.
create index if not exists auth_token_open_key
    on auth_token (user_id, purpose) where consumed_at is null;

-- ponytail: nothing deletes spent or expired tokens. At a few rows per signup
-- that is years of nothing. Add
--     delete from auth_token where expires_at < now() - interval '30 days'
-- to a cron when the table starts appearing in the size list.

-- A user asks for a Demo or a Real MetaID; an admin or a Newera staffer
-- answers. The MetaID is never entered here -- the user supplies the address
-- it should be issued against, so a row is the request, not the credential.
--
-- Name and phone stay on `users` and are read through user_id rather than
-- copied in. A request is not a historical document, and a corrected phone
-- number should read corrected on the queue.
create table if not exists metaid_request (
    id             bigserial   primary key,
    user_id        bigint      not null references users (id),
    metaid_type    text        not null check (metaid_type in ('demo', 'real')),
    email          text        not null,      -- the address the MetaID is for
    status         text        not null default 'pending'
                   check (status in ('pending', 'approved', 'rejected')),
    decided_by     bigint      references users (id),
    decided_at     timestamptz,
    decision_note  text,
    created_at     timestamptz not null default now()
);

-- A decided request has a decider and a time; a pending one has neither. The
-- three columns move together in sp_decide_metaid, and this is what stops a
-- hand-written UPDATE from leaving a row that says "approved" with nobody
-- named against it.
do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'metaid_request_decision_complete') then
        alter table metaid_request add constraint metaid_request_decision_complete check (
                (status = 'pending') = (decided_at is null)
            and (status = 'pending') = (decided_by is null)
        );
    end if;

    if not exists (select 1 from pg_constraint where conname = 'metaid_request_no_blank_text') then
        alter table metaid_request add constraint metaid_request_no_blank_text check (
            btrim(email) <> ''
        );
    end if;
end;
$$;

-- One open request per person per type. A partial unique index rather than a
-- check in the API, so two taps on a slow button cannot both get through, and
-- a rejected request still leaves the way clear to ask again.
create unique index if not exists metaid_request_open_key
    on metaid_request (user_id, metaid_type) where status = 'pending';

-- The approval queue, filtered by status and read newest first.
create index if not exists metaid_request_queue_key
    on metaid_request (status, created_at desc);

-- "My requests" -- the end user's own list.
create index if not exists metaid_request_user_key
    on metaid_request (user_id, created_at desc);

-- The email on a Real request is to be checked against an external API that
-- does not exist yet. When it does, `validated_at` and `validation_result` are
-- an online ALTER on this table; adding them now would only be columns nobody
-- writes. Notifications are the same story -- nothing sends one today, so
-- there is no table for them yet.

-- One row per person who joins the league, holding the MetaID they entered.
--
-- The MetaID itself is issued outside this system; `metaid_request` is only
-- the ask and the answer. This is the first table that stores the value.
--
-- Text and not an integer: it is Newera's identifier, it is never counted or
-- summed, and a leading zero on a four-digit ID would be lost the moment it
-- became a number. The shape is enforced by a check instead.
--
-- `email` is copied in rather than read through user_id: it records which
-- address the MetaID was under at the moment of joining, and a later change
-- to the account must not rewrite an entry that has already been counted.
create table if not exists league_entry (
    id          bigserial   primary key,
    user_id     bigint      not null references users (id),
    metaid      text        not null,
    email       text        not null,
    created_at  timestamptz not null default now()
);

-- btrim in sp_join_league turns "   " into "", not into null, so a blank
-- would pass NOT NULL. Guarded here, the last place before the disk.
do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'league_entry_no_blank_text') then
        alter table league_entry add constraint league_entry_no_blank_text check (
            btrim(metaid) <> '' and btrim(email) <> ''
        );
    end if;
end;
$$;

-- Four to six digits, e.g. 43563. Newera's format, mirrored from
-- METAID_RE in api/index.py: the API rejects a bad one with a readable 422,
-- and this is what stops anything else putting a wrong one in.
do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'league_entry_metaid_digits') then
        alter table league_entry add constraint league_entry_metaid_digits
            check (metaid ~ '^[0-9]{4,6}$');
    end if;
end;
$$;

-- One entry per person. A unique index rather than a check in the API, so two
-- taps on a slow button cannot both get through.
create unique index if not exists league_entry_user_key
    on league_entry (user_id);
