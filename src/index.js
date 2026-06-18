require('dotenv').config();
const path    = require('path');
const express = require('express');
const inquiriesRouter = require('./routes/inquiries');
const assigneesRouter = require('./routes/assignees');

const app = express();
const PORT = process.env.PORT || 3000;

// JSON リクエストボディを解析する
app.use(express.json());

// 静的ファイルを public/ から配信する（__dirname 基準で絶対パス指定）
app.use(express.static(path.join(__dirname, '../public')));

// /api/inquiries エンドポイントにルーターを紐付ける
app.use('/api/inquiries', inquiriesRouter);

// /api/assignees エンドポイントにルーターを紐付ける
app.use('/api/assignees', assigneesRouter);

// 存在しないパスへのフォールバック
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// JSON パースエラーを 400 で返す
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'リクエストボディが不正な JSON です' });
  }
  next(err);
});

// 直接実行時のみサーバを起動する（テストからの require では起動しない）
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`サーバが起動しました → http://localhost:${PORT}`);
  });
}

module.exports = app;
