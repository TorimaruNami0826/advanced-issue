# 要件定義書

## システム概要
 問合せの受付・担当者アサイン・ステータス管理ができるシステムを構築する
 使用想定：システム保守担当者
 
## 画面一覧
 問合せ内容一覧の管理画面
 　→問い合わせ内容を記載する
 　　受付担当者を管理、検索する
 　　問合せの対応状況を管理する

## APIエンドポイント一覧
| メソッド | パス                               | 概要                                                            |
|----------|------------------------------------|-----------------------------------------------------------------|
|GET       |api/inquiries                       |問い合わせ一覧の取得（ステータスや担当者での絞り込みもできる）   |
|POST      |api/inquiries                       |新規問い合わせの登録（db_inquiries へのインサート）              |
|GET       |api/inquiries/:inquiries_no         |特定の問い合わせ詳細と、紐づくコメント一覧の取得                 |
|PUT       |api/inquiries/:inquiries_no         |ステータスや担当者の変更（db_inquiries の更新）                  |
|DELETE    |api/inquiries/:inquiries_no         |問い合わせの削除                                                 |
|POST      |api/inquiries/:inquiries_no/comments|問い合わせへの対応履歴コメントの追加（db_comments への登録）     |
|GET       |api/assignees                       |担当者の一覧を取得（画面の選択肢用として db_assignees から取得） |

## DBテーブル設計
 テーブル名：db_inquiries
 カラム名・型・制約：
 inquiries_date, DATE, NOT NULL
 inquiries_no, int, PRIMARY KEY
 status, VARCHAR(50), NOT NULL
 assignees, VARCHAR(100), NOT NULL
 insert_date, DATETIME, NOT NULL
 update_date, DATETIME, NOT NULL
 
 テーブル名：db_comments
 カラム名・型・制約：
 inquiries_date, DATE, NOT NULL
 inquiries_no, int, PRIMARY KEY
 comments, VARCHAR(100), NOT NULL
 insert_date, DATETIME, NOT NULL
 
 テーブル名：db_assignees
 カラム名・型・制約：
 assignees_id, int, PRIMARY KEY
 assignees_name, VARCHAR(100), NOT NULL
 

## 状態遷移
[未対応]（新規登録時の初期状態）対応を開始すると [対応中] に遷移
[対応中]クライアントへの回答や問題が解決すると [完了] に遷移
※状況に応じて状態は変更可能