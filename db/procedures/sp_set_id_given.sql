-- Sets is_id_given on one landing-form row. Returns true when the row moved,
-- false when it did not.
--
-- False covers every legitimate failure: the id does not exist in that table,
-- the value is already what was asked for, or the person asking is not allowed
-- to. Only `admin` and `newera_staff` may set it -- the same pair that decides
-- a MetaID request, and for the same reason: the rule lives here, not only in
-- the API, because the API is not the only thing that will ever hold this
-- connection.
--
-- `registration` and `real_account_request` are two tables with one column in
-- common and no key between them, so the caller says which one it means.
-- Anything else matches nothing rather than raising -- from here a bad source
-- and a missing row are the same answer.
--
-- db/backfill_is_id_given.sql only ever turns a non-YES into YES, so a row set
-- to NO or REJECTED here can be turned back to YES by the next export. That is
-- the intended order: the export is what the platform says, this is what an
-- admin says before the next one arrives, and an account that demonstrably
-- exists outranks a refusal recorded before it did.

create or replace procedure sp_set_id_given(
    p_source     text,               -- 'demo' (registration) or 'real'
    p_row_id     bigint,
    p_set_by     bigint,
    p_value      text,               -- 'YES', 'NO' or 'REJECTED'
    inout p_ok   boolean default false
)
language plpgsql
as $$
declare
    v_allowed boolean;
begin
    if p_value not in ('YES', 'NO', 'REJECTED') then
        p_ok := false;
        return;
    end if;

    select exists (
        select 1
          from users u
          join user_roles ro on ro.id = u.role_id
         where u.id = p_set_by
           and u.is_active
           and ro.name in ('admin', 'newera_staff')
    ) into v_allowed;

    if not v_allowed then
        p_ok := false;
        return;
    end if;

    if p_source = 'demo' then
        update registration
           set is_id_given = p_value
         where id = p_row_id
           and is_id_given <> p_value
        returning true into p_ok;
    elsif p_source = 'real' then
        update real_account_request
           set is_id_given = p_value
         where id = p_row_id
           and is_id_given <> p_value
        returning true into p_ok;
    end if;

    p_ok := coalesce(p_ok, false);
end;
$$;
