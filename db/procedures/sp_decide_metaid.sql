-- Approves or rejects one MetaID request. Returns true when the decision was
-- recorded, false when it was not.
--
-- False covers every way this can legitimately fail: the request was already
-- decided, the id does not exist, or the person deciding is not allowed to.
-- Only `admin` and `newera_staff` may decide, and that rule lives here rather
-- than only in the API, because the API is not the only thing that will ever
-- hold this connection.
--
-- `and status = 'pending'` is what makes two admins clicking at once safe: the
-- second UPDATE matches nothing and answers false rather than overwriting the
-- first decision.

create or replace procedure sp_decide_metaid(
    p_request_id  bigint,
    p_decided_by  bigint,
    p_status      text,               -- 'approved' or 'rejected'
    p_note        text default null,
    inout p_ok    boolean default false
)
language plpgsql
as $$
begin
    update metaid_request r
       set status        = p_status,
           decided_by    = p_decided_by,
           decided_at    = now(),
           decision_note = nullif(btrim(coalesce(p_note, '')), '')
     where r.id = p_request_id
       and r.status = 'pending'
       and p_status in ('approved', 'rejected')
       and exists (
           select 1
             from users u
             join user_roles ro on ro.id = u.role_id
            where u.id = p_decided_by
              and u.is_active
              and ro.name in ('admin', 'newera_staff')
       )
    returning true into p_ok;

    p_ok := coalesce(p_ok, false);
end;
$$;
