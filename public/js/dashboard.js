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
let currentAvailH1 = 0;
let currentAvailH2 = 0;

function bookTicket(trainId, route, departureTime, availH1, availH2) {
  currentAvailH1 = availH1;
  currentAvailH2 = availH2;
  fillBookingForm({ id: trainId, route, departureTime });
}

function fillBookingForm(trainInfo) {
  document.getElementById('bookTrainId').value = trainInfo.id;
  document.getElementById('bookRoute').value = trainInfo.route;
  document.getElementById('bookDepartureTime').value = trainInfo.departureTime;
  document.getElementById('bookPrice').value = '';
  document.getElementById('bookSeatType').value = '';
  document.getElementById('bookQuantity').value = 1;
  document.getElementById('bookingModal').style.display = 'flex';
}

function updateBookPrice() {
  const type = document.getElementById('bookSeatType').value;
  const qty = parseInt(document.getElementById('bookQuantity').value, 10) || 1;
  if (seatPrices[type]) {
    const total = seatPrices[type] * qty;
    document.getElementById('bookPrice').value = Number(total).toLocaleString('vi-VN') + ' VNĐ (' + qty + ' vé x ' + Number(seatPrices[type]).toLocaleString('vi-VN') + 'đ)';
  } else {
    document.getElementById('bookPrice').value = '';
  }
}

function closeBookingModal() {
  document.getElementById('bookingModal').style.display = 'none';
}

function submitBooking(event) {
  event.preventDefault();
  const trainId = document.getElementById('bookTrainId').value;
  const seatClass = document.getElementById('bookSeatType').value;
  const qty = parseInt(document.getElementById('bookQuantity').value, 10) || 1;
  if (!seatClass) { toast('Vui lòng chọn loại ghế', 'error'); return; }
  if (qty < 1 || qty > 10) { toast('Số lượng vé phải từ 1 đến 10', 'error'); return; }

  const maxAvail = seatClass === 'Hạng 1' ? currentAvailH1 : currentAvailH2;
  if (qty > maxAvail) { toast(`Chỉ còn ${maxAvail} ghế ${seatClass}`, 'error'); return; }

  fetch('/api/tickets/book', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      IdTrainRide: trainId,
      IdCustomer: currentCustomerId,
      SeatClass: seatClass,
      quantity: qty
    })
  })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      toast(`Đặt ${data.quantity} vé thành công! Tổng tiền: ${Number(data.totalPrice).toLocaleString('vi-VN')}đ`);
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
  if (isFuture && !isCancelled) {
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

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
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
