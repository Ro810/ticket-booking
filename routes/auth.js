const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../config/database');

const SALT_ROUNDS = 10;

// GET /login
router.get('/login', (req, res) => {
  const role = req.query.role || 'passenger';
  res.render('login', { role, error: null });
});

// POST /login
router.post('/login', async (req, res) => {
  const { role, username, password, phone } = req.body;
  try {
    if (role === 'passenger') {
      if (!username || !password) {
        return res.render('login', { role, error: 'Vui lòng nhập username và password!' });
      }
      const result = await db.executeQuery(
        'SELECT * FROM Customer WHERE username = @username',
        { username }
      );
      if (result.length === 0) {
        return res.render('login', { role, error: 'Username không tồn tại!' });
      }
      const customer = result[0];
      const valid = await bcrypt.compare(password, customer.password);
      if (!valid) {
        return res.render('login', { role, error: 'Mật khẩu không đúng!' });
      }
      req.session.user = {
        id: customer.id,
        username: customer.username,
        name: customer.Name || customer.name,
        email: customer.Email || customer.email,
        phone: customer.phoneNumber,
        address: customer.Address || customer.address,
        role: 'passenger'
      };
      return res.redirect('/dashboard');
    }

    // Manager login
    if (!username || !password) {
      return res.render('login', { role, error: 'Vui lòng nhập mã nhân viên và mật khẩu!' });
    }
    const employeeId = username.trim();
    const result = await db.executeQuery(
      'SELECT * FROM Employee WHERE id = @id',
      { id: employeeId }
    );
    if (result.length === 0) {
      return res.render('login', { role, error: 'Mã nhân viên không tồn tại!' });
    }
    const employee = result[0];

    // Verify password
    const pwdHash = employee.password;
    if (!pwdHash) {
      return res.render('login', { role, error: 'Tài khoản chưa có mật khẩu, vui lòng liên hệ quản lý!' });
    }
    const valid = await bcrypt.compare(password, pwdHash);
    if (!valid) {
      return res.render('login', { role, error: 'Mật khẩu không đúng!' });
    }

    const isManager = employee.role && (employee.role.toLowerCase().includes('quản lý') || employee.role.toLowerCase().includes('manager'));
    if (!isManager) {
      return res.render('login', { role, error: 'Tài khoản không có quyền quản lý!' });
    }

    // Determine session role based on employee.role
    const isHQ = employee.role.includes('trụ sở');
    const sessionRole = isHQ ? 'staff_hq' : 'staff_base';

    // Fetch branch info
    let branchName = employee.idBranch;
    if (employee.idBranch) {
      const branchResult = await db.executeQuery('SELECT address FROM Branch WHERE id = @id', { id: employee.idBranch });
      if (branchResult.length > 0) branchName = branchResult[0].address;
    }

    req.session.user = {
      id: employee.id,
      fullname: employee.fullname,
      phone: employee.phoneNumber,
      salary: employee.salary,
      idBranch: employee.idBranch,
      branchName: branchName,
      employeeRole: employee.role,
      role: sessionRole
    };
    res.redirect('/dashboard');
  } catch (error) {
    res.render('login', { role, error: 'Lỗi: ' + error.message });
  }
});

// GET /register
router.get('/register', (req, res) => {
  res.render('register', { error: null });
});

// POST /register
router.post('/register', async (req, res) => {
  const { username, password, phone, name, email } = req.body;
  try {
    if (!username || !password || !name || !email || !phone) {
      return res.render('register', { error: 'Vui lòng nhập đầy đủ thông tin!' });
    }
    const existing = await db.executeQuery(
      'SELECT * FROM Customer WHERE username = @username',
      { username }
    );
    if (existing.length > 0) {
      return res.render('register', { error: 'Username đã tồn tại!' });
    }
    const customers = await db.executeQuery('SELECT TOP 1 id FROM Customer ORDER BY id DESC');
    let newId = '1';
    if (customers.length > 0) {
      const lastId = customers[0].id;
      const num = parseInt(lastId.replace(/\D/g, '')) || 0;
      newId = 'KH' + String(num + 1).padStart(2, '0');
    }
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    await db.executeQuery(
      'INSERT INTO Customer (id, Name, username, password, phoneNumber, Address) VALUES (@id, @name, @username, @password, @phoneNumber, @address)',
      { id: newId, name, username, password: hashedPassword, phoneNumber: phone, address: email }
    );
    res.redirect('/login?role=passenger&success=1');
  } catch (error) {
    res.render('register', { error: 'Lỗi đăng ký: ' + error.message });
  }
});

// GET /logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;
