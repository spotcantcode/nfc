import "server-only";
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
export const noStore = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
};
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: noStore });
}
export function failure(error: unknown) {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  // Never return provider errors, SQL, tokens, or request bodies to the client/logs.
  console.error("NFC operation failed", error instanceof Error ? error.name : "UnknownError");
  return json({ error: "Something went wrong. Please try again shortly." }, 503);
}
export function checkOrigin(request: Request) {
  if (request.headers.get("origin") !== config().adminUrl)
    throw new HttpError(403, "Please submit this request from the app.");
}
export async function body(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "Send JSON data.");
  if (Number(request.headers.get("content-length")) > 8192)
    throw new HttpError(413, "Request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Missing request body.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 8192) {
        await reader.cancel();
        throw new HttpError(413, "Request is too large.");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Invalid JSON data.");
  }
}
