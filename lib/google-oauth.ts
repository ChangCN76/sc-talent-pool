import crypto from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const GOOGLE_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
] as const;

const CONNECTION_ID = "00000000-0000-0000-0000-000000000001";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type StoredGoogleConnection = {
  id: string;
  provider: string;
  provider_account_email: string;
  scopes: string[];
  access_token_ciphertext: string;
  refresh_token_ciphertext: string | null;
  expires_at: string | null;
  connected_at: string;
  updated_at: string;
};

export type GoogleConnectionStatus = {
  connected: boolean;
  email: string | null;
  scopes: string[];
  expiresAt: string | null;
  connectedAt: string | null;
  updatedAt: string | null;
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

function getEncryptionKey() {
  const raw = requireEnv("GOOGLE_TOKEN_ENCRYPTION_KEY");
  const base64 = Buffer.from(raw, "base64");
  if (base64.length === 32) {
    return base64;
  }

  const utf8 = Buffer.from(raw, "utf8");
  if (utf8.length === 32) {
    return utf8;
  }

  throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY must be 32 bytes as UTF-8 or base64-encoded 32 bytes.");
}

export function encryptToken(token: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptToken(ciphertext: string) {
  const [ivRaw, tagRaw, encryptedRaw] = ciphertext.split(".");
  if (!ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("Encrypted token payload is invalid.");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivRaw, "base64"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const email = userData.user?.email ?? "";

  if (userError || !email) {
    return { ok: false as const, email: null };
  }

  const { data, error } = await supabase
    .from("admin_users")
    .select("email")
    .eq("is_active", true)
    .ilike("email", email)
    .maybeSingle();

  if (error || !data) {
    return { ok: false as const, email: null };
  }

  return { ok: true as const, email };
}

export function buildGoogleAuthorizationUrl(state: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", requireEnv("GOOGLE_CLIENT_ID"));
  url.searchParams.set("redirect_uri", requireEnv("GOOGLE_REDIRECT_URI"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  return url;
}

export function createOAuthState() {
  return crypto.randomBytes(32).toString("base64url");
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = (await response.json()) as T;
  if (!response.ok) {
    throw new Error("Google OAuth request failed.");
  }
  return data;
}

export async function exchangeCodeForTokens(code: string) {
  const body = new URLSearchParams({
    code,
    client_id: requireEnv("GOOGLE_CLIENT_ID"),
    client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
    redirect_uri: requireEnv("GOOGLE_REDIRECT_URI"),
    grant_type: "authorization_code",
  });

  const tokens = await fetchJson<GoogleTokenResponse>(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!tokens.access_token) {
    throw new Error("Google did not return an access token.");
  }

  return tokens;
}

export async function getGoogleAccountEmail(accessToken: string) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error("Could not verify Google account email.");
  }

  const profile = (await response.json()) as { email?: string; email_verified?: boolean };
  if (!profile.email || profile.email_verified === false) {
    throw new Error("Google account email is not verified.");
  }
  return profile.email;
}

export async function upsertGoogleConnection(params: {
  providerAccountEmail: string;
  tokens: GoogleTokenResponse;
}) {
  const service = createServiceRoleClient();
  const expiresAt = params.tokens.expires_in
    ? new Date(Date.now() + params.tokens.expires_in * 1000).toISOString()
    : null;

  const { error } = await service.from("google_oauth_connections").upsert({
    id: CONNECTION_ID,
    provider: "google",
    provider_account_email: params.providerAccountEmail,
    scopes: GOOGLE_SCOPES,
    access_token_ciphertext: encryptToken(params.tokens.access_token!),
    refresh_token_ciphertext: params.tokens.refresh_token ? encryptToken(params.tokens.refresh_token) : null,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error("Could not store Google OAuth connection.");
  }
}

export async function getGoogleConnectionStatus(): Promise<GoogleConnectionStatus> {
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("google_oauth_connections")
    .select("provider_account_email,scopes,expires_at,connected_at,updated_at")
    .eq("id", CONNECTION_ID)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load Google OAuth status.");
  }

  if (!data) {
    return { connected: false, email: null, scopes: [], expiresAt: null, connectedAt: null, updatedAt: null };
  }

  return {
    connected: true,
    email: data.provider_account_email,
    scopes: data.scopes ?? [],
    expiresAt: data.expires_at,
    connectedAt: data.connected_at,
    updatedAt: data.updated_at,
  };
}

async function getStoredConnection() {
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("google_oauth_connections")
    .select("*")
    .eq("id", CONNECTION_ID)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load Google OAuth connection.");
  }
  return data as StoredGoogleConnection | null;
}

export async function getFreshGoogleAccessToken() {
  const connection = await getStoredConnection();
  if (!connection) {
    throw new Error("Google Workspace is not connected.");
  }

  const expiresAt = connection.expires_at ? new Date(connection.expires_at).getTime() : 0;
  if (expiresAt > Date.now() + 60_000) {
    return decryptToken(connection.access_token_ciphertext);
  }

  if (!connection.refresh_token_ciphertext) {
    throw new Error("Google refresh token is not available; reconnect Google Workspace.");
  }

  const refreshToken = decryptToken(connection.refresh_token_ciphertext);
  const tokens = await fetchJson<GoogleTokenResponse>(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!tokens.access_token) {
    throw new Error("Google did not return a refreshed access token.");
  }

  const service = createServiceRoleClient();
  const expiresAtIso = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : connection.expires_at;

  const { error } = await service
    .from("google_oauth_connections")
    .update({
      access_token_ciphertext: encryptToken(tokens.access_token),
      expires_at: expiresAtIso,
      updated_at: new Date().toISOString(),
    })
    .eq("id", CONNECTION_ID);

  if (error) {
    throw new Error("Could not store refreshed Google access token.");
  }

  return tokens.access_token;
}

export async function disconnectGoogleConnection() {
  const service = createServiceRoleClient();
  const connection = await getStoredConnection();

  if (connection) {
    const tokenToRevoke = connection.refresh_token_ciphertext
      ? decryptToken(connection.refresh_token_ciphertext)
      : decryptToken(connection.access_token_ciphertext);

    try {
      await fetch(GOOGLE_REVOKE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: tokenToRevoke }),
      });
    } catch {
      // Continue with local disconnect even if Google's revocation endpoint is unreachable.
    }
  }

  const { error } = await service.from("google_oauth_connections").delete().eq("id", CONNECTION_ID);
  if (error) {
    throw new Error("Could not remove Google OAuth connection.");
  }
}

export function assertAllowedGoogleEmail(email: string) {
  const allowedEmail = requireEnv("GOOGLE_ALLOWED_EMAIL");
  if (email !== allowedEmail) {
    throw new Error("Connected Google account is not allowed for this application.");
  }
}
