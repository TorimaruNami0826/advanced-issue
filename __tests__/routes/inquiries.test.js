const request = require('supertest');
const express = require('express');

jest.mock('../../src/db/pool', () => ({ query: jest.fn() }));

const pool = require('../../src/db/pool');
const inquiriesRouter = require('../../src/routes/inquiries');

const app = express();
app.use(express.json());
app.use('/api/inquiries', inquiriesRouter);

beforeEach(() => {
  jest.clearAllMocks();
});

// ─────────────────────────────────────────
// GET /api/inquiries
// ─────────────────────────────────────────
describe('GET /api/inquiries', () => {
  test('200 と問合せ一覧を返す', async () => {
    const mockRows = [
      { inquiries_no: 1, inquiries_date: '2024-01-01', status: '未対応', assignee_id: null, assignees_name: null },
      { inquiries_no: 2, inquiries_date: '2024-01-02', status: '対応中', assignee_id: 1, assignees_name: '田中太郎' },
    ];
    pool.query.mockResolvedValueOnce({ rows: mockRows });

    const res = await request(app).get('/api/inquiries');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].inquiries_no).toBe(1);
  });

  test('?status=未対応 でフィルタした一覧を返す', async () => {
    const mockRows = [
      { inquiries_no: 1, inquiries_date: '2024-01-01', status: '未対応', assignee_id: null },
    ];
    pool.query.mockResolvedValueOnce({ rows: mockRows });

    const res = await request(app).get('/api/inquiries?status=未対応');

    expect(res.status).toBe(200);
    expect(res.body[0].status).toBe('未対応');
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE'),
      ['未対応'],
    );
  });

  test('?assignee_id=1 でフィルタした一覧を返す', async () => {
    const mockRows = [
      { inquiries_no: 2, inquiries_date: '2024-01-02', status: '対応中', assignee_id: 1 },
    ];
    pool.query.mockResolvedValueOnce({ rows: mockRows });

    const res = await request(app).get('/api/inquiries?assignee_id=1');

    expect(res.status).toBe(200);
    expect(res.body[0].assignee_id).toBe(1);
  });

  test('無効な status の場合 400 を返す', async () => {
    const res = await request(app).get('/api/inquiries?status=無効値');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('無効な assignee_id の場合 400 を返す', async () => {
    const res = await request(app).get('/api/inquiries?assignee_id=abc');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('DB エラーの場合 500 を返す', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB接続エラー'));

    const res = await request(app).get('/api/inquiries');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});

// ─────────────────────────────────────────
// POST /api/inquiries
// ─────────────────────────────────────────
describe('POST /api/inquiries', () => {
  test('201 と作成した問合せを返す', async () => {
    const mockRow = {
      inquiries_no: 1,
      inquiries_date: '2024-01-01',
      status: '対応中',
      assignee_id: 1,
      insert_date: '2024-01-01T00:00:00.000Z',
      update_date: '2024-01-01T00:00:00.000Z',
    };
    pool.query.mockResolvedValueOnce({ rows: [mockRow] });

    const res = await request(app)
      .post('/api/inquiries')
      .send({ inquiries_date: '2024-01-01', status: '対応中', assignee_id: 1 });

    expect(res.status).toBe(201);
    expect(res.body.inquiries_no).toBe(1);
    expect(res.body.status).toBe('対応中');
  });

  test('status 省略時は 未対応 で登録される', async () => {
    const mockRow = {
      inquiries_no: 2,
      inquiries_date: '2024-01-01',
      status: '未対応',
      assignee_id: null,
      insert_date: '2024-01-01T00:00:00.000Z',
      update_date: '2024-01-01T00:00:00.000Z',
    };
    pool.query.mockResolvedValueOnce({ rows: [mockRow] });

    const res = await request(app)
      .post('/api/inquiries')
      .send({ inquiries_date: '2024-01-01' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('未対応');
  });

  test('inquiries_date なしの場合 400 を返す', async () => {
    const res = await request(app)
      .post('/api/inquiries')
      .send({ status: '未対応' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('YYYY-MM-DD 形式でない inquiries_date の場合 400 を返す', async () => {
    const res = await request(app)
      .post('/api/inquiries')
      .send({ inquiries_date: '20240101' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('無効な status の場合 400 を返す', async () => {
    const res = await request(app)
      .post('/api/inquiries')
      .send({ inquiries_date: '2024-01-01', status: '不正値' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('負の assignee_id の場合 400 を返す', async () => {
    const res = await request(app)
      .post('/api/inquiries')
      .send({ inquiries_date: '2024-01-01', assignee_id: -1 });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('存在しない assignee_id（FK 違反）の場合 400 を返す', async () => {
    const err = new Error('FK違反');
    err.code = '23503';
    pool.query.mockRejectedValueOnce(err);

    const res = await request(app)
      .post('/api/inquiries')
      .send({ inquiries_date: '2024-01-01', assignee_id: 999 });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('DB エラーの場合 500 を返す', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB接続エラー'));

    const res = await request(app)
      .post('/api/inquiries')
      .send({ inquiries_date: '2024-01-01' });

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});

// ─────────────────────────────────────────
// GET /api/inquiries/:inquiries_no
// ─────────────────────────────────────────
describe('GET /api/inquiries/:inquiries_no', () => {
  test('200 と問合せ詳細（コメント含む）を返す', async () => {
    const mockInquiry = {
      inquiries_no: 1,
      inquiries_date: '2024-01-01',
      status: '未対応',
      assignee_id: null,
      assignees_name: null,
    };
    const mockComments = [
      { comment_id: 1, inquiries_date: '2024-01-02', comments: 'テストコメント', insert_date: '2024-01-02T00:00:00.000Z' },
    ];
    pool.query
      .mockResolvedValueOnce({ rows: [mockInquiry] })
      .mockResolvedValueOnce({ rows: mockComments });

    const res = await request(app).get('/api/inquiries/1');

    expect(res.status).toBe(200);
    expect(res.body.inquiries_no).toBe(1);
    expect(res.body.comments).toHaveLength(1);
    expect(res.body.comments[0].comments).toBe('テストコメント');
  });

  test('存在しない inquiries_no の場合 404 を返す', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/inquiries/999');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  test('無効な inquiries_no（文字列）の場合 400 を返す', async () => {
    const res = await request(app).get('/api/inquiries/abc');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('DB エラーの場合 500 を返す', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB接続エラー'));

    const res = await request(app).get('/api/inquiries/1');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});

// ─────────────────────────────────────────
// PUT /api/inquiries/:inquiries_no
// ─────────────────────────────────────────
describe('PUT /api/inquiries/:inquiries_no', () => {
  test('200 と更新した問合せを返す（status のみ更新）', async () => {
    const mockRow = {
      inquiries_no: 1,
      inquiries_date: '2024-01-01',
      status: '完了',
      assignee_id: null,
      insert_date: '2024-01-01T00:00:00.000Z',
      update_date: '2024-01-02T00:00:00.000Z',
    };
    pool.query.mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 });

    const res = await request(app)
      .put('/api/inquiries/1')
      .send({ status: '完了' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('完了');
  });

  test('assignee_id を null に設定できる', async () => {
    const mockRow = {
      inquiries_no: 1,
      inquiries_date: '2024-01-01',
      status: '対応中',
      assignee_id: null,
      insert_date: '2024-01-01T00:00:00.000Z',
      update_date: '2024-01-02T00:00:00.000Z',
    };
    pool.query.mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 });

    const res = await request(app)
      .put('/api/inquiries/1')
      .send({ assignee_id: null });

    expect(res.status).toBe(200);
    expect(res.body.assignee_id).toBeNull();
  });

  test('存在しない inquiries_no の場合 404 を返す', async () => {
    pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await request(app)
      .put('/api/inquiries/999')
      .send({ status: '完了' });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  test('無効な inquiries_no の場合 400 を返す', async () => {
    const res = await request(app)
      .put('/api/inquiries/abc')
      .send({ status: '完了' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('無効な status の場合 400 を返す', async () => {
    const res = await request(app)
      .put('/api/inquiries/1')
      .send({ status: '不正値' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('更新フィールドが空の場合 400 を返す', async () => {
    const res = await request(app)
      .put('/api/inquiries/1')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('無効な assignee_id（負の値）の場合 400 を返す', async () => {
    const res = await request(app)
      .put('/api/inquiries/1')
      .send({ assignee_id: -5 });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('存在しない assignee_id（FK 違反）の場合 400 を返す', async () => {
    const err = new Error('FK違反');
    err.code = '23503';
    pool.query.mockRejectedValueOnce(err);

    const res = await request(app)
      .put('/api/inquiries/1')
      .send({ assignee_id: 999 });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('DB エラーの場合 500 を返す', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB接続エラー'));

    const res = await request(app)
      .put('/api/inquiries/1')
      .send({ status: '完了' });

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});

// ─────────────────────────────────────────
// DELETE /api/inquiries/:inquiries_no
// ─────────────────────────────────────────
describe('DELETE /api/inquiries/:inquiries_no', () => {
  test('204 を返す', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(app).delete('/api/inquiries/1');

    expect(res.status).toBe(204);
  });

  test('存在しない inquiries_no の場合 404 を返す', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0 });

    const res = await request(app).delete('/api/inquiries/999');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  test('無効な inquiries_no の場合 400 を返す', async () => {
    const res = await request(app).delete('/api/inquiries/abc');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('DB エラーの場合 500 を返す', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB接続エラー'));

    const res = await request(app).delete('/api/inquiries/1');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});

// ─────────────────────────────────────────
// POST /api/inquiries/:inquiries_no/comments
// ─────────────────────────────────────────
describe('POST /api/inquiries/:inquiries_no/comments', () => {
  test('201 と作成したコメントを返す', async () => {
    const mockComment = {
      comment_id: 1,
      inquiries_date: '2024-01-02',
      inquiries_no: 1,
      comments: 'テストコメント',
      insert_date: '2024-01-02T00:00:00.000Z',
    };
    pool.query
      .mockResolvedValueOnce({ rows: [{ inquiries_no: 1 }] })
      .mockResolvedValueOnce({ rows: [mockComment] });

    const res = await request(app)
      .post('/api/inquiries/1/comments')
      .send({ comments: 'テストコメント', inquiries_date: '2024-01-02' });

    expect(res.status).toBe(201);
    expect(res.body.comment_id).toBe(1);
    expect(res.body.comments).toBe('テストコメント');
  });

  test('親問合せが存在しない場合 404 を返す', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/inquiries/999/comments')
      .send({ comments: 'テストコメント', inquiries_date: '2024-01-02' });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  test('comments なしの場合 400 を返す', async () => {
    const res = await request(app)
      .post('/api/inquiries/1/comments')
      .send({ inquiries_date: '2024-01-02' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('空白のみの comments の場合 400 を返す', async () => {
    const res = await request(app)
      .post('/api/inquiries/1/comments')
      .send({ comments: '   ', inquiries_date: '2024-01-02' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('100 文字超の comments の場合 400 を返す', async () => {
    const res = await request(app)
      .post('/api/inquiries/1/comments')
      .send({ comments: 'あ'.repeat(101), inquiries_date: '2024-01-02' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('inquiries_date なしの場合 400 を返す', async () => {
    const res = await request(app)
      .post('/api/inquiries/1/comments')
      .send({ comments: 'テストコメント' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('無効な inquiries_no の場合 400 を返す', async () => {
    const res = await request(app)
      .post('/api/inquiries/abc/comments')
      .send({ comments: 'テストコメント', inquiries_date: '2024-01-02' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('DB エラーの場合 500 を返す', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ inquiries_no: 1 }] })
      .mockRejectedValueOnce(new Error('DB接続エラー'));

    const res = await request(app)
      .post('/api/inquiries/1/comments')
      .send({ comments: 'テストコメント', inquiries_date: '2024-01-02' });

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});

// ─────────────────────────────────────────
// GET /api/inquiries/summary
// ─────────────────────────────────────────
describe('GET /api/inquiries/summary', () => {
  test('200 とステータス別件数を返す', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ '未対応': 2, '対応中': 1, '完了': 3, total: 6 }],
    });
    const res = await request(app).get('/api/inquiries/summary');
    expect(res.status).toBe(200);
    expect(res.body['未対応']).toBe(2);
    expect(res.body['対応中']).toBe(1);
    expect(res.body['完了']).toBe(3);
    expect(res.body.total).toBe(6);
  });

  test('件数が全0の場合も 200 と各 0 を返す', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ '未対応': 0, '対応中': 0, '完了': 0, total: 0 }],
    });
    const res = await request(app).get('/api/inquiries/summary');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });

  test('DB エラーの場合 500 を返す', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB接続エラー'));
    const res = await request(app).get('/api/inquiries/summary');
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});

// ─────────────────────────────────────────
// PUT /api/inquiries/:inquiries_no — ステータス自動更新
// ─────────────────────────────────────────
describe('PUT /api/inquiries/:inquiries_no - ステータス自動更新', () => {
  test('未対応の問合せに担当者をアサインするとステータスが対応中に自動更新される', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ status: '未対応' }] })
      .mockResolvedValueOnce({
        rows: [{ inquiries_no: 1, inquiries_date: '2024-01-01', status: '対応中',
                 assignee_id: 1, insert_date: '2024-01-01T00:00:00.000Z', update_date: '2024-01-02T00:00:00.000Z' }],
        rowCount: 1,
      });
    const res = await request(app).put('/api/inquiries/1').send({ assignee_id: 1 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('対応中');
  });

  test('対応中の問合せに担当者をアサインしてもステータスは変わらない', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ status: '対応中' }] })
      .mockResolvedValueOnce({
        rows: [{ inquiries_no: 1, inquiries_date: '2024-01-01', status: '対応中',
                 assignee_id: 2, insert_date: '2024-01-01T00:00:00.000Z', update_date: '2024-01-02T00:00:00.000Z' }],
        rowCount: 1,
      });
    const res = await request(app).put('/api/inquiries/1').send({ assignee_id: 2 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('対応中');
  });

  test('完了の問合せに担当者をアサインしてもステータスは変わらない', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ status: '完了' }] })
      .mockResolvedValueOnce({
        rows: [{ inquiries_no: 1, inquiries_date: '2024-01-01', status: '完了',
                 assignee_id: 1, insert_date: '2024-01-01T00:00:00.000Z', update_date: '2024-01-02T00:00:00.000Z' }],
        rowCount: 1,
      });
    const res = await request(app).put('/api/inquiries/1').send({ assignee_id: 1 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('完了');
  });

  test('status を明示指定した場合は SELECT が呼ばれず UPDATE のみ実行される', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ inquiries_no: 1, inquiries_date: '2024-01-01', status: '完了',
               assignee_id: 1, insert_date: '2024-01-01T00:00:00.000Z', update_date: '2024-01-02T00:00:00.000Z' }],
      rowCount: 1,
    });
    const res = await request(app).put('/api/inquiries/1').send({ status: '完了', assignee_id: 1 });
    expect(res.status).toBe(200);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test('担当者アサイン時に問合せが存在しない場合 404 を返す', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).put('/api/inquiries/999').send({ assignee_id: 1 });
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  test('assignee_id を null にセットした場合は SELECT なしで UPDATE のみ実行される', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ inquiries_no: 1, inquiries_date: '2024-01-01', status: '未対応',
               assignee_id: null, insert_date: '2024-01-01T00:00:00.000Z', update_date: '2024-01-02T00:00:00.000Z' }],
      rowCount: 1,
    });
    const res = await request(app).put('/api/inquiries/1').send({ assignee_id: null });
    expect(res.status).toBe(200);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });
});
