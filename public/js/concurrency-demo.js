// === Concurrency Demo JS ===
let demoHistory = [];

// Load data on page load
document.addEventListener('DOMContentLoaded', async () => {
  await loadCustomers();
  await loadTrainRides();
  document.getElementById('selectRide').addEventListener('change', loadSeats);
});

async function loadCustomers() {
  try {
    const res = await fetch('/api/customers');
    const data = await res.json();
    const customers = data.customers || data || [];
    const selA = document.getElementById('selectCustomerA');
    const selB = document.getElementById('selectCustomerB');
    selA.innerHTML = '';
    selB.innerHTML = '';
    customers.forEach(c => {
      const name = c.fullname || c.Name || c.username;
      const opt = `<option value="${c.id}">${c.id} - ${name}</option>`;
      selA.innerHTML += opt;
      selB.innerHTML += opt;
    });
    // Default: pick two different customers
    if (customers.length >= 2) selB.selectedIndex = 1;
  } catch (e) {
    console.error('Error loading customers:', e);
  }
}

async function loadTrainRides() {
  try {
    const res = await fetch('/api/trains');
    const data = await res.json();
    const rides = data.trains || data.rides || data || [];
    const sel = document.getElementById('selectRide');
    sel.innerHTML = '';
    rides.forEach(r => {
      const dt = new Date(r.DepartureTime).toLocaleString('vi-VN');
      sel.innerHTML += `<option value="${r.id}">${r.id} | ${r.DepartureStation} → ${r.Destination} (${dt})</option>`;
    });
    if (rides.length > 0) await loadSeats();
  } catch (e) {
    console.error('Error loading rides:', e);
  }
}

async function loadSeats() {
  const rideId = document.getElementById('selectRide').value;
  if (!rideId) return;
  try {
    const res = await fetch(`/api/trains/${rideId}/seats`);
    const data = await res.json();
    const seats = data.seats || data || [];
    const sel = document.getElementById('selectSeat');
    sel.innerHTML = '';
    const available = seats.filter(s => s.status === 'AVAILABLE');
    if (available.length === 0) {
      sel.innerHTML = '<option value="">Không còn ghế trống</option>';
      return;
    }
    available.forEach(s => {
      const label = `Ghế ${s.SeatNumber} (${s.SeatClass}) - ${s.status}`;
      sel.innerHTML += `<option value="${s.trsId || s.id}">${label}</option>`;
    });
  } catch (e) {
    console.error('Error loading seats:', e);
  }
}

async function runDemo(mode) {
  const rideId = document.getElementById('selectRide').value;
  const trsId = document.getElementById('selectSeat').value;
  const customerA = document.getElementById('selectCustomerA').value;
  const customerB = document.getElementById('selectCustomerB').value;

  if (!rideId || !trsId || !customerA || !customerB) {
    alert('Vui lòng chọn đầy đủ thông tin!');
    return;
  }
  if (customerA === customerB) {
    alert('Vui lòng chọn 2 khách hàng khác nhau!');
    return;
  }

  // Disable buttons
  const btnNoLock = document.getElementById('btnNoLock');
  const btnWithLock = document.getElementById('btnWithLock');
  btnNoLock.disabled = true;
  btnWithLock.disabled = true;
  const activeBtn = mode === 'no-lock' ? btnNoLock : btnWithLock;
  activeBtn.classList.add('loading');
  activeBtn.querySelector('.btn-icon').textContent = '⏳';

  const endpoint = mode === 'no-lock'
    ? '/api/tickets/demo/concurrent-book-no-lock'
    : '/api/tickets/demo/concurrent-book';

  try {
    const startTime = Date.now();
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        IdTrainRide: rideId,
        trsId,
        customerA,
        customerB,
        delayMs: mode === 'no-lock' ? 500 : 200
      })
    });
    const data = await res.json();
    const totalTime = Date.now() - startTime;

    if (data.success) {
      showResults(data, mode, totalTime);
      addHistory(data, mode);
    } else {
      alert('Lỗi: ' + data.message);
    }
  } catch (e) {
    alert('Lỗi kết nối: ' + e.message);
  } finally {
    btnNoLock.disabled = false;
    btnWithLock.disabled = false;
    activeBtn.classList.remove('loading');
    btnNoLock.querySelector('.btn-icon').textContent = '💥';
    btnWithLock.querySelector('.btn-icon').textContent = '🔒';
  }
}

