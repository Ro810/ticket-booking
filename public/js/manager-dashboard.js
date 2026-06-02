// Manager Dashboard JS - HQ (Quản lý trụ sở)

// ===== Generic =====
function searchTable(tbodyId, inputId) {
    const val = document.getElementById(inputId).value.toLowerCase().trim();
    document.querySelectorAll(`#${tbodyId} tr`).forEach((row) => {
        const s = (row.getAttribute('data-search') || '').toLowerCase();
        row.style.display = !val || s.includes(val) ? '' : 'none';
    });
}
function sortTable(tableId, colIndex) {
    const table = document.getElementById(tableId);
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const th = table.querySelectorAll('th')[colIndex];
    const asc = !th.classList.contains('asc');
    table.querySelectorAll('th').forEach((t) => t.classList.remove('asc', 'desc'));
    th.classList.add(asc ? 'asc' : 'desc');
    rows.sort((a, b) => {
        const aT = a.cells[colIndex]?.innerText.trim() || '';
        const bT = b.cells[colIndex]?.innerText.trim() || '';
        const aN = parseFloat(aT.replace(/[^0-9.-]/g, ''));
        const bN = parseFloat(bT.replace(/[^0-9.-]/g, ''));
        if (!isNaN(aN) && !isNaN(bN) && aT !== bT) return asc ? aN - bN : bN - aN;
        return asc ? aT.localeCompare(bT, 'vi') : bT.localeCompare(aT, 'vi');
    });
    rows.forEach((r) => tbody.appendChild(r));
}
function searchCustomersTable() {
    searchTable('customersTableBody', 'customerSearch');
}
function searchTrainsTable() {
    searchTable('trainsTableBody', 'trainSearch');
}
function searchTicketsTable() {
    searchTable('ticketsTableBody', 'ticketSearch');
}
function applyBranchFilter(tab) {
    const s = document.getElementById(
        tab === 'tickets' ? 'ticketBranchFilter' : 'reportBranchFilter',
    );
    window.location.href = `/dashboard?branch=${s.value}#${tab}`;
}

