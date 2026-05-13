# Assignment 03 Responses

## Part 4: BigQuery External Tables

### Hourly Observations — CSV External Table SQL

```sql
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
```

### Hourly Observations — JSON-L External Table SQL

```sql
CREATE OR REPLACE EXTERNAL TABLE `geocloudassignment03.air_quality.hourly_observations_jsonl`
OPTIONS (
  format = 'NEWLINE_DELIMITED_JSON',
  uris   = ['gs://musa5090-s26-demi-yang-data/air_quality/hourly/*.jsonl']
);
```

### Hourly Observations — Parquet External Table SQL

```sql
CREATE OR REPLACE EXTERNAL TABLE `geocloudassignment03.air_quality.hourly_observations_parquet`
OPTIONS (
  format = 'PARQUET',
  uris   = ['gs://musa5090-s26-demi-yang-data/air_quality/hourly/*.parquet']
);
```

### Site Locations — CSV External Table SQL

```sql
CREATE OR REPLACE EXTERNAL TABLE `geocloudassignment03.air_quality.site_locations_csv`
OPTIONS (
  format            = 'CSV',
  uris              = ['gs://musa5090-s26-demi-yang-data/air_quality/sites/site_locations.csv'],
  skip_leading_rows = 1,
  autodetect        = true
);
```

### Site Locations — JSON-L External Table SQL

```sql
CREATE OR REPLACE EXTERNAL TABLE `geocloudassignment03.air_quality.site_locations_jsonl`
OPTIONS (
  format = 'NEWLINE_DELIMITED_JSON',
  uris   = ['gs://musa5090-s26-demi-yang-data/air_quality/sites/site_locations.jsonl']
);
```

### Site Locations — GeoParquet External Table SQL

```sql
CREATE OR REPLACE EXTERNAL TABLE `geocloudassignment03.air_quality.site_locations_geoparquet`
OPTIONS (
  format = 'PARQUET',
  uris   = ['gs://musa5090-s26-demi-yang-data/air_quality/sites/site_locations.geoparquet']
);
```

### Cross-Table Join Query

```sql
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
```

---

## Part 5: Hive-Partitioned External Tables

### Hourly Observations — CSV (hive-partitioned)

```sql
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
  format                    = 'CSV',
  uris                      = ['gs://musa5090-s26-demi-yang-data/air_quality/hourly/csv/*'],
  skip_leading_rows         = 1,
  hive_partition_uri_prefix = 'gs://musa5090-s26-demi-yang-data/air_quality/hourly/csv'
);
```

### Hourly Observations — JSON-L (hive-partitioned)

```sql
CREATE OR REPLACE EXTERNAL TABLE `geocloudassignment03.air_quality.hourly_observations_jsonl_hive`
WITH PARTITION COLUMNS (
  airnow_date DATE
)
OPTIONS (
  format                    = 'NEWLINE_DELIMITED_JSON',
  uris                      = ['gs://musa5090-s26-demi-yang-data/air_quality/hourly/jsonl/*'],
  hive_partition_uri_prefix = 'gs://musa5090-s26-demi-yang-data/air_quality/hourly/jsonl'
);
```

### Hourly Observations — Parquet (hive-partitioned)

```sql
CREATE OR REPLACE EXTERNAL TABLE `geocloudassignment03.air_quality.hourly_observations_parquet_hive`
WITH PARTITION COLUMNS (
  airnow_date DATE
)
OPTIONS (
  format                    = 'PARQUET',
  uris                      = ['gs://musa5090-s26-demi-yang-data/air_quality/hourly/parquet/*'],
  hive_partition_uri_prefix = 'gs://musa5090-s26-demi-yang-data/air_quality/hourly/parquet'
);
```

---

## Part 6: Analysis & Reflection

### 1. File Sizes

**Hourly data (single day — 2024-07-01):**

| Format  | File Size |
|---------|-----------|
| CSV     | 17 MB     |
| JSON-L  | 41 MB     |
| Parquet | 773 KB    |

**Site locations:**

| Format     | File Size |
|------------|-----------|
| CSV        | 999 KB    |
| JSON-L     | 2.8 MB    |
| GeoParquet | 455 KB    |

**Analysis:**

Parquet is by far the smallest format — about 22× smaller than CSV and 54× smaller than JSON-L for the hourly data. This is because Parquet is a columnar binary format that applies compression per column. Numeric columns like `value` and `gmt_offset` compress extremely well because repeated or similar values are stored efficiently using encodings like dictionary encoding and run-length encoding. CSV and JSON-L are plain-text formats that store every value as a character string, with JSON-L carrying additional overhead for field names repeated on every row. GeoParquet is smaller than CSV for site locations for the same reasons, even though it adds a binary geometry column.

### 2. Format Anatomy

**CSV vs. Parquet**

CSV (Comma-Separated Values) is a plain-text, row-oriented format. Each line in the file represents one record, and fields are separated by a delimiter. It requires a header row to convey column names, and all values are stored as strings — a reader must know in advance which columns are numeric or dates. CSV is human-readable, universally supported, and easy to produce, but it has no built-in compression, no type metadata, and a query engine must scan every row even if only one column is needed.

