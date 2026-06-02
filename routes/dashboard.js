const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/dashboard', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }
  try {
    const role = req.session.user.role;
    if (role === 'passenger') {
      const customerId = req.session.user.id;
      const tickets = await db.executeQuery(
        `SELECT t.id, t.idTrainRide, t.idSeat, t.status, t.idBranch, t.createdAt,
                tr.DepartureTime, tr.DepartureStation, tr.Destination, s.SeatNumber, s.SeatClass, sp.price as ticketPrice, b.address as branchName
         FROM Ticket t
         JOIN TrainRide tr ON t.idTrainRide = tr.id
         LEFT JOIN Seat s ON t.idSeat = s.id
         LEFT JOIN SeatPrice sp ON s.SeatClass = sp.SeatClass
         LEFT JOIN Branch b ON t.idBranch = b.id
         WHERE t.idCustomer = @customerId`,
        { customerId }
      );
      const stations = await db.executeQuery(`SELECT Name FROM Station ORDER BY Name`);
      const trains = await db.executeQuery(
        `SELECT tr.*, t.ManufacturingBrand,
          (SELECT COUNT(*) FROM TrainRideSeat trs JOIN Seat s ON trs.idSeat=s.id WHERE trs.idTrainRide=tr.id AND s.SeatClass='Hạng 1' AND trs.status='AVAILABLE') as availableClass1,
          (SELECT COUNT(*) FROM TrainRideSeat trs JOIN Seat s ON trs.idSeat=s.id WHERE trs.idTrainRide=tr.id AND s.SeatClass='Hạng 2' AND trs.status='AVAILABLE') as availableClass2
         FROM TrainRide tr
         LEFT JOIN Train t ON tr.idTrain = t.id
         ORDER BY tr.DepartureTime DESC`
      );
      return res.render('dashboard-passenger', {
        user: req.session.user,
        tickets: tickets || [],
        trains: trains || [],
        stations: stations || []
      });
    }
    if (role === 'staff_hq') {
      const branchFilter = req.query.branch || 'all';
      const customers = await db.executeQuery('SELECT id, Name, phoneNumber, Address FROM Customer');
      const stations = await db.executeQuery('SELECT Name, Address FROM Station ORDER BY Name');
      const trains = await db.executeQuery(`SELECT tr.*, t.ManufacturingBrand FROM TrainRide tr LEFT JOIN Train t ON tr.idTrain = t.id ORDER BY tr.DepartureTime DESC`);
      const branches = await db.executeQuery(`SELECT id, address as name FROM Branch ORDER BY address`);

      let ticketWhere = '';
      let ticketParams = {};
      let statsWhere = '';
      let statsParams = {};
      if (branchFilter !== 'all') {
        ticketWhere = ' AND t.idBranch = @branchId';
        ticketParams.branchId = branchFilter;
        statsWhere = " AND t.idBranch = @branchId";
        statsParams.branchId = branchFilter;
      }

      const tickets = await db.executeQuery(
        `SELECT t.id, t.idSeat, t.status, t.idTrainRide, t.idCustomer, t.idBranch, t.createdAt,
                tr.DepartureTime, tr.DepartureStation, tr.Destination,
                c.Name as customerName, b.address as branchName, s.SeatNumber, s.SeatClass, sp.price as ticketPrice
         FROM Ticket t
         JOIN TrainRide tr ON t.idTrainRide = tr.id
         LEFT JOIN Customer c ON t.idCustomer = c.id
         LEFT JOIN Branch b ON t.idBranch = b.id
         LEFT JOIN Seat s ON t.idSeat = s.id
         LEFT JOIN SeatPrice sp ON s.SeatClass = sp.SeatClass
         WHERE 1=1 ${ticketWhere}
         ORDER BY tr.DepartureTime DESC`,
        ticketParams
      );
      const totalTickets = await db.executeQuery(`SELECT COUNT(*) as cnt FROM Ticket t WHERE t.status != 'cancelled' ${statsWhere}`, statsParams);
      const totalCustomers = await db.executeQuery(`SELECT COUNT(*) as cnt FROM Customer`);
      const totalRevenue = await db.executeQuery(
        `SELECT SUM(sp.price) as revenue FROM Ticket t JOIN Seat s ON t.idSeat = s.id JOIN SeatPrice sp ON s.SeatClass = sp.SeatClass WHERE t.status != 'cancelled' ${statsWhere}`, statsParams
      );
      const branchStats = await db.executeQuery(
        `SELECT b.address as branchName, COUNT(t.id) as ticketCount
         FROM Ticket t
         LEFT JOIN Branch b ON t.idBranch = b.id
         WHERE t.status != 'cancelled' ${statsWhere}
         GROUP BY b.address`,
        statsParams
      );
      const chartBySeat = await db.executeQuery(`SELECT s.SeatClass as SeatType, COUNT(*) as cnt FROM Ticket t JOIN Seat s ON t.idSeat = s.id WHERE t.status != 'cancelled' ${statsWhere} GROUP BY s.SeatClass`, statsParams);
      const chartByMonth = await db.executeQuery(
        `SELECT FORMAT(tr.DepartureTime, 'yyyy-MM') as month, COUNT(*) as cnt
         FROM Ticket t JOIN TrainRide tr ON t.idTrainRide = tr.id WHERE t.status != 'cancelled' ${statsWhere}
         GROUP BY FORMAT(tr.DepartureTime, 'yyyy-MM') ORDER BY month`,
        statsParams
      );
      return res.render('dashboard-staff-hq', {
        user: req.session.user,
        customers: customers || [],
        stations: stations || [],
        trains: trains || [],
        branches: branches || [],
        branchFilter,
        tickets: tickets || [],
        stats: {
          totalTickets: totalTickets[0]?.cnt || 0,
          totalCustomers: totalCustomers[0]?.cnt || 0,
          totalRevenue: totalRevenue[0]?.revenue || 0
        },
        branchStats: branchStats || [],
        chartData: {
          bySeat: chartBySeat || [],
          byMonth: chartByMonth || []
        }
      });
    }
  } catch (error) {
    console.error('Lỗi dashboard:', error.message);
    const role = req.session.user?.role;
    const fallbackStats = { totalTickets: 0, totalCustomers: 0, totalRevenue: 0 };
    const fallbackData = {
      user: req.session.user,
      trains: [], customers: [], tickets: [],
      stats: fallbackStats,
      chartData: { byRoute: [], bySeat: [], byMonth: [] },
      branchStats: [],
      branches: [],
      branchFilter: 'all'
    };
    if (role === 'staff_hq') {
      return res.render('dashboard-staff-hq', fallbackData);
    }
    res.render('dashboard-passenger', {
      user: req.session.user,
      trains: [], tickets: [], stations: []
    });
  }
});

module.exports = router;
