const { Router } = require('express');
const pool = require('../db/pool');

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/assignees — 担当者一覧取得（assignees_name 昇順）
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT assignees_id, assignees_name FROM db_assignees ORDER BY assignees_name'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバエラーが発生しました' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/assignees — 担当者新規登録
//   必須: assignees_name（空白のみ不可・100文字以内）
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
  const { assignees_name } = req.body;

  if (!assignees_name || typeof assignees_name !== 'string' || assignees_name.trim() === '') {
    return res.status(400).json({ error: '担当者名は必須です' });
  }
  if (assignees_name.trim().length > 100) {
    return res.status(400).json({ error: '担当者名は100文字以内である必要があります' });
  }

  try {
    const { rows } = await pool.query(
      'INSERT INTO db_assignees (assignees_name) VALUES ($1) RETURNING assignees_id, assignees_name',
      [assignees_name.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバエラーが発生しました' });
  }
});

module.exports = router;
