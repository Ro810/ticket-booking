const express = require('express');
const router = express.Router();
const db = require('../../config/database');

// GET /api/trains
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

// GET /api/trains/search/:from/:to
router.get('/search/:from/:to', async (req, res) => {
  try {
    const from = req.params.from;
    const to = req.params.to;
    const date = req.query.date;
    let query = `SELECT tr.*, t.ManufacturingBrand,
      (SELECT COUNT(*) FROM TrainRideSeat trs JOIN Seat s ON trs.idSeat=s.id WHERE trs.idTrainRide=tr.id AND s.SeatClass='Hạng 1' AND trs.status='AVAILABLE') as availableClass1,
      (SELECT COUNT(*) FROM TrainRideSeat trs JOIN Seat s ON trs.idSeat=s.id WHERE trs.idTrainRide=tr.id AND s.SeatClass='Hạng 2' AND trs.status='AVAILABLE') as availableClass2
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

// GET /api/train-price/:trainId
router.get('/price/:trainId', async (req, res) => {
  try {
    const trainId = req.params.trainId;
    const result = await db.executeQuery(
      `SELECT TOP 1 ticketPrice as price FROM Ticket WHERE IdTrainRide = @trainId ORDER BY ticketPrice DESC`,
      { trainId }
    );
    if (result && result.length > 0) {
      res.json({ status: 'success', price: result[0].price });
    } else {
      res.json({ status: 'success', price: 100000 });
    }
  } catch (error) {
    console.error('Error getting train price:', error);
    res.json({ status: 'success', price: 100000 });
  }
});

// POST /api/trains/ride
router.post('/ride', async (req, res) => {
  try {
    const { id, idTrain, DepartureStation, Destination, DepartureTime } = req.body;
    if (!id || !idTrain || !DepartureStation || !Destination || !DepartureTime) {
      return res.json({ status: 'error', message: 'Vui lòng nhập đầy đủ thông tin' });
    }
    await db.executeQuery(
      `INSERT INTO TrainRide (id, idTrain, DepartureStation, Destination, DepartureTime)
       VALUES (@id, @idTrain, @DepartureStation, @Destination, @DepartureTime)`,
      {
        id, idTrain, DepartureStation, Destination,
        DepartureTime: new Date(DepartureTime).toISOString()
      }
    );
    // Seed TrainRideSeat for the new ride using seats of the train
    const seats = await db.executeQuery('SELECT id FROM Seat WHERE idTrain = @trainId', { trainId: idTrain });
    if (seats.length > 0) {
      const values = seats.map(s => `('${id}', '${s.id}', 'AVAILABLE')`).join(',');
      await db.executeQuery(`INSERT INTO TrainRideSeat (idTrainRide, idSeat, status) VALUES ${values}`);
    }
    res.json({ status: 'success', message: 'Thêm chuyến tàu thành công' });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

// PUT /api/trains/ride/:id
router.put('/ride/:id', async (req, res) => {
  try {
    const { idTrain, DepartureStation, Destination, DepartureTime } = req.body;
    await db.executeQuery(
      `UPDATE TrainRide SET idTrain = @idTrain, DepartureStation = @DepartureStation, Destination = @Destination,
       DepartureTime = @DepartureTime
       WHERE id = @id`,
      {
        id: req.params.id, idTrain, DepartureStation, Destination,
        DepartureTime: new Date(DepartureTime).toISOString()
      }
    );
    res.json({ status: 'success', message: 'Cập nhật thành công' });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

// DELETE /api/trains/ride/:id
router.delete('/ride/:id', async (req, res) => {
  try {
    const tickets = await db.executeQuery('SELECT COUNT(*) as cnt FROM Ticket WHERE IdTrainRide = @id', { id: req.params.id });
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

// GET /api/trains/prices
router.get('/prices', async (req, res) => {
  try {
    const result = await db.executeQuery('SELECT SeatClass, price FROM SeatPrice ORDER BY price DESC');
    res.json({ status: 'success', prices: result || [] });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

// GET /api/trains/:id/seats
router.get('/:id/seats', async (req, res) => {
  try {
    const trainId = req.params.id;
    const seats = await db.executeQuery(
      `SELECT trs.idSeat, s.SeatNumber, s.SeatClass, trs.status
       FROM TrainRideSeat trs
       JOIN Seat s ON trs.idSeat = s.id
       WHERE trs.idTrainRide = @trainId
       ORDER BY s.SeatClass, s.SeatNumber`,
      { trainId }
    );
    res.json({ status: 'success', seats: seats || [] });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

module.exports = router;
