const express = require('express');
const router = express.Router();
const db = require('../../config/database');

// GET /api/tickets/customer/:customerId
router.get('/customer/:customerId', async (req, res) => {
  try {
    const customerId = req.params.customerId;
    const result = await db.executeQuery(
      `SELECT tk.id, tk.status, tk.createdAt,
              tr.DepartureTime, tr.DepartureStation, tr.Destination, tr.price,
              s.SeatNumber, s.SeatClass
       FROM Ticket tk
       JOIN TrainRideSeat trs ON tk.idTrainRideSeat = trs.id
       JOIN Seat s ON trs.idSeat = s.id
       JOIN TrainRide tr ON trs.idTrainRide = tr.id
       WHERE tk.idCustomer = @customerId
       ORDER BY tr.DepartureTime DESC`,
      { customerId }
    );
    res.json({ status: 'success', tickets: result });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

// POST /api/tickets/book
router.post('/book', async (req, res) => {
  try {
    const { IdTrainRide, IdCustomer, SeatClass, quantity, trsIds } = req.body;
    const qty = (Array.isArray(trsIds) && trsIds.length > 0) ? trsIds.length : (parseInt(quantity, 10) || 1);
    if (!IdTrainRide || !IdCustomer) {
      return res.json({ success: false, message: 'Vui lòng nhập đầy đủ thông tin' });
    }
    if (qty < 1 || qty > 10) {
      return res.json({ success: false, message: 'Số lượng vé phải từ 1 đến 10' });
    }

    const result = await db.executeTransaction(async (request) => {
      let finalTrsIds = [];

      if (Array.isArray(trsIds) && trsIds.length > 0) {
        // Specific seat selection
        request.input('rideId', IdTrainRide);
        const placeholders = trsIds.map((_, i) => `@trsId${i}`).join(',');
        trsIds.forEach((id, i) => request.input(`trsId${i}`, id));
        
        const checkResult = await request.query(
          `SELECT trs.id, trs.status, s.SeatClass FROM TrainRideSeat trs
           JOIN Seat s ON trs.idSeat = s.id
           WHERE trs.id IN (${placeholders}) AND trs.idTrainRide = @rideId`
        );
        const foundSeats = checkResult.recordset;
        const unavailable = foundSeats.filter(r => r.status !== 'AVAILABLE');
        if (foundSeats.length < qty || unavailable.length > 0) {
          const err = new Error('Một hoặc nhiều ghế bạn chọn đã được người khác đặt. Vui lòng chọn ghế khác!');
          err.isBusinessError = true;
          throw err;
        }
        finalTrsIds = trsIds;
      } else {
        // Find available seats for this ride and class
        request.input('rideId', IdTrainRide);
        request.input('seatClass', SeatClass);
        request.input('qty', qty);
        const availResult = await request.query(
          `SELECT TOP (@qty) trs.id as trsId, trs.idSeat FROM TrainRideSeat trs
           JOIN Seat s ON trs.idSeat = s.id
           WHERE trs.idTrainRide = @rideId AND s.SeatClass = @seatClass AND trs.status = 'AVAILABLE'
           ORDER BY CAST(s.SeatNumber AS INT)`
        );
        if (availResult.recordset.length < qty) {
          const err = new Error(`Chỉ còn ${availResult.recordset.length} ghế ${SeatClass} cho chuyến này`);
          err.isBusinessError = true;
          throw err;
        }
        finalTrsIds = availResult.recordset.map(r => r.trsId);
      }

      // Mark seats as BOOKED
      const placeholdersUpdate = finalTrsIds.map((_, i) => `@trsIdUp${i}`).join(',');
      finalTrsIds.forEach((id, i) => request.input(`trsIdUp${i}`, id));
      await request.query(
        `UPDATE TrainRideSeat SET status = 'BOOKED' WHERE id IN (${placeholdersUpdate})`
      );

      // Create tickets
      const ticketIds = [];
      for (let i = 0; i < finalTrsIds.length; i++) {
        const ticketId = 'TK' + Date.now() + '_' + i;
        ticketIds.push(ticketId);
        request.input(`ticketId${i}`, ticketId);
      }
      request.input('IdCustomer', IdCustomer);
      const values = finalTrsIds.map((_, i) => `(@ticketId${i}, @IdCustomer, 'pending', GETDATE(), @trsIdUp${i})`).join(',');
      await request.query(
        `INSERT INTO Ticket (id, idCustomer, status, createdAt, idTrainRideSeat) VALUES ${values}`
      );

      // Get price from TrainRide
      request.input('rideIdPrice', IdTrainRide);
      const priceResult = await request.query(
        `SELECT TOP 1 price FROM TrainRide WHERE id = @rideIdPrice`
      );
      const unitPrice = priceResult.recordset.length > 0 ? priceResult.recordset[0].price : 0;

      // Get seat classes of finalTrsIds to calculate pricing multiplier
      const seatDetails = await request.query(
        `SELECT trs.id, s.SeatClass FROM TrainRideSeat trs
         JOIN Seat s ON trs.idSeat = s.id
         WHERE trs.id IN (${placeholdersUpdate})`
      );
      let totalPrice = 0;
      seatDetails.recordset.forEach(seat => {
        const mult = seat.SeatClass === 'Hạng 1' ? 1.4 : 1.0;
        totalPrice += unitPrice * mult;
      });

      return { ticketIds, unitPrice, totalPrice };
    });

    res.json({ success: true, ticketIds: result.ticketIds, unitPrice: result.unitPrice, totalPrice: result.totalPrice, quantity: qty, message: `Đặt ${qty} vé thành công! Vui lòng thanh toán.` });
  } catch (error) {
    if (error.isBusinessError) {
      return res.json({ success: false, message: error.message });
    }
    console.error('❌ Error booking ticket:', error);
    res.json({ success: false, message: 'Lỗi khi đặt vé: ' + error.message });
  }
});

// POST /api/tickets/pay/:ticketId
router.post('/pay/:ticketId', async (req, res) => {
  try {
    const ticketId = req.params.ticketId;
    await db.executeQuery("UPDATE Ticket SET status = 'paid' WHERE id = @ticketId", { ticketId });
    res.json({ success: true, message: 'Thanh toán thành công' });
  } catch (error) {
    res.json({ success: false, message: 'Lỗi khi thanh toán: ' + error.message });
  }
});

// PUT /api/tickets/:ticketId/status
router.put('/:ticketId/status', async (req, res) => {
  try {
    const ticketId = req.params.ticketId;
    const { status } = req.body;
    if (!['pending', 'paid'].includes(status)) {
      return res.json({ success: false, message: 'Trạng thái không hợp lệ' });
    }
    const tickets = await db.executeQuery(
      `SELECT tk.*, tr.DepartureTime FROM Ticket tk
       JOIN TrainRideSeat trs ON tk.idTrainRideSeat = trs.id
       JOIN TrainRide tr ON trs.idTrainRide = tr.id
       WHERE tk.id = @ticketId`,
      { ticketId }
    );
    if (tickets.length === 0) {
      return res.json({ success: false, message: 'Không tìm thấy vé' });
    }
    const ticket = tickets[0];
    if (ticket.status === 'cancelled') {
      return res.json({ success: false, message: 'Vé đã bị hủy, không thể thay đổi trạng thái' });
    }
    await db.executeQuery("UPDATE Ticket SET status = @status WHERE id = @ticketId", { ticketId, status });
    res.json({ success: true, message: 'Cập nhật trạng thái thành công' });
  } catch (error) {
    res.json({ success: false, message: 'Lỗi: ' + error.message });
  }
});

// POST /api/tickets/cancel/:ticketId
router.post('/cancel/:ticketId', async (req, res) => {
  try {
    const ticketId = req.params.ticketId;
    const tickets = await db.executeQuery(
      `SELECT tk.*, trs.idTrainRide, trs.idSeat, tr.DepartureTime
       FROM Ticket tk
       JOIN TrainRideSeat trs ON tk.idTrainRideSeat = trs.id
       JOIN TrainRide tr ON trs.idTrainRide = tr.id
       WHERE tk.id = @ticketId`,
      { ticketId }
    );
    if (tickets.length === 0) {
      return res.json({ success: false, message: 'Không tìm thấy vé' });
    }
    const ticket = tickets[0];
    if (ticket.status === 'cancelled') {
      return res.json({ success: false, message: 'Vé đã được hủy trước đó' });
    }
    if (ticket.status === 'paid') {
      return res.json({ success: false, message: 'Vé đã thanh toán, không thể hủy' });
    }
    const departureTime = new Date(ticket.DepartureTime);
    if (departureTime <= new Date()) {
      return res.json({ success: false, message: 'Chuyến tàu đã khởi hành, không thể hủy' });
    }

    await db.executeTransaction(async (request) => {
      // Free seat in TrainRideSeat
      request.input('trsId', ticket.idTrainRideSeat);
      await request.query("UPDATE TrainRideSeat SET status = 'AVAILABLE' WHERE id = @trsId");
      request.input('cancelTicketId', ticketId);
      await request.query("UPDATE Ticket SET status = 'cancelled' WHERE id = @cancelTicketId");
    });

    res.json({ success: true, message: 'Hủy vé thành công' });
  } catch (error) {
    res.json({ success: false, message: 'Lỗi khi hủy vé: ' + error.message });
  }
});

module.exports = router;
