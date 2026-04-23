# JoyShockMapper (Linux / systemd fork)

> **This is a Linux-focused fork of [JoyShockMapper](https://github.com/Electronicks/JoyShockMapper).**  
> Its primary goal is to run JoyShockMapper as a **user-level systemd service** on modern Linux desktops.
>
> For full feature documentation (bindings, configuration language, gyro / flick stick concepts, troubleshooting, etc.), refer to the upstream repository:  
> **[Electronicks/JoyShockMapper](https://github.com/Electronicks/JoyShockMapper)**

> **Note on provenance:** The changes in this fork were made largely with the help of AI tools.

---

## What is different in this fork

This fork focuses on Linux quality-of-life improvements, in particular making JoyShockMapper a well-behaved background service managed by `systemd --user`.

Key additions on top of upstream:

| Feature | Details |
|---|---|
| **User-level systemd service** | Templated service unit `joyshockmapper@.service` — start/stop/restart via `systemctl --user`. Integrates with the graphical session (`After=graphical-session.target`). |
| **UNIX socket unit** | `joyshockmapper.socket` — per-user socket at `%t/joyshockmapper.sock` (typically `/run/user/<uid>/joyshockmapper.sock`) for sending commands to the running service. |
| **Headless mode** | The service runs with `--headless`, disabling the AutoLoad window-focus switcher (which requires a focused window) while keeping the tray icon and all other features active. |
| **systemd notify + watchdog** | Integrates with `Type=notify` (signals readiness to systemd) and sends periodic watchdog keepalives when `WatchdogSec=` is configured — implemented without a libsystemd dependency. |
| **D-Bus env bootstrap** | Automatically derives `DBUS_SESSION_BUS_ADDRESS` from `XDG_RUNTIME_DIR` when the variable is missing, which is common in user services that start before the login shell sets it. |
| **XDG Desktop Portal notifications** | Uses `gio-2.0` / GIO to send notifications through the XDG Desktop Portal (`org.freedesktop.portal.Notification`) — the standard on GNOME 45+ and Fedora 43+. |
| **libmanette backend (optional)** | When `libmanette` (`manette-0.2`) is found at build time, enables a more compatible gamepad backend for modern distributions such as Fedora 43. |

---

## systemd user service — quick start

The following user-level systemd units are installed by `make install`:

- `joyshockmapper@.service` (templated service — one instance per config profile)
- `joyshockmapper.socket` (UNIX command socket)

### Enable and start

```bash
# Reload unit database after installation
systemctl --user daemon-reload

# Enable the command socket (recommended — allows sending commands to the service)
systemctl --user enable --now joyshockmapper.socket

# Start and enable a service instance.
# The instance name (@…) is arbitrary; use "default" if you only have one profile.
systemctl --user enable --now "joyshockmapper@default.service"
```

### Common operations

```bash
# Follow live logs
journalctl --user -u "joyshockmapper@default.service" -f

# Reload (reconnects controllers / re-reads config)
systemctl --user reload "joyshockmapper@default.service"

# Stop the service
systemctl --user stop "joyshockmapper@default.service"

# Check status
systemctl --user status "joyshockmapper@default.service"
```

---

## Build & install (Linux)

### Dependencies

**Required (build fails if missing):**

| Library | pkg-config name | Purpose |
|---|---|---|
| GTK 3 | `gtk+-3.0` | UI / tray icon |
| AppIndicator | `appindicator3-0.1` | System tray indicator |
| libevdev | `libevdev` | Linux input device handling |
| SDL3 | — (auto-fetched via CPM) | Controller support (built automatically at configure time; no system package needed) |

**Optional (feature-detected at configure time):**

| Library | pkg-config name | Effect when found |
|---|---|---|
| GIO / GLib | `gio-2.0` | Enables XDG Desktop Portal notifications (`HAVE_XDG_NOTIFICATIONS`). Usually present as a GTK transitive dependency. |
| libmanette | `manette-0.2` | Enables a more compatible Linux gamepad backend (`HAVE_LIBMANETTE`). |

### Install build dependencies

<details>
<summary><b>Ubuntu / Debian</b></summary>

```bash
sudo apt-get update
sudo apt-get install -y \
  clang cmake make pkg-config \
  libgtk-3-dev \
  libappindicator3-dev \
  libevdev-dev \
  libglib2.0-dev

# Optional
sudo apt-get install -y libmanette-0.2-dev || true

# SDL3 is fetched and built automatically by CMake/CPM — no system package needed.
```

</details>

<details>
<summary><b>Fedora</b></summary>

```bash
sudo dnf install -y \
  clang cmake make pkgconf-pkg-config \
  gtk3-devel \
  libappindicator-gtk3-devel \
  libevdev-devel \
  glib2-devel

# Optional
sudo dnf install -y libmanette-devel || true

# SDL3 is fetched and built automatically by CMake/CPM — no system package needed.
```

</details>

<details>
<summary><b>Arch Linux</b></summary>

```bash
sudo pacman -S --needed \
  clang cmake make pkgconf \
  gtk3 \
  libappindicator-gtk3 \
  libevdev \
  glib2

# Optional
sudo pacman -S --needed libmanette || true

# SDL3 is fetched and built automatically by CMake/CPM — no system package needed.
```

</details>

### Configure, build, and install

```bash
# 1. Configure (default install prefix: /usr/local)
#    SDL=ON is the default — SDL3 is fetched/built automatically via CPM.
mkdir -p build
cd build
cmake .. -DCMAKE_CXX_COMPILER=clang++

# 2. Build
make -j"$(nproc)"

# 3. Install (installs binary, udev rules, systemd units, desktop file, icons, …)
sudo make install
```

The binary is installed to `/usr/local/bin/JoyShockMapper` by default, which is what the systemd unit's `ExecStart` references.

#### Installing to `/usr` instead of `/usr/local`

If you prefer a system-wide installation under `/usr` (which avoids the need for `/usr/local/lib/udev/rules.d` support on some distros), configure with:

```bash
cmake .. -DCMAKE_CXX_COMPILER=clang++ -DCMAKE_INSTALL_PREFIX=/usr
```

> **GCC note:** Due to a compiler bug referenced in the upstream documentation, this project has historically been more reliable when built with clang on Linux.

### Post-install udev reload

After the first install, reload udev rules so controller devices are accessible without root:

```bash
sudo udevadm control --reload-rules
sudo udevadm trigger
```

---

## Configuration

Configuration files follow XDG conventions. The typical location is:

```
~/.config/JoyShockMapper/
```

For the full configuration reference (bindings, gyro settings, flick stick, etc.), see the upstream documentation:  
**[Electronicks/JoyShockMapper — README](https://github.com/Electronicks/JoyShockMapper)**

---

## Credits

All credit for JoyShockMapper goes to the upstream authors and contributors.  
This repository is a downstream Linux fork focused on systemd integration and modern desktop compatibility.  
The Linux-specific changes were made largely with the assistance of AI tools.
