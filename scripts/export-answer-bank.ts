import "dotenv/config";
import { writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import { parseArgs } from "node:util";
import yaml from "js-yaml";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const { values } = parseArgs({
  options: {
    email: { type: "string", short: "e" },
    out: { type: "string", short: "o" },
  },
});

const email = values.email;
const out = values.out;

if (!email || !out) {
  console.error(
    "usage: bun scripts/export-answer-bank.ts --email <user-email> --out <path-to-yaml>",
  );
  process.exit(1);
}

function deserialize(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function main() {
  const user = await prisma.user.findUnique({ where: { email: email! } });
  if (!user) throw new Error(`User not found for email: ${email}`);

  const profile = await prisma.profile.findFirst({
    where: { userId: user.id },
    include: { sections: true },
  });
  if (!profile) throw new Error(`No profile for user ${email}`);

  const bank: Record<string, unknown> = {};
  for (const s of profile.sections) {
    bank[s.key] = deserialize(s.value);
  }

  const yamlStr = yaml.dump(bank, {
    lineWidth: 100,
    quotingType: "'",
    forceQuotes: false,
  });

  mkdirSync(dirname(out!), { recursive: true });
  writeFileSync(out!, yamlStr, "utf8");
  console.log(`Wrote ${profile.sections.length} sections to ${out}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
