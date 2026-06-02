const express = require('express');
const router = express.Router();
const db = require('../../config/database');

// GET /api/tickets/customer/:customerId
router.get('/customer/:customerId', async (req, res) => {
  try {
    const customerId = req.params.customerId;
    const result = await db.executeQuery(
      `SELECT t.id, t.idTrainRide, t.idSeat, t.status, t.idBranch, t.createdAt,
              tr.DepartureTime, tr.DepartureStation, tr.Destination, s.SeatNumber, s.SeatClass, sp.price as ticketPrice
       FROM Ticket t
       JOIN TrainRide tr ON t.idTrainRide = tr.id
       LEFT JOIN Seat s ON t.idSeat = s.id
       LEFT JOIN SeatPrice sp ON s.SeatClass = sp.SeatClass
       WHERE t.idCustomer = @customerId
       ORDER BY tr.DepartureTime DESC`,
      { customerId }
    );
    res.json({ status: 'success', tickets: result });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

// GET /api/tickets/staff/:employeeId
router.get('/staff/:employeeId', async (req, res) => {
  try {
    const employeeId = req.params.employeeId;
    const result = await db.executeQuery(
      `SELECT t.id, t.idTrainRide, t.idSeat, t.status, t.idBranch, t.createdAt,
              tr.DepartureTime, tr.DepartureStation, tr.Destination,
              c.Name as customerName, c.phoneNumber as customerPhone, s.SeatNumber, s.SeatClass, sp.price as ticketPrice
       FROM Ticket t
       JOIN TrainRide tr ON t.idTrainRide = tr.id
       LEFT JOIN Customer c ON t.idCustomer = c.id
       LEFT JOIN Seat s ON t.idSeat = s.id
       LEFT JOIN SeatPrice sp ON s.SeatClass = sp.SeatClass
       ORDER BY tr.DepartureTime DESC`,
      { employeeId }
    );
    res.json({ status: 'success', tickets: result });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

// POST /api/tickets/book
router.post('/book', async (req, res) => {
  try {
    const { IdTrainRide, IdCustomer, SeatClass, quantity } = req.body;
    const qty = parseInt(quantity, 10) || 1;
    if (!IdTrainRide || !IdCustomer || !SeatClass) {
      return res.json({ success: false, message: 'Vui lòng nhập đầy đủ thông tin' });
    }
    if (qty < 1 || qty > 10) {
      return res.json({ success: false, message: 'Số lượng vé phải từ 1 đến 10' });
    }

    const result = await db.executeTransaction(async (request) => {
      // Find available seats for this ride and class
      request.input('rideId', IdTrainRide);
      request.input('seatClass', SeatClass);
      request.input('qty', qty);
      const availResult = await request.query(
        `SELECT TOP (@qty) trs.idSeat FROM TrainRideSeat trs
         JOIN Seat s ON trs.idSeat = s.id
         WHERE trs.idTrainRide = @rideId AND s.SeatClass = @seatClass AND trs.status = 'AVAILABLE'
         ORDER BY s.SeatNumber`
      );
      if (availResult.recordset.length < qty) {
        const err = new Error(`Chỉ còn ${availResult.recordset.length} ghế ${SeatClass} cho chuyến này`);
        err.isBusinessError = true;
        throw err;
      }
      const seatIds = availResult.recordset.map(r => r.idSeat);

      // Book seats via TrainRideSeat
      const placeholders = seatIds.map((_, i) => `@seatId${i}`).join(',');
      seatIds.forEach((sid, i) => request.input(`seatId${i}`, sid));
      await request.query(
        `UPDATE TrainRideSeat SET status = 'BOOKED' WHERE idTrainRide = @rideId AND idSeat IN (${placeholders})`
      );

      const idBranch = req.session.user?.idBranch || null;
      const values = seatIds.map((sid, i) => `(@ticketId${i}, @IdTrainRide, @IdCustomer, @seatId${i}, 'pending', @idBranch, GETDATE())`).join(',');
      seatIds.forEach((sid, i) => {
        request.input(`ticketId${i}`, 'TK' + Date.now() + '_' + i);
      });
      request.input('IdTrainRide', IdTrainRide);
      request.input('IdCustomer', IdCustomer);
      request.input('idBranch', idBranch || null);
      await request.query(
        `INSERT INTO Ticket (id, idTrainRide, idCustomer, idSeat, status, idBranch, createdAt)
         VALUES ${values}`
      );

      // Get price from SeatPrice
      request.input('priceClass', SeatClass);
      const priceResult = await request.query(
        'SELECT TOP 1 price FROM SeatPrice WHERE SeatClass = @priceClass'
      );
      const unitPrice = priceResult.recordset.length > 0 ? priceResult.recordset[0].price : 0;

      const ticketIds = seatIds.map((_, i) => request.parameters[`ticketId${i}`].value);
      return { ticketIds, seatIds, unitPrice, totalPrice: unitPrice * qty };
    });

    res.json({ success: true, ticketIds: result.ticketIds, seatIds: result.seatIds, unitPrice: result.unitPrice, totalPrice: result.totalPrice, quantity: qty, message: `Đặt ${qty} vé thành công! Vui lòng thanh toán.` });
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

function canManageTicket(ticket, user) {
  if (!user) return false;
  if (user.role === 'staff_hq') {
    return !ticket.idBranch || ticket.idBranch === user.idBranch;
  }
  return ticket.idCustomer === user.id;
}

// PUT /api/tickets/:ticketId/status
router.put('/:ticketId/status', async (req, res) => {
  try {
    const ticketId = req.params.ticketId;
    const { status } = req.body;
    if (!['pending', 'paid'].includes(status)) {
      return res.json({ success: false, message: 'Trạng thái không hợp lệ' });
    }
    const tickets = await db.executeQuery(
      `SELECT t.*, tr.DepartureTime FROM Ticket t JOIN TrainRide tr ON t.idTrainRide = tr.id WHERE t.id = @ticketId`,
      { ticketId }
    );
    if (tickets.length === 0) {
      return res.json({ success: false, message: 'Không tìm thấy vé' });
    }
    const ticket = tickets[0];
    if (ticket.status === 'cancelled') {
      return res.json({ success: false, message: 'Vé đã bị hủy, không thể thay đổi trạng thái' });
    }
    if (!canManageTicket(ticket, req.session.user)) {
      return res.json({ success: false, message: 'Bạn không có quyền quản lý vé này' });
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
      `SELECT t.*, tr.DepartureTime FROM Ticket t JOIN TrainRide tr ON t.idTrainRide = tr.id WHERE t.id = @ticketId`,
      { ticketId }
    );
    if (tickets.length === 0) {
      return res.json({ success: false, message: 'Không tìm thấy vé' });
    }
    const ticket = tickets[0];
    if (ticket.status === 'cancelled') {
      return res.json({ success: false, message: 'Vé đã được hủy trước đó' });
    }
    const departureTime = new Date(ticket.DepartureTime);
    if (departureTime <= new Date()) {
      return res.json({ success: false, message: 'Vé đã hết hạn hoặc chuyến tàu đã khởi hành, không thể hủy' });
    }
    if (!canManageTicket(ticket, req.session.user)) {
      return res.json({ success: false, message: 'Bạn không có quyền hủy vé này' });
    }

    await db.executeTransaction(async (request) => {
      // Free seat in TrainRideSeat
      if (ticket.idSeat && ticket.idTrainRide) {
        request.input('rideId', ticket.idTrainRide);
        request.input('seatId', ticket.idSeat);
        await request.query(
          "UPDATE TrainRideSeat SET status = 'AVAILABLE' WHERE idTrainRide = @rideId AND idSeat = @seatId"
        );
      }
      request.input('cancelTicketId', ticketId);
      await request.query("UPDATE Ticket SET status = 'cancelled' WHERE id = @cancelTicketId");
    });

    res.json({ success: true, message: 'Hủy vé thành công' });
  } catch (error) {
    res.json({ success: false, message: 'Lỗi khi hủy vé: ' + error.message });
  }
});

module.exports = router;
