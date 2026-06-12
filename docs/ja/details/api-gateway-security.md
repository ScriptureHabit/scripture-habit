# 🔬 詳細解説：App Check と API ゲートウェイ保護セキュリティ

本ドキュメントでは、Scripture Habit のAPIサーバー（Vercelサーバーレス）を悪意のある攻撃やスパムアクセスから保護する**「APIゲートウェイセキュリティ」**、およびモバイル環境での開発・テストを両立させる**「例外バイパス設計」**について、詳細に解説します。

---

## 🛡️ 多層防御セキュリティトポロジー

Scripture Habit のバックエンドAPIは、段階的にセキュリティレベルを引き上げる**多層防御（Defense in Depth）**を採用しています。リクエストがコントローラー（ビジネスロジック）に届くまでに、最大5層のフィルターを通過する必要があります。

1. **CORS 検証**: 不正なオリジン（ドメイン）からのブラウザ経由のアクセスを排除。
2. **Rate Limiting（レート制限）**: DDoS攻撃やAPIの過剰呼び出しを遮断。プライバシーを配慮したハッシュ型を採用。
3. **Firebase App Check**: 非公式アプリや直接のAPIリクエスト（Curl、Postman等）を強力に排除。
4. **Bearer JWT 認証（Firebase Auth）**: 有効なサインインを行った個別ユーザーを特定。
5. **メール認証確認（Email Verified）**: パスワードベースのユーザーにのみメール確認を強制。

---

## 🔄 API リクエスト検証シーケンス

以下は、リクエストがゲートウェイを通過してコントローラーに届くまでのアトミックな検証順序です（ダークモード等の背景色を考慮した高コントラスト表示となっています）。

```mermaid
sequenceDiagram
    autonumber
    actor Client as クライアント (App)
    participant Limiter as レートリミッター
    participant AppCheck as App Check検証
    participant JWT as JWT認証 (Auth)
    participant Email as メール認証確認
    participant Controller as コントローラー (API)

    Client->>Limiter: APIリクエストの送信
    
    Note over Limiter: SHA-256 ハッシュキー生成<br/>(トークンまたはクライアントIP)
    alt レート制限を超過している場合 (Limit Exceeded)
        Limiter-->>Client: 429 Too Many Requests
    else 制限内
        Limiter->>AppCheck: 次のミドルウェアへ
    end

    alt SKIP_APP_CHECK == 'true' (かつ開発環境)
        AppCheck->>JWT: 検証をバイパス
    else 通常検証
        Note over AppCheck: X-Firebase-AppCheck<br/>ヘッダーのトークンを検証
        alt トークン無効 / 存在しない
            AppCheck-->>Client: 401 Unauthorized
        else トークン有効
            AppCheck->>JWT: 次のミドルウェアへ
        end
    end

    Note over JWT: Authorization ヘッダーの<br/>Bearer トークンを検証
    alt トークン無効 / 期限切れ
        JWT-->>Client: 401 Unauthorized
    else トークン有効
        Note over JWT: req.user にデコードトークンをセット
        JWT->>Email: 次のミドルウェアへ
    end

    alt テストアカウント (@example.com / @test.local)
        Email->>Controller: 検証をバイパス
    else 通常アカウント
        alt サインインプロバイダー == 'password' かつ 未確認
            Email-->>Client: 403 Forbidden (未認証エラー)
        else 確認済み または 他のプロバイダー (Google等)
            Email->>Controller: ゲートウェイ通過！
        end
    end

    Controller-->>Client: ビジネスロジック処理結果の返却
```

---

## 🔒 Firebase App Check 検証と本番ガード

Firebase **App Check** は、公式に登録されたアプリケーション（Viteフロントエンドや Capacitor モバイルバイナリ）から送信されたリクエストであるかを検証する防御システムです。

### 堅牢な「本番セキュリティガード」の設計
モバイルエミュレータを用いたローカル開発中、App Check を通過することは困難です。そのため開発環境用に `SKIP_APP_CHECK` 環境変数が用意されていますが、**これが本番環境（`NODE_ENV === 'production'`）で誤って有効化された場合、バックエンドの防御が完全に無効化されるという重大なセキュリティリスク**が発生します。

