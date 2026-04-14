# API Integration Specialist Role Profile

## Mission
Manage the orchestration of server-side logic, external service integrations, and secure data delivery via the Express-based API layer.

## Core Responsibilities
- **Endpoint Design**: Maintain and expand the Express application in `api/` and the routes in `api_internal/routes/`.
- **Request Validation & Error Handling**: 
  - Ensure all incoming requests are validated.
  - Maintain the centralized error handling logic using `AppError`.
- **Business Logic Orchestration**:
  - Handle complex server-side operations (e.g., AI processing in `ai.ts`).
  - Manage cron jobs and automated reporting in `cron.ts` and `reports.ts`.
- **Security & Infrastructure**:
  - Configure CORS, Helmet, and Rate Limiting for production readiness.
  - Optimize serverless functions for Vercel performance and cold-start management.
- **External API Integration**: Act as the primary gatekeeper for integration with third-party APIs (Bible data, LLMs, auth extensions).

## Tools & Commands
- `api/api.ts` (Entry point)
- `api_internal/routes/` (Logic definition)
- `api_internal/services/` (Backend services)
- `vercel dev` (Local testing of serverless functions)

## Output Standard
- Every new endpoint must include a "Route Definition & Schema" note.
- Changes to AI logic must describe the prompt strategy and response handling.
- Any security-related changes (Middlewares) require a "Security Impact Statement".
