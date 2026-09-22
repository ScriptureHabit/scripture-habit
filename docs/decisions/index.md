# Architecture Decision Records (ADRs)

This directory documents the key architectural decisions that shape the **Scripture Habit** platform.

Following the principles of [Documentation and ADRs](https://github.com/addyosmani/agent-skills/blob/main/skills/documentation-and-adrs/SKILL.md), each ADR records the **context**, **decision**, **alternatives considered**, and **consequences** behind major architectural choices.

---

## Decision Log

| ID | Title | Status | Date |
| :--- | :--- | :--- | :--- |
| [**ADR-001**](./ADR-001-cqrs-realtime-read-backend-mutation.md) | CQRS Architecture with Real-Time Subscriptions & Backend-Enforced Mutations | `Accepted` | 2026-04-10 |
| [**ADR-002**](./ADR-002-frontend-logic-component-split.md) | Frontend Logic-Component Split via Dedicated Custom Hooks | `Accepted` | 2026-05-15 |
| [**ADR-003**](./ADR-003-offline-strategy-application-queues.md) | Application-Level Scoped Message Queuing over Workbox BackgroundSync | `Accepted` | 2026-09-22 |
| [**ADR-004**](./ADR-004-multilingual-hybrid-translation.md) | Hybrid Multilingual Strategy: Static i18n Dictionaries & On-Demand AI Translation | `Accepted` | 2026-06-20 |
| [**ADR-005**](./ADR-005-cumulative-milestone-habit-psychology.md) | Cumulative Milestone Habit Model over Punitive Streak Resets | `Accepted` | 2026-07-01 |

---

## Status Legend

- **`Proposed`**: Under team discussion or experimental evaluation.
- **`Accepted`**: Approved and actively implemented across the codebase.
- **`Superseded`**: Replaced by a newer decision (references the superseding ADR).
- **`Deprecated`**: No longer active or recommended.

---

## How to Propose a New ADR

1. Copy the standard template below into a new file `docs/decisions/ADR-XXX-<slug>.md`.
2. Increment the ID sequence number.
3. Detail the technical context, requirements, trade-offs, and rejected alternatives.
4. Submit via Pull Request for architectural review.
5. Update this index table and `docs/.vitepress/config.mts`.

### Template

```markdown
# ADR-XXX: [Short Imperative Title]

## Status
Proposed | Accepted | Superseded by ADR-YYY | Deprecated

## Date
YYYY-MM-DD

## Context
[Describe the problem, operational constraints, business goals, and technical requirements.]

## Decision
[Explain what choice was made and why it best satisfies the context.]

## Alternatives Considered

### [Alternative 1]
- **Pros**: ...
- **Cons**: ...
- **Why Rejected**: ...

### [Alternative 2]
- **Pros**: ...
- **Cons**: ...
- **Why Rejected**: ...

## Consequences
- **Positive**: ...
- **Negative / Trade-offs**: ...
- **Mitigations**: ...
```
