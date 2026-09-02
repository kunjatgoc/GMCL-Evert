-- Records one MetaID request and returns its id.
--
-- The user does not supply a MetaID -- only the address one should be issued
-- against. The request opens as `pending`; nothing here decides it.
--
-- Raises 23505 (unique_violation) when the same person already has an open
-- request of the same type, and 23514 (check_violation) for a type that is
-- neither demo nor real.
--
-- A Real request is meant to have its email checked against an external API
-- that does not exist yet. When it does, the check belongs in front of this
-- call, and the row stays `pending` either way.

create or replace procedure sp_request_metaid(
    p_user_id   bigint,
    p_type      text,
    p_email     text,
    inout p_id  bigint default null
)
language plpgsql
as $$
begin
    insert into metaid_request (user_id, metaid_type, email)
    values (p_user_id, lower(btrim(p_type)), lower(btrim(p_email)))
    returning id into p_id;
end;
$$;
