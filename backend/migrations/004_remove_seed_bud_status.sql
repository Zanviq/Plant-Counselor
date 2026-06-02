-- Buds now start at the visible bud stage. Promote historical seed rows and
-- keep direct database inserts consistent with application-created buds.
-- Applied 2026-06-02 via the exec_admin_query RPC (service role).
update buds
set status = 'bud'
where status = 'seed';

alter table buds
alter column status set default 'bud';
