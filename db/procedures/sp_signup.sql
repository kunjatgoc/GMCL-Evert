-- Creates an end-user account and returns its id.
--
-- Mirrors sp_register: trimming and case-folding live here so every caller
-- stores the same shape, and the duplicate rules are the unique indexes on
-- lower(email) and phone rather than a SELECT-then-INSERT that two racing
-- submissions could both pass.
--
-- The account starts unverified -- email_verified_at is null until the signup
-- OTP is answered -- and always as an end user. Staff and admin accounts are
-- made by scripts/seed_admin.py, not by signing up.
--
-- Raises 23505 (unique_violation) for a taken email or phone; the constraint
-- name in the error says which, so the caller need not guess.

create or replace procedure sp_signup(
    p_full_name      text,
    p_email          text,
    p_phone          text,
    p_password_hash  text,
    inout p_user_id  bigint default null
)
language plpgsql
as $$
begin
    insert into users (full_name, email, phone, password_hash, role_id)
    values (
        btrim(p_full_name),
        lower(btrim(p_email)),
        btrim(p_phone),
        p_password_hash,
        (select id from user_roles where name = 'end_user')
    )
    returning id into p_user_id;
end;
$$;
