-- Part 5: Create BigQuery external tables with hive partitioning
--
-- These tables use the hive-partitioned folder structure uploaded by
-- 05_upload_to_gcs.mjs. BigQuery reads the airnow_date= folder names
-- and exposes them as a partition column, so filtering by date
-- scans only the relevant file instead of all 31.


-- ============================================================
-- Hourly Observations — CSV (hive-partitioned)
-- ============================================================
CREATE OR REPLACE EXTERNAL TABLE `geocloudassignment03.air_quality.hourly_observations_csv_hive`
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
WITH PARTITION COLUMNS (
  airnow_date DATE
)
OPTIONS (
  format                  = 'CSV',
  uris                    = ['gs://musa5090-s26-demi-yang-data/air_quality/hourly/csv/*'],
  skip_leading_rows       = 1,
  hive_partition_uri_prefix = 'gs://musa5090-s26-demi-yang-data/air_quality/hourly/csv'
);


-- ============================================================
-- Hourly Observations — JSON-L (hive-partitioned)
-- ============================================================
CREATE OR REPLACE EXTERNAL TABLE `geocloudassignment03.air_quality.hourly_observations_jsonl_hive`
WITH PARTITION COLUMNS (
  airnow_date DATE
)
OPTIONS (
  format                    = 'NEWLINE_DELIMITED_JSON',
  uris                      = ['gs://musa5090-s26-demi-yang-data/air_quality/hourly/jsonl/*'],
  hive_partition_uri_prefix = 'gs://musa5090-s26-demi-yang-data/air_quality/hourly/jsonl'
);


-- ============================================================
-- Hourly Observations — Parquet (hive-partitioned)
-- ============================================================
CREATE OR REPLACE EXTERNAL TABLE `geocloudassignment03.air_quality.hourly_observations_parquet_hive`
WITH PARTITION COLUMNS (
  airnow_date DATE
)
OPTIONS (
  format                    = 'PARQUET',
  uris                      = ['gs://musa5090-s26-demi-yang-data/air_quality/hourly/parquet/*'],
  hive_partition_uri_prefix = 'gs://musa5090-s26-demi-yang-data/air_quality/hourly/parquet'
);
