import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Small deterministic PRNG so every seed run produces the same demo data.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const float = (min: number, max: number) => rand() * (max - min) + min;

const FIRST_NAMES = ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Fabio", "Gabriela", "Hugo", "Isabela", "Joao", "Larissa", "Marcos", "Natalia", "Otavio", "Paula", "Rafael", "Sofia", "Thiago", "Vanessa", "William"];
const LAST_NAMES = ["Silva", "Souza", "Oliveira", "Santos", "Pereira", "Costa", "Rodrigues", "Almeida", "Nascimento", "Carvalho"];
const COMPANY_SUFFIXES = ["Solucoes", "Comercio", "Industria", "Tecnologia", "Servicos", "Distribuidora"];
const SEGMENTS = ["Enterprise", "SMB", "Startup"];
const REGIONS = ["Sudeste", "Sul", "Nordeste", "Centro-Oeste", "Norte"];
const EXPENSE_CATEGORIES = ["Folha de Pagamento", "Marketing", "Infraestrutura", "Operacional", "Impostos", "Escritorio"];

function randomCustomerName(): string {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

function randomCompanyName(): string {
  return `${pick(LAST_NAMES)} ${pick(COMPANY_SUFFIXES)}`;
}

// Same shape as slugify() in src/prospecting/normalize.ts — kept local so the
// seed has no dependency on application code.
function slugForSeed(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function seedOrganization(name: string, slug: string) {
  const org = await prisma.organization.create({ data: { name, slug } });

  const users = [
    { name: "Admin " + name.split(" ")[0], email: `admin@${slug}.com`, role: "ADMIN" as const, password: "Admin123!Secure" },
    { name: "Gerente " + name.split(" ")[0], email: `manager@${slug}.com`, role: "MANAGER" as const, password: "Manager123!Secure" },
    { name: "Analista " + name.split(" ")[0], email: `analyst@${slug}.com`, role: "ANALYST" as const, password: "Analyst123!Secure" },
  ];

  const createdUsers = [];
  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 12);
    createdUsers.push(
      await prisma.user.create({
        data: { organizationId: org.id, name: u.name, email: u.email, role: u.role, passwordHash },
      })
    );
  }

  const products = await Promise.all(
    [
      { name: "Plano Basico", category: "Assinatura", unitPrice: 99 },
      { name: "Plano Pro", category: "Assinatura", unitPrice: 299 },
      { name: "Plano Enterprise", category: "Assinatura", unitPrice: 899 },
      { name: "Consultoria", category: "Servico", unitPrice: 1500 },
      { name: "Add-on Analytics", category: "Add-on", unitPrice: 149 },
    ].map((p) => prisma.product.create({ data: { organizationId: org.id, ...p } }))
  );

  const customerCount = int(40, 60);
  const customers = [];
  const now = new Date();
  for (let i = 0; i < customerCount; i++) {
    const acquiredMonthsAgo = int(0, 18);
    const acquiredAt = new Date(now.getFullYear(), now.getMonth() - acquiredMonthsAgo, int(1, 28));
    const isChurned = rand() < 0.15 && acquiredMonthsAgo > 1;
    const churnedAt = isChurned ? new Date(acquiredAt.getTime() + int(30, 300) * 24 * 60 * 60 * 1000) : null;

    const customer = await prisma.customer.create({
      data: {
        organizationId: org.id,
        name: randomCompanyName(),
        email: `contato@${randomCustomerName().toLowerCase().replace(" ", "")}.com`,
        segment: pick(SEGMENTS),
        status: isChurned ? "churned" : rand() < 0.05 ? "prospect" : "active",
        acquiredAt,
        churnedAt,
        region: pick(REGIONS),
        lifetimeValue: 0, // filled in after generating sales
      },
    });
    customers.push(customer);
  }

  // Sales over the last 12 months
  let totalSalesGenerated = 0;
  const ltvByCustomer = new Map<string, number>();
  for (let m = 11; m >= 0; m--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const salesThisMonth = int(25, 55);
    for (let s = 0; s < salesThisMonth; s++) {
      const customer = pick(customers.filter((c) => c.acquiredAt <= monthDate));
      if (!customer) continue;
      const product = pick(products);
      const quantity = int(1, 3);
      const amount = Math.round(product.unitPrice * quantity * float(0.9, 1.15) * 100) / 100;
      const soldAt = new Date(monthDate.getFullYear(), monthDate.getMonth(), int(1, 28));

      await prisma.sale.create({
        data: {
          organizationId: org.id,
          customerId: customer.id,
          productId: product.id,
          quantity,
          amount,
          region: customer.region,
          status: rand() < 0.04 ? "refunded" : "completed",
          soldAt,
        },
      });
      totalSalesGenerated++;
      ltvByCustomer.set(customer.id, (ltvByCustomer.get(customer.id) ?? 0) + amount);
    }
  }

  for (const [customerId, ltv] of ltvByCustomer.entries()) {
    await prisma.customer.update({ where: { id: customerId }, data: { lifetimeValue: ltv } });
  }

  // Expenses over the last 12 months
  for (let m = 11; m >= 0; m--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
    for (const category of EXPENSE_CATEGORIES) {
      const base = category === "Folha de Pagamento" ? 18000 : category === "Marketing" ? 6000 : 2500;
      await prisma.expense.create({
        data: {
          organizationId: org.id,
          category,
          description: `${category} - ${monthDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`,
          amount: Math.round(base * float(0.8, 1.3) * 100) / 100,
          incurredAt: new Date(monthDate.getFullYear(), monthDate.getMonth(), int(1, 10)),
        },
      });
    }
  }

  // Revenue targets, slightly above trailing average to be interesting
  for (let m = 11; m >= 0; m--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
    await prisma.revenueTarget.create({
      data: {
        organizationId: org.id,
        month: monthDate.getMonth() + 1,
        year: monthDate.getFullYear(),
        targetAmount: Math.round(int(35000, 55000) * 1.0),
      },
    });
  }

  // --- CRM: funil, leads e negocios ---------------------------------------
  // Every organization gets a working pipeline out of the box, otherwise the
  // board has nothing to render and opening a deal fails on first use.
  const pipeline = await prisma.pipeline.create({
    data: {
      organizationId: org.id,
      name: "Funil de vendas",
      isDefault: true,
      stages: {
        create: [
          { name: "Contato inicial", probability: 10, kind: "open", position: 0 },
          { name: "Conversa marcada", probability: 30, kind: "open", position: 1 },
          { name: "Proposta enviada", probability: 60, kind: "open", position: 2 },
          { name: "Negociacao", probability: 80, kind: "open", position: 3 },
          { name: "Ganho", probability: 100, kind: "won", position: 4 },
          { name: "Perdido", probability: 0, kind: "lost", position: 5 },
        ],
      },
    },
    include: { stages: { orderBy: { position: "asc" } } },
  });

  // A handful of demo leads so the screens are not empty before the first
  // prospecting run. These are marked source "manual" precisely so they are
  // distinguishable from anything the worker actually found.
  const leadCities = ["Sao Paulo", "Campinas", "Santo Andre", "Guarulhos", "Osasco"];
  const leadCategories = ["dentist", "gym", "hairdresser", "veterinary", "restaurant"];
  const openStages = pipeline.stages.filter((s) => s.kind === "open");

  const seededLeads = [];
  for (let i = 0; i < 24; i++) {
    const companyName = `${randomCompanyName()} ${pick(["Ltda", "ME", "Servicos"])}`;
    const city = pick(leadCities);
    const hasPhone = rand() < 0.75;
    const hasSite = rand() < 0.45;
    const hasEmail = hasSite && rand() < 0.6;

    const phone = hasPhone ? `+5511${int(90000, 99999)}${int(1000, 9999)}` : null;
    const domain = hasSite ? `${slugForSeed(companyName)}.com.br` : null;

    // Mirrors the "completeness" rubric in src/prospecting/score.ts.
    const score =
      (phone ? 30 : 0) + (hasEmail ? 25 : 0) + (domain ? 15 : 0) + (rand() < 0.4 ? 10 : 0) + 10 + 5 + 5;

    const lead = await prisma.lead.create({
      data: {
        organizationId: org.id,
        companyName,
        contactName: rand() < 0.5 ? randomCustomerName() : null,
        phone,
        phoneRaw: phone,
        email: hasEmail ? `contato@${domain}` : null,
        website: domain ? `https://${domain}` : null,
        websiteDomain: domain,
        addressLine: `Rua ${pick(LAST_NAMES)}, ${int(10, 1800)}`,
        city,
        state: "SP",
        category: pick(leadCategories),
        source: "manual",
        dedupeKey: phone ? `phone:${phone}` : domain ? `domain:${domain}` : `name:${slugForSeed(companyName)}|city:${slugForSeed(city)}`,
        score: Math.min(100, score),
        signals: JSON.stringify([{ label: "Dados de demonstracao", points: Math.min(100, score) }]),
        status: rand() < 0.25 ? "qualified" : "new",
        ownerId: rand() < 0.6 ? pick(createdUsers).id : null,
      },
    });
    seededLeads.push(lead);

    await prisma.activity.create({
      data: {
        organizationId: org.id,
        leadId: lead.id,
        type: "system",
        content: "Lead de demonstracao criado pelo seed.",
      },
    });
  }

  // Open deals for the qualified ones so the kanban has cards in it.
  let dealCount = 0;
  for (const lead of seededLeads.filter((l) => l.status === "qualified")) {
    const stage = pick(openStages);
    await prisma.deal.create({
      data: {
        organizationId: org.id,
        title: `${lead.companyName} - proposta`,
        leadId: lead.id,
        pipelineId: pipeline.id,
        stageId: stage.id,
        value: int(800, 12000),
        probability: stage.probability,
        expectedCloseAt: new Date(now.getFullYear(), now.getMonth(), int(1, 28) + 15),
        ownerId: lead.ownerId,
      },
    });
    dealCount++;
  }

  console.log(
    `Seeded org "${name}": ${customers.length} customers, ${totalSalesGenerated} sales, ` +
      `${seededLeads.length} leads, ${dealCount} deals`
  );
}

async function main() {
  console.log("Seeding database...");

  await prisma.auditLog.deleteMany();
  await prisma.refreshToken.deleteMany();
  // CRM first: activities and deals point at leads, which point at jobs.
  await prisma.activity.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.prospectJob.deleteMany();
  await prisma.pipelineStage.deleteMany();
  await prisma.pipeline.deleteMany();
  await prisma.suppressionEntry.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.revenueTarget.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  await seedOrganization("Aurora Tecnologia", "aurora");
  await seedOrganization("Nimbus Varejo", "nimbus");

  console.log("\nDemo logins (all orgs use the same password pattern):");
  console.log("  admin@aurora.com   / Admin123!Secure   (ADMIN)");
  console.log("  manager@aurora.com / Manager123!Secure (MANAGER)");
  console.log("  analyst@aurora.com / Analyst123!Secure (ANALYST)");
  console.log("  admin@nimbus.com   / Admin123!Secure   (ADMIN, separate company/tenant)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
