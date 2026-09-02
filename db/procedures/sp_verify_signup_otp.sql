-- Answers a signup OTP. Returns the user id on a match, null on anything else.
--
-- Match and consume happen in one UPDATE, so a code cannot be spent twice by
-- two requests arriving together. The caller hashes the code the same way
-- sp_issue_auth_token was given it; the plaintext never reaches here.
--
-- A miss costs an attempt. Six digits is a million guesses, which is nothing
-- to a script, so the token dies after five and a fresh one has to be sent.

create or replace procedure sp_verify_signup_otp(
    p_email          text,
    p_code_hash      text,
    inout p_user_id  bigint default null
)
language plpgsql
as $$
declare
    max_attempts constant smallint := 5;
begin
    update auth_token t
       set consumed_at = now()
      from users u
     where u.id = t.user_id
       and lower(u.email) = lower(btrim(p_email))
       and t.purpose = 'signup_otp'
       and t.consumed_at is null
       and t.expires_at > now()
       and t.attempts < max_attempts
       and t.token_hash = p_code_hash
    returning t.user_id into p_user_id;

    if p_user_id is null then
        update auth_token t
           set attempts = t.attempts + 1
          from users u
         where u.id = t.user_id
           and lower(u.email) = lower(btrim(p_email))
           and t.purpose = 'signup_otp'
           and t.consumed_at is null;
        return;
    end if;

    update users set email_verified_at = now() where id = p_user_id;
end;
$$;
