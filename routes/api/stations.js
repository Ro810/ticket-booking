const express = require('express');
const router = express.Router();
const db = require('../../config/database');

// GET /api/stations
router.get('/', async (req, res) => {
  try {
    const result = await db.executeQuery('SELECT Name, Address FROM Station ORDER BY Name');
    res.json({ status: 'success', stations: result });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

// POST /api/stations
router.post('/', async (req, res) => {
  try {
    const { Name, Address } = req.body;
    if (!Name) {
      return res.json({ status: 'error', message: 'Vui lòng nhập tên ga' });
    }
    const existing = await db.executeQuery('SELECT * FROM Station WHERE Name = @name', { name: Name });
    if (existing.length > 0) {
      return res.json({ status: 'error', message: 'Ga tàu đã tồn tại' });
    }
    await db.executeQuery(
      'INSERT INTO Station (Name, Address) VALUES (@name, @address)',
      { name: Name, address: Address || '' }
    );
    res.json({ status: 'success', message: 'Thêm ga tàu thành công' });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

// PUT /api/stations/:name
router.put('/:name', async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const { Name, Address } = req.body;
    await db.executeQuery(
      'UPDATE Station SET Name = @newName, Address = @address WHERE Name = @oldName',
      { newName: Name, address: Address || '', oldName: name }
    );
    res.json({ status: 'success', message: 'Cập nhật thành công' });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

// DELETE /api/stations/:name
router.delete('/:name', async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const rides = await db.executeQuery(
      'SELECT COUNT(*) as cnt FROM TrainRide WHERE DepartureStation = @name OR Destination = @name',
      { name }
    );
    if (rides[0].cnt > 0) {
      return res.json({ status: 'error', message: 'Ga tàu đang được sử dụng trong chuyến tàu, không thể xóa' });
    }
    await db.executeQuery('DELETE FROM Station WHERE Name = @name', { name });
    res.json({ status: 'success', message: 'Xóa ga tàu thành công' });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

module.exports = router;
