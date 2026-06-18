-- コメントテーブル
-- 問合せ1件に対して複数のコメントが登録される（1対多）
-- 要件書では inquiries_no が PRIMARY KEY と記載されていたが、
-- 1問合せに複数コメントを登録できないため設計誤りと判断し、
-- comment_id を主キーとして追加し inquiries_no を外部キーに変更する
CREATE TABLE db_comments (
  comment_id     BIGSERIAL    PRIMARY KEY,
  inquiries_date DATE         NOT NULL,
  -- 紐づく問合せへの外部キー。問合せ削除時にコメントも一括削除する
  inquiries_no   INTEGER      NOT NULL
                   REFERENCES db_inquiries(inquiries_no)
                   ON DELETE CASCADE,
  comments       VARCHAR(100) NOT NULL,
  insert_date    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  db_comments                IS '問合せコメントテーブル';
COMMENT ON COLUMN db_comments.comment_id     IS 'コメントID（連番・主キー）';
COMMENT ON COLUMN db_comments.inquiries_date IS '問合せ受付日（非正規化コピー。db_inquiries との JOIN 不要で受付日を参照するために保持）';
COMMENT ON COLUMN db_comments.inquiries_no   IS '問合せ番号。db_inquiries への外部キー';
COMMENT ON COLUMN db_comments.comments       IS 'コメント本文';
COMMENT ON COLUMN db_comments.insert_date    IS 'コメント登録日時';

-- GET /api/inquiries/:inquiries_no のコメント一覧取得で使用するインデックス
CREATE INDEX idx_comments_inquiries_no ON db_comments (inquiries_no);
