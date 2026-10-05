-- Backfill metadata introduced in V2.0.2 for already-installed themes and history.
-- Preserve every existing icon, tree, version, revision, asset and publication state.
WITH core_icons(type, icon) AS (VALUES
  ('core/container', 'fas fa-square'),
  ('core/columns', 'fas fa-columns'),
  ('core/spacer', 'fas fa-arrows-alt-v'),
  ('core/heading', 'fas fa-heading'),
  ('core/rich-text', 'fas fa-align-left'),
  ('core/image', 'fas fa-image'),
  ('core/media', 'fas fa-photo-video'),
  ('core/featured-image', 'fas fa-portrait'),
  ('core/menu', 'fas fa-bars'),
  ('core/search', 'fas fa-search'),
  ('core/post-list', 'fas fa-list'),
  ('core/post-content', 'fas fa-file-alt'),
  ('core/post-meta', 'fas fa-info-circle'),
  ('core/pagination', 'fas fa-ellipsis-h'),
  ('core/site-brand', 'fas fa-globe')
)
UPDATE themes
SET manifest = json_set(manifest, '$.blocks', json((
  SELECT json_group_array(json(patched)) FROM (
    SELECT CASE WHEN i.icon IS NOT NULL AND
      (json_extract(b.value, '$.icon') IS NULL OR trim(json_extract(b.value, '$.icon')) = '')
      THEN json_set(b.value, '$.icon', i.icon) ELSE b.value END AS patched
    FROM json_each(themes.manifest, '$.blocks') AS b
    LEFT JOIN core_icons AS i ON i.type = json_extract(b.value, '$.type')
    ORDER BY CAST(b.key AS INTEGER)
  )
)))
WHERE manifest IS NOT NULL AND EXISTS (
  SELECT 1 FROM json_each(themes.manifest, '$.blocks') AS b
  JOIN core_icons AS i ON i.type = json_extract(b.value, '$.type')
  WHERE json_extract(b.value, '$.icon') IS NULL OR trim(json_extract(b.value, '$.icon')) = ''
);
--> statement-breakpoint
WITH core_icons(type, icon) AS (VALUES
  ('core/container', 'fas fa-square'),
  ('core/columns', 'fas fa-columns'),
  ('core/spacer', 'fas fa-arrows-alt-v'),
  ('core/heading', 'fas fa-heading'),
  ('core/rich-text', 'fas fa-align-left'),
  ('core/image', 'fas fa-image'),
  ('core/media', 'fas fa-photo-video'),
  ('core/featured-image', 'fas fa-portrait'),
  ('core/menu', 'fas fa-bars'),
  ('core/search', 'fas fa-search'),
  ('core/post-list', 'fas fa-list'),
  ('core/post-content', 'fas fa-file-alt'),
  ('core/post-meta', 'fas fa-info-circle'),
  ('core/pagination', 'fas fa-ellipsis-h'),
  ('core/site-brand', 'fas fa-globe')
)
UPDATE themes
SET published = json_set(published, '$.manifest.blocks', json((
  SELECT json_group_array(json(patched)) FROM (
    SELECT CASE WHEN i.icon IS NOT NULL AND
      (json_extract(b.value, '$.icon') IS NULL OR trim(json_extract(b.value, '$.icon')) = '')
      THEN json_set(b.value, '$.icon', i.icon) ELSE b.value END AS patched
    FROM json_each(themes.published, '$.manifest.blocks') AS b
    LEFT JOIN core_icons AS i ON i.type = json_extract(b.value, '$.type')
    ORDER BY CAST(b.key AS INTEGER)
  )
)))
WHERE published IS NOT NULL AND EXISTS (
  SELECT 1 FROM json_each(themes.published, '$.manifest.blocks') AS b
  JOIN core_icons AS i ON i.type = json_extract(b.value, '$.type')
  WHERE json_extract(b.value, '$.icon') IS NULL OR trim(json_extract(b.value, '$.icon')) = ''
);
--> statement-breakpoint
WITH core_icons(type, icon) AS (VALUES
  ('core/container', 'fas fa-square'),
  ('core/columns', 'fas fa-columns'),
  ('core/spacer', 'fas fa-arrows-alt-v'),
  ('core/heading', 'fas fa-heading'),
  ('core/rich-text', 'fas fa-align-left'),
  ('core/image', 'fas fa-image'),
  ('core/media', 'fas fa-photo-video'),
  ('core/featured-image', 'fas fa-portrait'),
  ('core/menu', 'fas fa-bars'),
  ('core/search', 'fas fa-search'),
  ('core/post-list', 'fas fa-list'),
  ('core/post-content', 'fas fa-file-alt'),
  ('core/post-meta', 'fas fa-info-circle'),
  ('core/pagination', 'fas fa-ellipsis-h'),
  ('core/site-brand', 'fas fa-globe')
)
UPDATE themes
SET draft = json_set(draft, '$.manifest.blocks', json((
  SELECT json_group_array(json(patched)) FROM (
    SELECT CASE WHEN i.icon IS NOT NULL AND
      (json_extract(b.value, '$.icon') IS NULL OR trim(json_extract(b.value, '$.icon')) = '')
      THEN json_set(b.value, '$.icon', i.icon) ELSE b.value END AS patched
    FROM json_each(themes.draft, '$.manifest.blocks') AS b
    LEFT JOIN core_icons AS i ON i.type = json_extract(b.value, '$.type')
    ORDER BY CAST(b.key AS INTEGER)
  )
)))
WHERE draft IS NOT NULL AND EXISTS (
  SELECT 1 FROM json_each(themes.draft, '$.manifest.blocks') AS b
  JOIN core_icons AS i ON i.type = json_extract(b.value, '$.type')
  WHERE json_extract(b.value, '$.icon') IS NULL OR trim(json_extract(b.value, '$.icon')) = ''
);
--> statement-breakpoint
WITH core_icons(type, icon) AS (VALUES
  ('core/container', 'fas fa-square'),
  ('core/columns', 'fas fa-columns'),
  ('core/spacer', 'fas fa-arrows-alt-v'),
  ('core/heading', 'fas fa-heading'),
  ('core/rich-text', 'fas fa-align-left'),
  ('core/image', 'fas fa-image'),
  ('core/media', 'fas fa-photo-video'),
  ('core/featured-image', 'fas fa-portrait'),
  ('core/menu', 'fas fa-bars'),
  ('core/search', 'fas fa-search'),
  ('core/post-list', 'fas fa-list'),
  ('core/post-content', 'fas fa-file-alt'),
  ('core/post-meta', 'fas fa-info-circle'),
  ('core/pagination', 'fas fa-ellipsis-h'),
  ('core/site-brand', 'fas fa-globe')
)
UPDATE theme_history
SET snapshot = json_set(snapshot, '$.manifest.blocks', json((
  SELECT json_group_array(json(patched)) FROM (
    SELECT CASE WHEN i.icon IS NOT NULL AND
      (json_extract(b.value, '$.icon') IS NULL OR trim(json_extract(b.value, '$.icon')) = '')
      THEN json_set(b.value, '$.icon', i.icon) ELSE b.value END AS patched
    FROM json_each(theme_history.snapshot, '$.manifest.blocks') AS b
    LEFT JOIN core_icons AS i ON i.type = json_extract(b.value, '$.type')
    ORDER BY CAST(b.key AS INTEGER)
  )
)))
WHERE snapshot IS NOT NULL AND EXISTS (
  SELECT 1 FROM json_each(theme_history.snapshot, '$.manifest.blocks') AS b
  JOIN core_icons AS i ON i.type = json_extract(b.value, '$.type')
  WHERE json_extract(b.value, '$.icon') IS NULL OR trim(json_extract(b.value, '$.icon')) = ''
);
