import OpenAI from "openai";
import {
  calculateBusinessSnapshot,
  calculateInventoryRisks,
  calculatePurchasePosition,
  formatInr,
  getPriorityReceivables,
} from "./calculations";
import type { BusinessData } from "./types";

type Domain = "cash" | "payments" | "inventory" | "orders" | "expenses" | "suppliers" | "receivables" | "support";

interface CopilotEvidence {
  recordType: string;
  recordId: string;
  label: string;
  value: string;
}

interface ToolContext {
  domains: Domain[];
  directAnswer: string;
  calculation: string[];
  evidence: CopilotEvidence[];
  recommendation: string;
  uncertainties: string[];
  compactContext: Record<string, unknown>;
}

const allDomains: Domain[] = ["cash", "payments", "inventory", "orders", "expenses", "suppliers", "receivables", "support"];

function openAiClient() {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  return apiKey && baseURL ? new OpenAI({ apiKey, baseURL }) : null;
}

function parseAmount(question: string) {
  const match = question.replace(/,/g, "").match(/₹?\s*(\d+(?:\.\d+)?)\s*(crore|cr|lakh|lac|l|k)?/i);
  if (!match) return null;
  const raw = Number(match[1]);
  const unit = match[2]?.toLowerCase();
  if (unit === "crore" || unit === "cr") return raw * 10_000_000;
  if (unit === "lakh" || unit === "lac" || unit === "l") return raw * 100_000;
  if (unit === "k") return raw * 1_000;
  return raw;
}

function fallbackDomains(question: string): Domain[] {
  const value = question.toLowerCase();
  const domains = new Set<Domain>();
  if (/cash|afford|flow|buffer|money|risk|issue|today/.test(value)) ["cash", "payments", "expenses", "suppliers"].forEach((d) => domains.add(d as Domain));
  if (/inventory|stock|restock|product|replenish/.test(value)) ["inventory", "orders", "suppliers"].forEach((d) => domains.add(d as Domain));
  if (/owe|receivable|customer|chase|collect/.test(value)) domains.add("receivables");
  if (/payment|settlement|refund|razorpay/.test(value)) domains.add("payments");
  if (/support|complaint|ticket/.test(value)) domains.add("support");
  return domains.size > 0 ? [...domains] : allDomains;
}

async function identifyDomains(client: OpenAI | null, question: string): Promise<Domain[]> {
  if (!client) return fallbackDomains(question);
  try {
    const response = await client.chat.completions.create({
      model: "gpt-5.4-mini",
      messages: [
        {
          role: "system",
          content: `Select only the business domains needed to answer the question. Valid domains: ${allDomains.join(", ")}. Return JSON only: {"domains":["cash"]}. Use multiple domains for cross-system questions.`,
        },
        { role: "user", content: question },
      ],
      max_completion_tokens: 120,
    });
    const raw = response.choices[0]?.message.content?.replace(/```json|```/g, "").trim() ?? "";
    const parsed = JSON.parse(raw) as { domains?: string[] };
    const domains = (parsed.domains ?? []).filter((domain): domain is Domain => allDomains.includes(domain as Domain));
    return domains.length > 0 ? [...new Set(domains)] : fallbackDomains(question);
  } catch {
    return fallbackDomains(question);
  }
}

function expandRequiredDomains(question: string, domains: Domain[]): Domain[] {
  const expanded = new Set(domains);
  const amount = parseAmount(question);
  if (expanded.has("cash")) ["payments", "expenses", "suppliers"].forEach((domain) => expanded.add(domain as Domain));
  if (expanded.has("inventory") && amount !== null) {
    ["cash", "payments", "expenses", "suppliers", "orders"].forEach((domain) => expanded.add(domain as Domain));
  }
  return [...expanded];
}

