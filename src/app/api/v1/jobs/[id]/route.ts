import prisma from "@/lib/db";
import { authenticatePat, jsonResponse } from "@/lib/auth/pat";

interface UpdateJobBody {
  status?: string;
  applied?: boolean;
  appliedDate?: string | null;
  matchScore?: number | null;
  matchData?: string | null;
  notes?: string;
  salaryRange?: string;
  description?: string;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticatePat(req, "jobs:read");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      Status: { select: { value: true, label: true } },
      JobTitle: true,
      Company: true,
      Location: true,
      JobSource: true,
      Resume: true,
      Notes: { select: { id: true, content: true, createdAt: true } },
      tags: { select: { id: true, label: true, value: true } },
    },
  });
  if (!job || job.userId !== auth.userId) {
    return jsonResponse({ error: "Not found" }, 404);
  }
  return jsonResponse({ job });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticatePat(req, "jobs:write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const existing = await prisma.job.findUnique({ where: { id } });
  if (!existing || existing.userId !== auth.userId) {
    return jsonResponse({ error: "Not found" }, 404);
  }

  let body: UpdateJobBody;
  try {
    body = (await req.json()) as UpdateJobBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const data: Record<string, unknown> = {};

  if (body.status !== undefined) {
    const status = await prisma.jobStatus.findUnique({
      where: { value: body.status },
    });
    if (!status) {
      return jsonResponse({ error: `Unknown status: ${body.status}` }, 400);
    }
    data.statusId = status.id;
  }

  if (body.applied !== undefined) data.applied = body.applied;
  if (body.appliedDate !== undefined) {
    data.appliedDate = body.appliedDate ? new Date(body.appliedDate) : null;
  }
  if (body.matchScore !== undefined) data.matchScore = body.matchScore;
  if (body.matchData !== undefined) data.matchData = body.matchData;
  if (body.salaryRange !== undefined) data.salaryRange = body.salaryRange;
  if (body.description !== undefined) data.description = body.description;

  const job = await prisma.job.update({ where: { id }, data });

  if (body.notes?.trim()) {
    await prisma.note.create({
      data: {
        jobId: id,
        userId: auth.userId,
        content: body.notes.trim(),
      },
    });
  }

  return jsonResponse({ job });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticatePat(req, "jobs:write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const existing = await prisma.job.findUnique({ where: { id } });
  if (!existing || existing.userId !== auth.userId) {
    return jsonResponse({ error: "Not found" }, 404);
  }

  await prisma.job.delete({ where: { id } });
  return jsonResponse({ success: true });
}
