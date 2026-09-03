-- Read-only reporting queries. Nothing here is called by the API -- these are
-- for running by hand against the database, or pasting into whatever tool is
-- pulling a CSV out of it.
--
--     psql "$DATABASE_URL" --csv -f db/reports.sql > report.csv


-- Real-account interest, and whether the person also entered the league.
--
-- Driven by `real_account_request`, so every row is somebody who asked for a
-- real balance. LEFT JOIN rather than INNER: an inner join would silently drop
-- the people who asked and never registered, and those are the interesting
-- ones -- they are the follow-ups nobody has a name or a number for.
--
-- `status` names which half of the join a row came from, so the two groups can
-- be filtered apart in a spreadsheet without reading the null columns.
--
-- The join is on lower(email) because that is the shape of the unique index on
-- both tables -- registration_email_key and real_account_request_email_key --
-- so it is both the correct comparison and an index lookup rather than a scan.
-- Matching on the raw column would miss Alex@x.com against alex@x.com, which
-- the schema already treats as one person.
--
-- Ordered matched-first, each group newest-first: 'matched' sorts before
-- 'unmatched', and `g.id is null` is false before true, which is the same
-- grouping without depending on the words.
select
    case when g.id is null then 'unmatched' else 'matched' end as status,
    r.email,
    g.full_name,
    g.mobile,
    g.country,
    to_char(r.created_at, 'YYYY-MM-DD HH24:MI') as real_requested_at,
    to_char(g.created_at, 'YYYY-MM-DD HH24:MI') as demo_registered_at,
    r.id as real_request_id,
    g.id as registration_id
from real_account_request r
left join registration g on lower(g.email) = lower(r.email)
order by (g.id is null), r.created_at desc, r.id desc;
