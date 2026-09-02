-- Behavioural check for db/app_schema.sql and the procedures beside it.
--
-- Everything runs inside a transaction that rolls back, so it is safe against
-- the live database: no row survives, only the sequences move.
--
--     psql "$DATABASE_URL" -f db/tests.sql
--
-- It asserts the rules that are not obvious from the DDL -- the attempt cap,
-- the one-open-request index, who may decide a request, what happens when two
-- decisions race -- and says `ok` at the end or fails on the first bad line.

begin;

do $$
declare
    v_user     bigint;
    v_other    bigint;
    v_token    bigint;
    v_request  bigint;
    v_scratch  bigint;   -- an INOUT argument has to be writable, so misses need one too
    v_gml      bigint;
    v_newera   bigint;
    v_ok       boolean;
    v_role     text;
    v_verified timestamptz;
    v_attempts smallint;
    v_hash     text := 'hash-of-123456';
begin
    -- signup ------------------------------------------------------------
    call sp_signup('  Ada Lovelace ', ' ADA@Example.com ', '+919000000001',
                   'pbkdf2$1$aa$bb', v_user);

    select r.name, u.email_verified_at into v_role, v_verified
      from users u join user_roles r on r.id = u.role_id where u.id = v_user;
    assert v_role = 'end_user', 'signup did not create an end user';
    assert v_verified is null, 'signup started out verified';
    assert (select email from users where id = v_user) = 'ada@example.com',
           'email was not folded to lower case';
    assert (select full_name from users where id = v_user) = 'Ada Lovelace',
           'name was not trimmed';

    begin
        call sp_signup('Ada Again', 'ADA@example.COM', '+919000000002',
                       'x', v_scratch);
        assert false, 'a duplicate email was accepted';
    exception when unique_violation then null;
    end;

    begin
        call sp_signup('Someone Else', 'else@example.com', '+919000000001',
                       'x', v_scratch);
        assert false, 'a duplicate phone was accepted';
    exception when unique_violation then null;
    end;

    begin
        call sp_signup('   ', 'blank@example.com', '+919000000009',
                       'x', v_scratch);
        assert false, 'a blank name was accepted';
    exception when check_violation then null;
    end;

    -- signup OTP --------------------------------------------------------
    call sp_issue_auth_token(v_user, 'signup_otp', 'stale-hash', 10, v_token);
    call sp_issue_auth_token(v_user, 'signup_otp', v_hash, 10, v_token);
    assert (select count(*) from auth_token
             where user_id = v_user and consumed_at is null) = 1,
           'issuing a second OTP left the first one live';

    call sp_verify_signup_otp('ada@example.com', 'wrong', v_other);
    assert v_other is null, 'a wrong code verified';
    select attempts into v_attempts from auth_token where id = v_token;
    assert v_attempts = 1, 'a wrong code did not cost an attempt';
    assert (select email_verified_at from users where id = v_user) is null,
           'a wrong code verified the address';

    call sp_verify_signup_otp('  ADA@example.com  ', v_hash, v_other);
    assert v_other = v_user, 'the right code did not verify';
    assert (select email_verified_at from users where id = v_user) is not null,
           'verifying did not mark the address';

    call sp_verify_signup_otp('ada@example.com', v_hash, v_other);
    assert v_other is null, 'a spent code verified a second time';

    -- attempt cap -------------------------------------------------------
    call sp_issue_auth_token(v_user, 'signup_otp', v_hash, 10, v_token);
    for i in 1..5 loop
        call sp_verify_signup_otp('ada@example.com', 'wrong', v_other);
    end loop;
    call sp_verify_signup_otp('ada@example.com', v_hash, v_other);
    assert v_other is null, 'the token survived five wrong guesses';

    -- expiry ------------------------------------------------------------
    call sp_issue_auth_token(v_user, 'signup_otp', v_hash, -1, v_token);
    call sp_verify_signup_otp('ada@example.com', v_hash, v_other);
    assert v_other is null, 'an expired code verified';

    -- password reset ----------------------------------------------------
    call sp_issue_auth_token(v_user, 'password_reset', 'reset-hash', 30, v_token);
    call sp_reset_password(v_user, 'wrong', 'new-hash', v_ok);
    assert not v_ok, 'a wrong reset token was accepted';
    assert (select password_hash from users where id = v_user) = 'pbkdf2$1$aa$bb',
           'a wrong reset token changed the password';

    call sp_reset_password(v_user, 'reset-hash', 'new-hash', v_ok);
    assert v_ok, 'the right reset token was refused';
    assert (select password_hash from users where id = v_user) = 'new-hash',
           'the password was not changed';

    call sp_reset_password(v_user, 'reset-hash', 'newer-hash', v_ok);
    assert not v_ok, 'a spent reset token was accepted again';

    -- MetaID requests ---------------------------------------------------
    call sp_request_metaid(v_user, ' Demo ', ' Ada@Example.com ', v_request);
    assert (select status from metaid_request where id = v_request) = 'pending',
           'a new request did not open as pending';
    assert (select email from metaid_request where id = v_request)
           = 'ada@example.com', 'the request email was not folded';

    begin
        call sp_request_metaid(v_user, 'demo', 'ada@example.com', v_scratch);
        assert false, 'a second open demo request was accepted';
    exception when unique_violation then null;
    end;

    call sp_request_metaid(v_user, 'real', 'ada@example.com', v_other);
    assert v_other is not null, 'a real request was blocked by the demo one';

    begin
        call sp_request_metaid(v_user, 'live', 'ada@example.com', v_scratch);
        assert false, 'an unknown MetaID type was accepted';
    exception when check_violation then null;
    end;

    -- who may decide ----------------------------------------------------
    insert into users (full_name, email, password_hash, role_id)
    values ('G Staff', 'gml@example.com', 'x',
            (select id from user_roles where name = 'gml_staff'))
    returning id into v_gml;

    insert into users (full_name, email, password_hash, role_id)
    values ('N Staff', 'newera@example.com', 'x',
            (select id from user_roles where name = 'newera_staff'))
    returning id into v_newera;

    begin
        call sp_request_metaid(v_gml, 'demo', '   ', v_scratch);
        assert false, 'a blank MetaID email was accepted';
    exception when check_violation then null;
    end;

    call sp_decide_metaid(v_request, v_user, 'approved', null, v_ok);
    assert not v_ok, 'an end user decided their own request';

    call sp_decide_metaid(v_request, v_gml, 'approved', null, v_ok);
    assert not v_ok, 'GML staff decided a MetaID request';

    call sp_decide_metaid(v_request, v_newera, 'approved', '  ', v_ok);
    assert v_ok, 'Newera staff could not decide a request';
    assert (select status from metaid_request where id = v_request) = 'approved';
    assert (select decided_by from metaid_request where id = v_request) = v_newera;
    assert (select decided_at from metaid_request where id = v_request) is not null;
    assert (select decision_note from metaid_request where id = v_request) is null,
           'a blank note was stored as blank rather than nothing';

    call sp_decide_metaid(v_request, v_newera, 'rejected', 'changed my mind', v_ok);
    assert not v_ok, 'a decided request was decided again';

    -- an approved request leaves the way clear to ask again
    call sp_request_metaid(v_user, 'demo', 'ada@example.com', v_other);
    assert v_other is not null, 'a settled request still blocked a new one';

    begin
        update metaid_request set status = 'approved' where id = v_other;
        assert false, 'a request was approved with nobody named against it';
    exception when check_violation then null;
    end;

    raise notice 'ok';
end;
$$;

rollback;
