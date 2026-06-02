// Shared UI utilities for all dashboards
function toast(message, type='success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

function showConfirm(message, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.innerHTML = `
    <div class="confirm-box">
      <h4>Xác nhận</h4>
      <p>${message}</p>
      <div class="confirm-actions">
        <button class="btn btn-secondary" id="cfNo">Hủy</button>
        <button class="btn btn-danger" id="cfYes">Đồng ý</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#cfNo').onclick = () => overlay.remove();
  overlay.querySelector('#cfYes').onclick = () => { overlay.remove(); onConfirm(); };
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.querySelector('.mobile-overlay').classList.toggle('active');
}

function navTo(hash) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.menu li').forEach(l => l.classList.remove('active'));
  const target = document.querySelector(hash);
  if (target) target.classList.add('active');
  const link = document.querySelector(`.menu a[href="${hash}"]`);
  if (link) link.closest('li').classList.add('active');
  if (window.innerWidth <= 768) toggleSidebar();
  return false;
}
