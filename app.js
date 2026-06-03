
// ============================================================
// FIREBASE CONFIG
// ============================================================
var FB_URL = 'https://link-knowledge-library-default-rtdb.asia-southeast1.firebasedatabase.app';
var FB_API_KEY = 'AIzaSyBiRVWULX1TO_S3E31KAy5wK6k7aZdmhv0';
var FB_AUTH_URL = 'https://identitytoolkit.googleapis.com/v1/accounts';

// ── AUTH REST API ──
function fbSignIn(email, password, cb) {
  fetch(FB_AUTH_URL + ':signInWithPassword?key=' + FB_API_KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, password: password, returnSecureToken: true })
  }).then(function(r){ return r.json(); }).then(function(d){ cb(null, d); }).catch(function(e){ cb(e, null); });
}

function fbSignUp(email, password, cb) {
  fetch(FB_AUTH_URL + ':signUp?key=' + FB_API_KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, password: password, returnSecureToken: true })
  }).then(function(r){ return r.json(); }).then(function(d){ cb(null, d); }).catch(function(e){ cb(e, null); });
}

function fbResetPassword(email, cb) {
  fetch(FB_AUTH_URL + ':sendOobCode?key=' + FB_API_KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestType: 'PASSWORD_RESET', email: email })
  }).then(function(r){ return r.json(); }).then(function(d){ cb(null, d); }).catch(function(e){ cb(e, null); });
}

function fbGet(path, cb) {
  fetch(FB_URL + path + '.json')
    .then(function(r){ return r.json(); })
    .then(function(d){ cb(null, d); })
    .catch(function(e){ cb(e, null); });
}

