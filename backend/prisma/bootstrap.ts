import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Production-safe alternative to `seed.ts`.
//
// The seed exists to make screens look alive during development, and it does
// that by creating accounts whose passwords are published in the README. Running
// it against a real database would hand anyone who reads the repo an admin
// login. This script instead creates exactly what a live tenant needs to work:
// one organization, one admin with a generated password, and the default
// pipeline (without which the kanban has no columns and opening a deal fails).
//
//   npm run bootstrap -- --org "Minha Empresa" --name "Fulano" --email a@b.com
//
// The generated password is printed once and never stored in clear text.

const prisma = new PrismaClient();

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(`--${flag}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

/**
 * A password the operator will paste once and then change. Base64url over 18
 * random bytes gives ~144 bits of entropy — far past anything worth guessing —
 * while staying short enough to retype if the paste goes wrong.
 */
function generatePassword(): string {
  return crypto.randomBytes(18).toString("base64url");
}

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const DEFAULT_STAGES: { name: string; probability: number; kind: string }[] = [
  { name: "Contato inicial", probability: 10, kind: "open" },
  { name: "Conversa marcada", probability: 30, kind: "open" },
  { name: "Proposta enviada", probability: 60, kind: "open" },
  { name: "Negociação", probability: 80, kind: "open" },
  { name: "Ganho", probability: 100, kind: "won" },
  { name: "Perdido", probability: 0, kind: "lost" },
];

async function main() {
  const orgName = arg("org");
  const userName = arg("name");
  const email = arg("email")?.toLowerCase().trim();

  if (!orgName || !userName || !email) {
    console.error('Uso: npm run bootstrap -- --org "Empresa" --name "Seu Nome" --email voce@dominio.com');
    process.exit(1);
  }
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) {
    console.error(`E-mail inválido: ${email}`);
    process.exit(1);
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    console.error(`Já existe um usuário com o e-mail ${email}. Nada foi alterado.`);
    process.exit(1);
  }

  const slug = slugify(orgName);
  const existingOrg = await prisma.organization.findUnique({ where: { slug } });
  if (existingOrg) {
    console.error(`Já existe uma organização com o slug "${slug}". Escolha outro nome.`);
    process.exit(1);
  }

  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, 12);

  // One transaction: an organization without its admin, or an admin without the
  // pipeline, would be a half-provisioned tenant nobody can use.
  const { org, user } = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({ data: { name: orgName, slug } });

    const user = await tx.user.create({
      data: { organizationId: org.id, name: userName, email, role: "ADMIN", passwordHash },
    });

    await tx.pipeline.create({
      data: {
        organizationId: org.id,
        name: "Funil de vendas",
        isDefault: true,
        stages: { create: DEFAULT_STAGES.map((stage, position) => ({ ...stage, position })) },
      },
    });

    return { org, user };
  });

  console.log("");
  console.log("Organização e administrador criados.");
  console.log("");
  console.log(`  Empresa : ${org.name}  (slug: ${org.slug})`);
  console.log(`  E-mail  : ${user.email}`);
  console.log(`  Senha   : ${password}`);
  console.log("");
  console.log("Essa senha não é recuperável e não fica salva em lugar nenhum.");
  console.log("Guarde agora e troque depois de entrar.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
