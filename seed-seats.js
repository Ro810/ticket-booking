// Seed Seat data for existing trains SE1-SE6
// Each train: 30 Hạng 1 seats + 120 Hạng 2 seats = 150 seats per train
require('dotenv').config();
const db = require('./config/database');

async function seedSeats() {
  try {
    const trains = await db.executeQuery('SELECT id, class1Seats, class2Seats FROM Train');
    console.log(`Found ${trains.length} trains`);

    for (const train of trains) {
      // Check if seats already exist for this train
      const existing = await db.executeQuery(
        'SELECT COUNT(*) as cnt FROM Seat WHERE idTrain = @trainId',
        { trainId: train.id }
      );
      if (existing[0].cnt > 0) {
        console.log(`  Train ${train.id}: ${existing[0].cnt} seats already exist, skipping`);
        continue;
      }

      const class1Count = train.class1Seats || 30;
      const class2Count = train.class2Seats || 120;
      let seatNum = 1;

      // Insert Hạng 1 seats
      for (let i = 0; i < class1Count; i++) {
        const seatId = `${train.id}_S${String(seatNum).padStart(3, '0')}`;
        await db.executeQuery(
          `INSERT INTO Seat (id, idTrain, SeatNumber, SeatClass) VALUES (@id, @idTrain, @seatNumber, N'Hạng 1')`,
          { id: seatId, idTrain: train.id, seatNumber: String(seatNum) }
        );
        seatNum++;
      }
      console.log(`  Train ${train.id}: Inserted ${class1Count} Hạng 1 seats`);

      // Insert Hạng 2 seats
      for (let i = 0; i < class2Count; i++) {
        const seatId = `${train.id}_S${String(seatNum).padStart(3, '0')}`;
        await db.executeQuery(
          `INSERT INTO Seat (id, idTrain, SeatNumber, SeatClass) VALUES (@id, @idTrain, @seatNumber, N'Hạng 2')`,
          { id: seatId, idTrain: train.id, seatNumber: String(seatNum) }
        );
        seatNum++;
      }
      console.log(`  Train ${train.id}: Inserted ${class2Count} Hạng 2 seats`);
      console.log(`  Train ${train.id}: Total ${seatNum - 1} seats created`);
    }

    console.log('\n✓ Seed hoàn tất!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Lỗi seed:', error.message);
    process.exit(1);
  }
}

seedSeats();
