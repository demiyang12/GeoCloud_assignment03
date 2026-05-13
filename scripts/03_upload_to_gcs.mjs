/**
 * Script to upload prepared data files to Google Cloud Storage (GCS).
 *
 * Uploads the contents of data/prepared/ to a GCS bucket, preserving
 * the folder structure under the prefix air_quality/.
 *
 * Prerequisites:
 *     gcloud auth application-default login
 *
 * Usage:
 *     node scripts/03_upload_to_gcs.mjs
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

async function uploadPreparedData() {
  const storage = new Storage({ projectId: PROJECT_ID });
  const bucket = storage.bucket(BUCKET_NAME);

  // Create bucket if it doesn't exist yet
  const [exists] = await bucket.exists();
  if (!exists) {
    await bucket.create({ location: 'US' });
    console.log(`Created bucket: gs://${BUCKET_NAME}`);
  }

  // Recursively upload every file under data/prepared/
  async function uploadDir(localDir, gcsPrefix) {
    const entries = await fs.readdir(localDir, { withFileTypes: true });
    for (const entry of entries) {
      const localPath = path.join(localDir, entry.name);
      const gcsPath = `${gcsPrefix}/${entry.name}`;
      if (entry.isDirectory()) {
        await uploadDir(localPath, gcsPath);
      } else {
        await bucket.upload(localPath, { destination: gcsPath });
        console.log(`  Uploaded: gs://${BUCKET_NAME}/${gcsPath}`);
      }
    }
  }

  const preparedDir = path.join(DATA_DIR, 'prepared');
  await uploadDir(preparedDir, 'air_quality');
}

await uploadPreparedData();
console.log('Done.');