// ===== Ticket =====
async function updateTicketStatus(id, status) {
    try {
        const r = await fetch(`/api/tickets/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });
        const d = await r.json();
        if (d.success) {
            toast('Thành công!');
            setTimeout(() => location.reload(), 800);
        } else toast(d.message, 'error');
    } catch (e) {
        toast('Lỗi: ' + e.message, 'error');
    }
}
function cancelTicketRow(id) {
    showConfirm('Hủy vé này?', async () => {
        try {
            const r = await fetch(`/api/tickets/cancel/${id}`, { method: 'POST' });
            const d = await r.json();
            if (d.success) {
                toast('Hủy thành công!');
                setTimeout(() => location.reload(), 800);
            } else toast(d.message, 'error');
        } catch (e) {
            toast('Lỗi: ' + e.message, 'error');
        }
    });
}

// ===== Branch =====
function openBranchModal() {
    document.getElementById('branchModalTitle').textContent = 'Thêm chi nhánh';
    document.getElementById('branchEditId').value = '';
    document.getElementById('branchId').value = '';
    document.getElementById('branchId').disabled = false;
    document.getElementById('branchAddress').value = '';
    document.getElementById('branchPhone').value = '';
    document.getElementById('branchModal').style.display = 'flex';
}
function editBranch(id, addr, phone) {
    document.getElementById('branchModalTitle').textContent = 'Sửa chi nhánh';
    document.getElementById('branchEditId').value = id;
    document.getElementById('branchId').value = id;
    document.getElementById('branchId').disabled = true;
    document.getElementById('branchAddress').value = addr;
    document.getElementById('branchPhone').value = phone;
    document.getElementById('branchModal').style.display = 'flex';
}
function closeBranchModal() {
    document.getElementById('branchModal').style.display = 'none';
}
async function saveBranch(e) {
    e.preventDefault();
    const eid = document.getElementById('branchEditId').value;
    const p = {
        id: document.getElementById('branchId').value,
        address: document.getElementById('branchAddress').value,
        phoneNumber: document.getElementById('branchPhone').value,
    };
    try {
        const r = await fetch(eid ? `/api/branches/${eid}` : '/api/branches', {
            method: eid ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(p),
        });
        const d = await r.json();
        if (d.status === 'success') {
            toast(d.message);
            setTimeout(() => location.reload(), 800);
        } else toast(d.message, 'error');
    } catch (e) {
        toast('Lỗi: ' + e.message, 'error');
    }
}
function deleteBranch(id) {
    showConfirm('Xóa chi nhánh?', async () => {
        try {
            const r = await fetch(`/api/branches/${id}`, { method: 'DELETE' });
            const d = await r.json();
            if (d.status === 'success') {
                toast(d.message);
                setTimeout(() => location.reload(), 800);
            } else toast(d.message, 'error');
        } catch (e) {
            toast('Lỗi: ' + e.message, 'error');
        }
    });
}

// ===== Employee =====
function openEmployeeModal() {
    document.getElementById('empModalTitle').textContent = 'Thêm nhân viên';
    document.getElementById('empEditId').value = '';
    document.getElementById('empName').value = '';
    document.getElementById('empRole').value = 'Quản lý cơ sở';
    document.getElementById('empBranch').value = '';
    document.getElementById('empPhone').value = '';
    document.getElementById('empSalary').value = '0';
    const empPassword = document.getElementById('empPassword');
    empPassword.value = '';
    empPassword.required = true;
    document.getElementById('empPasswordRow').style.display = '';
    document.getElementById('employeeModal').style.display = 'flex';
}
function editEmployee(id, name, salary, role, phone, branch) {
    document.getElementById('empModalTitle').textContent = 'Sửa nhân viên';
    document.getElementById('empEditId').value = id;
    document.getElementById('empName').value = name;
    document.getElementById('empRole').value = role;
    document.getElementById('empBranch').value = branch;
    document.getElementById('empPhone').value = phone;
    document.getElementById('empSalary').value = salary;
    const empPassword = document.getElementById('empPassword');
    empPassword.value = '';
    empPassword.required = false;
    document.getElementById('empPasswordRow').style.display = 'none';
    document.getElementById('employeeModal').style.display = 'flex';
}
function closeEmployeeModal() {
    document.getElementById('employeeModal').style.display = 'none';
}
async function saveEmployee(e) {
    e.preventDefault();
    const eid = document.getElementById('empEditId').value;
    const fullname = document.getElementById('empName').value.trim();
    const role = document.getElementById('empRole').value;
    const idBranch = document.getElementById('empBranch').value;
    const phoneNumber = document.getElementById('empPhone').value.trim();
    const salary = document.getElementById('empSalary').value;
    const password = document.getElementById('empPassword').value;
    if (!fullname || !role || !idBranch || !phoneNumber) {
        toast('Vui lòng nhập đầy đủ thông tin', 'error');
        return;
    }
    if (!eid && !password) {
        toast('Vui lòng nhập mật khẩu', 'error');
        return;
    }
    const p = { fullname, role, idBranch, phoneNumber, salary };
    if (!eid) {
        p.password = password;
    }
    try {
        const r = await fetch(eid ? `/api/employees/${eid}` : '/api/employees', {
            method: eid ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(p),
        });
        const d = await r.json();
        if (d.status === 'success') {
            toast(d.message);
            setTimeout(() => location.reload(), 800);
        } else toast(d.message, 'error');
    } catch (e) {
        toast('Lỗi: ' + e.message, 'error');
    }
}
function deleteEmployee(id) {
    showConfirm('Xóa nhân viên?', async () => {
        try {
            const r = await fetch(`/api/employees/${id}`, { method: 'DELETE' });
            const d = await r.json();
            if (d.status === 'success') {
                toast(d.message);
                setTimeout(() => location.reload(), 800);
            } else toast(d.message, 'error');
        } catch (e) {
            toast('Lỗi: ' + e.message, 'error');
        }
    });
}

// ===== Train Entity =====
function openTrainEntityModal() {
    document.getElementById('trainEntityModalTitle').textContent = 'Thêm tàu';
    document.getElementById('teEditId').value = '';
    document.getElementById('teId').value = '';
    document.getElementById('teId').disabled = false;
    document.getElementById('teBrand').value = '';
    document.getElementById('teClass1').value = '30';
    document.getElementById('teClass2').value = '120';
    document.getElementById('teBranch').value = '';
    document.getElementById('teClass1').disabled = false;
    document.getElementById('teClass2').disabled = false;
    document.getElementById('trainEntityModal').style.display = 'flex';
}
function editTrainEntity(id, brand, branch) {
    document.getElementById('trainEntityModalTitle').textContent = 'Sửa tàu';
    document.getElementById('teEditId').value = id;
    document.getElementById('teId').value = id;
    document.getElementById('teId').disabled = true;
    document.getElementById('teBrand').value = brand;
    document.getElementById('teBranch').value = branch;
    document.getElementById('teClass1').disabled = true;
    document.getElementById('teClass2').disabled = true;
    document.getElementById('trainEntityModal').style.display = 'flex';
}
function closeTrainEntityModal() {
    document.getElementById('trainEntityModal').style.display = 'none';
}
async function saveTrainEntity(e) {
    e.preventDefault();
    const eid = document.getElementById('teEditId').value;
    const p = {
        id: document.getElementById('teId').value,
        ManufacturingBrand: document.getElementById('teBrand').value,
        class1Seats: document.getElementById('teClass1').value,
        class2Seats: document.getElementById('teClass2').value,
        idBranch: document.getElementById('teBranch').value,
    };
    try {
        const r = await fetch(eid ? `/api/trains/entity/${eid}` : '/api/trains/entity', {
            method: eid ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(p),
        });
        const d = await r.json();
        if (d.status === 'success') {
            toast(d.message);
            setTimeout(() => location.reload(), 800);
        } else toast(d.message, 'error');
    } catch (e) {
        toast('Lỗi: ' + e.message, 'error');
    }
}
function deleteTrainEntity(id) {
    showConfirm('Xóa tàu? (ghế cũng bị xóa)', async () => {
        try {
            const r = await fetch(`/api/trains/entity/${id}`, { method: 'DELETE' });
            const d = await r.json();
            if (d.status === 'success') {
                toast(d.message);
                setTimeout(() => location.reload(), 800);
            } else toast(d.message, 'error');
        } catch (e) {
            toast('Lỗi: ' + e.message, 'error');
        }
    });
}

// ===== Customer =====
function openCustomerModal() {
    document.getElementById('customerModalTitle').textContent = 'Thêm khách hàng';
    document.getElementById('custId').value = '';
    ['custName', 'custPhone', 'custUsername', 'custPassword', 'custAddress'].forEach(
        (i) => (document.getElementById(i).value = ''),
    );
    document.getElementById('custUsername').disabled = false;
    document.getElementById('custPassword').disabled = false;
    document.getElementById('customerModal').style.display = 'flex';
}
function editCustomerRow(id, name, phone, addr) {
    document.getElementById('customerModalTitle').textContent = 'Sửa khách hàng';
    document.getElementById('custId').value = id;
    document.getElementById('custName').value = name;
    document.getElementById('custPhone').value = phone;
    document.getElementById('custUsername').value = 'readonly';
    document.getElementById('custPassword').value = 'readonly';
    document.getElementById('custUsername').disabled = true;
    document.getElementById('custPassword').disabled = true;
    document.getElementById('custAddress').value = addr || '';
    document.getElementById('customerModal').style.display = 'flex';
}
function closeCustomerModal() {
    document.getElementById('customerModal').style.display = 'none';
}
async function saveCustomerRow(e) {
    e.preventDefault();
    const id = document.getElementById('custId').value;
    const p = {
        name: document.getElementById('custName').value,
        phoneNumber: document.getElementById('custPhone').value,
        address: document.getElementById('custAddress').value,
    };
    try {
        if (id) {
            const r = await fetch(`/api/customers/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(p),
            });
            const d = await r.json();
            if (d.status === 'success') {
                toast('Cập nhật thành công!');
                setTimeout(() => location.reload(), 800);
            } else toast(d.message, 'error');
        } else {
            p.username = document.getElementById('custUsername').value;
            p.password = document.getElementById('custPassword').value;
            const r = await fetch('/api/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(p),
            });
            const d = await r.json();
            if (d.status === 'success') {
                toast('Thêm thành công!');
                setTimeout(() => location.reload(), 800);
            } else toast(d.message, 'error');
        }
    } catch (e) {
        toast('Lỗi: ' + e.message, 'error');
    }
}
function deleteCustomerRow(id) {
    showConfirm('Xóa khách hàng?', async () => {
        try {
            const r = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
            const d = await r.json();
            if (d.status === 'success') {
                toast('Xóa thành công!');
                setTimeout(() => location.reload(), 800);
            } else toast(d.message, 'error');
        } catch (e) {
            toast('Lỗi: ' + e.message, 'error');
        }
    });
}

