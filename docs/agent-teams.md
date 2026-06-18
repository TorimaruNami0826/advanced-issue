# Agent Teams 設計書

## 追加機能の概要

| 機能 | 概要 |
|---|---|
| ステータス自動更新 | 担当者をアサインしたとき、ステータスが「未対応」であれば自動で「対応中」に遷移する |
| 集計API | `GET /api/inquiries/summary` でステータス別件数と合計を返す。一覧画面上部の集計バーに表示 |

---

## Agent構成

| Agent名 | 役割 | 担当タスク |
|---|---|---|
| Backend Agent | バックエンド開発 | `GET /api/inquiries/summary` の新規実装・`PUT /:no` の自動更新ロジック追加 |
| Frontend Agent | フロントエンド開発 | `index.html` への集計バー追加・`detail.html` への自動更新通知（3秒表示）追加 |
| Test Agent | テスト自動化 | 集計API（3件）・自動更新ロジック（6件）のユニットテスト追加・全件実行 |
| Review Agent | コード品質監査 | セキュリティ・バリデーション・XSSリスクのレビュー |

---

## タスクの依存関係

```
Backend Agent（APIとロジックの実装）
  ├─→ Frontend Agent（画面への反映・通知）
  └─→ Test Agent（バックエンドテスト作成・実行）
            ↓（両方完了後）
       Review Agent（全体のコードレビュー・最終確認）
```

## 並列実行できるタスク

- Backend Agent の実装完了後、**Frontend Agent と Test Agent を並列で実行**できる
  - Frontend Agent は画面の集計バー・通知UI実装
  - Test Agent はバックエンドのユニットテスト作成・実行
- Review Agent は Frontend / Test 両方の完了を待ってから実行する

---

## 実行結果（実績）

### テスト結果

| 項目 | 結果 |
|---|---|
| Test Suites | 2 suites passed |
| Tests | **125件 全パス**（集計API 3件・自動更新 6件を追加） |
| カバレッジ | Stmts 84.39% / Branch 88.48% / Funcs 78.26% / Lines 84.56% |
| `assignees.js` | **100%**（POST追加テストで完全網羅） |
| `inquiries.js` | **99%以上** |

### Review Agent の指摘と対応

| 深刻度 | 指摘内容 | 対応 |
|---|---|---|
| High | `index.html` の `assignees_name` / `status` を innerHTML に直接挿入（XSS） | `escapeHtml()` を追加・適用 |
| Medium | `detail.html` の `renderDetail` で `assignees_name` 未エスケープ | `escapeHtml()` を適用 |
| Medium | `isValidDate` で `2024-02-30` 等の存在しない日付が通る可能性 | 許容範囲として記録（V8では Invalid Date になる） |
| Low | SELECT→UPDATE 間にトランザクションなし（TOCTOU） | べき等な遷移のため許容。将来的に BEGIN...COMMIT 推奨 |

---

## 統合時の確認ポイント（実施済み）

- [x] 担当者をアサインしたとき、DB の status が「対応中」に変わる
- [x] 集計API（`/api/inquiries/summary`）が正しい件数を JSON で返す
- [x] 集計バーが一覧画面上部に表示され、削除後に自動更新される
- [x] 担当者更新時、「未対応→対応中」の自動遷移が画面上に3秒通知される
- [x] 既存の基本CRUD機能・テストが壊れていない

---

## 気づき・学び

**ルート定義の順序が重要**
Express はルートを定義順に評価するため、`/summary` を `/:inquiries_no` より**前**に定義しないと `"summary"` がパラメータとして解釈される。静的パスは動的パスより必ず先に定義する。

**Review Agent の価値**
実装後に独立した目線でレビューすることで、実装者が見落としがちな XSS リスクを検出できた。特にフロントエンドの innerHTML 直接挿入は実装時に意識が薄れやすい。

**並列実行の効果**
Frontend Agent と Test Agent を並列実行したことで、逐次実行と比べて実装時間を短縮できた。Backend の実装が完了さえすれば、テストと UI は独立して進められる。