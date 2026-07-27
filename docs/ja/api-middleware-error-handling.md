# API ミドルウェア・アーキテクチャと標準エラーハンドリング

このドキュメントでは、**scripture-habit** のサーバーレスバックエンドアーキテクチャ（`api/api.ts` および `api_internal/` 下の Vercel Serverless Functions を介して管理）について、技術的な詳細を解説します。

具体的には、ゲートウェイ検証チェーン、CORSポリシー、末尾スラッシュの正規化、多層ミドルウェアパイプライン、カスタムエラー分類、および自動エラー緩和とSentryを用いたオブザーバビリティパターンについて詳しく説明します。

---

## 🛰️ 1. Expressゲートウェイとルーティングミドルウェア

バックエンドは、軽量なAPIコントローラーとして機能する統合Expressゲートウェイ（`api/api.ts`）を使用します。サーバーレス環境におけるパフォーマンスを最大化し、コールドスタート時間を低く抑えるため、SentryおよびFirebase SDKは即座に初期化（Eager Initialization）されます（※Sentryの自動インストルメンテーションを有効にするため、Expressやルートのインポートより前の最上部で `Sentry.init` が実行されます）。ルーターとミドルウェアは厳格なセキュリティ優先の階層でマウントされます。

### CORSとオリジン検証マトリクス
標準的なWebクライアント、自動化されたプレビュー環境、およびローカル開発サーバーが、任意のクロスオリジンスクリプトの実行を許可することなく安全にAPIをクエリできるように、CORSポリシーは動的な正規表現を評価します。

| 環境 | 許可されるオリジン形式 | 目的 |
| :--- | :--- | :--- |
| **本番環境 Web** | `https://scripturehabit.app` / `...vercel.app` | 標準のメインWebドメイン。 |
| **ローカル開発環境** | `http://localhost:[port]` / `127.0.0.1:[port]` | HMR（ホットリロード）およびローカルテスト。 |
| **Vercelプレビュー** | `https://scripture-habit-[hash].vercel.app` | GitHubプルリクエストによる自動デプロイプレビュー。 |

### パス正規化（Vercel末尾スラッシュ問題の修正）
Vercelのホスティング設定では、末尾にスラッシュが追加されることが多く（例: `/api/auth` の代わりに `/api/auth/`）、これがルーティングの不一致を引き起こす原因になります。ルートの重複定義を防ぐため、�  - **ハッシュ化されたキー**: レート制限違反時のサーバーログダンプに、生のクライアントIPアドレスや認証トークンが露出するのを防ぐため、キー生成器はバケットカウントを適用する前に SHA-256 を使用して識別子をハッシュ化します。信頼できるリバースプロキシで設定される `req.ip` を最優先とし、未設定時のみ `x-forwarded-for` やソケット通信アドレスへ安全にフォールバックします。
    ```typescript
    export const aiLimiterKeyGenerator = (req: Request) => {
        const authHeader = req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return crypto.createHash('sha256').update(authHeader).digest('hex');
        }
        // Express req.ip を最優先とし、未設定時のみ x-forwarded-for へフォールバック
        const rawForward = req.headers['x-forwarded-for'];
        const forwardedIp = Array.isArray(rawForward) ? rawForward[0] : rawForward?.split(',')[0];
        const clientIp = (req.ip || forwardedIp || req.socket.remoteAddress || 'unknown').trim();
        return crypto.createHash('sha256').update(clientIp).digest('hex');
    };
    ```

### 2. Firebase App Check セキュリティ (`verifyAppCheck`)
App Check トークン（`X-Firebase-AppCheck` ヘッダー）を強制することで、スクレイピングやリプレイ攻撃からバックエンドAPIを保護します。
- **開発用バイパス**: ローカル開発やユニットテストでは、開発者は `.env.local` 内に `SKIP_APP_CHECK=true` を設定できます。
- **本番環境ガード**: 本番環境で `SKIP_APP_CHECK=true` が要求された場合、ミドルウェアは即座にこのバイパスを遮断してリクエストをブロックし、バックドアを防ぐための重大なセキュリティアラートをトリガーします。

