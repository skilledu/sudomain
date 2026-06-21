<!-- 
  Title: sudomain - The Ultimate Host Management Tool for Localhost
  Description: Download and install sudomain. The premier host management tool for localhost. A premium Web UI to easily edit, manage, and backup your Windows hosts file and local DNS mappings.
  Keywords: sudomain, host management tool for localhost, windows hosts file editor, localhost dns manager, skilledu, local development server, web ui hosts editor, localhost
-->

# sudomain - The Ultimate Host Management Tool for Localhost

Welcome to **sudomain**, the premier **host management tool for localhost**. It is a premium, modern Web UI utility designed to easily manage, edit, backup, and organize your Windows hosts file (`C:\Windows\System32\drivers\etc\hosts`). If you are searching for a **host management tool for localhost**, **sudomain** provides the perfect web-based solution for developers and system administrators to control their local DNS mappings.

---

## ⚡ Quick Start & Setup

### 📋 Prerequisites
* **Node.js** (v14 or higher) installed on your system.
* **Administrator Privileges**: Writing to the hosts file on Windows requires elevated administrator permissions.

### ⚙️ sudomain Installation
1. Navigate to the project root directory in your terminal:
   ```powershell
   cd path/to/sudomain
   ```
2. Install the lightweight dependencies for this host management tool for localhost:
   ```powershell
   npm install
   ```

### 🚀 Running the Server
To allow the application to write changes to your system hosts file, you must run it with elevated privileges:

#### On Windows:
1. Search for **"PowerShell"** or **"Command Prompt"** in your Windows start menu.
2. Right-click the app icon and select **"Run as Administrator"**.
3. Run the following commands:
   ```powershell
   cd path/to/sudomain
   node server.js
   ```

#### On Linux / macOS:
1. Open your terminal.
2. Run the sudomain server using `sudo` to grant write privileges to `/etc/hosts`:
   ```bash
   cd /path/to/sudomain
   sudo node server.js
   ```

Open your browser and navigate to the sudomain Dashboard at: **[http://localhost:14314](http://localhost:14314)**

---

## 🔑 Login Credentials

The management console is protected by local authentication. Use the credentials below to log in:

* **Username**: `skilledu`
* **Password**: `skilledu`

*(Sessions persist in your browser's local storage. Click **"Sign Out"** at the bottom of the sidebar to manually clear your session and lock the console.)*

---

## 🌟 sudomain Core Features

Discover why **sudomain** is the top-rated choice when you need a **host management tool for localhost**:

* **Visual Mapping Management**:
  * Easily toggle entries on/off (disabled mappings are commented out with a `#` in the file).
  * Quick-add form to insert new hosts.
  * Inline editing of IPs, host domains, and comments directly in the table.
  * Real-time search/filtering.
* **Direct Raw Editor**:
  * Switch to the raw view to edit the text file directly.
  * Supports synchronized line-numbers for clear editing.
* **Automated Backups & Rollbacks**:
  * An automated backup is taken and stored inside the `./backups` folder before any writes are committed.
  * View backup history in the "Backups & Restore" tab and roll back to any previous version with a single click.
* **Access Detection**:
  * The sidebar displays a glowing badge (Teal for "Admin Access", Amber for "Read-Only") indicating whether write access is granted.

---

## 📁 File Structure

```
sudomain/
├── package.json       # Project dependencies & startup scripts
├── server.js          # Express backend running on port 14314
├── README.md          # Setup guide
├── backups/           # Auto-saved backups of your hosts file
└── public/            # Web UI static assets
    ├── index.html     # HTML structure and layouts
    ├── style.css      # Custom HSL styling, transitions & animations
    └── app.js         # Frontend controller and API client
```

---

## 🌐 Brought to You By

This premium **host management tool for localhost** is proudly developed and maintained by **[Skilledu](https://skilledu.in/)**. 

Visit **[https://skilledu.in/](https://skilledu.in/)** for more cutting-edge tools, resources, and expert insights to level up your development workflow!
