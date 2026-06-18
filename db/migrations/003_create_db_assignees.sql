-- 担当者マスタテーブル
-- 問合せに紐づく担当者を管理する。名前の表記ゆれを防ぐためマスタ化する
CREATE TABLE db_assignees (
  assignees_id   SERIAL       PRIMARY KEY,
  assignees_name VARCHAR(100) NOT NULL,
  -- 同一名の担当者が重複登録されないよう一意制約を設ける
  CONSTRAINT uq_assignees_name UNIQUE (assignees_name)
);

COMMENT ON TABLE  db_assignees                IS '担当者マスタ';
COMMENT ON COLUMN db_assignees.assignees_id   IS '担当者ID（連番）';
COMMENT ON COLUMN db_assignees.assignees_name IS '担当者名';
