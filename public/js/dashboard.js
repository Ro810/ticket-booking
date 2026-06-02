// Passenger Dashboard JS
const currentCustomerId = document.body.getAttribute('data-customer-id');
let originalCustomerData = {};
let allTickets = [];
let seatPrices = {};

// ===== Profile Edit =====
function enableEditMode() {
  originalCustomerData = {
    name: document.getElementById('customerName').value,
    phone: document.getElementById('customerPhone').value,
    address: document.getElementById('customerAddress').value
  };
  document.getElementById('customerName').removeAttribute('readonly');
  document.getElementById('customerPhone').removeAttribute('readonly');
  document.getElementById('customerAddress').removeAttribute('readonly');
  document.getElementById('editBtn').style.display = 'none';
  document.getElementById('saveBtn').style.display = 'inline-block';
  document.getElementById('cancelBtn').style.display = 'inline-block';
}

function disableEditMode() {
  document.getElementById('customerName').value = originalCustomerData.name;
  document.getElementById('customerPhone').value = originalCustomerData.phone;
  document.getElementById('customerAddress').value = originalCustomerData.address;
  document.getElementById('customerName').setAttribute('readonly', 'readonly');
  document.getElementById('customerPhone').setAttribute('readonly', 'readonly');
  document.getElementById('customerAddress').setAttribute('readonly', 'readonly');
  document.getElementById('editBtn').style.display = 'inline-block';
  document.getElementById('saveBtn').style.display = 'none';
  document.getElementById('cancelBtn').style.display = 'none';
}

