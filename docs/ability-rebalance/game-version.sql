-- Review proposal. Apply through Lovable in a new migration; no reset or data deletion.
CREATE OR REPLACE FUNCTION public.game_version_table()
 RETURNS TABLE(version text, engine_version text, status text, catalog_hash text)
 LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO ''
AS $fn$
  SELECT v.version::text, v.engine_version::text, v.status::text, v.catalog_hash::text
  FROM (VALUES
    ('three-packs-economy-wayfarers-1.0.0', 'battle-engine-1.0.0', 'active', 'f3270366c335df97629e7f17086195fb3e4604275014036e5e39db70ccc2feca'),
    ('three-packs-1.0.0', 'battle-engine-1.0.0', 'retired', NULL),
    ('alpha-beta-1.0.0', 'battle-engine-1.0.0', 'retired', NULL)
  ) AS v(version, engine_version, status, catalog_hash)
$fn$;
