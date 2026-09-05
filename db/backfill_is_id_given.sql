-- Backfill registration.is_id_given and real_account_request.is_id_given from
-- the platform's account-created exports.
--
-- The exports are the MT5 "Welcome ... Created" reports: one row per trading
-- account, keyed on the address the account was opened with. A demo account
-- answers for `registration`, a real account for `real_account_request`.
--
--     sed -e "s|__DEMO_CSV__|/path/to/Welcome_Demo_Created.csv|" \
--         -e "s|__REAL_CSV__|/path/to/Welcome_Real_Created.csv|" \
--         db/backfill_is_id_given.sql \
--       | psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f -
--
-- The paths are substituted rather than passed as psql variables because
-- \copy takes the rest of its line verbatim -- it is the one meta-command that
-- performs no variable interpolation, so `:'demo_csv'` arrives as a filename.
--
-- Run db/schema.sql first; this file assumes the column exists. Re-running is
-- safe against a newer export -- the update only ever turns NO into YES, so a
-- later report that has grown by a few accounts adds those and leaves the rest
-- alone. It will not revoke a YES, which is deliberate: an account that exists
-- does not stop existing because it fell out of a report.

\set ON_ERROR_STOP on

begin;

-- The export's own column order. Everything but `email` is read and thrown
-- away -- naming the columns is still cheaper than teaching \copy to skip them.
create temp table csv_demo (
    sr           text,
    login        text,
    name         text,
    email        text,
    mobile       text,
    country      text,
    server_group text,
    leverage     text,
    currency     text,
    registered   text,
    logged_in    text,
    other_logins text
) on commit drop;

create temp table csv_real (like csv_demo) on commit drop;

\copy csv_demo from '__DEMO_CSV__' with (format csv, header true)
\copy csv_real from '__REAL_CSV__' with (format csv, header true)

-- Addresses are compared the way the unique indexes on both tables already
-- compare them -- lowercased -- plus one typo rule.
--
-- One entrant typed `@gmail.con` on one form and `@gmail.com` on the other, so
-- their two rows disagree with each other and with the exports. `.con` is not
-- a TLD, and folding it to `.com` matches exactly the one person: there is a
-- single `.con` address in the database and a single one in each export, all
-- the same entrant, same name and same phone number.
create temp view demo_email as
    select distinct replace(lower(trim(email)), '@gmail.con', '@gmail.com') as email
      from csv_demo
     where email is not null and trim(email) <> '';

create temp view real_email as
    select distinct replace(lower(trim(email)), '@gmail.con', '@gmail.com') as email
      from csv_real
     where email is not null and trim(email) <> '';

update registration r
   set is_id_given = 'YES'
 where r.is_id_given <> 'YES'
   and exists (
       select 1 from demo_email c
        where c.email = replace(lower(trim(r.email)), '@gmail.con', '@gmail.com')
   );

update real_account_request t
   set is_id_given = 'YES'
 where t.is_id_given <> 'YES'
   and exists (
       select 1 from real_email c
        where c.email = replace(lower(trim(t.email)), '@gmail.con', '@gmail.com')
   );

-- What the export claims but the database has no row for. Not an error: some
-- people were given accounts through a channel that never touched this site,
-- so there is nothing here to mark. Printed so the gap is visible rather than
-- silently absorbed.
select 'demo export, no registration row' as note, c.email
  from demo_email c
 where not exists (
       select 1 from registration r
        where replace(lower(trim(r.email)), '@gmail.con', '@gmail.com') = c.email
   )
union all
select 'real export, no real_account_request row', c.email
  from real_email c
 where not exists (
       select 1 from real_account_request t
        where replace(lower(trim(t.email)), '@gmail.con', '@gmail.com') = c.email
   )
 order by 1, 2;

select 'registration' as tbl, is_id_given, count(*)
  from registration group by 2
union all
select 'real_account_request', is_id_given, count(*)
  from real_account_request group by 2
 order by 1, 2;

commit;
