import type { PrismaClient } from "@prisma/client";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function generateUniqueSlug(
  name: string,
  prisma: PrismaClient
): Promise<string> {
  const base = slugify(name);
  if (!base) {
    throw new Error("Name must contain at least one alphanumeric character");
  }

  const existing = await prisma.event.findUnique({ where: { slug: base } });
  if (!existing) return base;

  let suffix = 2;
  while (true) {
    const candidate = `${base}-${suffix}`;
    const found = await prisma.event.findUnique({
      where: { slug: candidate },
    });
    if (!found) return candidate;
    suffix++;
  }
}
