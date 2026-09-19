import * as XLSX from "xlsx";
import { setWorkbookImport, type DataHealth, type WorkbookImportReport, type WorkbookSheetReport } from "./import-store";
import type {
  BusinessData, Customer, Dispute, Expense, InventoryItem, Order, Payment, Product,
  Payout, Receivable, Refund, Settlement, Supplier, SupportTicket,
} from "./types";

const key = (v: unknown) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const aliases: Record<string, string[]> = {
  payments: ["payments", "payment", "transactions", "payment transactions", "transaction data"],
  refunds: ["refunds", "refund"],
  settlements: ["settlements", "settlement", "settlement report"],
  payouts: ["payouts", "payout"],
  disputes: ["disputes", "dispute", "chargebacks", "chargeback"],
  customers: ["customers", "customer", "customer master", "customer data"],
  products: ["products", "product", "sku master", "product catalog"],
  orders: ["orders", "sales", "sales orders", "order data"],
  inventory: ["inventory", "stock", "stock master"],
  expenses: ["expenses", "expense"],
  suppliers: ["suppliers", "supplier", "supplier master"],
  receivables: ["receivables", "receivable", "accounts receivable"],
  support: ["support", "support tickets", "tickets", "customer support"],
};
const normalizedAliases = Object.fromEntries(Object.entries(aliases).map(([type, names]) => [type, names.map(key)]));
const field = (row: Record<string, unknown>, ...names: string[]) => {
  const found = Object.entries(row).find(([name]) => names.some((candidate) => key(name) === key(candidate)));
  return found?.[1];
};
const text = (row: Record<string, unknown>, ...names: string[]) => String(field(row, ...names) ?? "").trim();
const numeric = (row: Record<string, unknown>, ...names: string[]) => {
  const raw = field(row, ...names);
  if (raw === "" || raw === null || raw === undefined) return undefined;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[,₹$]/g, ""));
  return Number.isFinite(n) ? n : undefined;
};
const parsedDate = (row: Record<string, unknown>, ...names: string[]) => {
  const raw = field(row, ...names);
  if (raw === "" || raw === null || raw === undefined) return undefined;
  if (typeof raw === "number") return XLSX.SSF.format("yyyy-mm-dd", raw);
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

type MutableHealth = DataHealth & { warningsSet: Set<string> };
const quality = (): MutableHealth => ({
  recognizedDatasets: 0, totalRecords: 0, relationshipsResolved: 0, missingRequiredFields: 0,
  missingRequiredIds: 0, duplicateIds: 0, malformedDates: 0, missingAmounts: 0,
  unsupportedSheets: 0, warnings: [], warningsSet: new Set(),
});
const warn = (h: MutableHealth, message: string) => {
  if (!h.warningsSet.has(message)) { h.warningsSet.add(message); h.warnings.push(message); }
};

function detectType(name: string, rows: Array<Record<string, unknown>>): string | undefined {
  const sheet = key(name);
  const byName = Object.entries(normalizedAliases).find(([, names]) => names.some((alias) => sheet === alias || sheet.includes(alias)));
  if (byName) return byName[0];
  const columns = new Set(rows.flatMap((row) => Object.keys(row).map(key)));
  const tests: Array<[string, string[]]> = [
    ["disputes", ["disputeid", "chargedbackate", "disputereason"]],
    ["settlements", ["settlementid", "settlementdate"]],
    ["payouts", ["payoutid", "payoutdate"]],
    ["payments", ["paymentid", "transactionid", "paymentmethod"]],
    ["refunds", ["refundid", "refundstatus"]],
    ["customers", ["customerid", "customeremail"]],
    ["products", ["productid", "sku"]],
    ["orders", ["orderid", "ordernumber"]],
    ["inventory", ["reorderlevel", "stock", "quantityonhand"]],
    ["expenses", ["expenseid", "expensedate"]],
    ["suppliers", ["supplierid", "leadtime"]],
    ["receivables", ["receivableid", "outstandingamount"]],
    ["support", ["ticketid", "ticketstatus"]],
  ];
  return tests.find(([, required]) => required.some((column) => columns.has(column)))?.[0];
}

export function importWorkbook(buffer: Buffer, fileName: string): WorkbookImportReport {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const data: Partial<BusinessData> = {};
  const health = quality();
  const seen = new Set<string>();
  const detectedAliases: Record<string, string[]> = {};
  const sheets: WorkbookSheetReport[] = workbook.SheetNames.map((name) => {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[name], { defval: "" });
    if (data.availableCash === undefined) {
      const availableCash = rows.map((row) => numeric(row, "availableCash", "currentCash", "cashBalance")).find((amount) => amount !== undefined);
      if (availableCash !== undefined) data.availableCash = availableCash;
    }
    const type = detectType(name, rows);
    const supported = Boolean(type);
    if (!supported) { health.unsupportedSheets += 1; warn(health, `Unsupported sheet: ${name}`); }
    else {
      health.recognizedDatasets += 1;
      detectedAliases[type!] ??= [];
      detectedAliases[type!].push(name);
    }
    const report: WorkbookSheetReport = { name, normalizedType: type ?? "unsupported", rowCount: rows.length, supported, alias: type, preview: rows.slice(0, 4) };
    if (!type) return report;
    const ids = new Set<string>();
    const idFor = (row: Record<string, unknown>, names: string[]) => {
      const id = text(row, ...names);
      if (!id) { health.missingRequiredIds++; health.missingRequiredFields++; return undefined; }
      if (ids.has(id)) health.duplicateIds++; else ids.add(id);
      return id;
    };
    const amountFor = (row: Record<string, unknown>, ...names: string[]) => {
      const amount = numeric(row, ...names);
      if (amount === undefined) health.missingAmounts++;
      return amount;
    };
    const dateFor = (row: Record<string, unknown>, ...names: string[]) => {
      const raw = field(row, ...names);
      const date = parsedDate(row, ...names);
      if (raw !== undefined && raw !== "" && !date) health.malformedDates++;
      return date;
    };
    const valid = <T>(items: Array<T | undefined>) => items.filter((item): item is T => Boolean(item));
    switch (type) {
      case "customers": data.customers = valid(rows.map((r) => { const customerId = idFor(r, ["customerId", "id"]); return customerId ? { customerId, name: text(r, "name", "customerName"), email: text(r, "email"), phone: text(r, "phone") } satisfies Customer : undefined; })); break;
      case "products": data.products = valid(rows.map((r) => { const productId = idFor(r, ["productId", "id", "sku"]); const price = amountFor(r, "price", "amount"); return productId && price !== undefined ? { productId, name: text(r, "name", "productName"), category: text(r, "category"), price, sku: text(r, "sku") } satisfies Product : undefined; })); break;
      case "inventory": data.inventory = valid(rows.map((r) => { const sku = idFor(r, ["sku", "productId", "id"]); return sku ? { sku, productName: text(r, "productName", "product", "name"), stock: numeric(r, "stock", "quantity") ?? 0, reorderLevel: numeric(r, "reorderLevel", "reorder") ?? 0, unitCost: numeric(r, "unitCost", "cost") ?? 0, supplierId: text(r, "supplierId", "supplier"), leadTimeDays: numeric(r, "leadTimeDays", "leadTime") ?? 0 } satisfies InventoryItem : undefined; })); break;
      case "expenses": data.expenses = valid(rows.map((r) => { const expenseId = idFor(r, ["expenseId", "id"]); const amount = amountFor(r, "amount", "total"); const dueDate = dateFor(r, "dueDate", "date"); return expenseId && amount !== undefined && dueDate ? { expenseId, category: text(r, "category"), amount, dueDate, status: key(text(r, "status")) === "paid" ? "paid" : "due" } satisfies Expense : undefined; })); break;
      case "suppliers": data.suppliers = valid(rows.map((r) => { const supplierId = idFor(r, ["supplierId", "id"]); const dueDate = dateFor(r, "dueDate", "date"); const amountDue = amountFor(r, "amountDue", "amount"); return supplierId && dueDate && amountDue !== undefined ? { supplierId, name: text(r, "name", "supplierName"), amountDue, dueDate, paymentStatus: key(text(r, "paymentStatus", "status")) === "paid" ? "paid" : "due", leadTimeDays: numeric(r, "leadTimeDays", "leadTime") ?? 0 } satisfies Supplier : undefined; })); break;
      case "receivables": data.receivables = valid(rows.map((r) => { const receivableId = idFor(r, ["receivableId", "id"]); const dueDate = dateFor(r, "dueDate", "date"); const amount = amountFor(r, "amount", "outstandingAmount"); return receivableId && dueDate && amount !== undefined ? { receivableId, customerId: text(r, "customerId", "customer"), amount, dueDate, status: key(text(r, "status")) as Receivable["status"] || "outstanding" } satisfies Receivable : undefined; })); break;
      case "orders": data.orders = valid(rows.map((r) => { const orderId = idFor(r, ["orderId", "id", "orderNumber"]); const createdAt = dateFor(r, "createdAt", "date", "orderDate"); const amount = amountFor(r, "amount", "total", "orderValue"); return orderId && createdAt && amount !== undefined ? { orderId, customerId: text(r, "customerId", "customer"), items: [{ productId: text(r, "productId", "sku"), quantity: numeric(r, "quantity") ?? 1 }], amount, status: key(text(r, "status")) === "cancelled" ? "cancelled" : key(text(r, "status")) === "processing" ? "processing" : "fulfilled", createdAt, fulfilledAt: dateFor(r, "fulfilledAt") ?? null } satisfies Order : undefined; })); break;
      case "payments": data.payments = valid(rows.map((r) => { const paymentId = idFor(r, ["paymentId", "transactionId", "id"]); const createdAt = dateFor(r, "createdAt", "date", "paymentDate"); const amount = amountFor(r, "amount", "value", "total"); return paymentId && createdAt && amount !== undefined ? { paymentId, orderId: text(r, "orderId", "order"), amount, method: text(r, "method", "paymentMethod"), status: (key(text(r, "status")) as Payment["status"]) || "captured", createdAt } satisfies Payment : undefined; })); break;
      case "refunds": data.refunds = valid(rows.map((r) => { const refundId = idFor(r, ["refundId", "id"]); const createdAt = dateFor(r, "createdAt", "date", "refundDate"); const amount = amountFor(r, "amount", "value"); return refundId && createdAt && amount !== undefined ? { refundId, paymentId: text(r, "paymentId", "payment"), orderId: text(r, "orderId", "order"), amount, status: key(text(r, "status")) === "pending" ? "pending" : "processed", createdAt } satisfies Refund : undefined; })); break;
      case "settlements": data.settlements = valid(rows.map((r) => { const settlementId = idFor(r, ["settlementId", "id"]); const settlementDate = dateFor(r, "settlementDate", "date"); const amount = amountFor(r, "amount", "value", "total"); return settlementId && settlementDate && amount !== undefined ? { settlementId, paymentId: text(r, "paymentId", "payment"), orderId: text(r, "orderId", "order"), amount, status: key(text(r, "status")) === "pending" ? "pending" : "settled", settlementDate } satisfies Settlement : undefined; })); break;
      case "payouts": data.payouts = valid(rows.map((r) => { const payoutId = idFor(r, ["payoutId", "id"]); const dueDate = dateFor(r, "dueDate", "date", "payoutDate"); const amount = amountFor(r, "amount", "value", "total"); return payoutId && dueDate && amount !== undefined ? { payoutId, amount, status: key(text(r, "status")) === "pending" ? "pending" : "processed", dueDate } satisfies Payout : undefined; })); break;
      case "disputes": data.disputes = valid(rows.map((r) => { const disputeId = idFor(r, ["disputeId", "id"]); const createdAt = dateFor(r, "createdAt", "date", "disputeDate"); const amount = amountFor(r, "amount", "value"); return disputeId && createdAt && amount !== undefined ? { disputeId, paymentId: text(r, "paymentId", "payment"), orderId: text(r, "orderId", "order"), amount, status: (key(text(r, "status")) as Dispute["status"]) || "open", reason: text(r, "reason"), createdAt } satisfies Dispute : undefined; })); break;
      case "support": data.tickets = valid(rows.map((r) => { const ticketId = idFor(r, ["ticketId", "id"]); const createdAt = dateFor(r, "createdAt", "date"); return ticketId && createdAt ? { ticketId, customerId: text(r, "customerId", "customer"), orderId: text(r, "orderId", "order"), category: text(r, "category"), message: text(r, "message", "description"), createdAt, status: key(text(r, "status")) === "open" ? "open" : "resolved" } satisfies SupportTicket : undefined; })); break;
    }
    return report;
  });
  health.recognizedDatasets = Object.keys(detectedAliases).length;
  const customerIds = new Set((data.customers ?? []).map((record) => record.customerId));
  const orderIds = new Set((data.orders ?? []).map((record) => record.orderId));
  const paymentIds = new Set((data.payments ?? []).map((record) => record.paymentId));
  const supplierIds = new Set((data.suppliers ?? []).map((record) => record.supplierId));
  const relations: Array<[string, string | undefined, Set<string>]> = [];
  for (const record of data.orders ?? []) relations.push(["order.customer", record.customerId, customerIds]);
  for (const record of data.payments ?? []) relations.push(["payment.order", record.orderId, orderIds]);
  for (const record of data.refunds ?? []) {
    relations.push(["refund.payment", record.paymentId, paymentIds]);
    relations.push(["refund.order", record.orderId, orderIds]);
  }
  for (const record of data.settlements ?? []) {
    relations.push(["settlement.payment", record.paymentId, paymentIds]);
    relations.push(["settlement.order", record.orderId, orderIds]);
  }
  for (const record of data.tickets ?? []) {
    relations.push(["support.customer", record.customerId, customerIds]);
    relations.push(["support.order", record.orderId, orderIds]);
  }
  for (const record of data.receivables ?? []) relations.push(["receivable.customer", record.customerId, customerIds]);
  for (const record of data.inventory ?? []) relations.push(["inventory.supplier", record.supplierId, supplierIds]);
  health.relationshipsResolved = relations.filter(([, id, known]) => Boolean(id) && known.has(id!)).length;
  const unresolved = relations.filter(([, id, known]) => Boolean(id) && !known.has(id!)).length;
  if (unresolved) warn(health, `${unresolved} relationships could not be resolved`);
  const importedRecords: Record<string, number> = {
    payments: data.payments?.length ?? 0, refunds: data.refunds?.length ?? 0,
    settlements: data.settlements?.length ?? 0, payouts: data.payouts?.length ?? 0,
    disputes: data.disputes?.length ?? 0, customers: data.customers?.length ?? 0,
    products: data.products?.length ?? 0, orders: data.orders?.length ?? 0,
    inventory: data.inventory?.length ?? 0, expenses: data.expenses?.length ?? 0,
    suppliers: data.suppliers?.length ?? 0, receivables: data.receivables?.length ?? 0,
    support: data.tickets?.length ?? 0,
  };
  health.totalRecords = Object.values(importedRecords).reduce((sum, count) => sum + count, 0);
  const { warningsSet: _discard, ...dataHealth } = health;
  const datasets = Object.fromEntries(Object.keys(aliases).map((type) => {
    const matching = sheets.filter((sheet) => sheet.normalizedType === type);
    return [type, {
      recordCount: importedRecords[type] ?? 0,
      aliases: detectedAliases[type] ?? [],
      available: matching.length > 0,
    }];
  }));
  const result: WorkbookImportReport = {
    fileName, importedAt: new Date().toISOString(), status: "success", totalRecords: health.totalRecords,
    detectedSources: [...new Set(sheets.filter((sheet) => sheet.supported).map((sheet) => sheet.normalizedType))],
    sheets, aliases: detectedAliases, datasets, dataHealth,
  };
  setWorkbookImport(data, result);
  return result;
}