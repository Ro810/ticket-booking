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
        // Specific seat selection — use UPDLOCK, ROWLOCK to prevent race conditions
        request.input('rideId', IdTrainRide);
        const placeholders = trsIds.map((_, i) => `@trsId${i}`).join(',');
        trsIds.forEach((id, i) => request.input(`trsId${i}`, id));
        
        const checkResult = await request.query(
          `SELECT trs.id, trs.status, s.SeatClass FROM TrainRideSeat trs WITH (UPDLOCK, ROWLOCK)
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
        // Find available seats — use UPDLOCK, ROWLOCK to prevent race conditions
        request.input('rideId', IdTrainRide);
        request.input('seatClass', SeatClass);
        request.input('qty', qty);
        const availResult = await request.query(
          `SELECT TOP (@qty) trs.id as trsId, trs.idSeat FROM TrainRideSeat trs WITH (UPDLOCK, ROWLOCK)
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

// POST /api/tickets/demo/concurrent-book
// Simulates two users booking the same seat at the same time
router.post('/demo/concurrent-book', async (req, res) => {
  try {
    const { IdTrainRide, trsId, customerA, customerB, delayMs } = req.body;
    if (!IdTrainRide || !trsId || !customerA || !customerB) {
      return res.json({ success: false, message: 'Thiếu thông tin' });
    }
    const delay = parseInt(delayMs, 10) || 0;

    // First, ensure the seat is AVAILABLE for this demo
    await db.executeQuery(
      `UPDATE TrainRideSeat SET status = 'AVAILABLE' WHERE id = @trsId`,
      { trsId }
    );
    // Also clean up any existing demo tickets for this seat
    await db.executeQuery(
      `DELETE FROM Ticket WHERE idTrainRideSeat = @trsId`,
      { trsId }
    );

    const bookOneSeat = async (customerId, label) => {
      const startTime = Date.now();
      try {
        const result = await db.executeTransaction(async (request) => {
          // Check seat with lock
          request.input('rideId', IdTrainRide);
          request.input('trsId', trsId);
          const checkResult = await request.query(
            `SELECT trs.id, trs.status, s.SeatClass, s.SeatNumber
             FROM TrainRideSeat trs WITH (UPDLOCK, ROWLOCK)
             JOIN Seat s ON trs.idSeat = s.id
             WHERE trs.id = @trsId AND trs.idTrainRide = @rideId`
          );

          if (checkResult.recordset.length === 0) {
            const err = new Error('Ghế không tồn tại');
            err.isBusinessError = true;
            throw err;
          }
          if (checkResult.recordset[0].status !== 'AVAILABLE') {
            const err = new Error('Ghế đã được người khác đặt trước!');
            err.isBusinessError = true;
            throw err;
          }

          // Simulate processing delay to make race condition visible
          if (delay > 0) {
            await new Promise(r => setTimeout(r, delay));
          }

          // Book the seat
          await request.query(
            `UPDATE TrainRideSeat SET status = 'BOOKED' WHERE id = @trsId`
          );

          const ticketId = 'TK_DEMO_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
          request.input('ticketId', ticketId);
          request.input('customerId', customerId);
          await request.query(
            `INSERT INTO Ticket (id, idCustomer, status, createdAt, idTrainRideSeat)
             VALUES (@ticketId, @customerId, 'paid', GETDATE(), @trsId)`
          );

          return { ticketId, seatClass: checkResult.recordset[0].SeatClass, seatNumber: checkResult.recordset[0].SeatNumber };
        });

        return {
          label,
          customerId,
          success: true,
          ticketId: result.ticketId,
          seatInfo: `Ghế ${result.seatNumber} (${result.seatClass})`,
          duration: Date.now() - startTime,
          message: 'Đặt vé thành công!'
        };
      } catch (error) {
        return {
          label,
          customerId,
          success: false,
          duration: Date.now() - startTime,
          message: error.isBusinessError ? error.message : 'Lỗi: ' + error.message
        };
      }
    };

    // Launch both bookings at the same time (race condition)
    const [resultA, resultB] = await Promise.all([
      bookOneSeat(customerA, 'User A'),
      bookOneSeat(customerB, 'User B'),
    ]);

    // Clean up: restore the seat to AVAILABLE and remove demo tickets
    await db.executeQuery(
      `UPDATE TrainRideSeat SET status = 'AVAILABLE' WHERE id = @trsId`,
      { trsId }
    );
    await db.executeQuery(
      `DELETE FROM Ticket WHERE idTrainRideSeat = @trsId AND id LIKE 'TK_DEMO_%'`,
      { trsId }
    );

    res.json({
      success: true,
      results: [resultA, resultB],
      explanation: resultA.success && resultB.success
        ? '⚠️ CẢ HAI đều đặt được — Lỗi tương tranh! (không có khóa)'
        : '✅ Chỉ MỘT người đặt được — Xử lý tương tranh thành công (UPDLOCK, ROWLOCK)'
    });
  } catch (error) {
    console.error('❌ Demo concurrency error:', error);
    res.json({ success: false, message: 'Lỗi demo: ' + error.message });
  }
});

// POST /api/tickets/demo/concurrent-book-no-lock
// Same as above but WITHOUT locking — to demonstrate the race condition problem
router.post('/demo/concurrent-book-no-lock', async (req, res) => {
  try {
    const { IdTrainRide, trsId, customerA, customerB, delayMs } = req.body;
    if (!IdTrainRide || !trsId || !customerA || !customerB) {
      return res.json({ success: false, message: 'Thiếu thông tin' });
    }
    const delay = parseInt(delayMs, 10) || 500;

    // Reset the seat to AVAILABLE
    await db.executeQuery(
      `UPDATE TrainRideSeat SET status = 'AVAILABLE' WHERE id = @trsId`,
      { trsId }
    );
    await db.executeQuery(
      `DELETE FROM Ticket WHERE idTrainRideSeat = @trsId AND id LIKE 'TK_DEMO_%'`,
      { trsId }
    );

    const bookNoLock = async (customerId, label) => {
      const startTime = Date.now();
      try {
        // Step 1: Check status WITHOUT any lock (NOLOCK = dirty read)
        const checkResult = await db.executeQuery(
          `SELECT trs.id, trs.status, s.SeatClass, s.SeatNumber
           FROM TrainRideSeat trs WITH (NOLOCK)
           JOIN Seat s ON trs.idSeat = s.id
           WHERE trs.id = @trsId AND trs.idTrainRide = @rideId`,
          { trsId, rideId: IdTrainRide }
        );

        if (checkResult.length === 0 || checkResult[0].status !== 'AVAILABLE') {
          return {
            label, customerId, success: false,
            duration: Date.now() - startTime,
            message: 'Ghế đã được người khác đặt trước!'
          };
        }

        // Simulate processing delay — this is where the race condition happens
        await new Promise(r => setTimeout(r, delay));

        // Step 2: Update (both transactions think the seat is still AVAILABLE)
        await db.executeQuery(
          `UPDATE TrainRideSeat SET status = 'BOOKED' WHERE id = @trsId`,
          { trsId }
        );

        const ticketId = 'TK_DEMO_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        await db.executeQuery(
          `INSERT INTO Ticket (id, idCustomer, status, createdAt, idTrainRideSeat)
           VALUES (@ticketId, @customerId, 'paid', GETDATE(), @trsId)`,
          { ticketId, customerId, trsId }
        );

        return {
          label, customerId, success: true, ticketId,
          seatInfo: `Ghế ${checkResult[0].SeatNumber} (${checkResult[0].SeatClass})`,
          duration: Date.now() - startTime,
          message: 'Đặt vé thành công!'
        };
      } catch (error) {
        return {
          label, customerId, success: false,
          duration: Date.now() - startTime,
          message: 'Lỗi: ' + error.message
        };
      }
    };

    const [resultA, resultB] = await Promise.all([
      bookNoLock(customerA, 'User A'),
      bookNoLock(customerB, 'User B'),
    ]);

    // Clean up
    await db.executeQuery(
      `UPDATE TrainRideSeat SET status = 'AVAILABLE' WHERE id = @trsId`,
      { trsId }
    );
    await db.executeQuery(
      `DELETE FROM Ticket WHERE idTrainRideSeat = @trsId AND id LIKE 'TK_DEMO_%'`,
      { trsId }
    );

    res.json({
      success: true,
      results: [resultA, resultB],
      explanation: resultA.success && resultB.success
        ? '⚠️ CẢ HAI đều đặt được — Lỗi tương tranh! (không có khóa)'
        : '✅ Chỉ MỘT người đặt được — Không xảy ra tương tranh lần này'
    });
  } catch (error) {
    console.error('❌ Demo no-lock error:', error);
    res.json({ success: false, message: 'Lỗi demo: ' + error.message });
  }
});

module.exports = router;
