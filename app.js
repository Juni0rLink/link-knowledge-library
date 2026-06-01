// ============================================================
// DATA
// ============================================================
const USERS = {
  'owner@bmw.com':  { password: 'owner123',  name: 'Nguyễn Tuấn Phong', role: 'owner' },
  'admin@bmw.com':  { password: 'admin123',  name: 'Tran Thi B',    role: 'admin' },
  'editor@bmw.com': { password: 'editor123', name: 'Le Van C',       role: 'colleague' },
};

const ROLE_CFG = {
  owner:     { label: '👑 Owner',     cls: 'role-owner',     color: '#fbbf24', desc: 'Toàn quyền tuyệt đối trên platform' },
  admin:     { label: '🔑 Admin',     cls: 'role-admin',     color: '#3b82f6', desc: 'Quản lý thành viên, phân quyền, cập nhật tính năng' },
  colleague: { label: '👥 Colleague', cls: 'role-colleague', color: '#22c55e', desc: 'Xem, upload, chỉnh sửa nội dung' },
  viewer:    { label: '👁️ Viewer',    cls: 'role-viewer',    color: '#6b7280', desc: 'Chỉ xem trang Admin chỉ định công khai' },
};

let currentUser = null;
let loginAttempts = 0;
let lockUntil = 0;
const MAX_ATTEMPTS = 3;

let pendingRegs = [];

let newsItems = [
  { id: 1, title: 'Platform ra mắt chính thức', body: 'LINK Knowledge Library v1.0 chính thức hoạt động.', type: 'new', pinned: true, date: '01/06/2024', author: 'Nguyễn Tuấn Phong', isNew: true },
  { id: 2, title: 'GSC Training Portal tích hợp', body: 'Toàn bộ 10 modules GSC đã được tích hợp vào thư viện.', type: 'update', pinned: false, date: '01/06/2024', author: 'Nguyễn Tuấn Phong', isNew: true },
];
let unreadCount = newsItems.filter(function(n) { return n.isNew; }).length;

// ============================================================
// TABS
// ============================================================
function switchTab(tab) {
  ['login', 'register'].forEach(function(t) {
    document.getElementById('tab-' + t).classList.toggle('active', t === tab);
    document.getElementById('panel-' + t).classList.toggle('active', t === tab);
  });
}

// ============================================================
// LOGIN
// ============================================================
function doLogin() {
  var emailEl = document.getElementById('login-email');
  var passEl  = document.getElementById('login-pass');
  var btn     = document.getElementById('login-btn');
  var err     = document.getElementById('login-error');

  err.style.display = 'none';

  if (lockUntil > 0 && Date.now() < lockUntil) {
    var secs = Math.ceil((lockUntil - Date.now()) / 1000);
    err.textContent = 'Tài khoản bị khóa. Thử lại sau ' + secs + ' giây.';
    err.style.display = 'block';
    return;
  }

  var email = emailEl.value.trim().toLowerCase();
  var pass  = passEl.value;

  if (!email || !pass) {
    err.textContent = 'Vui lòng nhập đầy đủ email và mật khẩu';
    err.style.display = 'block';
    if (!email) emailEl.focus(); else passEl.focus();
    return;
  }

  var u = USERS[email];
  if (!u || u.password !== pass) {
    loginAttempts++;
    passEl.value = '';
    passEl.style.borderColor = '#ef4444';
    setTimeout(function() { passEl.style.borderColor = ''; }, 1500);
    var left = MAX_ATTEMPTS - loginAttempts;
    if (loginAttempts >= MAX_ATTEMPTS) {
      lockUntil = Date.now() + 30000;
      loginAttempts = 0;
      btn.disabled = true;
      var t = 30;
      var iv = setInterval(function() {
        t--;
        btn.textContent = 'Thử lại sau ' + t + 's';
        if (t <= 0) {
          clearInterval(iv);
          lockUntil = 0;
          btn.disabled = false;
          btn.textContent = 'Đăng nhập';
          err.style.display = 'none';
        }
      }, 1000);
      err.textContent = 'Sai ' + MAX_ATTEMPTS + ' lần - bị khóa 30 giây.';
    } else {
      err.textContent = 'Mật khẩu không đúng. Còn ' + left + ' lần thử.';
    }
    err.style.display = 'block';
    passEl.focus();
    return;
  }

  loginAttempts = 0;
  lockUntil = 0;
  passEl.style.borderColor = '';
  currentUser = { email: email, name: u.name, role: u.role };
  launchApp();
}

