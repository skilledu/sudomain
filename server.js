const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = 14314; // Port set to 14314

// Local Configuration Persistence
const CONFIG_PATH = path.join(__dirname, 'config.json');
let config = { username: 'skilledu', password: 'skilledu' };

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      console.log('Configuration successfully loaded from config.json');
    } else {
      saveConfig();
      console.log('Default configuration created in config.json');
    }
  } catch (err) {
    console.error('Failed to load config, using default credentials:', err);
  }
}

function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save config:', err);
  }
}

loadConfig();

// Active session tokens map
const activeSessions = new Set();

// Audit Logs In-Memory Storage
const auditLogs = [];
function logEvent(action, details = '') {
  const logEntry = {
    id: Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toISOString(),
    action,
    details
  };
  auditLogs.unshift(logEntry);
  if (auditLogs.length > 100) {
    auditLogs.pop(); // Keep last 100 items
  }
}

// Log startup event
logEvent('SYSTEM_STARTUP', 'sudomain console server started successfully.');

// Path to hosts file
const HOSTS_PATH = process.platform === 'win32'
  ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'drivers', 'etc', 'hosts')
  : '/etc/hosts';

// Backups directory in the workspace
const BACKUPS_DIR = path.join(__dirname, 'backups');

// Make sure backups directory exists
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Authorization Middleware
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized. Login required.' });
  }
  const token = authHeader.split(' ')[1];
  if (!activeSessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized. Invalid session.' });
  }
  next();
}

// Helper to check write access to the hosts file
function checkWriteAccess() {
  try {
    const fd = fs.openSync(HOSTS_PATH, 'r+');
    fs.closeSync(fd);
    return true;
  } catch (err) {
    return false;
  }
}

// Helper to parse hosts file
function parseHosts(content) {
  const lines = content.split(/\r?\n/);
  return lines.map((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return {
        id: idx,
        type: 'empty',
        raw: line,
        enabled: false
      };
    }

    // Check if it's an active host entry
    const activeMatch = line.match(/^\s*([0-9a-fA-F.:]+)\s+([^#\s][^#]*)(?:#\s*(.*))?$/);
    if (activeMatch) {
      const ip = activeMatch[1].trim();
      if (ip.includes('.') || ip.includes(':')) {
        return {
          id: idx,
          type: 'entry',
          raw: line,
          ip: ip,
          hosts: activeMatch[2].trim(),
          comment: activeMatch[3] ? activeMatch[3].trim() : '',
          enabled: true
        };
      }
    }

    // Check if it's a disabled host entry
    const disabledMatch = line.match(/^\s*#\s*([0-9a-fA-F.:]+)\s+([^#\s][^#]*)(?:#\s*(.*))?$/);
    if (disabledMatch) {
      const ip = disabledMatch[1].trim();
      if (ip.includes('.') || ip.includes(':')) {
        return {
          id: idx,
          type: 'entry',
          raw: line,
          ip: ip,
          hosts: disabledMatch[2].trim(),
          comment: disabledMatch[3] ? disabledMatch[3].trim() : '',
          enabled: false
        };
      }
    }

    // Otherwise, it's just a plain comment line
    let commentText = line;
    if (line.trim().startsWith('#')) {
      commentText = line.replace(/^\s*#/, '').trim();
    }
    return {
      id: idx,
      type: 'comment',
      raw: line,
      comment: commentText,
      enabled: false
    };
  });
}

// Helper to format hosts objects back to string
function formatHosts(lines) {
  return lines.map(line => {
    if (line.type === 'entry') {
      const ipPart = line.ip.padEnd(16);
      const hostsPart = line.hosts;
      const commentPart = line.comment ? ` # ${line.comment}` : '';
      const activePart = `${ipPart} ${hostsPart}${commentPart}`;
      return line.enabled ? activePart : `# ${activePart}`;
    } else if (line.type === 'comment') {
      if (line.raw !== undefined && line.raw !== null && line.raw.trim().startsWith('#')) {
        return line.raw;
      }
      return line.comment ? `# ${line.comment}` : '#';
    } else {
      return line.raw !== undefined && line.raw !== null ? line.raw : '';
    }
  }).join(process.platform === 'win32' ? '\r\n' : '\n');
}

// Backup current hosts file
function backupHostsFile() {
  try {
    if (!fs.existsSync(HOSTS_PATH)) return false;
    const content = fs.readFileSync(HOSTS_PATH, 'utf8');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `hosts_${timestamp}.bak`;
    fs.writeFileSync(path.join(BACKUPS_DIR, backupName), content, 'utf8');
    return backupName;
  } catch (err) {
    console.error('Backup failed:', err);
    return false;
  }
}

// --- Endpoints ---

// Login Endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === config.username && password === config.password) {
    const token = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
    activeSessions.add(token);
    logEvent('USER_LOGIN', `User "${username}" signed in successfully.`);
    res.json({ success: true, token });
  } else {
    logEvent('FAILED_LOGIN_ATTEMPT', `Failed sign-in attempt for user "${username}".`);
    res.status(401).json({ error: 'Invalid username or password' });
  }
});

// Logout Endpoint
app.post('/api/logout', requireAuth, (req, res) => {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    activeSessions.delete(token);
  }
  logEvent('USER_LOGOUT', 'User logged out.');
  res.json({ success: true });
});

