// lib/gmail.ts
import { google } from "googleapis";
import { supabaseServer } from "./supabase-server";

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } =
  process.env;

const SCOPES = ["https://www.googleapis.com/auth/gmail.modify"];

export function getOAuthClient() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

export function generateAuthUrl(state: string) {
  const oauth2Client = getOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export async function upsertGmailAccountFromTokens(tokens: any) {
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials(tokens);

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  const profile = await gmail.users.getProfile({ userId: "me" });
  const email = profile.data.emailAddress!;

  const { access_token, refresh_token, expiry_date } = tokens;

  const { data, error } = await supabaseServer
    .from("gmail_accounts")
    .upsert(
      {
        email,
        access_token,
        refresh_token,
        expiry_date,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getOAuthClientForAccount(gmailAccountId: string) {
  const { data, error } = await supabaseServer
    .from("gmail_accounts")
    .select("*")
    .eq("id", gmailAccountId)
    .single();

  if (error || !data) throw error || new Error("Account not found");

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiry_date: data.expiry_date,
  });

  return { oauth2Client, account: data };
}

export async function listAllGmailAccounts() {
  const { data, error } = await supabaseServer
    .from("gmail_accounts")
    .select("*");

  if (error) throw error;
  return data || [];
}

export function gmailFromAuth(auth: any) {
  return google.gmail({ version: "v1", auth });
}

export async function listRecentInboxMessages(
  gmail: ReturnType<typeof gmailFromAuth>,
  lookbackDays = 1
) {
  const query = `in:inbox newer_than:${lookbackDays}d -category:chats`;
  const res = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: 50,
  });
  return res.data.messages || [];
}

export async function getMessage(
  gmail: ReturnType<typeof gmailFromAuth>,
  id: string
) {
  const res = await gmail.users.messages.get({
    userId: "me",
    id,
    format: "full",
  });
  return res.data;
}

export function getHeader(headers: any[], name: string, fallback = "") {
  const h = headers.find(
    (h) => h.name?.toLowerCase() === name.toLowerCase()
  );
  return h?.value ?? fallback;
}

export function decodeBody(msg: any): string {
  const payload = msg.payload || {};

  function* walkParts(part: any): any {
    if (part.parts) {
      for (const p of part.parts) yield* walkParts(p);
    } else {
      yield part;
    }
  }

  const parts = [...walkParts(payload)];
  for (const part of parts) {
    const mimeType = part.mimeType || "";
    const data = part.body?.data;
    if (!data) continue;
    const text = Buffer.from(data, "base64").toString("utf-8");
    if (mimeType.startsWith("text/plain")) return text;
  }

  const data = payload.body?.data;
  if (data) return Buffer.from(data, "base64").toString("utf-8");
  return "";
}

export async function ensureLabels(
  gmail: ReturnType<typeof gmailFromAuth>,
  labelNames: string[]
) {
  const res = await gmail.users.labels.list({ userId: "me" });
  const existing = res.data.labels || [];
  const nameToId: Record<string, string> = {};

  for (const lbl of existing) {
    if (lbl.name && lbl.id) {
      nameToId[lbl.name] = lbl.id;
    }
  }

  for (const name of labelNames) {
    if (!nameToId[name]) {
      const created = await gmail.users.labels.create({
        userId: "me",
        requestBody: {
          name,
          labelListVisibility: "labelShow",
          messageListVisibility: "show",
        },
      });
      if (created.data.id) {
        nameToId[name] = created.data.id;
      }
    }
  }

  return nameToId;
}

export async function modifyMessageLabels(
  gmail: ReturnType<typeof gmailFromAuth>,
  msgId: string,
  addLabelIds: string[]
) {
  await gmail.users.messages.modify({
    userId: "me",
    id: msgId,
    requestBody: {
      addLabelIds,
      removeLabelIds: [],
    },
  });
}

export async function createDraftReply(
  gmail: ReturnType<typeof gmailFromAuth>,
  originalMsg: any,
  replyText: string
) {
  const headers = originalMsg.payload.headers || [];
  const subject = getHeader(headers, "Subject", "(no subject)");
  const fromAddr = getHeader(headers, "From");
  const replyTo = getHeader(headers, "Reply-To", fromAddr);

  const replySubject = subject.toLowerCase().startsWith("re:")
    ? subject
    : `Re: ${subject}`;

  const raw = [`To: ${replyTo}`, `Subject: ${replySubject}`, "", replyText].join(
    "\r\n"
  );

  const encoded = Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const draft = await gmail.users.drafts.create({
    userId: "me",
    requestBody: {
      message: {
        raw: encoded,
        threadId: originalMsg.threadId,
      },
    },
  });

  return draft.data;
}

export async function sendEmail(
  gmail: ReturnType<typeof gmailFromAuth>,
  to: string,
  subject: string,
  body: string
) {
  const raw = [`To: ${to}`, `Subject: ${subject}`, "", body].join("\r\n");

  const encoded = Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encoded,
    },
  });

  return res.data;
}

export async function getGmailSignature(oauthClient: any) {
  const gmail = google.gmail({ version: "v1", auth: oauthClient });

  const res = await gmail.users.settings.sendAs.list({
    userId: "me",
  });

  // Find the primary "send as" profile
  const primaryProfile = res.data.sendAs?.find(
    (profile) => profile.isPrimary === true
  );

  return primaryProfile?.signature || "";
}