-- Part 4: Create BigQuery external tables
--
-- Run these statements in the BigQuery console (project: geocloudassignment03).
-- Make sure the dataset `air_quality` exists first:
--   CREATE SCHEMA IF NOT EXISTS `geocloudassignment03.air_quality`;


-- ============================================================
-- Hourly Observations — CSV
-- ============================================================
CREATE OR REPLACE EXTERNAL TABLE `geocloudassignment03.air_quality.hourly_observations_csv`
(
  valid_date      STRING,
  valid_time      STRING,
  aqsid           STRING,
  site_name       STRING,
  gmt_offset      INT64,
  parameter_name  STRING,
  reporting_units STRING,
  value           FLOAT64,
  data_source     STRING
)
OPTIONS (
  format           = 'CSV',
  uris             = ['gs://musa5090-s26-demi-yang-data/air_quality/hourly/*.csv'],
  skip_leading_rows = 1
);


-- ============================================================
-- Hourly Observations — JSON-L
-- ============================================================
CREATE OR REPLACE EXTERNAL TABLE `geocloudassignment03.air_quality.hourly_observations_jsonl`
OPTIONS (
  format = 'NEWLINE_DELIMITED_JSON',
  uris   = ['gs://musa5090-s26-demi-yang-data/air_quality/hourly/*.jsonl']
);


-- ============================================================
-- Hourly Observations — Parquet
-- ============================================================
CREATE OR REPLACE EXTERNAL TABLE `geocloudassignment03.air_quality.hourly_observations_parquet`
OPTIONS (
  format = 'PARQUET',
  uris   = ['gs://musa5090-s26-demi-yang-data/air_quality/hourly/*.parquet']
);


-- ============================================================
-- Site Locations — CSV
-- ============================================================
CREATE OR REPLACE EXTERNAL TABLE `geocloudassignment03.air_quality.site_locations_csv`
OPTIONS (
  format            = 'CSV',
  uris              = ['gs://musa5090-s26-demi-yang-data/air_quality/sites/site_locations.csv'],
  skip_leading_rows = 1,
  autodetect        = true
);


-- ============================================================
-- Site Locations — JSON-L
-- ============================================================
CREATE OR REPLACE EXTERNAL TABLE `geocloudassignment03.air_quality.site_locations_jsonl`
OPTIONS (
  format = 'NEWLINE_DELIMITED_JSON',
  uris   = ['gs://musa5090-s26-demi-yang-data/air_quality/sites/site_locations.jsonl']
);


-- ============================================================
-- Site Locations — GeoParquet
-- ============================================================
CREATE OR REPLACE EXTERNAL TABLE `geocloudassignment03.air_quality.site_locations_geoparquet`
OPTIONS (
  format = 'PARQUET',
  uris   = ['gs://musa5090-s26-demi-yang-data/air_quality/sites/site_locations.geoparquet']
);


-- ============================================================
-- Verify row counts are consistent across formats
-- ============================================================
-- SELECT count(*) FROM `geocloudassignment03.air_quality.hourly_observations_csv`;
-- SELECT count(*) FROM `geocloudassignment03.air_quality.hourly_observations_jsonl`;
-- SELECT count(*) FROM `geocloudassignment03.air_quality.hourly_observations_parquet`;


-- ============================================================
-- Cross-table join: average PM2.5 by state for 2024-07-01
-- ============================================================
SELECT
  s.StateAbbreviation                AS state,
  ROUND(AVG(h.value), 2)             AS avg_pm25,
  COUNT(*)                           AS observation_count
FROM `geocloudassignment03.air_quality.hourly_observations_parquet` AS h
JOIN `geocloudassignment03.air_quality.site_locations_geoparquet`   AS s
  ON h.aqsid = s.AQSID
WHERE h.valid_date     = '07/01/24'
  AND h.parameter_name = 'PM2.5'
GROUP BY state
ORDER BY avg_pm25 DESC;
