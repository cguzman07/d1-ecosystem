import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Storage abstraction over Supabase Storage.
 * Uses the service-role key for server-side uploads and signed URLs.
 * Public API (uploadObject, getPresignedDownloadUrl, …) stays stable for features.
 */

function getConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured");
  }
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return {
    url,
    serviceRoleKey,
    bucket: process.env.SUPABASE_STORAGE_BUCKET ?? "d1-documents",
  };
}

let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;
  const cfg = getConfig();
  client = createClient(cfg.url, cfg.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return client;
}

export function getBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET ?? "d1-documents";
}

/** Ensure the documents bucket exists (idempotent). */
export async function ensureBucketExists(): Promise<void> {
  const supabase = getSupabaseAdmin();
  const bucket = getBucket();

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw new Error(`SUPABASE_LIST_BUCKETS_FAILED: ${listError.message}`);
  }

  if (buckets?.some((b) => b.name === bucket)) {
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: 52_428_800, // 50 MB
  });

  // Concurrent create races are fine — bucket already exists
  if (createError && !/already exists/i.test(createError.message)) {
    throw new Error(`SUPABASE_CREATE_BUCKET_FAILED: ${createError.message}`);
  }
}

export async function uploadObject(params: {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType: string;
}): Promise<{ key: string }> {
  const supabase = getSupabaseAdmin();
  const bucket = getBucket();

  const body =
    typeof params.body === "string"
      ? Buffer.from(params.body)
      : Buffer.from(params.body);

  const { error } = await supabase.storage.from(bucket).upload(params.key, body, {
    contentType: params.contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(`SUPABASE_UPLOAD_FAILED: ${error.message}`);
  }

  return { key: params.key };
}

/**
 * Returns a time-limited signed download URL (same contract as former S3 presign).
 */
export async function getPresignedDownloadUrl(
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const bucket = getBucket();

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(key, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(
      `SUPABASE_SIGNED_URL_FAILED: ${error?.message ?? "missing signedUrl"}`,
    );
  }

  return data.signedUrl;
}

/** Build a storage key for an order document */
export function buildDocumentKey(orderId: string, fileName: string, version: number): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `orders/${orderId}/v${version}-${Date.now()}-${safe}`;
}