// ===== Customer Detail =====
async function viewCustomerDetail(id) {
    const m = document.getElementById('customerDetailModal');
    const tb = document.getElementById('cdTicketsBody');
    tb.innerHTML =
        '<tr><td colspan="5"><div class="empty-state"><h4>Đang tải...</h4></div></td></tr>';
    m.style.display = 'flex';
    try {
        const r = await fetch(`/api/customers/${id}`);
        const d = await r.json();
        if (d.status !== 'success') {
            toast(d.message, 'error');
            m.style.display = 'none';
            return;
        }
        const c = d.customer;
        document.getElementById('cdId').textContent = c.id || '-';
        document.getElementById('cdName').textContent = c.Name || '-';
        document.getElementById('cdPhone').textContent = c.phoneNumber || '-';
        document.getElementById('cdAddress').textContent = c.Address || '-';
        document.getElementById('cdUsername').textContent = c.username || '-';
        const tks = d.tickets || [];
        if (!tks.length) {
            tb.innerHTML =
                '<tr><td colspan="5"><div class="empty-state"><h4>Chưa có vé</h4></div></td></tr>';
            return;
        }
        tb.innerHTML = tks
            .map((t) => {
                const st = t.status || 'paid';
                let b =
                    st === 'cancelled'
                        ? '<span class="badge badge-danger">Đã hủy</span>'
                        : st === 'pending'
                          ? '<span class="badge badge-warning">Chờ TT</span>'
                          : new Date(t.DepartureTime) > new Date()
                            ? '<span class="badge badge-info">Sắp KH</span>'
                            : '<span class="badge badge-success">Hoàn thành</span>';
                return `<tr><td>${t.id}</td><td>${t.DepartureStation || '-'} → ${t.Destination || '-'}<br><small>${new Date(t.DepartureTime).toLocaleString('vi-VN')}</small></td><td>${t.SeatClass || '-'} ${t.SeatNumber ? '(' + t.SeatNumber + ')' : ''}</td><td>${(t.price || 0).toLocaleString('vi-VN')}đ</td><td>${b}</td></tr>`;
            })
            .join('');
    } catch (e) {
        toast('Lỗi: ' + e.message, 'error');
        m.style.display = 'none';
    }
}
function closeCustomerDetailModal() {
    document.getElementById('customerDetailModal').style.display = 'none';
}