function showResults(data, mode, totalTime) {
  const panel = document.getElementById('resultsPanel');
  panel.style.display = '';

  const [rA, rB] = data.results;
  const bothWon = rA.success && rB.success;
  const title = document.getElementById('resultTitle');
  title.textContent = mode === 'no-lock'
    ? '💥 Kết quả: KHÔNG CÓ khóa'
    : '🔒 Kết quả: CÓ khóa (UPDLOCK, ROWLOCK)';

  const explEl = document.getElementById('resultExplanation');
  explEl.textContent = data.explanation;
  explEl.className = 'result-explanation ' + (bothWon ? 'error-result' : 'success-result');

  renderUserResult('resultA', rA, bothWon);
  renderUserResult('resultB', rB, bothWon);

  // Timeline
  showTimeline(rA, rB);

  // Scroll to results
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderUserResult(elId, result, bothWon) {
  const el = document.getElementById(elId);
  el.className = 'user-result ' + (bothWon ? 'both-won' : (result.success ? 'won' : 'lost'));

  const statusEl = el.querySelector('.result-status');
  if (bothWon && result.success) {
    statusEl.textContent = '⚠️ ĐẶT ĐƯỢC (LỖI!)';
    statusEl.className = 'result-status warning';
  } else if (result.success) {
    statusEl.textContent = '✅ ĐẶT THÀNH CÔNG';
    statusEl.className = 'result-status success';
  } else {
    statusEl.textContent = '❌ BỊ TỪ CHỐI';
    statusEl.className = 'result-status failed';
  }

  let details = `<div>${result.message}</div>`;
  if (result.ticketId) details += `<div>Mã vé: ${result.ticketId}</div>`;
  if (result.seatInfo) details += `<div>${result.seatInfo}</div>`;
  details += `<div>Thời gian: ${result.duration}ms</div>`;
  details += `<div>Khách hàng: ${result.customerId}</div>`;
  el.querySelector('.result-details').innerHTML = details;
}

function showTimeline(rA, rB) {
  const panel = document.getElementById('timelinePanel');
  panel.style.display = '';
  const maxDur = Math.max(rA.duration, rB.duration, 1);
  document.getElementById('timeline').innerHTML = `
    <div class="bar a" style="height:${Math.max((rA.duration/maxDur)*100,20)}%">
      ${rA.duration}ms
      <span class="bar-label">User A ${rA.success ? '✅' : '❌'}</span>
    </div>
    <div class="bar b" style="height:${Math.max((rB.duration/maxDur)*100,20)}%">
      ${rB.duration}ms
      <span class="bar-label">User B ${rB.success ? '✅' : '❌'}</span>
    </div>
  `;
}

function addHistory(data, mode) {
  const [rA, rB] = data.results;
  const bothWon = rA.success && rB.success;
  const time = new Date().toLocaleTimeString('vi-VN');
  const item = {
    mode,
    time,
    explanation: data.explanation,
    bothWon,
    aResult: rA.success,
    bResult: rB.success
  };
  demoHistory.unshift(item);

  const list = document.getElementById('historyList');
  const emptyMsg = list.querySelector('.empty-history');
  if (emptyMsg) emptyMsg.remove();

  const div = document.createElement('div');
  div.className = 'history-item';
  div.innerHTML = `
    <span class="badge ${mode === 'no-lock' ? 'nolock' : 'lock'}">
      ${mode === 'no-lock' ? 'NO LOCK' : 'UPDLOCK'}
    </span>
    <span class="result-text">
      A: ${rA.success ? '✅' : '❌'} | B: ${rB.success ? '✅' : '❌'}
      — ${bothWon ? '⚠️ Lỗi tương tranh!' : '✅ Xử lý đúng'}
    </span>
    <span class="time">${time}</span>
  `;
  list.prepend(div);
}
