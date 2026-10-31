import { requireAdmin } from "@/lib/auth";
import { body, checkOrigin, failure, HttpError, json } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { tagInput } from "@/lib/validation";
import { publicDestination } from "@/lib/destination";
import { createTag, listTags } from "@/lib/tags";
export async function GET(request: Request) {
  try {
    const user = await requireAdmin();
    await rateLimit(`read:${user.id}`, 120, 60);
    const params = new URL(request.url).searchParams;
    return json(
      await listTags(
        Math.min(10000, Math.max(1, Math.floor(Number(params.get("page")) || 1))),
        (params.get("q") ?? "").slice(0, 100),
        params.get("status") ?? "all",
        params.get("sort") ?? "created_at",
        params.get("direction") ?? "desc",
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    const user = await requireAdmin();
    checkOrigin(request);
    await rateLimit(`write:${user.id}`, 60, 60);
    const input = tagInput.safeParse(await body(request));
    if (!input.success) throw new HttpError(400, input.error.issues[0].message);
    try {
      input.data.destination_url = await publicDestination(input.data.destination_url);
    } catch (error) {
      throw new HttpError(400, (error as Error).message);
    }
    return json({ tag: await createTag(input.data) }, 201);
  } catch (error) {
    return failure(error);
  }
}
