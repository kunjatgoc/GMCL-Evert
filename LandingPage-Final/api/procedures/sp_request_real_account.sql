-- Records one request for a real-balance MetaID and returns its id.
--
-- Mirrors sp_register: trimming and case-folding live here so every caller
-- stores the same shape, and the duplicate rule is the unique index on
-- lower(email) rather than a SELECT-then-INSERT that two racing submissions
-- could both pass.
--
-- Raises 23505 (unique_violation) when the email has already asked.

create or replace procedure sp_request_real_account(
    p_email    text,
    inout p_id bigint default null
)
language plpgsql
as $$
begin
    insert into real_account_request (email)
    values (lower(btrim(p_email)))
    returning id into p_id;
end;
$$;
