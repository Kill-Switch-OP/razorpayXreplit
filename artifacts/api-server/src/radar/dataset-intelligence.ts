import type { BusinessData } from "./types";
import { calculateBusinessSnapshot, formatInr, sumMoney } from "./calculations";

export interface DatasetMetric {
  label: string;
  value: string;
}

export interface DatasetSummary {
  id: string;
  name: string;
  status: string;
  description: string;
  recordCount: number;
  source: string;
  active: boolean;
  lastImported: string | null;
  metrics: DatasetMetric[];
}

const percentage = (part: number, whole: number) => whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "Unavailable";
const money = (items: Array<{ amount: number }>) => sumMoney(items, (item) => item.amount);

export function buildDatasetSummaries(data: BusinessData, importedAt: string | null) {
  const captured = data.payments.filter((item) => item.status === "captured");
  const failed = data.payments.filter((item) => item.status === "failed");
  const reversed = data.payments.filter((item) => item.status === "reversed");
  const pendingRefunds = data.refunds.filter((item) => item.status === "pending");
  const settled = data.settlements.filter((item) => item.status === "settled");
  const pendingSettlements = data.settlements.filter((item) => item.status === "pending");
  const unmatchedSettlements = data.settlements.filter((item) => !data.payments.some((payment) => payment.paymentId === item.paymentId));
  const processedPayouts = data.payouts.filter((item) => item.status === "processed");
  const pendingPayouts = data.payouts.filter((item) => item.status === "pending");
  const openDisputes = data.disputes.filter((item) => item.status === "open");
  const repeatCustomers = new Set(
    data.orders
      .map((order) => order.customerId)
      .filter((id, _, ids) => ids.filter((candidate) => candidate === id).length > 1),
  );
  const fulfilled = data.orders.filter((item) => item.status === "fulfilled");
  const cancelled = data.orders.filter((item) => item.status === "cancelled");
  const dueExpenses = data.expenses.filter((item) => item.status === "due");
  const paidExpenses = data.expenses.filter((item) => item.status === "paid");
  const dueSuppliers = data.suppliers.filter((item) => item.paymentStatus === "due");
  const overdue = data.receivables.filter((item) => item.status === "overdue");
  const outstanding = data.receivables.filter((item) => item.status !== "paid");
  const openTickets = data.tickets.filter((item) => item.status === "open");
  const lowStock = data.inventory.filter((item) => item.stock <= item.reorderLevel);
  const snapshot = calculateBusinessSnapshot(data);

  const summary = (
    id: string,
    name: string,
    description: string,
    recordCount: number,
    metrics: DatasetMetric[],
  ): DatasetSummary => ({
    id,
    name,
    status: recordCount > 0 ? "recognized" : "unavailable",
    description,
    recordCount,
    source: recordCount > 0 ? "Workbook" : "Not imported",
    active: recordCount > 0,
    lastImported: recordCount > 0 ? importedAt : null,
    metrics,
  });

  const razorpay = [
    summary("payments", "Payments", "Captured, failed and reversed payment records", data.payments.length, [
      { label: "Total value", value: formatInr(money(data.payments)) },
      { label: "Captured value", value: formatInr(money(captured)) },
      { label: "Failed value", value: formatInr(money(failed)) },
      { label: "Reversed value", value: formatInr(money(reversed)) },
      { label: "Success rate", value: percentage(captured.length, data.payments.length) },
      { label: "Average ticket", value: data.payments.length ? formatInr(money(data.payments) / data.payments.length) : "Unavailable" },
    ]),
    summary("refunds", "Refunds", "Processed and pending refunds", data.refunds.length, [
      { label: "Total value", value: formatInr(money(data.refunds)) },
      { label: "Pending refunds", value: String(pendingRefunds.length) },
      { label: "Refund rate", value: percentage(money(data.refunds), money(captured)) },
    ]),
    summary("settlements", "Settlements", "Settlement records linked to captured payments", data.settlements.length, [
      { label: "Settled value", value: formatInr(money(settled)) },
      { label: "Pending value", value: formatInr(money(pendingSettlements)) },
      { label: "Unmatched", value: String(unmatchedSettlements.length) },
    ]),
    summary("payouts", "Payouts", "Processed and pending payouts", data.payouts.length, [
      { label: "Processed value", value: formatInr(money(processedPayouts)) },
      { label: "Pending value", value: formatInr(money(pendingPayouts)) },
      { label: "Pending count", value: String(pendingPayouts.length) },
    ]),
    summary("disputes", "Disputes", "Open and resolved payment disputes", data.disputes.length, [
      { label: "Disputed value", value: formatInr(money(data.disputes)) },
      { label: "Open disputes", value: String(openDisputes.length) },
    ]),
  ];

  const business = [
    summary("customers", "Customers", "Customer master records", data.customers.length, [
      { label: "Customers", value: String(data.customers.length) },
      { label: "Repeat customers", value: String(repeatCustomers.size) },
    ]),
    summary("products", "Products", "Product and SKU catalog", data.products.length, [
      { label: "Products", value: String(data.products.length) },
      { label: "Categories", value: String(new Set(data.products.map((item) => item.category).filter(Boolean)).size) },
    ]),
    summary("orders", "Orders", "Sales and fulfillment records", data.orders.length, [
      { label: "GMV", value: formatInr(money(data.orders)) },
      { label: "Average order", value: data.orders.length ? formatInr(money(data.orders) / data.orders.length) : "Unavailable" },
      { label: "Fulfillment rate", value: percentage(fulfilled.length, data.orders.length) },
      { label: "Cancellation rate", value: percentage(cancelled.length, data.orders.length) },
    ]),
    summary("inventory", "Inventory", "Stock and replenishment data", data.inventory.length, [
      { label: "Inventory value", value: formatInr(snapshot.inventoryValue) },
      { label: "Low-stock products", value: String(lowStock.length) },
    ]),
    summary("expenses", "Expenses", "Paid and upcoming operating expenses", data.expenses.length, [
      { label: "Due expenses", value: formatInr(sumMoney(dueExpenses, (item) => item.amount)) },
      { label: "Paid expenses", value: formatInr(sumMoney(paidExpenses, (item) => item.amount)) },
    ]),
    summary("suppliers", "Suppliers", "Supplier obligations and lead times", data.suppliers.length, [
      { label: "Amount due", value: formatInr(sumMoney(dueSuppliers, (item) => item.amountDue)) },
      { label: "Suppliers due", value: String(dueSuppliers.length) },
    ]),
    summary("receivables", "Receivables", "Outstanding and overdue customer balances", data.receivables.length, [
      { label: "Outstanding", value: formatInr(sumMoney(outstanding, (item) => item.amount)) },
      { label: "Overdue", value: formatInr(sumMoney(overdue, (item) => item.amount)) },
      { label: "Overdue count", value: String(overdue.length) },
    ]),
    summary("support", "Support", "Customer support tickets and complaint categories", data.tickets.length, [
      { label: "Tickets", value: String(data.tickets.length) },
      { label: "Open tickets", value: String(openTickets.length) },
    ]),
  ];
  return { razorpay, business };
}

export function suggestedPrompts(data: BusinessData) {
  const prompts: string[] = [];
  if (data.settlements.length && (data.expenses.length || data.suppliers.length)) prompts.push("What's putting cash under pressure?");
  if (data.inventory.length && data.orders.length) prompts.push("What should I restock first?", "Which products could stock out?");
  if (data.receivables.length) prompts.push("Who should I chase today?", "How much is overdue?");
  if (data.payments.length && data.settlements.length) prompts.push("Why is settlement value lower than payment value?");
  if (data.refunds.length) prompts.push("Are refunds becoming a problem?");
  if (prompts.length > 0) prompts.push("What needs my attention today?");
  return [...new Set(prompts)].slice(0, 6);
}