function searchStationsTable() {
  const val = document.getElementById('stationSearch').value.toLowerCase().trim();
  document.querySelectorAll('#stationsTableBody tr').forEach(row => {
    const search = (row.getAttribute('data-search')||'').toLowerCase();
    row.style.display = (!val || search.includes(val)) ? '' : 'none';
  });
}

function openStationModal() {
  document.getElementById('stationModalTitle').textContent = 'Thêm ga tàu';
  document.getElementById('stationOldName').value = '';
  document.getElementById('stationName').value = '';
  document.getElementById('stationAddress').value = '';
  document.getElementById('stationName').disabled = false;
  document.getElementById('stationModal').style.display = 'flex';
}

function editStationRow(name, address) {
  document.getElementById('stationModalTitle').textContent = 'Sửa ga tàu';
  document.getElementById('stationOldName').value = name;
  document.getElementById('stationName').value = name;
  document.getElementById('stationAddress').value = address || '';
  document.getElementById('stationName').disabled = true;
  document.getElementById('stationModal').style.display = 'flex';
}

function closeStationModal() {
  document.getElementById('stationModal').style.display = 'none';
}

async function saveStationRow(e) {
  e.preventDefault();
  const oldName = document.getElementById('stationOldName').value;
  const payload = {
    Name: document.getElementById('stationName').value,
    Address: document.getElementById('stationAddress').value
  };
  try {
    if (oldName) {
      const res = await fetch(`/api/stations/${encodeURIComponent(oldName)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.status === 'success') { toast('Cập nhật thành công!'); setTimeout(()=>location.reload(),800); }
      else toast(data.message, 'error');
    } else {
      const res = await fetch('/api/stations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.status === 'success') { toast('Thêm ga tàu thành công!'); setTimeout(()=>location.reload(),800); }
      else toast(data.message, 'error');
    }
  } catch (err) { toast('Lỗi kết nối: ' + err.message, 'error'); }
}

function deleteStationRow(name) {
  showConfirm('Bạn có chắc muốn xóa ga tàu này?', async () => {
    try {
      const res = await fetch(`/api/stations/${encodeURIComponent(name)}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.status === 'success') { toast('Xóa thành công!'); setTimeout(()=>location.reload(),800); }
      else toast(data.message, 'error');
    } catch (err) { toast('Lỗi kết nối: ' + err.message, 'error'); }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  window.addEventListener('click', e => {
    const el = document.getElementById('stationModal');
    if (e.target === el) el.style.display = 'none';
  });
});
