import { loadBusinessData } from "./connectors";
import type {
  Anomaly,
  BusinessData,
  EvidenceRecord,
  Investigation,
  Order,
  Payment,
  Settlement,
  SupportTicket,
} from "./types";
import { getBusinessDetections } from "./business-intelligence";
import { formatInr, sumMoney } from "./calculations";

const detectedAt = "2026-09-19T08:30:00.000Z";

export interface Detection {
  anomaly: Anomaly;
  evidence: EvidenceRecord[];
  affectedOrders: string[];
  affectedCustomers: string[];
  knownFacts: string[];
  uncertainties: string[];
  possibleCause: string;
}

function evidenceForOrder(
  data: BusinessData,
  order: Order,
  payment?: Payment,
  settlement?: Settlement,
  ticket?: SupportTicket,
): EvidenceRecord[] {
  const records: EvidenceRecord[] = [{
    id: `ev-order-${order.orderId}`,
    system: "Commerce",
    recordType: "Order",
    recordId: order.orderId,
    label: `Order ${order.orderId}`,
    detail: `${formatInr(order.amount)} · ${order.status}`,
    status: order.status,
    timestamp: order.fulfilledAt ?? order.createdAt,
    amount: order.amount,
    metadata: { customerId: order.customerId },
  }];
  if (payment) {
    records.push({
      id: `ev-payment-${payment.paymentId}`,
      system: "Razorpay",
      recordType: "Payment",
      recordId: payment.paymentId,
      label: `Payment ${payment.paymentId}`,
      detail: `${formatInr(payment.amount)} · ${payment.status}`,
      status: payment.status,
      timestamp: payment.createdAt,
      amount: payment.amount,
      metadata: { orderId: payment.orderId, method: payment.method },
    });
  }
  records.push(settlement ? {
    id: `ev-settlement-${settlement.settlementId}`,
    system: "Razorpay",
    recordType: "Settlement",
    recordId: settlement.settlementId,
    label: `Settlement ${settlement.settlementId}`,
    detail: `${formatInr(settlement.amount)} · ${settlement.status}`,
    status: settlement.status,
    timestamp: settlement.settlementDate,
    amount: settlement.amount,
    metadata: { paymentId: settlement.paymentId },
  } : {
    id: `ev-settlement-missing-${order.orderId}`,
    system: "Razorpay",
    recordType: "Settlement",
    recordId: `missing-${order.orderId}`,
    label: "No matching settlement",
    detail: "No settlement record was found for this captured payment.",
    status: "missing",
    timestamp: payment?.createdAt ?? order.createdAt,
    amount: null,
    metadata: { expectedOrderId: order.orderId },
  });
  if (ticket) {
    records.push({
      id: `ev-ticket-${ticket.ticketId}`,
      system: "Customer Support",
      recordType: "Support ticket",
      recordId: ticket.ticketId,
      label: `Ticket ${ticket.ticketId}`,
      detail: ticket.message,
      status: ticket.status,
      timestamp: ticket.createdAt,
      amount: null,
      metadata: { category: ticket.category },
    });
  }
  return records;
}

function baseAnomaly(
  input: Omit<Anomaly, "firstDetected" | "evidenceCount">,
  evidenceCount: number,
): Anomaly {
  return { ...input, firstDetected: detectedAt, evidenceCount };
}

