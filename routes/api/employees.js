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
       ORDER BY e.id`,
        );
        res.json({ status: 'success', employees: result });
    } catch (error) {
        res.json({ status: 'error', message: error.message });
    }
});

// POST /api/employees
router.post('/', hqOnly, async (req, res) => {
    try {
        const { fullname, salary, role, phoneNumber, idBranch, password } = req.body;
        if (!fullname || !role || !phoneNumber || !idBranch || !password) {
            return res.json({ status: 'error', message: 'Vui lòng nhập đầy đủ thông tin' });
        }
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        // Debug log to verify password hashing and payload (do not log raw password)
        console.log('Adding employee:', { fullname, role, idBranch, phoneNumber, salary: parseFloat(salary) || 0, hashedPassword: hashedPassword.slice(0, 10) + '...' });
        await db.executeQuery(
            `INSERT INTO Employee (fullname, salary, role, phoneNumber, idBranch, password)
       VALUES (@fullname, @salary, @role, @phoneNumber, @idBranch, @password)`,
            {
                fullname,
                salary: parseFloat(salary) || 0,
                role,
                phoneNumber,
                idBranch,
                password: hashedPassword,
            },
        );
        // Fetch the inserted employee to verify stored values (for debugging)
        try {
            const inserted = await db.executeQuery(
                `SELECT TOP 1 * FROM Employee WHERE phoneNumber = @phoneNumber AND fullname = @fullname ORDER BY id DESC`,
                { phoneNumber, fullname },
            );
            console.log('Inserted employee row:', inserted[0] || null);
        } catch (err) {
            console.error('Error fetching inserted employee:', err.message);
        }
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
            {
                id: req.params.id,
                fullname,
                salary: parseFloat(salary) || 0,
                role,
                phoneNumber,
                idBranch,
            },
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

// DEBUG: insert employee without auth (for local testing only)
router.post('/debug/add', async (req, res) => {
    try {
        const { fullname, salary, role, phoneNumber, idBranch, password } = req.body;
        if (!fullname || !role || !phoneNumber || !idBranch || !password) {
            return res.json({ status: 'error', message: 'Vui lòng nhập đầy đủ thông tin' });
        }
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        await db.executeQuery(
            `INSERT INTO Employee (fullname, salary, role, phoneNumber, idBranch, password)
       VALUES (@fullname, @salary, @role, @phoneNumber, @idBranch, @password)`,
            {
                fullname,
                salary: parseFloat(salary) || 0,
                role,
                phoneNumber,
                idBranch,
                password: hashedPassword,
            },
        );
        const inserted = await db.executeQuery(
            `SELECT TOP 1 * FROM Employee WHERE phoneNumber = @phoneNumber AND fullname = @fullname ORDER BY id DESC`,
            { phoneNumber, fullname },
        );
        console.log('DEBUG Added employee row:', inserted[0] || null);
        res.json({ status: 'success', inserted: inserted[0] || null });
    } catch (error) {
        res.json({ status: 'error', message: error.message });
    }
});

module.exports = router;