// ===== Train Ride =====
function openTrainModal() {
    document.getElementById('trainModalTitle').textContent = 'Thêm chuyến tàu';
    document.getElementById('trId').value = '';
    document.getElementById('trCode').value = '';
    document.getElementById('trCode').disabled = false;
    document.getElementById('trTrainId').value = '';
    document.getElementById('trFrom').value = '';
    document.getElementById('trTo').value = '';
    document.getElementById('trDeparture').value = '';
    document.getElementById('trPrice').value = '0';
    document.getElementById('trainModal').style.display = 'flex';
}
function editTrainRow(id, from, to, dep, trainId, price) {
    document.getElementById('trainModalTitle').textContent = 'Sửa chuyến tàu';
    document.getElementById('trId').value = id;
    document.getElementById('trCode').value = id;
    document.getElementById('trCode').disabled = true;
    document.getElementById('trTrainId').value = trainId || '';
    document.getElementById('trFrom').value = from || '';
    document.getElementById('trTo').value = to || '';
    document.getElementById('trPrice').value = price || '0';
    const d = new Date(dep);
    const pad = (n) => String(n).padStart(2, '0');
    document.getElementById('trDeparture').value =
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    document.getElementById('trainModal').style.display = 'flex';
}
function closeTrainModal() {
    document.getElementById('trainModal').style.display = 'none';
}
async function saveTrainRow(e) {
    e.preventDefault();
    const id = document.getElementById('trId').value;
    const p = {
        id: document.getElementById('trCode').value,
        idTrain: document.getElementById('trTrainId').value,
        DepartureStation: document.getElementById('trFrom').value,
        Destination: document.getElementById('trTo').value,
        DepartureTime: document.getElementById('trDeparture').value,
        price: document.getElementById('trPrice').value,
    };
    try {
        const r = await fetch(id ? `/api/trains/ride/${id}` : '/api/trains/ride', {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(p),
        });
        const d = await r.json();
        if (d.status === 'success') {
            toast(d.message);
            setTimeout(() => location.reload(), 800);
        } else toast(d.message, 'error');
    } catch (e) {
        toast('Lỗi: ' + e.message, 'error');
    }
}
function deleteTrainRow(id) {
    showConfirm('Xóa chuyến tàu?', async () => {
        try {
            const r = await fetch(`/api/trains/ride/${id}`, { method: 'DELETE' });
            const d = await r.json();
            if (d.status === 'success') {
                toast(d.message);
                setTimeout(() => location.reload(), 800);
            } else toast(d.message, 'error');
        } catch (e) {
            toast('Lỗi: ' + e.message, 'error');
        }
    });
}

