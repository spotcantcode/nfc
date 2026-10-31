import "server-only";
import { adminDb } from "@/lib/supabase/admin";
import { HttpError } from "@/lib/http";
import { generateId } from "@/lib/ids";
import type { Tag, Stats, Scan } from "@/lib/types";
import type { z } from "zod";
import type { tagInput } from "@/lib/validation";
export async function listTags(
  page = 1,
  search = "",
  status = "all",
  sort = "created_at",
  direction = "desc",
) {
  const db = adminDb();
  const allowed = ["created_at", "name", "scan_count", "last_scanned_at", "updated_at"];
  let query = db.from("nfc").select("*", { count: "exact" });
  if (search) query = query.ilike("name", `%${search.replace(/[\\%_]/g, "\\$&")}%`);
  if (status === "active" || status === "disabled") query = query.eq("active", status === "active");
  const { data, count, error } = await query
    .order(allowed.includes(sort) ? sort : "created_at", {
      ascending: direction === "asc",
      nullsFirst: false,
    })
    .order("id")
    .range((page - 1) * 20, page * 20 - 1);
  if (error) throw error;
  return { tags: data as Tag[], count: count ?? 0 };
}
export async function stats() {
  const { data, error } = await adminDb().rpc("nfc_stats");
  if (error) throw error;
  return data as Stats;
}
export async function createTag(input: z.infer<typeof tagInput>) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await adminDb()
      .from("nfc")
      .insert({ ...input, id: generateId() })
      .select()
      .single();
    if (!error) return data as Tag;
    if (error.code !== "23505") throw error;
  }
  throw new Error("Could not reserve tag identifier");
}
export async function updateTag(id: string, input: z.infer<typeof tagInput>) {
  const { data, error } = await adminDb()
    .from("nfc")
    .update(input)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "Tag not found.");
  return data as Tag;
}
export async function deleteTag(id: string) {
  const { data, error } = await adminDb()
    .from("nfc")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "Tag not found.");
}
export async function scanHistory(tagId?: string, page = 1) {
  let query = adminDb()
    .from("nfc_scan_events")
    .select("id,tag_id,scanned_at,tags:nfc(name)", { count: "exact" });
  if (tagId) query = query.eq("tag_id", tagId);
  const { data, count, error } = await query
    .order("scanned_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * 30, page * 30 - 1);
  if (error) throw error;
  return { scans: data as unknown as Scan[], count: count ?? 0 };
}
