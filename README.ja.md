<p align="center">
  <img src="./src/assets/images/logo/PiAgentUiBlack%20%283%29.png" alt="PiAgentUI ロゴ" width="760" />
</p>

# PiAgentUI

[English (US)](./README.md) | [Português (BR)](./README.pt-BR.md) | [Español](./README.es.md) | **日本語**

PiAgentUI は **Pi Agent** のためのモダンな Web / デスクトップ UI です。単なるチャット画面ではありません。最終的には Codex や Claude Desktop のような、エージェント中心の本格的な開発アプリになることを目指しています。

PiAgentUI は、実際の Pi runtime を信頼できる唯一の情報源として扱います。セッション、モデルメタデータ、コンテキスト使用量、tool call、skills、MCP 設定、slash command は、可能な限り Pi から取得し、UI 側だけの仮の状態として再実装しません。

> **プロジェクト状態:** アクティブなローカル開発中です。一部は製品に近い品質ですが、まだ高速に変化している領域もあります。

## ソフトウェアプレビュー

以下のスクリーンショットは、現在の PiAgentUI の体験を示しています。実際の Pi セッション、モデル選択、MCP メタデータ、settings、ツール対応チャット、サイドパネルを備えた、暗色で集中しやすいエージェント workspace です。

![MCP サイドパネルを表示した PiAgentUI のチャット workspace](./src/assets/images/img1.png)

![PiAgentUI の settings と server connections ダイアログ](./src/assets/images/img2.png)

![アクティブな agent session 内の PiAgentUI model selector](./src/assets/images/img3.png)

## 現在できること

- **ストリーミング対応チャット** — SSE によるライブ出力、安定したメッセージ同期、Markdown、コードハイライト、reasoning part、ツールカード。
- **実際の Pi セッション** — セッション一覧、アクティブセッションへのルーティング、再起動後も安全な履歴読み込み、セッションタイトル生成、選択中セッションへの送信。
- **ツール出力のカード表示** — tool calls/results は通常のチャット本文として漏れず、アシスタントメッセージに紐づいたカードとして表示されます。
- **実 runtime のコンテキスト使用量** — 利用可能な場合は Pi runtime から取得し、不明または compacted な値は `NaN` ではなく安全に表示します。
- **モデルメタデータ** — provider/model の実体は Pi が authoritative であり、ローカル OpenRouter カタログは context、output、modality、pricing、tokenizer などの補助情報としてのみ使います。
- **Skills パネル** — 有効な Pi prompt から実際の skills を読み取り、global / project / package / other に分類します。
- **MCP パネル** — ローカル/グローバル設定ファイルから MCP サーバーを読み取り、transport、command、URL、lifecycle、direct tools、source を表示します。
- **Pi slash commands** — `/api/commands/list` が Pi の built-in commands と、extension / prompt / skill 由来の動的コマンドを公開します。
- **マルチモーダル添付** — 選択中モデルの能力に応じて、ファイル、画像、PDF、音声、動画の添付 UI を表示します。
- **ターミナルとファイル操作** — 統合ターミナル、ファイルエクスプローラー、syntax highlighting、diff 関連コンポーネント、Tauri デスクトップ連携。
- **キーボード中心の UI** — command palette、カスタム keybindings、split panes、モデルセレクター、プロジェクト/セッションナビゲーション、レスポンシブレイアウト。

## プロダクトの方向性

PiAgentUI は、完全なエージェントアプリへ進化しています。

1. **すべての Pi コマンドに視覚的な操作を提供** — slash commands は残しつつ、よく使う操作はボタン、メニュー、ダイアログ、パネルにします。
2. **音声入力とリアルタイム文字起こし** — マイク録音、部分 transcript delta、最終 transcript の composer 挿入、OpenAI-compatible STT provider 設定。
3. **より深い MCP 統合** — メタデータ表示だけでなく、接続、認証、ツール確認、MCP workflow 実行を UI から行えるようにします。
4. **完全なセッション制御** — fork、clone、tree navigation、import/export/share、branch summary、context management をネイティブ UI として提供します。
5. **デスクトップグレードの体験** — Tauri アプリとして、ローカル runtime discovery、安全な settings、通知、より豊かな workspace control を提供します。

## 音声と文字起こしのロードマップ

PiAgentUI は、選択中モデルが audio input をサポートしている場合、すでに音声ファイル添付を扱えます。計画中の voice system では、composer にリアルタイム speech-to-text を追加します。

推奨アーキテクチャ:

- **デフォルト realtime provider:** 低レイテンシの部分 transcript 用に OpenAI Realtime Transcription と `gpt-realtime-whisper` を使用。
- **ファイル fallback:** OpenAI Audio Transcriptions の `gpt-4o-transcribe`、`gpt-4o-mini-transcribe`、または `whisper-1` を使用。
- **カスタム provider:** `POST /v1/audio/transcriptions` を実装する OpenAI-compatible STT API をユーザーが設定可能。

