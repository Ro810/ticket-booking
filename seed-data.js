const db = require('./config/database');

async function seed() {
  try {
    // Check existing TrainRide count
    const existingRides = await db.executeQuery('SELECT COUNT(*) as cnt FROM TrainRide');
    if (existingRides[0].cnt > 0) {
      console.log('TrainRide already has data, skipping seed.');
      return;
    }

    // Insert sample TrainRides
    const rides = [
      { id: 'TR001', idTrain: 'SE1', DepartureTime: new Date('2026-06-03T08:00:00'), DepartureStation: 'Hà Nội', Destination: 'Đà Nẵng' },
      { id: 'TR002', idTrain: 'SE2', DepartureTime: new Date('2026-06-03T13:00:00'), DepartureStation: 'Đà Nẵng', Destination: 'TP Hồ Chí Minh' },
      { id: 'TR003', idTrain: 'SE3', DepartureTime: new Date('2026-06-04T20:00:00'), DepartureStation: 'Hà Nội', Destination: 'TP Hồ Chí Minh' },
      { id: 'TR004', idTrain: 'SE4', DepartureTime: new Date('2026-06-03T06:00:00'), DepartureStation: 'Hà Nội', Destination: 'Vinh' },
      { id: 'TR005', idTrain: 'SE5', DepartureTime: new Date('2026-06-03T14:00:00'), DepartureStation: 'Vinh', Destination: 'Đà Nẵng' },
      { id: 'TR006', idTrain: 'SE1', DepartureTime: new Date('2026-06-05T08:00:00'), DepartureStation: 'Hà Nội', Destination: 'Đà Nẵng' },
      { id: 'TR007', idTrain: 'SE2', DepartureTime: new Date('2026-06-05T13:00:00'), DepartureStation: 'Đà Nẵng', Destination: 'TP Hồ Chí Minh' },
    ];

    for (const r of rides) {
      await db.executeQuery(
        `INSERT INTO TrainRide (id, idTrain, DepartureTime, DepartureStation, Destination)
         VALUES (@id, @idTrain, @DepartureTime, @DepartureStation, @Destination)`,
        r
      );
    }
    console.log(`Inserted ${rides.length} TrainRides.`);

    // Seed TrainRideSeat for each ride using Seats belonging to the train
    for (const r of rides) {
      const seats = await db.executeQuery(
        'SELECT id FROM Seat WHERE idTrain = @trainId',
        { trainId: r.idTrain }
      );
      if (seats.length === 0) {
        console.warn(`No seats found for train ${r.idTrain}`);
        continue;
      }
      // Insert all seats as AVAILABLE for this ride
      const values = seats.map(s => `('${r.id}', '${s.id}', 'AVAILABLE')`).join(',');
      await db.executeQuery(
        `INSERT INTO TrainRideSeat (idTrainRide, idSeat, status) VALUES ${values}`
      );
      console.log(`Seeded ${seats.length} TrainRideSeat rows for ${r.id}`);
    }

    console.log('Seed complete.');
  } catch (err) {
    console.error('Seed error:', err.message);
    process.exit(1);
  }
}

seed().then(() => process.exit(0));