// ===== Train Detail =====
async function viewTrainDetail(id) {
    const m = document.getElementById('trainDetailModal');
    document.getElementById('btTrainRideId').value = id;
    document.getElementById('tdId').textContent = id;
    document.getElementById('tdSeat1').textContent = '...';
    document.getElementById('tdSeat2').textContent = '...';
    m.style.display = 'flex';
    try {
        const r = await fetch(`/api/trains/${id}/seats`);
        const d = await r.json();
        if (d.status !== 'success') {
            toast(d.message, 'error');
            return;
        }
        const ss = d.seats || [];
        let c1T = 0,
            c1A = 0,
            c2T = 0,
            c2A = 0;
        ss.forEach((s) => {
            if (s.SeatClass === 'Hạng 1') {
                c1T++;
                if (s.status === 'AVAILABLE') c1A++;
            }
            if (s.SeatClass === 'Hạng 2') {
                c2T++;
                if (s.status === 'AVAILABLE') c2A++;
            }
        });
        document.getElementById('tdSeat1').textContent = `${c1A}/${c1T}`;
        document.getElementById('tdSeat2').textContent = `${c2A}/${c2T}`;
        const row = document.querySelector(`#trainsTableBody tr[data-train-id="${id}"]`);
        if (row) {
            document.getElementById('tdRoute').textContent = row.getAttribute('data-route') || '-';
            document.getElementById('tdTime').textContent = row.cells[2]?.textContent || '-';
            document.getElementById('tdTrain').textContent = row.cells[3]?.textContent || '-';
        }
    } catch (e) {
        toast('Lỗi: ' + e.message, 'error');
    }
}
function closeTrainDetailModal() {
    document.getElementById('trainDetailModal').style.display = 'none';
    document.getElementById('bookTicketForm').reset();
}
async function bookTicketForCustomer(e) {
    e.preventDefault();
    const p = {
        IdTrainRide: document.getElementById('btTrainRideId').value,
        IdCustomer: document.getElementById('btCustomer').value,
        SeatClass: document.getElementById('btSeatClass').value,
        quantity: parseInt(document.getElementById('btQuantity').value, 10),
    };
    if (!p.IdCustomer || !p.SeatClass) {
        toast('Nhập đầy đủ', 'error');
        return;
    }
    try {
        const r = await fetch('/api/tickets/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(p),
        });
        const d = await r.json();
        if (d.success) {
            toast(`Đặt ${d.quantity} vé! Tổng: ${(d.totalPrice || 0).toLocaleString('vi-VN')}đ`);
            setTimeout(() => {
                closeTrainDetailModal();
                location.reload();
            }, 800);
        } else toast(d.message, 'error');
    } catch (e) {
        toast('Lỗi: ' + e.message, 'error');
    }
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('click', (e) => {
        [
            'customerModal',
            'trainModal',
            'customerDetailModal',
            'trainDetailModal',
            'branchModal',
            'employeeModal',
            'stationModal',
            'trainEntityModal',
        ].forEach((id) => {
            const el = document.getElementById(id);
            if (e.target === el) el.style.display = 'none';
        });
    });
    if (window.location.hash) navTo(window.location.hash);
});
