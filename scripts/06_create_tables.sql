-- Part 6 (stretch challenge): Create BigQuery external tables for merged data
--
-- These tables point to the denormalized files where hourly observations
-- have been pre-joined with site location data during the prepare step.
-- Each row already includes latitude, longitude, state, and other site metadata.


-- ============================================================
-- Merged Hourly + Sites — CSV (hive-partitioned)
-- ============================================================
CREATE OR REPLACE EXTERNAL TABLE `geocloudassignment03.air_quality.hourly_with_sites_csv`
WITH PARTITION COLUMNS (
  airnow_date DATE
)
OPTIONS (
  format                    = 'CSV',
  uris                      = ['gs://musa5090-s26-demi-yang-data/air_quality/hourly_with_sites/csv/*'],
  skip_leading_rows         = 1,
  autodetect                = true,
  hive_partition_uri_prefix = 'gs://musa5090-s26-demi-yang-data/air_quality/hourly_with_sites/csv'
);


-- ============================================================
-- Merged Hourly + Sites — JSON-L (hive-partitioned)
-- ============================================================
CREATE OR REPLACE EXTERNAL TABLE `geocloudassignment03.air_quality.hourly_with_sites_jsonl`
WITH PARTITION COLUMNS (
  airnow_date DATE
)
OPTIONS (
  format                    = 'NEWLINE_DELIMITED_JSON',
  uris                      = ['gs://musa5090-s26-demi-yang-data/air_quality/hourly_with_sites/jsonl/*'],
  hive_partition_uri_prefix = 'gs://musa5090-s26-demi-yang-data/air_quality/hourly_with_sites/jsonl'
);


-- ============================================================
-- Merged Hourly + Sites — GeoParquet (hive-partitioned)
-- ============================================================
CREATE OR REPLACE EXTERNAL TABLE `geocloudassignment03.air_quality.hourly_with_sites_geoparquet`
WITH PARTITION COLUMNS (
  airnow_date DATE
)
OPTIONS (
  format                    = 'PARQUET',
  uris                      = ['gs://musa5090-s26-demi-yang-data/air_quality/hourly_with_sites/geoparquet/*'],
  hive_partition_uri_prefix = 'gs://musa5090-s26-demi-yang-data/air_quality/hourly_with_sites/geoparquet'
);
