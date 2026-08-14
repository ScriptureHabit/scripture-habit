# Security Policy

## Supported Versions

Security updates are applied to the active `main` branch and the live production deployment.

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |
| < 1.0.0 | :x:                |

---

## Reporting a Vulnerability

We take the security of Scripture Habit and its users seriously. If you believe you have found a security vulnerability, please report it responsibly.

### How to Report

Please **do not report security vulnerabilities through public GitHub issues.**

Instead, please report security issues using one of the following methods:

1. **GitHub Private Vulnerability Reporting**:
   Navigate to the **Security** tab of the repository and click **"Report a vulnerability"** to submit a private advisory directly to maintainers.
2. **Direct Contact**:
   If Private Vulnerability Reporting is unavailable, you can reach out directly via GitHub discussions or contact the maintainer privately.

### What to Include in Your Report

To help us triage and resolve the issue quickly, please include:
- A clear description of the vulnerability and its potential impact.
- Step-by-step instructions to reproduce the issue (proof of concept script, screenshots, or request payloads).
- The affected component or endpoint (e.g. API endpoint, Firestore rule, or client code).
- Any potential remediations or suggestions you may have.

### What to Expect

- **Acknowledgement**: We will acknowledge receipt of your report within 48 hours.
- **Assessment**: We will investigate and verify the vulnerability, keeping you informed of our progress.
- **Fix & Disclosure**: Once a fix is developed and verified, we will deploy it to production and publish an advisory if appropriate, with credit given to the reporter (unless you prefer to remain anonymous).