これを防止するため、`verifyAppCheck` ミドルウェアには**「本番ガード」**が二重に仕込まれています。

```typescript
// 本番（production）かつ SKIP_APP_CHECK が有効な場合、警告を出しリクエストを強制ブロック
if (skipRequested) {
    if (isProduction) {
        console.error('[SECURITY ALERT] SKIP_APP_CHECK is enabled in production! This is forbidden.');
        return res.status(401).json({ error: 'Unauthorized: Security check required' });
    }
    console.warn('[AppCheck] Skipping verification (Development only)');
    return next();
}
```

---

## ⚙️ 開発・テスト時のバイパス判定フロー

セキュリティを高めつつ、**「開発時の開発効率」**と**「Playwright による CI/CD E2E テストの完全自動化」**を両立するためのバイパス決定木は以下の通りです。

```mermaid
flowchart TD
    Request([API リクエスト受信]) --> AppCheckStep{1. App Checkの検証}
    
    %% App Check 分岐
    AppCheckStep --> SkipRequested{SKIP_APP_CHECK == 'true' か？}
    SkipRequested -- はい --> CheckProd{NODE_ENV == 'production' か？}
    CheckProd -- はい (本番エラー) --> Block401([401 Unauthorized を返却])
    CheckProd -- いいえ (開発環境) --> BypassAppCheck[App Check検証をスキップ]
    
    SkipRequested -- いいえ --> VerifyToken[Firebase Admin SDK でトークンを検証]
    VerifyToken -- 検証失敗 --> Block401
    VerifyToken -- 検証成功 --> AuthStep[2. JWT 認証ステップへ]
    BypassAppCheck --> AuthStep

    %% JWT & メール認証分岐
    AuthStep --> DecodedToken[トークンをデコードして req.user に格納]
    DecodedToken --> EmailStep{3. メール認証確認}
    
    EmailStep --> TestAccount{テストドメインアカウント<br/>(@example.com / @test.local)<br/>かつ !isProd か？}
    TestAccount -- はい (Playwrightテスト) --> BypassEmail[メール認証をスキップ]
    TestAccount -- いいえ --> ProviderCheck{ログイン方法は 'password'<br/>(メール・パスワード) か？}
    
    ProviderCheck -- いいえ (Google等の外部連携) --> Allowed([処理をコントローラーへ引き渡す])
    ProviderCheck -- はい --> CheckVerified{email_verified == true か？}
    
    CheckVerified -- はい --> Allowed
    CheckVerified -- いいえ --> Block403([403 Forbidden を返却])
    BypassEmail --> Allowed
```

---

## 🛡️ プライバシーを配慮したハッシュ型レートリミット

API サーバーに送られてくるリクエストを制限する際、一般的な IP アドレスベースのレートリミットは、サーバーのログやメモリ上に**生（プレーンテキスト）のIPアドレス**を保持してしまい、GDPR等のプライバシー規制において懸念事項となります。また、IPv6 やリバースプロキシを介したアクセスでは正しい判定ができない問題もあります。

Scripture Habit では、**SHA-256 による暗号ハッシュ型レートリミット**（`aiLimiterKeyGenerator`）を採用しています。

### メリットと設計決定
- **暗号ハッシュ化**: `Authorization` トークン、またはクライアントIPアドレスを SHA-256 でハッシュ化した値（ヘキサ文字列）をキーとして使用します。生のIPアドレスや個人情報はメモリ上にもログ上にも残らないため、**高いプライバシー性**が保証されます。
- **IPv6 とプロキシの標準化**: `req.headers['x-forwarded-for']` などのプロキシヘッダーから抽出されたクライアント情報を安全にハッシュ化するため、Vercelなどのサーバーレス環境や CDN ロードバランサ経由であっても、安定してレート制限が適用されます。

---

## 💻 コアコード解説

以下は、`api_internal/lib/middleware.ts` の核心ロジックと詳細注釈です。

