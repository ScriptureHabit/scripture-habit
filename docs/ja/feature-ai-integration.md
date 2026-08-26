# AI 連携

**scripture-habit** の AI サブシステムは、仮想ファシリテーターとして機能し、言語の壁を埋め、学習の進捗状況を要約するのをサポートします。

---

## ペルソナ: 「励ましを与えるファシリテーター」

一般的な LLM ではなく、特定のペルソナを使用するようにプロンプトが設計されています：
- **トーン**: 温かく、励ましに満ち、シンプル。 
- **ルール**: 複雑な神学用語を避けること。誰でも理解できる出力にすること。
- **目標**: 個人への適用。聖句が現代の日常生活にどのように適用できるかに焦点を当てます。

---

## API 最適化: Gemini 3.1 Flash-Lite

グローバルで **Gemini 3.1 Flash-Lite Preview** を使用しています。迅速な体験を提供するため、必要最小限の思考（Thinking）構成を適用しています：
```json
thinkingConfig: {
    thinkingLevel: "minimal"
}
```
これにより、モデルは翻訳や質問生成のような単純なタスクにおいて、速度と直接的な回答を優先するようになります。

---

## 翻訳キャッシュ戦略

API コストとレイテンシを削減するため、すべての翻訳に対して永続キャッシュを使用しています。

### 1. ハッシュキー
各翻訳リクエストは、テキスト、言語、およびコンテキストカテゴリ（UpdateType）に基づいて、**MD5**を使用してハッシュ化されます：
`key = md5(OriginalText + TargetLanguage + UpdateType)`

### 2. キャッシュの検索
- Gemini を呼び出す前に、サーバーは `translation_cache` コレクションにこのキーが存在するかどうかを確認します。
- 存在する場合、キャッシュされた結果が即座に返されます（50ミリ秒未満）。
- 存在しない場合は Gemini が呼び出され、結果が `createdAt` タイムスタンプとともに保存されます。

### 3. テストと同期
本番環境のパフォーマンスを最適化するため、キャッシュへの書き込み（`cacheRef.set()`）はバックグラウンドで実行されます。Firestore の書き込み完了を待つ間、API がユーザーへの応答をブロックすることはありません。

ただし、統合テスト（例: `ai.integration.test.ts`）の実行中は、この非ブロッキング非同期書き込みによって競合状態が発生し、データベースの書き込みが完了する前にテストのアサーションが実行されてしまう可能性があります。

テストの失敗を防ぐため、バックエンドは実行環境を確認します：
```typescript
if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
    await savePromise;
}
```
テスト環境が検出された場合、サーバーはキャッシュの書き込みを待機してから HTTP レスポンスを返すため、安定した統合テストが保証されます。

---

## バッチ翻訳の最適化

ユーザーが複数言語のメッセージを含むチャットを読み込むとき、個別の翻訳リクエストが発生するとUIの動作が遅くなり、追加の帯域幅を消費する可能性があります。これを最適化するため、バックエンドは `/api/ai/translate-batch` を提供しており、これは**3段階のバッチ処理プロセス**を採用しています：

### 1. 並行キャッシュ検索
サーバーは各メッセージのハッシュを作成し、`Promise.all()` を使用して `translation_cache` コレクションに並行してクエリを実行します：
```typescript
const cachePromises = messages.map(async (msg) => {
    const cacheKey = crypto.createHash('md5').update(`${msg.text}_${targetLanguage}_normal`).digest('hex');
    // ... 非同期フェッチ
});
const cacheResults = await Promise.all(cachePromises);
```
- よく使用される一般的なフレーズやアクティブなテキストは、キャッシュから直接50ミリ秒未満で解決されます。
- キャッシュミスしたメッセージのみが、Gemini 用の `toTranslate` 配列に追加されます。
- すべてキャッシュされている場合、APIはLLMを呼び出すことなく早期にレスポンスを返します。

### 2. 単一の構造化された LLM リクエスト
キャッシュミスしたすべてのメッセージは単一の JSON 配列にまとめられ、1回の API コールで Gemini に送信されます：
```typescript
const prompt = `Task: Translate these message items into ${targetLangName}.
    【STRICT RULES】:
    1. Preserve the exact markdown structure, especially bold labels like **Category:** or **Comment:**.
    2. Translate the labels themselves into ${targetLangName}.
    3. Output ONLY a valid JSON object mapping IDs to their translations. NO markdown backticks or extra text.
    
    Format: {"msg_id": "translated_text", ...}
    
    Messages:
    ${JSON.stringify(toTranslate.map(m => ({ id: m.id, text: m.text })))}`;
```
- **トークンの節約**: 指示やルールが複数回ではなく1回だけ送信されるため、入力トークンのコストが削減されます。
- **レイテンシの削減**: レイテンシは約1.8秒の単一のプロンプト・レスポンスサイクルに圧縮されます。

