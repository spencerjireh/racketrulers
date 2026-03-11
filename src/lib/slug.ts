import type { PrismaClient } from "@prisma/client";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function generateUniqueSlugFor(
  name: string,
  exists: (slug: string) => Promise<boolean>
): Promise<string> {
  const base = slugify(name);
  if (!base) {
    throw new Error("Name must contain at least one alphanumeric character");
  }

  if (!(await exists(base))) return base;

  let suffix = 2;
  while (true) {
    const candidate = `${base}-${suffix}`;
    if (!(await exists(candidate))) return candidate;
    suffix++;
  }
}

export async function generateUniqueSlug(
  name: string,
  prisma: PrismaClient
): Promise<string> {
  return generateUniqueSlugFor(name, (slug) =>
    prisma.tournament.findUnique({ where: { slug } }).then(Boolean)
  );
}

export async function generateUniqueCoachSlug(
  name: string,
  prisma: PrismaClient
): Promise<string> {
  return generateUniqueSlugFor(name, (slug) =>
    prisma.coachProfile.findUnique({ where: { slug } }).then(Boolean)
  );
}