### 3. Firebase Auth 検証 (`authenticate`)
`Authorization` ヘッダーから Bearer JWT トークンをインターセプトし、Firebase Admin SDK (`auth.verifyIdToken`) を介してデコードし、リクエストコンテキスト上の `req.user`（型は `DecodedIdToken`）に入力します。
- **厳格な署名検証バイパスガード**: 未検証トークンの Base64 デコードフォールバックは、明示的なテスト・エミュレータ環境（`VITEST === 'true'` または `FIREBASE_AUTH_EMULATOR_HOST`）でのみ許可されます。通常の開発サーバーや本番環境でのバイパスは禁止され、偽造 JWT トークンによる攻撃を防御します。imit`)
システムは3つの異なるレート制限ゾーンを管理し、本番環境と開発環境の文脈に基づいて動的にしきい値をスケーリングします。

* **グローバル制限 (Global Limiter)**: 本番環境では一般的なエンドポイントへのアクセスを15分あたり `300` 回に制限します（開発環境では `10,000` 回に引き上げられます）。
* **招待制限 (Invite Limiter)**: グループへの参加や招待リンクの生成を1時間あたり `15` 回に制限します（コードの総当たり攻撃を防止します）。
* **プライバシーハッシュ付き AI 制限**: Gemini を利用するタスク（週次振り返り、チャット翻訳）を1時間あたり `100` 回に制限します。
  - **分散制限 (Redis 連携)**: 本番環境で環境変数 `REDIS_URL` が設定されている場合、すべてのレート制限器は自動的に RedisStore（Upstash 等）に接続され、サーバーレス関数の複数並列インスタンス間でカウントが同期されます（未設定時は自動でインメモリ制限にフォールバックします）。
  - **ハッシュ化されたキー**: レート制限違反時のサーバーログダンプに、生のクライアントIPアドレスや認証トークンが露出するのを防ぐため、キー生成器はバケットカウントを適用する前に SHA-256 を使用して識別子をハッシュ化します。また、リバースプロキシ配下でのハッシュの一貫性を保つため、`x-forwarded-for` チェーンから最初のクライアントIPアドレスを正確に分離・抽出します。
    ```typescript
    export const aiLimiterKeyGenerator = (req: Request) => {
        const authHeader = req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return crypto.createHash('sha256').update(authHeader).digest('hex');
        }
        // プロキシ配下での安定性向上のため、x-forwarded-forチェーンから最初のクライアントIPを抽出
        const rawForward = req.headers['x-forwarded-for'];
        const clientIp = (Array.isArray(rawForward) ? rawForward[0] : rawForward?.split(',')[0] || req.ip || req.socket.remoteAddress || 'unknown').trim();
        return crypto.createHash('sha256').update(clientIp).digest('hex');
    };
    ```

### 2. Firebase App Check セキュリティ (`verifyAppCheck`)
App Check トークン（`X-Firebase-AppCheck` ヘッダー）を強制することで、スクレイピングやリプレイ攻撃からバックエンドAPIを保護します。
- **開発用バイパス**: ローカル開発やユニットテストでは、開発者は `.env.local` 内に `SKIP_APP_CHECK=true` を設定できます。
- **本番環境ガード**: 本番環境で `SKIP_APP_CHECK=true` が要求された場合、ミドルウェアは即座にこのバイパスを遮断してリクエストをブロックし、バックドアを防ぐための重大なセキュリティアラートをトリガーします。

### 3. Firebase Auth 検証 (`authenticate`)
`Authorization` ヘッダーから Bearer JWT トークンをインターセプトし、Firebase Admin SDK (`auth.verifyIdToken`) を介してデコードし、リクエストコンテキスト上の `req.user`（型は `DecodedIdToken`）に入力します。

### 4. カスタムメール確認ガード (`requireEmailVerified`)
パスワードベースのログインを行うユーザーが、グループデータにアクセスする前にアクティベーションフローを完了していることを強制します。
- Google ソーシャル認証を介してサインインするユーザーは、このチェックを自動的にバイパスします。
- **E2Eおよびテスト用バイパス**: CI/CD パイプラインにおける自動テストをシームレスに行うため、末尾が `@example.com` または `@test.local` であるドメインを持つアカウントは、この検証を自動的にバイパスし、不安定なテスト状態を防ぎます。

---

## 🩹 3. 標準化された AppError と例外エンジン

バックエンドは、場当たり的な `res.status(X).send()` によるエラー返却を排除しています。代わりに、カスタム `AppError` クラス階層を利用して、データベースの競合、権限違反、およびバリデーションエラーをモデル化します。

### エラー階層 (`api_internal/lib/errors.ts`)
```
         [ Error (Native) ]
                 │
                 ▼
            [ AppError ] (statusCode, errorCode)
                 │
  ┌──────────────┼──────────────┬──────────────┐
  ▼              ▼              ▼              ▼
