import type { BusinessData, InventoryItem, Receivable } from "./types";

export const calculationAsOf = "2026-09-19T09:30:00.000Z";
export const formatInr = (value: number) => `₹${value.toLocaleString("en-IN")}`;
export const sumMoney = <T>(items: T[], amount: (item: T) => number) =>
  items.reduce((sum, item) => sum + amount(item), 0);

export interface InventoryRisk {
  item: InventoryItem;
  dailyVelocity: number;
  daysRemaining: number | null;
}

export function calculateBusinessSnapshot(data: BusinessData) {
  const revenue = data.payments
    .filter((payment) => payment.status === "captured")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const expectedSettlements = data.settlements
    .filter((settlement) => settlement.status === "pending")
    .reduce((sum, settlement) => sum + settlement.amount, 0);
  const supplierObligations = data.suppliers
    .filter((supplier) => supplier.paymentStatus === "due")
    .reduce((sum, supplier) => sum + supplier.amountDue, 0);
  const upcomingExpenses = data.expenses
    .filter((expense) => expense.status === "due")
    .reduce((sum, expense) => sum + expense.amount, 0);
  const inventoryValue = data.inventory.reduce((sum, item) => sum + item.stock * item.unitCost, 0);
  const outstandingReceivables = data.receivables
    .filter((receivable) => receivable.status !== "paid")
    .reduce((sum, receivable) => sum + receivable.amount, 0);
  const overdueReceivables = data.receivables
    .filter((receivable) => receivable.status === "overdue")
    .reduce((sum, receivable) => sum + receivable.amount, 0);
  const projectedBuffer = data.availableCash + expectedSettlements - supplierObligations - upcomingExpenses;

  return {
    revenue,
    availableCash: data.availableCash,
    expectedSettlements,
    supplierObligations,
    upcomingExpenses,
    inventoryValue,
    outstandingReceivables,
    overdueReceivables,
    projectedBuffer,
    pendingSettlementCount: data.settlements.filter((settlement) => settlement.status === "pending").length,
    supplierObligationCount: data.suppliers.filter((supplier) => supplier.paymentStatus === "due").length,
    upcomingExpenseCount: data.expenses.filter((expense) => expense.status === "due").length,
    overdueReceivableCount: data.receivables.filter((receivable) => receivable.status === "overdue").length,
  };
}

export function calculatePurchasePosition(data: BusinessData, purchaseAmount: number) {
  const snapshot = calculateBusinessSnapshot(data);
  return {
    ...snapshot,
    purchaseAmount,
    projectedBufferAfterPurchase: snapshot.projectedBuffer - purchaseAmount,
  };
}

export function calculateInventoryRisks(data: BusinessData): InventoryRisk[] {
  const orderTimes = data.orders.map((order) => Date.parse(order.createdAt)).filter(Number.isFinite);
  const oldestOrderTime = orderTimes.length > 0 ? Math.min(...orderTimes) : Date.parse(calculationAsOf);
  const activeDays = Math.max(1, Math.ceil((Date.parse(calculationAsOf) - oldestOrderTime) / 86_400_000));
  const soldByProduct = new Map<string, number>();
  for (const order of data.orders.filter((order) => order.status === "fulfilled")) {
    for (const item of order.items) {
      soldByProduct.set(item.productId, (soldByProduct.get(item.productId) ?? 0) + item.quantity);
    }
  }

  return data.inventory
    .map((item) => {
      const product = data.products.find((candidate) => candidate.sku === item.sku);
      const dailyVelocity = product ? (soldByProduct.get(product.productId) ?? 0) / activeDays : 0;
      const daysRemaining = dailyVelocity > 0 ? item.stock / dailyVelocity : null;
      return { item, dailyVelocity, daysRemaining };
    })
    .filter(({ item, daysRemaining }) =>
      item.stock <= item.reorderLevel || (daysRemaining !== null && daysRemaining < item.leadTimeDays))
    .sort((a, b) => {
      const aCoverage = a.daysRemaining ?? Number.POSITIVE_INFINITY;
      const bCoverage = b.daysRemaining ?? Number.POSITIVE_INFINITY;
      return aCoverage - bCoverage || a.item.stock - b.item.stock;
    });
}

export function getPriorityReceivables(data: BusinessData, limit = 5): Receivable[] {
  return [...data.receivables]
    .filter((receivable) => receivable.status !== "paid")
    .sort((a, b) => {
      if (a.status === "overdue" && b.status !== "overdue") return -1;
      if (a.status !== "overdue" && b.status === "overdue") return 1;
      return b.amount - a.amount;
    })
    .slice(0, limit);
}

export function getBusinessRecordCounts(data: BusinessData) {
  const sources = [
    { id: "payments", name: "Payments", recordCount: data.payments.length, source: "Workbook", active: data.payments.length > 0 },
    { id: "refunds", name: "Refunds", recordCount: data.refunds.length, source: "Workbook", active: data.refunds.length > 0 },
    { id: "settlements", name: "Settlements", recordCount: data.settlements.length, source: "Workbook", active: data.settlements.length > 0 },
    { id: "payouts", name: "Payouts", recordCount: data.payouts.length, source: "Workbook", active: data.payouts.length > 0 },
    { id: "disputes", name: "Disputes", recordCount: data.disputes.length, source: "Workbook", active: data.disputes.length > 0 },
    { id: "customers", name: "Customers", recordCount: data.customers.length, source: "Workbook", active: data.customers.length > 0 },
    { id: "products", name: "Products", recordCount: data.products.length, source: "Workbook", active: data.products.length > 0 },
    { id: "orders", name: "Orders", recordCount: data.orders.length, source: "Workbook", active: data.orders.length > 0 },
    { id: "inventory", name: "Inventory", recordCount: data.inventory.length, source: "Workbook", active: data.inventory.length > 0 },
    { id: "expenses", name: "Expenses", recordCount: data.expenses.length, source: "Workbook", active: data.expenses.length > 0 },
    { id: "suppliers", name: "Suppliers", recordCount: data.suppliers.length, source: "Workbook", active: data.suppliers.length > 0 },
    { id: "receivables", name: "Receivables", recordCount: data.receivables.length, source: "Workbook", active: data.receivables.length > 0 },
    { id: "support", name: "Support", recordCount: data.tickets.length, source: "Workbook", active: data.tickets.length > 0 },
  ];
  return {
    sources,
    totalRecords: sources.reduce((sum, source) => sum + source.recordCount, 0),
  };
}