function saveCustomerInfo() {
  const name = document.getElementById('customerName').value;
  const phone = document.getElementById('customerPhone').value;
  const address = document.getElementById('customerAddress').value;
  if (!name || !phone) {
    toast('Vui lòng điền đầy đủ thông tin', 'error');
    return;
  }
  fetch(`/api/customer/${currentCustomerId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phoneNumber: phone, address })
  })
  .then(r => r.json())
  .then(data => {
    if (data.status === 'success') {
      toast('Lưu thông tin thành công!');
      document.getElementById('customerName').setAttribute('readonly', 'readonly');
      document.getElementById('customerPhone').setAttribute('readonly', 'readonly');
      document.getElementById('customerAddress').setAttribute('readonly', 'readonly');
      document.getElementById('editBtn').style.display = 'inline-block';
      document.getElementById('saveBtn').style.display = 'none';
      document.getElementById('cancelBtn').style.display = 'none';
    } else {
      toast('Lỗi: ' + data.message, 'error');
    }
  })
  .catch(err => toast('Lỗi kết nối', 'error'));
}

// ===== Ticket Filters =====
function filterMyTickets(status) {
  document.querySelectorAll('.filter-chips .chip').forEach(c => c.classList.remove('active'));
  event.target.classList.add('active');
  document.querySelectorAll('#ticketsList tr').forEach(row => {
    const s = row.getAttribute('data-status') || '';
    row.style.display = (status === 'all' || s === status) ? '' : 'none';
  });
}

function searchTickets() {
  const date = document.getElementById('searchDate').value;
  const location = document.getElementById('searchLocation').value.trim().toLowerCase();
  document.querySelectorAll('#ticketsList tr').forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 3) return;
    let show = true;
    if (date) {
      const d = row.getAttribute('data-date-iso');
      show = show && d === date;
    }
    if (location && show) {
      const route = (row.getAttribute('data-route') || '').toLowerCase();
      show = show && route.includes(location);
    }
    row.style.display = show ? '' : 'none';
  });
}

function resetSearch() {
  document.getElementById('searchDate').value = '';
  document.getElementById('searchLocation').value = '';
  document.querySelectorAll('#ticketsList tr').forEach(row => {
    if (row.querySelectorAll('td').length >= 3) row.style.display = '';
  });
}

// ===== Train Search =====
function searchTrains() {
  const from = document.getElementById('trainFrom').value;
  const to = document.getElementById('trainTo').value;
  const date = document.getElementById('trainDate').value;

  // If date is selected, we fetch from API to get accurate filter
  if (date || from || to) {
    let url = `/api/trains/search/${encodeURIComponent(from || '-')}/${encodeURIComponent(to || '-')}`;
    const params = [];
    if (date) params.push(`date=${date}`);
    if (params.length) url += '?' + params.join('&');
    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (data.status === 'success') renderTrainsList(data.trains || []);
      })
      .catch(() => toast('Lỗi tìm kiếm chuyến tàu', 'error'));
  } else {
    // Show all
    document.querySelectorAll('#trainsList tr').forEach(row => {
      if (row.querySelectorAll('td').length >= 3) row.style.display = '';
    });
  }
}

function renderTrainsList(trains) {
  const tbody = document.getElementById('trainsList');
  if (!trains.length) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">🚂</div><h4>Không có chuyến tàu nào</h4></div></td></tr>';
    return;
  }
  tbody.innerHTML = trains.map(t => {
    const total = (t.availableClass1 || 0) + (t.availableClass2 || 0);
    return `<tr data-from="${t.DepartureStation}" data-to="${t.Destination}">
      <td>${t.id}</td>
      <td>${t.DepartureStation} → ${t.Destination}</td>
      <td>${new Date(t.DepartureTime).toLocaleString('vi-VN')}</td>
      <td>${t.availableClass1 || 0}</td>
      <td>${t.availableClass2 || 0}</td>
      <td><button class="btn btn-sm btn-success" onclick="bookTicket('${t.id}', '${t.DepartureStation} → ${t.Destination}', '${new Date(t.DepartureTime).toLocaleString('vi-VN')}', ${t.availableClass1 || 0}, ${t.availableClass2 || 0})" ${total === 0 ? 'disabled' : ''}>Đặt vé</button></td>
    </tr>`;
  }).join('');
}

function resetTrainSearch() {
  document.getElementById('trainFrom').value = '';
  document.getElementById('trainTo').value = '';
  document.getElementById('trainDate').value = '';
  location.reload();
}

// ===== Booking =====
let currentTrainRideId = null;
let currentTrainRidePrice = 0;
let currentSelectedSeats = [];
let allSeatsForRide = [];

function bookTicket(trainId, route, departureTime, availH1, availH2, price) {
  currentTrainRideId = trainId;
  currentTrainRidePrice = parseFloat(price) || 0;
  currentSelectedSeats = [];
  allSeatsForRide = [];

  document.getElementById('bookTrainId').value = trainId;
  document.getElementById('bookRoute').value = route;
  document.getElementById('bookDepartureTime').value = departureTime;
  document.getElementById('bookPrice').value = '0 VNĐ';
  document.getElementById('bookSeatType').value = '';
  document.getElementById('bookQuantity').value = 0;

  document.getElementById('seatSelectionArea').style.display = 'none';
  document.getElementById('seatGridContainer').innerHTML = '';
  document.getElementById('selectedSeatsLabel').textContent = 'Chưa chọn';
  document.getElementById('bookingModal').style.display = 'flex';

  fetch(`/api/trains/${trainId}/seats`)
    .then(r => r.json())
    .then(data => {
      if (data.status === 'success') {
        allSeatsForRide = data.seats || [];
      } else {
        toast('Không thể tải sơ đồ ghế ngồi: ' + data.message, 'error');
      }
    })
    .catch(err => toast('Lỗi tải sơ đồ ghế', 'error'));
}

function onSeatTypeChange() {
  const seatClass = document.getElementById('bookSeatType').value;
  const container = document.getElementById('seatGridContainer');
  const tabsContainer = document.getElementById('coachTabsContainer');
  const area = document.getElementById('seatSelectionArea');

  currentSelectedSeats = [];
  updateSelectedSeatsUI();

  if (!seatClass) {
    area.style.display = 'none';
    tabsContainer.innerHTML = '';
    container.innerHTML = '';
    return;
  }

  area.style.display = 'block';
  tabsContainer.innerHTML = '';
  container.innerHTML = '';

  const filtered = allSeatsForRide.filter(s => s.SeatClass === seatClass);

  if (filtered.length === 0) {
    container.innerHTML = '<div style="grid-column: span 5; text-align:center; padding: 20px; color: #999;">Không có ghế nào trống.</div>';
    return;
  }

  // Partition seats into coaches (chunks of 40 seats)
  const coaches = [];
  const chunkSize = 40;
  
  if (seatClass === 'Hạng 1') {
    coaches.push({
      name: 'Toa 1 (Hạng 1)',
      seats: filtered
    });
  } else {
    for (let i = 0; i < filtered.length; i += chunkSize) {
      const coachIndex = Math.floor(i / chunkSize) + 2; // Class 2 starts from Toa 2
      coaches.push({
        name: `Toa ${coachIndex}`,
        seats: filtered.slice(i, i + chunkSize)
      });
    }
  }

  coaches.forEach((coach, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'coach-tab';
    if (index === 0) btn.classList.add('active');
    btn.textContent = coach.name;
    
    btn.addEventListener('click', () => {
      tabsContainer.querySelectorAll('.coach-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderCoachSeats(coach.seats);
    });
    
    tabsContainer.appendChild(btn);
  });

  if (coaches.length > 0) {
    renderCoachSeats(coaches[0].seats);
  }
}

function renderCoachSeats(seats) {
  const container = document.getElementById('seatGridContainer');
  container.innerHTML = '';

  for (let i = 0; i < seats.length; i += 4) {
    const rowSeats = seats.slice(i, i + 4);
    
    // Seat 1
    if (rowSeats[0]) renderSeatItem(rowSeats[0], container);
    else container.appendChild(document.createElement('div'));

    // Seat 2
    if (rowSeats[1]) renderSeatItem(rowSeats[1], container);
    else container.appendChild(document.createElement('div'));

    // Aisle spacer
    const aisleEl = document.createElement('div');
    aisleEl.className = 'seat-aisle';
    aisleEl.textContent = 'Lối đi';
    container.appendChild(aisleEl);

    // Seat 3
    if (rowSeats[2]) renderSeatItem(rowSeats[2], container);
    else container.appendChild(document.createElement('div'));

    // Seat 4
    if (rowSeats[3]) renderSeatItem(rowSeats[3], container);
    else container.appendChild(document.createElement('div'));
  }
}

function renderSeatItem(seat, container) {
  const seatEl = document.createElement('div');
  seatEl.className = 'seat-item';
  if (seat.status !== 'AVAILABLE') {
    seatEl.classList.add('booked');
  }
  
  const isSelected = currentSelectedSeats.some(s => s.trsId === parseInt(seat.trsId, 10));
  if (isSelected) {
    seatEl.classList.add('selected');
  }
  
  seatEl.textContent = seat.SeatNumber;
  seatEl.setAttribute('data-trs-id', seat.trsId);

  seatEl.addEventListener('click', () => {
    if (seat.status !== 'AVAILABLE') return;

    const trsId = parseInt(seat.trsId, 10);
    const index = currentSelectedSeats.findIndex(item => item.trsId === trsId);

    if (index > -1) {
      currentSelectedSeats.splice(index, 1);
      seatEl.classList.remove('selected');
    } else {
      if (currentSelectedSeats.length >= 10) {
        toast('Bạn chỉ được chọn tối đa 10 ghế!', 'warning');
        return;
      }
      currentSelectedSeats.push({
        trsId: trsId,
        seatNumber: seat.SeatNumber,
        seatClass: seat.SeatClass
      });
      seatEl.classList.add('selected');
    }

    updateSelectedSeatsUI();
  });

  container.appendChild(seatEl);
}

function updateSelectedSeatsUI() {
  const qtyInput = document.getElementById('bookQuantity');
  const priceInput = document.getElementById('bookPrice');
  const label = document.getElementById('selectedSeatsLabel');

  const count = currentSelectedSeats.length;
  qtyInput.value = count;

  if (count === 0) {
    label.textContent = 'Chưa chọn';
    priceInput.value = '0 VNĐ';
    return;
  }

  const numbers = currentSelectedSeats.map(s => s.seatNumber).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  label.textContent = 'Ghế ' + numbers.join(', ');

  let total = 0;
  currentSelectedSeats.forEach(s => {
    const mult = s.seatClass === 'Hạng 1' ? 1.4 : 1.0;
    total += currentTrainRidePrice * mult;
  });

  priceInput.value = Number(total).toLocaleString('vi-VN') + ' VNĐ';
}

function closeBookingModal() {
  document.getElementById('bookingModal').style.display = 'none';
}

function submitBooking(event) {
  event.preventDefault();
  const seatClass = document.getElementById('bookSeatType').value;
  if (!seatClass) { toast('Vui lòng chọn loại ghế', 'error'); return; }
  if (currentSelectedSeats.length === 0) { toast('Vui lòng chọn ít nhất 1 ghế ngồi', 'error'); return; }

  const trsIds = currentSelectedSeats.map(s => s.trsId);
  const qty = trsIds.length;

  fetch('/api/tickets/book', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      IdTrainRide: currentTrainRideId,
      IdCustomer: currentCustomerId,
      trsIds: trsIds
    })
  })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      toast(`Đặt ${qty} vé thành công! Tổng tiền: ${Number(data.totalPrice).toLocaleString('vi-VN')}đ`);
      closeBookingModal();
      setTimeout(() => location.reload(), 800);
    } else {
      toast('Lỗi: ' + data.message, 'error');
    }
  })
  .catch(err => toast('Lỗi kết nối', 'error'));
}

// ===== Ticket Detail =====
function viewTicketDetail(ticketId) {
  const row = document.querySelector(`#ticketsList tr[data-ticket-id="${ticketId}"]`);
  if (!row) { toast('Không tìm thấy vé', 'error'); return; }
  const route = row.getAttribute('data-route');
  const dep = row.getAttribute('data-departure-time');
  const seat = row.getAttribute('data-seat-type');
  const price = row.getAttribute('data-price');
  const status = row.getAttribute('data-status');
  const isFuture = status === 'upcoming';
  const isCancelled = status === 'cancelled';
  let statusBadge = '<span class="badge badge-success">Đã hoàn thành</span>';
  if (isCancelled) statusBadge = '<span class="badge badge-danger">Đã hủy</span>';
  else if (status === 'pending') statusBadge = '<span class="badge badge-warning">Chờ thanh toán</span>';
  else if (isFuture) statusBadge = '<span class="badge badge-info">Sắp khởi hành</span>';

  let html = `<div class="form-row"><div class="form-group"><label>Mã vé:</label><input value="${ticketId}" readonly></div><div class="form-group"><label>Chuyến:</label><input value="${route}" readonly></div></div>`;
  html += `<div class="form-row"><div class="form-group"><label>Khởi hành:</label><input value="${dep}" readonly></div><div class="form-group"><label>Loại ghế:</label><input value="${seat}" readonly></div></div>`;
  html += `<div class="form-row"><div class="form-group"><label>Giá vé:</label><input value="${Number(price).toLocaleString('vi-VN')} VNĐ" readonly></div><div class="form-group"><label>Trạng thái:</label><div>${statusBadge}</div></div></div>`;
  if (status === 'pending') {
    html += `<div style="text-align:right;margin-top:10px"><button class="btn btn-danger" onclick="cancelMyTicket('${ticketId}');closeTicketDetail();">Hủy vé</button></div>`;
  }
  document.getElementById('modalTicketContent').innerHTML = html;
  document.getElementById('ticketDetailModal').style.display = 'flex';
}

function closeTicketDetail() {
  document.getElementById('ticketDetailModal').style.display = 'none';
}

function payMyTicket(id) {
  showConfirm('Xác nhận thanh toán vé này?', async () => {
    try {
      const res = await fetch(`/api/tickets/pay/${id}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) { toast('Thanh toán thành công!'); setTimeout(() => location.reload(), 800); }
      else toast(data.message, 'error');
    } catch (err) { toast('Lỗi kết nối', 'error'); }
  });
}

function cancelMyTicket(id) {
  showConfirm('Bạn có chắc muốn hủy vé này?', async () => {
    try {
      const res = await fetch(`/api/tickets/cancel/${id}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) { toast('Hủy vé thành công!'); setTimeout(() => location.reload(), 800); }
      else toast(data.message, 'error');
    } catch (err) { toast('Lỗi kết nối', 'error'); }
  });
}

function startPendingTicketsCountdown() {
  const timers = document.querySelectorAll('.pending-countdown');
  if (timers.length === 0) return;

  function updateTimers() {
    timers.forEach(timer => {
      let remainingSec = parseInt(timer.getAttribute('data-remaining-sec'), 10);
      if (isNaN(remainingSec)) return;

      const span = timer.querySelector('.timer-countdown');
      if (remainingSec <= 0) {
        span.textContent = 'Đang hủy...';
        if (!timer.dataset.reloaded) {
          timer.dataset.reloaded = "true";
          setTimeout(() => location.reload(), 2000);
        }
      } else {
        remainingSec--;
        timer.setAttribute('data-remaining-sec', remainingSec);
        const mins = Math.floor(remainingSec / 60);
        const secs = remainingSec % 60;
        span.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }
    });
  }

  updateTimers();
  setInterval(updateTimers, 1000);
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  startPendingTicketsCountdown();

  fetch('/api/trains/prices')
    .then(r => r.json())
    .then(data => {
      if (data.status === 'success') {
        data.prices.forEach(p => { seatPrices[p.SeatClass] = p.price; });
      }
    })
    .catch(() => {});
  window.addEventListener('click', e => {
    ['ticketDetailModal', 'bookingModal'].forEach(id => {
      const el = document.getElementById(id);
      if (e.target === el) el.style.display = 'none';
    });
  });
});
