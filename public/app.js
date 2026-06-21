// State
let hostsData = [];
let originalRawText = '';
let isWritable = false;
let backupsList = [];
let editingRowId = null;
let sessionToken = localStorage.getItem('sudomain_token') || '';
let logsInterval = null;

// DOM Elements
const navItems = document.querySelectorAll('.nav-item');
const tabPanes = document.querySelectorAll('.tab-pane');
const hostsPathDisplay = document.getElementById('hosts-path-display');
const btnReload = document.getElementById('btn-reload');

// Auth elements
const loginOverlay = document.getElementById('login-overlay');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const loginUsernameInput = document.getElementById('login-username');
const loginPasswordInput = document.getElementById('login-password');
const btnLogout = document.getElementById('btn-logout');

// Dashboard Elements
const statTotal = document.getElementById('stat-total');
const statActive = document.getElementById('stat-active');
const statDisabled = document.getElementById('stat-disabled');
const addEntryForm = document.getElementById('add-entry-form');
const inputIp = document.getElementById('input-ip');
const inputHosts = document.getElementById('input-hosts');
const inputComment = document.getElementById('input-comment');
const btnAddEntry = document.getElementById('btn-add-entry');

// List Elements
const searchInput = document.getElementById('search-input');
const filterType = document.getElementById('filter-type');
const hostsTableBody = document.getElementById('hosts-table-body');
const btnSaveTable = document.getElementById('btn-save-table');

// Raw Editor Elements
const rawHostsTextarea = document.getElementById('raw-hosts-textarea');
const editorLineNumbers = document.getElementById('editor-line-numbers');
const btnSaveRaw = document.getElementById('btn-save-raw');

// Backups Elements
const backupsTableBody = document.getElementById('backups-table-body');

// Settings Elements
const settingsForm = document.getElementById('settings-credentials-form');
const settingsNewUsername = document.getElementById('settings-new-username');
const settingsCurrentPassword = document.getElementById('settings-current-password');
const settingsNewPassword = document.getElementById('settings-new-password');
const settingsConfirmPassword = document.getElementById('settings-confirm-password');

// Import / Export Elements
const btnExportHosts = document.getElementById('btn-export-hosts');
const btnImportHosts = document.getElementById('btn-import-hosts');
const importFileInput = document.getElementById('import-file-input');

// Logs Elements
const auditTerminal = document.getElementById('audit-terminal');

// Mobile Navigation Elements
const mobileHeader = document.getElementById('mobile-header');
const btnHamburger = document.getElementById('btn-hamburger');
const sidebar = document.getElementById('sidebar');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
const mobileStatusBadge = document.getElementById('mobile-status-badge');

// Permission elements
const permissionPanel = document.getElementById('permission-panel');
const permissionBadge = document.getElementById('permission-badge');
const permissionWarning = document.getElementById('permission-warning');
const permissionSuccess = document.getElementById('permission-success');

// Toast Container
const toastContainer = document.getElementById('toast-container');

