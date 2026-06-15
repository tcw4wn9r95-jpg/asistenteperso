import type { Prisma } from "@prisma/client";

// Prisma's InputJsonValue rejects typed-interface objects/arrays that lack a
// string index signature. Our payloads are plain JSON, so cast through unknown.
export const asJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;
