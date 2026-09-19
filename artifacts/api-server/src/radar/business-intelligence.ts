import type { Anomaly, BusinessData, EvidenceRecord } from "./types";
import type { Detection } from "./engine";
import {
  calculateBusinessSnapshot,
  calculateInventoryRisks,
  calculationAsOf,
  formatInr as inr,
  sumMoney,
} from "./calculations";
export { answerBusinessQuestion } from "./business-copilot";

const detectedAt = calculationAsOf;

export function getBusinessPulse(data: BusinessData) {
  const snapshot = calculateBusinessSnapshot(data);
  return {
    revenue: snapshot.revenue,
    availableCash: snapshot.availableCash,
    expectedSettlements: snapshot.expectedSettlements,
    inventoryValue: snapshot.inventoryValue,
    outstandingReceivables: snapshot.outstandingReceivables,
  };
}

const anomaly = (
  value: Omit<Anomaly, "firstDetected" | "evidenceCount">,
  evidence: EvidenceRecord[],
): Anomaly => ({ ...value, firstDetected: detectedAt, evidenceCount: evidence.length });

function cashPressure(data: BusinessData): Detection {
  const snapshot = calculateBusinessSnapshot(data);
  const evidence: EvidenceRecord[] = [
    { id: "cash-current", system: "Business Data", recordType: "Cash Position", recordId: "CASH-CURRENT", label: "Available cash", detail: inr(snapshot.availableCash), status: "current", timestamp: detectedAt, amount: snapshot.availableCash, metadata: {} },
    { id: "cash-settlements", system: "Razorpay", recordType: "Expected Settlements", recordId: "SETTLEMENTS-PENDING", label: "Expected Razorpay settlements", detail: inr(snapshot.expectedSettlements), status: "pending", timestamp: detectedAt, amount: snapshot.expectedSettlements, metadata: { records: String(snapshot.pendingSettlementCount) } },
    { id: "cash-suppliers", system: "Business Data", recordType: "Supplier Obligations", recordId: "SUPPLIERS-DUE", label: "Supplier obligations", detail: `-${inr(snapshot.supplierObligations)}`, status: "due", timestamp: detectedAt, amount: snapshot.supplierObligations, metadata: { records: String(snapshot.supplierObligationCount) } },
    { id: "cash-expenses", system: "Business Data", recordType: "Expenses", recordId: "EXPENSES-DUE", label: "Upcoming expenses", detail: `-${inr(snapshot.upcomingExpenses)}`, status: "due", timestamp: detectedAt, amount: snapshot.upcomingExpenses, metadata: { records: String(snapshot.upcomingExpenseCount) } },
    { id: "cash-buffer", system: "Business Radar", recordType: "Calculated Metric", recordId: "PROJECTED-BUFFER", label: "Projected cash buffer", detail: inr(snapshot.projectedBuffer), status: snapshot.projectedBuffer < 100_000 ? "at-risk" : "healthy", timestamp: detectedAt, amount: snapshot.projectedBuffer, metadata: {} },
  ];
  const impact = Math.max(0, -snapshot.projectedBuffer);
  return {
    anomaly: anomaly({
      id: "cash-pressure",
      type: "CASH_PRESSURE",
      title: snapshot.projectedBuffer < 0
        ? `Potential cash shortfall of ${inr(Math.abs(snapshot.projectedBuffer))}`
        : `Projected cash buffer after obligations: ${inr(snapshot.projectedBuffer)}`,
      severity: snapshot.projectedBuffer < 0 ? "HIGH" : snapshot.projectedBuffer < 200_000 ? "MEDIUM" : "LOW",
      summary: `Available cash plus expected settlements, less due supplier and expense obligations, leaves ${inr(snapshot.projectedBuffer)}.`,
      impactAmount: impact,
      affectedRecords: snapshot.supplierObligationCount + snapshot.upcomingExpenseCount,
      affectedCustomers: 0,
      systems: ["Razorpay", "Business Data"],
      recommendedAction: "Sequence supplier and expense payments against expected settlement dates before committing to a large inventory purchase.",
    }, evidence),
    evidence,
    affectedOrders: [],
    affectedCustomers: [],
    knownFacts: [`Available cash is ${inr(snapshot.availableCash)}.`, `Expected settlements total ${inr(snapshot.expectedSettlements)}.`, `Supplier obligations total ${inr(snapshot.supplierObligations)}.`, `Upcoming expenses total ${inr(snapshot.upcomingExpenses)}.`, `Projected buffer is ${inr(snapshot.projectedBuffer)}.`],
    uncertainties: ["Unexpected expenses and settlement delays are not included in the projection."],
    possibleCause: "Upcoming supplier and operating obligations are consuming the near-term cash buffer faster than incoming settlements replenish it.",
  };
}

