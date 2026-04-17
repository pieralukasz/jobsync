import prisma from "@/lib/db";
import { authenticatePat, jsonResponse } from "@/lib/auth/pat";

interface CreateJobBody {
  jobUrl?: string;
  company: string;
  position: string;
  location?: string;
  country?: string;
  salaryRange?: string;
  description?: string;
  jobType?: string;
  source?: string;
  status?: string;
  applied?: boolean;
  appliedDate?: string;
  matchScore?: number;
  notes?: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

async function upsertCompany(userId: string, label: string) {
  const value = slugify(label);
  return prisma.company.upsert({
    where: { value_createdBy: { value, createdBy: userId } },
    create: { label, value, createdBy: userId },
    update: { label },
  });
}

async function upsertJobTitle(userId: string, label: string) {
  const value = slugify(label);
  return prisma.jobTitle.upsert({
    where: { value_createdBy: { value, createdBy: userId } },
    create: { label, value, createdBy: userId },
    update: { label },
  });
}

async function upsertLocation(
  userId: string,
  label: string,
  country?: string,
) {
  const value = slugify(label);
  return prisma.location.upsert({
    where: { value_createdBy: { value, createdBy: userId } },
    create: { label, value, country, createdBy: userId },
    update: { label, country },
  });
}

async function upsertJobSource(userId: string, label: string) {
  const value = slugify(label);
  return prisma.jobSource.upsert({
    where: { value_createdBy: { value, createdBy: userId } },
    create: { label, value, createdBy: userId },
    update: { label },
  });
}

async function resolveStatus(statusValue: string) {
  return prisma.jobStatus.findUnique({ where: { value: statusValue } });
}

export async function GET(req: Request) {
  const auth = await authenticatePat(req, "jobs:read");
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 500);
  const status = url.searchParams.get("status");

  const jobs = await prisma.job.findMany({
    where: {
      userId: auth.userId,
      ...(status ? { Status: { value: status } } : {}),
    },
    select: {
      id: true,
      jobUrl: true,
      jobType: true,
      createdAt: true,
      applied: true,
      appliedDate: true,
      salaryRange: true,
      matchScore: true,
      description: true,
      Status: { select: { value: true, label: true } },
      JobTitle: { select: { label: true, value: true } },
      Company: { select: { label: true, value: true } },
      Location: { select: { label: true, country: true } },
      JobSource: { select: { label: true, value: true } },
      Resume: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return jsonResponse({ jobs });
}

export async function POST(req: Request) {
  const auth = await authenticatePat(req, "jobs:write");
  if (auth instanceof Response) return auth;

  let body: CreateJobBody;
  try {
    body = (await req.json()) as CreateJobBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!body.company || !body.position) {
    return jsonResponse(
      { error: "company and position are required" },
      400,
    );
  }

  const [company, jobTitle, status] = await Promise.all([
    upsertCompany(auth.userId, body.company),
    upsertJobTitle(auth.userId, body.position),
    resolveStatus(body.status ?? (body.applied ? "applied" : "draft")),
  ]);

  if (!status) {
    return jsonResponse({ error: `Unknown status: ${body.status}` }, 400);
  }

  const location = body.location
    ? await upsertLocation(auth.userId, body.location, body.country)
    : null;

  const source = body.source
    ? await upsertJobSource(auth.userId, body.source)
    : null;

  const applied = body.applied ?? false;
  const appliedDate = body.appliedDate
    ? new Date(body.appliedDate)
    : applied
      ? new Date()
      : null;

  const job = await prisma.job.create({
    data: {
      userId: auth.userId,
      jobUrl: body.jobUrl,
      description: body.description ?? "",
      jobType: body.jobType ?? "Full Time",
      createdAt: new Date(),
      applied,
      appliedDate: appliedDate ?? undefined,
      statusId: status.id,
      jobTitleId: jobTitle.id,
      companyId: company.id,
      jobSourceId: source?.id,
      salaryRange: body.salaryRange,
      locationId: location?.id,
      matchScore: body.matchScore,
    },
  });

  if (body.notes?.trim()) {
    await prisma.note.create({
      data: {
        jobId: job.id,
        userId: auth.userId,
        content: body.notes.trim(),
      },
    });
  }

  return jsonResponse({ id: job.id, job }, 201);
}
