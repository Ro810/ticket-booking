/**
 * Seed ~50 tickets by calling the booking API.
 * Usage: node scripts/seed-tickets.js
 * Requires the server to be running on PORT (default 3000).
 */

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;

// Customer IDs from the database
const customerIds = [1, 2, 3, 4, 5, 6, 7, 8, 'KH001', 'KH002'];

// TrainRide IDs from the database
const trainRideIds = [
  'SE1060426HNDN',
  'SE2060526HNHCM',
  'SE3060426DNHN',
  'SE4060826DNNT',
  'SE5060726HNHN',
  'SE6060526HCMH',
];

const seatClasses = ['Hạng 1', 'Hạng 2'];

// Generate booking requests: distribute ~50 tickets across customers and rides
function generateBookings(target) {
  const bookings = [];
  let count = 0;

  while (count < target) {
    const customerId = customerIds[Math.floor(Math.random() * customerIds.length)];
    const trainRideId = trainRideIds[Math.floor(Math.random() * trainRideIds.length)];
    const seatClass = seatClasses[Math.floor(Math.random() * seatClasses.length)];
    // Book 1-3 tickets per request
    const quantity = Math.min(Math.floor(Math.random() * 3) + 1, target - count);

    bookings.push({ IdTrainRide: trainRideId, IdCustomer: customerId, SeatClass: seatClass, quantity });
    count += quantity;
  }

  return bookings;
}

async function seedTickets() {
  const bookings = generateBookings(50);
  let totalBooked = 0;
  let successCount = 0;
  let failCount = 0;

  console.log(`🎫 Seeding tickets via API: ${bookings.length} booking requests targeting ~50 tickets`);
  console.log(`   Base URL: ${BASE_URL}`);
  console.log('---');

  for (let i = 0; i < bookings.length; i++) {
    const booking = bookings[i];
    try {
      const response = await fetch(`${BASE_URL}/api/tickets/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(booking),
      });
      const data = await response.json();

      if (data.success) {
        totalBooked += booking.quantity;
        successCount++;
        console.log(
          `  ✓ [${i + 1}/${bookings.length}] Customer ${booking.IdCustomer} → Ride ${booking.IdTrainRide} | ${booking.SeatClass} x${booking.quantity} | Total: ${data.totalPrice?.toLocaleString()}đ`
        );

        // Randomly pay for some tickets (~60%)
        if (data.ticketIds && Math.random() < 0.6) {
          for (const ticketId of data.ticketIds) {
            try {
              await fetch(`${BASE_URL}/api/tickets/pay/${ticketId}`, { method: 'POST' });
            } catch (_) {}
          }
          console.log(`     💰 Paid ${data.ticketIds.length} ticket(s)`);
        }
      } else {
        failCount++;
        console.log(
          `  ✗ [${i + 1}/${bookings.length}] Customer ${booking.IdCustomer} → Ride ${booking.IdTrainRide} | ${data.message}`
        );
      }
    } catch (err) {
      failCount++;
      console.error(`  ✗ [${i + 1}/${bookings.length}] Network error: ${err.message}`);
    }

    // Small delay to avoid ticket ID collision (Date.now() based)
    await new Promise((r) => setTimeout(r, 50));
  }

  console.log('---');
  console.log(`✅ Done! Booked: ${totalBooked} tickets | Success: ${successCount} | Failed: ${failCount}`);
}

seedTickets().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