function fbSet(path, data, cb) {
  fetch(FB_URL + path + '.json', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(function(r){ return r.json(); })
    .then(function(d){ if(cb) cb(null, d); })
    .catch(function(e){ if(cb) cb(e, null); });
}

function fbPush(path, data, cb) {
  fetch(FB_URL + path + '.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(function(r){ return r.json(); })
    .then(function(d){ if(cb) cb(null, d); })
    .catch(function(e){ if(cb) cb(e, null); });
}

function fbDelete(path, cb) {
  fetch(FB_URL + path + '.json', { method: 'DELETE' })
    .then(function(){ if(cb) cb(null); })
    .catch(function(e){ if(cb) cb(e); });
}

// Load all shared data from Firebase
function fbLoadAll(onDone) {
  fbGet('/shared', function(err, data) {
    if (err || !data) { if(onDone) onDone(); return; }
    if (data.news && Array.isArray(data.news)) newsItems = data.news;
    if (data.sharedDocs && Array.isArray(data.sharedDocs)) sharedDocs = data.sharedDocs;
    if (data.sharedSheets && Array.isArray(data.sharedSheets)) sharedSheets = data.sharedSheets;
    if (data.sharedFiles && Array.isArray(data.sharedFiles)) { sharedFiles = data.sharedFiles; }
    if (data.sharedNote) sharedNote = data.sharedNote;
    if (data.moduleGroups && Array.isArray(data.moduleGroups)) moduleGroups = data.moduleGroups;
    if (data.publicFiles && Array.isArray(data.publicFiles)) publicFiles = data.publicFiles;
    if(onDone) onDone();
  });
}

// Save shared data to Firebase
function fbSaveNews()         { fbSet('/shared/news', news); }
function fbSaveSharedDocs()   { fbSet('/shared/sharedDocs', sharedDocs); }
function fbSaveSharedSheets() { fbSet('/shared/sharedSheets', sharedSheets); }
function fbSaveSharedFiles()  { fbSet('/shared/sharedFiles', sharedFiles); }
function fbSaveSharedNote()   { fbSet('/shared/sharedNote', sharedNote); }
function fbSaveModules()      { fbSet('/shared/moduleGroups', moduleGroups); }
function fbSavePublicFiles()  { fbSet('/shared/publicFiles', publicFiles); }

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

  var email = emailEl.value.trim().toLowerCase();
  var pass  = passEl.value;
  if (!email || !pass) {
    err.textContent = 'Vui lòng nhập đầy đủ email và mật khẩu';
    err.style.display = 'block';
    return;
  }

  // Check demo accounts first (fallback)
  var u = USERS[email];
  if (u && u.password === pass) {
    currentUser = { email: email, name: u.name, role: u.role };
    launchApp();
    return;
  }

  // Firebase Auth
  btn.disabled = true;
  btn.textContent = '⏳ Đang đăng nhập...';
  fbSignIn(email, pass, function(e, data) {
    btn.disabled = false;
    btn.textContent = 'Đăng nhập';
    if (e || data.error) {
      var code = data && data.error && data.error.message;
      if (code === 'EMAIL_NOT_FOUND' || code === 'INVALID_PASSWORD' || code === 'INVALID_LOGIN_CREDENTIALS') {
        err.textContent = 'Email hoặc mật khẩu không đúng.';
      } else if (code === 'USER_DISABLED') {
        err.textContent = 'Tài khoản đã bị vô hiệu hóa. Liên hệ Admin.';
      } else if (code === 'TOO_MANY_ATTEMPTS_TRY_LATER') {
        err.textContent = 'Đăng nhập thất bại quá nhiều lần. Thử lại sau.';
      } else {
        err.textContent = 'Lỗi đăng nhập. Vui lòng thử lại.';
      }
      err.style.display = 'block';
      passEl.value = '';
      return;
    }
    // Load user profile from Firebase DB
    var uid = data.localId;
    fbGet('/users/' + uid, function(e2, profile) {
      if (profile && profile.role) {
        currentUser = { email: email, name: profile.name || email, role: profile.role, uid: uid };
      } else {
        // New user — pending approval
        currentUser = { email: email, name: email.split('@')[0], role: 'viewer', uid: uid };
      }
      launchApp();
    });
  });
}

function forgotPassword() {
  var email = document.getElementById('login-email').value.trim();
  if (!email) {
    showToast('Nhập email vào ô trên trước', 'warning');
    document.getElementById('login-email').focus();
    return;
  }
  fbResetPassword(email, function(e, data) {
    if (e || data.error) {
      showToast('Không tìm thấy email này', 'error');
    } else {
      showToast('✅ Đã gửi email reset password tới ' + email, 'success');
    }
  });
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
  var email  = document.getElementById('reg-email').value.trim().toLowerCase();
  var dept   = document.getElementById('reg-dept').value.trim();
  var reason = document.getElementById('reg-reason').value.trim();
  var pass   = document.getElementById('reg-pass') ? document.getElementById('reg-pass').value : '';
  var err    = document.getElementById('reg-error');
  var ok     = document.getElementById('reg-success');
  err.style.display = 'none'; ok.style.display = 'none';

  if (!name || !email || !dept || !pass) {
    err.textContent = 'Vui lòng điền đầy đủ tất cả các trường';
    err.style.display = 'block'; return;
  }
  if (pass.length < 6) {
    err.textContent = 'Mật khẩu tối thiểu 6 ký tự';
    err.style.display = 'block'; return;
  }

  var regBtn = document.getElementById('reg-btn');
  if (regBtn) { regBtn.disabled = true; regBtn.textContent = '⏳ Đang xử lý...'; }

  fbSignUp(email, pass, function(e, data) {
    if (regBtn) { regBtn.disabled = false; regBtn.textContent = 'Gửi yêu cầu'; }
    if (e || data.error) {
      var code = data && data.error && data.error.message;
      if (code === 'EMAIL_EXISTS') {
        err.textContent = 'Email này đã có tài khoản. Vui lòng đăng nhập.';
      } else {
        err.textContent = 'Lỗi đăng ký: ' + (code || 'thử lại sau');
      }
      err.style.display = 'block'; return;
    }
    var uid = data.localId;
    // Save profile to DB as pending
    var profile = { name: name, email: email, dept: dept, reason: reason, role: 'viewer', status: 'pending', time: new Date().toLocaleString('vi-VN') };
    fbSet('/users/' + uid, profile);
    // Add to pending registrations list
    var reg = { id: uid, name: name, email: email, dept: dept, reason: reason, time: new Date().toLocaleString('vi-VN') };
    pendingRegs.push(reg);
    fbSet('/shared/pendingRegs', pendingRegs);
    updateRegBadge();

    ok.textContent = '✅ Đăng ký thành công! Admin sẽ phê duyệt và cấp quyền cho ' + email;
    ok.style.display = 'block';
    ['reg-name','reg-email','reg-dept','reg-reason'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
    if (document.getElementById('reg-pass')) document.getElementById('reg-pass').value = '';
  });
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
    renderModuleGroups(); syncSidebarModules();
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

  // Load shared data from Firebase then render
  fbLoadAll(function() {
    renderNews();
    renderSharedDocs();
    renderSharedSheets();
    renderSharedFiles();
    if (isAdmin) { renderModuleGroups(); syncSidebarModules(); }
  });

  renderVideos();
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

  if (isColleague) {
    setTimeout(function(){ renderStorageWidget('home-storage-widget'); }, 100);
  }
}

// ============================================================
// KNOWLEDGE SEARCH
// ============================================================
var searchIndex = null;

function loadSearchIndex(cb) {
  if (searchIndex) { cb(searchIndex); return; }
  fetch('search-index.json')
    .then(function(r){return r.json();})
    .then(function(data){ searchIndex = data; cb(data); })
    .catch(function(){ cb([]); });
}

function doKnowledgeSearch() {
  var q = document.getElementById('ks-input').value.trim().toLowerCase();
  var results = document.getElementById('ks-results');
  if (!q) { results.innerHTML = '<p style="color:#aaa;text-align:center;padding:20px">Nhập từ khóa để tìm kiếm...</p>'; return; }
  results.innerHTML = '<p style="color:#888;padding:12px">⏳ Đang tìm...</p>';
  loadSearchIndex(function(idx) {
    var words = q.split(/\s+/).filter(Boolean);
    var scored = idx.map(function(item) {
      var t = item.text.toLowerCase();
      var s = item.source.toLowerCase();
      var score = 0;
      words.forEach(function(w){ if(t.includes(w)) score += 2; if(s.includes(w)) score += 1; });
      return { item: item, score: score };
    }).filter(function(x){ return x.score > 0; })
      .sort(function(a,b){ return b.score - a.score; })
      .slice(0, 15);
    if (!scored.length) {
      results.innerHTML = '<div style="text-align:center;padding:30px;color:#aaa"><div style="font-size:36px;margin-bottom:8px">🔍</div><p>Không tìm thấy kết quả cho <strong>"'+q+'"</strong></p><p style="font-size:12px;margin-top:6px">Thử từ khóa khác: E-STOP, TYPE_DECO, SAS, safety zone...</p></div>';
      return;
    }
    var html = '<div style="font-size:12px;color:#888;margin-bottom:12px">Tìm thấy <strong>'+scored.length+'</strong> kết quả cho "<strong>'+q+'</strong>"</div>';
    scored.forEach(function(r) {
      var item = r.item;
      var fileUrl = 'https://juni0rlink.github.io/link-knowledge-library/content/' + encodeURIComponent(item.file);
      var viewUrl = 'https://view.officeapps.live.com/op/view.aspx?src=' + encodeURIComponent(fileUrl);
      var excerpt = item.text;
      words.forEach(function(w){
        var re = new RegExp('('+w+')', 'gi');
        excerpt = excerpt.replace(re, '<mark style="background:#fef08a;padding:0 2px;border-radius:2px">$1</mark>');
      });
      excerpt = excerpt.slice(0, 300) + (excerpt.length > 300 ? '...' : '');
      html += '<div style="background:#fff;border-radius:10px;border:1px solid #e5e7eb;padding:14px 16px;margin-bottom:10px">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
        '<span style="font-size:11px;font-weight:700;background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:10px">'+item.source+'</span>' +
        '<span style="font-size:11px;color:#888">'+item.page+'</span>' +
        '<div style="margin-left:auto;display:flex;gap:6px">' +
        '<a href="'+viewUrl+'" target="_blank" style="font-size:11px;background:#e0f2fe;color:#0369a1;padding:3px 8px;border-radius:6px;text-decoration:none;font-weight:700">👁️ Xem</a>' +
        '<a href="'+fileUrl+'" download style="font-size:11px;background:#dcfce7;color:#15803d;padding:3px 8px;border-radius:6px;text-decoration:none;font-weight:700">⬇️ Tải</a>' +
        '</div></div>' +
        '<div style="font-size:13px;color:#333;line-height:1.6">'+excerpt+'</div>' +
        '</div>';
    });
    results.innerHTML = html;
  });
}

// ============================================================
// NAVIGATION
// ============================================================
function showPage(id, el) {
  var role = currentUser ? currentUser.role : 'viewer';
  var isAdmin = ['owner', 'admin'].includes(role);
  var adminOnly = ['admin', 'settings', 'modules', 'trash'];
  if (adminOnly.includes(id) && !isAdmin) {
    showToast('Chỉ Admin & Owner mới vào được trang này', 'warning');
    return;
  }
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
  var pg = document.getElementById('page-' + id);
  if (pg) pg.classList.add('active');
  if (el) el.classList.add('active');
  if (document.querySelector('main')) document.querySelector('main').scrollTop = 0;
  // Page init calls
  if (id === 'news') markNewsRead();
  if (id === 'modules') { renderModuleGroups(); syncSidebarModules(); }
  if (id === 'trash') { renderTrash(); renderStorageWidget(); }
  if (id === 'files') { renderSharedDocs(); renderSharedSheets(); renderSharedFileList(); }
  if (id === 'myfiles') { renderPersonalDocs(); renderPersonalSheets(); renderPersonalFiles(); }
  if (id === 'admin') { renderRegRequests(); }
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
      (n.pinned ? '<span>Ὄc</span>' : '') +
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
  fbSet('/shared/news', newsItems);
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
  if (type.includes('pdf')) return 'Ὄ4';
  if (type.includes('image')) return 'Ὓc️';
  if (type.includes('video')) return 'Ἲc';
  if (type.includes('sheet') || type.includes('excel')) return 'Ὄa';
  if (type.includes('presentation') || type.includes('powerpoint')) return 'Ὅ1';
  return 'Ὄ1';
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
var BASE_URL = 'https://juni0rlink.github.io/link-knowledge-library/content/';
var OFFICE_VIEW = 'https://view.officeapps.live.com/op/view.aspx?src=';

var MODULE_DOCS = {
  101: {
    desc: 'GSC (Group Standard Controls) — tiêu chuẩn phần mềm PLC cho toàn bộ dây chuyền LINK Group.',
    files: [
      { name:'GSC Software Structure', file:'GSC Software structure.pptx', icon:'🏗️', desc:'Kiến trúc tổng thể phần mềm GSC' },
      { name:'GSC Phase Concept', file:'GSC Module Phase concept.pptx', icon:'🔄', desc:'Cấu trúc Phase, RESEQ, Sequencer' },
      { name:'GSC User Sequence', file:'GSC Module User sequence.pptx', icon:'📋', desc:'User sequence logic' },
      { name:'GSC Type Management', file:'GSC Type management.pptx', icon:'🗂️', desc:'TYPE_DECO_FB, decode/generate data' },
    ]
  },
  201: {
    desc: 'Tổng quan an toàn — F-runtime, zone concept, safety program.',
    files: [
      { name:'GSC Module Safety', file:'GSC Module Safety.pptx', icon:'🛡️', desc:'Safety program, F-runtime group, zone concept' },
      { name:'Overview Basic Concept Safety', file:'Overview Basic Concept Safety_Nguyễn Tuấn Phong.pptx', icon:'📖', desc:'Operating modes, MDB, component blocks' },
    ]
  },
  202: {
    desc: 'E-STOP procedure và zone concept trong hệ thống GSC.',
    files: [
      { name:'GSC Module Safety', file:'GSC Module Safety.pptx', icon:'⚡', desc:'E-STOP, safe actuators, zone concept' },
    ]
  },
  301: {
    desc: 'SAS (System Architecture Software) — cấu hình fixture và hardware trong SAS.',
    files: [
      { name:'GSC Module SAS', file:'GSC Module SAS.pptx', icon:'⚙️', desc:'Working with Fixture in SAS, hardware config' },
    ]
  },
  401: {
    desc: 'Phase Concept & Resequencing — cấu trúc sequencer, RESEQ, network structure.',
    files: [
      { name:'GSC Module Phase Concept', file:'GSC Module Phase concept.pptx', icon:'🔄', desc:'RESEQ sequencer, phase parameterization' },
    ]
  },
  402: {
    desc: 'User Sequence — logic điều khiển user sequence trong GSC.',
    files: [
      { name:'GSC Module User Sequence', file:'GSC Module User sequence.pptx', icon:'📊', desc:'User sequence structure and logic' },
    ]
  },
  403: {
    desc: 'Type Management — TYPE_DECO_FB, UDB, decode/generate data functions.',
    files: [
      { name:'GSC Type Management', file:'GSC Type management.pptx', icon:'🗂️', desc:'TYPE_DECO_FB, decode/generate, UDB blocks' },
    ]
  },
  501: {
    desc: 'Operation Manual tổng quan — A1HG01 Housing Cluster, BMW Plant Irlbach-Strasskirchen.',
    files: [
      { name:'Cover Page', file:'MAN_00101_Manual_Cover.docx', icon:'📄', desc:'Customer: BMW AG, Plant 2.6 Irlbach' },
      { name:'General Information', file:'MAN_00201_Manual_General.docx', icon:'📋', desc:'Electrical documentation, technical data' },
      { name:'LINE Overview', file:'MAN_00301_Manual_LINE.docx', icon:'🏭', desc:'GSC hardware/software, TIA CPU1518F, Profinet Safety' },
      { name:'PLC Overview', file:'MAN_00401_Manual_PLC.docx', icon:'💻', desc:'Production line process, Acrylic ST030-032, UV ST050' },
    ]
  },
  502: {
    desc: 'Safety Gates SG01–SG06 — Conveyor stations ST700, ST710, ST711, ST712, ST030, ST031.',
    files: [
      { name:'SG01 – ST700', file:'MAN_00501_Manual_SG01.docx', icon:'🔲', desc:'Layout Conveyor ST700 — transmission only' },
      { name:'SG02 – ST710', file:'MAN_00601_Manual_SG02.docx', icon:'🔲', desc:'Layout Conveyor ST710 — transmission only' },
      { name:'SG04 – ST711', file:'MAN_00602_Manual_SG04.docx', icon:'🔲', desc:'Layout Conveyor ST711 — transmission only' },
      { name:'SG06 – ST712', file:'MAN_00603_Manual_SG06.docx', icon:'🔲', desc:'Layout Conveyor ST712 — transmission only' },
      { name:'SG03 – ST030', file:'MAN_00701_Manual_SG03.docx', icon:'🔧', desc:'Acrylic station, dual PLC coordination' },
      { name:'SG05 – ST031', file:'MAN_00702_Manual_SG05.docx', icon:'🔧', desc:'Acrylic station ST031, PNPN signal' },
    ]
  },
  503: {
    desc: 'Safety Gates SG07–SG12 — Conveyor stations ST032, ST719, ST720, ST050, ST730, ST739.',
    files: [
      { name:'SG07 – ST032', file:'MAN_00703_Manual_SG07.docx', icon:'🔧', desc:'Acrylic station ST032, dual PLC' },
      { name:'SG08 – ST719', file:'MAN_00801_Manual_SG08.docx', icon:'🔲', desc:'Take in transmission lines ST719' },
      { name:'SG09 – ST720', file:'MAN_00901_Manual_SG09.docx', icon:'🔲', desc:'Conveyor ST720 — transmission only' },
      { name:'SG10 – ST050', file:'MAN_01001_Manual_SG10.docx', icon:'💡', desc:'UV Station — Puck test, ICAD measurement, UV curing' },
      { name:'SG11 – ST730', file:'MAN_01101_Manual_SG11.docx', icon:'🔲', desc:'Conveyor ST730 — transmission only' },
      { name:'SG12 – ST739', file:'MAN_01201_Manual_SG12.docx', icon:'🔲', desc:'Take In/Out transmission lines ST739' },
    ]
  },
};

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
  { id:5, icon:'📘', name:'Operation Manual A1HG01', modules:[
    { id:501, icon:'📋', name:'General & Overview' },
    { id:502, icon:'🔲', name:'Safety Gates SG01–SG06' },
    { id:503, icon:'🔲', name:'Safety Gates SG07–SG12' },
  ]},
];
function renderModuleGroups() {
  var c = document.getElementById('module-groups-container');
  if (!c) return;
  c.innerHTML = moduleGroups.map(function(g) {
    return '<div style="background:#fff;border-radius:10px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,.07);overflow:hidden">' +
      '<div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:#f8f9fb;border-bottom:1px solid #eee">' +
      '<span style="font-size:18px;cursor:pointer;border-radius:6px;padding:2px" title="Bấm để đổi icon" onclick="pickGroupIcon('+g.id+',this)">' + g.icon + '</span>' +
      '<span style="font-weight:700;font-size:14px;flex:1" id="gname-' + g.id + '">' + g.name + '</span>' +
      '<button class="btn-sm" style="background:#e8f0fd;color:#0653b6;border:none;cursor:pointer" onclick="editGroupName(' + g.id + ')">✏️ Đổi tên nhóm</button>' +
      '<button class="btn-sm reject-btn" style="margin-left:6px" onclick="deleteGroup(' + g.id + ')">🗑️ Xóa</button>' +
      '</div>' +
      g.modules.map(function(m) {
        return '<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid #f0f0f0">' +
          '<span style="cursor:pointer;border-radius:4px;padding:1px" title="Bấm để đổi icon" onclick="pickModuleIcon('+g.id+','+m.id+',this)">' + m.icon + '</span>' +
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
    renderModuleGroups(); syncSidebarModules();
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
    renderModuleGroups(); syncSidebarModules();
    showToast('Đã đổi tên module', 'success');
  };
  inp.onkeydown = function(e){ if(e.key==='Enter') inp.blur(); };
  el.replaceWith(inp); inp.focus(); inp.select();
}

function addModule(gid) {
  var inp = document.getElementById('mod-inp-' + gid);
  if (!inp || !inp.value.trim()) { showToast('Nhập tên module', 'warning'); return; }
  var g = moduleGroups.find(function(g){return g.id===gid;});
  g.modules.push({ id: Date.now(), icon: 'Ὄb', name: inp.value.trim() });
  renderModuleGroups(); syncSidebarModules();
  showToast('Đã thêm module: ' + inp.value.trim(), 'success');
}

function deleteModule(gid, mid) {
  var g = moduleGroups.find(function(g){return g.id===gid;});
  var m = g && g.modules.find(function(m){return m.id===mid;});
  if (!confirm('Xóa module "' + (m?m.name:'') + '"?')) return;
  g.modules = g.modules.filter(function(m){return m.id!==mid;});
  renderModuleGroups(); syncSidebarModules();
  showToast('Đã xóa module', 'error');
}

function deleteGroup(gid) {
  var g = moduleGroups.find(function(g){return g.id===gid;});
  if (!confirm('Xóa nhóm "' + (g?g.name:'') + '" và toàn bộ modules?')) return;
  moduleGroups = moduleGroups.filter(function(g){return g.id!==gid;});
  renderModuleGroups(); syncSidebarModules();
  showToast('Đã xóa nhóm', 'error');
}

function addGroup() {
  var inp = document.getElementById('new-group-name');
  if (!inp || !inp.value.trim()) { showToast('Nhập tên nhóm', 'warning'); return; }
  moduleGroups.push({ id: Date.now(), icon: '📂', name: inp.value.trim(), modules: [] });
  inp.value = '';
  fbSet('/shared/moduleGroups', moduleGroups);
  renderModuleGroups(); syncSidebarModules();
  showToast('Đã tạo nhóm mới', 'success');
}

var collapsedGroups = {};

function syncSidebarModules() {
  var c = document.getElementById('sidebar-modules');
  if (!c) return;
  c.innerHTML = moduleGroups.map(function(g) {
    var isCollapsed = collapsedGroups[g.id];
    return '<div onclick="toggleGroup(' + g.id + ')" style="display:flex;align-items:center;padding:8px 16px 4px;color:#888;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;user-select:none;transition:color .2s" onmouseover="this.style.color=\'#ccc\'" onmouseout="this.style.color=\'#888\'">' +
      '<span style="flex:1">' + g.icon + ' ' + g.name + '</span>' +
      '<span style="font-size:10px;transition:transform .2s;transform:rotate(' + (isCollapsed ? '-90' : '0') + 'deg)">▾</span>' +
      '</div>' +
      (!isCollapsed ? g.modules.map(function(m) {
        return '<div class="nav-item" style="padding-left:26px;font-size:12px" onclick="showModulePage(' + m.id + ',\'' + m.name.replace(/'/g,"\\'") + '\',' + g.id + ',this)">' + m.icon + ' ' + m.name + '</div>';
      }).join('') : '');
  }).join('');
}

function toggleGroup(gid) {
  collapsedGroups[gid] = !collapsedGroups[gid];
  syncSidebarModules();
}

function showModulePage(id, name, groupId, el) {
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  document.querySelectorAll('.nav-item').forEach(function(n){n.classList.remove('active');});
  var pid = 'page-mod-' + id;
  var pg = document.getElementById(pid);
  if (!pg) {
    pg = document.createElement('div');
    pg.className = 'page'; pg.id = pid;
    var docs = MODULE_DOCS[id];
    var docsHtml = '';
    if (docs) {
      docsHtml = '<div class="card" style="margin-top:12px"><div class="card-title">📂 Tài liệu</div>' +
        '<p style="color:#555;font-size:13px;margin-bottom:14px">' + docs.desc + '</p>' +
        docs.files.map(function(f) {
          var url = encodeURIComponent(BASE_URL + f.file);
          var viewUrl = OFFICE_VIEW + url;
          var dlUrl = BASE_URL + f.file;
          return '<div style="display:flex;align-items:center;gap:12px;padding:12px;background:#f8f9fb;border-radius:8px;margin-bottom:8px;border:1px solid #e5e7eb">' +
            '<span style="font-size:22px">' + f.icon + '</span>' +
            '<div style="flex:1"><div style="font-weight:700;font-size:13px">' + f.name + '</div>' +
            '<div style="font-size:11px;color:#888;margin-top:2px">' + f.desc + '</div></div>' +
            '<a href="' + viewUrl + '" target="_blank" style="background:#e0f2fe;color:#0369a1;border:none;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:700;text-decoration:none;cursor:pointer">👁️ Xem</a>' +
            '<a href="' + dlUrl + '" download style="background:#dcfce7;color:#15803d;border:none;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:700;text-decoration:none;margin-left:4px;cursor:pointer">⬇️ Tải</a>' +
            '</div>';
        }).join('') + '</div>';
    } else {
      docsHtml = '<div class="card"><p style="color:#aaa;font-style:italic">Chưa có nội dung.</p><br><button class="btn btn-primary" style="width:auto;padding:8px 20px" onclick="showToast(\'Tính năng upload sắp ra mắt!\',\'warning\')">+ Thêm tài liệu</button></div>';
    }
    pg.innerHTML = '<div class="page-header"><div class="page-tag">Module</div><div class="page-title">' + name + '</div><div class="page-meta">Click tài liệu để xem online hoặc tải về</div></div>' + docsHtml;
    var mainEl = document.querySelector('main'); if(mainEl) mainEl.appendChild(pg);
  }
  pg.classList.add('active');
  if(el) el.classList.add('active');
  document.querySelector('main').scrollTop = 0;
}

// ============================================================
// CLOUDINARY UPLOAD
// ============================================================
var CLOUD_NAME = 'draqjeguw';
var UPLOAD_PRESET = 'ml_default';
var cloudFiles = [];

function uploadToCloudinary(input) {
  var files = Array.from(input.files);
  if (!files.length) return;
  var progressEl = document.getElementById('upload-progress');
  if (progressEl) { progressEl.style.display = 'block'; progressEl.textContent = 'Chuẩn bị upload...'; }
  var done = 0;
  files.forEach(function(file) {
    var fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', UPLOAD_PRESET);
    fd.append('folder', 'link-library');
    var isVideo = file.type.startsWith('video/');
    var isImage = file.type.startsWith('image/');
    var resType = isVideo ? 'video' : (isImage ? 'image' : 'raw');
    var endpoint = 'https://api.cloudinary.com/v1_1/' + CLOUD_NAME + '/' + resType + '/upload';
    var xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);
    xhr.upload.onprogress = function(e) {
      if (e.lengthComputable && progressEl) {
        var pct = Math.round(e.loaded / e.total * 100);
        progressEl.textContent = 'Uploading ' + file.name + ': ' + pct + '%';
      }
    };
    xhr.onload = function() {
      done++;
      if (xhr.status === 200) {
        var res = JSON.parse(xhr.responseText);
        cloudFiles.push({ id: res.public_id, name: file.name, url: res.secure_url,
          type: file.type, size: res.bytes, isVideo: isVideo, isImage: isImage,
          date: new Date().toLocaleDateString('vi-VN'),
          author: currentUser ? currentUser.name : '' });
        renderCloudFiles();
      } else {
        showToast('Lỗi upload: ' + file.name, 'error');
      }
      if (done === files.length) {
        if (progressEl) progressEl.style.display = 'none';
        showToast('Upload xong ' + done + ' file!', 'success');
        input.value = '';
      }
    };
    xhr.onerror = function() { showToast('Lỗi mạng khi upload', 'error'); };
    xhr.send(fd);
  });
}

function renderCloudFiles() {
  var list = document.getElementById('file-list');
  if (!list) return;
  if (!cloudFiles.length) { list.innerHTML = '<p style="color:#aaa;font-style:italic">Chua co file nao.</p>'; return; }
  list.innerHTML = cloudFiles.map(function(f, i) {
    var sz = f.size > 1048576 ? (f.size/1048576).toFixed(1)+'MB' : (f.size/1024).toFixed(0)+'KB';
    var preview = f.isVideo
      ? '<video controls style="width:100%;max-height:220px;border-radius:8px;margin-top:10px;background:#000" src="' + f.url + '"></video>'
      : f.isImage ? '<img src="' + f.url + '" style="max-width:100%;max-height:160px;border-radius:8px;margin-top:8px">' : '';
    var icon = f.isVideo ? 'video' : (f.isImage ? 'image' : 'file');
    var ico = {'video':'video','image':'image','file':'file'}[icon];
    return '<div style="border:1px solid #eee;border-radius:10px;padding:14px;margin-bottom:10px;background:#fff">' +
      '<div style="display:flex;align-items:center;gap:10px">' +
      '<span style="font-size:22px">' + (f.isVideo?'video':f.isImage?'image':'file') + '</span>' +
      '<div style="flex:1"><div style="font-weight:600;font-size:13px">' + f.name + '</div>' +
      '<div style="font-size:11px;color:#888">' + sz + ' - ' + f.date + ' - ' + f.author + '</div></div>' +
      '<a href="' + f.url + '" target="_blank" style="background:#e8f0fd;color:#0653b6;text-decoration:none;padding:5px 10px;border-radius:5px;font-size:11px;font-weight:600">Tai ve</a>' +
      '<button onclick="cloudFiles.splice(' + i + ',1);renderCloudFiles()" style="margin-left:6px;background:#fee2e2;color:#ef4444;border:none;padding:5px 10px;border-radius:5px;cursor:pointer;font-size:11px">Xoa</button>' +
      '</div>' + preview + '</div>';
  }).join('');
}

// ============================================================
// YOUTUBE VIDEO EMBED
// ============================================================
var youtubeVideos = [
  { id: 1, title: 'Tổng quan GSC v18', module: 'GSC Introduction', url: '', author: 'Nguyễn Tuấn Phong', date: '01/06/2024' },
  { id: 2, title: 'Hướng dẫn tạo SAS file', module: 'SAS', url: '', author: 'Nguyễn Tuấn Phong', date: '01/06/2024' },
];

function getYoutubeId(url) {
  var m = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
  return m ? m[1] : null;
}

function addYoutubeVideo() {
  var title  = document.getElementById('yt-title').value.trim();
  var module = document.getElementById('yt-module').value.trim();
  var url    = document.getElementById('yt-url').value.trim();
  if (!title || !url) { showToast('Vui lòng nhập tiêu đề và link YouTube', 'warning'); return; }
  var vid = getYoutubeId(url);
  if (!vid) { showToast('Link YouTube không hợp lệ', 'error'); return; }
  youtubeVideos.unshift({
    id: Date.now(), title: title, module: module || 'Chung',
    url: url, ytId: vid,
    author: currentUser ? currentUser.name : '',
    date: new Date().toLocaleDateString('vi-VN')
  });
  document.getElementById('yt-title').value = '';
  document.getElementById('yt-module').value = '';
  document.getElementById('yt-url').value = '';
  renderVideos();
  showToast('Đã thêm video: ' + title, 'success');
}

function renderVideos() {
  var list = document.getElementById('video-list');
  if (!list) return;
  if (!youtubeVideos.length) {
    list.innerHTML = '<p style="color:#aaa;font-style:italic;padding:20px">Chưa có video nào. Thêm link YouTube ở trên!</p>';
    return;
  }
  list.innerHTML = youtubeVideos.map(function(v, i) {
    var vid = v.ytId || getYoutubeId(v.url || '');
    var embed = vid
      ? '<div style="position:relative;padding-bottom:56.25%;height:0;border-radius:10px;overflow:hidden;margin-top:10px"><iframe src="https://www.youtube.com/embed/' + vid + '" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none" allowfullscreen></iframe></div>'
      : '<p style="color:#aaa;font-style:italic;margin-top:8px">Chưa có link video</p>';
    var canDelete = currentUser && ['owner','admin','colleague'].includes(currentUser.role);
    return '<div class="card" style="margin-bottom:16px">' +
      '<div style="display:flex;align-items:flex-start;gap:10px">' +
      '<div style="flex:1">' +
      '<div style="font-weight:700;font-size:15px;margin-bottom:3px">' + v.title + '</div>' +
      '<div style="font-size:11px;color:#888">Ὄ2 ' + v.module + ' · ὆4 ' + v.author + ' · Ὄ5 ' + v.date + '</div>' +
      '</div>' +
      (canDelete ? '<button onclick="removeVideo(' + i + ')" style="background:#fee2e2;color:#ef4444;border:none;padding:5px 10px;border-radius:5px;cursor:pointer;font-size:11px">Xóa</button>' : '') +
      '</div>' + embed + '</div>';
  }).join('');
}

function removeVideo(i) {
  var title = youtubeVideos[i].title;
  youtubeVideos.splice(i, 1);
  renderVideos();
  showToast('Đã xóa: ' + title, 'error');
}

// ============================================================
// DOCUMENT ROOMS
// ============================================================
var rooms = [
  { id:1, name:'GSC E-STOP Procedure', color:'#22c55e', status:'review', content:'<h2>Quy trình vận hành E-STOP</h2><h3>1. Mục đích</h3><p>Mô tả quy trình vận hành nút dừng khẩn cấp (E-STOP) trong hệ thống GSC.</p><h3>2. Quy trình</h3><p><strong>Bước 1:</strong> Xác nhận vùng E-STOP trên HMI.</p><p><strong>Bước 2:</strong> Kiểm tra an toàn trước khi reset.</p><p><strong>Bước 3:</strong> Xoay nút E-STOP và nhấn Acknowledge.</p>', comments:[{author:'Nguyễn Tuấn Phong',role:'owner',text:'Bước 2 cần nêu rõ hơn về kiểm tra an toàn.',time:'01/06/2024 09:15'}], versions:['v1.0 - Le Van C - 01/06/2024'] },
  { id:2, name:'SAS Installation Guide', color:'#3b82f6', status:'draft', content:'<h2>Hướng dẫn cài đặt SAS</h2><p>Tài liệu hướng dẫn cài đặt SAS cho hệ thống GSC v18...</p>', comments:[], versions:['v1.0 - Nguyễn Tuấn Phong - 01/06/2024'] },
];
var activeRoom = null;

function renderRoomSidebar() {
  var list = document.getElementById('room-list-sidebar');
  if (!list) return;
  list.innerHTML = rooms.map(function(r) {
    return '<div onclick="openRoom('+r.id+')" style="padding:8px 10px;border-radius:7px;cursor:pointer;margin-bottom:6px;border:1px solid '+(activeRoom&&activeRoom.id===r.id?'#0891b2':'#e5e7eb')+';background:'+(activeRoom&&activeRoom.id===r.id?'#f0faff':'#fff')+'"><div style="display:flex;align-items:center;gap:7px"><div style="width:8px;height:8px;border-radius:50%;background:'+r.color+'"></div><span style="font-size:12px;font-weight:600">'+r.name+'</span></div></div>';
  }).join('');
}

function openRoom(id) {
  activeRoom = rooms.find(function(r){return r.id===id;});
  if (!activeRoom) return;
  renderRoomSidebar();
  var statusMap = {draft:'὾1 Bản nháp', review:'ὐ4 Chờ review', approved:'✅ Đã duyệt', revision:'✏️ Cần sửa'};
  var content = document.getElementById('room-content');
  content.innerHTML = '<div class="card" style="padding:0;overflow:hidden">' +
    '<div style="padding:14px 18px;border-bottom:1px solid #eee;display:flex;align-items:center;gap:12px">' +
    '<div style="flex:1"><div style="font-weight:700;font-size:16px">'+activeRoom.name+'</div></div>' +
    '<span style="background:#fef3c7;color:#92400e;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700">'+statusMap[activeRoom.status]+'</span>' +
    '<button onclick="approveRoom()" class="btn-sm approve-btn">✅ Duyệt</button>' +
    '<button onclick="requestRoomRevision()" class="btn-sm reject-btn" style="margin-left:6px">✏️ Yêu cầu sửa</button>' +
    '</div>' +
    '<div style="display:flex;border-bottom:1px solid #eee">' +
    '<div style="flex:1">' +
    '<div style="display:flex;gap:0;padding:0 16px;background:#f8f9fb">' +
    '<div class="etab2 active" onclick="switchRoomTab(\'edit\',this)" style="padding:9px 14px;cursor:pointer;font-size:12px;font-weight:700;color:#0891b2;border-bottom:2px solid #0891b2;margin-bottom:-1px">✍️ Soạn thảo</div>' +
    '<div class="etab2" onclick="switchRoomTab(\'diff\',this)" style="padding:9px 14px;cursor:pointer;font-size:12px;font-weight:700;color:#888;border-bottom:2px solid transparent;margin-bottom:-1px">ὐd So sánh</div>' +
    '<div class="etab2" onclick="switchRoomTab(\'history\',this)" style="padding:9px 14px;cursor:pointer;font-size:12px;font-weight:700;color:#888;border-bottom:2px solid transparent;margin-bottom:-1px">Ὄb Lịch sử</div>' +
    '</div>' +
    '<div id="room-tab-edit" style="padding:0">' +
    '<div style="background:#f8f9fb;border-bottom:1px solid #eee;padding:6px 12px;display:flex;gap:4px;flex-wrap:wrap">' +
    '<button class="btn-sm" onclick="rf(\'bold\')"><b>B</b></button><button class="btn-sm" onclick="rf(\'italic\')"><i>I</i></button><button class="btn-sm" onclick="rf(\'underline\')"><u>U</u></button>' +
    '<select class="btn-sm" onchange="rf(\'formatBlock\',this.value)"><option value="p">Đoạn</option><option value="h2">H2</option><option value="h3">H3</option></select>' +
    '<button class="btn-sm" onclick="rf(\'insertUnorderedList\')">• List</button>' +
    '<button class="btn-sm" onclick="rf(\'insertOrderedList\')">1. List</button>' +
    '<div style="flex:1"></div>' +
    '<button onclick="saveRoomVersion()" class="btn-sm approve-btn">Ὃe Lưu phiên bản</button>' +
    '<button onclick="exportRoomPDF()" class="btn-sm reject-btn" style="margin-left:4px">Ὄ4 PDF</button>' +
    '<button onclick="exportRoomWord()" class="btn-sm" style="background:#2b5797;color:#fff;border:none;margin-left:4px">Ὅd Word</button>' +
    '</div>' +
    '<div id="room-editor" contenteditable="true" style="min-height:280px;padding:20px;outline:none;font-size:14px;line-height:1.9">'+activeRoom.content+'</div>' +
    '</div>' +
    '<div id="room-tab-diff" style="display:none;padding:16px"><div style="background:#f0fdf4;padding:12px;border-radius:8px;font-size:13px;color:#166534;border-left:4px solid #22c55e">So sánh với phiên bản trước — chọn "Lưu phiên bản" để tạo bản mới rồi xem diff.</div></div>' +
    '<div id="room-tab-history" style="display:none;padding:16px"><div style="font-size:13px">'+activeRoom.versions.map(function(v,i){return '<div style="padding:8px 0;border-bottom:1px solid #f0f0f0;display:flex;justify-content:space-between"><span>'+v+'</span><button class="btn-sm" onclick="showToast(\'Đang xem phiên bản này\',\'success\')">Xem</button></div>';}).join('')+'</div></div>' +
    '</div>' +
    '<div style="width:280px;border-left:1px solid #eee;display:flex;flex-direction:column">' +
    '<div style="padding:10px 14px;font-size:12px;font-weight:700;border-bottom:1px solid #eee">Ὂc Comments</div>' +
    '<div id="room-comments" style="flex:1;overflow-y:auto;padding:10px">'+activeRoom.comments.map(function(c){return '<div style="background:#f0f5ff;border-left:3px solid #1c69d4;padding:8px 10px;border-radius:0 8px 8px 0;margin-bottom:8px;font-size:12px"><div style="font-weight:700;color:#0653b6;margin-bottom:3px">'+c.author+'</div>'+c.text+'<div style="color:#aaa;font-size:10px;margin-top:4px">'+c.time+'</div></div>';}).join('')+'</div>' +
    '<div style="padding:10px;border-top:1px solid #eee"><textarea id="room-cmt-input" rows="2" style="width:100%;border:1px solid #ddd;border-radius:7px;padding:7px;font-size:12px;outline:none;resize:none"></textarea><button onclick="addRoomComment()" style="width:100%;background:#1c69d4;color:#fff;border:none;padding:6px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;margin-top:6px">Gửi comment</button></div>' +
    '</div></div></div>';
}

function switchRoomTab(tab, el) {
  document.querySelectorAll('.etab2').forEach(function(t){t.style.color='#888';t.style.borderBottomColor='transparent';});
  el.style.color='#0891b2'; el.style.borderBottomColor='#0891b2';
  ['edit','diff','history'].forEach(function(t){var el=document.getElementById('room-tab-'+t);if(el)el.style.display=t===tab?'block':'none';});
}

function rf(cmd,val){document.execCommand(cmd,false,val||null);}

function saveRoomVersion() {
  if (!activeRoom) return;
  activeRoom.content = document.getElementById('room-editor').innerHTML;
  var ver = 'v1.'+(activeRoom.versions.length)+' - '+(currentUser?currentUser.name:'User')+' - '+new Date().toLocaleDateString('vi-VN');
  activeRoom.versions.unshift(ver);
  showToast('Đã lưu phiên bản mới!','success');
}

function addRoomComment() {
  if (!activeRoom) return;
  var inp = document.getElementById('room-cmt-input');
  var txt = inp.value.trim();
  if (!txt) return;
  var c = {author: currentUser?currentUser.name:'User', role: currentUser?currentUser.role:'colleague', text: txt, time: new Date().toLocaleString('vi-VN')};
  activeRoom.comments.push(c);
  var list = document.getElementById('room-comments');
  var div = document.createElement('div');
  div.style.cssText = 'background:#f0f5ff;border-left:3px solid #1c69d4;padding:8px 10px;border-radius:0 8px 8px 0;margin-bottom:8px;font-size:12px';
  div.innerHTML = '<div style="font-weight:700;color:#0653b6;margin-bottom:3px">'+c.author+'</div>'+c.text+'<div style="color:#aaa;font-size:10px;margin-top:4px">Vừa xong</div>';
  list.appendChild(div);
  list.scrollTop = 9999;
  inp.value = '';
  showToast('Đã gửi comment','success');
}

function approveRoom() {
  if (activeRoom) { activeRoom.status='approved'; openRoom(activeRoom.id); showToast('Đã phê duyệt tài liệu!','success'); }
}

function requestRoomRevision() {
  if (activeRoom) { activeRoom.status='revision'; openRoom(activeRoom.id); showToast('Đã gửi yêu cầu sửa','warning'); }
}

function exportRoomPDF() {
  var content = document.getElementById('room-editor').innerHTML;
  var w = window.open(''); w.document.write('<html><head><style>body{font-family:Arial;padding:40px;line-height:1.8;}h2{color:#0891b2;}@media print{button{display:none}}</style></head><body><button onclick="window.print()" style="position:fixed;top:10px;right:10px;background:#ef4444;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer">In/Lưu PDF</button>'+content+'</body></html>'); w.document.close();
}

function exportRoomWord() {
  var content = document.getElementById('room-editor').innerHTML;
  var blob = new Blob(['<html><body style="font-family:Arial">'+content+'</body></html>'],{type:'application/msword'});
  var a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=(activeRoom?activeRoom.name:'document')+'.doc'; a.click();
  showToast('Đã xuất Word!','success');
}

function createRoom() {
  var name = prompt('Tên Room mới:');
  if (!name) return;
  var btn = document.querySelector('[onclick="createRoom()"]');
  openEmojiPicker(function(icon) {
    var colors = ['#22c55e','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#0891b2','#ec4899'];
    rooms.push({id:Date.now(),name:name,icon:icon||'Ὄ2',color:colors[Math.floor(Math.random()*colors.length)],status:'draft',content:'<h2>'+name+'</h2><p>Bắt đầu soạn thảo nội dung...</p>',comments:[],versions:['v1.0 - '+(currentUser?currentUser.name:'User')+' - '+new Date().toLocaleDateString('vi-VN')]});
    renderRoomSidebar();
  showToast('Đã tạo Room: '+name,'success');
  }, btn);
}

// ============================================================
// SPREADSHEET (Main app)
// ============================================================
var sRows=10,sCols=7,sData={},sSelected=null;

function colL(i){return String.fromCharCode(65+i);}
function sCellId(r,c){return colL(c)+(r+1);}

function buildMainSheet(){
  var t=document.getElementById('main-sheet');
  if(!t)return;
  var h='<tr><th style="background:#f1f3f5;border:1px solid #d1d5db;width:36px;height:24px;font-size:11px;color:#6b7280;position:sticky;top:0;left:0;z-index:3"></th>';
  for(var c=0;c<sCols;c++) h+='<th style="background:#f1f3f5;border:1px solid #d1d5db;padding:0;width:90px;height:24px;text-align:center;font-size:11px;font-weight:700;color:#6b7280;position:sticky;top:0;z-index:2">'+colL(c)+'</th>';
  h+='</tr>';
  for(var r=0;r<sRows;r++){
    h+='<tr><td style="background:#f1f3f5;border:1px solid #d1d5db;text-align:center;font-size:11px;color:#6b7280;font-weight:700;position:sticky;left:0;z-index:1;padding:0 4px;min-width:36px">'+(r+1)+'</td>';
    for(var c=0;c<sCols;c++){var id=sCellId(r,c);h+='<td style="border:1px solid #e5e7eb;padding:0;min-width:90px;height:26px" id="stc-'+id+'"><input id="sc-'+id+'" style="width:100%;height:100%;border:none;outline:none;padding:0 4px;font-size:13px;background:transparent" onkeydown="sKey(event,'+r+','+c+')" onfocus="sFocus(\''+id+'\')" onblur="sBlur(\''+id+'\')" onchange="sSet(\''+id+'\',this.value)"></td>';}
    h+='</tr>';
  }
  t.innerHTML=h;
  // Demo data
  var demo=[['A1','Thiết bị'],['B1','Giá trị'],['C1','Ngưỡng'],['D1','Trạng thái'],['A2','E-STOP ST010'],['B2','24'],['C2','24'],['D2','=IF(B2>=C2,"OK","LỖI")'],['A3','E-STOP ST020'],['B3','23.5'],['C3','24'],['D3','=IF(B3>=C3*0.99,"OK","LỖI")'],['A4','E-STOP ST120'],['B4','0'],['C4','24'],['D4','=IF(B4>=C4*0.99,"OK","LỖI")'],['A6','Tổng'],['B6','=SUM(B2:B4)'],['A7','Trung bình'],['B7','=AVG(B2:B4)'],['A8','Cao nhất'],['B8','=MAX(B2:B4)'],['A9','Thấp nhất'],['B9','=MIN(B2:B4)']];
  demo.forEach(function(d){sData[d[0]]=d[1];var el=document.getElementById('sc-'+d[0]);if(el)el.value=d[1];});
  sRecalc();
}

function sFocus(id){sSelected=id;document.getElementById('sheet-cell-ref').textContent=id;document.getElementById('sheet-fbar').value=sData[id]||'';}
function sBlur(id){sRecalc();}
function sKey(e,r,c){if(e.key==='Enter'||e.key==='Tab'){e.preventDefault();var nr=e.key==='Enter'?r+1:r,nc=e.key==='Tab'?c+1:c;if(nr<sRows&&nc<sCols){var n=document.getElementById('sc-'+sCellId(nr,nc));if(n)n.focus();}}}
function sSet(id,v){sData[id]=v;sRecalc();}
function applySheetFormula(){var v=document.getElementById('sheet-fbar').value;if(sSelected){sData[sSelected]=v;var el=document.getElementById('sc-'+sSelected);if(el)el.value=v;sRecalc();}}
function insertF(fn){if(!sSelected)return;var ex={'SUM':'=SUM(B2:B6)','AVG':'=AVG(B2:B6)','MAX':'=MAX(B2:B6)','MIN':'=MIN(B2:B6)','COUNT':'=COUNT(B2:B6)','IF':'=IF(B2>10,"Cao","Thấp")'}[fn]||'='+fn+'()';document.getElementById('sheet-fbar').value=ex;if(sSelected){var el=document.getElementById('sc-'+sSelected);if(el)el.focus();}}
function addSheetRow(){sRows++;buildMainSheet();}
function addSheetCol(){sCols++;buildMainSheet();}

function sExpand(ref){var m=ref.match(/([A-Z])(\d+):([A-Z])(\d+)/);if(!m)return[ref];var cells=[];for(var r=parseInt(m[2]);r<=parseInt(m[4]);r++)for(var c=m[1].charCodeAt(0);c<=m[3].charCodeAt(0);c++)cells.push(String.fromCharCode(c)+r);return cells;}
function sGetNum(id){var v=sEval(id);return isNaN(parseFloat(v))?0:parseFloat(v);}
function sEval(id){var raw=sData[id]||'';if(!raw.startsWith('='))return raw;try{var expr=raw.substring(1).toUpperCase();expr=expr.replace(/SUM\(([^)]+)\)/g,function(m,r){return sExpand(r).map(sGetNum).reduce(function(a,b){return a+b;},0);});expr=expr.replace(/AVG\(([^)]+)\)/g,function(m,r){var a=sExpand(r).map(sGetNum);return a.reduce(function(s,v){return s+v;},0)/a.length;});expr=expr.replace(/MAX\(([^)]+)\)/g,function(m,r){return Math.max.apply(null,sExpand(r).map(sGetNum));});expr=expr.replace(/MIN\(([^)]+)\)/g,function(m,r){return Math.min.apply(null,sExpand(r).map(sGetNum));});expr=expr.replace(/COUNT\(([^)]+)\)/g,function(m,r){return sExpand(r).filter(function(c){return!isNaN(parseFloat(sData[c]));}).length;});expr=expr.replace(/IF\((.+),(.+),(.+)\)/g,function(m,cond,t,f){cond=cond.replace(/([A-Z]\d+)/g,function(c){return parseFloat(sEval(c))||0;});try{return eval(cond)?t.replace(/"/g,''):f.replace(/"/g,'');}catch(e){return'ERR';}});expr=expr.replace(/([A-Z]\d+)/g,function(c){return parseFloat(sEval(c))||0;});var res=eval(expr);return isNaN(res)?res:Math.round(res*1000)/1000;}catch(e){return'#ERR';}}
function sRecalc(){for(var id in sData){var el=document.getElementById('sc-'+id);if(!el)continue;if((sData[id]||'').startsWith('=')){var r=sEval(id);el.value=r;var td=document.getElementById('stc-'+id);if(td)td.style.background=r==='#ERR'||r==='ERR'?'#fee2e2':(sData[id].startsWith('=')?'#f0f5ff':'');}}}

