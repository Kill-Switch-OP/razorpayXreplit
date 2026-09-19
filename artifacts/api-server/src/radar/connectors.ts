import type {
  BusinessData,
  Customer,
  Order,
  Payment,
  Product,
  Refund,
  Settlement,
  SupportTicket,
  InventoryItem,
  Expense,
  Supplier,
  Receivable,
  Payout,
} from "./types";
import { getImportedData } from "./import-store";

const names = [
  "Aarav Sharma", "Aditi Rao", "Arjun Mehta", "Ananya Iyer", "Vihaan Kapoor",
  "Diya Nair", "Kabir Singh", "Ishita Patel", "Rohan Das", "Meera Joshi",
  "Advik Verma", "Saanvi Gupta", "Reyansh Jain", "Kavya Menon", "Neil Bhat",
  "Myra Shah", "Dhruv Kulkarni", "Tara Reddy", "Vivaan Bose", "Naina Roy",
];
const categories = ["Home", "Electronics", "Wellness", "Kitchen", "Lifestyle"];
const productNames = [
  "Copper Serve Set", "AirPure Mini", "Everyday Backpack", "Bamboo Desk Lamp",
  "Ceramic Brew Kit", "Fitness Band", "Linen Throw", "Smart Kettle",
  "Travel Organiser", "Aroma Diffuser", "Desk Mat", "Steel Bottle",
  "Cotton Bedsheet", "Power Bank", "Yoga Mat", "Glass Lunch Box",
  "Reading Light", "Portable Speaker", "Coffee Grinder", "Laptop Sleeve",
  "Table Planter", "Wireless Charger", "Storage Basket", "Hand Blender",
  "Cushion Pair", "Earbuds", "Tea Gift Box", "Wall Clock", "Journal Set", "Mini Fan",
];
const methods = ["upi", "card", "netbanking", "wallet"];
const gapAmounts = [8499, 7999, 7499, 6999, 6499, 5999, 5499, 4999, 4499, 8999, 9499, 7311];
const mismatchAmounts = [19999, 18999, 17499, 16999, 15999, 14999, 15506];
const base = Date.UTC(2026, 8, 1, 8, 30);

const timestamp = (index: number, hourOffset = 0) =>
  new Date(base + index * 3_600_000 * 4 + hourOffset * 3_600_000).toISOString();

function createCustomers(): Customer[] {
  return Array.from({ length: 200 }, (_, index) => {
    const name = `${names[index % names.length]} ${Math.floor(index / names.length) + 1}`;
    return {
      customerId: `cust_${String(index + 1).padStart(4, "0")}`,
      name,
      email: `demo.customer${index + 1}@example.in`,
      phone: `+91 90000 ${String(10000 + index).slice(-5)}`,
    };
  });
}

function createProducts(): Product[] {
  return productNames.map((name, index) => ({
    productId: `prod_${String(index + 1).padStart(3, "0")}`,
    name,
    category: categories[index % categories.length],
    price: 1499 + (index % 10) * 750,
    sku: `SKU-${String(index + 1).padStart(3, "0")}`,
  }));
}

function createOrders(products: Product[]): Order[] {
  return Array.from({ length: 300 }, (_, index) => {
    const defaultAmount = 1999 + ((index * 733) % 12_000);
    const amount = index < 12
      ? gapAmounts[index]
      : index >= 20 && index < 27
        ? mismatchAmounts[index - 20]
        : defaultAmount;
    return {
      orderId: `ORD-${10482 + index}`,
      customerId: `cust_${String((index % 200) + 1).padStart(4, "0")}`,
      items: [{ productId: products[index % products.length].productId, quantity: 1 }],
      amount,
      status: index >= 294 ? "processing" : "fulfilled",
      createdAt: timestamp(index),
      fulfilledAt: index >= 294 ? null : timestamp(index, 18),
    };
  });
}

function createPayments(orders: Order[]): Payment[] {
  return orders.slice(0, 294).map((order, index) => {
    const isMismatch = index >= 20 && index < 27;
    const isSpikeFailure = index >= 220 && index < 232;
    return {
      paymentId: `pay_${String(928100 + index)}`,
      orderId: order.orderId,
      amount: isMismatch ? order.amount - (index % 2 === 0 ? 1200 : 2200) : order.amount,
      method: methods[index % methods.length],
      status: isMismatch && index % 3 === 0
        ? "reversed"
        : isSpikeFailure
          ? "failed"
          : "captured",
      createdAt: timestamp(index, 1),
    };
  });
}

function createRefunds(payments: Payment[]): Refund[] {
  return payments.slice(40, 70).map((payment, index) => ({
    refundId: `rfnd_${String(5100 + index)}`,
    paymentId: payment.paymentId,
    orderId: payment.orderId,
    amount: index < 4 ? Math.max(499, payment.amount - 1250) : payment.amount,
    status: index % 7 === 0 ? "pending" : "processed",
    createdAt: timestamp(250 + index, 6),
  }));
}

function createSettlements(orders: Order[], payments: Payment[]): Settlement[] {
  const valid = payments
    .filter((payment, index) => payment.status === "captured" && index >= 12)
    .map((payment, index) => ({
      settlementId: `setl_${String(7300 + index)}`,
      paymentId: payment.paymentId,
      orderId: payment.orderId,
      amount: payment.amount,
      status: "settled" as const,
      settlementDate: new Date(new Date(payment.createdAt).getTime() + 2 * 86_400_000).toISOString(),
    }));
  const orphans: Settlement[] = Array.from({ length: 3 }, (_, index) => ({
    settlementId: `setl_orphan_${index + 1}`,
    paymentId: `pay_unknown_${index + 1}`,
    orderId: `ORD-UNKNOWN-${index + 1}`,
    amount: 11_500 + index * 2_300,
    status: "settled",
    settlementDate: timestamp(280 + index),
  }));
  return [...valid, ...orphans];
}

