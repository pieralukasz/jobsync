import "server-only";

import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import prisma from "@/lib/db";

export const PAT_PREFIX = "jsk_";
const TOKEN_BYTES = 32;
const BCRYPT_COST = 10;

export type PatScope =
  | "profile:read"
  | "profile:write"
  | "jobs:read"
  | "jobs:write"
  | "cv:write";

export const ALL_SCOPES: PatScope[] = [
  "profile:read",
  "profile:write",
  "jobs:read",
  "jobs:write",
  "cv:write",
];

export interface ResolvedPat {
  userId: string;
  tokenId: string;
  scopes: PatScope[];
}

export function generateToken(): string {
  return `${PAT_PREFIX}${randomBytes(TOKEN_BYTES).toString("hex")}`;
}

export async function hashToken(token: string): Promise<string> {
  return bcrypt.hash(token, BCRYPT_COST);
}

export async function resolvePat(token: string): Promise<ResolvedPat | null> {
  if (!token.startsWith(PAT_PREFIX)) return null;

  const last8 = token.slice(-8);
  const candidates = await prisma.personalAccessToken.findMany({
    where: {
      last8,
      revokedAt: null,
    },
    select: {
      id: true,
      userId: true,
      tokenHash: true,
      scopes: true,
    },
  });

  for (const candidate of candidates) {
    const match = await bcrypt.compare(token, candidate.tokenHash);
    if (match) {
      await prisma.personalAccessToken.update({
        where: { id: candidate.id },
        data: { lastUsedAt: new Date() },
      });
      return {
        userId: candidate.userId,
        tokenId: candidate.id,
        scopes: JSON.parse(candidate.scopes) as PatScope[],
      };
    }
  }
  return null;
}

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

export async function authenticatePat(
  req: Request,
  requiredScope: PatScope,
): Promise<ResolvedPat | Response> {
  const token = extractBearerToken(req);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Missing Bearer token" }),
      { status: 401, headers: { "content-type": "application/json" } },
    );
  }
  const resolved = await resolvePat(token);
  if (!resolved) {
    return new Response(
      JSON.stringify({ error: "Invalid or revoked token" }),
      { status: 401, headers: { "content-type": "application/json" } },
    );
  }
  if (!resolved.scopes.includes(requiredScope)) {
    return new Response(
      JSON.stringify({ error: `Token missing required scope: ${requiredScope}` }),
      { status: 403, headers: { "content-type": "application/json" } },
    );
  }
  return resolved;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
