# 要件定義書

## システム概要
 問合せの受付・担当者アサイン・ステータス管理ができるシステムを構築する
 使用想定：システム保守担当者
 
## 画面一覧

| ファイル | 画面名 | 主な機能 |
|---|---|---|
| index.html | 問合せ一覧 | ステータス別集計バー表示、ステータス・担当者での絞り込み、一覧表示、削除 |
| form.html | 問合せ新規登録 | 受付日・ステータス・担当者・問合せ内容を入力して登録。初回コメントも同時登録可 |
| detail.html | 問合せ詳細 | 問合せ詳細表示、ステータス変更、担当者変更（自動更新通知付き）、コメント一覧・追加 |
| assignees.html | 担当者管理 | 担当者一覧表示、新規担当者登録 |

## APIエンドポイント一覧

| メソッド | パス | 概要 |
|---|---|---|
| GET | /api/inquiries | 問合せ一覧取得。`?status` / `?assignee_id` で絞り込み可 |
| POST | /api/inquiries | 新規問合せ登録（`inquiries_date` 必須） |
| GET | /api/inquiries/summary | ステータス別件数＋合計を集計して返す ※C後半追加 |
| GET | /api/inquiries/:inquiries_no | 問合せ詳細＋コメント一覧を返す |
| PUT | /api/inquiries/:inquiries_no | ステータス・担当者を更新。担当者アサイン時に未対応→対応中を自動遷移 ※C後半追加 |
| DELETE | /api/inquiries/:inquiries_no | 問合せ削除（コメントは CASCADE で連鎖削除） |
| POST | /api/inquiries/:inquiries_no/comments | コメント追加（`comments`・`inquiries_date` 必須） |
| GET | /api/assignees | 担当者一覧取得 |
| POST | /api/assignees | 担当者新規登録（`assignees_name` 必須） ※C後半追加 |

## DBテーブル設計

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



## 状態遷移
[未対応]（新規登録時の初期状態）対応を開始すると [対応中] に遷移
[対応中]クライアントへの回答や問題が解決すると [完了] に遷移
※状況に応じて状態は変更可能