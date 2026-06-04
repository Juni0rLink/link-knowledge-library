
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

// Preload search index in background
(function() {
  var SEARCH_CACHE = 'lkl_search_index';
  var SEARCH_TS = 'lkl_search_ts';
  var SEARCH_TTL = 3600000; // 1 hour
  try {
    var cached = sessionStorage.getItem(SEARCH_CACHE);
    var ts = parseInt(sessionStorage.getItem(SEARCH_TS) || '0');
    if (cached && Date.now() - ts < SEARCH_TTL) {
      searchIndex = JSON.parse(cached);
      return;
    }
  } catch(e) {}
  fetch('search-index.json')
    .then(function(r){ return r.json(); })
    .then(function(data){
      searchIndex = data;
      try {
        sessionStorage.setItem(SEARCH_CACHE, JSON.stringify(data));
        sessionStorage.setItem(SEARCH_TS, Date.now().toString());
      } catch(e) {}
    }).catch(function(){});
})();

// Load all shared data from Firebase with sessionStorage cache
function fbLoadAll(onDone) {
  var CACHE_KEY = 'lkl_shared_cache';
  var CACHE_TS  = 'lkl_shared_ts';
  var TTL = 60000; // 60s cache

  function applyData(data) {
    if (!data) return;
    if (data.news && Array.isArray(data.news)) newsItems = data.news;
    if (data.sharedDocs && Array.isArray(data.sharedDocs)) sharedDocs = data.sharedDocs;
    if (data.sharedSheets && Array.isArray(data.sharedSheets)) sharedSheets = data.sharedSheets;
    if (data.sharedFiles && Array.isArray(data.sharedFiles) && data.sharedFiles.length > 0) sharedFiles = data.sharedFiles;
    if (data.sharedNote) sharedNote = data.sharedNote;
    if (data.moduleGroups && Array.isArray(data.moduleGroups)) moduleGroups = data.moduleGroups;
    if (data.publicFiles && Array.isArray(data.publicFiles)) publicFiles = data.publicFiles;
    if (data.pendingRegs && Array.isArray(data.pendingRegs)) pendingRegs = data.pendingRegs;
  }

  // Try cache first
  try {
    var cached = sessionStorage.getItem(CACHE_KEY);
    var ts = parseInt(sessionStorage.getItem(CACHE_TS) || '0');
    if (cached && Date.now() - ts < TTL) {
      applyData(JSON.parse(cached));
      if (onDone) onDone();
      // Refresh in background
      fbGet('/shared', function(err, data) {
        if (!err && data) {
          applyData(data);
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
          sessionStorage.setItem(CACHE_TS, Date.now().toString());
        }
      });
      return;
    }
  } catch(e) {}

  fbGet('/shared', function(err, data) {
    if (err || !data) { if(onDone) onDone(); return; }
    applyData(data);
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
      sessionStorage.setItem(CACHE_TS, Date.now().toString());
    } catch(e) {}
    if (onDone) onDone();
  });
}

// Invalidate cache when data changes
function fbClearCache() {
  try { sessionStorage.removeItem('lkl_shared_cache'); sessionStorage.removeItem('lkl_shared_ts'); } catch(e) {}
}

// Save shared data to Firebase
// ── OPTIMIZED PERSONAL STORAGE ──
// Metadata (light): id, name, icon, date, notes — saved in /personalData
// Content (heavy): HTML rich text — saved separately in /itemContent/{itemId}

function fbSavePersonal() {
  if (!currentUser || !currentUser.uid) return;
  // Strip content from modules before saving metadata
  var lightModules = personalModules.map(function(m) {
    return {
      id: m.id, name: m.name, icon: m.icon, date: m.date,
      items: (m.items||[]).map(function(item) {
        return { id: item.id, name: item.name, icon: item.icon, date: item.date, notes: item.notes||'' };
        // content saved separately via fbSaveItemContent
      })
    };
  });
  fbSet('/users/' + currentUser.uid + '/personalData', {
    modules: lightModules,
    files: personalFiles,
    note: personalNote
  });
}

function fbSaveItemContent(itemId, content) {
  if (!currentUser || !currentUser.uid) return;
  fbSet('/users/' + currentUser.uid + '/itemContent/' + itemId, { html: content, updated: Date.now() });
}

function fbLoadItemContent(itemId, cb) {
  if (!currentUser || !currentUser.uid) { cb(''); return; }
  fbGet('/users/' + currentUser.uid + '/itemContent/' + itemId, function(err, data) {
    cb((!err && data && data.html) ? data.html : '');
  });
}

function fbDeleteItemContent(itemId) {
  if (!currentUser || !currentUser.uid) return;
  fbDelete('/users/' + currentUser.uid + '/itemContent/' + itemId);
}

function fbSaveNews()         { fbClearCache(); fbSet('/shared/news', newsItems); }
function fbSaveSharedDocs()   { fbClearCache(); fbSet('/shared/sharedDocs', sharedDocs); }
function fbSaveSharedSheets() { fbClearCache(); fbSet('/shared/sharedSheets', sharedSheets); }
function fbSaveSharedFiles()  { fbClearCache(); fbSet('/shared/sharedFiles', sharedFiles); }
function fbSaveSharedNote()   { fbClearCache(); fbSet('/shared/sharedNote', sharedNote); }
function fbSaveModules()      { fbClearCache(); fbSet('/shared/moduleGroups', moduleGroups); }
function fbSavePublicFiles()  { fbClearCache(); fbSet('/shared/publicFiles', publicFiles); }

// ============================================================
// DATA
// ============================================================
// ── Personal & Shared data arrays ──
var personalDocs = [];
var personalSheets = [];
var personalFiles = [];
var personalModules = [];
var personalNote = '';
var sharedDocs = [];
var sharedSheets = [];
var sharedNote = '';
var publicFiles = [];
var CONTENT_BASE = 'https://juni0rlink.github.io/link-knowledge-library/content/';
var DEFAULT_SHARED_FILES = [
  { id:1001, name:'GSC Software Structure', file:'GSC Software structure.pptx', type:'pptx', icon:'🏗️', category:'GSC Modules', author:'LINK Group', date:'01/06/2024', size:'~2MB' },
  { id:1002, name:'GSC Phase Concept', file:'GSC Module Phase concept.pptx', type:'pptx', icon:'🔄', category:'GSC Modules', author:'LINK Group', date:'01/06/2024', size:'~3MB' },
  { id:1003, name:'GSC Module Safety', file:'GSC Module Safety.pptx', type:'pptx', icon:'🛡️', category:'GSC Modules', author:'LINK Group', date:'01/06/2024', size:'~1MB' },
  { id:1004, name:'GSC Module SAS', file:'GSC Module SAS.pptx', type:'pptx', icon:'⚙️', category:'GSC Modules', author:'LINK Group', date:'01/06/2024', size:'~2MB' },
  { id:1005, name:'GSC User Sequence', file:'GSC Module User sequence.pptx', type:'pptx', icon:'📋', category:'GSC Modules', author:'LINK Group', date:'01/06/2024', size:'~1MB' },
  { id:1006, name:'GSC Type Management', file:'GSC Type management.pptx', type:'pptx', icon:'🗂️', category:'GSC Modules', author:'LINK Group', date:'01/06/2024', size:'~1MB' },
  { id:2001, name:'Manual Cover A1HG01', file:'MAN_00101_Manual_Cover.docx', type:'docx', icon:'📄', category:'Operation Manual A1HG01', author:'LINK Group', date:'01/06/2024', size:'<1MB' },
  { id:2002, name:'Manual General', file:'MAN_00201_Manual_General.docx', type:'docx', icon:'📋', category:'Operation Manual A1HG01', author:'LINK Group', date:'01/06/2024', size:'<1MB' },
  { id:2003, name:'Manual LINE', file:'MAN_00301_Manual_LINE.docx', type:'docx', icon:'🏭', category:'Operation Manual A1HG01', author:'LINK Group', date:'01/06/2024', size:'<1MB' },
  { id:2004, name:'Manual PLC', file:'MAN_00401_Manual_PLC.docx', type:'docx', icon:'💻', category:'Operation Manual A1HG01', author:'LINK Group', date:'01/06/2024', size:'<1MB' },
  { id:2005, name:'SG01 – ST700', file:'MAN_00501_Manual_SG01.docx', type:'docx', icon:'🔲', category:'Operation Manual A1HG01', author:'LINK Group', date:'01/06/2024', size:'<1MB' },
  { id:2006, name:'SG02 – ST710', file:'MAN_00601_Manual_SG02.docx', type:'docx', icon:'🔲', category:'Operation Manual A1HG01', author:'LINK Group', date:'01/06/2024', size:'<1MB' },
  { id:2007, name:'SG04 – ST711', file:'MAN_00602_Manual_SG04.docx', type:'docx', icon:'🔲', category:'Operation Manual A1HG01', author:'LINK Group', date:'01/06/2024', size:'<1MB' },
  { id:2008, name:'SG06 – ST712', file:'MAN_00603_Manual_SG06.docx', type:'docx', icon:'🔲', category:'Operation Manual A1HG01', author:'LINK Group', date:'01/06/2024', size:'<1MB' },
  { id:2009, name:'SG03 – ST030', file:'MAN_00701_Manual_SG03.docx', type:'docx', icon:'🔧', category:'Operation Manual A1HG01', author:'LINK Group', date:'01/06/2024', size:'<1MB' },
  { id:2010, name:'SG05 – ST031', file:'MAN_00702_Manual_SG05.docx', type:'docx', icon:'🔧', category:'Operation Manual A1HG01', author:'LINK Group', date:'01/06/2024', size:'<1MB' },
  { id:2011, name:'SG07 – ST032', file:'MAN_00703_Manual_SG07.docx', type:'docx', icon:'🔧', category:'Operation Manual A1HG01', author:'LINK Group', date:'01/06/2024', size:'<1MB' },
  { id:2012, name:'SG08 – ST719', file:'MAN_00801_Manual_SG08.docx', type:'docx', icon:'🔲', category:'Operation Manual A1HG01', author:'LINK Group', date:'01/06/2024', size:'<1MB' },
  { id:2013, name:'SG09 – ST720', file:'MAN_00901_Manual_SG09.docx', type:'docx', icon:'🔲', category:'Operation Manual A1HG01', author:'LINK Group', date:'01/06/2024', size:'<1MB' },
  { id:2014, name:'SG10 – ST050 UV', file:'MAN_01001_Manual_SG10.docx', type:'docx', icon:'💡', category:'Operation Manual A1HG01', author:'LINK Group', date:'01/06/2024', size:'<1MB' },
  { id:2015, name:'SG11 – ST730', file:'MAN_01101_Manual_SG11.docx', type:'docx', icon:'🔲', category:'Operation Manual A1HG01', author:'LINK Group', date:'01/06/2024', size:'<1MB' },
  { id:2016, name:'SG12 – ST739', file:'MAN_01201_Manual_SG12.docx', type:'docx', icon:'🔲', category:'Operation Manual A1HG01', author:'LINK Group', date:'01/06/2024', size:'<1MB' },
];
var sharedFiles = DEFAULT_SHARED_FILES.slice();

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
    sessionStorage.setItem('lkl_id_token', data.idToken || '');
    fbGet('/users/' + uid, function(e2, profile) {
      if (profile && profile.role) {
        currentUser = { email: email, name: profile.name || email, role: profile.role, uid: uid };
      } else {
        currentUser = { email: email, name: email.split('@')[0], role: 'colleague', uid: uid };
      }
      launchApp();
    });
  });
}

function doChangePassword() {
  var np = document.getElementById('change-pass-new').value;
  var cp = document.getElementById('change-pass-confirm').value;
  var msg = document.getElementById('change-pass-msg');
  msg.style.display = 'none';
  if (!np || np.length < 6) {
    msg.style.cssText = 'display:block;background:#fee2e2;color:#dc2626;font-size:12px;padding:8px;border-radius:6px';
    msg.textContent = 'Mật khẩu tối thiểu 6 ký tự'; return;
  }
  if (np !== cp) {
    msg.style.cssText = 'display:block;background:#fee2e2;color:#dc2626;font-size:12px;padding:8px;border-radius:6px';
    msg.textContent = 'Mật khẩu nhập lại không khớp'; return;
  }
  var key = currentUser && currentUser.email ? localStorage.getItem('claude-api-key') : null;
  // Use Firebase Auth REST to change password
  var idToken = sessionStorage.getItem('lkl_id_token');
  if (!idToken) {
    msg.style.cssText = 'display:block;background:#fee2e2;color:#dc2626;font-size:12px;padding:8px;border-radius:6px';
    msg.textContent = 'Phiên đăng nhập hết hạn. Vui lòng đăng xuất và đăng nhập lại.'; return;
  }
  fetch('https://identitytoolkit.googleapis.com/v1/accounts:update?key=' + FB_API_KEY, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ idToken: idToken, password: np, returnSecureToken: true })
  }).then(function(r){ return r.json(); }).then(function(d) {
    if (d.error) {
      msg.style.cssText = 'display:block;background:#fee2e2;color:#dc2626;font-size:12px;padding:8px;border-radius:6px';
      msg.textContent = 'Lỗi: ' + d.error.message;
    } else {
      sessionStorage.setItem('lkl_id_token', d.idToken || idToken);
      msg.style.cssText = 'display:block;background:#dcfce7;color:#166534;font-size:12px;padding:8px;border-radius:6px';
      msg.textContent = '✅ Đã đổi mật khẩu thành công!';
      document.getElementById('change-pass-new').value = '';
      document.getElementById('change-pass-confirm').value = '';
    }
  });
}

