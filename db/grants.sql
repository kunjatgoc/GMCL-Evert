-- Least-privilege role for the API.
--
-- The credential in DATABASE_URL is a perimeter of its own: give it permission
-- to call sp_register and nothing else. It cannot read, update or delete a
-- row, so a leaked password cannot dump the entrant list.
--
-- It is no longer the *whole* perimeter. On Vercel there was no fixed egress
-- IP, so Postgres had to accept connections from anywhere and pg_hba.conf
-- could not narrow it down. The API now runs from one VPS with one address,
-- so pg_hba.conf can name it and the grants below stop being the only thing
-- standing between a leaked password and the data:
--
--     hostssl  all  gmcl_api  <vps address>/32  scram-sha-256
--
-- Worth doing. This file cannot do it -- pg_hba.conf is not SQL and lives on
-- the database host -- so it is written down here rather than assumed.
--
-- Run as the owner of the registration table, after schema.sql and the
-- procedures. Every statement is idempotent.
--
--     psql "$ADMIN_DATABASE_URL" -f db/grants.sql
--     psql "$ADMIN_DATABASE_URL" -c "alter role gmcl_api password '…'"

do $$
begin
    if not exists (select from pg_roles where rolname = 'gmcl_api') then
        create role gmcl_api login;
    end if;
end;
$$;

-- sp_register runs as its owner, so the caller needs no rights on the table
-- it writes. search_path is pinned because a security definer routine that
-- resolves names through the caller's search_path can be hijacked.
alter procedure sp_register(text, text, text, text, bigint)
    security definer
    set search_path = public, pg_temp;

-- Postgres grants EXECUTE on a new routine to PUBLIC by default. Revoke that
-- first, or the grant below buys nothing.
revoke all on procedure sp_register(text, text, text, text, bigint)
    from public;
grant execute on procedure sp_register(text, text, text, text, bigint)
    to gmcl_api;

grant usage on schema public to gmcl_api;
revoke all on table registration from gmcl_api;

-- Same treatment for the real-money request procedure: the API role may call
-- it and nothing else, so a leaked password cannot read the list back.
alter procedure sp_request_real_account(text, bigint)
    security definer
    set search_path = public, pg_temp;

revoke all on procedure sp_request_real_account(text, bigint)
    from public;
grant execute on procedure sp_request_real_account(text, bigint)
    to gmcl_api;

revoke all on table real_account_request from gmcl_api;

-- The accounts procedures get the same treatment: gmcl_api may call them and
-- writes go through them, so a leaked password cannot insert a row anywhere or
-- rewrite one it was not meant to.
--
-- Reads used to be the gap, and this file used to say the distinction was
-- theoretical because DATABASE_URL held the owning role. It stopped being
-- theoretical the day the server started connecting as gmcl_api: every
-- authenticated screen selects from these tables directly, got `permission
-- denied for table registration`, and the whole signed-in half of the site was
-- unusable. The grants are below.

alter procedure sp_signup(text, text, text, text, bigint)
    security definer set search_path = public, pg_temp;
revoke all on procedure sp_signup(text, text, text, text, bigint) from public;
grant execute on procedure sp_signup(text, text, text, text, bigint) to gmcl_api;

alter procedure sp_issue_auth_token(bigint, text, text, integer, integer, bigint)
    security definer set search_path = public, pg_temp;
revoke all on procedure
    sp_issue_auth_token(bigint, text, text, integer, integer, bigint) from public;
grant execute on procedure
    sp_issue_auth_token(bigint, text, text, integer, integer, bigint) to gmcl_api;

alter procedure sp_verify_otp(bigint, text, text, boolean)
    security definer set search_path = public, pg_temp;
revoke all on procedure sp_verify_otp(bigint, text, text, boolean) from public;
grant execute on procedure sp_verify_otp(bigint, text, text, boolean) to gmcl_api;

alter procedure sp_reset_password(bigint, text, text, boolean)
    security definer set search_path = public, pg_temp;