function viewerAccess() {
  currentUser = { email: null, name: 'Khách', role: 'viewer' };
  launchApp();
}

function doLogout() {
  currentUser = null;
  loginAttempts = 0;
  lockUntil = 0;
  var btn = document.getElementById('login-btn');
  if (btn) { btn.disabled = false; btn.textContent = 'Đăng nhập'; }
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-email').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-error').style.display = 'none';
  switchTab('login');
}

document.addEventListener('DOMContentLoaded', function() {
  var passEl = document.getElementById('login-pass');
  if (passEl) passEl.addEventListener('keydown', function(e) { if (e.key === 'Enter') doLogin(); });
});

// ============================================================
// REGISTER
// ============================================================
function doRegister() {
  var name   = document.getElementById('reg-name').value.trim();
  var email  = document.getElementById('reg-email').value.trim();
  var dept   = document.getElementById('reg-dept').value.trim();
  var reason = document.getElementById('reg-reason').value.trim();
  var err    = document.getElementById('reg-error');
  var ok     = document.getElementById('reg-success');

  err.style.display = 'none';
  ok.style.display = 'none';

  if (!name || !email || !dept) {
    err.textContent = 'Vui lòng điền đầy đủ Họ tên, Email và Bộ phận';
    err.style.display = 'block';
    return;
  }
  if (!email.includes('@')) {
    err.textContent = 'Email không hợp lệ';
    err.style.display = 'block';
    return;
  }

  var reg = { id: Date.now(), name: name, email: email, dept: dept, reason: reason, time: new Date().toLocaleString('vi-VN') };
  pendingRegs.push(reg);

  ok.textContent = 'Đã gửi yêu cầu! Admin sẽ xem xét và phản hồi qua email ' + email;
  ok.style.display = 'block';

  ['reg-name', 'reg-email', 'reg-dept', 'reg-reason'].forEach(function(id) {
    document.getElementById(id).value = '';
  });

  updateRegBadge();
}

// ============================================================
// LAUNCH APP
// ============================================================
function launchApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';

  var role = currentUser.role;
  var cfg  = ROLE_CFG[role];
  var isAdmin     = ['owner', 'admin'].includes(role);
  var isColleague = ['owner', 'admin', 'colleague'].includes(role);

  var av = document.getElementById('user-avatar');
  av.textContent = currentUser.name.charAt(0).toUpperCase();
  av.style.background = cfg.color;
  document.getElementById('user-name-display').textContent = currentUser.name;
  var rb = document.getElementById('role-badge-display');
  rb.textContent = cfg.label;
  rb.className = 'role-badge ' + cfg.cls;

  document.getElementById('welcome-name').textContent = currentUser.name;
  document.getElementById('welcome-desc').textContent = cfg.desc;

  var perms = {
    owner:     ['Xem tất cả nội dung', 'Chỉnh sửa & upload', 'Quản lý thành viên', 'Cấp quyền & cài đặt platform'],
    admin:     ['Xem tất cả nội dung', 'Chỉnh sửa & upload', 'Quản lý thành viên', 'Cấp quyền Admin (cần Admin khác xác nhận)'],
    colleague: ['Xem tất cả nội dung', 'Chỉnh sửa & upload tài liệu', 'File cá nhân riêng', 'Không thể quản lý thành viên'],
    viewer:    ['Chỉ xem trang Admin chỉ định', 'Không chỉnh sửa/upload', 'Không có file cá nhân'],
  };
  var ul = document.createElement('ul');
  ul.style.paddingLeft = '18px';
  (perms[role] || []).forEach(function(p) {
    var li = document.createElement('li');
    li.textContent = p;
    li.style.cssText = 'margin-bottom:5px;font-size:13px;';
    ul.appendChild(li);
  });
  var pl = document.getElementById('permission-list');
  if (pl) { pl.innerHTML = ''; pl.appendChild(ul); }

  var ok = '<span class="tag tag-green">Truy cập đầy đủ</span>';
  var no = '<span class="tag tag-red">Bị giới hạn</span>';
  ['acc-standards', 'acc-equipment', 'acc-videos'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = isColleague ? ok : no;
  });
  var am = document.getElementById('acc-myfiles');
  if (am) am.innerHTML = isColleague ? ok + ' (riêng tư)' : no;

  if (isAdmin) {
    var navAdmin = document.getElementById('nav-admin');
    if (navAdmin) navAdmin.style.display = 'flex';
    var navMod = document.getElementById('nav-modules');
    if (navMod) navMod.style.display = 'flex';
    renderModuleGroups();
    updateRegBadge();
  }

  if (!isAdmin) {
    var sNav = document.getElementById('nav-settings');
    if (sNav) {
      sNav.onclick = function() { showToast('Chỉ Admin mới vào được Cài đặt', 'warning'); };
    }
  }

  if (role === 'viewer') {
    var vn = document.getElementById('viewer-notice');
    if (vn) vn.style.display = 'block';
  }

  if (isColleague) {
    ['std-colleague', 'eq-colleague', 'vid-colleague', 'myfiles-colleague'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'block';
    });
  } else {
    ['std-viewer', 'myfiles-viewer'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'block';
    });
  }

  if (isAdmin) {
    var nc = document.getElementById('news-compose');
    if (nc) nc.style.display = 'block';
  }

  updateNewsDot();
  renderNews();
}