計画中の UX:

- composer のマイクボタン;
- 録音状態と権限状態;
- 部分 transcript overlay;
- 最終 transcript を input に挿入;
- append / replace 動作の設定;
- auto-send はデフォルト無効;
- 権限、ネットワーク、provider エラーを復旧可能な形で表示。

provider 設定例:

```json
{
  "kind": "openai-compatible",
  "mode": "file",
  "baseUrl": "https://api.example.com/v1",
  "transcriptionEndpoint": "/audio/transcriptions",
  "transcriptionModel": "openai/whisper-large-v3",
  "language": "ja"
}
```

OpenAI-compatible な HTTP transcription は WebSocket 互換性を保証しないため、realtime support は別 capability として扱います。

## アーキテクチャ

```text
PiAgentUI
├─ React/Vite frontend
│  ├─ chat, message rendering, input, panels, settings
│  ├─ UI preferences 用の local stores
│  └─ PiAgentUI local endpoints 用の SSE/API clients
├─ Pi extension backend
│  └─ extensions/piagentui-server.ts
│     ├─ local /api/* endpoints を公開
│     ├─ Pi runtime/session/model APIs への bridge
│     ├─ Pi events を browser に stream
│     └─ MCP config や skills などの local metadata を読み取り
└─ Pi Agent runtime
   ├─ sessions
   ├─ models/providers
   ├─ tools
   ├─ skills
   ├─ MCP
   └─ slash commands
```

Pi がすでに知っている runtime state を UI が勝手に作るべきではありません。PiAgentUI は UX のために cache や enrichment を行えますが、agent behavior については Pi が authoritative です。

## 技術スタック

| 領域                | Stack                                         |
| ------------------- | --------------------------------------------- |
| UI                  | React 19, TypeScript                          |
| Build               | Vite 8                                        |
| Styling             | Tailwind CSS v4 と project design tokens      |
| Desktop             | Tauri 2                                       |
| Markdown            | Streamdown / markdown rendering pipeline      |
| Syntax highlighting | Shiki                                         |
| Terminal            | xterm.js                                      |
| Tests               | Vitest, Testing Library                       |
| Local backend       | Pi extension, Node HTTP server, WebSocket/SSE |

## ローカル開発

依存関係をインストール:

```bash
npm install
```

frontend dev server を起動:

```bash
npm run dev
```

ビルド:

```bash
npm run build
```

テスト:

```bash
npm run test:run
```

型チェック:

```bash
npm run typecheck
npm run typecheck:extensions
```

完全な検証:

```bash
npm run validate
```

## Pi extension runtime

PiAgentUI は `package.json` で Pi extension として登録されています。

```json
{
  "pi": {
    "extensions": ["./extensions/piagentui-server.ts"]
  }
}
```

extension 起動時、ローカル discovery metadata が以下に書き込まれます。

```text
~/.pi/agent/piagentui-port.json
```

Web アプリはこのファイルの port/token を使ってローカル extension server と通信します。一部の backend 変更は、ブラウザに反映される前に Pi extension process の再起動または reload が必要です。

## 重要なローカル endpoints

| Endpoint                         | 目的                                                |
| -------------------------------- | --------------------------------------------------- |
| `GET /api/models`                | Pi の実モデル一覧と正規化された capability metadata |
| `GET /api/sessions`              | Pi session files から読み取ったセッション一覧       |
| `GET /api/sessions/:id/messages` | UI rendering 用に正規化されたセッション履歴         |
| `GET /api/sessions/:id/context`  | active session の runtime context usage             |
| `POST /api/messages/send`        | 指定された Pi session にユーザーメッセージを送信    |
| `GET /api/skills`                | 有効な Pi skills を source ごとに分類               |
| `GET /api/mcp/status`            | 設定済み MCP servers の metadata                    |
| `GET /api/commands/list`         | Pi built-in / dynamic slash commands                |
| `GET /global/event`              | PiAgentUI backend からの SSE event stream           |

## 開発原則

- UI-only の仮状態よりも、Pi runtime の実データを優先する。
- OpenRouter は catalog enrichment としてのみ使い、Pi の provider/model identity を置き換えない。
- 不明な runtime 値は明示的に扱う。
- 振る舞いを変える場合は、可能な限り先にテストを書く。
- tool results は tool cards 内に保持する。
- 既存の theme、motion、spacing、panel patterns に合わせる。
- 実装済み機能と roadmap を明確に分ける。

## リポジトリノート

このプロジェクトには、元の OpenCodeUI ベースから継承した名前が一部残っています。package metadata や古い documentation などです。現在の方向性は PiAgentUI-first であり、将来的な cleanup ではローカル workflow を壊さずに残りの名称を移行する必要があります。

## ライセンス

このリポジトリは `package.json` に記載されているライセンス `GPL-3.0-only` に従います。