function exportSheetCSV(){var rows=[];for(var r=0;r<sRows;r++){var row=[];for(var c=0;c<sCols;c++){var id=sCellId(r,c);row.push(sEval(id)||'');}rows.push(row.join(','));}var blob=new Blob(['﻿'+rows.join('\n')],{type:'text/csv;charset=utf-8;'});var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='spreadsheet.csv';a.click();showToast('Đã xuất CSV — mở bằng Excel!','success');}

// ============================================================
// TRASH & STORAGE MANAGEMENT
// ============================================================
var trash = []; // deleted modules/groups go here
var STORAGE_LIMIT_MB = 25000; // 25GB Cloudinary free
var storageUsedMB = 847; // simulated — real: fetch from Cloudinary API

// ============================================================
// STORAGE STATS
// ============================================================
function getAppStorageStats() {
  function sizeOf(obj) {
    try { return new Blob([JSON.stringify(obj)]).size; } catch(e) { return 0; }
  }
  var sections = [
    { label: '📋 Modules & Groups',  icon:'📋', bytes: sizeOf(moduleGroups), color:'#3b82f6' },
    { label: '📝 Tài liệu cá nhân',  icon:'📝', bytes: sizeOf(personalDocs), color:'#7c3aed' },
    { label: '📊 Bảng tính cá nhân', icon:'📊', bytes: sizeOf(personalSheets), color:'#059669' },
    { label: '📁 Files cá nhân',     icon:'📁', bytes: sizeOf(personalFiles), color:'#0891b2' },
    { label: '📝 Tài liệu chung',    icon:'📝', bytes: sizeOf(sharedDocs), color:'#d97706' },
    { label: '📊 Bảng tính chung',   icon:'📊', bytes: sizeOf(sharedSheets), color:'#16a34a' },
    { label: '📁 Files chung',       icon:'📁', bytes: sizeOf(sharedFiles), color:'#0e7490' },
    { label: '📢 Tin tức/News',      icon:'📢', bytes: sizeOf(news), color:'#b45309' },
    { label: '🗑️ Thùng rác',        icon:'🗑️', bytes: sizeOf(trash), color:'#dc2626' },
  ];
  var total = sections.reduce(function(s,x){return s+x.bytes;},0);
  return { sections: sections, total: total };
}

