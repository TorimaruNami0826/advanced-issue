# システムアーキテクチャ

## 構成概要

```
ブラウザ（バニラHTML/CSS/JS）
    ↓ HTTP fetch API
Nginx（ポート80 → リバースプロキシ）
    ↓
Node.js / Express（ポート3001、PM2管理）
    ↓
PostgreSQL（inquiry_db）
```

## APIエンドポイント一覧

### 問合せ（/api/inquiries）

| メソッド | パス | 概要 | ステータス |
|---|---|---|---|
| GET | /api/inquiries | 問合せ一覧取得。`?status=未対応` / `?assignee_id=1` で絞り込み可 | 200 |
| POST | /api/inquiries | 新規問合せ登録。`inquiries_date` 必須 | 201 |
| GET | /api/inquiries/summary | ステータス別件数を集計して返す（集計ダッシュボード用） | 200 |
| GET | /api/inquiries/:inquiries_no | 問合せ詳細＋コメント一覧を返す | 200 / 404 |
| PUT | /api/inquiries/:inquiries_no | ステータス・担当者を更新。担当者アサイン時に `未対応→対応中` を自動遷移 | 200 / 404 |
| DELETE | /api/inquiries/:inquiries_no | 問合せ削除（コメントは CASCADE で連鎖削除） | 204 / 404 |
| POST | /api/inquiries/:inquiries_no/comments | コメント追加。`comments`（100文字以内）と `inquiries_date` 必須 | 201 / 404 |

### 担当者（/api/assignees）

| メソッド | パス | 概要 | ステータス |
|---|---|---|---|
| GET | /api/assignees | 担当者一覧取得（assignees_name 昇順） | 200 |
| POST | /api/assignees | 担当者新規登録。`assignees_name`（100文字以内）必須 | 201 |

### 共通エラーレスポンス

| ステータス | 条件 |
|---|---|
| 400 | バリデーション失敗・存在しない外部キー指定 |
| 404 | 指定した `inquiries_no` が存在しない |
| 500 | DB接続エラーなどサーバー内部エラー |

---

## DBスキーマ

### db_assignees（担当者マスタ）

| カラム名 | 型 | 制約 |
|---|---|---|
| assignees_id | SERIAL | PRIMARY KEY |
| assignees_name | VARCHAR(100) | NOT NULL, UNIQUE |

### db_inquiries（問合せ）

| カラム名 | 型 | 制約 |
|---|---|---|
| inquiries_no | SERIAL | PRIMARY KEY |
| inquiries_date | DATE | NOT NULL |
| status | VARCHAR(50) | NOT NULL, DEFAULT '未対応', CHECK IN ('未対応','対応中','完了') |
| assignee_id | INTEGER | NULL, FK → db_assignees(assignees_id) ON DELETE SET NULL |
| insert_date | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| update_date | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()（UPDATE トリガーで自動更新） |

### db_comments（対応履歴コメント）

| カラム名 | 型 | 制約 |
|---|---|---|
| comment_id | BIGSERIAL | PRIMARY KEY |
| inquiries_date | DATE | NOT NULL |
| inquiries_no | INTEGER | NOT NULL, FK → db_inquiries(inquiries_no) ON DELETE CASCADE |
| comments | VARCHAR(100) | NOT NULL |
| insert_date | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

### マイグレーション管理

| カラム名 | 型 | 制約 |
|---|---|---|
| filename | VARCHAR(255) | PRIMARY KEY |
| applied_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

マイグレーションは `scripts/migrate.js` がべき等に管理する（適用済みはスキップ）。

---

## ディレクトリ構成

```
advanced-issue/
├── src/
│   ├── index.js               エントリポイント（Express + 静的配信）
│   ├── routes/
│   │   ├── inquiries.js       問合せCRUD・集計・自動更新ロジック
│   │   └── assignees.js       担当者一覧・登録
│   └── db/
│       └── pool.js            PostgreSQL接続プール
├── public/
│   ├── index.html             問合せ一覧（集計バー・絞り込み）
│   ├── form.html              問合せ新規登録
│   ├── detail.html            問合せ詳細・コメント・ステータス変更
│   ├── assignees.html         担当者管理
│   └── style.css              共通スタイル
├── db/
│   └── migrations/            SQLマイグレーションファイル（003〜005）
├── scripts/
│   ├── migrate.js             DBマイグレーション実行スクリプト
│   └── setup.sh               EC2初期セットアップスクリプト
├── __tests__/routes/          Jestユニットテスト（125件）
├── .github/workflows/
│   └── deploy.yml             CI/CD（テスト→EC2自動デプロイ）
├── ecosystem.config.js        PM2設定
└── .env.example               環境変数テンプレート
```
