import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { isPasswordStrongEnough } from "../src/utils/password";

// Operator tool for setting a user's password.
//
// The application has no self-service password change yet, so this is currently
// the only way to rotate one — including recovering an account whose password
// was lost. It runs with database credentials, not through the API, so it is
// deliberately explicit about weakening the policy rather than doing it quietly.
//
//   npm run set-password -- --email voce@dominio.com --password 'NovaSenha123'
//
// Every existing session is revoked: a password change that leaves old refresh
// tokens working is not really a password change.

const prisma = new PrismaClient();

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(`--${flag}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email")?.toLowerCase().trim();
  const password = arg("password");
  const allowWeak = process.argv.includes("--allow-weak");

  if (!email || !password) {
    console.error("Uso: npm run set-password -- --email voce@dominio.com --password 'NovaSenha123'");
    console.error("     Acrescente --allow-weak para aceitar uma senha fora da politica do app.");
    process.exit(1);
  }

  if (!isPasswordStrongEnough(password)) {
    const detail = [
      password.length < 10 ? "menos de 10 caracteres" : null,
      !/[a-z]/.test(password) ? "sem letra minuscula" : null,
      !/[A-Z]/.test(password) ? "sem letra maiuscula" : null,
      !/\d/.test(password) ? "sem digito" : null,
    ]
      .filter(Boolean)
      .join(", ");

    if (!allowWeak) {
      console.error(`Senha fora da politica (${detail}).`);
      console.error("Escolha outra, ou repita com --allow-weak se for uma decisao consciente.");
      process.exit(1);
    }
    console.warn(`AVISO: senha fora da politica do app (${detail}). Aplicando mesmo assim (--allow-weak).`);
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true } });
  if (!user) {
    console.error(`Nenhum usuario com o e-mail ${email}.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const revoked = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      // Clearing the lockout counters matters when the reason for the reset was
      // somebody locking themselves out.
      data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
    });

    const { count } = await tx.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        action: "user.password.reset",
        userId: user.id,
        details: JSON.stringify({ via: "set-password script", revokedSessions: count }),
      },
    });

    return count;
  });

  console.log("");
  console.log(`Senha alterada para ${user.name} <${user.email}>.`);
  console.log(`Sessoes anteriores revogadas: ${revoked}.`);
  console.log("Registrado no AuditLog como user.password.reset.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