// ============================================================
// NAVIGATION
// ============================================================
function showPage(id, el) {
  var role = currentUser ? currentUser.role : 'viewer';
  var isAdmin = ['owner', 'admin'].includes(role);
  if ((id === 'admin' || id === 'settings') && !isAdmin) {
    showToast('Chỉ Admin mới vào được trang này', 'warning');
    return;
  }
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
  var pg = document.getElementById('page-' + id);
  if (pg) pg.classList.add('active');
  if (el) el.classList.add('active');
  document.querySelector('main').scrollTop = 0;
  if (id === 'news') markNewsRead();
}

// ============================================================
// ADMIN
// ============================================================
function updateRegBadge() {
  var n = pendingRegs.length;
  var badge = document.getElementById('reg-count-badge');
  var navBadge = document.getElementById('pending-badge');
  if (badge) { badge.textContent = n; badge.style.display = n > 0 ? 'inline' : 'none'; }
  if (navBadge) { navBadge.textContent = n; navBadge.style.display = n > 0 ? 'inline' : 'none'; }
  renderRegRequests();
}

function renderRegRequests() {
  var list = document.getElementById('reg-requests-list');
  if (!list) return;
  if (pendingRegs.length === 0) {
    list.innerHTML = '<p style="color:#aaa;font-style:italic;font-size:13px">Chưa có yêu cầu đăng ký nào.</p>';
    return;
  }
  list.innerHTML = pendingRegs.map(function(r) {
    return '<div class="reg-item" id="reg-' + r.id + '">' +
      '<div class="reg-name">' + r.name + '</div>' +
      '<div class="reg-detail">' + r.email + ' | ' + r.dept + '</div>' +
      '<div class="reg-detail">' + r.time + '</div>' +
      '<div class="reg-actions">' +
      '<span style="font-size:12px;font-weight:600">Phân quyền:</span>' +
      '<select class="assign-select" id="role-sel-' + r.id + '">' +
      '<option value="colleague">Colleague</option>' +
      '<option value="viewer">Viewer</option>' +
      '<option value="admin">Admin (can duyet)</option>' +
      '</select>' +
      '<button class="btn-sm approve-btn" onclick="acceptReg(' + r.id + ')">Chấp nhận</button>' +
      '<button class="btn-sm reject-btn" onclick="rejectReg(' + r.id + ')">Từ chối</button>' +
      '</div></div>';
  }).join('');
}

