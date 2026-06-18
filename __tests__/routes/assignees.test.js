const request = require('supertest');
const express = require('express');

jest.mock('../../src/db/pool', () => ({ query: jest.fn() }));

const pool = require('../../src/db/pool');
const assigneesRouter = require('../../src/routes/assignees');

const app = express();
app.use(express.json());
app.use('/api/assignees', assigneesRouter);

beforeEach(() => {
  jest.clearAllMocks();
});

// ─────────────────────────────────────────
// GET /api/assignees
// ─────────────────────────────────────────
describe('GET /api/assignees', () => {
  test('200 と担当者配列を返す', async () => {
    const mockRows = [
      { assignees_id: 1, assignees_name: '田中太郎' },
      { assignees_id: 2, assignees_name: '鈴木花子' },
    ];
    pool.query.mockResolvedValueOnce({ rows: mockRows });

    const res = await request(app).get('/api/assignees');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].assignees_name).toBe('田中太郎');
  });

  test('担当者が存在しない場合 200 と空配列を返す', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/assignees');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  test('DB エラーの場合 500 を返す', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB接続エラー'));

    const res = await request(app).get('/api/assignees');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});

// ─────────────────────────────────────────
// POST /api/assignees
// ─────────────────────────────────────────
describe('POST /api/assignees', () => {
  test('201 と作成した担当者を返す', async () => {
    const mockRow = { assignees_id: 1, assignees_name: '田中太郎' };
    pool.query.mockResolvedValueOnce({ rows: [mockRow] });

    const res = await request(app)
      .post('/api/assignees')
      .send({ assignees_name: '田中太郎' });

    expect(res.status).toBe(201);
    expect(res.body.assignees_id).toBe(1);
    expect(res.body.assignees_name).toBe('田中太郎');
  });

  test('前後の空白をトリムして登録される', async () => {
    const mockRow = { assignees_id: 2, assignees_name: '鈴木花子' };
    pool.query.mockResolvedValueOnce({ rows: [mockRow] });

    const res = await request(app)
      .post('/api/assignees')
      .send({ assignees_name: '  鈴木花子  ' });

    expect(res.status).toBe(201);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT'),
      ['鈴木花子'],
    );
  });

  test('assignees_name なしの場合 400 を返す', async () => {
    const res = await request(app)
      .post('/api/assignees')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('空白のみの assignees_name の場合 400 を返す', async () => {
    const res = await request(app)
      .post('/api/assignees')
      .send({ assignees_name: '   ' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('101文字の assignees_name の場合 400 を返す', async () => {
    const res = await request(app)
      .post('/api/assignees')
      .send({ assignees_name: 'あ'.repeat(101) });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('100文字の assignees_name は正常に登録される', async () => {
    const name = 'あ'.repeat(100);
    pool.query.mockResolvedValueOnce({ rows: [{ assignees_id: 3, assignees_name: name }] });

    const res = await request(app)
      .post('/api/assignees')
      .send({ assignees_name: name });

    expect(res.status).toBe(201);
  });

  test('DB エラーの場合 500 を返す', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB接続エラー'));

    const res = await request(app)
      .post('/api/assignees')
      .send({ assignees_name: '田中太郎' });

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});
