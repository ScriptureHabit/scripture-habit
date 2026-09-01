# Scripture Habit (スクハビ)

[English](README.md) | **日本語**

> **日々の聖典学習を、より楽しく、意義深いものに**  
> *Making daily scripture study more fun and meaningful.*

毎日の聖典学習を、仲間とともに自然に習慣づけてゆくための、オープンソースによるWebアプリケーションです。

> 💡 **開発、修正にご興味のある方へ**  
> 最初から全体の仕組みをすべて理解する必要はまったくありません。[`/docs`](docs/ja/README.md) の中から関心のある機能をひとつ選び、小さなところから気兼ねなく始めてみてください。

<div align="center">
  <video src="https://github.com/user-attachments/assets/9cb294e7-7a90-49c3-93f5-3995a899ee43" width="360" autoplay loop muted playsinline>
  </video>
</div>

 **Web Application**: [https://scripturehabit.app](https://scripturehabit.app)  
 **Live Demo (登録不要で今すぐ体験いただけます)**: [https://scripturehabit.app/ja/demo](https://scripturehabit.app/ja/demo)

<p align="center">
  <img src="https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-7.0%20(Native)-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript 7.0" />
  <img src="https://img.shields.io/badge/Node.js-26.0-5FA04E?style=for-the-badge&logo=nodedotjs" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express-5.0-000000?style=for-the-badge&logo=express" alt="Express 5.0" />
  <img src="https://img.shields.io/badge/Firebase-Firestore%2FAuth-FFCA28?style=for-the-badge&logo=firebase" alt="Firebase" />
  <img src="https://img.shields.io/badge/Vercel-Hosted-000000?style=for-the-badge&logo=vercel" alt="Vercel" />
  <img src="https://img.shields.io/badge/Sentry-Monitored-362D59?style=for-the-badge&logo=sentry" alt="Sentry" />
</p>

---

## この試みについて

> **「日々の聖典学習を、もっと楽しく、意義深いものにする」**

正直に言いますと、私自身、一人きりで毎日聖典を読み続けることがどうしても苦手で、幾度となく三日坊主を繰り返してまいりました。  
ただチェックリストを埋めるような「義務」にするのではなく、たとえ遠くに離れて暮らす友人や家族であっても、「今日ここを読んで、こんなことを感じたよ」と素直に語り合える場があったなら、どれほど楽しく続けられることでしょう。そう思い立ち、夢中でコードを書き始めたのが、この Scripture Habit の始まりです。

聖典を学ぶ習慣を育てるためのソフトウェアに、あらかじめ決まった「唯一の正解」など、まだどこにもありません。  
だからこそ、これをオープンソースとして広く世界に開き、仲間とともに試行錯誤を重ねながら、より善い形をともに探してゆくことこそが、天のお父様と人にとって良いことなではないかと思っています。

相根 大治郎

---

## 運用の記録

本アプリケーションは現在実際に公開・運用しております。現在、1日平均10名以上の皆さんが、このアプリで継続的にノートを投稿しておられます。

- **[日別ノート投稿ユーザー数 (Google スプレッドシート)](https://docs.google.com/spreadsheets/d/1mocqYfFnQdeCrkDQSfLO1vpDha69oXHS5fmdq-hdODw/edit?usp=sharing)**

---

## 主な機能

### 1. ダッシュボード
<p align="center">
  <img src="./docs/images/dashboard.png" width="340" alt="ダッシュボード" />
</p>

- **学習の歩みとレベル表示**: 毎日のノート投稿によって歩みが重なり、連続学習日数やレベルとしてご自身の成長を実感していただけます。
- **今日の学習箇所ガイド**: その日読むべき範囲が自然に示され、ワンタップで該当の聖典ページを開くことができます。

---

### 2. ノートの作成
<p align="center">
  <img src="./docs/images/create-note.png" width="320" alt="ノート作成" />
</p>

- **ノートエディタ**: 日々の気づきや心に浮かんだ思いを、素直に書き留めて保存することができます。
- **確実な同期処理**: ノート保存時に Firestore トランザクションを実行し、学習日数の計算、チャット同期、データ更新を乱れなく確実に完了させます。

---

### 3. マイノートと振り返り
<p align="center">
  <img src="./docs/images/my-notes.png" width="250" alt="マイノート" />
  <img src="./docs/images/weekly-letter.png" width="250" alt="ウィークリーレター" />
</p>

- **検索とフィルタリング**: 過去の学習ノートを一覧し、タグやキーワードを手がかりにいつでも探したい記録へと立ち戻れます。
- **AI 振り返りレター（レターボックス）**: 投稿したノートの内容に寄り添い、聖典のエピソードを交えながら、温かな振り返りの手紙を届けてくれます。
- **未来の自分への手紙（タイムカプセル）**: やがて迎える節目（Day 10, 25...）の自分へ宛てて、応援や初心を思い出す言葉を封印し、目標を達成した折に当時の記録とともに開封します。

---

### 4. グループチャットと多言語対応
<p align="center">
  <img src="./docs/images/group-chat.png" width="250" alt="グループチャット" />
  <img src="./docs/images/languages.png" width="250" alt="多言語設定" />
</p>

- **聖句リンクの自動変換**: メッセージ内の聖句参照を解釈し、誰もが読みやすいリンクへと自動で整えます。
- **AI によるリアルタイム自動翻訳**: 海外の仲間からのメッセージやお名前を、その場で自然な言葉に変換します。

---

### 5. 習慣化ルールと設定
<p align="center">
  <img src="./docs/images/habit-rule.png" width="230" alt="習慣化ルール" />
  <img src="./docs/images/profile.png" width="230" alt="プロフィール" />
  <img src="./docs/images/setting.png" width="230" alt="設定画面" />
</p>

- **マイ習慣ルール**: 日々の学びが単調にならぬよう、ご自身に合った心地よい学習ルールを設定できます。
- **プロフィール設定**: アバターや言語、通知の受け取り方など、ご自身のペースに合わせて柔軟に調整できます。

---

## セキュリティと品質の検証

- **セキュリティの確保**: Firebase AppCheck と Zod による入念な検証により、安全な通信を保ちます（詳細は [セキュリティポリシー](SECURITY.md) をご覧ください）。
- **エラーの監視**: Sentry を導入し、本番環境でのエラーを漏れなく見守っております。
- **品質の検証**: Vitest（単体テスト）および Playwright（E2Eテスト）による検証を重ね、安定した動作を保ちます。

---

## 技術スタック

| カテゴリ | 採用技術 |
| :--- | :--- |
| **フロントエンド** | React 19, TypeScript 7.0 (Native), Vite 8.1, Vanilla CSS |
| **状態管理** | React Context (Split Context), `useReducer`, Zustand |
| **バックエンド API** | Node.js 26.0, Express 5.0, Vercel Serverless Functions |
| **データベース / 認証** | Google Cloud Firestore, Firebase Authentication, Firebase AppCheck |
| **AI 連携** | Google Gemini API (自動翻訳・振り返りレターの生成) |
| **API 仕様書** | OpenAPI 3.0, Swagger UI (`/api/docs`) |
| **検証・テスト** | Vitest (単体テスト), Playwright (E2E テスト) |

### データベース設計 (ER図)
<p align="center">
  <img src="./docs/images/ER-diagram.png" width="850" alt="ER Diagram" />
</p>

### ディレクトリ構造
<p align="center">
  <img src="./docs/images/directory-path-architecture.png" width="850" alt="Directory Architecture" />
</p>

---

## API 仕様書 (Swagger UI)

Swagger UI を公開しております。

- **[Swagger UI 画面](https://scripturehabit.app/api/docs)**: `https://scripturehabit.app/api/docs`

---

## ドキュメント

### 日本語版
- **[ドキュメント目次](./docs/ja/README.md)**: 各種技術ドキュメントのインデックス。
- **[開発および環境構築ガイド](./docs/ja/development-guide.md)**: ローカル環境構築と開発参加の手順。

### English Version
- **[Technical Documentation Index](./docs/README.md)**
- **[Development & Setup Guide](./docs/development-guide.md)**

---

## 開発へのご参加について

Scripture Habit は、広く開かれたオープンソースプロジェクトです。コードを書く方のみならず、翻訳の推敲やUIの改善、日々の使い心地についてのご意見など、どのような形でのご参加も心より歓迎いたします。

> [!TIP]
> **コードベース全体を理解する必要はありません。** [`/docs`](docs/ja/README.md) の中から関心のある機能をひとつ選び、小さなところから気兼ねなく始めてみてください。

開発の手順やガイドラインについては [コントリビューションガイド](CONTRIBUTING.md) を、コミュニティ基準については [行動規範 (Code of Conduct)](CODE_OF_CONDUCT.md) をご確認ください。

とりわけ、以下のような事柄において皆さまのお力添えをいただけましたら幸いに存じます：

- **翻訳の追加と推敲**: 各言語の自然な言い回しの確認や、新たな言語の追加
- **ダッシュボードと画面の改善**: 日常での扱いやすさや心地よさの向上
- **使い心地の検証とご報告**: 不具合の報告や、日々の学習フローをより滑らかにするためのご提案
- **新機能のアイデア**: 聖典学習を無理なく続けるためのアイデアやご意見

Issue や Pull Request は、いつでもどうぞお気軽にお寄せください。

---

## 貢献してくださった皆さま

本プロジェクトの歩みを温かく支えてくださっている素晴らしい皆さまに、心より感謝申し上げます：

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="20%"><a href="https://github.com/daijir"><img src="https://avatars.githubusercontent.com/u/153198121?v=4&s=100" width="100px;" alt="daijir"/><br /><sub><b>daijir</b></sub></a></td>
      <td align="center" valign="top" width="20%"><a href="https://github.com/Sembatya2020"><img src="https://avatars.githubusercontent.com/u/181699473?v=4&s=100" width="100px;" alt="Sembatya2020"/><br /><sub><b>Sembatya2020</b></sub></a></td>
      <td align="center" valign="top" width="20%"><a href="https://github.com/GreiceMoreira"><img src="https://avatars.githubusercontent.com/u/126085301?v=4&s=100" width="100px;" alt="GreiceMoreira"/><br /><sub><b>GreiceMoreira</b></sub></a></td>
      <td align="center" valign="top" width="20%"><a href="https://github.com/Bimbolin"><img src="https://avatars.githubusercontent.com/u/128802658?v=4&s=100" width="100px;" alt="Bimbolin"/><br /><sub><b>Bimbolin</b></sub></a></td>
      <td align="center" valign="top" width="20%"><a href="https://github.com/KadenTheHero"><img src="https://avatars.githubusercontent.com/u/265869306?v=4&s=100" width="100px;" alt="KadenTheHero"/><br /><sub><b>KadenTheHero</b></sub></a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

---

## サポート・インフラ協賛 (Supported By)

この開かれた試みを支えてくださっている各プラットフォームの温かいご支援に、深く御礼申し上げます：

<p align="left">
  <a href="https://vercel.com/?utm_source=scripture-habit&utm_campaign=oss">
    <img src="https://img.shields.io/badge/Hosted%20by-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Hosted by Vercel" />
  </a>
  &nbsp;
  <a href="https://sentry.io">
    <img src="https://img.shields.io/badge/Monitored%20by-Sentry-362D59?style=for-the-badge&logo=sentry&logoColor=white" alt="Monitored by Sentry" />
  </a>
  &nbsp;
  <a href="https://github.com/features/actions">
    <img src="https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white" alt="GitHub Actions" />
  </a>
</p>

- **[Vercel](https://vercel.com)**: サーバーレスホスティング、エッジルーティング、ウェブアナリティクスをご提供いただいております。
- **[Sentry](https://sentry.io)**: 本番環境のエラー監視、パフォーマンス追跡、診断トレーシングをご提供いただいております。
- **[GitHub](https://github.com)**: リポジトリホスティングおよび GitHub Actions による自動検証・CI/CD パイプラインをご提供いただいております。

---

## ライセンス

本プロジェクトは **GNU Affero General Public License v3.0 (AGPL-3.0)** に基づいて公開されております。詳細につきましては [LICENSE](LICENSE) ファイルをご覧ください。
