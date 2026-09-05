-- Puts a decided MetaID request back to pending. Returns true when the row
-- moved, false when it did not.
--
-- The panel shows one set of buttons for every row in its list, and a
-- landing-form row's approval is a column an admin can write back. This is the
-- same affordance for `metaid_request`, which is the only one of the three
-- tables where a decision was a row of its own rather than a value.
--
-- Undoing is safe because deciding sends nothing: `decide_metaid` in
-- api/index.py calls sp_decide_metaid and answers, and newera mails the MetaID
-- by hand afterwards. Nothing outside this table has to be unwound.
--
-- metaid_request_decision_complete says pending rows carry no decider and no
-- timestamp, so all three fields go back together or the CHECK refuses the
-- update. The note goes with them: it was the reason for a decision that no
-- longer stands.
--
-- False covers every legitimate failure: the row is already pending, it does
-- not exist, the person asking is not allowed to, or the same person has since
-- opened a new request of the same type -- metaid_request_open_key allows one
-- pending row per person per type, and the newer one keeps the place.

create or replace procedure sp_undo_metaid(
    p_request_id  bigint,
    p_undone_by   bigint,
    inout p_ok    boolean default false
)
language plpgsql
as $$
begin
    update metaid_request r
       set status        = 'pending',
           decided_by    = null,
           decided_at    = null,
           decision_note = null
     where r.id = p_request_id
       and r.status <> 'pending'
       and exists (
           select 1
             from users u
             join user_roles ro on ro.id = u.role_id
            where u.id = p_undone_by
              and u.is_active
              and ro.name in ('admin', 'newera_staff')
       )
    returning true into p_ok;

    p_ok := coalesce(p_ok, false);
exception
    when unique_violation then
        -- The person already has an open request of this type. Theirs is the
        -- live one; this decided row stays decided.
        p_ok := false;
end;
$$;
