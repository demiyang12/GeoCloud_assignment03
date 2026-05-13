/**
 * Script to re-upload prepared hourly data to GCS with hive-partitioned paths.
 *
 * Uploads files from data/prepared/hourly/ using the structure:
 *     air_quality/hourly/csv/airnow_date=2024-07-01/data.csv
 *     air_quality/hourly/jsonl/airnow_date=2024-07-01/data.jsonl
 *     air_quality/hourly/parquet/airnow_date=2024-07-01/data.parquet
 *
 * This lets BigQuery automatically detect airnow_date as a partition column
 * so queries filtering by date only scan the relevant file.
 *
 * Prerequisites:
 *     Parts 1–3 complete (prepared files already exist under data/prepared/).
 *     gcloud auth application-default login
 *
 * Usage:
 *     node scripts/05_upload_to_gcs.mjs
 */

import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { Storage } from '@google-cloud/storage';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '..', 'data');

const PROJECT_ID = 'geocloudassignment03';
const BUCKET_NAME = 'musa5090-s26-demi-yang-data';

// Maps file extension to the format subfolder name in GCS
const EXT_TO_FOLDER = {
  csv:     'csv',
  jsonl:   'jsonl',
  parquet: 'parquet',
};

async function uploadWithHivePartitioning() {
  const storage = new Storage({ projectId: PROJECT_ID });
  const bucket = storage.bucket(BUCKET_NAME);

  const hourlyDir = path.join(DATA_DIR, 'prepared', 'hourly');
  const entries = await fs.readdir(hourlyDir);

  for (const filename of entries) {
    const match = filename.match(/^(\d{4}-\d{2}-\d{2})\.(csv|jsonl|parquet)$/);
    if (!match) continue;

    const [, date, ext] = match;
    const formatFolder = EXT_TO_FOLDER[ext];
    const gcsPath = `air_quality/hourly/${formatFolder}/airnow_date=${date}/data.${ext}`;
    const localPath = path.join(hourlyDir, filename);

    await bucket.upload(localPath, { destination: gcsPath });
    console.log(`  Uploaded: gs://${BUCKET_NAME}/${gcsPath}`);
  }
}

await uploadWithHivePartitioning();
console.log('Done.');
