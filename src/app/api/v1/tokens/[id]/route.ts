import prisma from "@/lib/db";
import { getCurrentUser } from "@/utils/user.utils";
import { jsonResponse } from "@/lib/auth/pat";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return jsonResponse({ error: "Not authenticated" }, 401);

  const { id } = await params;
  const token = await prisma.personalAccessToken.findUnique({
    where: { id },
    select: { userId: true, revokedAt: true },
  });
  if (!token || token.userId !== user.id) {
    return jsonResponse({ error: "Not found" }, 404);
  }
  if (token.revokedAt) {
    return jsonResponse({ error: "Already revoked" }, 409);
  }

  await prisma.personalAccessToken.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
  return jsonResponse({ success: true });
}