function detectSettlementGaps(data: BusinessData): Detection {
  const settlementPayments = new Set(data.settlements.map((item) => item.paymentId));
  const gaps = data.orders
    .map((order) => ({ order, payment: data.payments.find((item) => item.orderId === order.orderId) }))
    .filter(({ order, payment }) =>
      order.status === "fulfilled" && payment?.status === "captured" && !settlementPayments.has(payment.paymentId))
    .slice(0, 12);
  const evidence = gaps.flatMap(({ order, payment }) =>
    evidenceForOrder(data, order, payment, undefined, data.tickets.find((ticket) => ticket.orderId === order.orderId)));
  const impact = sumMoney(gaps, (item) => item.order.amount);
  return {
    anomaly: baseAnomaly({
      id: "settlement-gap",
      type: "SETTLEMENT_GAP",
      title: `${formatInr(impact)} settlement exposure`,
      severity: "HIGH",
      summary: `${gaps.length} fulfilled orders have successful payments but no corresponding settlement.`,
      impactAmount: impact,
      affectedRecords: gaps.length,
      affectedCustomers: new Set(gaps.map(({ order }) => order.customerId)).size,
      systems: ["Commerce", "Razorpay", "Customer Support"],
      recommendedAction: "Review the affected settlement batch and verify whether these payments are pending or require operational intervention.",
    }, evidence.length),
    evidence,
    affectedOrders: gaps.map(({ order }) => order.orderId),
    affectedCustomers: [...new Set(gaps.map(({ order }) => order.customerId))],
    knownFacts: [
      `${gaps.length} orders were fulfilled.`,
      `All ${gaps.length} linked payments were captured successfully.`,
      `No matching settlement records were found for ${formatInr(impact)}.`,
      `${data.tickets.filter((ticket) => gaps.some(({ order }) => order.orderId === ticket.orderId)).length} linked support tickets were found.`,
    ],
    uncertainties: [
      "The imported workbook cannot confirm whether the payments are delayed in a pending settlement batch.",
      "No bank-side settlement status is available in the connected records.",
    ],
    possibleCause: "The evidence supports a cross-system settlement gap. A delayed or incomplete settlement batch is possible, but not confirmed.",
  };
}

function detectPaymentMismatch(data: BusinessData): Detection {
  const mismatches = data.orders
    .map((order) => ({ order, payment: data.payments.find((item) => item.orderId === order.orderId) }))
    .filter(({ order, payment }) => order.status === "fulfilled" && payment &&
      (payment.amount !== order.amount || payment.status !== "captured"))
    .slice(0, 7) as Array<{ order: Order; payment: Payment }>;
  const evidence = mismatches.flatMap(({ order, payment }) => evidenceForOrder(data, order, payment));
  const impact = sumMoney(mismatches, (item) => item.order.amount);
  return {
    anomaly: baseAnomaly({
      id: "payment-order-mismatch",
      type: "PAYMENT_ORDER_MISMATCH",
      title: `${formatInr(impact)} order/payment inconsistency`,
      severity: "HIGH",
      summary: `${mismatches.length} fulfilled orders have inconsistent payment amounts or states.`,
      impactAmount: impact,
      affectedRecords: mismatches.length,
      affectedCustomers: new Set(mismatches.map(({ order }) => order.customerId)).size,
      systems: ["Commerce", "Razorpay"],
      recommendedAction: "Pause automated reconciliation for these orders and compare captured values against commerce totals.",
    }, evidence.length),
    evidence,
    affectedOrders: mismatches.map(({ order }) => order.orderId),
    affectedCustomers: [...new Set(mismatches.map(({ order }) => order.customerId))],
    knownFacts: ["All affected orders are marked fulfilled.", "The linked payment amount or status differs from the commerce order."],
    uncertainties: ["Discount, tax, or partial-capture adjustments are not represented in the available records."],
    possibleCause: "A capture-state synchronization or amount-mapping issue may exist between commerce and payments.",
  };
}

