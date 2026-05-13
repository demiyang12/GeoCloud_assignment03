/**
 * Script to extract AirNow data files for a range of dates.
 *
 * Downloads hourly air quality observation data and monitoring site location
 * data from EPA's AirNow program. Files are saved into a date-organized
 * folder structure under data/raw/.
 *
 * Usage:
 *     node scripts/01_extract.mjs
 */

import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '..', 'data');

const BASE_URL = 'https://s3-us-west-1.amazonaws.com/files.airnowtech.org/airnow';

async function downloadFile(url, destPath) {
  try {
    await fs.access(destPath);
    return; // already downloaded, skip
  } catch {}

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(destPath, buffer);
  console.log(`  Downloaded: ${path.basename(destPath)}`);
}

async function downloadDataForDate(dateStr) {
  const [year, month, day] = dateStr.split('-');
  const compact = `${year}${month}${day}`;
  const dateUrl = `${BASE_URL}/${year}/${compact}`;
  const destDir = path.join(DATA_DIR, 'raw', dateStr);

  await fs.mkdir(destDir, { recursive: true });

  // Download 24 hourly files (hours 00–23)
  for (let hour = 0; hour < 24; hour++) {
    const hourStr = String(hour).padStart(2, '0');
    const filename = `HourlyData_${compact}${hourStr}.dat`;
    await downloadFile(`${dateUrl}/${filename}`, path.join(destDir, filename));
  }

  // Download site locations file
  const sitesFilename = 'Monitoring_Site_Locations_V2.dat';
  await downloadFile(`${dateUrl}/${sitesFilename}`, path.join(destDir, sitesFilename));
}

// Download data for every day in July 2024
const startDate = new Date('2024-07-01');
const endDate = new Date('2024-07-31');

let currentDate = startDate;
while (currentDate <= endDate) {
  const dateStr = currentDate.toISOString().split('T')[0];
  console.log(`Downloading data for ${dateStr}...`);
  await downloadDataForDate(dateStr);
  currentDate.setDate(currentDate.getDate() + 1);
}

console.log('Done.');
