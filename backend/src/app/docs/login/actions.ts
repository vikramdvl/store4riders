"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const signDocsSessionToken = async (secret: string, ttlSeconds: number): Promise<string> => {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, encoder.encode(`docs:${exp}`));
  const sigHex = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${exp}.${sigHex}`;
};

export async function loginDocs(formData: FormData) {
  const password = formData.get("password");
  const validPass = process.env.DOCS_PASS;

  if (!validPass) {
    return { error: "DOCS_PASS is not configured on the server. Access Denied." };
  }

  if (password === validPass) {
    const signingSecret = process.env.JWT_ACCESS_SECRET || validPass;
    const ttlSeconds = 7 * 24 * 60 * 60; // 7 days
    const sessionToken = await signDocsSessionToken(signingSecret, ttlSeconds);

    const cookieStore = await cookies();
    cookieStore.set("docs_auth_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: ttlSeconds,
      path: "/",
    });

    // Redirect back to the docs dashboard
    redirect("/docs");
  }

  return { error: "Incorrect Password! Access Denied." };
}
