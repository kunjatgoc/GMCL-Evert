-- Enters one person into the league and returns the row id.
--
-- The caller supplies only the MetaID. The address is not asked for: it is
-- the one the MetaID was approved against, which the database already knows,
-- and asking would let the two disagree. An account with no approved request
-- falls back to its own address rather than failing, because who may enter is
-- not this procedure's rule to make.
--
-- KNOWN WRONG from the second entry onward. The select below takes whichever
-- approved request was decided last, which was the only one when a person
-- could hold a single entry. Since multiple entries landed it can stamp a row
-- with an address that account was never approved under -- a demo number
-- entered after a real approval gets the real request's address.
--
-- Left as it is on purpose: fixing it means the join saying which approved
-- request it is entering under, and nothing here maps a MetaID back to the
-- request that produced it. Written up as item 10 in
-- docs/database-open-items.md, with the backfill the fix will need.
--
-- Raises 23505 (unique_violation) when the person has already joined.

create or replace procedure sp_join_league(
    p_user_id   bigint,
    p_metaid    text,
    inout p_id  bigint default null
)
language plpgsql
as $$
begin
    insert into league_entry (user_id, metaid, email)
    values (
        p_user_id,
        btrim(p_metaid),
        coalesce(
            (select m.email
               from metaid_request m
              where m.user_id = p_user_id and m.status = 'approved'
              order by m.decided_at desc nulls last
              limit 1),
            (select u.email from users u where u.id = p_user_id)
        )
    )
    returning id into p_id;
end;
$$;
