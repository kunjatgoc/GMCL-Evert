-- Least-privilege role for the API.
--
-- The API runs on Vercel, which has no fixed egress IP, so Postgres has to
-- accept connections from anywhere and pg_hba.conf cannot narrow it down.
-- The credential in DATABASE_URL is therefore the whole perimeter: give it
-- permission to call sp_register and nothing else. It cannot read, update or
-- delete a row, so a leaked password cannot dump the entrant list.
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