function renderStorageWidget(containerId) {
  var card = document.getElementById('home-storage-card');
  if (card) card.style.display = 'block';
  var el = document.getElementById(containerId);
  if (!el) return;
  var stats = getAppStorageStats();
  var totalKB = (stats.total / 1024).toFixed(1);
  var totalMB = (stats.total / 1024 / 1024).toFixed(3);
  var RAM_LIMIT = 50 * 1024 * 1024; // 50MB soft limit for session
  var ramPct = Math.min((stats.total / RAM_LIMIT) * 100, 100).toFixed(1);
  var cloudPct = Math.min((storageUsedMB / STORAGE_LIMIT_MB) * 100, 100).toFixed(2);

  var sectionsHtml = stats.sections.filter(function(s){return s.bytes>0;}).map(function(s) {
    var kb = (s.bytes/1024).toFixed(1);
    var pct = stats.total > 0 ? ((s.bytes/stats.total)*100).toFixed(0) : 0;
    var barW = Math.max(pct, 2);
    return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
      '<div style="width:130px;font-size:12px;color:#555;flex-shrink:0">'+s.label+'</div>' +
      '<div style="flex:1;background:#f1f5f9;border-radius:4px;height:8px;overflow:hidden">' +
        '<div style="width:'+barW+'%;height:100%;background:'+s.color+';border-radius:4px;transition:width .4s"></div>' +
      '</div>' +
      '<div style="width:60px;text-align:right;font-size:11px;color:#888;flex-shrink:0">'+kb+' KB</div>' +
    '</div>';
  }).join('');

  el.innerHTML =
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">' +
      // RAM card
      '<div style="background:#f8faff;border:1px solid #dbeafe;border-radius:10px;padding:14px">' +
        '<div style="font-size:11px;font-weight:700;color:#1d4ed8;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">💾 RAM Session</div>' +
        '<div style="font-size:22px;font-weight:800;color:#1e40af">'+totalKB+' <span style="font-size:13px;font-weight:400;color:#64748b">KB</span></div>' +
        '<div style="font-size:11px;color:#64748b;margin-bottom:8px">'+totalMB+' MB / phiên hiện tại</div>' +
        '<div style="background:#e2e8f0;border-radius:6px;height:10px;overflow:hidden">' +
          '<div style="width:'+ramPct+'%;height:100%;background:linear-gradient(90deg,#3b82f6,#1d4ed8);border-radius:6px;transition:width .4s"></div>' +
        '</div>' +
        '<div style="font-size:11px;color:#94a3b8;margin-top:4px">'+ramPct+'% giới hạn session (50MB)</div>' +
      '</div>' +
      // Cloudinary card
      '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px">' +
        '<div style="font-size:11px;font-weight:700;color:#15803d;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">☁️ Cloudinary</div>' +
        '<div style="font-size:22px;font-weight:800;color:#166534">'+storageUsedMB+' <span style="font-size:13px;font-weight:400;color:#64748b">MB</span></div>' +
        '<div style="font-size:11px;color:#64748b;margin-bottom:8px">/ '+STORAGE_LIMIT_MB.toLocaleString()+' MB (25 GB free)</div>' +
        '<div style="background:#dcfce7;border-radius:6px;height:10px;overflow:hidden">' +
          '<div style="width:'+cloudPct+'%;height:100%;background:linear-gradient(90deg,#22c55e,#16a34a);border-radius:6px;transition:width .4s"></div>' +
        '</div>' +
        '<div style="font-size:11px;color:#94a3b8;margin-top:4px">'+cloudPct+'% đã dùng · còn '+(STORAGE_LIMIT_MB-storageUsedMB).toLocaleString()+' MB</div>' +
      '</div>' +
    '</div>' +
    // Content library card
    '<div style="background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:12px 14px;margin-bottom:14px;display:flex;align-items:center;gap:12px">' +
      '<div style="font-size:28px">📚</div>' +
      '<div style="flex:1">' +
        '<div style="font-size:12px;font-weight:700;color:#92400e">Content Library (GitHub)</div>' +
        '<div style="font-size:12px;color:#78350f;margin-top:2px">26 files · 6 PPTX GSC modules + 16 DOCX Operation Manual BMW A1HG01</div>' +
      '</div>' +
      '<div style="text-align:right"><div style="font-size:18px;font-weight:800;color:#92400e">~9 MB</div><div style="font-size:10px;color:#a16207">GitHub Pages</div></div>' +
    '</div>' +
    // Breakdown
    '<div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:8px">📊 Chi tiết theo loại dữ liệu</div>' +
    (stats.sections.filter(function(s){return s.bytes>0;}).length > 0 ? sectionsHtml :
      '<p style="color:#aaa;font-size:12px;font-style:italic">Chưa có dữ liệu nào trong phiên này.</p>') +
    '<div style="margin-top:12px;padding:10px;background:#f8f9fb;border-radius:8px;border:1px solid #e5e7eb;font-size:11px;color:#888">' +
      '⚠️ Dữ liệu RAM chỉ tồn tại trong phiên hiện tại (mất khi reload). ' +
      'Để lưu vĩnh viễn → cần tích hợp <strong>Supabase database</strong>.' +
    '</div>';
}

