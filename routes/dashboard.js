const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/dashboard', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }
  try {
    const role = req.session.user.role;

    // ===== PASSENGER =====
    if (role === 'passenger') {
      const customerId = req.session.user.id;
      const tickets = await db.executeQuery(
        `SELECT tk.id, tk.status, tk.createdAt,
                DATEDIFF(SECOND, tk.createdAt, GETDATE()) as ageInSeconds,
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
      const stations = await db.executeQuery(`SELECT Name FROM Station ORDER BY Name`);
      const trains = await db.executeQuery(
        `SELECT tr.*, t.ManufacturingBrand,
          (SELECT COUNT(*) FROM TrainRideSeat trs JOIN Seat s ON trs.idSeat=s.id WHERE trs.idTrainRide=tr.id AND s.SeatClass=N'Hạng 1' AND trs.status='AVAILABLE') as availableClass1,
          (SELECT COUNT(*) FROM TrainRideSeat trs JOIN Seat s ON trs.idSeat=s.id WHERE trs.idTrainRide=tr.id AND s.SeatClass=N'Hạng 2' AND trs.status='AVAILABLE') as availableClass2
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

    // ===== STAFF_HQ (Quản lý trụ sở) =====
    if (role === 'staff_hq') {
      const branchFilter = req.query.branch || 'all';
      const customers = await db.executeQuery('SELECT id, Name, phoneNumber, Address FROM Customer');
      const stations = await db.executeQuery('SELECT Name, Address FROM Station ORDER BY Name');
      const trainRides = await db.executeQuery(
        `SELECT tr.*, t.ManufacturingBrand FROM TrainRide tr LEFT JOIN Train t ON tr.idTrain = t.id ORDER BY tr.DepartureTime DESC`
      );
      const branches = await db.executeQuery(`SELECT id, address as name, phoneNumber FROM Branch ORDER BY id`);
      const trainEntities = await db.executeQuery(
        `SELECT t.id, t.ManufacturingBrand, t.class1Seats, t.class2Seats, t.idBranch, b.address as branchName
         FROM Train t LEFT JOIN Branch b ON t.idBranch = b.id ORDER BY t.id`
      );
      const employees = await db.executeQuery(
        `SELECT e.id, e.fullname, e.salary, e.role, e.phoneNumber, e.idBranch, b.address as branchName
         FROM Employee e LEFT JOIN Branch b ON e.idBranch = b.id ORDER BY e.id`
      );

      // Stats with branch filter
      let statsFilter = '';
      let statsParams = {};
      if (branchFilter !== 'all') {
        statsFilter = ' AND t.idBranch = @branchId';
        statsParams.branchId = branchFilter;
      }

      const baseJoin = `
        FROM Ticket tk
        JOIN TrainRideSeat trs ON tk.idTrainRideSeat = trs.id
        JOIN Seat s ON trs.idSeat = s.id
        JOIN Train t ON s.idTrain = t.id
        JOIN TrainRide tr ON trs.idTrainRide = tr.id
        WHERE tk.status != 'cancelled' ${statsFilter}
      `;

      const totalTickets = await db.executeQuery(`SELECT COUNT(*) as cnt ${baseJoin}`, statsParams);
      const totalCustomers = await db.executeQuery(`SELECT COUNT(*) as cnt FROM Customer`);
      const totalRevenue = await db.executeQuery(`SELECT ISNULL(SUM(tr.price), 0) as revenue ${baseJoin}`, statsParams);
      const branchStats = await db.executeQuery(
        `SELECT b.address as branchName, COUNT(tk.id) as ticketCount, ISNULL(SUM(tr.price), 0) as revenue
         ${baseJoin.replace('WHERE', 'LEFT JOIN Branch b ON t.idBranch = b.id WHERE')}
         GROUP BY b.address`,
        statsParams
      );
      const chartBySeat = await db.executeQuery(`SELECT s.SeatClass as SeatType, COUNT(*) as cnt ${baseJoin} GROUP BY s.SeatClass`, statsParams);
      const chartByMonth = await db.executeQuery(
        `SELECT FORMAT(tr.DepartureTime, 'yyyy-MM') as month, COUNT(*) as cnt ${baseJoin}
         GROUP BY FORMAT(tr.DepartureTime, 'yyyy-MM') ORDER BY month`,
        statsParams
      );

      // Tickets list
      let ticketFilter = '';
      let ticketParams = {};
      if (branchFilter !== 'all') {
        ticketFilter = ' AND t2.idBranch = @branchId';
        ticketParams.branchId = branchFilter;
      }
      const tickets = await db.executeQuery(
        `SELECT tk.id, tk.status, tk.createdAt, tk.idCustomer,
                tr.DepartureTime, tr.DepartureStation, tr.Destination, tr.price,
                c.Name as customerName, s.SeatNumber, s.SeatClass, b.address as branchName
         FROM Ticket tk
         JOIN TrainRideSeat trs ON tk.idTrainRideSeat = trs.id
         JOIN Seat s ON trs.idSeat = s.id
         JOIN Train t2 ON s.idTrain = t2.id
         JOIN TrainRide tr ON trs.idTrainRide = tr.id
         LEFT JOIN Customer c ON tk.idCustomer = c.id
         LEFT JOIN Branch b ON t2.idBranch = b.id
         WHERE 1=1 ${ticketFilter}
         ORDER BY tr.DepartureTime DESC`,
        ticketParams
      );

      return res.render('dashboard-staff-hq', {
        user: req.session.user,
        customers: customers || [],
        stations: stations || [],
        trainRides: trainRides || [],
        trainEntities: trainEntities || [],
        branches: branches || [],
        employees: employees || [],
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

    // ===== STAFF_BASE (Quản lý cơ sở) =====
    if (role === 'staff_base') {
      const branchId = req.session.user.idBranch;
      const stations = await db.executeQuery('SELECT Name FROM Station ORDER BY Name');
      return res.render('dashboard-staff-base', {
        user: req.session.user,
        branchId: branchId,
        stations: stations || []
      });
    }

  } catch (error) {
    console.error('Lỗi dashboard:', error.message);
    const role = req.session.user?.role;
    if (role === 'staff_hq') {
      return res.render('dashboard-staff-hq', {
        user: req.session.user,
        trains: [], trainRides: [], trainEntities: [], customers: [], tickets: [],
        employees: [], branches: [], stations: [],
        stats: { totalTickets: 0, totalCustomers: 0, totalRevenue: 0 },
        chartData: { bySeat: [], byMonth: [] },
        branchStats: [], branchFilter: 'all'
      });
    }
    if (role === 'staff_base') {
      return res.render('dashboard-staff-base', {
        user: req.session.user, branchId: req.session.user.idBranch, stations: []
      });
    }
    res.render('dashboard-passenger', {
      user: req.session.user,
      trains: [], tickets: [], stations: []
    });
  }
});

module.exports = router;
