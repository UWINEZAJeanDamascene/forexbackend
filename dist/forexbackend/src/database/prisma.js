"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const env_1 = require("../config/env");
function cleanDatabaseUrl(url) {
    try {
        const u = new URL(url);
        if (u.searchParams.has('channel_binding')) {
            u.searchParams.delete('channel_binding');
        }
        return u.toString();
    }
    catch {
        return url;
    }
}
function createPrismaClient() {
    if (!env_1.env.databaseUrl) {
        throw new Error('DATABASE_URL is not set. Analysis history requires a PostgreSQL database.');
    }
    const adapter = new adapter_pg_1.PrismaPg({ connectionString: cleanDatabaseUrl(env_1.env.databaseUrl) });
    return new client_1.PrismaClient({ adapter });
}
const prisma = createPrismaClient();
exports.prisma = prisma;
//# sourceMappingURL=prisma.js.map