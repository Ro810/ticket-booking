const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../../config/database');

const SALT_ROUNDS = 10;

// GET /api/customers?search=phone
router.get('/', async (req, res) => {
  try {
    const search = req.query.search || '';
    let query = 'SELECT id, Name, username, phoneNumber, Address FROM Customer';
    const params = {};
    if (search) {
      query += ' WHERE phoneNumber LIKE @search OR Name LIKE @search OR id LIKE @search';
      params.search = '%' + search + '%';
    }
    query += ' ORDER BY Name';
    const result = await db.executeQuery(query, params);
    res.json({ status: 'success', customers: result });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

// GET /api/customers/:id
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const customers = await db.executeQuery('SELECT * FROM Customer WHERE id = @id', { id });
    if (customers.length === 0) {
      return res.json({ status: 'error', message: 'Không tìm thấy khách hàng' });
    }
    const tickets = await db.executeQuery(
      `SELECT t.id, t.idTrainRide, t.idSeat, t.status, t.idBranch, t.createdAt,
              tr.DepartureTime, tr.DepartureStation, tr.Destination,
              s.SeatNumber, s.SeatClass, sp.price as ticketPrice
       FROM Ticket t
       JOIN TrainRide tr ON t.IdTrainRide = tr.id
       LEFT JOIN Seat s ON t.idSeat = s.id
       LEFT JOIN SeatPrice sp ON s.SeatClass = sp.SeatClass
       WHERE t.IdCustomer = @customerId
       ORDER BY tr.DepartureTime DESC`,
      { customerId: id }
    );
    res.json({ status: 'success', customer: customers[0], tickets });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

// POST /api/customers
router.post('/', async (req, res) => {
  try {
    const { name, username, password, phoneNumber, address } = req.body;
    if (!name || !username || !password || !phoneNumber) {
      return res.json({ status: 'error', message: 'Vui lòng nhập đầy đủ thông tin' });
    }
    const existing = await db.executeQuery('SELECT * FROM Customer WHERE username = @username', { username });
    if (existing.length > 0) {
      return res.json({ status: 'error', message: 'Username đã tồn tại' });
    }
    const maxId = await db.executeQuery('SELECT TOP 1 id FROM Customer ORDER BY id DESC');
    let newId = 'KH01';
    if (maxId.length > 0) {
      const num = parseInt(maxId[0].id.replace(/\D/g, '')) || 0;
      newId = 'KH' + String(num + 1).padStart(2, '0');
    }
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    await db.executeQuery(
      'INSERT INTO Customer (id, Name, username, password, phoneNumber, Address) VALUES (@id, @name, @username, @password, @phoneNumber, @address)',
      { id: newId, name, username, password: hashedPassword, phoneNumber, address: address || '' }
    );
    res.json({ status: 'success', message: 'Thêm khách hàng thành công', customerId: newId });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

// PUT /api/customers/:id
router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { name, phoneNumber, address } = req.body;
    await db.executeQuery(
      'UPDATE Customer SET Name = @name, phoneNumber = @phoneNumber, Address = @address WHERE id = @id',
      { id, name, phoneNumber, address: address || '' }
    );
    res.json({ status: 'success', message: 'Cập nhật thành công' });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

// DELETE /api/customers/:id
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    // Check if customer has tickets
    const tickets = await db.executeQuery('SELECT COUNT(*) as cnt FROM Ticket WHERE IdCustomer = @id', { id });
    if (tickets[0].cnt > 0) {
      return res.json({ status: 'error', message: 'Khách hàng đã có vé, không thể xóa' });
    }
    await db.executeQuery('DELETE FROM Customer WHERE id = @id', { id });
    res.json({ status: 'success', message: 'Xóa khách hàng thành công' });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

module.exports = router;
