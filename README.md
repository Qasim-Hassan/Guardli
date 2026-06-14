# Guardli 🛡️

**Guardli** is an automated, AI-powered content moderation agent designed to monitor online communities in real time. By streaming raw communication data directly via platform APIs and processing text content through advanced language models, Guardli detects rule-breaking content, evaluates context, and instantly executes defensive moderation actions to keep digital spaces clean and safe.

---

## 🚀 Key Features

* **Real-Time Data Streaming:** Leverages low-latency platform streams to intercept messages, posts, and comments the moment they are published.
* **Intelligent Content Evaluation:** Integrates with state-of-the-art LLMs via the Google GenAI SDK to understand contextual nuance, spam, and policy violations beyond simple keyword matching.
* **High-Availability API Key Rotation:** Built with a resilient backend architecture that automatically detects API rate limits or exhaustion and switches to secondary credential sets seamlessly without system downtime.
* **Automated Action Execution:** Instantly fires moderation dispatches (removals, flags, or logs) back to the target community space via secure webhooks and API endpoints.

---

## 🛠️ System Architecture

Guardli splits its operations into two decoupled execution domains to ensure scalability and ease of deployment:

1.  **The Infrastructure & Ingestion Layer:** Manages the active real-time data connection, tracks administrative credentials, handles error reporting thresholds, and enforces structural action requests (e.g., automated removals).
2.  **The Intelligence & Logic Layer:** Manages advanced prompt routing topologies, formats inputs securely into structured JSON payloads, communicates with upstream LLM interfaces, and parses response variables into definitive actions.

---

# Guardli
AI Moderation Agent

Run with:

> uvicorn app.main:app --reload
