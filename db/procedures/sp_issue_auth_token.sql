-- Issues a login OTP, a signup OTP or a password-reset token, and returns its
-- id -- or null when one was issued too recently to allow another.
--
-- p_token_hash is the keyed hash of the secret, computed by the API. The
-- secret itself never reaches the database, so a copy of this table is not a
-- list of live codes.
--
-- p_min_seconds is the resend guard. It is a parameter rather than a constant
-- because the test suite has to issue several tokens in a row, and a rate
-- limit that cannot be turned off is a rate limit that cannot be tested. The
-- API passes a real value; nothing else should pass zero.
--
-- Raises 23514 (check_violation) for a purpose the table does not allow.

create or replace procedure sp_issue_auth_token(
    p_user_id      bigint,
    p_purpose      text,
    p_token_hash   text,
    p_ttl_minutes  int,
    p_min_seconds  int,
    inout p_id     bigint default null
)
language plpgsql
as $$
begin
    -- Mail costs money and attention, and a held-down "resend" spends both on
    -- someone who did not ask. Answering null rather than raising keeps this a
    -- normal outcome the caller reports as "one was just sent", not an error.
    if exists (
        select 1 from auth_token
         where user_id = p_user_id
           and purpose = p_purpose
           and created_at > now() - make_interval(secs => p_min_seconds)
    ) then
        p_id := null;
        return;
    end if;

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