// Override deleteModule to send to trash instead
var _origDeleteModule = deleteModule;
deleteModule = function(gid, mid) {
  var g = moduleGroups.find(function(g){return g.id===gid;});
  var m = g && g.modules.find(function(m){return m.id===mid;});
  if (!m) return;
  if (!confirm('Xóa module "'+m.name+'"?\nSẽ vào Thùng rác — Admin có thể khôi phục.')) return;
  trash.push({ type:'module', data: JSON.parse(JSON.stringify(m)), groupId: gid, groupName: g.name, deletedBy: currentUser?currentUser.name:'?', deletedAt: new Date().toLocaleString('vi-VN') });
  g.modules = g.modules.filter(function(x){return x.id!==mid;});
  renderModuleGroups(); syncSidebarModules();
  updateTrashBadge();
  showToast('Đã chuyển "'+m.name+'" vào Thùng rác — Admin có thể khôi phục', 'warning');
};

var _origDeleteGroup = deleteGroup;
deleteGroup = function(gid) {
  var g = moduleGroups.find(function(g){return g.id===gid;});
  if (!g) return;
  if (!confirm('Xóa nhóm "'+g.name+'" và '+g.modules.length+' modules?\nSẽ vào Thùng rác.')) return;
  trash.push({ type:'group', data: JSON.parse(JSON.stringify(g)), deletedBy: currentUser?currentUser.name:'?', deletedAt: new Date().toLocaleString('vi-VN') });
  moduleGroups = moduleGroups.filter(function(x){return x.id!==gid;});
  renderModuleGroups(); syncSidebarModules();
  updateTrashBadge();
  showToast('Đã chuyển nhóm "'+g.name+'" vào Thùng rác', 'warning');
};