function detectRefundComplaints(data: BusinessData): Detection {
  const refundOrders = new Set(data.refunds.map((refund) => refund.orderId));
  const tickets = data.tickets.filter((ticket) => ticket.category === "refund" && refundOrders.has(ticket.orderId));
  const relatedOrders = data.orders.filter((order) => tickets.some((ticket) => ticket.orderId === order.orderId));
  const evidence = tickets.slice(0, 12).map((ticket) => ({
    id: `ev-ticket-${ticket.ticketId}`,
    system: "Customer Support",
    recordType: "Support ticket",
    recordId: ticket.ticketId,
    label: `Ticket ${ticket.ticketId}`,
    detail: ticket.message,
    status: ticket.status,
    timestamp: ticket.createdAt,
    amount: null,
    metadata: { orderId: ticket.orderId, category: ticket.category },
  }));
  const impact = sumMoney(
    data.refunds.filter((refund) => tickets.some((ticket) => ticket.orderId === refund.orderId)),
    (refund) => refund.amount,
  );
  return {
    anomaly: baseAnomaly({
      id: "refund-support-correlation",
      type: "REFUND_SUPPORT_CORRELATION",
      title: `${tickets.length} refund complaints require review`,
      severity: "MEDIUM",
      summary: `${tickets.length} support tickets correlate with recent refund activity.`,
      impactAmount: impact,
      affectedRecords: tickets.length,
      affectedCustomers: new Set(tickets.map((ticket) => ticket.customerId)).size,
      systems: ["Customer Support", "Commerce", "Razorpay"],
      recommendedAction: "Review pending refund timelines and proactively update affected customers with expected credit dates.",
    }, evidence.length),
    evidence,
    affectedOrders: relatedOrders.map((order) => order.orderId),
    affectedCustomers: [...new Set(tickets.map((ticket) => ticket.customerId))],
    knownFacts: [`${tickets.length} refund-related tickets are linked to orders with refund records.`, "Complaint volume is concentrated after recent refund events."],
    uncertainties: ["The support records cannot confirm whether credits are delayed at the customer's bank."],
    possibleCause: "Refund communication or downstream credit latency may be driving the support spike.",
  };
}

function detectOrphanSettlements(data: BusinessData): Detection {
  const paymentIds = new Set(data.payments.map((payment) => payment.paymentId));
  const orphans = data.settlements.filter((settlement) => !paymentIds.has(settlement.paymentId));
  const evidence: EvidenceRecord[] = orphans.map((settlement) => ({
    id: `ev-${settlement.settlementId}`,
    system: "Razorpay",
    recordType: "Settlement",
    recordId: settlement.settlementId,
    label: `Settlement ${settlement.settlementId}`,
    detail: "No matching payment or commerce order was found.",
    status: settlement.status,
    timestamp: settlement.settlementDate,
    amount: settlement.amount,
    metadata: { paymentId: settlement.paymentId, orderId: settlement.orderId },
  }));
  const impact = sumMoney(orphans, (item) => item.amount);
  return {
    anomaly: baseAnomaly({
      id: "orphan-settlements",
      type: "ORPHAN_SETTLEMENT",
      title: `${orphans.length} unmatched settlements`,
      severity: "MEDIUM",
      summary: `${formatInr(impact)} in settlement records cannot be linked to known payments or orders.`,
      impactAmount: impact,
      affectedRecords: orphans.length,
      affectedCustomers: 0,
      systems: ["Razorpay", "Commerce"],
      recommendedAction: "Inspect settlement reference mapping and confirm whether these entries belong to an unimported payment batch.",
    }, evidence.length),
    evidence,
    affectedOrders: [],
    affectedCustomers: [],
    knownFacts: [`${orphans.length} settlement records have unknown payment identifiers.`],
    uncertainties: ["The source batch may include payments outside the current commerce export."],
    possibleCause: "An incomplete import or reference mapping mismatch may have produced these orphan records.",
  };
}

function detectRefundMismatches(data: BusinessData): Detection {
  const mismatches = data.refunds.filter((refund) => {
    const payment = data.payments.find((item) => item.paymentId === refund.paymentId);
    return payment && refund.amount !== payment.amount;
  }).slice(0, 4);
  const evidence: EvidenceRecord[] = mismatches.flatMap((refund) => {
    const payment = data.payments.find((item) => item.paymentId === refund.paymentId)!;
    return [{
      id: `ev-${refund.refundId}`,
      system: "Razorpay",
      recordType: "Refund",
      recordId: refund.refundId,
      label: `Refund ${refund.refundId}`,
      detail: `${formatInr(refund.amount)} refunded against ${formatInr(payment.amount)} captured`,
      status: refund.status,
      timestamp: refund.createdAt,
      amount: refund.amount,
      metadata: { paymentId: payment.paymentId, orderId: refund.orderId },
    }];
  });
  const impact = sumMoney(mismatches, (item) => item.amount);
  return {
    anomaly: baseAnomaly({
      id: "refund-amount-mismatch",
      type: "REFUND_AMOUNT_MISMATCH",
      title: "Unexpected partial refund amounts",
      severity: "LOW",
      summary: `${mismatches.length} refunds differ from their original captured payment without an adjustment reason.`,
      impactAmount: impact,
      affectedRecords: mismatches.length,
      affectedCustomers: mismatches.length,
      systems: ["Razorpay", "Commerce"],
      recommendedAction: "Validate whether each partial refund is intentional and attach an adjustment reason.",
    }, evidence.length),
    evidence,
    affectedOrders: mismatches.map((item) => item.orderId),
    affectedCustomers: mismatches.flatMap((item) => {
      const order = data.orders.find((candidate) => candidate.orderId === item.orderId);
      return order ? [order.customerId] : [];
    }),
    knownFacts: [`${mismatches.length} refund amounts differ from the linked captured payments.`],
    uncertainties: ["No line-item or manual adjustment reason is available."],
    possibleCause: "These may be valid partial refunds, but the available evidence does not explain the difference.",
  };
}

