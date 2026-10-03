-- Apply after 001_initial_schema.sql. Admin starts with NO permissions.
insert into permissions(code,description) values
('users.view','View users'),('users.verify','Basic user verification'),
('content.moderate','Moderate content'),('support.manage','Handle support'),
('courses.review','Review learning products'),('reports.view','View basic reports')
on conflict(code) do nothing;
-- CEO bypass is enforced in the server permission middleware; admin grants must be explicit.
-- Example (only if authorized by CEO):
-- insert into role_permissions(role_id,permission_id)
-- select r.id,p.id from roles r,permissions p where r.code='admin' and p.code='reports.view'
-- on conflict do nothing;
