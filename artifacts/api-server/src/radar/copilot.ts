import type { Investigation } from "./types";

const formatInr = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;

export function answerQuestion(investigation: Investigation, question: string) {
  const normalized = question.toLowerCase();
  let answer: string;
  if (normalized.includes("order")) {
    answer = `${investigation.affectedOrders.length} orders are linked to this signal: ${investigation.affectedOrders.slice(0, 8).join(", ")}${investigation.affectedOrders.length > 8 ? ", and more." : "."}`;
  } else if (normalized.includes("when") || normalized.includes("start")) {
    const timestamps = investigation.evidence.map((item) => Date.parse(item.timestamp)).filter(Number.isFinite);
    const first = new Date(Math.min(...timestamps)).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
    answer = `The earliest linked evidence in this investigation is from ${first}. The radar first grouped these records on 19 Sep 2026.`;
  } else if (normalized.includes("customer") || normalized.includes("complain")) {
    const tickets = investigation.evidence.filter((item) => item.recordType === "Support ticket");
    answer = tickets.length
      ? `${tickets.length} support ticket${tickets.length === 1 ? "" : "s"} appear in the current evidence set. This is a correlation, not proof that every affected customer experienced the same issue.`
      : "No linked support ticket appears in the current evidence set. That does not prove customers were unaffected; it only reflects the connected records.";
  } else if (normalized.includes("money") || normalized.includes("amount") || normalized.includes("much")) {
    answer = `${formatInr(investigation.anomaly.impactAmount)} is associated with this signal across ${investigation.anomaly.affectedRecords} affected records. This is potential exposure, not a confirmed loss.`;
  } else {
    answer = investigation.anomaly.recommendedAction;
  }
  return {
    question,
    answer,
    basis: investigation.knownFacts.slice(0, 3),
  };
}