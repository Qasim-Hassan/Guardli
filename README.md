# Guardli 🛡️

**Guardli** is an automated, AI-powered content moderation agent designed to monitor reddit communities in real time. By streaming raw communication data directly via platform APIs and processing text content through advanced language models, Guardli detects rule-breaking content and instantly executes defensive moderation actions to keep digital spaces clean and safe.

---

## 🚀 Key Features

* **Real-Time Data Streaming:** Leverages official APIs to fetch posts and comments as soon as they are published.
* **Intelligent Content Evaluation:** Integrates with state-of-the-art LLMs via the Google GenAI SDK to understand contextual nuance, spam, and policy violations beyond simple keyword matching.
* **Automated Action Execution:** Instantly fires moderation dispatches (removals, flags, or logs) back to the target community space via API endpoints.

---

## 🛠️ System Architecture

Guardli is a **Monorepo** that is broken down into two different systems under the hood:

1.  **The Infrastructure & Ingestion Layer:** Manages the active real-time data connection, tracks administrative credentials, handles error reporting thresholds, and enforces structural action requests (e.g., automated removals).
2.  **The Intelligence & Logic Layer:** Manages advanced prompt routing topologies, formats inputs securely into structured JSON payloads, communicates with upstream LLM interfaces, and parses response variables into definitive actions.

---

# Run with:

Navigate to /reddit-app/guardli-ai and run:

> npm run dev
