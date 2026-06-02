const express = require('express');
const router = express.Router();
const db = require('../../config/database');

// GET /api/stats/branch/:branchId - Revenue stats for a branch
router.get('/branch/:branchId', async (req, res) => {
  try {
    const branchId = req.params.branchId;
    const { from, to, departureStation, destination, seatClass } = req.query;

    // Build filter conditions
    // Ticket -> TrainRideSeat -> Seat -> Train -> idBranch
    let dateFilter = '';
    let routeFilter = '';
    let seatFilter = '';
    const params = { branchId };

    if (from) {
      dateFilter += ' AND tr.DepartureTime >= @fromDate';
      params.fromDate = from;
    }
    if (to) {
      dateFilter += ' AND tr.DepartureTime <= @toDate';
      params.toDate = to + ' 23:59:59';
    }
    if (departureStation) {
      routeFilter += ' AND tr.DepartureStation = @depStation';
      params.depStation = departureStation;
    }
    if (destination) {
      routeFilter += ' AND tr.Destination = @dest';
      params.dest = destination;
    }
    if (seatClass) {
      seatFilter += ' AND s.SeatClass = @seatClass';
      params.seatClass = seatClass;
    }

    const baseJoin = `
      FROM Ticket tk
      JOIN TrainRideSeat trs ON tk.idTrainRideSeat = trs.id
      JOIN Seat s ON trs.idSeat = s.id
      JOIN Train t ON s.idTrain = t.id
      JOIN TrainRide tr ON trs.idTrainRide = tr.id
      WHERE t.idBranch = @branchId AND tk.status != 'cancelled'
      ${dateFilter} ${routeFilter} ${seatFilter}
    `;

    // Total revenue and ticket count
    const totals = await db.executeQuery(
      `SELECT COUNT(*) as totalTickets, ISNULL(SUM(tr.price), 0) as totalRevenue ${baseJoin}`,
      params
    );

    // By month
    const byMonth = await db.executeQuery(
      `SELECT FORMAT(tr.DepartureTime, 'yyyy-MM') as month, COUNT(*) as cnt, ISNULL(SUM(tr.price), 0) as revenue
       ${baseJoin}
       GROUP BY FORMAT(tr.DepartureTime, 'yyyy-MM') ORDER BY month`,
      params
    );

    // By seat class
    const bySeat = await db.executeQuery(
      `SELECT s.SeatClass, COUNT(*) as cnt, ISNULL(SUM(tr.price), 0) as revenue
       ${baseJoin}
       GROUP BY s.SeatClass`,
      params
    );

    // By route
    const byRoute = await db.executeQuery(
      `SELECT tr.DepartureStation + N' → ' + tr.Destination as route, COUNT(*) as cnt, ISNULL(SUM(tr.price), 0) as revenue
       ${baseJoin}
       GROUP BY tr.DepartureStation, tr.Destination ORDER BY cnt DESC`,
      params
    );

    // Ticket list (recent 100)
    const ticketList = await db.executeQuery(
      `SELECT TOP 100 tk.id, tk.status, tk.createdAt, 
              tr.DepartureStation, tr.Destination, tr.DepartureTime, tr.price,
              s.SeatNumber, s.SeatClass,
              c.Name as customerName, c.phoneNumber as customerPhone
       ${baseJoin.replace('WHERE', 'LEFT JOIN Customer c ON tk.idCustomer = c.id WHERE')}
       ORDER BY tr.DepartureTime DESC`,
      params
    );

    res.json({
      status: 'success',
      stats: {
        totalTickets: totals[0]?.totalTickets || 0,
        totalRevenue: totals[0]?.totalRevenue || 0
      },
      byMonth: byMonth || [],
      bySeat: bySeat || [],
      byRoute: byRoute || [],
      ticketList: ticketList || []
    });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

module.exports = router;
