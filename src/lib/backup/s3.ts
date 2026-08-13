import { createHash, createHmac } from "node:crypto";

/**
 * S3-MOS SAQLAGICH (H-6) — Cloudflare R2 / Backblaze B2 / AWS S3.
 *
 * SDK'siz: kerak bo'lgani atigi PUT/GET/DELETE/LIST — AWS SigV4 imzosi bilan
 * oddiy `fetch`. (Loyihada Vercel Blob va Claude API ham shu uslubda.)
 *
 * Env:
 *   BACKUP_S3_ENDPOINT — masalan https://<account>.r2.cloudflarestorage.com
 *   BACKUP_S3_BUCKET   — bucket nomi
 *   BACKUP_S3_KEY_ID   — access key id
 *   BACKUP_S3_SECRET   — secret access key
 *   BACKUP_S3_REGION   — ixtiyoriy (standart "auto" — R2 uchun shu)
 */

interface S3Sozlama {
  endpoint: string;
  bucket: string;
  keyId: string;
  secret: string;
  region: string;
}

export function s3Sozlama(): S3Sozlama | null {
  const endpoint = process.env.BACKUP_S3_ENDPOINT;
  const bucket = process.env.BACKUP_S3_BUCKET;
  const keyId = process.env.BACKUP_S3_KEY_ID;
  const secret = process.env.BACKUP_S3_SECRET;
  if (!endpoint || !bucket || !keyId || !secret) return null;
  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    bucket,
    keyId,
    secret,
    region: process.env.BACKUP_S3_REGION || "auto",
  };
}

export function s3Sozlangan(): boolean {
  return s3Sozlama() !== null;
}

const sha256hex = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
const hmac = (key: Buffer | string, data: string) => createHmac("sha256", key).update(data, "utf8").digest();

/** AWS SigV4 imzoli so'rov (path-style: <endpoint>/<bucket>/<kalit>). */
async function s3Sorov(params: {
  method: "PUT" | "GET" | "DELETE";
  kalit: string;
  query?: string;
  body?: Buffer;
  contentType?: string;
  fetchImpl?: typeof fetch;
}): Promise<Response> {
  const cfg = s3Sozlama();
  if (!cfg) throw new Error("S3 saqlagich sozlanmagan (BACKUP_S3_* env'lar)");

  const url = new URL(`${cfg.endpoint}/${cfg.bucket}/${params.kalit}${params.query ? `?${params.query}` : ""}`);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); // 20260813T120000Z
  const sana = amzDate.slice(0, 8);
  const payloadHash = sha256hex(params.body ?? Buffer.alloc(0));

  const headerlar: Record<string, string> = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...(params.contentType ? { "content-type": params.contentType } : {}),
  };
  const imzolangan = Object.keys(headerlar).sort();
  const canonicalHeaders = imzolangan.map((h) => `${h}:${headerlar[h]}\n`).join("");
  const signedHeaders = imzolangan.join(";");

  // Query kanonik ko'rinishda (kalit bo'yicha saralangan) bo'lishi shart.
  const canonicalQuery = [...url.searchParams.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const canonicalRequest = [
    params.method,
    url.pathname.split("/").map(encodeURIComponent).join("/"),
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${sana}/${cfg.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256hex(canonicalRequest)].join("\n");

  const kSana = hmac(`AWS4${cfg.secret}`, sana);
  const kRegion = hmac(kSana, cfg.region);
  const kServis = hmac(kRegion, "s3");
  const kImzo = hmac(kServis, "aws4_request");
  const imzo = createHmac("sha256", kImzo).update(stringToSign, "utf8").digest("hex");

  const f = params.fetchImpl ?? fetch;
  return f(url.toString(), {
    method: params.method,
    headers: {
      ...headerlar,
      authorization:
        `AWS4-HMAC-SHA256 Credential=${cfg.keyId}/${scope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${imzo}`,
    },
    body: params.body as unknown as BodyInit | undefined,
  });
}

export async function s3Yukla(kalit: string, mazmun: Buffer, contentType = "application/octet-stream"): Promise<void> {
  const res = await s3Sorov({ method: "PUT", kalit, body: mazmun, contentType });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`S3 yuklash yiqildi (${res.status}): ${t.slice(0, 200)}`);
  }
}

export async function s3Ochir(kalit: string): Promise<void> {
  const res = await s3Sorov({ method: "DELETE", kalit });
  // 204 — o'chirildi; 404 ham OK (allaqachon yo'q).
  if (!res.ok && res.status !== 404) {
    throw new Error(`S3 o'chirish yiqildi (${res.status})`);
  }
}

/** Prefiks bo'yicha obyekt kalitlari (ListObjectsV2, minimal XML tahlil). */
export async function s3Royxat(prefiks: string): Promise<string[]> {
  const res = await s3Sorov({
    method: "GET",
    kalit: "",
    query: `list-type=2&prefix=${encodeURIComponent(prefiks)}`,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`S3 ro'yxat yiqildi (${res.status}): ${t.slice(0, 200)}`);
  }
  const xml = await res.text();
  const kalitlar: string[] = [];
  const re = /<Key>([^<]+)<\/Key>/g;
  for (let m = re.exec(xml); m; m = re.exec(xml)) kalitlar.push(m[1]);
  return kalitlar;
}
