// Branch Dashboard JS - Quản lý cơ sở

function onTimeRangeChange() {
  const val = document.getElementById('filterTimeRange').value;
  document.getElementById('customDateFrom').style.display = val==='custom'?'':'none';
  document.getElementById('customDateTo').style.display = val==='custom'?'':'none';
}

function getFilterParams() {
  const range = document.getElementById('filterTimeRange').value;
  const params = new URLSearchParams();
  const now = new Date();
  if (range==='today') { params.set('from', now.toISOString().split('T')[0]); params.set('to', now.toISOString().split('T')[0]); }
  else if (range==='7days') { const d=new Date(now); d.setDate(d.getDate()-7); params.set('from',d.toISOString().split('T')[0]); params.set('to',now.toISOString().split('T')[0]); }
  else if (range==='30days') { const d=new Date(now); d.setDate(d.getDate()-30); params.set('from',d.toISOString().split('T')[0]); params.set('to',now.toISOString().split('T')[0]); }
  else if (range==='custom') { const f=document.getElementById('filterFrom').value; const t=document.getElementById('filterTo').value; if(f)params.set('from',f); if(t)params.set('to',t); }
  const dep = document.getElementById('filterDeparture').value; if(dep) params.set('departureStation',dep);
  const dest = document.getElementById('filterDestination').value; if(dest) params.set('destination',dest);
  const sc = document.getElementById('filterSeatClass').value; if(sc) params.set('seatClass',sc);
  return params.toString();
}

async function loadBranchStats() {
  const qs = getFilterParams();
  try {
    const res = await fetch(`/api/stats/branch/${BRANCH_ID}?${qs}`);
    const data = await res.json();
    if (data.status !== 'success') { toast(data.message,'error'); return; }
    document.getElementById('statRevenue').textContent = (data.stats.totalRevenue||0).toLocaleString('vi-VN')+'đ';
    document.getElementById('statTickets').textContent = data.stats.totalTickets||0;
    document.getElementById('filteredRevenue').textContent = (data.stats.totalRevenue||0).toLocaleString('vi-VN')+'đ';
    document.getElementById('filteredTickets').textContent = data.stats.totalTickets||0;
    // Charts
    if(chartRoute){chartRoute.destroy();} if(chartSeat){chartSeat.destroy();} if(chartMonth){chartMonth.destroy();}
    if(data.byRoute&&data.byRoute.length) { chartRoute=new Chart(document.getElementById('chartRoute'),{type:'bar',data:{labels:data.byRoute.map(d=>d.route),datasets:[{label:'Số vé',data:data.byRoute.map(d=>d.cnt),backgroundColor:'#667eea'}]},options:{responsive:true,plugins:{legend:{display:false}}}}); }
    if(data.bySeat&&data.bySeat.length) { chartSeat=new Chart(document.getElementById('chartSeat'),{type:'doughnut',data:{labels:data.bySeat.map(d=>d.SeatClass),datasets:[{data:data.bySeat.map(d=>d.cnt),backgroundColor:['#667eea','#764ba2']}]},options:{responsive:true}}); }
    if(data.byMonth&&data.byMonth.length) { chartMonth=new Chart(document.getElementById('chartMonth'),{type:'line',data:{labels:data.byMonth.map(d=>d.month),datasets:[{label:'Doanh thu',data:data.byMonth.map(d=>d.revenue),borderColor:'#667eea',fill:false,tension:0.3}]},options:{responsive:true}}); }
    // Ticket list
    const tbody = document.getElementById('branchTicketsBody');
    if(data.ticketList&&data.ticketList.length) {
      tbody.innerHTML = data.ticketList.map(t=>{
        const st=t.status||'paid';
        let badge=st==='cancelled'?'<span class="badge badge-danger">Đã hủy</span>':st==='pending'?'<span class="badge badge-warning">Chờ TT</span>':new Date(t.DepartureTime)>new Date()?'<span class="badge badge-info">Sắp KH</span>':'<span class="badge badge-success">Hoàn thành</span>';
        return `<tr data-search="${t.id} ${t.customerName||''}"><td>${t.id}</td><td>${t.customerName||'-'}</td><td>${t.DepartureStation} → ${t.Destination}</td><td>${t.SeatClass||'-'} (${t.SeatNumber||'-'})</td><td>${(t.price||0).toLocaleString('vi-VN')}đ</td><td>${badge}</td></tr>`;
      }).join('');
    } else { tbody.innerHTML='<tr><td colspan="6"><div class="empty-state"><h4>Không có vé nào</h4></div></td></tr>'; }
  } catch(err) { toast('Lỗi: '+err.message,'error'); }
}

function searchBranchTickets() {
  const val = document.getElementById('ticketSearch').value.toLowerCase().trim();
  document.querySelectorAll('#branchTicketsBody tr').forEach(row=>{
    const s=(row.getAttribute('data-search')||'').toLowerCase();
    row.style.display=(!val||s.includes(val))?'':'none';
  });
}

document.addEventListener('DOMContentLoaded', ()=>{ loadBranchStats(); });
