import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
const prisma = new PrismaClient();
await prisma.user.upsert({ where: { username: "user1" }, update: {}, create: { username: "user1" } });
await prisma.user.upsert({ where: { username: "user2" }, update: {}, create: { username: "user2" } });
const count = await prisma.bet.count({ where: { deletedAt: null } });
if (count === 0) {
    await prisma.bet.create({
        data: {
            id: randomUUID(),
            teams: "Aston Villa vs Real Madrid",
            betType: "Draw",
            odds: 3.5,
            stake: 50,
            currency: "EUR",
            matchTime: new Date("2026-02-08T20:00:00Z"),
            uploadedBy: "user1",
            confidence: "high",
            notes: "Seed sample",
        },
    });
}
await prisma.$disconnect();
console.log("Seed completed");