function createTickets(orders: Order[], refunds: Refund[]): SupportTicket[] {
  return Array.from({ length: 100 }, (_, index) => {
    const refund = refunds[index % refunds.length];
    const linkedOrder = index < 31
      ? orders.find((order) => order.orderId === refund.orderId)!
      : index === 31
        ? orders[0]
        : index >= 70 && index < 86
          ? orders[220 + ((index - 70) % 12)]
          : orders[(index * 7) % orders.length];
    const isRefund = index < 31;
    const isSpike = index >= 70 && index < 86;
    return {
      ticketId: `T${821 + index}`,
      customerId: linkedOrder.customerId,
      orderId: linkedOrder.orderId,
      category: isRefund ? "refund" : isSpike ? "payment_failed" : index < 42 ? "delivery_experience" : "general",
      message: isRefund
        ? "My refund is still not visible. Please confirm the expected credit date."
        : isSpike
          ? "Payment failed at checkout but I need to confirm whether the amount was deducted."
          : index === 31
            ? "The order arrived, but I also need confirmation on when the payment will settle."
            : "I need help checking the latest status for this order.",
      createdAt: isSpike ? timestamp(232, index - 70) : timestamp(270 + index, 2),
      status: index % 4 === 0 ? "open" : "resolved",
    };
  });
}

const customers = createCustomers();
const products = createProducts();
const orders = createOrders(products);
const payments = createPayments(orders);
const refunds = createRefunds(payments);
const settlements = createSettlements(orders, payments);
const tickets = createTickets(orders, refunds);
const suppliers: Supplier[] = Array.from({ length: 12 }, (_, index) => ({
  supplierId: `SUP-${String(index + 1).padStart(3, "0")}`,
  name: `${["Apex", "Bharat", "Crescent", "Delta"][index % 4]} Supply Co.`,
  amountDue: index < 4 ? 35_000 : 8_000 + index * 1_250,
  dueDate: timestamp(295 + index),
  paymentStatus: index < 8 ? "due" : "paid",
  leadTimeDays: 5 + (index % 4) * 3,
}));
const inventory: InventoryItem[] = Array.from({ length: 48 }, (_, index) => ({
  sku: `SKU-${String((index % 30) + 1).padStart(3, "0")}`,
  productName: productNames[index % productNames.length],
  stock: index < 6 ? 4 + index : 24 + (index * 7) % 80,
  reorderLevel: 18 + (index % 5) * 4,
  unitCost: 850 + (index % 10) * 420,
  supplierId: suppliers[index % suppliers.length].supplierId,
  leadTimeDays: suppliers[index % suppliers.length].leadTimeDays,
}));
const expenses: Expense[] = Array.from({ length: 127 }, (_, index) => ({
  expenseId: `EXP-${String(index + 1).padStart(4, "0")}`,
  category: ["Payroll", "Logistics", "Marketing", "Rent", "Software"][index % 5],
  amount: 1_800 + (index % 13) * 1_050,
  dueDate: timestamp(296 + (index % 20)),
  status: index < 38 ? "due" : "paid",
}));
const receivables: Receivable[] = Array.from({ length: 31 }, (_, index) => ({
  receivableId: `REC-${String(index + 1).padStart(3, "0")}`,
  customerId: customers[(index * 5) % customers.length].customerId,
  amount: 6_500 + (index % 9) * 8_500,
  dueDate: new Date(base - (index < 15 ? (index + 2) : -(index + 3)) * 86_400_000).toISOString(),
  status: index < 15 ? "overdue" : index < 26 ? "outstanding" : "paid",
}));
const payouts: Payout[] = Array.from({ length: 18 }, (_, index) => ({
  payoutId: `pout_${7000 + index}`,
  amount: 8_500 + (index % 6) * 3_500,
  status: index < 14 ? "pending" : "processed",
  dueDate: timestamp(298 + index),
}));

// These connector boundaries can be replaced with live Razorpay, commerce,
// and support adapters without changing normalization, detection, or UI code.
export const razorpayConnector = {
  fetch: () => ({ payments, refunds, settlements, payouts }),
};
export const commerceConnector = {
  fetch: () => ({ customers, products, orders }),
};
export const supportConnector = {
  fetch: () => ({ tickets }),
};

export function loadBusinessData(): BusinessData {
  const imported = getImportedData();
  // An upload is the sole source of truth. Keep absent datasets empty rather
  // than silently falling back to the development fixtures above.
  return {
    customers: imported.customers ?? [],
    products: imported.products ?? [],
    orders: imported.orders ?? [],
    payments: imported.payments ?? [],
    refunds: imported.refunds ?? [],
    settlements: imported.settlements ?? [],
    disputes: imported.disputes ?? [],
    tickets: imported.tickets ?? [],
    inventory: imported.inventory ?? [],
    expenses: imported.expenses ?? [],
    suppliers: imported.suppliers ?? [],
    receivables: imported.receivables ?? [],
    payouts: imported.payouts ?? [],
    availableCash: imported.availableCash ?? 0,
    cashAvailable: imported.availableCash !== undefined,
  };
}