### 3. バッチコミット (`db.batch`)
JSONレスポンスが解析されると、サーバーは翻訳結果をFirestoreに書き込みます。
個別のネットワーク書き込みをトリガーする代わりに、単一の**Firestoreバッチコミット（Batch Commit）**を構築します：
```typescript
const batch = db.batch();
for (const msg of toTranslate) {
    const translated = batchTranslations[msg.id];
    
    // 1. Set global translation cache
    batch.set(cacheRef, { ... });
    
    // 2. Persist directly inside the active message document (Denormalization)
    batch.set(messageRef, { translations: { [targetLanguage]: translated } }, { merge: true });
}
await batch.commit();
```
- メッセージドキュメントの内部に翻訳を直接書き込む（非正規化）ことで、将来クライアントがロードした際に、メッセージ内にすでに翻訳が含まれている状態になります。
- 単一のバッチでコミットすることにより、整合性が保証され、データベースへの書き込みの往復回数が削減されます。

---

## ふり返りレター（手紙箱）、クールダウン、およびスマートキャッシュリカバリー

ふり返りレターは、日々の学習ノートをAIが分析して届ける心温まるメッセージ機能です。システムの過負荷を防ぎ、豊かな体験と軽量なデータ運用を両立しています：

### 1. 聖典ストーリーテリングを取り入れた3段落プロンプト
ふり返りレターは以下の3段落構成で作成されます：
1. **共感と承認**: ユーザーが書き残したノートの気づきや学習の努力に寄り添い、承認する。
2. **聖典・総大会のエピソード**: ノートのテーマに関連する聖典の登場人物（ネファイ、ルツ、ヨセフ、パウロなど）や総大会の講話を交え、新たな霊的視座を提供する。
3. **祝福と励まし**: 今後の学習と人生に向けた温かい祝福の言葉で締めくくる。

### 2. 言語非依存の構造化 JSON 出力
プロンプト内で Gemini に対して以下の構造化 JSON 出力を強制します：
```json
{
  "title": "短く心に残るタイトル",
  "letter": "手紙の本文全文..."
}
```
これにより、言語ごとの正規表現に依存することなく、全11言語でタイトルと本文を確実に抽出できます。

### 3. 6日間のクールダウンとタイムアウト救済キャッシュ
- レター生成時に、ユーザー文書（`users/{uid}`）の `lastRecapGeneratedAt` を更新します。
- 6日以内にリクエストがあった場合（または通信エラーによる再読み込み時）、サーバーは以下を走査します：
  1. **レベル1キャッシュ（`recaps` サブコレクション）**: 6日以内の最新レコード（1件）。
  2. **レベル2キャッシュ（`letters` サブコレクション）**: 最新5件から `type === 'weekly_recap'` を探索。
- キャッシュが見つかれば `fromCache: true` で即座に既存レターを返却し、通信切断による消失を防ぎます。

### 4. Firestore Native TTL（30日自動削除）とウェルカムレター
- `users/{uid}/letters` および `recaps` に保存されるレターには `expiresAt: now + 30 days` が付与され、Firestore の TTL 機能によって自動的にクリーンアップされます。
- 新規登録時に発行される開発者からのウェルカムレターは `expiresAt` を持たないため、手紙箱に永久保存されます。

---

## JSON のサニタイズ（クレンジング）

Gemini はバッチ翻訳およびふり返りレター生成時に JSON オブジェクトを出力します。
バックエンドでは、最外側の `{` と `}` を特定して抽出してから `JSON.parse()` を実行することで、AI が余分なマークダウン装飾を含めた場合でもエラーを起こさず安全に処理します。


---

## セキュリティと AI ミドルウェア
- **レート制限**: `aiLimiter` は、ユーザーが1時間あたりに実行できる AI リクエストの数を制限します。
- **App Check**: 外部スクリプトによるエンドポイントの悪用を防ぐため、すべての AI ルートで必須となっています。
