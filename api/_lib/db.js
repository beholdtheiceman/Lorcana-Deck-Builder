import { PrismaClient } from "@prisma/client";

const g = globalThis;

export const prisma = g.__prisma || new PrismaClient();

if (!g.__prisma) g.__prisma = prisma;
