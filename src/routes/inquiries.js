const { Router } = require('express');
const pool = require('../db/pool');

const router = Router();

// ステータスの許容値
const VALID_STATUSES = ['未対応', '対応中', '完了'];

// YYYY-MM-DD 形式の日付文字列かどうかを検証するヘルパー
function isValidDate(value) {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
}

// inquiries_no パスパラメータを整数に変換・検証するヘルパー
function parseInquiriesNo(raw) {
  const no = Number(raw);
  if (!Number.isInteger(no) || no <= 0) return null;
  return no;
}

// ---------------------------------------------------------------------------
// GET /api/inquiries — 一覧取得
//   クエリパラメータ: ?status=未対応 / ?assignee_id=1 で絞り込み可
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const conditions = [];
    const values = [];

    // status フィルタのバリデーション
    if (req.query.status !== undefined) {
      if (!VALID_STATUSES.includes(req.query.status)) {
        return res.status(400).json({
          error: `status は ${VALID_STATUSES.join('、')} のいずれかである必要があります`,
        });
      }
      values.push(req.query.status);
      conditions.push(`i.status = $${values.length}`);
    }

    // assignee_id フィルタのバリデーション
    if (req.query.assignee_id !== undefined) {
      const aid = Number(req.query.assignee_id);
      if (!Number.isInteger(aid) || aid <= 0) {
        return res.status(400).json({ error: 'assignee_id は正の整数である必要があります' });
      }
      values.push(aid);
      conditions.push(`i.assignee_id = $${values.length}`);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // 担当者名を LEFT JOIN で結合して返す
    const text = `
      SELECT
        i.inquiries_no,
        i.inquiries_date,
        i.status,
        i.assignee_id,
        a.assignees_name,
        i.insert_date,
        i.update_date
      FROM db_inquiries i
      LEFT JOIN db_assignees a ON a.assignees_id = i.assignee_id
      ${where}
      ORDER BY i.inquiries_no
    `;

    const { rows } = await pool.query(text, values);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバエラーが発生しました' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/inquiries — 新規登録
//   必須: inquiries_date (YYYY-MM-DD)
//   任意: status (省略時 '未対応') / assignee_id (正の整数)
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
  const { inquiries_date, status, assignee_id } = req.body;

  // inquiries_date バリデーション
  if (!inquiries_date || !isValidDate(inquiries_date)) {
    return res.status(400).json({
      error: 'inquiries_date は必須で、YYYY-MM-DD 形式である必要があります',
    });
  }

  // status バリデーション（省略時は '未対応'）
  const resolvedStatus = status !== undefined ? status : '未対応';
  if (!VALID_STATUSES.includes(resolvedStatus)) {
    return res.status(400).json({
      error: `status は ${VALID_STATUSES.join('、')} のいずれかである必要があります`,
    });
  }

  // assignee_id バリデーション（任意）
  if (assignee_id !== undefined && assignee_id !== null) {
    const aid = Number(assignee_id);
    if (!Number.isInteger(aid) || aid <= 0) {
      return res.status(400).json({ error: 'assignee_id は正の整数である必要があります' });
    }
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO db_inquiries (inquiries_date, status, assignee_id)
       VALUES ($1, $2, $3)
       RETURNING inquiries_no, inquiries_date, status, assignee_id, insert_date, update_date`,
      [inquiries_date, resolvedStatus, assignee_id ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    // 外部キー制約違反: 存在しない assignee_id が指定された場合
    if (err.code === '23503') {
      return res.status(400).json({ error: '指定された担当者が存在しません' });
    }
    console.error(err);
    res.status(500).json({ error: 'サーバエラーが発生しました' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/inquiries/summary — ステータス別件数の集計
// ---------------------------------------------------------------------------
router.get('/summary', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = '未対応')::INTEGER AS "未対応",
         COUNT(*) FILTER (WHERE status = '対応中')::INTEGER AS "対応中",
         COUNT(*) FILTER (WHERE status = '完了')::INTEGER   AS "完了",
         COUNT(*)::INTEGER                                   AS total
       FROM db_inquiries`
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバエラーが発生しました' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/inquiries/:inquiries_no — 詳細取得（コメント一覧を含む）
// ---------------------------------------------------------------------------
router.get('/:inquiries_no', async (req, res) => {
  const no = parseInquiriesNo(req.params.inquiries_no);
  if (no === null) {
    return res.status(400).json({ error: '無効な inquiries_no です' });
  }

  try {
    // 問合せ本体を取得する
    const { rows: inquiryRows } = await pool.query(
      `SELECT
         i.inquiries_no,
         i.inquiries_date,
         i.status,
         i.assignee_id,
         a.assignees_name,
         i.insert_date,
         i.update_date
       FROM db_inquiries i
       LEFT JOIN db_assignees a ON a.assignees_id = i.assignee_id
       WHERE i.inquiries_no = $1`,
      [no]
    );

    if (inquiryRows.length === 0) {
      return res.status(404).json({ error: '指定された問合せが見つかりません' });
    }

    // 紐づくコメントを insert_date 昇順で取得する
    const { rows: commentRows } = await pool.query(
      `SELECT comment_id, inquiries_date, comments, insert_date
       FROM db_comments
       WHERE inquiries_no = $1
       ORDER BY insert_date`,
      [no]
    );

    res.json({ ...inquiryRows[0], comments: commentRows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバエラーが発生しました' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/inquiries/:inquiries_no — ステータス・担当者の更新
//   任意: status / assignee_id（null で未アサインに戻す）
//   更新フィールドが1つもない場合は 400
// ---------------------------------------------------------------------------
router.put('/:inquiries_no', async (req, res) => {
  const no = parseInquiriesNo(req.params.inquiries_no);
  if (no === null) {
    return res.status(400).json({ error: '無効な inquiries_no です' });
  }

  const { status, assignee_id } = req.body;

  // status バリデーション
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `status は ${VALID_STATUSES.join('、')} のいずれかである必要があります`,
    });
  }

  // assignee_id バリデーション（null は未アサインへの戻しとして許容する）
  if (assignee_id !== undefined && assignee_id !== null) {
    const aid = Number(assignee_id);
    if (!Number.isInteger(aid) || aid <= 0) {
      return res.status(400).json({ error: 'assignee_id は正の整数または null である必要があります' });
    }
  }

  // 更新対象フィールドが1つも指定されていない場合は早期リターン
  if (status === undefined && assignee_id === undefined) {
    return res.status(400).json({ error: '更新するフィールドがありません' });
  }

  try {
    // 担当者アサイン時のステータス自動更新チェック
    // assignee_id が非 null でセットされ status が未指定の場合のみ実行する
    let effectiveStatus = status;
    if (assignee_id !== undefined && assignee_id !== null && status === undefined) {
      const { rows: curRows } = await pool.query(
        'SELECT status FROM db_inquiries WHERE inquiries_no = $1',
        [no]
      );
      if (curRows.length === 0) {
        return res.status(404).json({ error: '指定された問合せが見つかりません' });
      }
      if (curRows[0].status === '未対応') {
        effectiveStatus = '対応中';
      }
    }

    // 動的に SET 句を組み立てる
    const fields = [];
    const values = [];
    let idx = 1;

    if (effectiveStatus !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(effectiveStatus);
    }
    if (assignee_id !== undefined) {
      fields.push(`assignee_id = $${idx++}`);
      values.push(assignee_id === null ? null : Number(assignee_id));
    }
    // 更新日時を常に現在時刻で上書きする
    fields.push('update_date = NOW()');
    values.push(no);

    const { rows, rowCount } = await pool.query(
      `UPDATE db_inquiries
       SET ${fields.join(', ')}
       WHERE inquiries_no = $${idx}
       RETURNING inquiries_no, inquiries_date, status, assignee_id, insert_date, update_date`,
      values
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: '指定された問合せが見つかりません' });
    }

    res.json(rows[0]);
  } catch (err) {
    // 外部キー制約違反: 存在しない assignee_id が指定された場合
    if (err.code === '23503') {
      return res.status(400).json({ error: '指定された担当者が存在しません' });
    }
    console.error(err);
    res.status(500).json({ error: 'サーバエラーが発生しました' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/inquiries/:inquiries_no — 削除
//   db_comments は ON DELETE CASCADE で連鎖削除される
// ---------------------------------------------------------------------------
router.delete('/:inquiries_no', async (req, res) => {
  const no = parseInquiriesNo(req.params.inquiries_no);
  if (no === null) {
    return res.status(400).json({ error: '無効な inquiries_no です' });
  }

  try {
    const { rowCount } = await pool.query(
      'DELETE FROM db_inquiries WHERE inquiries_no = $1',
      [no]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: '指定された問合せが見つかりません' });
    }

    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバエラーが発生しました' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/inquiries/:inquiries_no/comments — コメント追加
//   必須: comments (空白のみ不可・100文字以内) / inquiries_date (YYYY-MM-DD)
// ---------------------------------------------------------------------------
router.post('/:inquiries_no/comments', async (req, res) => {
  const no = parseInquiriesNo(req.params.inquiries_no);
  if (no === null) {
    return res.status(400).json({ error: '無効な inquiries_no です' });
  }

  const { comments, inquiries_date } = req.body;

  // comments バリデーション
  if (!comments || typeof comments !== 'string' || comments.trim() === '') {
    return res.status(400).json({ error: 'comments は必須で、空白のみは不可です' });
  }
  if (comments.trim().length > 100) {
    return res.status(400).json({ error: 'comments は 100 文字以内である必要があります' });
  }

  // inquiries_date バリデーション
  if (!inquiries_date || !isValidDate(inquiries_date)) {
    return res.status(400).json({
      error: 'inquiries_date は必須で、YYYY-MM-DD 形式である必要があります',
    });
  }

  try {
    // 親問合せの存在確認（FK 制約のエラーより先に明示的な 404 を返すため）
    const { rows: parentRows } = await pool.query(
      'SELECT inquiries_no FROM db_inquiries WHERE inquiries_no = $1',
      [no]
    );
    if (parentRows.length === 0) {
      return res.status(404).json({ error: '指定された問合せが見つかりません' });
    }

    const { rows } = await pool.query(
      `INSERT INTO db_comments (inquiries_date, inquiries_no, comments)
       VALUES ($1, $2, $3)
       RETURNING comment_id, inquiries_date, inquiries_no, comments, insert_date`,
      [inquiries_date, no, comments.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバエラーが発生しました' });
  }
});

module.exports = router;
