import { Router } from "express";
import { prisma } from "../config/prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { monthKey, lastNMonths } from "../utils/dateBuckets";

const router = Router();

router.use(requireAuth);

// Every query below filters by req.user.orgId — this is what keeps one
// company's data from ever being visible to another (tenant isolation).

router.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const orgId = req.user!.orgId;
    const months = lastNMonths(2); // current + previous month
    const [current, previous] = months;

    const startCurrent = new Date(current.year, current.month - 1, 1);
    const startNext = new Date(current.year, current.month, 1);
    const startPrev = new Date(previous.year, previous.month - 1, 1);

    const [salesCurrent, salesPrev, expensesCurrent, customers, activeCustomers, churnedThisMonth] = await Promise.all([
      prisma.sale.aggregate({ where: { organizationId: orgId, soldAt: { gte: startCurrent, lt: startNext }, status: "completed" }, _sum: { amount: true }, _count: true }),
      prisma.sale.aggregate({ where: { organizationId: orgId, soldAt: { gte: startPrev, lt: startCurrent }, status: "completed" }, _sum: { amount: true } }),
      prisma.expense.aggregate({ where: { organizationId: orgId, incurredAt: { gte: startCurrent, lt: startNext } }, _sum: { amount: true } }),
      prisma.customer.count({ where: { organizationId: orgId } }),
      prisma.customer.count({ where: { organizationId: orgId, status: "active" } }),
      prisma.customer.count({ where: { organizationId: orgId, status: "churned", churnedAt: { gte: startCurrent, lt: startNext } } }),
    ]);

    const revenueCurrent = salesCurrent._sum.amount ?? 0;
    const revenuePrev = salesPrev._sum.amount ?? 0;
    const revenueGrowthPct = revenuePrev > 0 ? ((revenueCurrent - revenuePrev) / revenuePrev) * 100 : 0;
    const expensesTotal = expensesCurrent._sum.amount ?? 0;

    const target = await prisma.revenueTarget.findUnique({
      where: { organizationId_month_year: { organizationId: orgId, month: current.month, year: current.year } },
    });

    res.json({
      revenue: { current: revenueCurrent, growthPct: Number(revenueGrowthPct.toFixed(1)), target: target?.targetAmount ?? null },
      salesCount: salesCurrent._count,
      expenses: expensesTotal,
      netCashFlow: revenueCurrent - expensesTotal,
      customers: { total: customers, active: activeCustomers, churnedThisMonth },
    });
  })
);

router.get(
  "/sales",
  asyncHandler(async (req, res) => {
    const orgId = req.user!.orgId;
    const months = lastNMonths(12);
    const rangeStart = new Date(months[0].year, months[0].month - 1, 1);

    const [sales, targets, byProduct, byRegion] = await Promise.all([
      prisma.sale.findMany({
        where: { organizationId: orgId, soldAt: { gte: rangeStart }, status: "completed" },
        select: { amount: true, soldAt: true },
      }),
      prisma.revenueTarget.findMany({ where: { organizationId: orgId } }),
      prisma.sale.groupBy({
        by: ["productId"],
        where: { organizationId: orgId, soldAt: { gte: rangeStart }, status: "completed" },
        _sum: { amount: true },
      }),
      prisma.sale.groupBy({
        by: ["region"],
        where: { organizationId: orgId, soldAt: { gte: rangeStart }, status: "completed" },
        _sum: { amount: true },
      }),
    ]);

    const byMonth = new Map(months.map((m) => [m.key, { ...m, revenue: 0, target: 0 }]));
    for (const s of sales) {
      const k = monthKey(s.soldAt);
      const bucket = byMonth.get(k);
      if (bucket) bucket.revenue += s.amount;
    }
    for (const t of targets) {
      const k = `${t.year}-${String(t.month).padStart(2, "0")}`;
      const bucket = byMonth.get(k);
      if (bucket) bucket.target = t.targetAmount;
    }

    const products = await prisma.product.findMany({ where: { organizationId: orgId } });
    const productMap = new Map(products.map((p) => [p.id, p.name]));

    res.json({
      revenueOverTime: Array.from(byMonth.values()).map((b) => ({ month: b.label, revenue: Math.round(b.revenue), target: Math.round(b.target) })),
      byProduct: byProduct
        .map((p) => ({ product: productMap.get(p.productId) ?? "Outro", revenue: Math.round(p._sum.amount ?? 0) }))
        .sort((a, b) => b.revenue - a.revenue),
      byRegion: byRegion
        .map((r) => ({ region: r.region ?? "Outro", revenue: Math.round(r._sum.amount ?? 0) }))
        .sort((a, b) => b.revenue - a.revenue),
    });
  })
);

