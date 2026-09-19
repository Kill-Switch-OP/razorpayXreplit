# Business Radar

> **See what your business needs next.**
>
> A cross-system business intelligence layer that connects Razorpay payment context with orders, inventory, customers and operations to surface signals that individual systems can miss.

Built for the **Razorpay × Replit Hackathon**.

## The problem

Merchants already have dashboards for payments, orders, inventory, support and accounting. The harder problem is connecting those signals.

A payment platform can tell you a payment succeeded. An inventory system can tell you stock is low. A support system can tell you customers are complaining. The merchant still has to connect the dots and decide what matters.

**Business Radar connects the dots.**

> Razorpay tells you where the money moved. Business Radar helps explain what that means for the business.

## What it does

### 1. Business Radar

Automatically surfaces high-value signals across the merchant's data, such as:

- payment and settlement inconsistencies
- cash pressure
- inventory and replenishment risk
- overdue receivables
- refund and customer-support patterns
- cross-system anomalies

### 2. Investigation

Turns an alert into an evidence trail. A merchant can trace an issue across entities such as:

`Order → Payment → Settlement → Support`

and inspect the underlying record IDs, amounts and timestamps.

### 3. Business Copilot

Answers business questions using trusted calculations and relevant evidence, with an optional OpenAI-compatible integration and deterministic fallback.

Example questions:

- Can I afford a ₹3L inventory purchase?
- What's putting my cash flow under pressure?
- Which products should I restock first?
- Who should I chase for payment?
- Why is settlement value lower than payment value?

### 4. Excel Business Context

Upload an `.xlsx` workbook and Business Radar can import merchant operational datasets such as:

**Razorpay lane**
- Payments
- Refunds
- Settlements
- Payouts
- Disputes

**Business lane**
- Customers
- Products
- Orders
- Inventory
- Expenses
- Suppliers
- Receivables
- Support

The imported records become the context used by the Radar and Copilot flows.

## Architecture

```text
                Business Data
                     │
        ┌────────────┴────────────┐
        │                         │
     Razorpay                Business Data
   Payments/Refunds          Orders/Inventory
   Settlements/Payouts       Customers/Expenses
   Disputes                  Suppliers/Support
        │                         │
        └────────────┬────────────┘
                     ▼
              Normalization
                     ▼
            Detection + Context
                     ▼
          ┌──────────┴──────────┐
          ▼                     ▼
        Radar                Copilot
          │                     │
          ▼                     ▼
   Investigation          Decision Support
```

The core design principle is to keep trusted calculations and matching logic deterministic, then use the language model for interpretation, synthesis and explanation.

## Tech stack

- **Frontend:** React, TypeScript, Vite
- **Backend:** Node.js, Express, TypeScript
- **Data import:** `xlsx` workbook parsing
- **AI:** OpenAI-compatible API with deterministic fallback
- **Data/API validation:** Zod / generated API client
- **UI:** Tailwind CSS, Radix UI, Lucide icons, Recharts
- **Workspace:** pnpm monorepo
- **Runtime:** Replit

## Project structure

```text
artifacts/
  business-radar/     # React frontend
  api-server/         # Express API and intelligence layer
lib/
  api-client-react/   # Generated frontend API client
  api-spec/           # OpenAPI contract
```

## Getting started

### Prerequisites

- Node.js
- pnpm

### Install

```bash
pnpm install
```

### Run checks

```bash
pnpm run typecheck
```

### Build

```bash
pnpm run build
```

The workspace is designed to run inside Replit with the existing workspace configuration.

## AI configuration

The Copilot can use an OpenAI-compatible API when these environment variables are available:

```text
AI_INTEGRATIONS_OPENAI_API_KEY=...
AI_INTEGRATIONS_OPENAI_BASE_URL=...
```

If the AI integration is unavailable, Business Radar falls back to trusted deterministic responses so the core product remains usable.

## Demo flow

1. Open Business Radar.
2. Upload a merchant `.xlsx` workbook from the **Data** page.
3. Business Radar recognizes the available data sources.
4. Scan the business in **Radar**.
5. Open a signal to inspect its evidence chain.
6. Ask a business question in **Copilot**.
7. Review the calculated answer, evidence and recommended next step.

## Design principle

Business Radar is intentionally not another generic chatbot or another payment dashboard.

The product focuses on the layer between systems:

**data → relationships → signal → explanation → decision**

## Hackathon note

This project was built and prototyped on **Replit** for the **Razorpay × Replit Hackathon**.

Razorpay and Replit are referenced in the context of the hackathon and platform integration concept; this repository does not claim an official endorsement or partnership beyond the event context.

## License

MIT