// Modal Elements
const confirmModal = document.getElementById('confirm-modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalCancel = document.getElementById('modal-cancel');
const modalConfirm = document.getElementById('modal-confirm');
let modalCallback = null;

// --- Authentication Operations ---

function handleUnauthorized() {
  sessionToken = '';
  localStorage.removeItem('sudomain_token');
  loginOverlay.classList.remove('hidden');
  appContainer.classList.add('hidden');
  if (mobileHeader) mobileHeader.classList.add('hidden');
  showToast('Session expired or unauthorized. Please sign in.', 'error');
  
  // Stop logs polling
  if (logsInterval) {
    clearInterval(logsInterval);
    logsInterval = null;
  }
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = loginUsernameInput.value.trim();
  const password = loginPasswordInput.value.trim();

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      throw new Error('Invalid username or password');
    }

    const result = await response.json();
    sessionToken = result.token;
    localStorage.setItem('sudomain_token', sessionToken);
    
    // Clear inputs
    loginUsernameInput.value = '';
    loginPasswordInput.value = '';

    // Show app interface
    loginOverlay.classList.add('hidden');
    appContainer.classList.remove('hidden');
    if (mobileHeader) mobileHeader.classList.remove('hidden');

    showToast('Access granted! Welcome to sudomain.', 'success');
    
    // Start logs polling
    startLogsPolling();

    // Initial fetch
    fetchHosts();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

btnLogout.addEventListener('click', async () => {
  try {
    await fetch('/api/logout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    });
  } catch (err) {
    console.error('Logout failed:', err);
  }

  sessionToken = '';
  localStorage.removeItem('sudomain_token');
  loginOverlay.classList.remove('hidden');
  appContainer.classList.add('hidden');
  if (mobileHeader) mobileHeader.classList.add('hidden');
  showToast('You have signed out successfully.', 'success');
  
  // Stop logs polling
  if (logsInterval) {
    clearInterval(logsInterval);
    logsInterval = null;
  }
});

function checkSession() {
  if (sessionToken) {
    loginOverlay.classList.add('hidden');
    appContainer.classList.remove('hidden');
    if (mobileHeader) mobileHeader.classList.remove('hidden');
    fetchHosts();
    startLogsPolling();
  } else {
    loginOverlay.classList.remove('hidden');
    appContainer.classList.add('hidden');
    if (mobileHeader) mobileHeader.classList.add('hidden');
  }
}

// --- Settings Operations ---

settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const newUsername = settingsNewUsername.value.trim();
  const currentPassword = settingsCurrentPassword.value;
  const newPassword = settingsNewPassword.value;
  const confirmPassword = settingsConfirmPassword.value;

  if (newPassword !== confirmPassword) {
    showToast('New passwords do not match.', 'error');
    return;
  }

  try {
    const response = await fetch('/api/settings/credentials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({ currentPassword, newUsername, newPassword })
    });

    if (response.status === 401) {
      handleUnauthorized();
      return;
    }

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to update credentials.');
    }

    showToast('Credentials updated successfully! Logging you out...', 'success');
    
    // Clear form
    settingsNewUsername.value = '';
    settingsCurrentPassword.value = '';
    settingsNewPassword.value = '';
    settingsConfirmPassword.value = '';

    // Invalidate session locally and redirect
    setTimeout(() => {
      handleUnauthorized();
    }, 1500);
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// --- Tab Navigation ---
navItems.forEach(item => {
  item.addEventListener('click', () => {
    const targetTab = item.getAttribute('data-tab');
    if (!targetTab) return; // Skip sign-out button
    
    // Update active nav button
    navItems.forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    
    // Update active tab pane
    tabPanes.forEach(pane => {
      pane.classList.remove('active');
      if (pane.id === `tab-${targetTab}`) {
        pane.classList.add('active');
      }
    });

    // Handle tab-specific loads
    if (targetTab === 'backups') {
      fetchBackups();
    }
  });
});

// --- Mobile Navigation Operations ---

if (btnHamburger) {
  btnHamburger.addEventListener('click', () => {
    if (sidebar) sidebar.classList.toggle('sidebar-visible');
    if (sidebarBackdrop) sidebarBackdrop.classList.toggle('active');
  });
}

if (sidebarBackdrop) {
  sidebarBackdrop.addEventListener('click', () => {
    if (sidebar) sidebar.classList.remove('sidebar-visible');
    sidebarBackdrop.classList.remove('active');
  });
}

// Close sidebar on link click in mobile view
navItems.forEach(item => {
  item.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      if (sidebar) sidebar.classList.remove('sidebar-visible');
      if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
    }
  });
});

