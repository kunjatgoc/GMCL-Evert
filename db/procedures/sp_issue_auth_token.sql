-- Issues a signup OTP or a password-reset token and returns its id.
--
-- p_token_hash is the keyed hash of the secret, computed by the API. The
-- secret itself never reaches the database, so a copy of this table is not a
-- list of live codes.
--
-- Raises 23514 (check_violation) for a purpose outside the two the table
-- allows.

create or replace procedure sp_issue_auth_token(
    p_user_id      bigint,
    p_purpose      text,
    p_token_hash   text,
    p_ttl_minutes  int,
    inout p_id     bigint default null
)
language plpgsql
as $$
begin
    -- One live token per person per purpose. Re-sending retires the previous
    -- one in the same transaction, so a code read out of an older email
    -- cannot still be used and "resend" cannot widen the guessing target.
    update auth_token
       set consumed_at = now()
     where user_id = p_user_id
       and purpose = p_purpose
       and consumed_at is null;

    insert into auth_token (user_id, purpose, token_hash, expires_at)
    values (
        p_user_id,
        p_purpose,
        p_token_hash,
        now() + make_interval(mins => p_ttl_minutes)
    )
    returning id into p_id;
end;
$$;

-- ponytail: no cap on how often a token may be issued, so "resend" can be held
-- down to mail someone repeatedly. Add
--     and not exists (select 1 from auth_token
--                      where user_id = p_user_id and purpose = p_purpose
--                        and created_at > now() - interval '1 minute')
-- as a guard here, or a per-IP limit at the edge, when that is worth paying
-- for.