// Update Credentials - Protected
app.post('/api/settings/credentials', requireAuth, (req, res) => {
  try {
    const { currentPassword, newUsername, newPassword } = req.body;
    if (!currentPassword || !newUsername || !newPassword) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    if (currentPassword !== config.password) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    config.username = newUsername.trim();
    config.password = newPassword;
    saveConfig();

    logEvent('CREDENTIALS_CHANGED', `User renamed console account to "${config.username}".`);
    
    // Clear all active sessions to force re-login
    activeSessions.clear();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update credentials: ' + err.message });
  }
});

// Get Audit Logs - Protected
app.get('/api/logs', requireAuth, (req, res) => {
  res.json({ logs: auditLogs });
});

// Get Status - Protected
app.get('/api/status', requireAuth, (req, res) => {
  res.json({
    writable: checkWriteAccess(),
    hostsPath: HOSTS_PATH,
    os: process.platform
  });
});

// Get parsed and raw hosts file content - Protected
app.get('/api/hosts', requireAuth, (req, res) => {
  try {
    if (!fs.existsSync(HOSTS_PATH)) {
      return res.status(404).json({ error: 'Hosts file not found' });
    }
    const rawText = fs.readFileSync(HOSTS_PATH, 'utf8');
    const lines = parseHosts(rawText);
    res.json({
      writable: checkWriteAccess(),
      hostsPath: HOSTS_PATH,
      os: process.platform,
      lines,
      rawText
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read hosts file: ' + err.message });
  }
});

// Update hosts file - Protected
app.post('/api/hosts', requireAuth, (req, res) => {
  try {
    if (!checkWriteAccess()) {
      return res.status(403).json({
        error: 'Permission denied. Please run this server with Administrator privileges.'
      });
    }

    const { lines, rawText } = req.body;
    let contentToWrite = '';

    if (rawText !== undefined) {
      contentToWrite = rawText;
      const backupName = backupHostsFile();
      
      // Ensure correct line endings
      if (process.platform === 'win32') {
        if (!contentToWrite.includes('\r\n') && contentToWrite.includes('\n')) {
          contentToWrite = contentToWrite.replace(/\n/g, '\r\n');
        }
      } else {
        contentToWrite = contentToWrite.replace(/\r\n/g, '\n');
      }

      fs.writeFileSync(HOSTS_PATH, contentToWrite, 'utf8');
      logEvent('HOSTS_SAVE_RAW', `Directly saved raw hosts text file. Backup created: ${backupName}`);
      
      return res.json({
        success: true,
        backupCreated: backupName
      });
    } else if (lines && Array.isArray(lines)) {
      contentToWrite = formatHosts(lines);
      const backupName = backupHostsFile();

      fs.writeFileSync(HOSTS_PATH, contentToWrite, 'utf8');
      logEvent('HOSTS_SAVE_TABLE', `Saved hosts from dashboard table mappings. Backup created: ${backupName}`);

      return res.json({
        success: true,
        backupCreated: backupName
      });
    } else {
      return res.status(400).json({ error: 'Invalid payload. Provide lines array or rawText string.' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to save hosts file: ' + err.message });
  }
});

// List backups - Protected
app.get('/api/backups', requireAuth, (req, res) => {
  try {
    const files = fs.readdirSync(BACKUPS_DIR);
    const backups = files
      .filter(file => file.startsWith('hosts_') && file.endsWith('.bak'))
      .map(file => {
        const filePath = path.join(BACKUPS_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          time: stats.mtime,
          size: stats.size
        };
      })
      .sort((a, b) => b.time - a.time);

    res.json({ backups });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve backups: ' + err.message });
  }
});

// Restore backup - Protected
app.post('/api/backups/restore', requireAuth, (req, res) => {
  try {
    if (!checkWriteAccess()) {
      return res.status(403).json({
        error: 'Permission denied. Please run this server with Administrator privileges.'
      });
    }

    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    const backupPath = path.join(BACKUPS_DIR, filename);
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'Backup file not found' });
    }

    // Create a backup of current before restoring
    const backupName = backupHostsFile();

    // Copy backup back to hosts path
    const content = fs.readFileSync(backupPath, 'utf8');
    fs.writeFileSync(HOSTS_PATH, content, 'utf8');

    logEvent('BACKUP_RESTORE', `Restored hosts file to backup "${filename}". Auto-backup created: ${backupName}`);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to restore backup: ' + err.message });
  }
});

// Delete backup - Protected
app.delete('/api/backups/:filename', requireAuth, (req, res) => {
  try {
    const { filename } = req.params;
    
    // Safety check to prevent directory traversal
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const backupPath = path.join(BACKUPS_DIR, filename);
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'Backup file not found' });
    }
    
    fs.unlinkSync(backupPath);
    logEvent('BACKUP_DELETE', `Deleted backup file: ${filename}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete backup: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`sudomain is running at http://localhost:${PORT}`);
  console.log(`Hosts File Path: ${HOSTS_PATH}`);
  console.log(`Write access status: ${checkWriteAccess() ? 'GRANTED' : 'DENIED (Run as Administrator)'}`);
});
