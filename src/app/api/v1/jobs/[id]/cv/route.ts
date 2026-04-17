import path from "path";
import prisma from "@/lib/db";
import { authenticatePat, jsonResponse } from "@/lib/auth/pat";
import { uploadFile } from "@/actions/profile.actions";
import { getTimestampedFileName } from "@/lib/utils";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticatePat(req, "cv:write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job || job.userId !== auth.userId) {
    return jsonResponse({ error: "Not found" }, 404);
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const title = (formData.get("title") as string | null) ?? `CV for job ${id}`;

  if (!file || !file.name) {
    return jsonResponse({ error: "file is required" }, 400);
  }

  const dataPath = process.env.NODE_ENV !== "production" ? "data" : "/data";
  const uploadDir = path.join(dataPath, "files", "resumes");
  const storedName = getTimestampedFileName(file.name);
  const filePath = path.join(uploadDir, storedName);

  await uploadFile(file, uploadDir, filePath);

  const fileRecord = await prisma.file.create({
    data: {
      fileName: file.name,
      filePath,
      fileType: "resume",
    },
  });

  let profile = await prisma.profile.findFirst({
    where: { userId: auth.userId },
  });
  if (!profile) {
    profile = await prisma.profile.create({
      data: { userId: auth.userId },
    });
  }

  const resume = await prisma.resume.create({
    data: {
      profileId: profile.id,
      title,
      FileId: fileRecord.id,
    },
  });

  await prisma.job.update({
    where: { id },
    data: { resumeId: resume.id },
  });

  return jsonResponse(
    {
      resumeId: resume.id,
      fileId: fileRecord.id,
      fileName: file.name,
      filePath,
    },
    201,
  );
}