function acceptReg(id) {
  var reg = pendingRegs.find(function(r) { return r.id === id; });
  if (!reg) return;
  var roleSel = document.getElementById('role-sel-' + id);
  var chosenRole = roleSel ? roleSel.value : 'colleague';
  addMemberRow(reg.name, reg.email, chosenRole);
  showToast('Đã cấp quyền cho ' + reg.name, 'success');
  pendingRegs = pendingRegs.filter(function(r) { return r.id !== id; });
  updateRegBadge();
}

function rejectReg(id) {
  var reg = pendingRegs.find(function(r) { return r.id === id; });
  pendingRegs = pendingRegs.filter(function(r) { return r.id !== id; });
  showToast('Đã từ chối yêu cầu của ' + (reg ? reg.name : ''), 'error');
  updateRegBadge();
}

function addMemberRow(name, email, role) {
  var cfg = ROLE_CFG[role] || ROLE_CFG.colleague;
  var container = document.getElementById('member-rows');
  if (!container) return;
  var tr = document.createElement('tr');
  tr.innerHTML = '<td>' + name + '</td><td>' + email + '</td>' +
    '<td><span class="role-badge ' + cfg.cls + '">' + cfg.label + '</span></td>' +
    '<td>Active</td>' +
    '<td><button class="btn-sm reject-btn" onclick="this.closest(\'tr\').remove();showToast(\'Đã xóa\',\'error\')">Xóa</button></td>';
  container.appendChild(tr);
}

function sendInvite() {
  var email = document.getElementById('invite-email').value.trim();
  var role  = document.getElementById('invite-role').value;
  if (!email) { showToast('Vui lòng nhập email', 'warning'); return; }
  showToast('Đã gửi lời mời ' + role + ' tới ' + email, 'success');
  document.getElementById('invite-email').value = '';
}

// ============================================================
// NEWS
// ============================================================
function renderNews() {
  var list = document.getElementById('news-list');
  if (!list) return;
  var sorted = newsItems.slice().sort(function(a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0); });
  list.innerHTML = sorted.map(function(n) {
    return '<div class="news-item ' + (n.pinned ? 'pinned' : '') + '">' +
      '<div class="news-header">' +
      (n.pinned ? '<span>📌</span>' : '') +
      '<div class="news-title">' + n.title + '</div>' +
      (n.isNew ? '<span class="tag tag-green" style="font-size:10px">MOI</span>' : '') +
      '</div>' +
      '<div class="news-body">' + n.body + '</div>' +
      '<div style="margin-top:8px;font-size:11px;color:#aaa;">' + n.date + ' - ' + n.author + '</div>' +
      '</div>';
  }).join('') || '<p style="color:#aaa">Chưa có thông báo.</p>';
}

function postNews() {
  var title = document.getElementById('news-title-inp').value.trim();
  var body  = document.getElementById('news-body-inp').value.trim();
  var type  = document.getElementById('news-type-sel').value;
  var pin   = document.getElementById('news-pin').checked;
  if (!title || !body) { showToast('Vui lòng nhập tiêu đề và nội dung', 'warning'); return; }
  newsItems.unshift({ id: Date.now(), title: title, body: body, type: type, pinned: pin,
    date: new Date().toLocaleDateString('vi-VN'), author: currentUser.name, isNew: true });
  document.getElementById('news-title-inp').value = '';
  document.getElementById('news-body-inp').value = '';
  document.getElementById('news-pin').checked = false;
  renderNews();
  updateNewsDot();
  showToast('Đã đăng thông báo', 'success');
}

function updateNewsDot() {
  var dot = document.getElementById('news-dot');
  if (dot) dot.style.display = unreadCount > 0 ? 'block' : 'none';
}

function markNewsRead() {
  newsItems.forEach(function(n) { n.isNew = false; });
  unreadCount = 0;
  updateNewsDot();
  renderNews();
}

// ============================================================
// UTILS
// ============================================================
function showToast(msg, type) {
  type = type || 'success';
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show ' + type;
  clearTimeout(window._tt);
  window._tt = setTimeout(function() { t.className = ''; }, 3500);
}

// ============================================================
// FILE MANAGEMENT
// ============================================================
var userFiles = [];