Parquet is a binary, columnar format. Instead of storing data row-by-row, it groups all values for each column together in chunks called row groups. Each column chunk is compressed independently using encodings suited to its data type. The file header stores a schema with explicit types (INT64, DOUBLE, BINARY, etc.), so a reader knows how to interpret the bytes without any external information. A query engine can read only the columns it needs and skip entire row groups using built-in min/max statistics — this is why Parquet queries in BigQuery are faster and cheaper than equivalent CSV queries.

### 3. Choosing Formats for BigQuery

Parquet is preferred over CSV or JSON-L for BigQuery external tables for two main reasons:

**Performance:** BigQuery charges per byte scanned. Parquet's columnar layout means a query that references only two of nine columns scans roughly 2/9 of the data instead of everything. Combined with per-column compression, the actual bytes read can be 20–50× less than for the equivalent CSV. Parquet also stores min/max statistics per row group, allowing BigQuery to skip entire chunks of data when a WHERE clause can be evaluated from statistics alone.

**Cost:** BigQuery's on-demand pricing is $5 per TB scanned. For the 31-day hourly dataset (~24 GB as CSV vs. ~24 MB as Parquet), querying Parquet can reduce scan costs by roughly two orders of magnitude. At scale, this difference becomes significant in both query latency and billing.

### 4. Pipeline vs. Warehouse Joins

In this assignment, hourly observations and site locations are stored as separate tables and joined in BigQuery at query time. The alternative would be to join them during the prepare step (Part 2) to produce a single denormalized file with latitude, longitude, and state already embedded in every observation row.

**Keeping them separate (join at query time):**
- Storage is more efficient — site metadata (~1,000 sites) is stored once rather than repeated across ~11 million hourly rows
- The pipeline is simpler and faster: the prepare step does not need to load and join two datasets
- Schema changes to site locations only require re-uploading one small file, not reprocessing all 31 days of observations
- The tradeoff is that every query that needs location data must perform a join, which adds a small cost and complexity

**Denormalizing at prepare time (join in pipeline):**
- Queries become simpler — no JOIN clause needed to get state or coordinates
- Query performance may be better for dashboards that always need location context, since BigQuery doesn't need to shuffle data for a join
- The tradeoff is larger files, more storage cost, and a more expensive prepare step that must be re-run if either dataset changes

**When to prefer each:** Keep data separate when the lookup table is small, changes independently, and not every query needs it. Denormalize when the data is always queried together, query simplicity matters (e.g., analysts unfamiliar with SQL joins), or the join is expensive at query time due to large table sizes on both sides.

#### Stretch Challenge

```sql
-- Merged Hourly + Sites — CSV (hive-partitioned)
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
```

```sql
-- Merged Hourly + Sites — JSON-L (hive-partitioned)
CREATE OR REPLACE EXTERNAL TABLE `geocloudassignment03.air_quality.hourly_with_sites_jsonl`
WITH PARTITION COLUMNS (
  airnow_date DATE
)
OPTIONS (
  format                    = 'NEWLINE_DELIMITED_JSON',
  uris                      = ['gs://musa5090-s26-demi-yang-data/air_quality/hourly_with_sites/jsonl/*'],
  hive_partition_uri_prefix = 'gs://musa5090-s26-demi-yang-data/air_quality/hourly_with_sites/jsonl'
);
```

```sql
-- Merged Hourly + Sites — GeoParquet (hive-partitioned)
CREATE OR REPLACE EXTERNAL TABLE `geocloudassignment03.air_quality.hourly_with_sites_geoparquet`
WITH PARTITION COLUMNS (
  airnow_date DATE
)
OPTIONS (
  format                    = 'PARQUET',
  uris                      = ['gs://musa5090-s26-demi-yang-data/air_quality/hourly_with_sites/geoparquet/*'],
  hive_partition_uri_prefix = 'gs://musa5090-s26-demi-yang-data/air_quality/hourly_with_sites/geoparquet'
);
```

### 5. Choosing a Data Source

**a) A parent who wants a dashboard showing current air quality near their child's school:**

The **AirNow API** is the right choice. The parent needs current, near-real-time AQI readings — the API delivers the latest hourly observations for a specific location without requiring a full file pipeline. The AirNow bulk files would also work, but building a pipeline to download and process hourly files is heavier infrastructure than needed for a single-location dashboard. The AQS system is the wrong choice entirely, since its data can lag months behind real-time conditions.

**b) An environmental justice advocate identifying neighborhoods with chronically poor or worsening air quality over the past decade:**

**AQS bulk downloads** are the right choice. This use case requires years of quality-assured historical data at the daily or annual summary level — exactly what AQS publishes. AirNow data is designed for near-real-time use and is not archived in a form suitable for decade-long trend analysis. The AQS bulk CSV downloads provide annual and daily summary files going back decades, which can be loaded into a data warehouse and queried to identify trends by site, county, or census tract.

**c) A school administrator who needs automated morning alerts when AQI exceeds a threshold:**

The **AirNow API** is the best fit. Automated alerts require a system that can query current conditions on a schedule (e.g., every morning at 6 AM) and trigger a notification if the AQI exceeds a threshold. The AirNow API is designed for exactly this kind of targeted, location-specific, recurring query. Building a full file-download pipeline for this use case would be over-engineered — the API delivers exactly the data needed with one request. The AQS system is again the wrong choice since its data is not current enough to drive same-day decisions.
