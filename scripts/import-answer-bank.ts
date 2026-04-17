import "dotenv/config";
import { readFileSync } from "fs";
import { parseArgs } from "node:util";
import yaml from "js-yaml";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const { values } = parseArgs({
  options: {
    email: { type: "string", short: "e" },
    file: { type: "string", short: "f" },
  },
});

const email = values.email;
const file = values.file;

if (!email || !file) {
  console.error(
    "usage: bun scripts/import-answer-bank.ts --email <user-email> --file <path-to-yaml>",
  );
  process.exit(1);
}

async function main() {
  const raw = readFileSync(file!, "utf8");
  const parsed = yaml.load(raw) as Record<string, unknown>;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("YAML did not parse into an object");
  }

  const user = await prisma.user.findUnique({ where: { email: email! } });
  if (!user) {
    throw new Error(
      `User not found for email: ${email}. Sign up first via the UI.`,
    );
  }

  let profile = await prisma.profile.findFirst({ where: { userId: user.id } });
  if (!profile) {
    profile = await prisma.profile.create({ data: { userId: user.id } });
    console.log(`Created Profile ${profile.id} for ${email}`);
  }

  const sections = Object.entries(parsed);
  let written = 0;
  for (const [key, value] of sections) {
    const serialized =
      typeof value === "string" ? value : JSON.stringify(value);
    await prisma.profileSection.upsert({
      where: { profileId_key: { profileId: profile.id, key } },
      create: { profileId: profile.id, key, value: serialized },
      update: { value: serialized },
    });
    written += 1;
    console.log(`  upsert ProfileSection "${key}"`);
  }
  console.log(`\nImported ${written} sections into profile ${profile.id}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
