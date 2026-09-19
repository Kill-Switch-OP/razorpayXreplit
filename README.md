# Business Radar

<div align="center">
  <img src="https://img.shields.io/badge/Razorpay%20%2B%20Replit-Hackathon-7C3AED?style=for-the-badge&logo=github" alt="Razorpay x Replit" />
  <br />
  <img src="https://img.shields.io/badge/Status-Prototype%20Ready-22c55e?style=flat-square" alt="Status" />
  <img src="https://img.shields.io/badge/Stack-React%20%7C%20Express%20%7C%20TypeScript-0ea5e9?style=flat-square" alt="Stack" />
  <img src="https://img.shields.io/badge/Runtime-Replit-1d4ed8?style=flat-square" alt="Replit" />
</div>

> See what your business needs next.
>
> Business Radar connects payment movement, operational signals, and merchant context into one decision layer so leaders can spot risk, explain anomalies, and act faster.

Built for the Razorpay × Replit Hackathon.

---

## Why this exists

Merchants are flooded with partial signals:

- payments succeed but settlement looks off
- inventory is low while cash is under pressure
- refunds spike in one region while support tickets rise elsewhere
- teams are left stitching the story together manually

Business Radar brings those signals together and turns them into a clear business narrative.

> Razorpay tells you where the money moved. Business Radar helps explain what that means for the business.

---

## What it does

### 1. Radar intelligence

Automatically detects high-impact business signals such as:

- payment and settlement mismatches
- cash flow stress
- inventory and replenishment risk
- receivables pressure
- refund/support anomalies
- cross-system risk patterns

### 2. Investigation flow

Each alert becomes a traceable story:

Order → Payment → Settlement → Support

You can drill into timestamps, amounts, record IDs, and derived context to understand the root cause instead of guessing.

### 3. Business Copilot

Ask natural questions and get grounded answers backed by calculations and evidence.

Examples:

- Can I afford a ₹3L inventory purchase?
- What is pressuring cash flow right now?
- Which products should be replenished first?
- Who should I chase for overdue payment?
- Why is settlement lower than payment value?

### 4. Workbook-driven context ingestion

Upload merchant Excel files and bring in operational context from the business layer:

#### Razorpay lane
- Payments
- Refunds
- Settlements
- Payouts
- Disputes

#### Business lane
- Customers
- Products
- Orders
- Inventory
- Expenses
- Suppliers
- Receivables
- Support

This context powers both the Radar and Copilot experiences.

---

## Architecture

```text
                 Business Data
                       │
         ┌─────────────┴─────────────┐
         │                           │
   Razorpay Signals          Merchant Ops Data
   Payments / Refunds        Orders / Inventory
   Settlements / Payouts     Customers / Expenses
   Disputes                  Suppliers / Support
         │                           │
         └──────────────┬────────────┘
                        ▼
                Normalization + Context
                        ▼
                    Detection Engine
                        ▼
          ┌───────────────────────┐
          │                       │
          ▼                       ▼
      Business Radar         Copilot
      Alerts + Evidence     Decision Support
          │                       │
          └──────────────┬────────┘
                         ▼
                 Investigation Flow
```

The product keeps calculations and matching logic deterministic, then uses AI as an interpretation layer for explanation and synthesis.

---

## Stack

- Frontend: React, Vite, TypeScript
- Backend: Node.js, Express, TypeScript
- Data import: XLSX workbook parsing
- AI layer: OpenAI-compatible API with deterministic fallback
- Validation: Zod + generated API clients
- UI: Tailwind CSS, Radix UI, Recharts, Lucide icons
- Repo toolchain: pnpm monorepo
- Runtime: Replit

---

## Repository structure

```text
.
├── artifacts/
│   ├── business-radar/     # React frontend
│   └── api-server/         # Express API + intelligence logic
├── lib/
│   ├── api-client-react/   # Generated frontend client
│   ├── api-spec/           # OpenAPI contract
│   ├── api-zod/            # Type-safe schema layer
│   └── db/                 # Database layer
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── tsconfig.json
├── README.md
└── .gitignore
```

---

## Getting started

### Prerequisites

- Node.js
- pnpm

### Install dependencies

```bash
pnpm install
```

### Run type checks

```bash
pnpm run typecheck
```

### Build the workspace

```bash
pnpm run build
```

The project is designed to run smoothly inside Replit with the current workspace setup.

---

## AI configuration

The Copilot layer can use an OpenAI-compatible API when the following environment variables are present:

```bash
AI_INTEGRATIONS_OPENAI_API_KEY=...
AI_INTEGRATIONS_OPENAI_BASE_URL=...
```

If those values are unavailable, the app falls back to deterministic logic so the product still remains functional and trustworthy.

---

## Demo flow

1. Open the Business Radar frontend.
2. Upload a merchant workbook from the Data page.
3. Let the app detect the available source data.
4. Run a scan in the Radar view.
5. Open a signal to inspect evidence and relationships.
6. Ask a business question in Copilot.
7. Review the answer, supporting evidence, and recommended next step.

---

## Design principle

Business Radar is not another generic chatbot and not just another dashboard.

Its mission is the layer between systems:

data → relationships → signal → explanation → decision

---

## Hackathon context

This project was built and prototyped on Replit for the Razorpay × Replit Hackathon.

It is intended as a concept demo and product prototype in that context.

---

## License

MIT