revoke all on procedure sp_reset_password(bigint, text, text, boolean) from public;
grant execute on procedure sp_reset_password(bigint, text, text, boolean) to gmcl_api;

alter procedure sp_request_metaid(bigint, text, text, bigint)
    security definer set search_path = public, pg_temp;
revoke all on procedure sp_request_metaid(bigint, text, text, bigint) from public;
grant execute on procedure sp_request_metaid(bigint, text, text, bigint) to gmcl_api;

alter procedure sp_decide_metaid(bigint, bigint, text, text, boolean)
    security definer set search_path = public, pg_temp;
revoke all on procedure sp_decide_metaid(bigint, bigint, text, text, boolean)
    from public;
grant execute on procedure sp_decide_metaid(bigint, bigint, text, text, boolean)
    to gmcl_api;

alter procedure sp_undo_metaid(bigint, bigint, boolean)
    security definer set search_path = public, pg_temp;
revoke all on procedure sp_undo_metaid(bigint, bigint, boolean) from public;
grant execute on procedure sp_undo_metaid(bigint, bigint, boolean) to gmcl_api;

alter procedure sp_set_id_given(text, bigint, bigint, text, boolean)
    security definer set search_path = public, pg_temp;
revoke all on procedure sp_set_id_given(text, bigint, bigint, text, boolean)
    from public;
grant execute on procedure sp_set_id_given(text, bigint, bigint, text, boolean)
    to gmcl_api;

alter procedure sp_join_league(bigint, text, bigint)
    security definer set search_path = public, pg_temp;
revoke all on procedure sp_join_league(bigint, text, bigint) from public;
grant execute on procedure sp_join_league(bigint, text, bigint) to gmcl_api;

alter procedure sp_edit_league_metaid(bigint, bigint, text, bigint)
    security definer set search_path = public, pg_temp;
revoke all on procedure sp_edit_league_metaid(bigint, bigint, text, bigint) from public;
grant execute on procedure sp_edit_league_metaid(bigint, bigint, text, bigint) to gmcl_api;

revoke all on table users, user_roles, auth_token, metaid_request, league_entry
    from gmcl_api;

-- What the API reads for itself, having revoked everything above.
--
-- SELECT and no more. Every insert and every delete in this system goes
-- through a procedure, so the role needs no INSERT anywhere and no rights on
-- any sequence -- a leaked password can read the entrant list, which is bad,
-- but cannot add to it, forge a league entry or approve a MetaID request.
--
-- auth_token is deliberately absent. Live OTP hashes and reset tokens are read
-- only by sp_verify_otp and sp_reset_password, which run as the owner, so
-- nothing the API connects with can read a token out of the table.
grant select on table
    users, user_roles, registration, real_account_request,
    metaid_request, league_entry
    to gmcl_api;

-- The only table the API writes without a procedure, and only these four
-- columns: verification on first sign-in, the login timestamp, the name from
-- the profile screen, and the new password. Column-level rather than table
-- level, so this cannot become the way somebody flips a role_id or clears
-- is_active.
grant update (email_verified_at, last_login_at, full_name, password_hash)
    on table users to gmcl_api;

-- sp_join_league and sp_edit_league_metaid were declared security definer in
-- this file and were not, on the database. The alters above ran when the file
-- was shorter than it is now, and nothing re-ran it afterwards -- so both were
-- executing as gmcl_api against tables gmcl_api could not touch, and the
-- league was unenterable in a way that only shows up under the least-privilege
-- role. Asserted here rather than trusted, because the same silence would hide
-- it again.
do $$
declare
    v_missing text;
begin
    select string_agg(p.proname, ', ')
      into v_missing
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname like 'sp\_%'
       and not p.prosecdef;

    if v_missing is not null then
        raise exception
            'these procedures are not security definer: %. Re-run the alters above.',
            v_missing;
    end if;
end;
$$;
