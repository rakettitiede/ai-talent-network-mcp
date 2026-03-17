import { Storage } from "@google-cloud/storage";

import { GCS_BUCKET, NODE_ENV, DATABASE_NAME, DATABASE_NAME_DEVELOPMENT } from "./constants.mjs";

const storage = new Storage();

export async function loadDatabaseFromGCS() {
  if (NODE_ENV === "development" || !GCS_BUCKET) {
    console.log("🧱 Local mode — skipping GCS download");
    return;
  }

  const destination = `/tmp/${DATABASE_NAME}`;
  console.log(`☁️ Downloading database from GCS bucket: ${GCS_BUCKET}`);
  await storage.bucket(GCS_BUCKET).file(DATABASE_NAME).download({ destination });
  console.log(`✅ Database downloaded to ${destination}`);
}

export async function uploadDatabaseToGCS() {
  if (NODE_ENV === "development" || !GCS_BUCKET) {
    console.log("🧱 Local mode — skipping GCS upload");
    return;
  }

  const source = `/tmp/${DATABASE_NAME}`;
  console.log(`☁️ Uploading database to GCS bucket: ${GCS_BUCKET}`);
  await storage.bucket(GCS_BUCKET).upload(source, { destination: DATABASE_NAME });
  console.log("✅ Database uploaded to GCS");
}

export function getDatabasePath() {
  return NODE_ENV === "production" ? `/tmp/${DATABASE_NAME}` : DATABASE_NAME_DEVELOPMENT;
}