function renderFiles() {
  var list = document.getElementById('file-list');
  if (!list) return;
  if (userFiles.length === 0) {
    list.innerHTML = '<p style="color:#aaa;font-style:italic">Chưa có file nào. Upload file đầu tiên bên dưới.</p>';
    return;
  }
  list.innerHTML = userFiles.map(function(f) {
    return '<div style="display:flex;align-items:center;gap:10px;padding:10px;border:1px solid #eee;border-radius:8px;margin-bottom:8px;">' +
      '<span style="font-size:20px">' + getFileIcon(f.type) + '</span>' +
      '<div style="flex:1"><div style="font-weight:600;font-size:13px">' + f.name + '</div>' +
      '<div style="font-size:11px;color:#888">' + f.size + ' · ' + f.date + ' · ' + f.author + '</div></div>' +
      '<button class="btn-sm" style="background:#fee2e2;color:#ef4444;border:none;cursor:pointer" onclick="deleteFile(' + f.id + ')">Xóa</button>' +
      '</div>';
  }).join('');
}

function getFileIcon(type) {
  if (type.includes('pdf')) return '📄';
  if (type.includes('image')) return '🖼️';
  if (type.includes('video')) return '🎬';
  if (type.includes('sheet') || type.includes('excel')) return '📊';
  if (type.includes('presentation') || type.includes('powerpoint')) return '📑';
  return '📁';
}

function handleFileUpload(input) {
  var files = input.files;
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    var size = f.size > 1024*1024 ? (f.size/1024/1024).toFixed(1)+'MB' : (f.size/1024).toFixed(0)+'KB';
    userFiles.push({
      id: Date.now() + i,
      name: f.name,
      type: f.type,
      size: size,
      date: new Date().toLocaleDateString('vi-VN'),
      author: currentUser ? currentUser.name : 'Không rõ',
      url: URL.createObjectURL(f)
    });
  }
  renderFiles();
  showToast('Đã upload ' + files.length + ' file thành công', 'success');
  input.value = '';
}

function deleteFile(id) {
  userFiles = userFiles.filter(function(f) { return f.id !== id; });
  renderFiles();
  showToast('Đã xóa file', 'error');
}

// ============================================================
// MODULE MANAGER
// ============================================================
var moduleGroups = [
  { id:1, icon:'📚', name:'BMW Standards', modules:[
    { id:101, icon:'🔷', name:'GSC – Group Standard Controls' },
    { id:102, icon:'🏭', name:'TKB – Body Shop' },
    { id:103, icon:'🔧', name:'TMO – Assembly' },
  ]},
  { id:2, icon:'🛡️', name:'Safety & Compliance', modules:[
    { id:201, icon:'🛡️', name:'Safety General' },
    { id:202, icon:'⚡', name:'E-STOP & Zone Concept' },
  ]},
  { id:3, icon:'⚙️', name:'Tools & Software', modules:[
    { id:301, icon:'⚙️', name:'SAS – System Architecture' },
    { id:302, icon:'💻', name:'TIA Portal V18' },
  ]},
  { id:4, icon:'🔬', name:'Advanced Modules', modules:[
    { id:401, icon:'🔄', name:'Phase Concept & Resequencing' },
    { id:402, icon:'📊', name:'User Sequence' },
    { id:403, icon:'🗂️', name:'Type Management' },
  ]},
];