// --- Toast System ---
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:20px;height:20px;color:var(--success)"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
  } else if (type === 'error') {
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:20px;height:20px;color:var(--danger)"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
  } else {
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:20px;height:20px;color:var(--warning)"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>`;
  }

  toast.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      ${iconSvg}
      <span>${message}</span>
    </div>
    <button class="toast-close">&times;</button>
  `;
  
  toastContainer.appendChild(toast);
  
  // Close on click
  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  });
  
  // Auto dismiss after 4s
  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }
  }, 4000);
}

// --- Custom Confirmation Modal ---
function showConfirmModal(title, message, confirmText, onConfirm) {
  modalTitle.textContent = title;
  modalMessage.textContent = message;
  modalConfirm.textContent = confirmText;
  confirmModal.classList.remove('hidden');
  modalCallback = onConfirm;
}

modalCancel.addEventListener('click', () => {
  confirmModal.classList.add('hidden');
  modalCallback = null;
});

modalConfirm.addEventListener('click', () => {
  if (modalCallback) {
    modalCallback();
  }
  confirmModal.classList.add('hidden');
  modalCallback = null;
});

// --- API Calls ---

// Update Permission Badge in Sidebar
function updatePermissionsUI(writable, hostsPath, os) {
  isWritable = writable;
  hostsPathDisplay.textContent = hostsPath;

  // Sync Desktop Sidebar status
  permissionBadge.className = 'permission-badge ' + (writable ? 'status-granted' : 'status-denied');
  const statusText = permissionBadge.querySelector('.status-text');
  statusText.textContent = writable ? 'Admin Access' : 'Read-Only';

  // Sync Mobile Top Header status
  if (mobileStatusBadge) {
    mobileStatusBadge.className = 'mobile-status-badge ' + (writable ? 'status-granted' : 'status-denied');
  }

  const warningText = document.getElementById('permission-warning-text');
  if (warningText) {
    if (os === 'win32') {
      warningText.innerHTML = 'To save changes, run this server from a terminal opened as <strong>Administrator</strong>.';
    } else {
      warningText.innerHTML = 'To save changes, run this server with <strong>root / sudo</strong> privileges (e.g., <code>sudo node server.js</code>).';
    }
  }

  if (writable) {
    permissionWarning.classList.add('hidden');
    permissionSuccess.classList.remove('hidden');
    btnSaveTable.removeAttribute('disabled');
    btnSaveRaw.removeAttribute('disabled');
  } else {
    permissionSuccess.classList.add('hidden');
    permissionWarning.classList.remove('hidden');
    btnSaveTable.setAttribute('disabled', 'true');
    btnSaveRaw.setAttribute('disabled', 'true');
  }
}

// Fetch hosts from API
async function fetchHosts() {
  try {
    hostsTableBody.innerHTML = `<tr><td colspan="5" class="loading-state">Loading hosts entries...</td></tr>`;
    
    const response = await fetch('/api/hosts', {
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    });
    
    if (response.status === 401) {
      handleUnauthorized();
      return;
    }
    
    if (!response.ok) throw new Error(await response.text());
    
    const data = await response.json();
    hostsData = data.lines;
    originalRawText = data.rawText;
    
    updatePermissionsUI(data.writable, data.hostsPath, data.os);
    
    // Fill Raw Editor Textarea
    rawHostsTextarea.value = originalRawText;
    updateLineNumbers();
    
    // Render
    renderStats();
    renderTable();
    
    // Load audit logs
    fetchLogs();
  } catch (err) {
    console.error(err);
    showToast('Failed to load hosts: ' + err.message, 'error');
    hostsTableBody.innerHTML = `<tr><td colspan="5" class="no-data-state text-danger">Error fetching hosts file lines.</td></tr>`;
  }
}

// Save hosts data (structured table view)
async function saveTableChanges() {
  if (!isWritable) {
    showToast('Permission denied. Run application as Administrator to save.', 'error');
    return;
  }
  
  try {
    btnSaveTable.textContent = 'Saving...';
    btnSaveTable.disabled = true;

    const response = await fetch('/api/hosts', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({ lines: hostsData })
    });
    
    if (response.status === 401) {
      handleUnauthorized();
      return;
    }

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unknown error');
    
    showToast('Hosts file successfully saved! Backup created: ' + result.backupCreated, 'success');
    
    // Refresh
    await fetchHosts();
  } catch (err) {
    showToast('Save failed: ' + err.message, 'error');
  } finally {
    btnSaveTable.textContent = 'Save Changes to Hosts File';
    btnSaveTable.disabled = !isWritable;
  }
}

// Save hosts raw text (text editor view)
async function saveRawChanges() {
  if (!isWritable) {
    showToast('Permission denied. Run application as Administrator to save.', 'error');
    return;
  }
  
  try {
    btnSaveRaw.textContent = 'Saving...';
    btnSaveRaw.disabled = true;

    const response = await fetch('/api/hosts', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({ rawText: rawHostsTextarea.value })
    });
    
    if (response.status === 401) {
      handleUnauthorized();
      return;
    }

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unknown error');
    
    showToast('Hosts file raw text successfully saved! Backup created: ' + result.backupCreated, 'success');
    
    // Refresh
    await fetchHosts();
  } catch (err) {
    showToast('Save failed: ' + err.message, 'error');
  } finally {
    btnSaveRaw.textContent = 'Save Raw Text';
    btnSaveRaw.disabled = !isWritable;
  }
}

// Fetch backups list
async function fetchBackups() {
  try {
    backupsTableBody.innerHTML = `<tr><td colspan="4" class="loading-state">Loading backups list...</td></tr>`;
    
    const response = await fetch('/api/backups', {
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    });
    
    if (response.status === 401) {
      handleUnauthorized();
      return;
    }

    if (!response.ok) throw new Error(await response.text());
    
    const data = await response.json();
    backupsList = data.backups;
    renderBackups();
  } catch (err) {
    showToast('Failed to fetch backups: ' + err.message, 'error');
    backupsTableBody.innerHTML = `<tr><td colspan="4" class="no-data-state">Error fetching backups.</td></tr>`;
  }
}

// Restore a backup
async function restoreBackup(filename) {
  try {
    const response = await fetch('/api/backups/restore', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({ filename })
    });
    
    if (response.status === 401) {
      handleUnauthorized();
      return;
    }

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Restore failed');
    
    showToast('Backup successfully restored!', 'success');
    await fetchHosts();
    await fetchBackups();
  } catch (err) {
    showToast('Restore failed: ' + err.message, 'error');
  }
}

// Fetch console audit logs
async function fetchLogs() {
  if (!sessionToken) return;
  try {
    const response = await fetch('/api/logs', {
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    });

    if (response.status === 401) {
      handleUnauthorized();
      return;
    }

    const data = await response.json();
    renderLogs(data.logs);
  } catch (err) {
    console.error('Failed to fetch logs:', err);
  }
}

function startLogsPolling() {
  if (logsInterval) clearInterval(logsInterval);
  logsInterval = setInterval(fetchLogs, 10000); // Poll every 10s
}

// --- Render Operations ---

// Render Audit Logs in Console
function renderLogs(logs) {
  if (!auditTerminal) return;
  
  if (!logs || logs.length === 0) {
    auditTerminal.innerHTML = `<div class="terminal-line"><span class="log-time">[--:--:--]</span> <span class="log-action">SYSTEM:</span> No events logged yet.</div>`;
    return;
  }

  // Reverse logs to render oldest at top and newest at bottom
  const reversedLogs = [...logs].reverse();

  auditTerminal.innerHTML = reversedLogs.map(log => {
    const date = new Date(log.timestamp);
    const timeStr = date.toLocaleTimeString();
    return `
      <div class="terminal-line">
        <span class="log-time">[${timeStr}]</span> 
        <span class="log-action">${escapeHtml(log.action)}:</span> 
        <span class="log-details">${escapeHtml(log.details)}</span>
      </div>
    `;
  }).join('');

  // Scroll to bottom
  auditTerminal.scrollTop = auditTerminal.scrollHeight;
}

// Render Top Stats Counters
function renderStats() {
  let total = 0;
  let active = 0;
  let disabled = 0;

  hostsData.forEach(line => {
    if (line.type === 'entry') {
      total++;
      if (line.enabled) {
        active++;
      } else {
        disabled++;
      }
    }
  });

  statTotal.textContent = total;
  statActive.textContent = active;
  statDisabled.textContent = disabled;
}

// Render Structured Hosts Table
function renderTable() {
  hostsTableBody.innerHTML = '';
  
  const query = searchInput.value.toLowerCase().trim();
  const filterVal = filterType.value;

  // Filter line items
  const filteredLines = hostsData.filter(line => {
    // Dropdown Filters
    if (filterVal === 'entries' && line.type !== 'entry') return false;
    if (filterVal === 'active' && (line.type !== 'entry' || !line.enabled)) return false;
    if (filterVal === 'disabled' && (line.type !== 'entry' || line.enabled)) return false;
    if (filterVal === 'comments' && line.type !== 'comment') return false;
    
    // Search Filters
    if (query) {
      if (line.type === 'entry') {
        const ipMatch = line.ip.toLowerCase().includes(query);
        const hostMatch = line.hosts.toLowerCase().includes(query);
        const commentMatch = line.comment && line.comment.toLowerCase().includes(query);
        return ipMatch || hostMatch || commentMatch;
      } else if (line.type === 'comment') {
        return line.comment && line.comment.toLowerCase().includes(query);
      }
      return false; // Skip empty lines in searches
    }

    return true;
  });

  if (filteredLines.length === 0) {
    hostsTableBody.innerHTML = `<tr><td colspan="5" class="no-data-state">No matching lines found.</td></tr>`;
    return;
  }

  filteredLines.forEach(line => {
    const tr = document.createElement('tr');
    
    if (line.type === 'empty') {
      tr.className = 'line-type-empty';
      tr.innerHTML = `<td colspan="5"></td>`;
      hostsTableBody.appendChild(tr);
      return;
    }
    
    if (line.type === 'comment') {
      tr.className = 'line-type-comment';
      tr.innerHTML = `
        <td style="text-align:center;">#</td>
        <td colspan="4" class="comment-text"># ${escapeHtml(line.comment)}</td>
      `;
      hostsTableBody.appendChild(tr);
      return;
    }

    // Host Entry Row
    const isEditing = editingRowId === line.id;
    const isRowEnabled = line.enabled;
    
    tr.className = isRowEnabled ? 'entry-row' : 'entry-row disabled-entry-row';
    
    // Status Column
    const statusCol = `
      <td>
        <label class="switch">
          <input type="checkbox" ${isRowEnabled ? 'checked' : ''} onchange="toggleRowEnabled(${line.id})" ${isEditing ? 'disabled' : ''}>
          <span class="slider"></span>
        </label>
      </td>
    `;

    // IP column HTML
    const ipCol = isEditing 
      ? `<td><input type="text" class="edit-cell-input" id="edit-ip-${line.id}" value="${escapeHtml(line.ip)}"></td>`
      : `<td class="ip-col font-mono">${escapeHtml(line.ip)}</td>`;

    // Hosts/Domains column HTML
    const hostsCol = isEditing
      ? `<td><input type="text" class="edit-cell-input" id="edit-hosts-${line.id}" value="${escapeHtml(line.hosts)}"></td>`
      : `<td class="hosts-col font-mono">${escapeHtml(line.hosts)}</td>`;

    // Comment column HTML
    const commentCol = isEditing
      ? `<td><input type="text" class="edit-cell-input" id="edit-comment-${line.id}" value="${escapeHtml(line.comment || '')}"></td>`
      : `<td class="comment-col">${escapeHtml(line.comment || '')}</td>`;

    // Action buttons column HTML
    let actionsCol = '';
    if (isEditing) {
      actionsCol = `
        <td style="text-align: right;">
          <div class="row-edit-buttons">
            <button class="btn btn-sm btn-primary" onclick="saveRowEdit(${line.id})">Save</button>
            <button class="btn btn-sm btn-secondary" onclick="cancelRowEdit()">Cancel</button>
          </div>
        </td>
      `;
    } else {
      actionsCol = `
        <td style="text-align: right;">
          <div class="row-edit-buttons">
            <button class="btn btn-sm btn-secondary" onclick="startRowEdit(${line.id})" title="Edit Mappings">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:14px;height:14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" /></svg>
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteRow(${line.id})" title="Delete Mappings">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:14px;height:14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
            </button>
          </div>
        </td>
      `;
    }

    tr.innerHTML = statusCol + ipCol + hostsCol + commentCol + actionsCol;
    hostsTableBody.appendChild(tr);
  });
}

// Render Backups list
function renderBackups() {
  backupsTableBody.innerHTML = '';
  
  if (backupsList.length === 0) {
    backupsTableBody.innerHTML = `<tr><td colspan="4" class="no-data-state">No backups created yet.</td></tr>`;
    return;
  }

  backupsList.forEach(backup => {
    const tr = document.createElement('tr');
    
    const sizeKb = (backup.size / 1024).toFixed(2);
    const dateFormatted = new Date(backup.time).toLocaleString();

    tr.innerHTML = `
      <td class="backup-filename">${escapeHtml(backup.filename)}</td>
      <td>${dateFormatted}</td>
      <td>${sizeKb} KB</td>
      <td style="text-align: right;">
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="btn btn-sm btn-primary" onclick="confirmRestore('${escapeHtml(backup.filename)}')">
            Restore
          </button>
          <button class="btn btn-sm btn-danger" onclick="confirmDeleteBackup('${escapeHtml(backup.filename)}')">
            Delete
          </button>
        </div>
      </td>
    `;
    
    backupsTableBody.appendChild(tr);
  });
}

// --- Helper Functions ---

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// --- Import / Export Handlers ---

// Export Mappings File
btnExportHosts.addEventListener('click', () => {
  try {
    const blob = new Blob([originalRawText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hosts_backup.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Hosts file exported successfully!', 'success');
  } catch (err) {
    showToast('Export failed: ' + err.message, 'error');
  }
});

// Import trigger click file input
btnImportHosts.addEventListener('click', () => {
  importFileInput.click();
});

// Import File Selector Change event
importFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    const content = evt.target.result;
    
    showConfirmModal(
      'Import Hosts File',
      `Are you sure you want to replace your hosts file with the contents of "${file.name}"? A backup will be created before saving.`,
      'Replace and Save',
      async () => {
        try {
          const response = await fetch('/api/hosts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({ rawText: content })
          });

          if (response.status === 401) {
            handleUnauthorized();
            return;
          }

          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Import failed');

          showToast(`Hosts successfully replaced with contents of ${file.name}!`, 'success');
          
          // Reset file selector
          importFileInput.value = '';

          // Reload
          fetchHosts();
        } catch (err) {
          showToast('Import failed: ' + err.message, 'error');
        }
      }
    );
  };
  
  reader.readAsText(file);
});

// --- Event Handlers & Table Interactions ---

// Toggle Active State
window.toggleRowEnabled = function(id) {
  const row = hostsData.find(line => line.id === id);
  if (row) {
    row.enabled = !row.enabled;
    row.raw = null; // Clear raw representation so we format it afresh on save
    renderStats();
    renderTable();
  }
};

// Inline Edit handlers
window.startRowEdit = function(id) {
  editingRowId = id;
  renderTable();
};

window.cancelRowEdit = function() {
  editingRowId = null;
  renderTable();
};

window.saveRowEdit = function(id) {
  const row = hostsData.find(line => line.id === id);
  if (row) {
    const newIp = document.getElementById(`edit-ip-${id}`).value.trim();
    const newHosts = document.getElementById(`edit-hosts-${id}`).value.trim();
    const newComment = document.getElementById(`edit-comment-${id}`).value.trim();

    // Validations
    if (!newIp || !newHosts) {
      showToast('IP Address and Domain Name(s) are required.', 'error');
      return;
    }

    row.ip = newIp;
    row.hosts = newHosts;
    row.comment = newComment;
    row.raw = null; // Clear raw representation to regenerate on save

    editingRowId = null;
    renderStats();
    renderTable();
    showToast('Row updated locally. Click "Save Changes" to apply onto hosts file.', 'warning');
  }
};

// Delete row
window.deleteRow = function(id) {
  const idx = hostsData.findIndex(line => line.id === id);
  if (idx !== -1) {
    hostsData.splice(idx, 1);
    renderStats();
    renderTable();
    showToast('Row deleted locally. Click "Save Changes" to apply onto hosts file.', 'warning');
  }
};

// Quick Add Form Submit
addEntryForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const ip = inputIp.value.trim();
  const hosts = inputHosts.value.trim();
  const comment = inputComment.value.trim();

  if (!ip || !hosts) {
    showToast('IP Address and Domain Name(s) are required.', 'error');
    return;
  }

  // Create a new entry
  const maxId = hostsData.reduce((max, line) => line.id > max ? line.id : max, -1);
  const newRow = {
    id: maxId + 1,
    type: 'entry',
    ip,
    hosts,
    comment,
    enabled: true,
    raw: null
  };

  hostsData.push(newRow);
  
  // Clear inputs
  inputIp.value = '';
  inputHosts.value = '';
  inputComment.value = '';

  renderStats();
  renderTable();
  
  showToast('New mapping added locally! Save changes to write to file.', 'warning');
});

// Restore confirmation
window.confirmRestore = function(filename) {
  showConfirmModal(
    'Restore Backup',
    `Are you sure you want to restore the hosts file to the backup: "${filename}"? The current file will be backed up automatically before restoring.`,
    'Restore Backup',
    () => restoreBackup(filename)
  );
};

// Delete backup actions
window.confirmDeleteBackup = function(filename) {
  showConfirmModal(
    'Delete Backup',
    `Are you sure you want to permanently delete the backup file: "${filename}"? This action cannot be undone.`,
    'Delete Backup',
    () => deleteBackup(filename)
  );
};

async function deleteBackup(filename) {
  try {
    const response = await fetch(`/api/backups/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    });

    if (response.status === 401) {
      handleUnauthorized();
      return;
    }

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Delete failed');

    showToast('Backup successfully deleted!', 'success');
    fetchBackups();
  } catch (err) {
    showToast('Delete failed: ' + err.message, 'error');
  }
}

// --- Raw Editor Line Numbers Sync ---
function updateLineNumbers() {
  const lines = rawHostsTextarea.value.split('\n');
  const count = lines.length;
  let lineNumbersText = '';
  for (let i = 1; i <= count; i++) {
    lineNumbersText += i + '\n';
  }
  editorLineNumbers.textContent = lineNumbersText;
}

rawHostsTextarea.addEventListener('input', updateLineNumbers);
rawHostsTextarea.addEventListener('scroll', () => {
  editorLineNumbers.scrollTop = rawHostsTextarea.scrollTop;
});

// Save buttons triggers
btnSaveTable.addEventListener('click', saveTableChanges);
btnSaveRaw.addEventListener('click', saveRawChanges);
btnReload.addEventListener('click', () => {
  fetchHosts();
  showToast('Reloaded hosts file from system.', 'success');
});

// Search and filters triggers
searchInput.addEventListener('input', renderTable);
filterType.addEventListener('change', renderTable);

// Initialize application state checking session
checkSession();
