-- Enters one person into the league and returns the row id.
--
-- The caller supplies only the MetaID. The address is not asked for: it is
-- the one the MetaID was approved against, which the database already knows,
-- and asking would let the two disagree. An account with no approved request
-- falls back to its own address rather than failing, because who may enter is
-- not this procedure's rule to make.
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