function updateTrashBadge() {
  var b = document.getElementById('trash-badge');
  if (b) { b.textContent = trash.length; b.style.display = trash.length > 0 ? 'inline' : 'none'; }
}

function renderTrash() {
  var list = document.getElementById('trash-list');
  if (!list) return;
  if (trash.length === 0) {
    list.innerHTML = '<p style="color:#aaa;font-style:italic;text-align:center;padding:20px">Thùng rác trống.</p>';
    return;
  }
  list.innerHTML = trash.map(function(item, i) {
    var icon = item.type === 'group' ? 'Ὄ1' : 'Ὄb';
    var name = item.type === 'group' ? item.data.name + ' (nhóm + '+item.data.modules.length+' modules)' : item.data.name + ' (trong: '+item.groupName+')';
    return '<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid #f0f0f0;background:#fff">' +
      '<span style="font-size:20px">'+icon+'</span>' +
      '<div style="flex:1">' +
        '<div style="font-weight:600;font-size:13px">'+name+'</div>' +
        '<div style="font-size:11px;color:#aaa;margin-top:2px">Xóa bởi: '+item.deletedBy+' · '+item.deletedAt+'</div>' +
      '</div>' +
      '<button onclick="restoreItem('+i+')" class="btn-sm approve-btn">↩️ Khôi phục</button>' +
      '<button onclick="deletePermanent('+i+')" class="btn-sm reject-btn" style="margin-left:6px">🗑️ Xóa vĩnh viễn</button>' +
    '</div>';
  }).join('');
}

function restoreItem(i) {
  var item = trash[i];
  if (!item) return;
  if (item.type === 'group') {
    moduleGroups.push(item.data);
    showToast('Đã khôi phục nhóm: '+item.data.name, 'success');
  } else {
    var g = moduleGroups.find(function(g){return g.id===item.groupId;});
    if (g) { g.modules.push(item.data); showToast('Đã khôi phục module: '+item.data.name, 'success'); }
    else { showToast('Nhóm gốc đã bị xóa — không thể khôi phục module', 'warning'); }
  }
  trash.splice(i, 1);
  renderModuleGroups(); syncSidebarModules();
  updateTrashBadge(); renderTrash();
}

function deletePermanent(i) {
  var item = trash[i];
  if (!confirm('Xóa vĩnh viễn "'+((item.data&&item.data.name)||'item')+'"?\nKhông thể khôi phục!')) return;
  trash.splice(i, 1);
  updateTrashBadge(); renderTrash();
  showToast('Đã xóa vĩnh viễn', 'error');
}

function emptyTrash() {
  if (!confirm('Xóa toàn bộ '+trash.length+' mục trong thùng rác?\nKhông thể khôi phục!')) return;
  trash = [];
  updateTrashBadge(); renderTrash();
  showToast('Đã làm trống Thùng rác', 'error');
}

// Storage usage display
function renderStorageWidget() {
  var el = document.getElementById('storage-widget');
  if (!el) return;
  var pct = Math.round(storageUsedMB / STORAGE_LIMIT_MB * 100);
  var color = pct > 80 ? '#ef4444' : pct > 60 ? '#e8a000' : '#22c55e';
  var usedGB = (storageUsedMB/1024).toFixed(2);
  el.innerHTML =
    '<div style="font-size:11px;font-weight:700;color:#888;margin-bottom:6px;letter-spacing:1px">DUNG LƯỢNG CLOUDINARY</div>' +
    '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">' +
      '<span style="font-weight:600;color:'+color+'">'+usedGB+' GB đã dùng</span>' +
      '<span style="color:#888">25 GB</span>' +
    '</div>' +
    '<div style="background:#e5e7eb;border-radius:4px;height:8px;overflow:hidden">' +
      '<div style="width:'+pct+'%;background:'+color+';height:100%;border-radius:4px;transition:width .5s"></div>' +
    '</div>' +
    '<div style="font-size:10px;color:#aaa;margin-top:4px">'+pct+'% đã sử dụng · '+(25-storageUsedMB/1024).toFixed(2)+' GB còn lại</div>' +
    (pct > 80 ? '<div style="margin-top:6px;padding:6px 8px;background:#fee2e2;border-radius:6px;font-size:11px;color:#991b1b">⚠️ Sắp đầy! Hãy xóa file không cần thiết.</div>' : '') +
    '<button onclick="emptyTrash()" style="margin-top:8px;width:100%;background:#fee2e2;color:#ef4444;border:1px solid #fca5a5;border-radius:6px;padding:5px;font-size:11px;font-weight:700;cursor:pointer">🗑️ Làm trống Thùng rác ('+trash.length+' mục)</button>';
}

// ============================================================
// PERSONAL FILES (Private workspace)
// ============================================================
var personalDocs = [];
var personalSheets = [];
var personalFiles = [];
var personalNote = '';
var publicFiles = []; // files published to shared space

function switchPersonalTab(tab, el) {
  document.querySelectorAll('.personal-tab').forEach(function(t) {
    t.style.color = '#888'; t.style.borderBottomColor = 'transparent';
  });
  el.style.color = '#7c3aed'; el.style.borderBottomColor = '#7c3aed';
  ['docs','sheets','files','notes'].forEach(function(t) {
    var el = document.getElementById('personal-tab-' + t);
    if (el) el.style.display = t === tab ? 'block' : 'none';
  });
}

function switchFilesTab(tab, el) {
  document.querySelectorAll('.files-tab').forEach(function(t) {
    t.style.color = '#888'; t.style.borderBottomColor = 'transparent';
  });
  el.style.color = '#0891b2'; el.style.borderBottomColor = '#0891b2';
  renderPublicFiles(tab);
}

// Personal Docs
function createPersonalDoc() {
  var name = prompt('Tên tài liệu:');
  if (!name) return;
  personalDocs.push({ id: Date.now(), name: name, content: '<p>Bắt đầu soạn thảo...</p>', date: new Date().toLocaleDateString('vi-VN'), author: currentUser ? currentUser.name : '' });
  renderPersonalDocs();
  showToast('Đã tạo tài liệu: ' + name, 'success');
}

