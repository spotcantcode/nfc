import { requireAdmin } from "@/lib/auth";
import { failure, HttpError, json } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { publicId } from "@/lib/validation";
import { scanHistory } from "@/lib/tags";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin();
    await rateLimit(`read:${user.id}`, 120, 60);
    const id = publicId.safeParse((await context.params).id);
    if (!id.success) throw new HttpError(404, "Tag not found.");
    const page = Math.max(
      1,
      Math.min(10000, Math.floor(Number(new URL(request.url).searchParams.get("page")) || 1)),
    );
    return json(await scanHistory(id.data, page));
  } catch (error) {
    return failure(error);
  }
}
