import { neon } from "npm:@neondatabase/serverless@1.2.0";
import { drizzle } from "npm:drizzle-orm@0.45.3/neon-http";
import { pgTable, text, timestamp, uuid } from "npm:drizzle-orm@0.45.3/pg-core";

// This schema belongs to the external Neon database, not Lovable Cloud.
export const conexaoTeste = pgTable("conexao_teste", {
  id: uuid("id").defaultRandom().primaryKey(),
  nome: text("nome").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export function getNeonDb() {
  const url = Deno.env.get("DATABASE_URL");
  if (!url) throw new Error("DATABASE_URL não está configurada");
  return drizzle(neon(url), { schema: { conexaoTeste } });
}