function inventoryRisk(data: BusinessData): Detection {
  const risky = calculateInventoryRisks(data).slice(0, 8);
  const evidence: EvidenceRecord[] = risky.map(({ item, daysRemaining }) => ({
    id: `inventory-${item.sku}`, system: "Business Context", recordType: "Inventory Item", recordId: item.sku,
    label: item.productName, detail: `${item.stock} units on hand · ${daysRemaining === null ? "sales velocity unavailable" : `${daysRemaining.toFixed(1)} days of stock`} · ${item.leadTimeDays}-day lead time`,
    status: "stockout-risk", timestamp: detectedAt, amount: item.stock * item.unitCost,
    metadata: { reorderLevel: String(item.reorderLevel), supplierId: item.supplierId },
  }));
  const impact = sumMoney(risky, (risk) => risk.item.stock * risk.item.unitCost);
  return {
    anomaly: anomaly({
      id: "inventory-stockout-risk", type: "INVENTORY_RISK", title: `${risky.length} ${risky.length === 1 ? "product" : "products"} may stock out before replenishment`,
      severity: risky.length > 5 ? "HIGH" : "MEDIUM", summary: "Recent sales velocity, current stock, and supplier lead times indicate replenishment risk.",
      impactAmount: impact, affectedRecords: risky.length, affectedCustomers: 0, systems: ["Commerce", "Business Context"],
      recommendedAction: "Prioritize restocking the highest-velocity items whose remaining stock does not cover supplier lead time.",
    }, evidence),
    evidence, affectedOrders: [], affectedCustomers: [],
    knownFacts: [`${risky.length} inventory items are below reorder level or lead-time coverage.`],
    uncertainties: ["Future demand may differ from the recent order velocity used in this calculation."],
    possibleCause: "Sales velocity is outpacing available stock relative to supplier replenishment time.",
  };
}

function receivableRisk(data: BusinessData): Detection {
  const overdue = data.receivables.filter((item) => item.status === "overdue");
  const evidence: EvidenceRecord[] = overdue.slice(0, 12).map((item) => ({
    id: `receivable-${item.receivableId}`, system: "Business Context", recordType: "Receivable", recordId: item.receivableId,
    label: `Receivable ${item.receivableId}`, detail: `${inr(item.amount)} overdue from ${item.customerId}`,
    status: item.status, timestamp: item.dueDate, amount: item.amount, metadata: { customerId: item.customerId },
  }));
  const total = calculateBusinessSnapshot(data).overdueReceivables;
  return {
    anomaly: anomaly({
      id: "overdue-receivables", type: "RECEIVABLE_RISK", title: `${inr(total)} in receivables is overdue`,
      severity: total > 300_000 ? "HIGH" : "MEDIUM", summary: `${overdue.length} overdue receivables are constraining cash available to the business.`,
      impactAmount: total, affectedRecords: overdue.length, affectedCustomers: new Set(overdue.map((x) => x.customerId)).size,
      systems: ["Business Context", "Customer Records"], recommendedAction: "Prioritize collection outreach by amount and age, starting with the largest overdue customers.",
    }, evidence),
    evidence, affectedOrders: [], affectedCustomers: [...new Set(overdue.map((x) => x.customerId))],
    knownFacts: [`${overdue.length} receivables are overdue.`, `Their combined value is ${inr(total)}.`],
    uncertainties: ["Disputes or agreed payment extensions may not be represented in the workbook."],
    possibleCause: "A concentrated set of overdue customer balances is increasing working-capital pressure.",
  };
}

function supplierObligationRisk(data: BusinessData): Detection {
  const due = data.suppliers.filter((supplier) => supplier.paymentStatus === "due");
  const total = calculateBusinessSnapshot(data).supplierObligations;
  const evidence: EvidenceRecord[] = due.slice(0, 12).map((supplier) => ({
    id: `supplier-${supplier.supplierId}`,
    system: "Business Context",
    recordType: "Supplier Obligation",
    recordId: supplier.supplierId,
    label: supplier.name,
    detail: `${inr(supplier.amountDue)} due · ${supplier.leadTimeDays}-day lead time`,
    status: "due",
    timestamp: supplier.dueDate,
    amount: supplier.amountDue,
    metadata: { leadTimeDays: String(supplier.leadTimeDays) },
  }));
  return {
    anomaly: anomaly({
      id: "supplier-obligations",
      type: "SUPPLIER_OBLIGATION",
      title: `${inr(total)} in supplier obligations is due`,
      severity: total > 250_000 ? "HIGH" : "MEDIUM",
      summary: `${due.length} supplier balances are due and reduce the cash available for operations and replenishment.`,
      impactAmount: total,
      affectedRecords: due.length,
      affectedCustomers: 0,
      systems: ["Business Context"],
      recommendedAction: "Sequence supplier payments by due date, amount, and importance to at-risk inventory.",
    }, evidence),
    evidence,
    affectedOrders: [],
    affectedCustomers: [],
    knownFacts: [`${due.length} supplier balances are due.`, `Their combined value is ${inr(total)}.`],
    uncertainties: ["Unrecorded supplier credits or negotiated extensions are not included."],
    possibleCause: "Upcoming supplier payments are concentrated relative to the current cash position.",
  };
}

export function getBusinessDetections(data: BusinessData): Detection[] {
  return [
    ...(data.cashAvailable && data.settlements.length > 0 && (data.expenses.length > 0 || data.suppliers.length > 0) ? [cashPressure(data)] : []),
    inventoryRisk(data),
    receivableRisk(data),
    supplierObligationRisk(data),
  ];
}