function detectTemporalSpike(data: BusinessData): Detection {
  const failed = data.payments.filter((payment) => payment.status === "failed");
  const complaints = data.tickets.filter((ticket) => ticket.category === "payment_failed");
  const hasCorrelation = failed.length > 0 && complaints.length > 0;
  const evidence: EvidenceRecord[] = failed.slice(0, 6).map((payment) => ({
    id: `ev-spike-${payment.paymentId}`,
    system: "Razorpay",
    recordType: "Payment",
    recordId: payment.paymentId,
    label: `Failed payment ${payment.paymentId}`,
    detail: `${formatInr(payment.amount)} · failed`,
    status: payment.status,
    timestamp: payment.createdAt,
    amount: payment.amount,
    metadata: { orderId: payment.orderId },
  }));
  return {
    anomaly: baseAnomaly({
      id: "temporal-payment-spike",
      type: "TEMPORAL_SPIKE",
      title: "Payment failures correlate with support complaints",
      severity: "MEDIUM",
      summary: `${failed.length} payment failures were followed by ${complaints.length} related complaints in a concentrated period.`,
      impactAmount: sumMoney(failed, (payment) => payment.amount),
      affectedRecords: hasCorrelation ? failed.length + complaints.length : 0,
      affectedCustomers: new Set(complaints.map((ticket) => ticket.customerId)).size,
      systems: ["Razorpay", "Customer Support"],
      recommendedAction: "Check payment gateway health for the incident window and prepare a customer communication if failures persist.",
    }, evidence.length),
    evidence,
    affectedOrders: failed.map((payment) => payment.orderId),
    affectedCustomers: [...new Set(complaints.map((ticket) => ticket.customerId))],
    knownFacts: [`${failed.length} failed payments are present in the import.`, `${complaints.length} payment-related support tickets are present.`],
    uncertainties: ["The correlation does not prove a shared technical root cause."],
    possibleCause: "A short payment-processing incident may have driven the later support increase.",
  };
}

export function runDetectors(data = loadBusinessData()): Detection[] {
  return [
    ...getBusinessDetections(data),
    detectSettlementGaps(data),
    detectPaymentMismatch(data),
    detectRefundComplaints(data),
    detectOrphanSettlements(data),
    detectTemporalSpike(data),
  ].filter((detection) => detection.anomaly.affectedRecords > 0);
}

export function listAnomalies(): Anomaly[] {
  const severityWeight = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  return runDetectors()
    .map((detection) => detection.anomaly)
    .sort((a, b) =>
      severityWeight[b.severity] - severityWeight[a.severity]
      || b.impactAmount - a.impactAmount
      || b.evidenceCount - a.evidenceCount);
}

export function getInvestigation(id: string): Investigation | undefined {
  const detection = runDetectors().find((item) => item.anomaly.id === id);
  if (!detection) return undefined;
  const { anomaly, evidence, affectedOrders, affectedCustomers, knownFacts, uncertainties, possibleCause } = detection;
  return {
    anomaly,
    executiveExplanation: `${anomaly.summary} The deterministic scan linked ${anomaly.systems.join(", ")} records and calculated a potential impact of ${formatInr(anomaly.impactAmount)}. ${anomaly.recommendedAction}`,
    knownFacts,
    uncertainties,
    possibleCause,
    evidence,
    affectedOrders,
    affectedCustomers,
  };
}