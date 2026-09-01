-- Records one league entry and returns its id.
--
-- Trimming and case-folding happen here, not in the caller, so anything that
-- ever calls this stores the same shape. The duplicate rule is the unique
-- index on lower(email) in schema.sql: no SELECT-then-INSERT, so two
-- submissions racing each other cannot both get through.
--
-- Raises 23505 (unique_violation) when the email is already registered.

create or replace procedure sp_register(
    p_full_name    text,
    p_email        text,
    p_mobile       text,
    p_country      text,
    inout p_id     bigint default null
)
language plpgsql
as $$
begin
    insert into registration (full_name, email, mobile, country)
    values (
        btrim(p_full_name),
        lower(btrim(p_email)),
        btrim(p_mobile),
        upper(btrim(p_country))
    )
    returning id into p_id;
end;
$$;
