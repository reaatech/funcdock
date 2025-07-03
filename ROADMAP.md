# FuncDock Roadmap

This document outlines potential future features and enhancements for FuncDock, an open-source serverless FaaS platform. These are ideas for community discussion and prioritization.

---

## Core Platform
- **Function Versioning & Rollbacks**: Deploy and manage multiple versions of a function, with easy rollback support.
- **Environment Variable Management**: Secure UI for managing environment variables and secrets per function.
- **Custom Domains & HTTPS**: Map custom domains to functions, with automated SSL (e.g., Let's Encrypt).
- **Language & Runtime Extensibility**: Support more languages (Python, Go, Rust, etc.) and custom Docker images.

## Developer Experience
- **Advanced Metrics & Monitoring**: Real-time dashboards for invocations, errors, cold starts, memory/CPU usage. Integrations with Prometheus, Grafana, or OpenTelemetry.
- **Integrated Logs & Tracing**: Centralized, searchable logs and distributed tracing for debugging.
- **Function Debugging & Live Testing**: Live test console, request/response simulation, and step-through debugging.
- **Documentation & Onboarding**: In-app onboarding, tooltips, guided tours, and auto-generated API docs.
- **CLI & API Enhancements**: More powerful CLI and public REST API for automation and CI/CD.

## Security & Access
- **Authentication & Authorization**: API keys, JWT, OAuth2, or custom auth providers. Per-function/route access controls.
- **Secrets Integration**: Support for external secrets managers (e.g., HashiCorp Vault, AWS Secrets Manager).

## Events & Integrations
- **Event Sources & Triggers**: Support for HTTP, cron, webhooks, message queues (Kafka, RabbitMQ), cloud storage events, etc.
- **UI for Triggers**: Visual configuration of event sources and bindings.
- **Function Marketplace / Templates**: Library of pre-built/community-contributed function templates.

## Collaboration & Multi-Tenancy
- **Multi-Tenancy & Teams**: Organizations, teams, user roles, shared function ownership, audit logs, and activity feeds.

## Scalability & Deployment
- **Edge/Hybrid Deployments**: Deploy functions to edge locations (Cloudflare Workers, Fly.io, etc.) and hybrid cloud/on-premise.
- **Billing & Quotas (for SaaS)**: Usage tracking, quotas, and billing integration for commercial offerings.

---

**Note:**
- Feature order does not indicate priority.
- Community feedback and contributions are welcome!
- If you have ideas or want to help, open an issue or join the discussion. 