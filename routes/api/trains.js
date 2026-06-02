const express = require('express');
const router = express.Router();
const db = require('../../config/database');

// Middleware: only staff_hq can modify
function hqOnly(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'staff_hq') {
    return res.json({ status: 'error', message: 'Không có quyền truy cập' });
  }
  next();
}

// GET /api/trains - list all train rides
router.get('/', async (req, res) => {
  try {
    const result = await db.executeQuery(
      `SELECT tr.*, t.ManufacturingBrand
       FROM TrainRide tr
       LEFT JOIN Train t ON tr.idTrain = t.id
       ORDER BY tr.DepartureTime DESC`
    );
    res.json({ status: 'success', trains: result });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

// GET /api/trains/list - list Train entities (not rides) for dropdown
router.get('/list', async (req, res) => {
  try {
    const result = await db.executeQuery(
      `SELECT t.id, t.ManufacturingBrand, t.class1Seats, t.class2Seats, t.idBranch, b.address as branchName
       FROM Train t LEFT JOIN Branch b ON t.idBranch = b.id ORDER BY t.id`
    );
    res.json({ status: 'success', trains: result });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

// POST /api/trains/entity - Create a new Train (entity) + auto-create Seat records
router.post('/entity', hqOnly, async (req, res) => {
  try {
    const { id, ManufacturingBrand, class1Seats, class2Seats, idBranch } = req.body;
    if (!id || !ManufacturingBrand || !idBranch) {
      return res.json({ status: 'error', message: 'Vui lòng nhập đầy đủ thông tin' });
    }
    const existing = await db.executeQuery('SELECT * FROM Train WHERE id = @id', { id });
    if (existing.length > 0) {
      return res.json({ status: 'error', message: 'Mã tàu đã tồn tại' });
    }

    const c1 = parseInt(class1Seats) || 30;
    const c2 = parseInt(class2Seats) || 120;

    // Insert Train
    await db.executeQuery(
      `INSERT INTO Train (id, ManufacturingBrand, class1Seats, class2Seats, idBranch)
       VALUES (@id, @brand, @c1, @c2, @idBranch)`,
      { id, brand: ManufacturingBrand, c1, c2, idBranch }
    );

    // Auto-create Seat records
    let seatNum = 1;
    for (let i = 0; i < c1; i++) {
      const seatId = `${id}_S${String(seatNum).padStart(3, '0')}`;
      await db.executeQuery(
        `INSERT INTO Seat (id, idTrain, SeatNumber, SeatClass) VALUES (@seatId, @trainId, @seatNum, N'Hạng 1')`,
        { seatId, trainId: id, seatNum: String(seatNum) }
      );
      seatNum++;
    }
    for (let i = 0; i < c2; i++) {
      const seatId = `${id}_S${String(seatNum).padStart(3, '0')}`;
      await db.executeQuery(
        `INSERT INTO Seat (id, idTrain, SeatNumber, SeatClass) VALUES (@seatId, @trainId, @seatNum, N'Hạng 2')`,
        { seatId, trainId: id, seatNum: String(seatNum) }
      );
      seatNum++;
    }

    res.json({ status: 'success', message: `Thêm tàu thành công! Đã tạo ${seatNum - 1} ghế.` });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

// PUT /api/trains/entity/:id - Update Train entity
router.put('/entity/:id', hqOnly, async (req, res) => {
  try {
    const { ManufacturingBrand, idBranch } = req.body;
    await db.executeQuery(
      `UPDATE Train SET ManufacturingBrand = @brand, idBranch = @idBranch WHERE id = @id`,
      { id: req.params.id, brand: ManufacturingBrand, idBranch }
    );
    res.json({ status: 'success', message: 'Cập nhật tàu thành công' });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

// DELETE /api/trains/entity/:id - Delete Train entity + its seats
router.delete('/entity/:id', hqOnly, async (req, res) => {
  try {
    const id = req.params.id;
    // Check if train has rides
    const rides = await db.executeQuery('SELECT COUNT(*) as cnt FROM TrainRide WHERE idTrain = @id', { id });
    if (rides[0].cnt > 0) {
      return res.json({ status: 'error', message: 'Tàu đang có chuyến, không thể xóa' });
    }
    await db.executeQuery('DELETE FROM Seat WHERE idTrain = @id', { id });
    await db.executeQuery('DELETE FROM Train WHERE id = @id', { id });
    res.json({ status: 'success', message: 'Xóa tàu thành công' });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

// GET /api/trains/search/:from/:to
router.get('/search/:from/:to', async (req, res) => {
  try {
    const from = req.params.from;
    const to = req.params.to;
    const date = req.query.date;
    let query = `SELECT tr.*, t.ManufacturingBrand,
      (SELECT COUNT(*) FROM TrainRideSeat trs JOIN Seat s ON trs.idSeat=s.id WHERE trs.idTrainRide=tr.id AND s.SeatClass=N'Hạng 1' AND trs.status='AVAILABLE') as availableClass1,
      (SELECT COUNT(*) FROM TrainRideSeat trs JOIN Seat s ON trs.idSeat=s.id WHERE trs.idTrainRide=tr.id AND s.SeatClass=N'Hạng 2' AND trs.status='AVAILABLE') as availableClass2
     FROM TrainRide tr LEFT JOIN Train t ON tr.idTrain = t.id WHERE 1=1`;
    const params = {};
    if (from && from !== '-') {
      query += ` AND tr.DepartureStation = @from`;
      params.from = from;
    }
    if (to && to !== '-') {
      query += ` AND tr.Destination = @to`;
      params.to = to;
    }
    if (date) {
      query += ` AND CAST(tr.DepartureTime AS DATE) = @date`;
      params.date = date;
    }
    query += ` ORDER BY tr.DepartureTime DESC`;
    const result = await db.executeQuery(query, params);
    res.json({ status: 'success', trains: result });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

// POST /api/trains/ride - Create a new TrainRide + auto-create TrainRideSeat
router.post('/ride', hqOnly, async (req, res) => {
  try {
    const { id, idTrain, DepartureStation, Destination, DepartureTime, price } = req.body;
    if (!id || !idTrain || !DepartureStation || !Destination || !DepartureTime) {
      return res.json({ status: 'error', message: 'Vui lòng nhập đầy đủ thông tin' });
    }
    await db.executeQuery(
      `INSERT INTO TrainRide (id, idTrain, DepartureStation, Destination, DepartureTime, price)
       VALUES (@id, @idTrain, @DepartureStation, @Destination, @DepartureTime, @price)`,
      {
        id, idTrain, DepartureStation, Destination,
        DepartureTime: new Date(DepartureTime).toISOString(),
        price: parseFloat(price) || 0
      }
    );
    // Auto-create TrainRideSeat for all seats of the train
    const seats = await db.executeQuery('SELECT id FROM Seat WHERE idTrain = @trainId', { trainId: idTrain });
    if (seats.length > 0) {
      for (const s of seats) {
        await db.executeQuery(
          `INSERT INTO TrainRideSeat (idTrainRide, idSeat, status) VALUES (@rideId, @seatId, 'AVAILABLE')`,
          { rideId: id, seatId: s.id }
        );
      }
    }
    res.json({ status: 'success', message: `Thêm chuyến tàu thành công! Đã tạo ${seats.length} ghế.` });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

// PUT /api/trains/ride/:id
router.put('/ride/:id', hqOnly, async (req, res) => {
  try {
    const { idTrain, DepartureStation, Destination, DepartureTime, price } = req.body;
    await db.executeQuery(
      `UPDATE TrainRide SET idTrain = @idTrain, DepartureStation = @DepartureStation, Destination = @Destination,
       DepartureTime = @DepartureTime, price = @price WHERE id = @id`,
      {
        id: req.params.id, idTrain, DepartureStation, Destination,
        DepartureTime: new Date(DepartureTime).toISOString(),
        price: parseFloat(price) || 0
      }
    );
    res.json({ status: 'success', message: 'Cập nhật thành công' });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

// DELETE /api/trains/ride/:id
router.delete('/ride/:id', hqOnly, async (req, res) => {
  try {
    const tickets = await db.executeQuery(
      `SELECT COUNT(*) as cnt FROM Ticket tk
       JOIN TrainRideSeat trs ON tk.idTrainRideSeat = trs.id
       WHERE trs.idTrainRide = @id`,
      { id: req.params.id }
    );
    if (tickets[0].cnt > 0) {
      return res.json({ status: 'error', message: 'Chuyến tàu đã có vé, không thể xóa' });
    }
    await db.executeQuery('DELETE FROM TrainRideSeat WHERE idTrainRide = @id', { id: req.params.id });
    await db.executeQuery('DELETE FROM TrainRide WHERE id = @id', { id: req.params.id });
    res.json({ status: 'success', message: 'Xóa chuyến tàu thành công' });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

// GET /api/trains/:id/seats
router.get('/:id/seats', async (req, res) => {
  try {
    const trainId = req.params.id;
    const seats = await db.executeQuery(
      `SELECT trs.id as trsId, trs.idSeat, s.SeatNumber, s.SeatClass, trs.status
       FROM TrainRideSeat trs
       JOIN Seat s ON trs.idSeat = s.id
       WHERE trs.idTrainRide = @trainId
       ORDER BY s.SeatClass, CAST(s.SeatNumber AS INT)`,
      { trainId }
    );
    res.json({ status: 'success', seats: seats || [] });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

module.exports = router;
