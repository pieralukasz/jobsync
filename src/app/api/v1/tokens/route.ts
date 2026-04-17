import prisma from "@/lib/db";
import { getCurrentUser } from "@/utils/user.utils";
import {
  ALL_SCOPES,
  PatScope,
  generateToken,
  hashToken,
  jsonResponse,
} from "@/lib/auth/pat";

interface CreateTokenBody {
  name?: string;
  scopes?: string[];
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonResponse({ error: "Not authenticated" }, 401);

  const tokens = await prisma.personalAccessToken.findMany({
    where: { userId: user.id, revokedAt: null },
    select: {
      id: true,
      name: true,
      last8: true,
      scopes: true,
      createdAt: true,
      lastUsedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return jsonResponse({
    tokens: tokens.map((t) => ({ ...t, scopes: JSON.parse(t.scopes) })),
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonResponse({ error: "Not authenticated" }, 401);

  let body: CreateTokenBody;
  try {
    body = (await req.json()) as CreateTokenBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const name = body.name?.trim();
  if (!name) return jsonResponse({ error: "name is required" }, 400);

  const requestedScopes = body.scopes ?? [...ALL_SCOPES];
  const invalid = requestedScopes.filter(
    (s) => !ALL_SCOPES.includes(s as PatScope),
  );
  if (invalid.length > 0) {
    return jsonResponse(
      { error: `Invalid scopes: ${invalid.join(", ")}` },
      400,
    );
  }

  const plainToken = generateToken();
  const tokenHash = await hashToken(plainToken);
  const last8 = plainToken.slice(-8);

  const record = await prisma.personalAccessToken.create({
    data: {
      userId: user.id,
      name,
      tokenHash,
      last8,
      scopes: JSON.stringify(requestedScopes),
    },
    select: {
      id: true,
      name: true,
      last8: true,
      scopes: true,
      createdAt: true,
    },
  });

  return jsonResponse(
    {
      ...record,
      scopes: JSON.parse(record.scopes),
      token: plainToken,
      warning: "Copy this token now. It will not be shown again.",
    },
    201,
  );
}
