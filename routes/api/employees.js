const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../../config/database');

const SALT_ROUNDS = 10;

// Middleware: only staff_hq can manage employees
function hqOnly(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'staff_hq') {
    return res.json({ status: 'error', message: 'Không có quyền truy cập' });
  }
  next();
}

// GET /api/employees
router.get('/', hqOnly, async (req, res) => {
  try {
    const result = await db.executeQuery(
      `SELECT e.id, e.fullname, e.salary, e.role, e.phoneNumber, e.idBranch, b.address as branchName
       FROM Employee e
       LEFT JOIN Branch b ON e.idBranch = b.id
       ORDER BY e.id`
    );
    res.json({ status: 'success', employees: result });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

// POST /api/employees
router.post('/', hqOnly, async (req, res) => {
  try {
    const { id, fullname, salary, role, phoneNumber, idBranch, password } = req.body;
    if (!id || !fullname || !role || !phoneNumber || !idBranch || !password) {
      return res.json({ status: 'error', message: 'Vui lòng nhập đầy đủ thông tin' });
    }
    const existing = await db.executeQuery('SELECT * FROM Employee WHERE id = @id', { id });
    if (existing.length > 0) {
      return res.json({ status: 'error', message: 'Mã nhân viên đã tồn tại' });
    }
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    await db.executeQuery(
      `INSERT INTO Employee (id, fullname, salary, role, phoneNumber, idBranch, password)
       VALUES (@id, @fullname, @salary, @role, @phoneNumber, @idBranch, @password)`,
      { id, fullname, salary: parseFloat(salary) || 0, role, phoneNumber, idBranch, password: hashedPassword }
    );
    res.json({ status: 'success', message: 'Thêm nhân viên thành công' });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

// PUT /api/employees/:id
router.put('/:id', hqOnly, async (req, res) => {
  try {
    const { fullname, salary, role, phoneNumber, idBranch } = req.body;
    await db.executeQuery(
      `UPDATE Employee SET fullname = @fullname, salary = @salary, role = @role,
       phoneNumber = @phoneNumber, idBranch = @idBranch WHERE id = @id`,
      { id: req.params.id, fullname, salary: parseFloat(salary) || 0, role, phoneNumber, idBranch }
    );
    res.json({ status: 'success', message: 'Cập nhật nhân viên thành công' });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

// DELETE /api/employees/:id
router.delete('/:id', hqOnly, async (req, res) => {
  try {
    const id = req.params.id;
    // Don't allow self-delete
    if (req.session.user && req.session.user.id === id) {
      return res.json({ status: 'error', message: 'Không thể xóa chính mình' });
    }
    await db.executeQuery('DELETE FROM Employee WHERE id = @id', { id });
    res.json({ status: 'success', message: 'Xóa nhân viên thành công' });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

module.exports = router;
