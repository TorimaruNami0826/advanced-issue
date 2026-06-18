-- 問合せテーブル
-- 受付・担当者アサイン・ステータス管理を行うメインテーブル
CREATE TABLE db_inquiries (
  inquiries_no   SERIAL       PRIMARY KEY,
  inquiries_date DATE         NOT NULL,
  -- ステータスは状態遷移に沿った値のみ許可する
  -- 初期値は '未対応'。遷移順: 未対応 → 対応中 → 完了
  status         VARCHAR(50)  NOT NULL DEFAULT '未対応'
                   CONSTRAINT chk_inquiries_status
                   CHECK (status IN ('未対応', '対応中', '完了')),
  -- 担当者は db_assignees のマスタを参照する外部キー
  -- 未アサイン状態を表現するため NULL を許容する
  assignee_id    INTEGER      NULL
                   REFERENCES db_assignees(assignees_id)
                   ON UPDATE CASCADE
                   ON DELETE SET NULL,
  insert_date    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  update_date    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  db_inquiries                IS '問合せテーブル';
COMMENT ON COLUMN db_inquiries.inquiries_no   IS '問合せ番号（連番・主キー）';
COMMENT ON COLUMN db_inquiries.inquiries_date IS '問合せ受付日';
COMMENT ON COLUMN db_inquiries.status         IS 'ステータス（未対応 / 対応中 / 完了）';
COMMENT ON COLUMN db_inquiries.assignee_id    IS '担当者ID。db_assignees への外部キー。NULL は未アサインを表す';
COMMENT ON COLUMN db_inquiries.insert_date    IS 'レコード作成日時';
COMMENT ON COLUMN db_inquiries.update_date    IS 'レコード更新日時';

-- update_date を自動更新するトリガー関数
CREATE OR REPLACE FUNCTION update_db_inquiries_update_date()
RETURNS TRIGGER AS $$
BEGIN
  NEW.update_date = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_db_inquiries_update_date
  BEFORE UPDATE ON db_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION update_db_inquiries_update_date();

-- 絞り込みクエリ（GET /api/inquiries）で使用するインデックス
CREATE INDEX idx_inquiries_status      ON db_inquiries (status);
CREATE INDEX idx_inquiries_assignee_id ON db_inquiries (assignee_id);
