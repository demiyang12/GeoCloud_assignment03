/**
 * Stretch challenge: Upload merged hourly + site location data to GCS.
 *
 * Uploads files from data/prepared/hourly_with_sites/ using hive-partitioned paths:
 *     air_quality/hourly_with_sites/csv/airnow_date=2024-07-01/data.csv
 *     air_quality/hourly_with_sites/jsonl/airnow_date=2024-07-01/data.jsonl
 *     air_quality/hourly_with_sites/geoparquet/airnow_date=2024-07-01/data.geoparquet
 *
 * Prerequisites:
 *     node scripts/06_prepare.mjs must be complete.
 *     gcloud auth application-default login
 *
 * Usage:
 *     node scripts/06_upload_to_gcs.mjs
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

const EXT_TO_FOLDER = {
  csv:        'csv',
  jsonl:      'jsonl',
  geoparquet: 'geoparquet',
};

async function uploadMergedData() {
  const storage = new Storage({ projectId: PROJECT_ID });
  const bucket = storage.bucket(BUCKET_NAME);

  const mergedDir = path.join(DATA_DIR, 'prepared', 'hourly_with_sites');
  const entries = await fs.readdir(mergedDir);

  for (const filename of entries) {
    const match = filename.match(/^(\d{4}-\d{2}-\d{2})\.(csv|jsonl|geoparquet)$/);
    if (!match) continue;

    const [, date, ext] = match;
    const formatFolder = EXT_TO_FOLDER[ext];
    const gcsPath = `air_quality/hourly_with_sites/${formatFolder}/airnow_date=${date}/data.${ext}`;
    const localPath = path.join(mergedDir, filename);

    await bucket.upload(localPath, { destination: gcsPath });
    console.log(`  Uploaded: gs://${BUCKET_NAME}/${gcsPath}`);
  }
}

await uploadMergedData();
console.log('Done.');