function buildToolContext(data: BusinessData, question: string, domains: Domain[]): ToolContext {
  const snapshot = calculateBusinessSnapshot(data);
  const purchaseAmount = parseAmount(question);
  const inventoryRisks = calculateInventoryRisks(data).slice(0, 8);
  const priorityReceivables = getPriorityReceivables(data, 5);
  const calculation: string[] = [];
  const evidence: CopilotEvidence[] = [];
  const compactContext: Record<string, unknown> = {};
  let directAnswer = "The available records point to several issues that need attention.";
  let recommendation = "Start with the highest-value, time-sensitive issue and verify its source records.";
  const uncertainties = ["The analysis only includes records currently available to Business Radar."];

  if (domains.some((domain) => ["cash", "payments", "expenses", "suppliers"].includes(domain)) && !data.cashAvailable) {
    directAnswer = "Current cash is missing from the imported workbook, so affordability cannot be calculated truthfully.";
    recommendation = "Add an availableCash, currentCash, or cashBalance column to the workbook and import it again.";
    uncertainties.push("The workbook does not provide the current available cash balance.");
  } else if (domains.some((domain) => ["cash", "payments", "expenses", "suppliers"].includes(domain))) {
    calculation.push(
      `Available cash: ${formatInr(snapshot.availableCash)}`,
      `Expected Razorpay settlements: +${formatInr(snapshot.expectedSettlements)}`,
      `Supplier obligations: -${formatInr(snapshot.supplierObligations)}`,
      `Upcoming expenses: -${formatInr(snapshot.upcomingExpenses)}`,
      `Projected buffer before new purchases: ${formatInr(snapshot.projectedBuffer)}`,
    );
    evidence.push(
      { recordType: "Cash Position", recordId: "WORKBOOK-CASH", label: "Available cash", value: formatInr(snapshot.availableCash) },
      ...data.settlements.filter((item) => item.status === "pending").map((item) => ({ recordType: "Razorpay Settlement", recordId: item.settlementId, label: "Expected settlement", value: formatInr(item.amount) })),
      ...data.suppliers.filter((item) => item.paymentStatus === "due").map((item) => ({ recordType: "Supplier", recordId: item.supplierId, label: item.name, value: formatInr(item.amountDue) })),
      ...data.expenses.filter((item) => item.status === "due").map((item) => ({ recordType: "Expense", recordId: item.expenseId, label: item.category, value: formatInr(item.amount) })),
    );
    compactContext.cash = {
      availableCash: snapshot.availableCash,
      expectedSettlements: snapshot.expectedSettlements,
      supplierObligations: snapshot.supplierObligations,
      upcomingExpenses: snapshot.upcomingExpenses,
      projectedBuffer: snapshot.projectedBuffer,
    };
    directAnswer = snapshot.projectedBuffer < 0
      ? `Cash is under pressure: current records show a potential shortfall of ${formatInr(Math.abs(snapshot.projectedBuffer))} before any new purchase.`
      : `The projected cash buffer before new purchases is ${formatInr(snapshot.projectedBuffer)}.`;
    recommendation = "Sequence supplier and expense payments against expected Razorpay settlement dates.";
    uncertainties.push("Expected settlement timing may change, and unrecorded obligations are not included.");
  }

  if (purchaseAmount !== null && domains.includes("inventory") && data.cashAvailable) {
    const purchase = calculatePurchasePosition(data, purchaseAmount);
    calculation.push(
      `Proposed inventory purchase: -${formatInr(purchase.purchaseAmount)}`,
      `Projected buffer after purchase: ${formatInr(purchase.projectedBufferAfterPurchase)}`,
    );
    evidence.push({
      recordType: "Inventory Purchase Scenario",
      recordId: "PROPOSED-PURCHASE",
      label: "Proposed inventory purchase",
      value: formatInr(purchase.purchaseAmount),
    });
    compactContext.purchaseScenario = {
      purchaseAmount: purchase.purchaseAmount,
      projectedBufferAfterPurchase: purchase.projectedBufferAfterPurchase,
    };
    directAnswer = purchase.projectedBufferAfterPurchase < 100_000
      ? `No — not comfortably. A ${formatInr(purchaseAmount)} purchase would leave a projected buffer of ${formatInr(purchase.projectedBufferAfterPurchase)}.`
      : `Yes, based on current records. A ${formatInr(purchaseAmount)} purchase would leave ${formatInr(purchase.projectedBufferAfterPurchase)}.`;
    recommendation = purchase.projectedBufferAfterPurchase < 100_000
      ? "Split the purchase or wait for expected settlements before committing the full amount."
      : "Keep a contingency buffer and prioritize the highest-risk inventory items.";
  }

  if (domains.includes("inventory")) {
    compactContext.inventoryRisks = inventoryRisks.map(({ item, dailyVelocity, daysRemaining }) => ({
      sku: item.sku,
      productName: item.productName,
      stock: item.stock,
      reorderLevel: item.reorderLevel,
      leadTimeDays: item.leadTimeDays,
      dailyVelocity: Number(dailyVelocity.toFixed(2)),
      daysRemaining: daysRemaining === null ? null : Number(daysRemaining.toFixed(1)),
    }));
    evidence.push(...inventoryRisks.slice(0, 5).map(({ item, daysRemaining }) => ({
      recordType: "Inventory Item",
      recordId: item.sku,
      label: item.productName,
      value: `${item.stock} units · ${daysRemaining === null ? "velocity unavailable" : `${daysRemaining.toFixed(1)} days remaining`}`,
    })));
    if (purchaseAmount === null) {
      directAnswer = `${inventoryRisks.length} products are below reorder level or may run out before replenishment.`;
      recommendation = "Restock the products with the least lead-time coverage first.";
    }
    uncertainties.push("Demand is estimated from the orders currently available; future sales may differ.");
  }

  if (domains.includes("receivables")) {
    const priorityTotal = priorityReceivables.reduce((sum, receivable) => sum + receivable.amount, 0);
    calculation.push(
      `Overdue receivables: ${formatInr(snapshot.overdueReceivables)}`,
      `Outstanding receivables: ${formatInr(snapshot.outstandingReceivables)}`,
      `Top ${priorityReceivables.length} collection priorities: ${formatInr(priorityTotal)}`,
    );
    evidence.push(...priorityReceivables.map((receivable) => ({
      recordType: "Receivable",
      recordId: receivable.receivableId,
      label: receivable.customerId,
      value: `${formatInr(receivable.amount)} · ${receivable.status}`,
    })));
    compactContext.receivables = priorityReceivables;
    directAnswer = `${formatInr(snapshot.overdueReceivables)} is overdue. Start with ${priorityReceivables.map((item) => `${item.customerId} (${formatInr(item.amount)})`).join(", ")}.`;
    recommendation = "Prioritize overdue balances by amount and contact the listed customers first.";
    uncertainties.push("Disputes and agreed payment extensions may not be represented in the workbook.");
  }

  if (domains.includes("support")) {
    const openTickets = data.tickets.filter((ticket) => ticket.status === "open");
    const categoryCounts = openTickets.reduce<Record<string, number>>((counts, ticket) => {
      counts[ticket.category] = (counts[ticket.category] ?? 0) + 1;
      return counts;
    }, {});
    compactContext.support = { openTicketCount: openTickets.length, categoryCounts };
    evidence.push(...openTickets.slice(0, 5).map((ticket) => ({
      recordType: "Support Ticket",
      recordId: ticket.ticketId,
      label: ticket.category,
      value: ticket.message,
    })));
  }

  const normalizedQuestion = question.toLowerCase();
  if (/what changed|this week|trend|compared/.test(normalizedQuestion)) {
    directAnswer = "The current records show today’s position, but they do not include a comparable prior snapshot, so a week-over-week change cannot be calculated truthfully.";
    recommendation = "Use the current signals as the operating baseline and compare them with a later import.";
    uncertainties.push("No prior-period business snapshot is available for a like-for-like comparison.");
  } else if (/biggest|attention|issue.*today|deal with/.test(normalizedQuestion)) {
    const priorities = [
      { label: "cash shortfall", amount: Math.max(0, -snapshot.projectedBuffer), answer: `The biggest immediate issue is a projected cash shortfall of ${formatInr(Math.abs(snapshot.projectedBuffer))}.` },
      { label: "upcoming expenses", amount: snapshot.upcomingExpenses, answer: `${formatInr(snapshot.upcomingExpenses)} in upcoming expenses is the largest immediate obligation in the available records.` },
      { label: "overdue receivables", amount: snapshot.overdueReceivables, answer: `The largest quantified issue is ${formatInr(snapshot.overdueReceivables)} in overdue receivables.` },
      { label: "supplier obligations", amount: snapshot.supplierObligations, answer: `${formatInr(snapshot.supplierObligations)} in due supplier obligations needs attention.` },
    ].sort((a, b) => b.amount - a.amount);
    directAnswer = priorities[0].answer;
    recommendation = priorities[0].label === "overdue receivables"
      ? "Start collection outreach with the highest-value overdue customers."
      : priorities[0].label === "upcoming expenses"
        ? "Review the largest upcoming expenses by due date and protect cash for the most time-sensitive obligations."
      : "Protect near-term cash by sequencing obligations against expected settlements.";
  }

  return { domains, directAnswer, calculation, evidence: evidence.slice(0, 12), recommendation, uncertainties: [...new Set(uncertainties)], compactContext };
}

