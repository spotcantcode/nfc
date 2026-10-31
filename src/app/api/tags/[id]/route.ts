import { requireAdmin } from "@/lib/auth";
import { body, checkOrigin, failure, HttpError, json } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { publicId, tagInput } from "@/lib/validation";
import { publicDestination } from "@/lib/destination";
import { deleteTag, updateTag } from "@/lib/tags";
type Context = { params: Promise<{ id: string }> };
async function authorize(request: Request, ctx: Context) {
  const user = await requireAdmin();
  checkOrigin(request);
  await rateLimit(`write:${user.id}`, 60, 60);
  const parsed = publicId.safeParse((await ctx.params).id);
  if (!parsed.success) throw new HttpError(404, "Tag not found.");
  return parsed.data;
}
export async function PATCH(request: Request, ctx: Context) {
  try {
    const id = await authorize(request, ctx);
    const input = tagInput.safeParse(await body(request));
    if (!input.success) throw new HttpError(400, input.error.issues[0].message);
    try {
      input.data.destination_url = await publicDestination(input.data.destination_url);
    } catch (error) {
      throw new HttpError(400, (error as Error).message);
    }
    return json({ tag: await updateTag(id, input.data) });
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: Request, ctx: Context) {
  try {
    await deleteTag(await authorize(request, ctx));
    return json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
