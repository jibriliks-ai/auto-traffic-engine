import { createSign } from "crypto";

type ServiceAccount = { client_email: string; private_key: string };

export type GoogleIndexingResult = {
  url: string;
  ok: boolean;
  status: number;
  detail: string;
};

function b64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/indexing",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(sa.private_key);
  const jwt = `${signingInput}.${b64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
    signal: AbortSignal.timeout(10000),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      data.error_description ?? data.error ?? `Google OAuth error ${res.status}`
    );
  }
  return data.access_token as string;
}

/**
 * Submit URLs to Google Indexing API.
 * Requires the service account to be added as an Owner in Google Search Console
 * for the target domain, and the Indexing API enabled in Google Cloud.
 */
export async function submitToGoogle(urls: string[]): Promise<GoogleIndexingResult[]> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured.");
  }

  let sa: ServiceAccount;
  try {
    sa = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.");
  }
  if (!sa.client_email || !sa.private_key) {
    throw new Error("Service account JSON is missing client_email or private_key.");
  }

  const token = await getAccessToken(sa);

  const results: GoogleIndexingResult[] = [];
  for (const url of urls) {
    try {
      const res = await fetch(
        "https://indexing.googleapis.com/v3/urlNotifications:publish",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ url, type: "URL_UPDATED" }),
          signal: AbortSignal.timeout(10000),
        }
      );
      const data = await res.json().catch(() => ({}));
      results.push({
        url,
        ok: res.ok,
        status: res.status,
        detail: res.ok
          ? "Submitted"
          : (data.error?.message ?? `HTTP ${res.status}`),
      });
    } catch (e: any) {
      results.push({ url, ok: false, status: 0, detail: e.message ?? "Request failed" });
    }
  }
  return results;
}