export async function answerBusinessQuestion(data: BusinessData, question: string) {
  const client = openAiClient();
  const domains = expandRequiredDomains(question, await identifyDomains(client, question));
  const context = buildToolContext(data, question, domains);
  const clean = (value: string) => value.replace(/[*#]/g, "").replace(/[—–]/g, "-").replace(/\s+/g, " ").trim();
  const calculation = context.calculation.map((item) => {
    const separator = item.indexOf(":");
    return separator > 0
      ? { label: clean(item.slice(0, separator)), value: clean(item.slice(separator + 1)) }
      : { label: "Calculated result", value: clean(item) };
  });
  const evidence = Object.values(context.evidence.reduce<Record<string, { source: string; dataset: string; records: number; recordIds: string[] }>>((groups, item) => {
    const source = /Razorpay|Settlement|Payment|Refund|Payout/i.test(item.recordType) ? "Razorpay" : "Business";
    const key = `${source}:${item.recordType}`;
    groups[key] ??= { source, dataset: item.recordType, records: 0, recordIds: [] };
    groups[key].records += 1;
    groups[key].recordIds.push(item.recordId);
    return groups;
  }, {}));
  const fallback = {
    verdict: clean(context.directAnswer),
    summary: calculation.length > 0
      ? `The decision uses ${calculation.map((item) => item.label.toLowerCase()).slice(-3).join(", ")} from the imported workbook.`
      : "The imported records do not contain enough information for a stronger conclusion.",
    calculation,
    evidence,
    action: clean(context.recommendation),
    confidence: (context.uncertainties.length <= 1 ? "High" : context.uncertainties.length <= 3 ? "Medium" : "Low") as "High" | "Medium" | "Low",
    usedAi: false,
  };
  if (!client) return fallback;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-5.4-mini",
      messages: [
        {
          role: "system",
          content: `You are Business Radar, the intelligence layer around Razorpay that connects payments with the rest of a merchant's business. Use only the trusted calculations and compact evidence supplied. Do not redo arithmetic or invent records, causes, trends, percentages, or financial numbers. Return JSON only with keys verdict, summary, action, confidence. Confidence must be High, Medium, or Low. The verdict answers the decision first. Summary uses short sentences and only important evidence. Never use Markdown, headings, bullets, asterisks, em dashes, filler, or repeat the question.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            question,
            selectedDomains: domains,
            trustedDirectAnswer: context.directAnswer,
            trustedCalculation: context.calculation,
            compactEvidenceContext: context.compactContext,
            evidenceReferences: context.evidence,
            knownUncertainties: context.uncertainties,
          }),
        },
      ],
      max_completion_tokens: 600,
    });
    const raw = response.choices[0]?.message.content?.replace(/```json|```/g, "").trim() ?? "";
    const generated = JSON.parse(raw) as { verdict?: string; summary?: string; action?: string; confidence?: string };
    return {
      ...fallback,
      verdict: clean(generated.verdict || fallback.verdict),
      summary: clean(generated.summary || fallback.summary),
      action: clean(generated.action || fallback.action),
      confidence: ["High", "Medium", "Low"].includes(generated.confidence ?? "")
        ? generated.confidence as "High" | "Medium" | "Low"
        : fallback.confidence,
      usedAi: true,
    };
  } catch {
    return fallback;
  }
}