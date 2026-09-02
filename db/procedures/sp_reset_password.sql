-- Spends a password-reset token and sets the new password. Returns true on a
-- match, false on a token that is wrong, expired, already used or worn out.
--
-- Consume and update are one transaction, so a reset link cannot set two
-- different passwords if it is opened twice. The caller supplies the user id
-- alongside the token because the reset link carries both.

create or replace procedure sp_reset_password(
    p_user_id        bigint,
    p_token_hash     text,
    p_password_hash  text,
    inout p_ok       boolean default false
)
language plpgsql
as $$
declare
    max_attempts constant smallint := 5;
begin
    update auth_token
       set consumed_at = now()
     where user_id = p_user_id
       and purpose = 'password_reset'
       and consumed_at is null
       and expires_at > now()
       and attempts < max_attempts
       and token_hash = p_token_hash
    returning true into p_ok;

    if not coalesce(p_ok, false) then
        update auth_token
           set attempts = attempts + 1
         where user_id = p_user_id
           and purpose = 'password_reset'
           and consumed_at is null;
        p_ok := false;
        return;
    end if;

    -- Answering a mail sent to the address proves the address works, so a
    -- reset also settles verification for anyone who never finished the
    -- signup OTP. Otherwise they would recover the account and still be
    -- locked out of it.
    update users
       set password_hash     = p_password_hash,
           email_verified_at = coalesce(email_verified_at, now())
     where id = p_user_id;
end;
$$;

-- ponytail: sessions are stateless signed cookies with an eight-hour life, so
-- a reset cannot sign the old session out -- a stolen cookie stays good until
-- it expires. Add a `session_epoch` column to `users`, bump it here, and put
-- it in the cookie payload if that window ever matters.
