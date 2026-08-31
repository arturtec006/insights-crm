export interface OverviewData {
  revenue: { current: number; growthPct: number; target: number | null };
  salesCount: number;
  expenses: number;
  netCashFlow: number;
  customers: { total: number; active: number; churnedThisMonth: number };
}

export interface SalesData {
  revenueOverTime: { month: string; revenue: number; target: number }[];
  byProduct: { product: string; revenue: number }[];
  byRegion: { region: string; revenue: number }[];
}

export interface CustomersData {
  acquisitionOverTime: { month: string; acquired: number; churned: number }[];
  bySegment: { segment: string; count: number }[];
  topCustomers: { id: string; name: string; segment: string; lifetimeValue: number; status: string }[];
  summary: { total: number; active: number; churned: number; churnRatePct: number; avgLtv: number };
}

export interface FinancialData {
  cashFlowOverTime: { month: string; revenue: number; expenses: number; net: number }[];
  expensesByCategory: { category: string; amount: number }[];
  summary: { totalRevenue: number; totalExpenses: number; grossMarginPct: number };
}
