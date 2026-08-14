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

---

# セキュリティポリシー (Security Policy)

## サポートされているバージョン

セキュリティ修正は、アクティブな `main` ブランチおよび稼働中の本番環境に適用されます。

| バージョン | サポート状況 |
| ------- | ------------------ |
| main    | :white_check_mark: |
| < 1.0.0 | :x:                |

---

## 脆弱性の報告方法

私たちは Scripture Habit とそのユーザーのセキュリティを重視しています。セキュリティ上の脆弱性を発見したと思われる場合は、責任ある報告をお願いいたします。

### 報告手順

セキュリティ上の脆弱性を **公開の GitHub Issue に投稿しないでください。**

代わりに、以下のいずれかの方法でご報告ください：

1. **GitHub Private Vulnerability Reporting（非公開報告機能）**:
   本リポジトリの **Security** タブに移動し、**"Report a vulnerability"** をクリックしてメンテナーに非公開アドバイザリを直接送信してください。
2. **非公開での連絡**:
   上記機能が利用できない場合は、GitHub Discussions やメンテナーへの直接連絡により非公開でご連絡ください。

### 報告に含めていただきたい情報

迅速なトリアージと修正のため、以下の情報を含めてください：
* 脆弱性の明確な説明と潜在的な影響
* 問題を再現するための具体的な手順（PoCスクリプト、スクリーンショット、リクエスト内容など）
* 影響を受けるコンポーネントまたはエンドポイント（API エンドポイント、Firestore ルール、クライアントコードなど）
* 考えられる修正案や回避策（もしあれば）

### 報告後の対応フロー

* **受領確認**: 報告を受け取ってから 48 時間以内に受領確認のご連絡をいたします。
* **調査・検証**: 脆弱性を調査・検証し、進捗状況をお知らせします。
* **修正と開示**: 修正が完了して本番環境に適用された後、必要に応じてセキュリティアドバイザリを公開します（匿名を希望されない限り、報告者へのクレジットを記載いたします）。

