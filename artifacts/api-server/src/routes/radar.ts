import { Router, type IRouter } from "express";
import multer from "multer";
import {
  AskBusinessCopilotBody,
  AskCopilotBody,
  AskCopilotParams,
  GetAnomalyParams,
} from "@workspace/api-zod";
import { loadBusinessData } from "../radar/connectors";
import { answerQuestion } from "../radar/copilot";
import { getInvestigation, listAnomalies } from "../radar/engine";
import { answerBusinessQuestion, getBusinessPulse } from "../radar/business-intelligence";
import { clearWorkbookImport, getContextState, getWorkbookReport } from "../radar/import-store";
import { importWorkbook } from "../radar/workbook";
import { getBusinessRecordCounts, sumMoney } from "../radar/calculations";
import { buildDatasetSummaries, suggestedPrompts } from "../radar/dataset-intelligence";

const router: IRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});
let lastScan = new Date().toISOString();

function summary() {
  const contextState = getContextState();
  const anomalies = listAnomalies().filter((item) => item.systems.includes("Razorpay") && item.systems.length > 1);
  return {
    contextState,
    businessSignals: anomalies.length,
    highRisk: anomalies.filter((item) => item.severity === "HIGH").length,
    potentialExposure: sumMoney(anomalies, (item) => item.impactAmount),
    affectedCustomers: new Set(
      anomalies.flatMap((item) => Array.from({ length: item.affectedCustomers }, (_, i) => `${item.id}-${i}`)),
    ).size,
    lastScan,
    topAnomalies: anomalies.slice(0, 5),
  };
}

router.get("/radar/summary", (_req, res) => {
  res.json(summary());
});

router.post("/radar/scan", (_req, res) => {
  lastScan = new Date().toISOString();
  res.json({ summary: summary(), scannedAt: lastScan, message: "Scan complete" });
});

router.get("/anomalies", (_req, res) => {
  res.json(listAnomalies().filter((item) => item.systems.includes("Razorpay") && item.systems.length > 1));
});

router.get("/anomalies/:id", (req, res) => {
  const params = GetAnomalyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid anomaly identifier" });
    return;
  }
  const investigation = getInvestigation(params.data.id);
  if (!investigation) {
    res.status(404).json({ error: "Anomaly not found" });
    return;
  }
  res.json(investigation);
});

router.post("/anomalies/:id/ask", (req, res) => {
  const params = AskCopilotParams.safeParse(req.params);
  const body = AskCopilotBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "A valid question is required" });
    return;
  }
  const investigation = getInvestigation(params.data.id);
  if (!investigation) {
    res.status(404).json({ error: "Anomaly not found" });
    return;
  }
  res.json(answerQuestion(investigation, body.data.question));
});

router.get("/sources", (_req, res) => {
  const data = loadBusinessData();
  res.json([
    { id: "razorpay", name: "Razorpay", status: "Demo connected", description: "Payments, refunds, settlements and payouts", recordCount: data.payments.length + data.refunds.length + data.settlements.length + data.payouts.length },
    { id: "commerce", name: "Commerce", status: "Demo connected", description: "Orders, products and customers", recordCount: data.orders.length + data.products.length + data.customers.length },
    { id: "support", name: "Customer Support", status: "Demo connected", description: "Customer conversations and issue categories", recordCount: data.tickets.length },
  ]);
});

router.get("/overview", (_req, res) => {
  const contextState = getContextState();
  if (contextState === "NO_CONTEXT") {
    res.json({
      contextState,
      merchant: "Business Radar",
      subtitle: "Upload your business workbook to unlock business intelligence.",
      pulse: null,
      attentionCount: 0,
      signals: [],
      razorpayHealth: [],
      businessHealth: [],
    });
    return;
  }
  const data = loadBusinessData();
  const signals = listAnomalies();
  const report = getWorkbookReport();
  const summaries = buildDatasetSummaries(data, report?.importedAt ?? null);
  const health = (items: typeof summaries.razorpay) => items
    .filter((item) => item.active)
    .map((item) => ({ label: item.name, value: item.metrics[0]?.value ?? `${item.recordCount} records` }))
    .slice(0, 5);
  res.json({
    contextState,
    merchant: report?.fileName.replace(/\.xlsx$/i, "") || "Imported business",
    subtitle: "Business context ready",
    pulse: getBusinessPulse(data),
    attentionCount: signals.slice(0, 5).filter((signal) => signal.severity !== "LOW").length,
    signals: signals.slice(0, 5),
    razorpayHealth: health(summaries.razorpay),
    businessHealth: health(summaries.business),
  });
});

router.get("/data-hub", (_req, res) => {
  const data = loadBusinessData();
  const report = getWorkbookReport();
  const recordCounts = getBusinessRecordCounts(data);
  const contextState = getContextState();
  const summaries = buildDatasetSummaries(data, report?.importedAt ?? null);
  const withAvailability = (items: typeof summaries.razorpay) => items.map((item) => {
    const available = report?.datasets[item.id]?.available ?? false;
    return { ...item, active: available, status: available ? "recognized" : "unavailable", source: available ? "Workbook" : "Not imported", lastImported: available ? report?.importedAt ?? null : null, metrics: available ? item.metrics : [] };
  });
  res.json({
    contextState,
    razorpay: withAvailability(summaries.razorpay),
    business: withAvailability(summaries.business),
    businessData: report,
    supportedSheets: ["Payments", "Refunds", "Settlements", "Payouts", "Disputes", "Customers", "Products", "Orders", "Inventory", "Expenses", "Suppliers", "Receivables", "Support"],
    contextSources: recordCounts.sources,
    totalRecords: report?.totalRecords ?? 0,
    recognizedDatasets: report?.dataHealth.recognizedDatasets ?? 0,
    contextStatus: report ? "Business context ready" : "No workbook uploaded",
    lastUpdated: report?.importedAt ?? null,
    dataHealth: report?.dataHealth ?? null,
    suggestedPrompts: suggestedPrompts(data),
  });
});

router.post("/data/import", upload.single("file"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "An .xlsx workbook is required" });
    return;
  }
  if (!req.file.originalname.toLowerCase().endsWith(".xlsx")) {
    res.status(400).json({ error: "Only .xlsx workbooks are supported" });
    return;
  }
  try {
    res.json(importWorkbook(req.file.buffer, req.file.originalname));
  } catch (error) {
    req.log.warn({ error }, "Workbook import failed");
    res.status(400).json({ error: "The workbook could not be read" });
  }
});

router.delete("/data/import", (_req, res) => {
  clearWorkbookImport();
  res.json({ contextState: "NO_CONTEXT", message: "Workbook removed" });
});

router.post("/copilot/ask", async (req, res) => {
  const body = AskBusinessCopilotBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "A valid business question is required" });
    return;
  }
  if (getContextState() === "NO_CONTEXT") {
    res.status(409).json({ error: "Upload a workbook before asking Business Copilot" });
    return;
  }
  res.json(await answerBusinessQuestion(loadBusinessData(), body.data.question));
});

export default router;