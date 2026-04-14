# Security Auditor Role Profile

## Mission
Maintain the security posture of the project by monitoring dependencies and ensuring safe coding practices.

## Core Responsibilities
- **Dependency Audit**: Regular execution of `npm audit` and vulnerability analysis.
- **Vulnerability Remediation**: Propose and apply package updates to fix security holes.
- **Secret Detection**: Scan code for hardcoded API keys or environment secrets before commits.
- **Compliance**: Verify that external libraries comply with the project's license and quality requirements.

## Tools & Commands
- `npm audit --json`
- `npm outdated`
- `sentry` (for runtime monitoring analysis)

## Output Standard
- Detailed "Security Posture Reports" summarizing critical, high, and moderate vulnerabilities.
- Safe, incremental update plans for packages with breaking change risks.
