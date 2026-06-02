// Manager Dashboard JS

// ===== Tabs =====
function switchUserTab(tabId, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  btn.classList.add('active');
}

// ===== Table Sort =====
function sortTable(tableId, colIndex) {
  const table = document.getElementById(tableId);
  const tbody = table.querySelector('tbody');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  const th = table.querySelectorAll('th')[colIndex];
  const asc = !th.classList.contains('asc');
  table.querySelectorAll('th').forEach(t => t.classList.remove('asc','desc'));
  th.classList.add(asc ? 'asc' : 'desc');
  rows.sort((a,b) => {
    const aText = a.cells[colIndex]?.innerText.trim() || '';
    const bText = b.cells[colIndex]?.innerText.trim() || '';
    const aNum = parseFloat(aText.replace(/[^0-9.-]/g,''));
    const bNum = parseFloat(bText.replace(/[^0-9.-]/g,''));
    if (!isNaN(aNum) && !isNaN(bNum) && aText !== bText) {
      return asc ? aNum - bNum : bNum - aNum;
    }
    return asc ? aText.localeCompare(bText,'vi') : bText.localeCompare(aText,'vi');
  });
  rows.forEach(r => tbody.appendChild(r));
}

// ===== Search Tables =====
function searchCustomersTable() {
  const val = document.getElementById('customerSearch').value.toLowerCase().trim();
  document.querySelectorAll('#customersTableBody tr').forEach(row => {
    const name = (row.getAttribute('data-name')||'').toLowerCase();
    const phone = (row.getAttribute('data-phone')||'').toLowerCase();
    row.style.display = (!val || name.includes(val) || phone.includes(val)) ? '' : 'none';
  });
}
function searchTrainsTable() {
  const val = document.getElementById('trainSearch').value.toLowerCase().trim();
  document.querySelectorAll('#trainsTableBody tr').forEach(row => {
    const route = (row.getAttribute('data-route')||'').toLowerCase();
    row.style.display = (!val || route.includes(val)) ? '' : 'none';
  });
}
function searchTicketsTable() {
  const val = document.getElementById('ticketSearch').value.toLowerCase().trim();
  document.querySelectorAll('#ticketsTableBody tr').forEach(row => {
    const search = (row.getAttribute('data-search')||'').toLowerCase();
    row.style.display = (!val || search.includes(val)) ? '' : 'none';
  });
}

function applyBranchFilter(tab) {
  const select = document.getElementById(tab === 'tickets' ? 'ticketBranchFilter' : 'reportBranchFilter');
  const branch = select.value;
  window.location.href = `/dashboard?branch=${branch}#${tab === 'tickets' ? 'tickets' : 'reports'}`;
}

async function updateTicketStatus(ticketId, status) {
  try {
    const res = await fetch(`/api/tickets/${ticketId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (data.success) { toast('Cập nhật trạng thái thành công!'); setTimeout(()=>location.reload(),800); }
    else toast(data.message, 'error');
  } catch (err) { toast('Lỗi kết nối: ' + err.message, 'error'); }
}

function cancelTicketRow(ticketId) {
  showConfirm('Bạn có chắc muốn hủy vé này?', async () => {
    try {
      const res = await fetch(`/api/tickets/cancel/${ticketId}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) { toast('Hủy vé thành công!'); setTimeout(()=>location.reload(),800); }
      else toast(data.message, 'error');
    } catch (err) { toast('Lỗi kết nối: ' + err.message, 'error'); }
  });
}

// ===== Customer Modal =====
function openCustomerModal() {
  document.getElementById('customerModalTitle').textContent = 'Thêm khách hàng';
  document.getElementById('custId').value = '';
  document.getElementById('custName').value = '';
  document.getElementById('custPhone').value = '';
  document.getElementById('custUsername').value = '';
  document.getElementById('custPassword').value = '';
  document.getElementById('custAddress').value = '';
  document.getElementById('custUsername').disabled = false;
  document.getElementById('custPassword').disabled = false;
  document.getElementById('customerModal').style.display = 'flex';
}
function editCustomerRow(id, name, phone, address) {
  document.getElementById('customerModalTitle').textContent = 'Sửa khách hàng';
  document.getElementById('custId').value = id;
  document.getElementById('custName').value = name;
  document.getElementById('custPhone').value = phone;
  document.getElementById('custUsername').value = 'readonly';
  document.getElementById('custPassword').value = 'readonly';
  document.getElementById('custUsername').disabled = true;
  document.getElementById('custPassword').disabled = true;
  document.getElementById('custAddress').value = address || '';
  document.getElementById('customerModal').style.display = 'flex';
}
function closeCustomerModal() {
  document.getElementById('customerModal').style.display = 'none';
}