function renderPersonalDocs() {
  var list = document.getElementById('personal-docs-list');
  if (!list) return;
  if (!personalDocs.length) { list.innerHTML = '<p style="color:#aaa;font-style:italic;padding:20px;text-align:center">Chưa có tài liệu nào. Bấm "+ Tài liệu mới" để bắt đầu.</p>'; return; }
  list.innerHTML = personalDocs.map(function(doc, i) {
    return '<div style="background:#fff;border-radius:10px;border:1px solid #e5e7eb;overflow:hidden;margin-bottom:12px">' +
      '<div style="padding:14px 16px;display:flex;align-items:center;gap:10px">' +
        '<span style="font-size:20px">Ὅd</span>' +
        '<div style="flex:1"><div style="font-weight:700;font-size:13px">'+doc.name+'</div><div style="font-size:11px;color:#888">'+doc.date+'</div></div>' +
        '<button onclick="editPersonalDoc('+i+')" class="btn-sm" style="background:#f3f4f6;border:none;cursor:pointer">✏️ Sửa</button>' +
        '<button onclick="publishItem(\'doc\','+i+')" class="btn-sm" style="background:#dcfce7;color:#166534;border:none;cursor:pointer;margin-left:4px">὎4 Public</button>' +
        '<button onclick="exportDocPDF('+i+')" class="btn-sm" style="background:#fee2e2;color:#ef4444;border:none;cursor:pointer;margin-left:4px">Ὄ4 PDF</button>' +
        '<button onclick="personalDocs.splice('+i+',1);renderPersonalDocs()" class="btn-sm reject-btn" style="margin-left:4px">🗑️</button>' +
      '</div>' +
      '<div id="doc-editor-'+i+'" style="display:none;border-top:1px solid #eee">' +
        '<div style="background:#f8f9fb;padding:6px 12px;display:flex;gap:4px;border-bottom:1px solid #eee">' +
          '<button class="btn-sm" onclick="document.execCommand(\'bold\')"><b>B</b></button>' +
          '<button class="btn-sm" onclick="document.execCommand(\'italic\')"><i>I</i></button>' +
          '<button class="btn-sm" onclick="document.execCommand(\'underline\')"><u>U</u></button>' +
          '<select class="btn-sm" onchange="document.execCommand(\'formatBlock\',false,this.value)"><option value="p">Đoạn</option><option value="h2">H2</option><option value="h3">H3</option></select>' +
          '<button class="btn-sm" onclick="document.execCommand(\'insertUnorderedList\')">• List</button>' +
          '<div style="flex:1"></div>' +
          '<button onclick="savePersonalDoc('+i+')" class="btn-sm approve-btn">Ὃe Lưu</button>' +
        '</div>' +
        '<div id="doc-content-'+i+'" contenteditable="true" style="min-height:200px;padding:16px;outline:none;font-size:14px;line-height:1.8">'+doc.content+'</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function editPersonalDoc(i) {
  var el = document.getElementById('doc-editor-' + i);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function savePersonalDoc(i) {
  var content = document.getElementById('doc-content-' + i);
  if (content && personalDocs[i]) { personalDocs[i].content = content.innerHTML; showToast('Đã lưu tài liệu!', 'success'); }
}

function exportDocPDF(i) {
  var doc = personalDocs[i];
  if (!doc) return;
  var w = window.open('');
  w.document.write('<html><head><style>body{font-family:Arial;padding:40px;line-height:1.8;}@media print{button{display:none}}</style></head><body><button onclick="window.print()" style="position:fixed;top:10px;right:10px;background:#ef4444;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer">In/PDF</button><h2>'+doc.name+'</h2>'+doc.content+'</body></html>');
  w.document.close();
}

// Personal Sheets
function createPersonalSheet() {
  var name = prompt('Tên bảng tính:');
  if (!name) return;
  personalSheets.push({ id: Date.now(), name: name, date: new Date().toLocaleDateString('vi-VN'), data: {} });
  renderPersonalSheets();
  showToast('Đã tạo bảng tính: ' + name, 'success');
}

function renderPersonalSheets() {
  var list = document.getElementById('personal-sheets-list');
  if (!list) return;
  if (!personalSheets.length) { list.innerHTML = '<p style="color:#aaa;font-style:italic;padding:20px;text-align:center">Chưa có bảng tính. Bấm "+ Bảng tính mới".</p>'; return; }
  list.innerHTML = personalSheets.map(function(sheet, i) {
    return '<div style="background:#fff;border-radius:10px;border:1px solid #e5e7eb;padding:14px 16px;display:flex;align-items:center;gap:10px;margin-bottom:10px">' +
      '<span style="font-size:20px">Ὄa</span>' +
      '<div style="flex:1"><div style="font-weight:700;font-size:13px">'+sheet.name+'</div><div style="font-size:11px;color:#888">'+sheet.date+'</div></div>' +
      '<button onclick="openPersonalSheet('+i+')" class="btn-sm" style="background:#f3f4f6;border:none;cursor:pointer">✏️ Mở</button>' +
      '<button onclick="publishItem(\'sheet\','+i+')" class="btn-sm" style="background:#dcfce7;color:#166534;border:none;cursor:pointer;margin-left:4px">὎4 Public</button>' +
      '<button onclick="personalSheets.splice('+i+',1);renderPersonalSheets()" class="btn-sm reject-btn" style="margin-left:4px">🗑️</button>' +
    '</div>';
  }).join('');
}

function openPersonalSheet(i) {
  var sheet = personalSheets[i];
  var editor = document.getElementById('personal-sheet-editor');
  if (!editor) return;
  editor.style.display = 'block';
  editor.innerHTML = '<div class="card" style="margin-top:12px"><div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><span style="font-size:18px">Ὄa</span><div style="font-weight:700;font-size:15px">'+sheet.name+'</div><button onclick="document.getElementById(\'personal-sheet-editor\').style.display=\'none\'" style="margin-left:auto;background:#f3f4f6;border:none;border-radius:6px;padding:4px 10px;cursor:pointer">✕ Đóng</button></div><p style="font-size:12px;color:#888;margin-bottom:10px">Bảng tính mini — nhập công thức =SUM, =AVG, =IF...</p><div style="overflow:auto"><table id="psheet-'+i+'" style="border-collapse:collapse;min-width:100%"></table></div><button onclick="exportPSheetCSV('+i+')" style="margin-top:10px;background:#217346;color:#fff;border:none;border-radius:7px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer">⬇️ Xuất CSV/Excel</button></div>';
  buildPSheet(i);
}

function buildPSheet(si) {
  var t = document.getElementById('psheet-' + si);
  if (!t) return;
  var R=8,C=6,h='<tr><th style="background:#f1f3f5;border:1px solid #d1d5db;width:36px;height:22px;font-size:10px;position:sticky;top:0;left:0;z-index:3"></th>';
  for(var c=0;c<C;c++) h+='<th style="background:#f1f3f5;border:1px solid #d1d5db;width:80px;height:22px;text-align:center;font-size:10px;font-weight:700;color:#6b7280;position:sticky;top:0">'+colL(c)+'</th>';
  h+='</tr>';
  for(var r=0;r<R;r++){
    h+='<tr><td style="background:#f1f3f5;border:1px solid #d1d5db;text-align:center;font-size:10px;color:#6b7280;font-weight:700;position:sticky;left:0;min-width:30px;padding:0 4px">'+(r+1)+'</td>';
    for(var c=0;c<C;c++){var id=sCellId(r,c);h+='<td style="border:1px solid #e5e7eb;padding:0;min-width:80px;height:24px"><input id="ps'+si+'-sc-'+id+'" style="width:100%;height:100%;border:none;outline:none;padding:0 3px;font-size:12px;background:transparent" onblur="psRecalc('+si+')" onchange="personalSheets['+si+'].data[\''+id+'\']=this.value;psRecalc('+si+')"></td>';}
    h+='</tr>';
  }
  t.innerHTML=h;
}

function psRecalc(si) {
  var data = personalSheets[si] ? personalSheets[si].data : {};
  for (var id in data) {
    var el = document.getElementById('ps'+si+'-sc-'+id);
    if (!el) continue;
    if ((data[id]||'').startsWith('=')) {
      try {
        var expr = data[id].substring(1).toUpperCase();
        expr = expr.replace(/SUM\(([^)]+)\)/g, function(m,r){return sExpand(r).map(function(c){return parseFloat(data[c])||0;}).reduce(function(a,b){return a+b;},0);});
        expr = expr.replace(/AVG\(([^)]+)\)/g, function(m,r){var a=sExpand(r).map(function(c){return parseFloat(data[c])||0;});return a.reduce(function(s,v){return s+v;},0)/a.length;});
        expr = expr.replace(/([A-Z]\d+)/g, function(c){return parseFloat(data[c])||0;});
        el.value = Math.round(eval(expr)*1000)/1000;
        el.style.color = '#0653b6';
      } catch(e) { el.value = '#ERR'; el.style.color = '#ef4444'; }
    }
  }
}

function exportPSheetCSV(si) {
  var data = personalSheets[si] ? personalSheets[si].data : {};
  var rows = [];
  for (var r=0;r<8;r++){var row=[];for(var c=0;c<6;c++){var id=sCellId(r,c);row.push(data[id]||'');}rows.push(row.join(','));}
  var blob=new Blob([rows.join('\n')],{type:'text/csv'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(personalSheets[si].name||'sheet')+'.csv';a.click();
  showToast('Đã xuất CSV!','success');
}

// Personal Files upload
function uploadPersonalFile(input) {
  var files = Array.from(input.files);
  files.forEach(function(f) {
    var sz = f.size > 1048576 ? (f.size/1048576).toFixed(1)+'MB' : (f.size/1024).toFixed(0)+'KB';
    personalFiles.push({ id: Date.now(), name: f.name, type: f.type, size: sz, date: new Date().toLocaleDateString('vi-VN'), url: URL.createObjectURL(f) });
  });
  renderPersonalFiles();
  showToast('Đã upload '+files.length+' file (riêng tư)','success');
  input.value = '';
}

function renderPersonalFiles() {
  var list = document.getElementById('personal-files-list');
  if (!list) return;
  if (!personalFiles.length) { list.innerHTML = '<p style="color:#aaa;font-style:italic;text-align:center;padding:20px">Chưa có file nào.</p>'; return; }
  list.innerHTML = personalFiles.map(function(f,i){
    var ico = f.type.startsWith('video/')?'Ἲc':f.type.startsWith('image/')?'Ὓc️':f.name.endsWith('.pdf')?'Ὄ4':f.name.endsWith('.xlsx')||f.name.endsWith('.csv')?'Ὄa':'Ὄ1';
    return '<div style="background:#fff;border-radius:10px;border:1px solid #e5e7eb;display:flex;align-items:center;gap:12px;padding:12px 16px;margin-bottom:10px">' +
      '<span style="font-size:22px">'+ico+'</span>' +
      '<div style="flex:1"><div style="font-weight:600;font-size:13px">'+f.name+'</div><div style="font-size:11px;color:#888">'+f.size+' · '+f.date+'</div></div>' +
      '<a href="'+f.url+'" download="'+f.name+'" class="btn-sm" style="background:#f3f4f6;border:none;text-decoration:none;color:#333;cursor:pointer">⬇️</a>' +
      '<button onclick="publishItem(\'file\','+i+')" class="btn-sm" style="background:#dcfce7;color:#166534;border:none;cursor:pointer;margin-left:4px">὎4 Public</button>' +
      '<button onclick="personalFiles.splice('+i+',1);renderPersonalFiles()" class="btn-sm reject-btn" style="margin-left:4px">🗑️</button>' +
    '</div>';
  }).join('');
}

// Notes
function savePersonalNote() {
  var el = document.getElementById('personal-note');
  if (el) { personalNote = el.value; showToast('Đã lưu ghi chú!','success'); }
}

// PUBLISH to shared space
function publishItem(type, idx) {
  var item, pubItem;
  if (type === 'doc') {
    item = personalDocs[idx];
    pubItem = { id: Date.now(), type:'doc', name: item.name, icon:'Ὅd', author: currentUser?currentUser.name:'', date: new Date().toLocaleDateString('vi-VN'), content: item.content, comments: [] };
  } else if (type === 'sheet') {
    item = personalSheets[idx];
    pubItem = { id: Date.now(), type:'sheet', name: item.name, icon:'Ὄa', author: currentUser?currentUser.name:'', date: new Date().toLocaleDateString('vi-VN'), comments: [] };
  } else if (type === 'file') {
    item = personalFiles[idx];
    var ico = item.type.startsWith('video/')?'Ἲc':item.type.startsWith('image/')?'Ὓc️':'Ὄ1';
    pubItem = { id: Date.now(), type:'file', name: item.name, icon: ico, author: currentUser?currentUser.name:'', date: new Date().toLocaleDateString('vi-VN'), url: item.url, size: item.size, comments: [] };
  }
  if (!pubItem) return;
  publicFiles.unshift(pubItem);
  showToast('✅ Đã public "'+pubItem.name+'" — mọi người có thể thấy trong Quản lý File!','success');
  renderPublicFiles('all');
}

// PUBLIC FILES (shared space)
function renderPublicFiles(filter) {
  var list = document.getElementById('public-files-list');
  if (!list) return;
  var filtered = filter==='all' ? publicFiles : publicFiles.filter(function(f){return f.type===filter;});
  if (!filtered.length) {
    list.innerHTML = '<div style="text-align:center;padding:40px;color:#aaa"><div style="font-size:48px;margin-bottom:12px">Ὄ2</div><p>Chưa có file nào được chia sẻ.</p><p style="font-size:12px;margin-top:8px">Vào <strong>File cá nhân</strong> → bấm <strong>὎4 Public</strong> để chia sẻ.</p></div>';
    return;
  }
  list.innerHTML = filtered.map(function(f,i) {
    var cmts = (f.comments||[]).map(function(c){return '<div style="background:#f0f5ff;border-left:3px solid #1c69d4;padding:6px 10px;border-radius:0 6px 6px 0;font-size:12px;margin-bottom:6px"><strong>'+c.author+':</strong> '+c.text+'</div>';}).join('');
    return '<div style="background:#fff;border-radius:10px;border:1px solid #e5e7eb;overflow:hidden;margin-bottom:14px">' +
      '<div style="padding:14px 16px;display:flex;align-items:center;gap:12px">' +
        '<span style="font-size:24px">'+f.icon+'</span>' +
        '<div style="flex:1"><div style="font-weight:700;font-size:14px">'+f.name+'</div>' +
        '<div style="font-size:11px;color:#888;margin-top:2px">὆4 '+f.author+' · Ὄ5 '+f.date+(f.size?' · '+f.size:'')+'</div></div>' +
        (f.url?'<a href="'+f.url+'" download="'+f.name+'" class="btn-sm" style="background:#e8f0fd;color:#0653b6;border:none;text-decoration:none;cursor:pointer">⬇️ Tải về</a>':'') +
        (currentUser&&['owner','admin'].includes(currentUser.role)?'<button onclick="publicFiles.splice('+i+',1);renderPublicFiles(\'all\')" class="btn-sm reject-btn" style="margin-left:6px">🗑️ Gỡ</button>':'') +
      '</div>' +
      (f.type==='doc'?'<div style="border-top:1px solid #eee;padding:12px 16px;font-size:13px;color:#555;line-height:1.6;max-height:120px;overflow:hidden">'+f.content.replace(/<[^>]+>/g,' ').substring(0,200)+'...</div>':'') +
      '<div style="border-top:1px solid #eee;padding:12px 16px;background:#fafafa">' +
        '<div style="font-size:11px;font-weight:700;color:#888;margin-bottom:8px">Ὂc COMMENTS ('+(f.comments||[]).length+')</div>' +
        cmts +
        '<div style="display:flex;gap:8px"><input id="pub-cmt-'+i+'" style="flex:1;border:1px solid #ddd;border-radius:6px;padding:5px 10px;font-size:12px;outline:none" placeholder="Thêm comment..."><button onclick="addPublicComment('+i+')" style="background:#0891b2;color:#fff;border:none;border-radius:6px;padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer">Gửi</button></div>' +
      '</div></div>';
  }).join('');
}

function addPublicComment(i) {
  var inp = document.getElementById('pub-cmt-'+i);
  var txt = inp ? inp.value.trim() : '';
  if (!txt) return;
  if (!publicFiles[i].comments) publicFiles[i].comments = [];
  publicFiles[i].comments.push({ author: currentUser?currentUser.name:'Khách', text: txt });
  renderPublicFiles('all');
  showToast('Đã gửi comment!','success');
}

function pickGroupIcon(gid, el) {
  openEmojiPicker(function(e) {
    var g = moduleGroups.find(function(x){return x.id===gid;});
    if (g) { g.icon = e; renderModuleGroups(); syncSidebarModules(); }
  }, el);
}
function pickModuleIcon(gid, mid, el) {
  openEmojiPicker(function(e) {
    var g = moduleGroups.find(function(x){return x.id===gid;});
    var m = g && g.modules.find(function(x){return x.id===mid;});
    if (m) { m.icon = e; renderModuleGroups(); syncSidebarModules(); }
  }, el);
}

// ============================================================
// SHARED FILE MANAGER (Public workspace)
// ============================================================
var sharedDocs = [];
var sharedSheets = [];
var sharedFiles = [];
var sharedNote = '';

function switchFilesTab(tab, el) {
  document.querySelectorAll('.files-tab').forEach(function(t){t.style.color='#888';t.style.borderBottomColor='transparent';});
  el.style.color='#0891b2'; el.style.borderBottomColor='#0891b2';
  ['docs','sheets','upload','notes'].forEach(function(t){
    var e=document.getElementById('shared-tab-'+t); if(e) e.style.display=t===tab?'block':'none';
  });
}

// --- SHARED DOCS ---
function createSharedDoc() {
  var name = prompt('Tên tài liệu chung:');
  if (!name) return;
  sharedDocs.push({ id:Date.now(), name:name, content:'<p>Bắt đầu soạn thảo...</p>', date:new Date().toLocaleDateString('vi-VN'), author:currentUser?currentUser.name:'', comments:[] });
  fbSet('/shared/sharedDocs', sharedDocs);
  renderSharedDocs();
  showToast('Đã tạo tài liệu chung: '+name,'success');
}

function renderSharedDocs() {
  var list = document.getElementById('shared-docs-list');
  if (!list) return;
  if (!sharedDocs.length) { list.innerHTML='<p style="color:#aaa;font-style:italic;text-align:center;padding:20px">Chưa có tài liệu nào.</p>'; return; }
  list.innerHTML = sharedDocs.map(function(doc,i) {
    var cmts = (doc.comments||[]).map(function(c){return '<div style="background:#f0f9ff;border-left:3px solid #0891b2;padding:6px 10px;border-radius:0 6px 6px 0;font-size:12px;margin-bottom:5px"><strong>'+c.author+':</strong> '+c.text+'</div>';}).join('');
    return '<div style="background:#fff;border-radius:10px;border:1px solid #e5e7eb;overflow:hidden;margin-bottom:14px">' +
      '<div style="padding:12px 16px;display:flex;align-items:center;gap:10px">' +
        '<span style="font-size:20px">Ὅd</span>' +
        '<div style="flex:1"><div style="font-weight:700;font-size:13px">'+doc.name+'</div><div style="font-size:11px;color:#888">Tạo bởi: '+doc.author+' · '+doc.date+'</div></div>' +
        '<button onclick="toggleSharedDocEditor('+i+')" class="btn-sm" style="background:#e0f2fe;color:#0891b2;border:none;cursor:pointer">✏️ Sửa</button>' +
        '<button onclick="moveDocToPersonal('+i+')" class="btn-sm" style="background:#ede9fe;color:#7c3aed;border:none;cursor:pointer;margin-left:4px">὎5 Cá nhân</button>' +
        '<button onclick="exportSharedDocPDF('+i+')" class="btn-sm" style="background:#fee2e2;color:#ef4444;border:none;cursor:pointer;margin-left:4px">Ὄ4 PDF</button>' +
        (currentUser&&['owner','admin'].includes(currentUser.role)?'<button onclick="sharedDocs.splice('+i+',1);renderSharedDocs()" class="btn-sm reject-btn" style="margin-left:4px">🗑️</button>':'') +
      '</div>' +
      '<div id="sdoc-editor-'+i+'" style="display:none;border-top:1px solid #eee">' +
        '<div style="background:#f8f9fb;padding:6px 12px;display:flex;gap:4px;border-bottom:1px solid #eee">' +
          '<button class="btn-sm" onclick="document.execCommand(\'bold\')"><b>B</b></button>' +
          '<button class="btn-sm" onclick="document.execCommand(\'italic\')"><i>I</i></button>' +
          '<button class="btn-sm" onclick="document.execCommand(\'underline\')"><u>U</u></button>' +
          '<select class="btn-sm" onchange="document.execCommand(\'formatBlock\',false,this.value)"><option value="p">Đoạn</option><option value="h2">H2</option><option value="h3">H3</option></select>' +
          '<button class="btn-sm" onclick="document.execCommand(\'insertUnorderedList\')">• List</button>' +
          '<div style="flex:1"></div>' +
          '<button onclick="saveSharedDoc('+i+')" class="btn-sm approve-btn">Ὃe Lưu</button>' +
        '</div>' +
        '<div id="sdoc-content-'+i+'" contenteditable="true" style="min-height:180px;padding:16px;outline:none;font-size:14px;line-height:1.8">'+doc.content+'</div>' +
      '</div>' +
      '<div style="border-top:1px solid #eee;padding:10px 16px;background:#fafafa">' +
        '<div style="font-size:11px;font-weight:700;color:#888;margin-bottom:6px">Ὂc COMMENTS ('+(doc.comments||[]).length+')</div>' +
        cmts +
        '<div style="display:flex;gap:8px"><input id="sdoc-cmt-'+i+'" style="flex:1;border:1px solid #ddd;border-radius:6px;padding:5px 10px;font-size:12px;outline:none" placeholder="Thêm comment..."><button onclick="addSharedDocComment('+i+')" style="background:#0891b2;color:#fff;border:none;border-radius:6px;padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer">Gửi</button></div>' +
      '</div></div>';
  }).join('');
}

function toggleSharedDocEditor(i) {
  var el = document.getElementById('sdoc-editor-'+i);
  if (el) el.style.display = el.style.display==='none'?'block':'none';
}
function saveSharedDoc(i) {
  var c = document.getElementById('sdoc-content-'+i);
  if (c && sharedDocs[i]) {
    sharedDocs[i].content = c.innerHTML;
    fbSet('/shared/sharedDocs', sharedDocs);
    showToast('Đã lưu!','success');
  }
}
function addSharedDocComment(i) {
  var inp = document.getElementById('sdoc-cmt-'+i);
  if (!inp||!inp.value.trim()) return;
  if (!sharedDocs[i].comments) sharedDocs[i].comments=[];
  sharedDocs[i].comments.push({author:currentUser?currentUser.name:'?', text:inp.value.trim()});
  fbSet('/shared/sharedDocs', sharedDocs);
  renderSharedDocs();
  showToast('Đã gửi comment!','success');
}
function exportSharedDocPDF(i) {
  var doc=sharedDocs[i]; if(!doc) return;
  var w=window.open(''); w.document.write('<html><head><style>body{font-family:Arial;padding:40px;line-height:1.8;}@media print{button{display:none}}</style></head><body><button onclick="window.print()" style="position:fixed;top:10px;right:10px;background:#ef4444;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer">In/PDF</button><h2>'+doc.name+'</h2>'+doc.content+'</body></html>'); w.document.close();
}
function moveDocToPersonal(i) {
  var doc=sharedDocs[i]; if(!doc) return;
  personalDocs.push({id:Date.now(),name:doc.name+' (copy)',content:doc.content,date:new Date().toLocaleDateString('vi-VN'),author:currentUser?currentUser.name:''});
  showToast('Đã sao chép "'+doc.name+'" về File cá nhân!','success');
}

// --- SHARED SHEETS ---
function createSharedSheet() {
  var name=prompt('Tên bảng tính chung:'); if(!name) return;
  sharedSheets.push({id:Date.now(),name:name,date:new Date().toLocaleDateString('vi-VN'),author:currentUser?currentUser.name:'',data:{}});
  fbSet('/shared/sharedSheets', sharedSheets);
  renderSharedSheets(); showToast('Đã tạo bảng tính: '+name,'success');
}
function renderSharedSheets() {
  var list=document.getElementById('shared-sheets-list'); if(!list) return;
  if(!sharedSheets.length){list.innerHTML='<p style="color:#aaa;font-style:italic;text-align:center;padding:20px">Chưa có bảng tính nào.</p>';return;}
  list.innerHTML=sharedSheets.map(function(s,i){
    return '<div style="background:#fff;border-radius:10px;border:1px solid #e5e7eb;padding:12px 16px;display:flex;align-items:center;gap:10px;margin-bottom:10px">' +
      '<span style="font-size:20px">Ὄa</span>' +
      '<div style="flex:1"><div style="font-weight:700;font-size:13px">'+s.name+'</div><div style="font-size:11px;color:#888">'+s.author+' · '+s.date+'</div></div>' +
      '<button onclick="openSharedSheet('+i+')" class="btn-sm" style="background:#e0f2fe;color:#0891b2;border:none;cursor:pointer">✏️ Mở</button>' +
      '<button onclick="moveSheetToPersonal('+i+')" class="btn-sm" style="background:#ede9fe;color:#7c3aed;border:none;cursor:pointer;margin-left:4px">὎5 Cá nhân</button>' +
      (currentUser&&['owner','admin'].includes(currentUser.role)?'<button onclick="sharedSheets.splice('+i+',1);renderSharedSheets()" class="btn-sm reject-btn" style="margin-left:4px">🗑️</button>':'') +
    '</div>';
  }).join('');
}
function openSharedSheet(i) {
  var s=sharedSheets[i]; var editor=document.getElementById('shared-sheet-editor'); if(!editor) return;
  editor.style.display='block';
  editor.innerHTML='<div class="card" style="margin-top:12px"><div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><span style="font-size:18px">📊</span><div style="font-weight:700;font-size:15px">'+s.name+'</div><button onclick="document.getElementById(\'shared-sheet-editor\').style.display=\'none\'" style="margin-left:auto;background:#f3f4f6;border:none;border-radius:6px;padding:4px 10px;cursor:pointer">✕</button></div><div style="overflow:auto"><table id="ss'+i+'" style="border-collapse:collapse;min-width:100%"></table></div><div style="display:flex;gap:8px;margin-top:8px"><button onclick="exportSSCSV('+i+')" style="background:#217346;color:#fff;border:none;border-radius:7px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer">⬇️ CSV</button><button onclick="moveSheetToPersonal('+i+')" style="background:#ede9fe;color:#7c3aed;border:none;border-radius:7px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer">📋 Cá nhân</button></div></div>';
  buildSSSheet(i);
}

function buildSSSheet(si) {
  var t = document.getElementById('ss' + si);
  if (!t) return;
  var R=8,C=6,h='<tr><th style="background:#f1f3f5;border:1px solid #d1d5db;width:36px;height:22px;font-size:10px;position:sticky;top:0;left:0;z-index:3"></th>';
  for(var c=0;c<C;c++) h+='<th style="background:#f1f3f5;border:1px solid #d1d5db;width:80px;height:22px;text-align:center;font-size:10px;font-weight:700;color:#6b7280;position:sticky;top:0">'+colL(c)+'</th>';
  h+='</tr>';
  for(var r=0;r<R;r++){
    h+='<tr><td style="background:#f1f3f5;border:1px solid #d1d5db;text-align:center;font-size:10px;color:#6b7280;font-weight:700;position:sticky;left:0;min-width:30px;padding:0 4px">'+(r+1)+'</td>';
    for(var c=0;c<C;c++){var id=sCellId(r,c);h+='<td style="border:1px solid #e5e7eb;padding:0;min-width:80px;height:24px"><input id="ss'+si+'-sc-'+id+'" style="width:100%;height:100%;border:none;outline:none;padding:0 3px;font-size:12px;background:transparent" onblur="ssRecalc('+si+')" onchange="sharedSheets['+si+'].data[\''+id+'\']=this.value;ssRecalc('+si+')"></td>';}
    h+='</tr>';
  }
  t.innerHTML=h;
  var data = sharedSheets[si] ? sharedSheets[si].data : {};
  for(var id in data){var el=document.getElementById('ss'+si+'-sc-'+id);if(el)el.value=data[id];}
}

function ssRecalc(si) {
  var data = sharedSheets[si] ? sharedSheets[si].data : {};
  for (var id in data) {
    var el = document.getElementById('ss'+si+'-sc-'+id);
    if (!el) continue;
    if ((data[id]||'').startsWith('=')) {
      try {
        var expr = data[id].substring(1).toUpperCase();
        expr = expr.replace(/SUM\(([^)]+)\)/g, function(m,r){return sExpand(r).map(function(c){return parseFloat(data[c])||0;}).reduce(function(a,b){return a+b;},0);});
        expr = expr.replace(/AVG\(([^)]+)\)/g, function(m,r){var a=sExpand(r).map(function(c){return parseFloat(data[c])||0;});return a.reduce(function(s,v){return s+v;},0)/a.length;});
        expr = expr.replace(/([A-Z]\d+)/g, function(c){return parseFloat(data[c])||0;});
        el.value = Math.round(eval(expr)*1000)/1000;
        el.style.color = '#0653b6';
      } catch(e) { el.value = '#ERR'; el.style.color = '#ef4444'; }
    }
  }
}

function exportSSCSV(si) {
  var data = sharedSheets[si] ? sharedSheets[si].data : {};
  var rows = [];
  for (var r=0;r<8;r++){var row=[];for(var c=0;c<6;c++){var id=sCellId(r,c);row.push(data[id]||'');}rows.push(row.join(','));}
  var blob=new Blob([rows.join('\n')],{type:'text/csv'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(sharedSheets[si].name||'sheet')+'.csv';a.click();
  showToast('Đã xuất CSV!','success');
}

function moveSheetToPersonal(i) {
  var s=sharedSheets[i]; if(!s) return;
  personalSheets.push({id:Date.now(),name:s.name+' (copy)',date:new Date().toLocaleDateString('vi-VN'),author:currentUser?currentUser.name:'',data:Object.assign({},s.data)});
  showToast('Đã sao chép "'+s.name+'" về File cá nhân!','success');
}
