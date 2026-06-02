const express = require('express');
const router = express.Router();
const db = require('../../config/database');

// Middleware: only staff_hq can manage branches
function hqOnly(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'staff_hq') {
    return res.json({ status: 'error', message: 'Không có quyền truy cập' });
  }
  next();
}

// GET /api/branches
router.get('/', async (req, res) => {
  try {
    const result = await db.executeQuery('SELECT id, address, phoneNumber FROM Branch ORDER BY id');
    res.json({ status: 'success', branches: result });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

// POST /api/branches
router.post('/', hqOnly, async (req, res) => {
  try {
    const { id, address, phoneNumber } = req.body;
    if (!id || !address) {
      return res.json({ status: 'error', message: 'Vui lòng nhập đầy đủ thông tin' });
    }
    const existing = await db.executeQuery('SELECT * FROM Branch WHERE id = @id', { id });
    if (existing.length > 0) {
      return res.json({ status: 'error', message: 'Mã chi nhánh đã tồn tại' });
    }
    await db.executeQuery(
      'INSERT INTO Branch (id, address, phoneNumber) VALUES (@id, @address, @phoneNumber)',
      { id, address, phoneNumber: phoneNumber || '' }
    );
    res.json({ status: 'success', message: 'Thêm chi nhánh thành công' });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

// PUT /api/branches/:id
router.put('/:id', hqOnly, async (req, res) => {
  try {
    const { address, phoneNumber } = req.body;
    await db.executeQuery(
      'UPDATE Branch SET address = @address, phoneNumber = @phoneNumber WHERE id = @id',
      { id: req.params.id, address, phoneNumber: phoneNumber || '' }
    );
    res.json({ status: 'success', message: 'Cập nhật chi nhánh thành công' });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

// DELETE /api/branches/:id
router.delete('/:id', hqOnly, async (req, res) => {
  try {
    const id = req.params.id;
    // Check if branch has employees or trains
    const emps = await db.executeQuery('SELECT COUNT(*) as cnt FROM Employee WHERE idBranch = @id', { id });
    if (emps[0].cnt > 0) {
      return res.json({ status: 'error', message: 'Chi nhánh còn nhân viên, không thể xóa' });
    }
    const trains = await db.executeQuery('SELECT COUNT(*) as cnt FROM Train WHERE idBranch = @id', { id });
    if (trains[0].cnt > 0) {
      return res.json({ status: 'error', message: 'Chi nhánh còn tàu, không thể xóa' });
    }
    await db.executeQuery('DELETE FROM Branch WHERE id = @id', { id });
    res.json({ status: 'success', message: 'Xóa chi nhánh thành công' });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

module.exports = router;