router.get(
  "/customers",
  asyncHandler(async (req, res) => {
    const orgId = req.user!.orgId;
    const months = lastNMonths(12);
    const rangeStart = new Date(months[0].year, months[0].month - 1, 1);

    const [customers, allCustomers] = await Promise.all([
      prisma.customer.findMany({ where: { organizationId: orgId, acquiredAt: { gte: rangeStart } }, select: { acquiredAt: true } }),
      prisma.customer.findMany({ where: { organizationId: orgId } }),
    ]);

    const acquiredByMonth = new Map(months.map((m) => [m.key, { ...m, acquired: 0 }]));
    for (const c of customers) {
      const bucket = acquiredByMonth.get(monthKey(c.acquiredAt));
      if (bucket) bucket.acquired += 1;
    }

    const churnedByMonth = new Map(months.map((m) => [m.key, { ...m, churned: 0 }]));
    for (const c of allCustomers) {
      if (c.churnedAt) {
        const bucket = churnedByMonth.get(monthKey(c.churnedAt));
        if (bucket) bucket.churned += 1;
      }
    }

    const segmentCounts = new Map<string, number>();
    for (const c of allCustomers) {
      segmentCounts.set(c.segment, (segmentCounts.get(c.segment) ?? 0) + 1);
    }

    const topCustomers = [...allCustomers]
      .sort((a, b) => b.lifetimeValue - a.lifetimeValue)
      .slice(0, 8)
      .map((c) => ({ id: c.id, name: c.name, segment: c.segment, lifetimeValue: Math.round(c.lifetimeValue), status: c.status }));

    const activeCount = allCustomers.filter((c) => c.status === "active").length;
    const churnedCount = allCustomers.filter((c) => c.status === "churned").length;
    const churnRatePct = allCustomers.length > 0 ? (churnedCount / allCustomers.length) * 100 : 0;
    const avgLtv = allCustomers.length > 0 ? allCustomers.reduce((s, c) => s + c.lifetimeValue, 0) / allCustomers.length : 0;

    res.json({
      acquisitionOverTime: Array.from(acquiredByMonth.values()).map((b, i) => ({
        month: b.label,
        acquired: b.acquired,
        churned: Array.from(churnedByMonth.values())[i]?.churned ?? 0,
      })),
      bySegment: Array.from(segmentCounts.entries()).map(([segment, count]) => ({ segment, count })),
      topCustomers,
      summary: {
        total: allCustomers.length,
        active: activeCount,
        churned: churnedCount,
        churnRatePct: Number(churnRatePct.toFixed(1)),
        avgLtv: Math.round(avgLtv),
      },
    });
  })
);

router.get(
  "/financial",
  asyncHandler(async (req, res) => {
    const orgId = req.user!.orgId;
    const months = lastNMonths(12);
    const rangeStart = new Date(months[0].year, months[0].month - 1, 1);

    const [sales, expenses] = await Promise.all([
      prisma.sale.findMany({ where: { organizationId: orgId, soldAt: { gte: rangeStart }, status: "completed" }, select: { amount: true, soldAt: true } }),
      prisma.expense.findMany({ where: { organizationId: orgId, incurredAt: { gte: rangeStart } }, select: { amount: true, incurredAt: true, category: true } }),
    ]);

    const byMonth = new Map(months.map((m) => [m.key, { ...m, revenue: 0, expenses: 0 }]));
    for (const s of sales) {
      const b = byMonth.get(monthKey(s.soldAt));
      if (b) b.revenue += s.amount;
    }
    for (const e of expenses) {
      const b = byMonth.get(monthKey(e.incurredAt));
      if (b) b.expenses += e.amount;
    }

    const categoryTotals = new Map<string, number>();
    for (const e of expenses) {
      categoryTotals.set(e.category, (categoryTotals.get(e.category) ?? 0) + e.amount);
    }

    const totalRevenue = sales.reduce((s, x) => s + x.amount, 0);
    const totalExpenses = expenses.reduce((s, x) => s + x.amount, 0);
    const grossMarginPct = totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0;

    res.json({
      cashFlowOverTime: Array.from(byMonth.values()).map((b) => ({
        month: b.label,
        revenue: Math.round(b.revenue),
        expenses: Math.round(b.expenses),
        net: Math.round(b.revenue - b.expenses),
      })),
      expensesByCategory: Array.from(categoryTotals.entries())
        .map(([category, amount]) => ({ category, amount: Math.round(amount) }))
        .sort((a, b) => b.amount - a.amount),
      summary: {
        totalRevenue: Math.round(totalRevenue),
        totalExpenses: Math.round(totalExpenses),
        grossMarginPct: Number(grossMarginPct.toFixed(1)),
      },
    });
  })
);

export default router;
