/**
 * Stretch challenge: Prepare merged hourly + site location data.
 *
 * Joins hourly observations with site locations during the prepare step
 * (denormalization), so each row already includes latitude, longitude,
 * state, and other geographic metadata. Output goes to
 * data/prepared/hourly_with_sites/ in CSV, JSON-L, and GeoParquet.
 *
 * Usage:
 *     node scripts/06_prepare.mjs
 */

import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { DuckDBInstance } from '@duckdb/node-api';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '..', 'data');

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

function getHourlyFilePaths(dateStr) {
  const [year, month, day] = dateStr.split('-');
  const compact = `${year}${month}${day}`;
  const rawDir = path.join(DATA_DIR, 'raw', dateStr);
  return Array.from({ length: 24 }, (_, hour) => {
    const hourStr = String(hour).padStart(2, '0');
    return path.join(rawDir, `HourlyData_${compact}${hourStr}.dat`);
  });
}

function hourlyReadExpr(dateStr) {
  const files = getHourlyFilePaths(dateStr).map(f => `'${f}'`).join(', ');
  const cols = Object.entries(HOURLY_COLUMNS)
    .map(([k, v]) => `'${k}': '${v}'`)
    .join(', ');
  return `read_csv([${files}], sep='|', header=false, columns={${cols}}, ignore_errors=true)`;
}

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

// SQL fragment: deduplicated sites table (one row per AQSID)
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

// SQL fragment: joined hourly + sites
function mergedExpr(dateStr, sitesFile) {
  return `(
    SELECT
      h.*,
      s.Latitude,
      s.Longitude,
      s.StateAbbreviation,
      s.CountyName,
      s.FullAQSID,
      s.MonitorType,
      s.CountryFIPS
    FROM ${hourlyReadExpr(dateStr)} AS h
    LEFT JOIN ${sitesReadExpr(sitesFile)} AS s
      ON h.aqsid = s.AQSID
  )`;
}

async function prepareMergedCsv(dateStr, sitesFile) {
  const outPath = path.join(DATA_DIR, 'prepared', 'hourly_with_sites', `${dateStr}.csv`);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await conn.run(`
    COPY (SELECT * FROM ${mergedExpr(dateStr, sitesFile)})
    TO '${outPath}' (FORMAT CSV, HEADER true)
  `);
}

async function prepareMergedJsonl(dateStr, sitesFile) {
  const outPath = path.join(DATA_DIR, 'prepared', 'hourly_with_sites', `${dateStr}.jsonl`);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await conn.run(`
    COPY (SELECT * FROM ${mergedExpr(dateStr, sitesFile)})
    TO '${outPath}' (FORMAT JSON)
  `);
}

async function prepareMergedGeoparquet(dateStr, sitesFile) {
  const outPath = path.join(DATA_DIR, 'prepared', 'hourly_with_sites', `${dateStr}.geoparquet`);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await conn.run(`
    COPY (
      SELECT
        h.*,
        s.Latitude,
        s.Longitude,
        s.StateAbbreviation,
        s.CountyName,
        s.FullAQSID,
        s.MonitorType,
        s.CountryFIPS,
        ST_Point(
          TRY_CAST(s.Longitude AS DOUBLE),
          TRY_CAST(s.Latitude AS DOUBLE)
        ) AS geometry
      FROM ${hourlyReadExpr(dateStr)} AS h
      LEFT JOIN ${sitesReadExpr(sitesFile)} AS s
        ON h.aqsid = s.AQSID
    )
    TO '${outPath}' (FORMAT PARQUET)
  `);
}

// --- Main ---

await initDuckDB();
const sitesFile = await getMostRecentSitesFile();

const startDate = new Date('2024-07-01');
const endDate = new Date('2024-07-31');

let currentDate = startDate;
while (currentDate <= endDate) {
  const dateStr = currentDate.toISOString().split('T')[0];
  console.log(`Preparing merged data for ${dateStr}...`);
  await prepareMergedCsv(dateStr, sitesFile);
  await prepareMergedJsonl(dateStr, sitesFile);
  await prepareMergedGeoparquet(dateStr, sitesFile);
  currentDate.setDate(currentDate.getDate() + 1);
}

console.log('Done.');