function renderProfileCard() {
  if (!currentUser) return;
  var n = document.getElementById('profile-name-display');
  var e = document.getElementById('profile-email-display');
  var r = document.getElementById('profile-role-display');
  if (n) n.textContent = currentUser.name || '—';
  if (e) e.textContent = currentUser.email || '—';
  if (r) {
    var cfg = ROLE_CFG[currentUser.role] || ROLE_CFG.viewer;
    r.innerHTML = '<span class="role-badge ' + cfg.cls + '">' + cfg.label + '</span>';
  }
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
    var profile = { name: name, email: email, dept: dept, reason: reason, role: 'colleague', status: 'pending', time: new Date().toLocaleString('vi-VN') };
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

  // Sidebar modules — tất cả role (trừ viewer) đều thấy
  if (isColleague) {
    syncSidebarModules();
  }

  if (isAdmin) {
    var navAdmin = document.getElementById('nav-admin');
    if (navAdmin) navAdmin.style.display = 'flex';
    var navMod = document.getElementById('nav-modules');
    if (navMod) navMod.style.display = 'flex';
    var navTrash = document.getElementById('nav-trash');
    if (navTrash) navTrash.style.display = 'flex';
    renderModuleGroups();
    updateRegBadge();
    loadFirebaseMembers();
  }

  if (!isAdmin) {
    var sNav = document.getElementById('nav-settings');
    if (sNav) {
      sNav.onclick = function() { showToast('Chỉ Admin mới vào được Cài đặt', 'warning'); };
    }
  }


  // Load shared data from Firebase then render
  fbLoadAll(function() {
    renderNews();
    renderSharedFiles();
    syncSidebarModules();
    populateCategoryDropdown();
    if (isAdmin) { renderModuleGroups(); }
  });

  // Load personal data from Firebase (per user)
  if (isColleague && currentUser.uid) {
    fbGet('/users/' + currentUser.uid + '/personalData', function(err, data) {
      if (err || !data) return;
      if (data.modules && Array.isArray(data.modules)) {
    personalModules = data.modules.map(function(m){
      if (!m.items) m.items = [];
      // items loaded without content (content lives in /itemContent)
      return m;
    });
    renderPersonalModulesGrid();
  }
      if (data.files && Array.isArray(data.files)) { personalFiles = data.files; renderPersonalFiles(); }
      if (data.note) { personalNote = data.note; var n=document.getElementById('personal-note'); if(n) n.value=data.note; }
    });
  }

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
    setTimeout(function(){ if(typeof renderStorageWidget === 'function') renderStorageWidget('home-storage-widget'); }, 500);
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

// ── EXTRACTIVE SUMMARIZATION ──
function extractSummary(topResults, words) {
  // Split each result into sentences, score by keyword density
  var sentences = [];
  topResults.slice(0, 5).forEach(function(r) {
    var sents = r.item.text.split(/[.!?]\s+/).filter(function(s){ return s.trim().length > 30; });
    sents.forEach(function(s) {
      var sl = s.toLowerCase();
      var score = 0;
      words.forEach(function(w){ if(sl.includes(w)) score += 3; });
      // Bonus for sentences with action words
      if (/how|cách|bước|step|must|phải|cần|need|use|dùng|create|tạo|configure|cấu hình/i.test(s)) score += 2;
      if (score > 0) sentences.push({ text: s.trim(), score: score, source: r.item.source, file: r.item.file });
    });
  });
  sentences.sort(function(a,b){ return b.score - a.score; });
  // Deduplicate similar sentences
  var seen = [], final = [];
  sentences.slice(0, 6).forEach(function(s) {
    var key = s.text.substring(0, 40);
    if (!seen.includes(key)) { seen.push(key); final.push(s); }
  });
  return final.slice(0, 4);
}

function doKnowledgeSearch() {
  var q = document.getElementById('ks-input').value.trim().toLowerCase();
  var results = document.getElementById('ks-results');
  if (!q) { results.innerHTML = '<p style="color:#aaa;text-align:center;padding:20px">Nhập câu hỏi hoặc từ khóa...</p>'; return; }
  results.innerHTML = '<div style="padding:16px;color:#888;display:flex;align-items:center;gap:8px"><div style="width:16px;height:16px;border:2px solid #1d4ed8;border-top-color:transparent;border-radius:50%;animation:spin .8s linear infinite"></div> Đang phân tích...</div>';

  loadSearchIndex(function(idx) {
    var words = q.split(/\s+/).filter(Boolean);
    var scored = idx.map(function(item) {
      var t = item.text.toLowerCase();
      var s = item.source.toLowerCase();
      var score = 0;
      words.forEach(function(w){
        var re = new RegExp(w, 'gi');
        var matches = (t.match(re)||[]).length;
        score += matches * 2;
        if (s.includes(w)) score += 1;
      });
      return { item: item, score: score };
    }).filter(function(x){ return x.score > 0; })
      .sort(function(a,b){ return b.score - a.score; })
      .slice(0, 15);

    if (!scored.length) {
      results.innerHTML = '<div style="text-align:center;padding:30px;color:#aaa"><div style="font-size:40px;margin-bottom:10px">🔍</div><p style="font-weight:700;color:#555">Không tìm thấy kết quả</p><p style="font-size:12px;margin-top:6px">Thử: E-STOP, TYPE_DECO_FB, SAS fixture, UV curing, safety zone, RESEQ...</p></div>';
      return;
    }

    var html = '';

    // ── SMART ANSWER BOX ──
    var summary = extractSummary(scored, words);
    if (summary.length > 0) {
      var srcSet = {};
      summary.forEach(function(s){ srcSet[s.source] = s.file; });
      var srcLinks = Object.keys(srcSet).map(function(src) {
        var fUrl = 'https://juni0rlink.github.io/link-knowledge-library/content/' + encodeURIComponent(srcSet[src]);
        return '<a href="https://view.officeapps.live.com/op/view.aspx?src='+fUrl+'" target="_blank" style="background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:10px;font-size:11px;text-decoration:none;font-weight:700">📄 '+src+'</a>';
      }).join(' ');

      html += '<div style="background:linear-gradient(135deg,#eff6ff,#f0fdf4);border:1px solid #bfdbfe;border-radius:12px;padding:16px 18px;margin-bottom:16px">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">' +
          '<div style="background:#1d4ed8;color:#fff;border-radius:8px;padding:4px 10px;font-size:12px;font-weight:700">💡 Tổng hợp từ tài liệu</div>' +
          '<div style="font-size:11px;color:#888">Trích xuất tự động · không cần AI</div>' +
        '</div>' +
        '<ul style="margin:0 0 10px 18px;padding:0">' +
        summary.map(function(s) {
          var highlighted = s.text;
          words.forEach(function(w){
            var re = new RegExp('('+w+')', 'gi');
            highlighted = highlighted.replace(re, '<mark style="background:#fef08a;padding:0 2px;border-radius:2px;font-weight:600">$1</mark>');
          });
          return '<li style="font-size:13px;color:#1e3a5f;line-height:1.7;margin-bottom:6px">'+highlighted+'</li>';
        }).join('') +
        '</ul>' +
        '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">' +
          '<span style="font-size:11px;color:#888">Nguồn:</span>' + srcLinks +
        '</div>' +
      '</div>';
    }

    // ── SEARCH RESULTS ──
    html += '<div style="font-size:12px;color:#888;margin-bottom:10px">📋 <strong>'+scored.length+'</strong> đoạn liên quan đến "<strong>'+q+'</strong>"</div>';

    scored.forEach(function(r) {
      var item = r.item;
      var fileUrl = 'https://juni0rlink.github.io/link-knowledge-library/content/' + encodeURIComponent(item.file);
      var viewUrl = 'https://view.officeapps.live.com/op/view.aspx?src=' + fileUrl;
      var excerpt = item.text;
      words.forEach(function(w){
        var re = new RegExp('('+w+')', 'gi');
        excerpt = excerpt.replace(re, '<mark style="background:#fef08a;padding:0 2px;border-radius:2px;font-weight:600">$1</mark>');
      });
      excerpt = excerpt.slice(0, 280) + (item.text.length > 280 ? '...' : '');
      html += '<div style="background:#fff;border-radius:10px;border:1px solid #e5e7eb;padding:12px 16px;margin-bottom:8px">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
          '<span style="font-size:11px;font-weight:700;background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:10px">'+item.source+'</span>' +
          '<span style="font-size:11px;color:#aaa">'+item.page+'</span>' +
          '<div style="margin-left:auto;display:flex;gap:5px">' +
            '<a href="'+viewUrl+'" target="_blank" style="font-size:11px;background:#e0f2fe;color:#0369a1;padding:3px 8px;border-radius:6px;text-decoration:none;font-weight:700">👁️ Xem</a>' +
            '<a href="'+fileUrl+'" download style="font-size:11px;background:#dcfce7;color:#15803d;padding:3px 8px;border-radius:6px;text-decoration:none;font-weight:700">⬇️ Tải</a>' +
          '</div>' +
        '</div>' +
        '<div style="font-size:13px;color:#374151;line-height:1.65">'+excerpt+'</div>' +
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
  if (id === 'trash') { renderTrash(); renderStorageWidget('storage-widget'); renderCleanupPanel(); renderBackupPanel(); }
  if (id === 'files') { renderSharedDocs(); renderSharedSheets(); renderSharedFileList(); renderPublicModulesGrid(); }
  if (id === 'myfiles') { renderPersonalDocs(); renderPersonalSheets(); renderPersonalFiles(); }
  if (id === 'admin') { renderRegRequests(); loadFirebaseMembers(); }
  if (id === 'settings') { renderProfileCard(); }
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
  var isOwner = currentUser && currentUser.role === 'owner';
  list.innerHTML = pendingRegs.map(function(r) {
    var roleOptions = '<option value="colleague">👥 Colleague</option>';
    if (isOwner) roleOptions += '<option value="admin">🔑 Admin</option>';
    return '<div class="reg-item" id="reg-' + r.id + '">' +
      '<div class="reg-name">' + r.name + '</div>' +
      '<div class="reg-detail">' + r.email + ' | ' + r.dept + '</div>' +
      '<div class="reg-detail">' + (r.reason ? '💬 ' + r.reason + ' · ' : '') + r.time + '</div>' +
      '<div class="reg-actions">' +
      '<span style="font-size:12px;font-weight:600">Phân quyền:</span>' +
      '<select class="assign-select" id="role-sel-' + r.id + '">' + roleOptions + '</select>' +
      '<button class="btn-sm approve-btn" onclick="acceptReg(\'' + r.id + '\')">✅ Chấp nhận</button>' +
      '<button class="btn-sm reject-btn" onclick="rejectReg(\'' + r.id + '\')">❌ Từ chối</button>' +
      '</div></div>';
  }).join('');
}

function acceptReg(id) {
  var reg = pendingRegs.find(function(r) { return r.id == id; });
  if (!reg) return;
  var roleSel = document.getElementById('role-sel-' + id);
  var chosenRole = roleSel ? roleSel.value : 'colleague';
  // Update role in Firebase DB
  fbSet('/users/' + id + '/role', chosenRole);
  fbSet('/users/' + id + '/status', 'active');
  addMemberRow(reg.name, reg.email, chosenRole);
  showToast('✅ Đã cấp quyền ' + chosenRole + ' cho ' + reg.name, 'success');
  pendingRegs = pendingRegs.filter(function(r) { return r.id != id; });
  fbSet('/shared/pendingRegs', pendingRegs);
  updateRegBadge();
  renderRegRequests();
}

function rejectReg(id) {
  var reg = pendingRegs.find(function(r) { return r.id === id; });
  pendingRegs = pendingRegs.filter(function(r) { return r.id !== id; });
  showToast('Đã từ chối yêu cầu của ' + (reg ? reg.name : ''), 'error');
  updateRegBadge();
}

function loadFirebaseMembers() {
  var container = document.getElementById('member-rows');
  if (!container) return;
  fbGet('/users', function(err, data) {
    if (err || !data) return;
    container.innerHTML = '';
    Object.keys(data).forEach(function(uid) {
      var u = data[uid];
      if (!u || !u.email) return;
      var cfg = ROLE_CFG[u.role] || ROLE_CFG.viewer;
      var isOwnerUser = u.role === 'owner';
      var canEdit = currentUser && currentUser.role === 'owner' && !isOwnerUser;
      var roleSelect = canEdit
        ? '<select onchange="changeUserRole(\'' + uid + '\',this.value)" style="border:1px solid #ddd;border-radius:6px;padding:3px 6px;font-size:12px">' +
          ['owner','admin','colleague'].map(function(r){
            return '<option value="'+r+'"'+(u.role===r?' selected':'')+'>'+ROLE_CFG[r].label+'</option>';
          }).join('') + '</select>'
        : '<span class="role-badge ' + cfg.cls + '">' + cfg.label + '</span>';
      var tr = document.createElement('tr');
      tr.innerHTML = '<td><strong>' + (u.name||u.email.split('@')[0]) + '</strong></td>' +
        '<td style="font-size:12px;color:#888">' + u.email + '</td>' +
        '<td>' + roleSelect + '</td>' +
        '<td>' + (isOwnerUser ? '—' : (canEdit ? '<button class="btn-sm reject-btn" onclick="removeUser(\''+uid+'\')">🗑️</button>' : '')) + '</td>';
      container.appendChild(tr);
    });
  });
}

function changeUserRole(uid, newRole) {
  fbSet('/users/' + uid + '/role', newRole);
  showToast('Đã cập nhật vai trò', 'success');
  fbClearCache();
}

function removeUser(uid) {
  if (!confirm('Xóa người dùng này?')) return;
  fbDelete('/users/' + uid);
  loadFirebaseMembers();
  showToast('Đã xóa người dùng', 'error');
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
function switchMgmtTab(tab, el) {
  document.querySelectorAll('.mgmt-tab').forEach(function(t){t.style.color='#888';t.style.borderBottomColor='transparent';});
  el.style.color='#0891b2'; el.style.borderBottomColor='#0891b2';
  ['modules','files','modulefiles'].forEach(function(t){var d=document.getElementById('mgmt-tab-'+t);if(d)d.style.display=t===tab?'block':'none';});
  if(tab==='files') renderMgmtFiles();
  if(tab==='modulefiles') renderMgmtModuleFiles();
}

function renderMgmtFiles() {
  var list = document.getElementById('mgmt-files-list'); if(!list) return;
  var count = document.getElementById('mgmt-file-count');
  if(count) count.textContent = sharedFiles.length + ' files';
  if(!sharedFiles.length){list.innerHTML='<p style="color:#aaa;text-align:center;padding:20px">Chưa có file nào.</p>';return;}
  var cats={};
  sharedFiles.forEach(function(f,i){var cat=f.category||'Khác';if(!cats[cat])cats[cat]=[];cats[cat].push({f:f,i:i});});
  list.innerHTML = Object.keys(cats).map(function(cat){
    return '<div style="margin-bottom:16px">'
      +'<div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;padding:6px 10px;background:#f1f5f9;border-radius:6px;margin-bottom:6px">'+cat+' ('+cats[cat].length+')</div>'
      + cats[cat].map(function(x){
          var f=x.f, i=x.i;
          return '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:#fff;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:4px">'
            +'<span style="font-size:18px">'+(f.icon||'📄')+'</span>'
            +'<div style="flex:1"><div style="font-weight:600;font-size:13px">'+(f.name||f.file||'')+'</div>'
            +'<div style="font-size:11px;color:#94a3b8">'+(f.author||'')+(f.date?' · '+f.date:'')+(f.size?' · '+f.size:'')+'</div></div>'
            +'<select onchange="changeFileCategory('+i+',this.value)" style="border:1px solid #e5e7eb;border-radius:6px;padding:4px 6px;font-size:11px;color:#475569">'
            + moduleGroups.map(function(g){return '<option value="'+g.name+'"'+(f.category===g.name?' selected':'')+'>'+g.name+'</option>';}).join('')
            +'<option value="Training"'+(f.category==='Training'?' selected':'')+'>Training</option>'
            +'<option value="Khác"'+(f.category==='Khác'?' selected':'')+'>Khác</option>'
            +'</select>'
            +'<button onclick="deleteSharedFileByIndex('+i+')" style="background:#fee2e2;color:#ef4444;border:none;border-radius:6px;padding:5px 8px;font-size:11px;cursor:pointer;margin-left:4px">🗑️ Xóa</button>'
            +'</div>';
        }).join('')
      +'</div>';
  }).join('');
}

function changeFileCategory(index, newCat) {
  if (sharedFiles[index]) { sharedFiles[index].category = newCat; fbSaveSharedFiles(); fbClearCache(); showToast('Đã đổi phân vùng','success'); }
}

function deleteSharedFileByIndex(index) {
  var f = sharedFiles[index]; if (!f) return;
  if (!confirm('Xóa file "' + (f.name||f.file) + '"?')) return;
  sharedFiles.splice(index, 1);
  fbSaveSharedFiles(); fbClearCache(); renderMgmtFiles();
  showToast('Đã xóa: ' + (f.name||f.file), 'error');
}

function renderMgmtModuleFiles() {
  var list = document.getElementById('mgmt-module-files-list'); if(!list) return;
  list.innerHTML = '<div style="color:#aaa;text-align:center;padding:16px">Đang tải...</div>';
  fbGet('/moduleData', function(err, data) {
    if (err || !data) { list.innerHTML='<div style="color:#aaa;text-align:center;padding:20px">Chưa có file nào trong module.</div>'; return; }
    var html = '';
    Object.keys(data).forEach(function(mid) {
      var files = data[mid] && data[mid].files;
      if (!files || !files.length) return;
      var modName = mid;
      moduleGroups.forEach(function(g){ (g.modules||[]).forEach(function(m){ if(String(m.id)===String(mid)) modName=m.name; }); });
      html += '<div style="margin-bottom:16px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">'
        +'<div style="padding:10px 14px;background:#f8f9fb;border-bottom:1px solid #e5e7eb;font-weight:700;font-size:13px;color:#1e293b">📦 '+modName+'</div>'
        + files.map(function(f, fi) {
            return '<div style="display:flex;align-items:center;gap:10px;padding:8px 14px;border-bottom:1px solid #f5f5f5">'
              +'<span style="font-size:16px">📎</span>'
              +'<div style="flex:1"><div style="font-weight:600;font-size:13px">'+f.name+'</div>'
              +'<div style="font-size:11px;color:#94a3b8">'+f.author+' · '+f.date+'</div></div>'
              +'<a href="'+f.url+'" target="_blank" style="background:#e0f2fe;color:#0369a1;border:none;border-radius:6px;padding:4px 8px;font-size:11px;font-weight:700;text-decoration:none">👁️</a>'
              +'<button onclick="deleteModuleFile(\''+mid+'\','+fi+')" style="background:#fee2e2;color:#ef4444;border:none;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;margin-left:4px">🗑️</button>'
              +'</div>';
          }).join('')
        +'</div>';
    });
    list.innerHTML = html || '<div style="color:#aaa;text-align:center;padding:20px">Chưa có file nào trong module.</div>';
  });
}

function deleteModuleFile(mid, fi) {
  fbGet('/moduleData/'+mid+'/files', function(err, files) {
    if (!files) return;
    var name = files[fi] && files[fi].name;
    if (!confirm('Xóa file "'+name+'"?')) return;
    files.splice(fi, 1);
    fbSet('/moduleData/'+mid+'/files', files, function(){
      showToast('Đã xóa: '+name, 'error');
      renderMgmtModuleFiles();
    });
  });
}

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
      (g.modules||[]).map(function(m) {
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
    fbSaveModules(); renderModuleGroups(); syncSidebarModules();
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
    fbSaveModules(); renderModuleGroups(); syncSidebarModules();
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
  if (pg) pg.remove(); // always rebuild to get fresh Firebase data

  pg = document.createElement('div');
  pg.className = 'page active'; pg.id = pid;
  var isAdmin = currentUser && ['owner','admin'].includes(currentUser.role);

  // Build static docs HTML
  var docs = MODULE_DOCS[id];
  var staticHtml = '';
  if (docs) {
    staticHtml = '<p style="color:#555;font-size:13px;margin-bottom:14px">' + docs.desc + '</p>'
      + docs.files.map(function(f) {
          var dlUrl = BASE_URL + encodeURIComponent(f.file);
          var viewUrl = OFFICE_VIEW + dlUrl;
          return '<div style="display:flex;align-items:center;gap:12px;padding:12px;background:#f8f9fb;border-radius:8px;margin-bottom:8px;border:1px solid #e5e7eb">'
            +'<span style="font-size:22px">'+f.icon+'</span>'
            +'<div style="flex:1"><div style="font-weight:700;font-size:13px">'+f.name+'</div>'
            +'<div style="font-size:11px;color:#888;margin-top:2px">'+f.desc+'</div></div>'
            +'<a href="'+viewUrl+'" target="_blank" style="background:#e0f2fe;color:#0369a1;border:none;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:700;text-decoration:none">👁️ Xem</a>'
            +'<a href="'+dlUrl+'" download style="background:#dcfce7;color:#15803d;border:none;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:700;text-decoration:none;margin-left:4px">⬇️ Tải</a>'
            +'</div>';
        }).join('');
  }

  var uploadBtn = isAdmin
    ? '<label style="background:#0891b2;color:#fff;border:none;border-radius:7px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer">+ Upload tài liệu<input type="file" multiple style="display:none" onchange="uploadModuleFile(this,'+id+')"></label>'
    : '';

  pg.innerHTML =
    '<div class="page-header" style="background:linear-gradient(135deg,#1d4ed8,#1e40af)">'
    +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">'
    +'<button onclick="showPage(\'files\',document.querySelector(\'.nav-item[onclick*=\\\'files\\\']\'))" style="background:rgba(255,255,255,.2);border:none;color:#fff;border-radius:7px;padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer">&larr; Thư viện chung</button>'
    +'</div>'
    +'<div class="page-tag">Module</div>'
    +'<div class="page-title">'+name+'</div>'
    +'<div class="page-meta">Click tài liệu để xem online hoặc tải về</div>'
    +'</div>'
    // Docs card
    +'<div class="card" style="margin-top:12px">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">'
    +'<div class="card-title" style="margin:0">📂 Tài liệu</div>'
    + uploadBtn
    +'</div>'
    + staticHtml
    +'<div id="mod-extra-files-'+id+'"></div>'
    +'</div>'
    // Comments card
    +'<div class="card" style="margin-top:0">'
    +'<div class="card-title">💬 Ghi chú & Bình luận</div>'
    +'<div id="mod-comments-'+id+'" style="margin-bottom:12px"></div>'
    +'<div style="display:flex;gap:8px;align-items:flex-end">'
    +'<textarea id="mod-cmt-inp-'+id+'" rows="2" placeholder="Thêm ghi chú hoặc bình luận..." style="flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:8px 10px;font-size:13px;outline:none;resize:none"></textarea>'
    +'<button onclick="postModuleComment('+id+')" style="background:#1d4ed8;color:#fff;border:none;border-radius:8px;padding:9px 16px;font-size:13px;font-weight:700;cursor:pointer">Gửi</button>'
    +'</div>'
    +'</div>';

  var mainEl = document.querySelector('main'); if(mainEl) mainEl.appendChild(pg);
  if(el) el.classList.add('active');
  document.querySelector('main').scrollTop = 0;

  // Load extra files + comments from Firebase
  loadModuleExtras(id);
}

function loadModuleExtras(id) {
  fbGet('/moduleData/'+id+'/files', function(e, files) {
    var el = document.getElementById('mod-extra-files-'+id); if (!el) return;
    if (!e && files && files.length) {
      el.innerHTML = files.map(function(f) {
        var isOffice = /\.(docx?|xlsx?|pptx?)$/i.test(f.name||'');
        var viewHtml = isOffice
          ? '<a href="'+OFFICE_VIEW+encodeURIComponent(f.url)+'" target="_blank" style="background:#e0f2fe;color:#0369a1;border:none;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:700;text-decoration:none">👁️ Xem</a>'
          : '<a href="'+f.url+'" target="_blank" style="background:#e0f2fe;color:#0369a1;border:none;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:700;text-decoration:none">👁️ Xem</a>';
        return '<div style="display:flex;align-items:center;gap:12px;padding:12px;background:#f0fdf4;border-radius:8px;margin-bottom:8px;border:1px solid #bbf7d0">'
          +'<span style="font-size:20px">📎</span>'
          +'<div style="flex:1"><div style="font-weight:700;font-size:13px">'+f.name+'</div>'
          +'<div style="font-size:11px;color:#888">'+f.author+' · '+f.date+'</div></div>'
          + viewHtml
          +'<a href="'+f.url+'" download="'+f.name+'" style="background:#dcfce7;color:#15803d;border:none;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:700;text-decoration:none;margin-left:4px">⬇️ Tải</a>'
          +'</div>';
      }).join('');
    }
  });
  fbGet('/moduleData/'+id+'/comments', function(e, cmts) {
    var el = document.getElementById('mod-comments-'+id); if (!el) return;
    var list = (cmts && Array.isArray(cmts)) ? cmts : (cmts ? Object.values(cmts) : []);
    if (!list.length) { el.innerHTML = '<p style="color:#aaa;font-size:13px;font-style:italic">Chưa có bình luận nào.</p>'; return; }
    el.innerHTML = list.map(function(c) {
      var cfg = ROLE_CFG[c.role] || ROLE_CFG.colleague;
      return '<div style="background:#f8f9fb;border-left:3px solid #1d4ed8;padding:10px 12px;border-radius:0 8px 8px 0;margin-bottom:8px">'
        +'<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'
        +'<span style="font-weight:700;font-size:12px;color:#1d4ed8">'+c.author+'</span>'
        +'<span class="role-badge '+cfg.cls+'" style="font-size:10px;padding:1px 6px">'+cfg.label+'</span>'
        +'<span style="font-size:11px;color:#aaa;margin-left:auto">'+c.time+'</span>'
        +'</div>'
        +'<div style="font-size:13px;color:#374151;line-height:1.6">'+c.text+'</div>'
        +'</div>';
    }).join('');
  });
}

function uploadModuleFile(input, moduleId) {
  var files = Array.from(input.files); if (!files.length) return;
  showToast('Đang upload...', 'warning');
  files.forEach(function(file) {
    uploadToCloud(file, function(err, f) {
      if (err) { showToast('Lỗi upload: ' + file.name, 'error'); return; }
      fbGet('/moduleData/'+moduleId+'/files', function(e2, existing) {
        var arr = (existing && Array.isArray(existing)) ? existing : [];
        arr.push({ name: f.name, url: f.url, author: currentUser.name, date: f.date });
        fbSet('/moduleData/'+moduleId+'/files', arr, function() {
          fbClearCache();
          loadModuleExtras(moduleId);
          showToast('✅ Đã upload: ' + f.name, 'success');
        });
      });
    });
  });
  input.value = '';
}

function postModuleComment(moduleId) {
  var inp = document.getElementById('mod-cmt-inp-'+moduleId);
  var txt = inp ? inp.value.trim() : ''; if (!txt) return;
  var cmt = { author: currentUser.name, role: currentUser.role, text: txt, time: new Date().toLocaleString('vi-VN') };
  fbGet('/moduleData/'+moduleId+'/comments', function(e, existing) {
    var arr = (existing && Array.isArray(existing)) ? existing : [];
    arr.push(cmt);
    fbSet('/moduleData/'+moduleId+'/comments', arr, function() {
      inp.value = '';
      loadModuleExtras(moduleId);
      showToast('Đã gửi bình luận', 'success');
    });
  });
}

// ============================================================
// CLOUDINARY UPLOAD
// ============================================================
var CLOUD_NAME = 'draqjeguw';
var UPLOAD_PRESET = 'ml_default';
var cloudFiles = [];

// ============================================================
// VERSION CONTROL
// ============================================================
function getNextVersion(name) {
  var base = name.replace(/\s*v(\d+)(\.[^.]+)?$/, '').replace(/(\.[^.]+)$/, '');
  var ext  = name.match(/(\.[^.]+)$/) ? name.match(/(\.[^.]+)$/)[1] : '';
  // Find existing versions in sharedFiles + cloudFiles
  var all = sharedFiles.concat(cloudFiles || []);
  var existing = all.filter(function(f) {
    return f.name && f.name.replace(/\s*v\d+/, '').replace(/\.[^.]+$/, '') === base;
  });
  if (!existing.length) return null; // no conflict
  var maxV = 1;
  existing.forEach(function(f) {
    var m = f.name.match(/v(\d+)/);
    if (m) maxV = Math.max(maxV, parseInt(m[1]));
  });
  return { base: base, ext: ext, existing: existing, nextV: maxV + 1 };
}

function showVersionDialog(fileName, onReplace, onKeepBoth) {
  var existing = document.getElementById('version-dialog');
  if (existing) existing.remove();
  var d = document.createElement('div');
  d.id = 'version-dialog';
  d.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center';
  d.innerHTML = '<div style="background:#fff;border-radius:14px;padding:28px;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.3)">' +
    '<div style="font-size:20px;margin-bottom:6px">📄 File đã tồn tại</div>' +
    '<p style="font-size:14px;color:#555;margin-bottom:20px">File <strong>"' + fileName + '"</strong> đã có trong thư viện. Bạn muốn làm gì?</p>' +
    '<div style="display:flex;flex-direction:column;gap:10px">' +
      '<button id="vd-replace" style="background:#ef4444;color:#fff;border:none;border-radius:8px;padding:11px;font-size:13px;font-weight:700;cursor:pointer">🔄 Thay thế — File cũ vào Thùng rác</button>' +
      '<button id="vd-keep" style="background:#1d4ed8;color:#fff;border:none;border-radius:8px;padding:11px;font-size:13px;font-weight:700;cursor:pointer">📋 Giữ cả 2 — Lưu thành phiên bản mới</button>' +
      '<button id="vd-cancel" style="background:#f3f4f6;color:#555;border:none;border-radius:8px;padding:11px;font-size:13px;cursor:pointer">Hủy</button>' +
    '</div>' +
  '</div>';
  document.body.appendChild(d);
  document.getElementById('vd-replace').onclick = function() { d.remove(); onReplace(); };
  document.getElementById('vd-keep').onclick   = function() { d.remove(); onKeepBoth(); };
  document.getElementById('vd-cancel').onclick = function() { d.remove(); };
}

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
        var newFile = { id: res.public_id, name: file.name, url: res.secure_url,
          type: file.type, size: res.bytes, isVideo: isVideo, isImage: isImage,
          date: new Date().toLocaleDateString('vi-VN'),
          author: currentUser ? currentUser.name : '', version: 1 };

        var vInfo = getNextVersion(file.name);
        if (vInfo) {
          // Conflict detected
          showVersionDialog(file.name,
            function() {
              // Replace — move old to trash
              vInfo.existing.forEach(function(old) {
                trash.push({ type: 'file', data: old, deletedBy: currentUser ? currentUser.name : '?',
                  deletedAt: new Date().toLocaleString('vi-VN'), reason: 'Replaced by new version' });
                cloudFiles = cloudFiles.filter(function(f){ return f.id !== old.id; });
                sharedFiles = sharedFiles.filter(function(f){ return f.id !== old.id; });
              });
              newFile.version = vInfo.nextV;
              cloudFiles.push(newFile);
              fbSet('/shared/sharedFiles', cloudFiles);
              fbClearCache(); updateTrashBadge();
              renderCloudFiles(); showToast('✅ Đã thay thế — phiên bản cũ vào Thùng rác', 'success');
            },
            function() {
              // Keep both — rename new as v{n}
              var base = vInfo.base, ext = vInfo.ext;
              newFile.name = base + ' v' + vInfo.nextV + ext;
              newFile.version = vInfo.nextV;
              cloudFiles.push(newFile);
              fbSet('/shared/sharedFiles', cloudFiles);
              fbClearCache(); renderCloudFiles();
              showToast('✅ Đã lưu "' + newFile.name + '"', 'success');
            }
          );
        } else {
          newFile.version = 1;
          cloudFiles.push(newFile);
          fbSet('/shared/sharedFiles', cloudFiles);
          fbClearCache(); renderCloudFiles();
        }
      } else {
        showToast('Lỗi upload: ' + file.name, 'error');
      }
      if (done === files.length) {
        if (progressEl) progressEl.style.display = 'none';
        if (!getNextVersion(file.name)) showToast('Upload xong ' + done + ' file!', 'success');
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
// ── PERSONAL FILES ──
function switchPersonalTab(tab, el) {
  document.querySelectorAll('.personal-tab').forEach(function(t){t.style.color='#888';t.style.borderBottomColor='transparent';});
  el.style.color='#7c3aed';el.style.borderBottomColor='#7c3aed';
  ['modules','files','notes'].forEach(function(t){var d=document.getElementById('personal-tab-'+t);if(d)d.style.display=t===tab?'block':'none';});
  if(tab==='modules') renderPersonalModulesGrid();
}
function createPersonalDoc(){var name=prompt('Tên tài liệu:');if(!name)return;personalDocs.push({id:Date.now(),name:name,content:'<p>Bắt đầu soạn thảo...</p>',date:new Date().toLocaleDateString('vi-VN'),author:currentUser?currentUser.name:''});renderPersonalDocs();showToast('Đã tạo: '+name,'success');}
function renderPersonalDocs(){var list=document.getElementById('personal-docs-list');if(!list)return;if(!personalDocs.length){list.innerHTML='<p style="color:#aaa;font-style:italic;text-align:center;padding:20px">Chưa có tài liệu nào.</p>';return;}list.innerHTML=personalDocs.map(function(doc,i){return '<div style="background:#fff;border-radius:10px;border:1px solid #e5e7eb;padding:12px 16px;margin-bottom:10px;display:flex;align-items:center;gap:10px"><span style="font-size:20px">📝</span><div style="flex:1"><div style="font-weight:700;font-size:13px">'+doc.name+'</div><div style="font-size:11px;color:#888">'+doc.date+'</div></div><button onclick="editPersonalDoc('+i+')" class="btn-sm" style="background:#f3f4f6;border:none;cursor:pointer">✏️ Sửa</button><button onclick="personalDocs.splice('+i+',1);renderPersonalDocs()" class="btn-sm reject-btn" style="margin-left:4px">🗑️</button></div>'+'<div id="doc-editor-'+i+'" style="display:none;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:10px"><div contenteditable="true" id="doc-content-'+i+'" style="min-height:120px;padding:12px;outline:none;font-size:13px">'+doc.content+'</div><button onclick="savePersonalDoc('+i+')" style="margin:8px;background:#7c3aed;color:#fff;border:none;border-radius:6px;padding:5px 12px;font-size:12px;cursor:pointer">💾 Lưu</button></div>';}).join('');}
function editPersonalDoc(i){var el=document.getElementById('doc-editor-'+i);if(el)el.style.display=el.style.display==='none'?'block':'none';}
function savePersonalDoc(i){var c=document.getElementById('doc-content-'+i);if(c&&personalDocs[i]){personalDocs[i].content=c.innerHTML;showToast('Đã lưu!','success');}}
function createPersonalSheet(){var name=prompt('Tên bảng tính:');if(!name)return;personalSheets.push({id:Date.now(),name:name,date:new Date().toLocaleDateString('vi-VN'),author:currentUser?currentUser.name:'',data:{}});renderPersonalSheets();showToast('Đã tạo: '+name,'success');}
function renderPersonalSheets(){var list=document.getElementById('personal-sheets-list');if(!list)return;if(!personalSheets.length){list.innerHTML='<p style="color:#aaa;font-style:italic;text-align:center;padding:20px">Chưa có bảng tính nào.</p>';return;}list.innerHTML=personalSheets.map(function(s,i){return '<div style="background:#fff;border-radius:10px;border:1px solid #e5e7eb;padding:12px 16px;margin-bottom:8px;display:flex;align-items:center;gap:10px"><span style="font-size:20px">📊</span><div style="flex:1"><div style="font-weight:700;font-size:13px">'+s.name+'</div><div style="font-size:11px;color:#888">'+s.date+'</div></div><button onclick="personalSheets.splice('+i+',1);renderPersonalSheets()" class="btn-sm reject-btn">🗑️</button></div>';}).join('');}
function uploadPersonalFile(input){var files=Array.from(input.files);files.forEach(function(f){var sz=f.size>1048576?(f.size/1048576).toFixed(1)+'MB':(f.size/1024).toFixed(0)+'KB';personalFiles.push({id:Date.now(),name:f.name,type:f.type,size:sz,date:new Date().toLocaleDateString('vi-VN'),url:URL.createObjectURL(f)});});renderPersonalFiles();showToast('Đã upload '+files.length+' file','success');input.value='';}
function renderPersonalFiles(){var list=document.getElementById('personal-files-list');if(!list)return;if(!personalFiles.length){list.innerHTML='<p style="color:#aaa;font-style:italic;text-align:center;padding:10px">Chưa có file nào.</p>';return;}list.innerHTML=personalFiles.map(function(f,i){return '<div style="background:#fff;border-radius:8px;border:1px solid #e5e7eb;padding:10px 14px;margin-bottom:8px;display:flex;align-items:center;gap:10px"><span style="font-size:20px">📁</span><div style="flex:1"><div style="font-weight:600;font-size:13px">'+f.name+'</div><div style="font-size:11px;color:#888">'+f.size+' · '+f.date+'</div></div><a href="'+f.url+'" download="'+f.name+'" style="background:#dcfce7;color:#15803d;padding:4px 8px;border-radius:6px;font-size:11px;text-decoration:none">⬇️</a><button onclick="personalFiles.splice('+i+',1);renderPersonalFiles()" class="btn-sm reject-btn" style="margin-left:4px">🗑️</button></div>';}).join('');}
function savePersonalNote(){var t=document.getElementById('personal-note');if(t){personalNote=t.value;fbSavePersonal();showToast('Đã lưu ghi chú','success');}}

// ── SHARED DOCS & SHEETS ──
function switchFilesTab(tab, el) {
  document.querySelectorAll('.files-tab').forEach(function(t){t.style.color='#888';t.style.borderBottomColor='transparent';});
  el.style.color='#0891b2';el.style.borderBottomColor='#0891b2';
  ['modules','upload','notes'].forEach(function(t){var d=document.getElementById('shared-tab-'+t);if(d)d.style.display=t===tab?'block':'none';});
  if(tab==='upload') { renderSharedFileList(); populateCategoryDropdown(); }
  if(tab==='modules') renderPublicModulesGrid();
  if(tab==='notes') loadModuleActivity();
}
function createSharedDoc(){var name=prompt('Tên tài liệu chung:');if(!name)return;sharedDocs.push({id:Date.now(),name:name,content:'<p>Bắt đầu soạn thảo...</p>',date:new Date().toLocaleDateString('vi-VN'),author:currentUser?currentUser.name:'',comments:[]});fbSet('/shared/sharedDocs',sharedDocs);fbClearCache();renderSharedDocs();showToast('Đã tạo: '+name,'success');}
function renderSharedDocs(){var list=document.getElementById('shared-docs-list');if(!list)return;if(!sharedDocs.length){list.innerHTML='<p style="color:#aaa;font-style:italic;text-align:center;padding:20px">Chưa có tài liệu nào.</p>';return;}var isAdmin=currentUser&&['owner','admin'].includes(currentUser.role);list.innerHTML=sharedDocs.map(function(doc,i){return '<div style="background:#fff;border-radius:10px;border:1px solid #e5e7eb;padding:12px 16px;margin-bottom:10px;display:flex;align-items:center;gap:10px"><span style="font-size:20px">📝</span><div style="flex:1"><div style="font-weight:700;font-size:13px">'+doc.name+'</div><div style="font-size:11px;color:#888">'+doc.author+' · '+doc.date+'</div></div>'+(isAdmin?'<button onclick="sharedDocs.splice('+i+',1);fbSet(\'/shared/sharedDocs\',sharedDocs);fbClearCache();renderSharedDocs()" class="btn-sm reject-btn">🗑️</button>':'')+'</div>';}).join('');}
function createSharedSheet(){var name=prompt('Tên bảng tính chung:');if(!name)return;sharedSheets.push({id:Date.now(),name:name,date:new Date().toLocaleDateString('vi-VN'),author:currentUser?currentUser.name:'',data:{}});fbSet('/shared/sharedSheets',sharedSheets);fbClearCache();renderSharedSheets();showToast('Đã tạo: '+name,'success');}
function renderSharedSheets(){var list=document.getElementById('shared-sheets-list');if(!list)return;if(!sharedSheets.length){list.innerHTML='<p style="color:#aaa;font-style:italic;text-align:center;padding:20px">Chưa có bảng tính nào.</p>';return;}var isAdmin=currentUser&&['owner','admin'].includes(currentUser.role);list.innerHTML=sharedSheets.map(function(s,i){return '<div style="background:#fff;border-radius:10px;border:1px solid #e5e7eb;padding:12px 16px;margin-bottom:8px;display:flex;align-items:center;gap:10px"><span style="font-size:20px">📊</span><div style="flex:1"><div style="font-weight:700;font-size:13px">'+s.name+'</div><div style="font-size:11px;color:#888">'+s.author+' · '+s.date+'</div></div>'+(isAdmin?'<button onclick="sharedSheets.splice('+i+',1);fbSet(\'/shared/sharedSheets\',sharedSheets);fbClearCache();renderSharedSheets()" class="btn-sm reject-btn">🗑️</button>':'')+'</div>';}).join('');}
function saveSharedNote(){var t=document.getElementById('shared-note-area');if(t){sharedNote=t.value;fbSet('/shared/sharedNote',sharedNote);showToast('Đã lưu ghi chú','success');}}

function loadModuleActivity() {
  var el = document.getElementById('module-activity-list'); if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:20px;color:#aaa">Đang tải...</div>';
  fbGet('/moduleData', function(err, data) {
    if (err || !data) { el.innerHTML = '<div style="text-align:center;padding:20px;color:#aaa">Chưa có hoạt động nào.</div>'; return; }
    // Collect all modules with comments
    var rows = [];
    Object.keys(data).forEach(function(mid) {
      var mdata = data[mid];
      var cmts = mdata && mdata.comments;
      if (!cmts) return;
      var list = Array.isArray(cmts) ? cmts : Object.values(cmts);
      if (!list.length) return;
      // Find module name
      var modName = mid;
      moduleGroups.forEach(function(g){
        (g.modules||[]).forEach(function(m){ if(String(m.id)===String(mid)) modName = m.name; });
      });
      var last = list[list.length-1];
      rows.push({ mid: parseInt(mid), name: modName, count: list.length, last: last, all: list });
    });
    if (!rows.length) { el.innerHTML = '<div style="text-align:center;padding:30px;color:#aaa">Chưa có bình luận nào trong các module.</div>'; return; }
    rows.sort(function(a,b){ return b.count - a.count; });
    el.innerHTML = rows.map(function(r) {
      var recentHtml = r.all.slice(-3).reverse().map(function(c){
        var cfg = ROLE_CFG[c.role] || ROLE_CFG.colleague;
        return '<div style="display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-bottom:1px solid #f5f5f5">'
          +'<div style="width:28px;height:28px;border-radius:50%;background:'+cfg.color+';display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0">'+c.author.charAt(0).toUpperCase()+'</div>'
          +'<div style="flex:1;min-width:0">'
          +'<div style="display:flex;gap:6px;align-items:center;margin-bottom:2px">'
          +'<span style="font-weight:700;font-size:12px;color:#1e293b">'+c.author+'</span>'
          +'<span class="role-badge '+cfg.cls+'" style="font-size:10px;padding:1px 5px">'+cfg.label+'</span>'
          +'<span style="font-size:10px;color:#aaa;margin-left:auto">'+c.time+'</span>'
          +'</div>'
          +'<div style="font-size:12px;color:#475569;line-height:1.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+c.text+'</div>'
          +'</div></div>';
      }).join('');
      return '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:0;margin-bottom:12px;overflow:hidden">'
        +'<div onclick="goToModule('+r.mid+')" style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:#f8f9fb;cursor:pointer;border-bottom:1px solid #e5e7eb" '
        +'onmouseover="this.style.background=\'#eff6ff\'" onmouseout="this.style.background=\'#f8f9fb\'">'
        +'<span style="font-size:18px">💬</span>'
        +'<div style="flex:1"><div style="font-weight:700;font-size:13px;color:#1e293b">'+r.name+'</div>'
        +'<div style="font-size:11px;color:#64748b">'+r.count+' bình luận · Mới nhất: '+r.last.author+' · '+r.last.time+'</div></div>'
        +'<span style="background:#dbeafe;color:#1d4ed8;border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700">'+r.count+'</span>'
        +'<span style="font-size:12px;color:#94a3b8;margin-left:6px">→</span>'
        +'</div>'
        +'<div style="padding:8px 16px">'+recentHtml+'</div>'
        +'</div>';
    }).join('');
  });
}

function goToModule(mid) {
  var found = null, gid = null;
  moduleGroups.forEach(function(g){
    (g.modules||[]).forEach(function(m){ if(m.id===mid){ found=m; gid=g.id; } });
  });
  if (found) {
    showPage('files', document.querySelector('.nav-item[onclick*="files"]'));
    setTimeout(function(){ showModulePage(found.id, found.name, gid, null); }, 100);
  }
}
function moveNoteToPersonal(){var t=document.getElementById('shared-note-area');if(t)personalNote=t.value;var pn=document.getElementById('personal-note');if(pn)pn.value=personalNote;showToast('Đã sao chép về Cá nhân','success');}
function renderSharedFiles(){renderSharedFileList();}
var _collapsedCats = {};
function toggleCat(cat) {
  _collapsedCats[cat] = !_collapsedCats[cat];
  renderSharedFileList();
}

function renderSharedFileList(){
  var list=document.getElementById('shared-files-list');
  if(!list)return;
  if(!sharedFiles.length){list.innerHTML='<p style="color:#aaa;font-style:italic;text-align:center;padding:20px">Chưa có file nào.</p>';return;}
  var isAdmin2 = currentUser && ['owner','admin'].includes(currentUser.role);
  var cats={};
  sharedFiles.forEach(function(f){var cat=f.category||'Khác';if(!cats[cat])cats[cat]=[];cats[cat].push(f);});
  var html='';
  Object.keys(cats).forEach(function(cat){
    var collapsed = _collapsedCats[cat];
    var safecat = cat.replace(/'/g,"\\'");
    html+='<div onclick="toggleCat(\''+safecat+'\')" style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#f1f5f9;border-radius:8px;margin:12px 0 6px;cursor:pointer;user-select:none">'
      +'<span style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px;flex:1">'+cat+' <span style="color:#94a3b8;font-weight:400">('+cats[cat].length+')</span></span>'
      +'<span style="font-size:12px;color:#94a3b8;transition:transform .2s;transform:rotate('+(collapsed?'-90':'0')+'deg)">▾</span>'
      +'</div>';
    if(!collapsed){
      cats[cat].forEach(function(f){
        var fileUrl = f.url || (CONTENT_BASE+encodeURIComponent(f.file||''));
        var ext = (f.name||f.file||'').split('.').pop().toLowerCase();
        var isOffice = ['doc','docx','xls','xlsx','ppt','pptx'].indexOf(ext) >= 0;
        var viewUrl = isOffice ? 'https://view.officeapps.live.com/op/view.aspx?src='+encodeURIComponent(fileUrl) : fileUrl;
        html+='<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:#fff;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:6px">'
          +'<span style="font-size:20px">'+(f.icon||'📄')+'</span>'
          +'<div style="flex:1"><div style="font-weight:700;font-size:13px">'+(f.name||f.file||'')+'</div>'
          +'<div style="font-size:11px;color:#888;margin-top:1px">'+(f.author||'')+' · '+(f.date||'')+(f.size?' · '+f.size:'')+'</div></div>'
          +'<a href="'+viewUrl+'" target="_blank" style="background:#e0f2fe;color:#0369a1;border:none;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:700;text-decoration:none">👁️ Xem</a>'
          +'<a href="'+fileUrl+'" download style="background:#dcfce7;color:#15803d;border:none;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:700;text-decoration:none;margin-left:4px">⬇️ Tải</a>'
          +(isAdmin2 ? '<button onclick="deleteSharedFile(\''+encodeURIComponent(JSON.stringify({name:f.name||f.file,id:f.id}))+'\',\''+encodeURIComponent(cat)+'\')" style="background:#fee2e2;color:#ef4444;border:none;border-radius:6px;padding:5px 8px;font-size:11px;font-weight:700;cursor:pointer;margin-left:4px">🗑️</button>' : '')
          +'</div>';
      });
    }
  });
  list.innerHTML=html;
}
// ── DUPLICATE DETECTION ──
function hashFile(file, cb) {
  var reader = new FileReader();
  reader.onload = function(e) {
    crypto.subtle.digest('SHA-256', e.target.result).then(function(buf) {
      var hex = Array.from(new Uint8Array(buf)).map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
      cb(hex);
    }).catch(function(){ cb(null); });
  };
  reader.readAsArrayBuffer(file);
}

function checkDuplicate(file, allFiles, cb) {
  // Quick check by name+size first
  var nameDup = allFiles.find(function(f){ return (f.name||f.file) === file.name && f.size === file.size; });
  if (nameDup) { cb('name', nameDup); return; }
  // Hash check for same name different size
  var sameNameDiff = allFiles.find(function(f){ return (f.name||f.file) === file.name; });
  if (!sameNameDiff) { cb(null); return; }
  hashFile(file, function(hash) {
    if (!hash) { cb(null); return; }
    // Store hash in file metadata when uploading
    fbGet('/fileHashes/' + hash, function(err, existing) {
      if (!err && existing) cb('hash', existing);
      else cb(null, null, hash);
    });
  });
}

function showDuplicateDialog(file, dupInfo, onReplace, onKeepBoth, onCancel) {
  var ex = document.getElementById('dup-dialog'); if(ex) ex.remove();
  var d = document.createElement('div');
  d.id = 'dup-dialog';
  d.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px';
  d.innerHTML = '<div style="background:#fff;border-radius:14px;padding:24px;max-width:400px;width:100%;box-shadow:0 16px 48px rgba(0,0,0,.25)">'
    +'<div style="font-size:24px;margin-bottom:8px">⚠️</div>'
    +'<div style="font-weight:700;font-size:15px;margin-bottom:6px">File đã tồn tại!</div>'
    +'<p style="font-size:13px;color:#555;margin-bottom:18px">File <strong>"'+file.name+'"</strong> đã có trong thư viện. Bạn muốn làm gì?</p>'
    +'<div style="display:flex;flex-direction:column;gap:8px">'
    +'<button id="dup-replace" style="background:#ef4444;color:#fff;border:none;border-radius:8px;padding:10px;font-size:13px;font-weight:700;cursor:pointer">🔄 Thay thế file cũ</button>'
    +'<button id="dup-keep" style="background:#1d4ed8;color:#fff;border:none;border-radius:8px;padding:10px;font-size:13px;font-weight:700;cursor:pointer">📋 Giữ cả 2</button>'
    +'<button id="dup-cancel" style="background:#f3f4f6;color:#555;border:none;border-radius:8px;padding:10px;font-size:13px;cursor:pointer">Hủy upload</button>'
    +'</div></div>';
  document.body.appendChild(d);
  document.getElementById('dup-replace').onclick = function(){ d.remove(); onReplace(); };
  document.getElementById('dup-keep').onclick   = function(){ d.remove(); onKeepBoth(); };
  document.getElementById('dup-cancel').onclick  = function(){ d.remove(); onCancel(); };
}

function uploadToCloud(file, onDone) {
  var isVideo = file.type.startsWith('video/');
  var isImage = file.type.startsWith('image/');
  var resType = isVideo ? 'video' : isImage ? 'image' : 'raw';
  var fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', UPLOAD_PRESET);
  fd.append('folder', 'link-library');
  var xhr = new XMLHttpRequest();
  xhr.open('POST', 'https://api.cloudinary.com/v1_1/' + CLOUD_NAME + '/' + resType + '/upload');
  xhr.onload = function() {
    if (xhr.status === 200) {
      var res = JSON.parse(xhr.responseText);
      onDone(null, { id: res.public_id, name: file.name, url: res.secure_url,
        type: file.type, size: res.bytes, date: new Date().toLocaleDateString('vi-VN'),
        author: currentUser ? currentUser.name : '', cloudinary: true });
    } else { onDone('Upload failed'); }
  };
  xhr.onerror = function(){ onDone('Network error'); };
  xhr.send(fd);
}

function uploadSharedFile(input) {
  var files = Array.from(input.files); if (!files.length) return;
  var catEl = document.getElementById('shared-upload-category');
  var category = catEl ? catEl.value : 'Chung';
  var prog = document.getElementById('shared-upload-progress');

  function doUpload(file, nameOverride) {
    if (prog) { prog.style.display='block'; prog.textContent='Đang upload: '+file.name+'...'; }
    uploadToCloud(file, function(err, f) {
      if (!err) {
        if (nameOverride) f.name = nameOverride;
        f.category = category; f.icon = getSharedFileIcon(file.name);
        // Save hash to Firebase for future duplicate detection
        hashFile(file, function(hash) {
          if (hash) fbSet('/fileHashes/'+hash, {name:f.name, url:f.url, date:f.date});
        });
        sharedFiles.push(f); fbSaveSharedFiles(); renderSharedFileList();
        showToast('✅ Upload xong: ' + f.name, 'success');
      } else { showToast('Lỗi upload: ' + file.name, 'error'); }
      if (prog) prog.style.display='none';
    });
  }

  files.forEach(function(file) {
    var allFiles = sharedFiles.concat(personalFiles);
    checkDuplicate(file, allFiles, function(dupType, dupInfo, hash) {
      if (dupType) {
        showDuplicateDialog(file, dupInfo,
          function() { // Replace
            sharedFiles = sharedFiles.filter(function(f){ return (f.name||f.file) !== file.name; });
            doUpload(file);
          },
          function() { // Keep both — add timestamp suffix
            var ext = file.name.lastIndexOf('.');
            var newName = (ext>0 ? file.name.slice(0,ext) : file.name) + '_' + Date.now() + (ext>0 ? file.name.slice(ext) : '');
            doUpload(file, newName);
          },
          function() {} // Cancel
        );
      } else {
        doUpload(file);
      }
    });
  });
  input.value = '';
}

function deleteSharedFile(encodedInfo, encodedCat) {
  var info = JSON.parse(decodeURIComponent(encodedInfo));
  if (!confirm('Xóa file "' + info.name + '"?')) return;
  sharedFiles = sharedFiles.filter(function(f){ return (f.id !== info.id) && (f.name !== info.name) && (f.file !== info.name); });
  fbSaveSharedFiles(); fbClearCache(); renderSharedFileList();
  showToast('Đã xóa: ' + info.name, 'error');
}

function populateCategoryDropdown() {
  var sel = document.getElementById('shared-upload-category'); if (!sel) return;
  var current = sel.value;
  // Build options: module group names + custom categories already used
  var options = moduleGroups.map(function(g){ return g.name; });
  // Add custom categories from existing files not in moduleGroups
  sharedFiles.forEach(function(f){
    if (f.category && options.indexOf(f.category) < 0) options.push(f.category);
  });
  options.push('── Thêm mục mới ──');
  sel.innerHTML = options.map(function(o){
    return '<option value="'+o+'"'+(o===current?' selected':'')+'>'+o+'</option>';
  }).join('');
  sel.onchange = function() {
    if (sel.value === '── Thêm mục mới ──') {
      var name = prompt('Tên mục mới:');
      if (name && name.trim()) {
        var opt = document.createElement('option');
        opt.value = name.trim(); opt.textContent = name.trim(); opt.selected = true;
        sel.insertBefore(opt, sel.lastChild); // before "Thêm mục mới"
        sel.value = name.trim();
      } else {
        sel.value = options[0];
      }
    }
  };
}

function getSharedFileIcon(name) {
  var ext = (name||'').split('.').pop().toLowerCase();
  var map = {pdf:'📄',doc:'📝',docx:'📝',xls:'📊',xlsx:'📊',ppt:'📋',pptx:'📋',txt:'📃',jpg:'🖼️',jpeg:'🖼️',png:'🖼️',gif:'🖼️',mp4:'🎬',avi:'🎬',zip:'📦',rar:'📦'};
  return map[ext] || '📎';
}

function uploadPersonalFile(input) {
  var files = Array.from(input.files); if (!files.length) return;
  files.forEach(function(file) {
    uploadToCloud(file, function(err, f) {
      if (!err) { personalFiles.push(f); fbSavePersonal(); renderPersonalFiles(); showToast('✅ Upload: ' + f.name, 'success'); }
      else { showToast('Lỗi upload: ' + file.name, 'error'); }
    });
  });
  input.value = '';
}

// ── EMOJI PICKER (full, searchable) ──
var EMOJI_DB = [
  // Tech & Tools
  '🔧','🔨','⚙️','🛠️','🔩','🔬','🔭','💡','🖥️','💻','🖨️','⌨️','🖱️','📱','📡','🔌','🔋','💾','💿','📀',
  // Documents & Office
  '📄','📝','📋','📊','📈','📉','📌','📍','📎','🖇️','📏','📐','✂️','🗂️','🗃️','🗄️','📁','📂','🗑️',
  '📓','📔','📒','📕','📗','📘','📙','📚','📖','🔖','🏷️',
  // Business & Work
  '💼','👔','🏢','🏭','🏗️','🔑','🗝️','🚪','🪑','🖊️','✒️','🖋️','📮','📬','📭','📯','📢','📣',
  // Safety & Warning
  '🛡️','⚠️','🚨','🚧','⛔','🔴','🟡','🟢','🔵','🟣','🟤','⚡','🔥','❄️','💧','🌊',
  // Science & Research
  '🧪','🧫','🧬','⚗️','🔮','🧲','🪝','🧯','🩺','🏥','💊','🩹','🩻',
  // Arrows & Symbols
  '✅','❌','⭕','❓','❕','💯','🔄','↩️','↪️','⬆️','⬇️','➡️','⬅️','🔃','🔁','🔂',
  // Stars & Awards
  '⭐','🌟','💫','✨','🏆','🥇','🎯','🎖️','🏅','🎗️','🎀','🎁','🎊','🎉',
  // Nature
  '🌱','🌿','🍀','🌳','🌲','🌴','🌵','🍃','🌾','🌸','🌺','🌻','🌼','🌞','🌙','⛅','🌈','⚡',
  // Transport
  '🚀','✈️','🚁','🚂','🚗','🚕','🛻','🚛','🏎️','🛥️','⚓','🗺️',
  // People & Roles
  '👤','👥','👨‍💻','👩‍💻','👷','👮','🧑‍🔬','👨‍🏫','🧑‍💼','🤝','👋','✋','👍','👎','💪',
  // Misc
  '🧩','🎮','🎲','🃏','🧸','🪆','🎭','🎨','🖼️','📸','🎵','🎶','📺','📻','⏰','⏱️','📅','📆',
];

var EMOJI_LABELS = {
  '🔧':'công cụ','🔨':'búa','⚙️':'cài đặt','🛠️':'sửa chữa','🔩':'ốc vít','🔬':'kính hiển vi','💡':'ý tưởng',
  '🖥️':'máy tính','💻':'laptop','📄':'tài liệu','📝':'ghi chú','📋':'clipboard','📊':'biểu đồ','📈':'tăng',
  '📌':'ghim','🗂️':'hồ sơ','📁':'thư mục','📂':'thư mục mở','📚':'sách','📖':'đọc','🔑':'chìa khóa',
  '🛡️':'an toàn','⚠️':'cảnh báo','🚨':'khẩn cấp','⚡':'điện','🔥':'nóng','🧪':'thí nghiệm',
  '✅':'hoàn thành','❌':'lỗi','🏆':'giải thưởng','⭐':'sao','🚀':'phóng','💼':'công việc',
  '🏗️':'xây dựng','🏭':'nhà máy','👥':'nhóm','🧩':'module','🎯':'mục tiêu','🔵':'xanh',
  '📦':'hộp','📡':'ăng ten','🌐':'toàn cầu','💾':'lưu','🗃️':'lưu trữ','🔄':'làm mới',
};

function showEmojiPicker(currentIcon, onSelect) {
  var ex = document.getElementById('emoji-picker-modal'); if (ex) ex.remove();
  var d = document.createElement('div');
  d.id = 'emoji-picker-modal';
  d.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px';

  function buildGrid(list) {
    return list.map(function(e){
      var tip = EMOJI_LABELS[e] || '';
      return '<button title="'+tip+'" onclick="(function(){'
        +'document.getElementById(\'emoji-picker-modal\').remove();'
        +'(window._emojiCb||function(){})(\''+e+'\');'
        +'})()" style="font-size:22px;background:'+(e===currentIcon?'#ede9fe':'transparent')+';border:'+(e===currentIcon?'2px solid #7c3aed':'2px solid transparent')+';border-radius:8px;padding:5px;cursor:pointer;transition:background .1s" onmouseover="this.style.background=\'#f3f4f6\'" onmouseout="this.style.background=\''+(e===currentIcon?'#ede9fe':'transparent')+'\'">'+e+'</button>';
    }).join('');
  }

  d.innerHTML = '<div style="background:#fff;border-radius:16px;width:100%;max-width:420px;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 16px 48px rgba(0,0,0,.25);overflow:hidden">'
    +'<div style="padding:14px 16px;border-bottom:1px solid #e5e7eb;display:flex;gap:8px;align-items:center">'
    +'<input id="emoji-search" placeholder="🔍 Tìm emoji... (vd: an toàn, công cụ)" style="flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:7px 10px;font-size:13px;outline:none">'
    +'<button onclick="document.getElementById(\'emoji-picker-modal\').remove()" style="background:#f3f4f6;border:none;border-radius:7px;padding:6px 10px;cursor:pointer">✕</button>'
    +'</div>'
    +'<div id="emoji-grid" style="padding:12px;display:grid;grid-template-columns:repeat(9,1fr);gap:4px;overflow-y:auto;max-height:400px">'
    + buildGrid(EMOJI_DB)
    +'</div>'
    +'<div style="padding:8px 14px;border-top:1px solid #e5e7eb;font-size:11px;color:#aaa">'+EMOJI_DB.length+' emojis · Bấm để chọn</div>'
    +'</div>';

  window._emojiCb = onSelect;
  document.body.appendChild(d);

  document.getElementById('emoji-search').addEventListener('input', function() {
    var q = this.value.toLowerCase();
    var filtered = q ? EMOJI_DB.filter(function(e){
      return e.includes(q) || (EMOJI_LABELS[e]||'').toLowerCase().includes(q);
    }) : EMOJI_DB;
    document.getElementById('emoji-grid').innerHTML = buildGrid(filtered)
      || '<div style="grid-column:1/-1;text-align:center;padding:20px;color:#aaa">Không tìm thấy</div>';
  });
  setTimeout(function(){ var s=document.getElementById('emoji-search'); if(s) s.focus(); }, 100);
}

// Keep showIconPicker as alias
function showIconPicker(currentIcon, onSelect) { showEmojiPicker(currentIcon, onSelect); }

function pickGroupIcon(gid, el) {
  var g = moduleGroups.find(function(x){return x.id===gid;});
  showEmojiPicker(g ? g.icon : '📂', function(ic){
    if (g) g.icon = ic;
    fbSaveModules(); renderModuleGroups(); syncSidebarModules();
  });
}

function pickModuleIcon(gid, mid, el) {
  var g = moduleGroups.find(function(x){return x.id===gid;});
  var m = g && (g.modules||[]).find(function(x){return x.id===mid;});
  showEmojiPicker(m ? m.icon : '📦', function(ic){
    if (m) m.icon = ic;
    fbSaveModules(); renderModuleGroups(); syncSidebarModules();
  });
}

var PM_ICONS = EMOJI_DB;

function createPersonalModule() {
  var name = prompt('Tên module cá nhân:'); if (!name) return;
  var newMod = {id: Date.now(), name: name, icon: '📌', notes: '', content: '', date: new Date().toLocaleDateString('vi-VN')};
  personalModules.push(newMod);
  var idx = personalModules.length - 1;
  fbSavePersonal(); renderPersonalModulesGrid();
  showToast('Đã tạo module: ' + name, 'success');
  showIconPicker('📌', function(ic){ personalModules[idx].icon = ic; fbSavePersonal(); renderPersonalModulesGrid(); });
}

function renderPersonalModulesGrid() {
  var grid = document.getElementById('personal-modules-grid');
  if (!grid) return;
  if (!personalModules.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:#aaa"><p>Chưa có module nào.</p></div>';
    return;
  }
  grid.innerHTML = personalModules.map(function(m, i){
    return '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;cursor:pointer;transition:box-shadow .15s" '
      +'onmouseover="this.style.boxShadow=\'0 4px 12px rgba(0,0,0,.1)\'" onmouseout="this.style.boxShadow=\'\'">'
      +'<div style="font-size:28px;margin-bottom:8px;cursor:pointer" onclick="showIconPicker(\''+m.icon+'\',function(ic){personalModules['+i+'].icon=ic;renderPersonalModulesGrid();})" title="Bấm để đổi icon">'+m.icon+'</div>'
      +'<div style="font-weight:700;font-size:13px;margin-bottom:2px">'+m.name+'</div>'
      +'<div style="font-size:11px;color:#aaa;margin-bottom:10px">'+m.date+'</div>'
      +'<div style="display:flex;gap:6px">'
      +'<button onclick="openPersonalModule('+i+')" style="flex:1;background:#ede9fe;color:#7c3aed;border:none;border-radius:6px;padding:6px;font-size:11px;font-weight:700;cursor:pointer">✏️ Mở</button>'
      +'<button onclick="event.stopPropagation();personalModules.splice('+i+',1);renderPersonalModulesGrid()" style="background:#fee2e2;color:#dc2626;border:none;border-radius:6px;padding:6px 8px;font-size:11px;cursor:pointer">🗑️</button>'
      +'</div></div>';
  }).join('');
}

// ── PERSONAL MODULE DETAIL (sub-modules system) ──
function openPersonalModule(mi) {
  var m = personalModules[mi]; if (!m) return;
  if (!m.items) m.items = [];
  var existing = document.getElementById('pm-detail-page');
  if (existing) existing.remove();

  // Build sub-items grid HTML
  function buildSubGrid() {
    if (!m.items.length) return '<div style="grid-column:1/-1;text-align:center;padding:30px;color:#aaa">Chưa có mục nào. Bấm + để thêm.</div>';
    return m.items.map(function(item, si) {
      return '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;cursor:pointer;transition:box-shadow .15s" '
        +'onmouseover="this.style.boxShadow=\'0 4px 12px rgba(0,0,0,.1)\'" onmouseout="this.style.boxShadow=\'\'">'
        +'<div style="font-size:26px;margin-bottom:8px">'+item.icon+'</div>'
        +'<div style="font-weight:700;font-size:13px;margin-bottom:4px">'+item.name+'</div>'
        +'<div style="font-size:11px;color:#aaa;margin-bottom:10px">'+item.date+'</div>'
        +'<div style="display:flex;gap:6px">'
        +'<button onclick="openSubModule('+mi+','+si+')" style="flex:1;background:#ede9fe;color:#7c3aed;border:none;border-radius:6px;padding:5px;font-size:11px;font-weight:700;cursor:pointer">✏️ Mở</button>'
        +'<button onclick="event.stopPropagation();personalModules['+mi+'].items.splice('+si+',1);document.getElementById(\'pm-subgrid\').innerHTML=buildPmSubGrid('+mi+')" style="background:#fee2e2;color:#dc2626;border:none;border-radius:6px;padding:5px 8px;font-size:11px;cursor:pointer">🗑️</button>'
        +'</div></div>';
    }).join('');
  }

  var d = document.createElement('div');
  d.id = 'pm-detail-page';
  d.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#f8f9fb;z-index:900;overflow-y:auto';
  d.innerHTML =
    '<div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:16px 24px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:10">'
    +'<button onclick="document.getElementById(\'pm-detail-page\').remove()" style="background:rgba(255,255,255,.2);border:none;color:#fff;border-radius:7px;padding:7px 12px;cursor:pointer;font-size:13px;font-weight:600">&larr; Quay lại</button>'
    +'<span id="pm-detail-icon" style="font-size:24px;cursor:pointer" onclick="showIconPicker(\''+m.icon+'\',function(ic){personalModules['+mi+'].icon=ic;document.getElementById(\'pm-detail-icon\').textContent=ic;})" title="Đổi icon">'+m.icon+'</span>'
    +'<span style="color:#fff;font-size:16px;font-weight:700;flex:1">'+m.name+'</span>'
    +'<button onclick="addSubModule('+mi+')" style="background:#fff;color:#7c3aed;border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer">+ Thêm mục</button>'
    +'</div>'
    +'<div style="max-width:900px;margin:24px auto;padding:0 16px">'
    +'<div id="pm-subgrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px">'
    + buildSubGrid()
    +'</div></div>';
  document.body.appendChild(d);

  // expose buildSubGrid globally for delete button
  window.buildPmSubGrid = function(idx) {
    var mod = personalModules[idx]; if (!mod || !mod.items) return '';
    if (!mod.items.length) return '<div style="grid-column:1/-1;text-align:center;padding:30px;color:#aaa">Chưa có mục nào. Bấm + để thêm.</div>';
    return mod.items.map(function(item, si) {
      return '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px">'
        +'<div style="font-size:26px;margin-bottom:8px">'+item.icon+'</div>'
        +'<div style="font-weight:700;font-size:13px;margin-bottom:4px">'+item.name+'</div>'
        +'<div style="font-size:11px;color:#aaa;margin-bottom:10px">'+item.date+'</div>'
        +'<div style="display:flex;gap:6px">'
        +'<button onclick="openSubModule('+idx+','+si+')" style="flex:1;background:#ede9fe;color:#7c3aed;border:none;border-radius:6px;padding:5px;font-size:11px;font-weight:700;cursor:pointer">✏️ Mở</button>'
        +'<button onclick="personalModules['+idx+'].items.splice('+si+',1);document.getElementById(\'pm-subgrid\').innerHTML=buildPmSubGrid('+idx+')" style="background:#fee2e2;color:#dc2626;border:none;border-radius:6px;padding:5px 8px;font-size:11px;cursor:pointer">🗑️</button>'
        +'</div></div>';
    }).join('');
  };
}

function addSubModule(mi) {
  var m = personalModules[mi]; if (!m) return;
  if (!m.items) m.items = [];
  var name = prompt('Tên mục mới:'); if (!name) return;
  var icons2 = ['📄','📝','🔧','💡','📊','🛡️','⚙️','🔬','📋','🗂️','🔑','🚀'];
  var item = { id: Date.now(), name: name, icon: icons2[m.items.length % icons2.length], content: '', notes: '', date: new Date().toLocaleDateString('vi-VN') };
  m.items.push(item);
  var grid = document.getElementById('pm-subgrid');
  if (grid) grid.innerHTML = window.buildPmSubGrid(mi);
  showToast('Đã thêm: ' + name, 'success');
  openSubModule(mi, m.items.length - 1);
}

function openSubModule(mi, si) {
  var m = personalModules[mi]; if (!m || !m.items) return;
  var item = m.items[si]; if (!item) return;
  var existing = document.getElementById('pm-sub-modal');
  if (existing) existing.remove();
  var d = document.createElement('div');
  d.id = 'pm-sub-modal';
  d.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px';
  d.innerHTML = '<div style="background:#fff;border-radius:14px;width:100%;max-width:680px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 16px 48px rgba(0,0,0,.25);overflow:hidden">'
    +'<div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:14px 18px;display:flex;align-items:center;gap:10px">'
    +'<span id="sub-icon-disp" style="font-size:22px;cursor:pointer" onclick="showIconPicker(\''+item.icon+'\',function(ic){personalModules['+mi+'].items['+si+'].icon=ic;document.getElementById(\'sub-icon-disp\').textContent=ic;})" title="Đổi icon">'+item.icon+'</span>'
    +'<input id="sub-name-inp" value="'+item.name+'" style="flex:1;background:rgba(255,255,255,.2);border:none;border-radius:8px;padding:7px 12px;color:#fff;font-size:14px;font-weight:700;outline:none">'
    +'<button onclick="document.getElementById(\'pm-sub-modal\').remove()" style="background:rgba(255,255,255,.2);border:none;color:#fff;border-radius:6px;padding:5px 10px;cursor:pointer">✕</button>'
    +'</div>'
    +'<div style="background:#f8f9fb;border-bottom:1px solid #e5e7eb;padding:5px 10px;display:flex;gap:3px;flex-wrap:wrap">'
    +'<button class="btn-sm" onclick="document.execCommand(\'bold\')"><b>B</b></button>'
    +'<button class="btn-sm" onclick="document.execCommand(\'italic\')"><i>I</i></button>'
    +'<button class="btn-sm" onclick="document.execCommand(\'underline\')"><u>U</u></button>'
    +'<select class="btn-sm" onchange="document.execCommand(\'formatBlock\',false,this.value);this.value=\'p\'"><option value="p">Đoạn văn</option><option value="h2">H2</option><option value="h3">H3</option></select>'
    +'<button class="btn-sm" onclick="document.execCommand(\'insertUnorderedList\')">• List</button>'
    +'<button class="btn-sm" onclick="document.execCommand(\'insertOrderedList\')">1. List</button>'
    +'</div>'
    +'<div id="sub-content-ed" contenteditable="true" style="flex:1;overflow-y:auto;padding:18px;outline:none;font-size:14px;line-height:1.8;min-height:260px;max-height:380px">'
    +'<p style="color:#aaa">⏳ Đang tải nội dung...</p>'
    +'</div>'
    +'<div style="border-top:1px solid #e5e7eb;padding:10px 18px">'
    +'<textarea id="sub-notes-inp" rows="2" style="width:100%;border:1px solid #e5e7eb;border-radius:7px;padding:7px;font-size:12px;outline:none;resize:none" placeholder="📎 Ghi chú nhanh...">'+( item.notes||'')+'</textarea>'
    +'</div>'
    +'<div style="padding:10px 18px;border-top:1px solid #e5e7eb;display:flex;justify-content:flex-end;gap:8px">'
    +'<button onclick="document.getElementById(\'pm-sub-modal\').remove()" style="background:#f3f4f6;border:none;border-radius:8px;padding:7px 14px;font-size:13px;cursor:pointer">Hủy</button>'
    +'<button onclick="saveSubModule('+mi+','+si+')" style="background:#7c3aed;color:#fff;border:none;border-radius:8px;padding:7px 16px;font-size:13px;font-weight:700;cursor:pointer">💾 Lưu</button>'
    +'</div></div>';
  document.body.appendChild(d);
  // Load content from Firebase
  fbLoadItemContent(item.id, function(html) {
    var ed = document.getElementById('sub-content-ed'); if (!ed) return;
    ed.innerHTML = html || '<p style="color:#aaa">Soạn thảo nội dung...</p>';
    ed.addEventListener('focus', function(){ if(ed.querySelector('p[style*="color:#aaa"]')) ed.innerHTML=''; }, {once:true});
  });
}

function saveSubModule(mi, si) {
  var item = personalModules[mi] && personalModules[mi].items && personalModules[mi].items[si];
  if (!item) return;
  var n = document.getElementById('sub-name-inp');
  var c = document.getElementById('sub-content-ed');
  var nt = document.getElementById('sub-notes-inp');
  if (n) item.name = n.value || item.name;
  if (nt) item.notes = nt.value;
  // Save heavy content separately — does NOT go into personalData
  if (c) fbSaveItemContent(item.id, c.innerHTML);
  document.getElementById('pm-sub-modal').remove();
  fbSavePersonal(); // only saves lightweight metadata
  var grid = document.getElementById('pm-subgrid');
  if (grid && window.buildPmSubGrid) grid.innerHTML = window.buildPmSubGrid(mi);
  showToast('Đã lưu: ' + item.name, 'success');
}

// ── PUBLIC MODULES GRID ──
function renderPublicModulesGrid() {
  var grid = document.getElementById('public-modules-grid');
  if(!grid) return;
  var html = '';
  moduleGroups.forEach(function(g){
    html += '<div onclick="showPublicGroupDetail('+g.id+')" style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:16px;cursor:pointer">'
      +'<div style="font-size:28px;margin-bottom:8px">'+g.icon+'</div>'
      +'<div style="font-weight:700;font-size:13px;margin-bottom:4px">'+g.name+'</div>'
      +'<div style="font-size:11px;color:#aaa">'+((g.modules||[]).length)+' modules</div>'
      +'</div>';
  });
  grid.innerHTML = html;
}

function showPublicGroupDetail(gid) {
  var g = moduleGroups.find(function(x){return x.id===gid;}); if(!g) return;
  var container = document.getElementById('public-modules-grid'); if(!container) return;
  var modsHtml = '';
  (g.modules||[]).forEach(function(m){
    var docs = MODULE_DOCS[m.id]; var fc = docs ? docs.files.length : 0;
    var hasDocs = fc > 0;
    modsHtml += '<div id="pubmod-'+m.id+'" style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:18px 16px;cursor:pointer;transition:box-shadow .15s,border-color .15s" '
      +'onmouseover="this.style.boxShadow=\'0 4px 16px rgba(0,0,0,.1)\';this.style.borderColor=\'#0891b2\'" '
      +'onmouseout="this.style.boxShadow=\'\';this.style.borderColor=\'#e5e7eb\'">'
      +'<div style="font-size:26px;margin-bottom:10px">'+m.icon+'</div>'
      +'<div style="font-weight:700;font-size:13px;margin-bottom:6px;line-height:1.4">'+m.name+'</div>'
      +'<div style="display:flex;align-items:center;gap:6px">'
      +'<span style="font-size:11px;color:'+(hasDocs?'#0891b2':'#aaa')+';font-weight:'+(hasDocs?'700':'400')+'">'+fc+' tài liệu</span>'
      +(hasDocs?'<span style="font-size:10px;background:#e0f2fe;color:#0369a1;padding:1px 6px;border-radius:8px;font-weight:700">Có nội dung</span>':'')
      +'</div></div>';
  });
  container.innerHTML = '<div style="grid-column:1/-1;display:flex;align-items:center;gap:10px;margin-bottom:4px">'
    +'<button onclick="renderPublicModulesGrid()" style="background:#f3f4f6;border:1px solid #e5e7eb;border-radius:7px;padding:6px 12px;font-size:12px;cursor:pointer;font-weight:600">&larr; Quay lại</button>'
    +'<span style="font-size:15px;font-weight:700;color:#1e293b">'+g.icon+' '+g.name+'</span>'
    +'<span style="font-size:12px;color:#aaa;margin-left:4px">'+g.modules.length+' modules</span>'
    +'</div>'
    +'<div style="grid-column:1/-1;display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px">'
    +modsHtml+'</div>';
  g.modules.forEach(function(m){
    var el = document.getElementById('pubmod-'+m.id);
    if(el) el.addEventListener('click', function(){showModulePage(m.id, m.name, gid, null);});
  });
}

// ============================================================
// TRASH & STORAGE
// ============================================================
var trash = [];

function updateTrashBadge() {
  var b = document.getElementById('trash-badge');
  var n = trash.length;
  if (b) { b.textContent = n; b.style.display = n > 0 ? 'inline' : 'none'; }
}

function renderTrash() {
  var list = document.getElementById('trash-list');
  var countEl = document.getElementById('trash-count');
  if (!list) return;
  if (countEl) countEl.textContent = trash.length ? '(' + trash.length + ' items)' : '';
  if (!trash.length) {
    list.innerHTML = '<p style="color:#aaa;font-style:italic;text-align:center;padding:24px">Thùng rác trống.</p>';
    return;
  }
  list.innerHTML = trash.map(function(item, i) {
    var label = (item.data && item.data.name) ? item.data.name : (item.type || 'Item');
    var icon = item.type === 'file' ? '📁' : item.type === 'doc' ? '📝' : item.type === 'sheet' ? '📊' : '🗑️';
    return '<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid #f5f5f5">'
      + '<span style="font-size:20px">' + icon + '</span>'
      + '<div style="flex:1">'
      + '<div style="font-weight:600;font-size:13px">' + label + '</div>'
      + '<div style="font-size:11px;color:#aaa">Xóa bởi ' + (item.deletedBy||'?') + ' · ' + (item.deletedAt||'') + (item.reason ? ' · ' + item.reason : '') + '</div>'
      + '</div>'
      + '<button onclick="restoreTrash(' + i + ')" style="background:#dcfce7;color:#166534;border:none;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer">♻️ Khôi phục</button>'
      + '<button onclick="deleteTrashItem(' + i + ')" style="background:#fee2e2;color:#ef4444;border:none;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;margin-left:4px">🗑️ Xóa vĩnh viễn</button>'
      + '</div>';
  }).join('');
}

function restoreTrash(i) {
  var item = trash[i]; if (!item) return;
  if (item.type === 'file') { sharedFiles.push(item.data); fbSaveSharedFiles(); }
  else if (item.type === 'doc') { sharedDocs.push(item.data); fbSaveSharedDocs(); }
  else if (item.type === 'sheet') { sharedSheets.push(item.data); fbSaveSharedSheets(); }
  trash.splice(i, 1);
  showToast('Đã khôi phục: ' + (item.data && item.data.name ? item.data.name : 'item'), 'success');
  renderTrash(); updateTrashBadge();
}

function deleteTrashItem(i) {
  var item = trash[i]; if (!item) return;
  if (!confirm('Xóa vĩnh viễn "' + (item.data && item.data.name ? item.data.name : 'item') + '"?')) return;
  trash.splice(i, 1);
  showToast('Đã xóa vĩnh viễn', 'error');
  renderTrash(); updateTrashBadge();
}

function emptyTrash() {
  if (!trash.length) { showToast('Thùng rác đã trống', 'warning'); return; }
  if (!confirm('Xóa vĩnh viễn tất cả ' + trash.length + ' items?')) return;
  trash = [];
  showToast('Đã làm trống thùng rác', 'error');
  renderTrash(); updateTrashBadge();
}

// ── STORAGE WIDGET ──
// ── TRASH TABS ──
function switchTrashTab(tab, el) {
  document.querySelectorAll('.trash-tab').forEach(function(t){t.style.color='#888';t.style.borderBottomColor='transparent';});
  el.style.color='#dc2626'; el.style.borderBottomColor='#dc2626';
  ['storage','trash','cleanup','backup'].forEach(function(t){var d=document.getElementById('trash-tab-'+t);if(d)d.style.display=t===tab?'block':'none';});
  if(tab==='storage') renderStorageWidget('storage-widget');
  if(tab==='trash') renderTrash();
  if(tab==='cleanup') renderCleanupPanel();
  if(tab==='backup') renderBackupPanel();
}

// ── CLEANUP ──
function renderCleanupPanel() {
  var el = document.getElementById('cleanup-panel'); if(!el) return;
  el.innerHTML = '<div class="card" style="border-top-color:#f59e0b">'
    +'<div class="card-title">🧹 Công cụ dọn dẹp Firebase</div>'
    +'<div style="display:flex;flex-direction:column;gap:10px">'

    // Orphaned itemContent
    +'<div style="background:#f8f9fb;border-radius:10px;padding:16px;border:1px solid #e5e7eb">'
    +'<div style="display:flex;align-items:center;gap:10px">'
    +'<div style="flex:1"><div style="font-weight:700;font-size:13px">🗃️ Xóa nội dung mồ côi</div>'
    +'<div style="font-size:12px;color:#888;margin-top:2px">Xóa HTML content của items đã bị xóa khỏi personal modules</div></div>'
    +'<button onclick="cleanOrphanedContent()" style="background:#f59e0b;color:#fff;border:none;border-radius:7px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer">Dọn dẹp</button>'
    +'</div><div id="cleanup-orphan-result" style="margin-top:8px;font-size:12px;color:#555"></div></div>'

    // Old file hashes
    +'<div style="background:#f8f9fb;border-radius:10px;padding:16px;border:1px solid #e5e7eb">'
    +'<div style="display:flex;align-items:center;gap:10px">'
    +'<div style="flex:1"><div style="font-weight:700;font-size:13px">🔑 Xóa hash table cũ</div>'
    +'<div style="font-size:12px;color:#888;margin-top:2px">Xóa bảng hash dùng để detect file trùng — tự động rebuild khi upload mới</div></div>'
    +'<button onclick="cleanFileHashes()" style="background:#6366f1;color:#fff;border:none;border-radius:7px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer">Xóa hết</button>'
    +'</div><div id="cleanup-hash-result" style="margin-top:8px;font-size:12px;color:#555"></div></div>'

    // Old comments
    +'<div style="background:#f8f9fb;border-radius:10px;padding:16px;border:1px solid #e5e7eb">'
    +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'
    +'<div style="flex:1"><div style="font-weight:700;font-size:13px">💬 Xóa comments cũ</div>'
    +'<div style="font-size:12px;color:#888;margin-top:2px">Xóa bình luận trong modules cũ hơn N ngày</div></div></div>'
    +'<div style="display:flex;gap:8px;align-items:center">'
    +'<label style="font-size:12px;color:#555">Xóa comments cũ hơn</label>'
    +'<input id="cleanup-days" type="number" value="90" min="7" style="width:70px;border:1px solid #e5e7eb;border-radius:6px;padding:5px 8px;font-size:13px">'
    +'<label style="font-size:12px;color:#555">ngày</label>'
    +'<button onclick="cleanOldComments()" style="background:#ef4444;color:#fff;border:none;border-radius:7px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer;margin-left:auto">Xóa</button>'
    +'</div><div id="cleanup-comment-result" style="margin-top:8px;font-size:12px;color:#555"></div></div>'

    +'</div></div>';
}

function cleanOrphanedContent() {
  if (!currentUser || !currentUser.uid) return;
  var el = document.getElementById('cleanup-orphan-result');
  if(el) el.textContent = '⏳ Đang kiểm tra...';
  // Collect all valid item IDs
  var validIds = {};
  personalModules.forEach(function(m){ (m.items||[]).forEach(function(item){ validIds[item.id] = true; }); });
  fbGet('/users/' + currentUser.uid + '/itemContent', function(err, data) {
    if (err || !data) { if(el) el.textContent = 'Không có gì để dọn.'; return; }
    var orphans = Object.keys(data).filter(function(id){ return !validIds[id]; });
    if (!orphans.length) { if(el) el.innerHTML = '<span style="color:#22c55e">✅ Không có nội dung mồ côi.</span>'; return; }
    var done = 0;
    orphans.forEach(function(id) {
      fbDelete('/users/' + currentUser.uid + '/itemContent/' + id, function(){
        done++;
        if (done === orphans.length && el) el.innerHTML = '<span style="color:#22c55e">✅ Đã xóa '+done+' items mồ côi (~'+Math.round(done*3)+'KB giải phóng)</span>';
      });
    });
  });
}

function cleanFileHashes() {
  var el = document.getElementById('cleanup-hash-result');
  if(el) el.textContent = '⏳ Đang xóa...';
  fbDelete('/fileHashes', function() {
    if(el) el.innerHTML = '<span style="color:#22c55e">✅ Đã xóa toàn bộ hash table. Sẽ tự build lại khi upload file mới.</span>';
  });
}

function cleanOldComments() {
  var daysEl = document.getElementById('cleanup-days');
  var days = parseInt(daysEl ? daysEl.value : 90);
  var cutoff = Date.now() - days * 86400000;
  var el = document.getElementById('cleanup-comment-result');
  if(el) el.textContent = '⏳ Đang kiểm tra...';
  fbGet('/moduleData', function(err, data) {
    if (err || !data) { if(el) el.textContent = 'Không có module data.'; return; }
    var total = 0;
    var mids = Object.keys(data);
    var pending = mids.length;
    if (!pending) { if(el) el.textContent = 'Không có gì để dọn.'; return; }
    mids.forEach(function(mid) {
      var cmts = data[mid] && data[mid].comments;
      if (!cmts || !cmts.length) { if(!--pending && el) el.innerHTML = '<span style="color:#22c55e">✅ Đã xóa '+total+' comments cũ.</span>'; return; }
      var arr = Array.isArray(cmts) ? cmts : Object.values(cmts);
      var filtered = arr.filter(function(c) {
        // Parse Vietnamese date format dd/mm/yyyy hh:mm:ss
        try { var d = new Date(c.time); return !isNaN(d) ? d.getTime() > cutoff : true; } catch(e){ return true; }
      });
      total += arr.length - filtered.length;
      fbSet('/moduleData/'+mid+'/comments', filtered, function(){
        if (!--pending && el) el.innerHTML = '<span style="color:#22c55e">✅ Đã xóa '+total+' comments cũ hơn '+days+' ngày.</span>';
      });
    });
  });
}

// ── BACKUP ──
function renderBackupPanel() {
  var el = document.getElementById('backup-panel'); if(!el) return;
  el.innerHTML = '<div class="card" style="border-top-color:#1d4ed8">'
    +'<div class="card-title">💿 Backup & Restore</div>'
    +'<div style="display:flex;flex-direction:column;gap:10px">'

    +'<div style="background:#f0f9ff;border-radius:10px;padding:16px;border:1px solid #bae6fd">'
    +'<div style="font-weight:700;font-size:13px;margin-bottom:4px">📥 Export toàn bộ dữ liệu</div>'
    +'<div style="font-size:12px;color:#555;margin-bottom:12px">Tải về file JSON chứa: modules, files, comments, settings. Dùng để backup hoặc migrate.</div>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
    +'<button onclick="exportBackup(\'shared\')" style="background:#1d4ed8;color:#fff;border:none;border-radius:7px;padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer">⬇️ Export Shared Data</button>'
    +'<button onclick="exportBackup(\'personal\')" style="background:#7c3aed;color:#fff;border:none;border-radius:7px;padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer">⬇️ Export Personal Data</button>'
    +'<button onclick="exportBackup(\'all\')" style="background:#0891b2;color:#fff;border:none;border-radius:7px;padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer">⬇️ Export Tất cả</button>'
    +'</div></div>'

    +'<div style="background:#fefce8;border-radius:10px;padding:16px;border:1px solid #fde047">'
    +'<div style="font-weight:700;font-size:13px;margin-bottom:4px">📤 Import / Restore</div>'
    +'<div style="font-size:12px;color:#555;margin-bottom:10px">⚠️ Sẽ ghi đè dữ liệu hiện tại. Backup trước khi restore!</div>'
    +'<label style="background:#f59e0b;color:#fff;border:none;border-radius:7px;padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer">'
    +'📂 Chọn file JSON để restore<input type="file" accept=".json" style="display:none" onchange="importBackup(this)"></label>'
    +'<div id="import-result" style="margin-top:8px;font-size:12px"></div>'
    +'</div>'

    +'</div></div>';
}

function exportBackup(type) {
  var filename = 'lkl-backup-' + type + '-' + new Date().toISOString().slice(0,10) + '.json';
  function download(data) {
    var blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = filename; a.click();
    showToast('✅ Đã export: ' + filename, 'success');
  }
  if (type === 'personal' && currentUser && currentUser.uid) {
    fbGet('/users/' + currentUser.uid, function(err, data){ download({type:'personal', uid: currentUser.uid, data: data, exported: new Date().toISOString()}); });
  } else if (type === 'shared') {
    fbGet('/shared', function(err, data){ download({type:'shared', data: data, exported: new Date().toISOString()}); });
  } else {
    fbGet('/shared', function(err, shared){
      fbGet('/users/' + (currentUser&&currentUser.uid||''), function(err2, personal){
        download({type:'all', shared: shared, personal: personal, exported: new Date().toISOString()});
      });
    });
  }
}

function importBackup(input) {
  var file = input.files[0]; if(!file) return;
  var el = document.getElementById('import-result');
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var backup = JSON.parse(e.target.result);
      if (!confirm('⚠️ Restore sẽ ghi đè dữ liệu hiện tại. Tiếp tục?')) return;
      if (backup.type === 'shared' && backup.data) {
        fbSet('/shared', backup.data, function(){ if(el) el.innerHTML='<span style="color:#22c55e">✅ Đã restore Shared Data!</span>'; fbLoadAll(function(){}); });
      } else if (backup.type === 'personal' && backup.data && currentUser && currentUser.uid) {
        fbSet('/users/' + currentUser.uid, backup.data, function(){ if(el) el.innerHTML='<span style="color:#22c55e">✅ Đã restore Personal Data!</span>'; });
      } else if (backup.type === 'all') {
        if (backup.shared) fbSet('/shared', backup.shared);
        if (backup.personal && currentUser && currentUser.uid) fbSet('/users/'+currentUser.uid, backup.personal);
        if(el) el.innerHTML='<span style="color:#22c55e">✅ Đã restore tất cả!</span>';
        fbLoadAll(function(){});
      } else { if(el) el.innerHTML='<span style="color:#ef4444">❌ File backup không hợp lệ.</span>'; }
    } catch(ex) { if(el) el.innerHTML='<span style="color:#ef4444">❌ Lỗi đọc file JSON.</span>'; }
  };
  reader.readAsText(file);
  input.value = '';
}

function renderStorageWidget(containerId) {
  var el = document.getElementById(containerId || 'storage-widget');
  if (!el) return;
  var totalFiles = sharedFiles.length + personalFiles.length + (cloudFiles ? cloudFiles.length : 0);
  var totalModules = moduleGroups.reduce(function(s,g){ return s + (g.modules||[]).length; }, 0);
  var trashCount = trash.length;

  function bar(usedMB, maxMB, color, label) {
    var pct = Math.min(Math.round(usedMB / maxMB * 100), 100);
    var bc = pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : color;
    var usedStr = usedMB >= 1024 ? (usedMB/1024).toFixed(1)+'GB' : usedMB.toFixed(0)+'MB';
    var maxStr  = maxMB  >= 1024 ? (maxMB/1024).toFixed(0)+'GB'  : maxMB+'MB';
    return '<div style="margin-bottom:14px">'
      +'<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">'
      +'<span style="font-weight:700;color:#374151">'+label+'</span>'
      +'<span style="color:#555">'+usedStr+' / '+maxStr+'</span></div>'
      +'<div style="background:#e5e7eb;border-radius:999px;height:8px;overflow:hidden">'
      +'<div style="width:'+pct+'%;height:100%;background:'+bc+';border-radius:999px;transition:width .4s"></div>'
      +'</div>'
      +'<div style="font-size:10px;color:#aaa;margin-top:2px">'+pct+'% đã dùng</div>'
      +'</div>';
  }

  // Cloudinary: sum bytes from uploaded files (cloudinary:true have numeric size in bytes)
  var cloudUsedBytes = sharedFiles.concat(personalFiles).reduce(function(s,f){ return s + (f.cloudinary && typeof f.size === 'number' ? f.size : 0); }, 0);
  var cloudUsedMB = cloudUsedBytes / 1048576;
  var cloudFileCount = sharedFiles.concat(personalFiles).filter(function(f){ return f.cloudinary; }).length;

  // Firebase: estimate from JSON size
  var fbEstKB = 0;
  try { fbEstKB = Math.round(JSON.stringify({personalModules,personalFiles,sharedFiles,moduleGroups}).length / 1024); } catch(e){}
  var fbUsedMB = fbEstKB / 1024;

  el.innerHTML =
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px">'
    + _storCard('📁', 'Tổng files', totalFiles, '#0891b2')
    + _storCard('📦', 'Modules', totalModules, '#1d4ed8')
    + _storCard('🗑️', 'Thùng rác', trashCount, '#ef4444')
    + '</div>'
    + '<div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:12px">📊 Dung lượng theo nền tảng</div>'
    + bar(cloudUsedMB, 25*1024, '#f59e0b', '☁️ Cloudinary ('+cloudFileCount+' files đã upload)')
    + bar(50, 1024, '#0891b2', '🐙 GitHub Pages (code + tài liệu tĩnh)')
    + bar(fbUsedMB, 1024, '#22c55e', '🔥 Firebase DB (metadata ~'+fbEstKB+'KB)')
    + '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;font-size:12px;color:#166534">'
    +'✅ Tổng dung lượng miễn phí: <strong>~27GB</strong> (Cloudinary 25GB + GitHub 1GB + Firebase 1GB)</div>';
}

function _storCard(icon, label, count, color) {
  return '<div style="background:#f8f9fb;border-radius:10px;padding:12px;text-align:center;border:1px solid #e5e7eb">'
    + '<div style="font-size:22px;margin-bottom:4px">' + icon + '</div>'
    + '<div style="font-size:20px;font-weight:800;color:' + color + '">' + count + '</div>'
    + '<div style="font-size:11px;color:#888;margin-top:2px">' + label + '</div>'
    + '</div>';
}