### 1. プライバシー対応ハッシュキー生成器 (`aiLimiterKeyGenerator`)

```typescript
export const aiLimiterKeyGenerator = (req: Request) => {
    const authHeader = req.header('Authorization');
    
    // 1. 認証済みユーザーの場合は Bearer トークンを SHA-256 ハッシュ化して一意キーにする
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return crypto.createHash('sha256').update(authHeader).digest('hex');
    }
    
    // 2. 未認証またはトークンがない場合は IP アドレスを取得
    const ip = (req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').toString();
    
    // 3. 生のIPをメモリに保持せず、ハッシュ化してプライバシーを保護しつつキー化
    return crypto.createHash('sha256').update(ip).digest('hex');
};

export const aiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1時間制限窓
    limit: isProd ? 100 : 5000, // 本番は1時間100回、開発テスト時は5000回まで許可
    message: { error: 'AI limit reached. Please try again in an hour.' },
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: aiLimiterKeyGenerator,
    validate: { default: false } // IPv6 の逆引きに関する警告を無効化する安全設定
});
```

---

### 2. 本番ガード機能付き App Check 検証ミドルウェア (`verifyAppCheck`)

```typescript
export const verifyAppCheck = async (req: Request, res: Response, next: NextFunction) => {
    const isProduction = process.env.NODE_ENV === 'production';
    const skipRequested = process.env.SKIP_APP_CHECK === 'true';

    // 1. 開発中のApp Checkスキップ処理と、本番での二重ガード
    if (skipRequested) {
        if (isProduction) {
            // 本番環境であるにもかかわらずSKIP環境変数が有効になっている場合、大至急ブロック
            console.error('[SECURITY ALERT] SKIP_APP_CHECK is enabled in production! This is forbidden.');
            return res.status(401).json({ error: 'Unauthorized: Security check required' });
        }
        console.warn('[AppCheck] Skipping verification (Development only)');
        return next();
    }

    // 2. ヘッダーから App Check トークンを抽出
    const token = req.header('X-Firebase-AppCheck');
    if (!token) {
        console.warn('[AppCheck] Security context missing from:', req.ip);
        // エラーハンドラー経由で401 Unauthorizedとして処理を引き渡す
        return next(new AppError('Unauthorized: Security context missing', 401, 'APP_CHECK_MISSING'));
    }

    try {
        if (!appCheck) {
            throw new Error('Firebase App Check service is unavailable. Please ensure FIREBASE_SERVICE_ACCOUNT or similar environment variables are set in production.');
        }
        // 3. Firebase Admin SDK による公式暗号署名検証
        await appCheck.verifyToken(token);
        next();
    } catch (err: unknown) {
        const error = err as Error;
        console.warn('[AppCheck] Verification failed for token:', token.substring(0, 10) + '...', 'Error:', error.message);
        
        // サービス一時停止（503）または トークン無効（401）を的確にハンドリングしてエラー返却
        return next(new AppError('Unauthorized: Security check failed', error.message.includes('unavailable') ? 503 : 401, 'APP_CHECK_FAILED'));
    }
};
```

---

### 3. テストバイパス付きメール検証ミドルウェア (`requireEmailVerified`)

```typescript
export const requireEmailVerified = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // 前段の authenticate ミドルウェアを通過していることを保証
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized: Not authenticated' });
    }

    // 1. Playwright / CI パイプラインで使用されるテスト用アカウントの救済バイパス
    // 非本番環境かつメールアドレスが特定のテストドメインで終わる場合、メール確認済みのフローを自動で通過させる
    const isTestAccount = !isProd && (req.user.email?.endsWith('@example.com') || req.user.email?.endsWith('@test.local'));
    if (isTestAccount) {
        return next();
    }

    // 2. パスワード認証アカウントの場合のみメール確認状況を強制
    // （OAuth連携（Googleなど）のアカウントは、連携時点で確認されているためチェックをスルー）
    if (req.user.firebase.sign_in_provider === 'password' && !req.user.email_verified) {
        return next(new AppError('Email not verified. Please verify your email.', 403, 'auth/email-not-verified'));
    }

    next();
};
```