ValidationError AuthenticationError ForbiddenError NotFoundError
```

- **`ValidationError`** (400, `'VALIDATION_ERROR'`): 送信されたリクエストボディの検証スキーマ（`zod` を使用）がチェックに合格しなかった場合にトリガーされます。
- **`AuthenticationError`** (401, `'UNAUTHENTICATED'`): JWT が欠落しているか期限切れです。
- **`ForbiddenError`** (403, `'FORBIDDEN'`): 有効な認証情報を持っているものの、必要な権限がない場合（例: 別のグループの履歴を読み取るなど）、またはメールアドレスが確認されていない場合に発生します。
- **`NotFoundError`** (404, `'NOT_FOUND'`): 指定されたグループ、ユーザープロファイル、またはメッセージが存在しません。
- **`ConflictError`** (409, `'CONFLICT'`): トランザクションの衝突（例: グループ招待リンクの重複など）が発生した場合に発生します。

---

## 🚦 4. グローバルエラー緩和と Sentry の統合

ルーターの内部でスローされた未処理の例外は、グローバルな Express エラーミドルウェアに伝播します。このミドルウェアにより、クライアントに対する完全な安全性とオブザーバビリティが保証されます。

### 1. 情報漏洩のないスクラビング（本番環境 vs. 開発環境）
未知の例外（データベースの切断、実行時構文エラーなど）が発生した場合：
- **開発環境**: 診断作業を高速化するため、生のスタックトレースがクライアントに返されます。
- **本番環境**: ミドルウェアは詳細情報を消去（スクラビング）し、生の SQL/Firestore 接続情報などを隠蔽した上で、クリーンな JSON ペイロードに置き換えます。
  ```json
  {
    "error": "InternalServerError",
    "message": "An unexpected error occurred",
    "requestId": "e3b0c442..."
  }
  ```

### 2. `x-request-id` によるリクエスト追跡
すべてのエラーレスポンスは、相関ID（`x-request-id` ヘッダーまたは生成されたフォールバック）を返します。この ID は、カスタマーサポートへの問い合わせと、Google Cloud Logging や Sentry の対応するサーバー実行ログを直接結びつけます。ゲートウェイの最前段で `x-request-id` がない場合に UUID (`crypto.randomUUID()`) を自動生成してヘッダーおよびレスポンスに注入するカスタムミドルウェアが有効化されているため、すべてのリクエストで確実に一意な追跡が可能です。

### 3. Sentry キャプチャパイプライン
Express ゲートウェイは、標準ルーターの前に `Sentry.setupExpressErrorHandler(app)` をマウントします。エラーが検出されると：
1. Sentry は自動的にエラーコンテキストをキャプチャします。
2. ユーザーID（`req.user.uid`）と相関ID `requestId` がメタデータタグとして追加されるため、開発者はどのクライアントで例外が発生したのかを正確に追跡・特定できます。
