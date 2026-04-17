import prisma from "@/lib/db";
import { authenticatePat, jsonResponse } from "@/lib/auth/pat";

export async function GET(req: Request) {
  const auth = await authenticatePat(req, "profile:read");
  if (auth instanceof Response) return auth;

  const profiles = await prisma.profile.findMany({
    where: { userId: auth.userId },
    select: {
      id: true,
      sections: {
        select: { key: true, value: true },
      },
      resumes: {
        select: {
          id: true,
          title: true,
          createdAt: true,
          ContactInfo: {
            select: {
              firstName: true,
              lastName: true,
              headline: true,
              email: true,
              phone: true,
              address: true,
            },
          },
        },
      },
    },
  });

  const questions = await prisma.question.findMany({
    where: { createdBy: auth.userId },
    select: {
      id: true,
      question: true,
      answer: true,
      tags: { select: { label: true, value: true } },
    },
  });

  return jsonResponse({
    userId: auth.userId,
    profiles: profiles.map((p) => ({
      id: p.id,
      sections: Object.fromEntries(
        p.sections.map((s) => [s.key, safeParseJson(s.value)]),
      ),
      resumes: p.resumes,
    })),
    questions,
  });
}

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export async function PUT(req: Request) {
  const auth = await authenticatePat(req, "profile:write");
  if (auth instanceof Response) return auth;

  let body: { sections?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!body.sections || typeof body.sections !== "object") {
    return jsonResponse({ error: "sections object is required" }, 400);
  }

  let profile = await prisma.profile.findFirst({
    where: { userId: auth.userId },
  });
  if (!profile) {
    profile = await prisma.profile.create({
      data: { userId: auth.userId },
    });
  }

  const updates = Object.entries(body.sections);
  for (const [key, value] of updates) {
    const serialized =
      typeof value === "string" ? value : JSON.stringify(value);
    await prisma.profileSection.upsert({
      where: {
        profileId_key: { profileId: profile.id, key },
      },
      create: { profileId: profile.id, key, value: serialized },
      update: { value: serialized },
    });
  }

  return jsonResponse({ success: true, updated: updates.length });
}
