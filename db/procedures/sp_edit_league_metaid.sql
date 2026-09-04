-- Changes the account number on one entry the caller already owns.
--
-- The row is found by id *and* user_id, never by id alone: the id travels
-- through the browser, and scoping the update to the owner is what stops one
-- person renaming another's entry. A row that does not match both leaves
-- p_id null, which the API answers 404 to.
--
-- Only the MetaID moves. The address on the row is the one the MetaID was
-- approved against when the entry was made, and rewriting it here would let a
-- later approval quietly restate history.
--
-- Raises 23505 (unique_violation) when the caller already has that number on
-- another entry.

create or replace procedure sp_edit_league_metaid(
    p_user_id   bigint,
    p_entry_id  bigint,
    p_metaid    text,
    inout p_id  bigint default null
)
language plpgsql
as $$
begin
    update league_entry
       set metaid = btrim(p_metaid)
     where id = p_entry_id and user_id = p_user_id
    returning id into p_id;
end;
$$;