async function saveCustomerRow(e) {
  e.preventDefault();
  const id = document.getElementById('custId').value;
  const payload = {
    name: document.getElementById('custName').value,
    phoneNumber: document.getElementById('custPhone').value,
    address: document.getElementById('custAddress').value
  };
  try {
    if (id) {
      const res = await fetch(`/api/customers/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.status === 'success') { toast('Cập nhật thành công!'); setTimeout(()=>location.reload(),800); }
      else toast(data.message, 'error');
    } else {
      payload.username = document.getElementById('custUsername').value;
      payload.password = document.getElementById('custPassword').value;
      const res = await fetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.status === 'success') { toast('Thêm khách hàng thành công!'); setTimeout(()=>location.reload(),800); }
      else toast(data.message, 'error');
    }
  } catch (err) { toast('Lỗi kết nối: ' + err.message, 'error'); }
}

function deleteCustomerRow(id) {
  showConfirm('Bạn có chắc muốn xóa khách hàng này?', async () => {
    try {
      const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.status === 'success') { toast('Xóa thành công!'); setTimeout(()=>location.reload(),800); }
      else toast(data.message, 'error');
    } catch (err) { toast('Lỗi kết nối: ' + err.message, 'error'); }
  });
}

// ===== Customer Detail Modal =====
async function viewCustomerDetail(id) {
  const modal = document.getElementById('customerDetailModal');
  const tbody = document.getElementById('cdTicketsBody');
  tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><h4>Đang tải...</h4></div></td></tr>';
  modal.style.display = 'flex';
  try {
    const res = await fetch(`/api/customers/${id}`);
    const data = await res.json();
    if (data.status !== 'success') {
      toast(data.message, 'error');
      modal.style.display = 'none';
      return;
    }
    const c = data.customer;
    document.getElementById('cdId').textContent = c.id || '-';
    document.getElementById('cdName').textContent = c.Name || '-';
    document.getElementById('cdPhone').textContent = c.phoneNumber || '-';
    document.getElementById('cdAddress').textContent = c.Address || '-';
    document.getElementById('cdUsername').textContent = c.username || '-';

    const tickets = data.tickets || [];
    if (tickets.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">🎫</div><h4>Khách hàng chưa đặt vé nào</h4></div></td></tr>';
    } else {
      tbody.innerHTML = tickets.map(t => {
        const isFuture = new Date(t.DepartureTime) > new Date();
        const tStatus = t.status || 'paid';
        let statusBadge = '';
        if (tStatus === 'cancelled') statusBadge = '<span class="badge badge-danger">Đã hủy</span>';
        else if (tStatus === 'pending') statusBadge = '<span class="badge badge-warning">Chờ thanh toán</span>';
        else if (isFuture) statusBadge = '<span class="badge badge-info">Sắp khởi hành</span>';
        else statusBadge = '<span class="badge badge-success">Đã hoàn thành</span>';
        return `<tr>
          <td>${t.id}</td>
          <td>${t.DepartureStation || '-'} → ${t.Destination || '-'}<br><small style="color:#666">${new Date(t.DepartureTime).toLocaleString('vi-VN')}</small></td>
          <td>${t.SeatClass || '-'} ${t.SeatNumber ? '(' + t.SeatNumber + ')' : ''}</td>
          <td>${(t.ticketPrice || 0).toLocaleString('vi-VN')}đ</td>
          <td>${statusBadge}</td>
        </tr>`;
      }).join('');
    }
  } catch (err) {
    toast('Lỗi kết nối: ' + err.message, 'error');
    modal.style.display = 'none';
  }
}
function closeCustomerDetailModal() {
  document.getElementById('customerDetailModal').style.display = 'none';
}

// ===== Train Detail Modal =====
async function viewTrainDetail(id) {
  const modal = document.getElementById('trainDetailModal');
  const tbody = document.getElementById('cdTicketsBody');
  document.getElementById('btTrainRideId').value = id;
  document.getElementById('tdId').textContent = id;
  document.getElementById('tdSeat1').textContent = '...';
  document.getElementById('tdSeat2').textContent = '...';
  modal.style.display = 'flex';
  try {
    const res = await fetch(`/api/trains/${id}/seats`);
    const data = await res.json();
    if (data.status !== 'success') {
      toast(data.message, 'error');
      return;
    }
    const seats = data.seats || [];
    let class1Total = 0, class1Avail = 0, class2Total = 0, class2Avail = 0;
    seats.forEach(s => {
      if (s.SeatClass === 'Hạng 1') { class1Total++; if (s.status === 'AVAILABLE') class1Avail++; }
      if (s.SeatClass === 'Hạng 2') { class2Total++; if (s.status === 'AVAILABLE') class2Avail++; }
    });
    document.getElementById('tdSeat1').textContent = `${class1Avail} / ${class1Total}`;
    document.getElementById('tdSeat2').textContent = `${class2Avail} / ${class2Total}`;
    // find row data from table
    const row = document.querySelector(`#trainsTableBody tr[data-train-id="${id}"]`);
    if (row) {
      const route = row.getAttribute('data-route') || '-';
      document.getElementById('tdRoute').textContent = route;
      document.getElementById('tdTime').textContent = row.cells[2]?.textContent || '-';
      document.getElementById('tdTrain').textContent = row.cells[3]?.textContent || '-';
    }
  } catch (err) {
    toast('Lỗi kết nối: ' + err.message, 'error');
  }
}
function closeTrainDetailModal() {
  document.getElementById('trainDetailModal').style.display = 'none';
  document.getElementById('bookTicketForm').reset();
}

async function bookTicketForCustomer(e) {
  e.preventDefault();
  const payload = {
    IdTrainRide: document.getElementById('btTrainRideId').value,
    IdCustomer: document.getElementById('btCustomer').value,
    SeatClass: document.getElementById('btSeatClass').value,
    quantity: parseInt(document.getElementById('btQuantity').value, 10)
  };
  if (!payload.IdCustomer || !payload.SeatClass || !payload.quantity) {
    toast('Vui lòng nhập đầy đủ thông tin', 'error');
    return;
  }
  try {
    const res = await fetch('/api/tickets/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      toast(`Đặt ${data.quantity} vé thành công! Tổng: ${(data.totalPrice || 0).toLocaleString('vi-VN')}đ`);
      setTimeout(() => { closeTrainDetailModal(); location.reload(); }, 800);
    } else {
      toast(data.message, 'error');
    }
  } catch (err) { toast('Lỗi kết nối: ' + err.message, 'error'); }
}

// ===== Train Modal =====
function openTrainModal() {
  document.getElementById('trainModalTitle').textContent = 'Thêm chuyến tàu';
  document.getElementById('trId').value = '';
  document.getElementById('trCode').value = '';
  document.getElementById('trTrainId').value = '';
  document.getElementById('trFrom').value = '';
  document.getElementById('trTo').value = '';
  document.getElementById('trDeparture').value = '';
  document.getElementById('trainModal').style.display = 'flex';
}
function editTrainRow(id, from, to, departure, trainId) {
  document.getElementById('trainModalTitle').textContent = 'Sửa chuyến tàu';
  document.getElementById('trId').value = id;
  document.getElementById('trCode').value = id;
  document.getElementById('trTrainId').value = trainId || '';
  document.getElementById('trFrom').value = from || '';
  document.getElementById('trTo').value = to || '';
  const d = new Date(departure);
  const pad = n => String(n).padStart(2,'0');
  const localStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  document.getElementById('trDeparture').value = localStr;
  document.getElementById('trainModal').style.display = 'flex';
}
function closeTrainModal() {
  document.getElementById('trainModal').style.display = 'none';
}

async function saveTrainRow(e) {
  e.preventDefault();
  const id = document.getElementById('trId').value;
  const payload = {
    id: document.getElementById('trCode').value,
    idTrain: document.getElementById('trTrainId').value,
    DepartureStation: document.getElementById('trFrom').value,
    Destination: document.getElementById('trTo').value,
    DepartureTime: document.getElementById('trDeparture').value
  };
  try {
    if (id) {
      const res = await fetch(`/api/trains/ride/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.status === 'success') { toast('Cập nhật thành công!'); setTimeout(()=>location.reload(),800); }
      else toast(data.message, 'error');
    } else {
      const res = await fetch('/api/trains/ride', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.status === 'success') { toast('Thêm chuyến tàu thành công!'); setTimeout(()=>location.reload(),800); }
      else toast(data.message, 'error');
    }
  } catch (err) { toast('Lỗi kết nối: ' + err.message, 'error'); }
}

function deleteTrainRow(id) {
  showConfirm('Bạn có chắc muốn xóa chuyến tàu này?', async () => {
    try {
      const res = await fetch(`/api/trains/ride/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.status === 'success') { toast('Xóa thành công!'); setTimeout(()=>location.reload(),800); }
      else toast(data.message, 'error');
    } catch (err) { toast('Lỗi kết nối: ' + err.message, 'error'); }
  });
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  window.addEventListener('click', e => {
    ['customerModal','trainModal','customerDetailModal','trainDetailModal'].forEach(id => {
      const el = document.getElementById(id);
      if (e.target === el) el.style.display = 'none';
    });
  });
});
