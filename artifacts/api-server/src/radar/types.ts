export type Severity = "HIGH" | "MEDIUM" | "LOW";
export type RadarContextState = "NO_CONTEXT" | "IMPORTED_CONTEXT";

export interface Customer {
  customerId: string;
  name: string;
  email: string;
  phone: string;
}

export interface Product {
  productId: string;
  name: string;
  category: string;
  price: number;
  sku: string;
}

export interface InventoryItem {
  sku: string;
  productName: string;
  stock: number;
  reorderLevel: number;
  unitCost: number;
  supplierId: string;
  leadTimeDays: number;
}

export interface Expense {
  expenseId: string;
  category: string;
  amount: number;
  dueDate: string;
  status: "due" | "paid";
}

export interface Supplier {
  supplierId: string;
  name: string;
  amountDue: number;
  dueDate: string;
  paymentStatus: "due" | "paid";
  leadTimeDays: number;
}

export interface Receivable {
  receivableId: string;
  customerId: string;
  amount: number;
  dueDate: string;
  status: "outstanding" | "paid" | "overdue";
}

export interface Payout {
  payoutId: string;
  amount: number;
  status: "processed" | "pending";
  dueDate: string;
}

export interface Order {
  orderId: string;
  customerId: string;
  items: Array<{ productId: string; quantity: number }>;
  amount: number;
  status: "fulfilled" | "processing" | "cancelled";
  createdAt: string;
  fulfilledAt: string | null;
}

export interface Payment {
  paymentId: string;
  orderId: string;
  amount: number;
  method: string;
  status: "captured" | "failed" | "reversed";
  createdAt: string;
}

export interface Refund {
  refundId: string;
  paymentId: string;
  orderId: string;
  amount: number;
  status: "processed" | "pending";
  createdAt: string;
}

export interface Settlement {
  settlementId: string;
  paymentId: string;
  orderId: string;
  amount: number;
  status: "settled" | "pending";
  settlementDate: string;
}

export interface Dispute {
  disputeId: string;
  paymentId: string;
  orderId: string;
  amount: number;
  status: "open" | "won" | "lost" | "closed";
  reason: string;
  createdAt: string;
}

export interface SupportTicket {
  ticketId: string;
  customerId: string;
  orderId: string;
  category: string;
  message: string;
  createdAt: string;
  status: "open" | "resolved";
}

export interface BusinessData {
  customers: Customer[];
  products: Product[];
  orders: Order[];
  payments: Payment[];
  refunds: Refund[];
  settlements: Settlement[];
  disputes: Dispute[];
  tickets: SupportTicket[];
  inventory: InventoryItem[];
  expenses: Expense[];
  suppliers: Supplier[];
  receivables: Receivable[];
  payouts: Payout[];
  availableCash: number;
  cashAvailable: boolean;
}

export interface EvidenceRecord {
  id: string;
  system: string;
  recordType: string;
  recordId: string;
  label: string;
  detail: string;
  status: string;
  timestamp: string;
  amount: number | null;
  metadata: Record<string, string>;
}

export interface Anomaly {
  id: string;
  type: string;
  title: string;
  severity: Severity;
  summary: string;
  impactAmount: number;
  affectedRecords: number;
  affectedCustomers: number;
  systems: string[];
  firstDetected: string;
  evidenceCount: number;
  recommendedAction: string;
}

export interface Investigation {
  anomaly: Anomaly;
  executiveExplanation: string;
  knownFacts: string[];
  uncertainties: string[];
  possibleCause: string;
  evidence: EvidenceRecord[];
  affectedOrders: string[];
  affectedCustomers: string[];
}