-- Review proposal. Apply through Lovable in a new migration; no reset or data deletion.
CREATE OR REPLACE FUNCTION public.game_version_table()
 RETURNS TABLE(version text, engine_version text, status text, catalog_hash text)
 LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO ''
AS $fn$
  SELECT v.version::text, v.engine_version::text, v.status::text, v.catalog_hash::text
  FROM (VALUES
    ('three-packs-economy-wayfarers-1.0.0', 'battle-engine-1.0.0', 'active', 'fda76be4495cf47c16816dc67d366ce408c582868314790e8a3fec6a6a292a5f'),
    ('three-packs-1.0.0', 'battle-engine-1.0.0', 'retired', NULL),
    ('alpha-beta-1.0.0', 'battle-engine-1.0.0', 'retired', NULL)
  ) AS v(version, engine_version, status, catalog_hash)
$fn$;
