-- Answers an OTP. Returns true on a match, false on anything else.
--
-- Match and consume happen in one UPDATE, so a code cannot be spent twice by
-- two requests arriving together. The caller hashes the code the same way
-- sp_issue_auth_token was given it; the plaintext never reaches here.
--
-- A miss costs an attempt. Six digits is a million guesses, which is nothing
-- to a script, so the token dies after five and a fresh one has to be sent.
--
-- Answering a code sent to the address proves the address works, so any OTP
-- settles verification for an account that never had it. A reset token does
-- not come through here -- sp_reset_password does that job and marks it too.

create or replace procedure sp_verify_otp(
    p_user_id    bigint,
    p_purpose    text,
    p_code_hash  text,
    inout p_ok   boolean default false
)
language plpgsql
as $$
declare
    max_attempts constant smallint := 5;
begin
    update auth_token
       set consumed_at = now()
     where user_id = p_user_id
       and purpose = p_purpose
       and consumed_at is null
       and expires_at > now()
       and attempts < max_attempts
       and token_hash = p_code_hash
    returning true into p_ok;

    if not coalesce(p_ok, false) then
        update auth_token
           set attempts = attempts + 1
         where user_id = p_user_id
           and purpose = p_purpose
           and consumed_at is null;
        p_ok := false;
        return;
    end if;

    update users
       set email_verified_at = coalesce(email_verified_at, now())
     where id = p_user_id;
end;
$$;
