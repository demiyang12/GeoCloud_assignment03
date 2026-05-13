/**
 * Script to transform raw AirNow data files into BigQuery-compatible formats.
 *
 * Converts raw .dat files from data/raw/ into CSV, JSON-L, and Parquet
 * formats under data/prepared/. Uses DuckDB for all format conversions.
 * The spatial extension is used to produce GeoParquet for site locations.
 *
 * Usage:
 *     node scripts/02_prepare.mjs
 */

import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { DuckDBInstance } from '@duckdb/node-api';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '..', 'data');

// Column definitions for the pipe-delimited hourly files (no header row)
const HOURLY_COLUMNS = {
  valid_date: 'VARCHAR',
  valid_time: 'VARCHAR',
  aqsid: 'VARCHAR',
  site_name: 'VARCHAR',
  gmt_offset: 'INTEGER',
  parameter_name: 'VARCHAR',
  reporting_units: 'VARCHAR',
  value: 'DOUBLE',
  data_source: 'VARCHAR',
};

let conn;

async function initDuckDB() {
  const instance = await DuckDBInstance.create(':memory:');
  conn = await instance.connect();
  await conn.run("INSTALL spatial; LOAD spatial;");
}

// Returns the list of 24 raw hourly file paths for a given date
function getHourlyFilePaths(dateStr) {
  const [year, month, day] = dateStr.split('-');
  const compact = `${year}${month}${day}`;
  const rawDir = path.join(DATA_DIR, 'raw', dateStr);
  return Array.from({ length: 24 }, (_, hour) => {
    const hourStr = String(hour).padStart(2, '0');
    return path.join(rawDir, `HourlyData_${compact}${hourStr}.dat`);
  });
}

// DuckDB SQL fragment to read all 24 hourly files for a date as one table
function hourlyReadExpr(dateStr) {
  const files = getHourlyFilePaths(dateStr).map(f => `'${f}'`).join(', ');
  const cols = Object.entries(HOURLY_COLUMNS)
    .map(([k, v]) => `'${k}': '${v}'`)
    .join(', ');
  return `read_csv([${files}], sep='|', header=false, columns={${cols}}, ignore_errors=true)`;
}

// DuckDB SQL fragment to read the site locations file deduplicated by AQSID
function sitesReadExpr(sitesFile) {
  return `(
    SELECT * EXCLUDE (rn)
    FROM (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY AQSID ORDER BY 1) AS rn
      FROM read_csv('${sitesFile}', sep='|', header=true, ignore_errors=true)
    )
    WHERE rn = 1
  )`;
}

// Returns the most recent available site locations file
async function getMostRecentSitesFile() {
  for (let day = 31; day >= 1; day--) {
    const dateStr = `2024-07-${String(day).padStart(2, '0')}`;
    const p = path.join(DATA_DIR, 'raw', dateStr, 'Monitoring_Site_Locations_V2.dat');
    try {
      await fs.access(p);
      return p;
    } catch {}
  }
  throw new Error('No site locations file found in data/raw/');
}

// --- Hourly observation data ---

async function prepareHourlyCsv(dateStr) {
  const outPath = path.join(DATA_DIR, 'prepared', 'hourly', `${dateStr}.csv`);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await conn.run(`
    COPY (SELECT * FROM ${hourlyReadExpr(dateStr)})
    TO '${outPath}' (FORMAT CSV, HEADER true)
  `);
}

async function prepareHourlyJsonl(dateStr) {
  const outPath = path.join(DATA_DIR, 'prepared', 'hourly', `${dateStr}.jsonl`);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await conn.run(`
    COPY (SELECT * FROM ${hourlyReadExpr(dateStr)})
    TO '${outPath}' (FORMAT JSON)
  `);
}

async function prepareHourlyParquet(dateStr) {
  const outPath = path.join(DATA_DIR, 'prepared', 'hourly', `${dateStr}.parquet`);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await conn.run(`
    COPY (SELECT * FROM ${hourlyReadExpr(dateStr)})
    TO '${outPath}' (FORMAT PARQUET)
  `);
}

// --- Site location data ---

async function prepareSiteLocationsCsv(sitesFile) {
  const outPath = path.join(DATA_DIR, 'prepared', 'sites', 'site_locations.csv');
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await conn.run(`
    COPY (SELECT * FROM ${sitesReadExpr(sitesFile)})
    TO '${outPath}' (FORMAT CSV, HEADER true)
  `);
}

async function prepareSiteLocationsJsonl(sitesFile) {
  const outPath = path.join(DATA_DIR, 'prepared', 'sites', 'site_locations.jsonl');
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await conn.run(`
    COPY (SELECT * FROM ${sitesReadExpr(sitesFile)})
    TO '${outPath}' (FORMAT JSON)
  `);
}

async function prepareSiteLocationsGeoparquet(sitesFile) {
  const outPath = path.join(DATA_DIR, 'prepared', 'sites', 'site_locations.geoparquet');
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  // Keep all columns; add a geometry point column from Longitude/Latitude.
  // DuckDB spatial extension writes proper GeoParquet metadata automatically.
  await conn.run(`
    COPY (
      SELECT
        * EXCLUDE (rn),
        ST_Point(
          TRY_CAST(Longitude AS DOUBLE),
          TRY_CAST(Latitude AS DOUBLE)
        ) AS geometry
      FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY AQSID ORDER BY 1) AS rn
        FROM read_csv('${sitesFile}', sep='|', header=true, ignore_errors=true)
      )
      WHERE rn = 1
    )
    TO '${outPath}' (FORMAT PARQUET)
  `);
}

// --- Main ---

await initDuckDB();

const sitesFile = await getMostRecentSitesFile();

console.log('Preparing site locations...');
await prepareSiteLocationsCsv(sitesFile);
await prepareSiteLocationsJsonl(sitesFile);
await prepareSiteLocationsGeoparquet(sitesFile);
console.log('  Site locations done.');

const startDate = new Date('2024-07-01');
const endDate = new Date('2024-07-31');

let currentDate = startDate;
while (currentDate <= endDate) {
  const dateStr = currentDate.toISOString().split('T')[0];
  console.log(`Preparing hourly data for ${dateStr}...`);
  await prepareHourlyCsv(dateStr);
  await prepareHourlyJsonl(dateStr);
  await prepareHourlyParquet(dateStr);
  currentDate.setDate(currentDate.getDate() + 1);
}

console.log('Done.');