function renderModuleGroups() {
  var c = document.getElementById('module-groups-container');
  if (!c) return;
  c.innerHTML = moduleGroups.map(function(g) {
    return '<div style="background:#fff;border-radius:10px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,.07);overflow:hidden">' +
      '<div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:#f8f9fb;border-bottom:1px solid #eee">' +
      '<span style="font-size:18px">' + g.icon + '</span>' +
      '<span style="font-weight:700;font-size:14px;flex:1" id="gname-' + g.id + '">' + g.name + '</span>' +
      '<button class="btn-sm" style="background:#e8f0fd;color:#0653b6;border:none;cursor:pointer" onclick="editGroupName(' + g.id + ')">✏️ Đổi tên nhóm</button>' +
      '<button class="btn-sm reject-btn" style="margin-left:6px" onclick="deleteGroup(' + g.id + ')">🗑️ Xóa</button>' +
      '</div>' +
      g.modules.map(function(m) {
        return '<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid #f0f0f0">' +
          '<span>' + m.icon + '</span>' +
          '<span style="flex:1;font-size:13px" id="mname-' + m.id + '">' + m.name + '</span>' +
          '<button class="btn-sm" style="background:#e8f0fd;color:#0653b6;border:none;cursor:pointer" onclick="editModuleName(' + g.id + ',' + m.id + ')">✏️</button>' +
          '<button class="btn-sm reject-btn" style="margin-left:4px" onclick="deleteModule(' + g.id + ',' + m.id + ')">🗑️</button>' +
          '</div>';
      }).join('') +
      '<div style="display:flex;gap:8px;padding:10px 16px;background:#fafafa">' +
      '<input class="form-input" id="mod-inp-' + g.id + '" placeholder="Tên module mới..." style="flex:1;padding:7px 10px">' +
      '<button class="btn btn-primary" style="width:auto;padding:0 14px" onclick="addModule(' + g.id + ')">+ Thêm</button>' +
      '</div></div>';
  }).join('');
}

function editGroupName(gid) {
  var el = document.getElementById('gname-' + gid);
  var cur = el.textContent;
  var inp = document.createElement('input');
  inp.className = 'form-input'; inp.value = cur; inp.style.cssText='padding:4px 8px;width:200px';
  inp.onblur = function() {
    var g = moduleGroups.find(function(g){return g.id===gid;});
    if (g && inp.value.trim()) g.name = inp.value.trim();
    renderModuleGroups();
    showToast('Đã đổi tên nhóm', 'success');
  };
  inp.onkeydown = function(e){ if(e.key==='Enter') inp.blur(); };
  el.replaceWith(inp); inp.focus(); inp.select();
}

function editModuleName(gid, mid) {
  var el = document.getElementById('mname-' + mid);
  var cur = el.textContent;
  var inp = document.createElement('input');
  inp.className = 'form-input'; inp.value = cur; inp.style.cssText='padding:4px 8px;width:200px';
  inp.onblur = function() {
    var g = moduleGroups.find(function(g){return g.id===gid;});
    var m = g && g.modules.find(function(m){return m.id===mid;});
    if (m && inp.value.trim()) m.name = inp.value.trim();
    renderModuleGroups();
    showToast('Đã đổi tên module', 'success');
  };
  inp.onkeydown = function(e){ if(e.key==='Enter') inp.blur(); };
  el.replaceWith(inp); inp.focus(); inp.select();
}

function addModule(gid) {
  var inp = document.getElementById('mod-inp-' + gid);
  if (!inp || !inp.value.trim()) { showToast('Nhập tên module', 'warning'); return; }
  var g = moduleGroups.find(function(g){return g.id===gid;});
  g.modules.push({ id: Date.now(), icon: '📋', name: inp.value.trim() });
  renderModuleGroups();
  showToast('Đã thêm module: ' + inp.value.trim(), 'success');
}

function deleteModule(gid, mid) {
  var g = moduleGroups.find(function(g){return g.id===gid;});
  var m = g && g.modules.find(function(m){return m.id===mid;});
  if (!confirm('Xóa module "' + (m?m.name:'') + '"?')) return;
  g.modules = g.modules.filter(function(m){return m.id!==mid;});
  renderModuleGroups();
  showToast('Đã xóa module', 'error');
}

function deleteGroup(gid) {
  var g = moduleGroups.find(function(g){return g.id===gid;});
  if (!confirm('Xóa nhóm "' + (g?g.name:'') + '" và toàn bộ modules?')) return;
  moduleGroups = moduleGroups.filter(function(g){return g.id!==gid;});
  renderModuleGroups();
  showToast('Đã xóa nhóm', 'error');
}

function addGroup() {
  var inp = document.getElementById('new-group-name');
  if (!inp || !inp.value.trim()) { showToast('Nhập tên nhóm', 'warning'); return; }
  moduleGroups.push({ id: Date.now(), icon: '📂', name: inp.value.trim(), modules: [] });
  inp.value = '';
  renderModuleGroups();
  showToast('Đã tạo nhóm mới', 'success');
}
