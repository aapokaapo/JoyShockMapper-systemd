# JoyShockMapper Socket UI

This folder is a self-contained UI project for talking to the running `joyshockmapper.socket` service over the per-user UNIX socket.

## Features

- controller SVG with clickable JoyShockMapper button IDs
- per-button mapping composer that sends `BUTTON = ASSIGNMENT` commands
- gyro sensitivity editor that sends `GYRO_SENS = X Y`
- gyro acceleration curve editor for `MIN_GYRO_SENS`, `MAX_GYRO_SENS`, `MIN_GYRO_THRESHOLD`, and `MAX_GYRO_THRESHOLD`
- stick acceleration controls with a live SVG preview for `STICK_ACCELERATION_RATE` and `STICK_ACCELERATION_CAP`
- raw command panel for sending any newline-delimited JoyShockMapper commands

## Run

```bash
cd joyshockmapper-ui
node server.js
```

Then open <http://127.0.0.1:3210>.

## Socket details

By default the server targets:

```text
/run/user/<uid>/joyshockmapper.sock
```

You can override that with either:

- `JSM_SOCKET_PATH=/custom/path node server.js`, or
- `JSM_SOCKET_ALLOWLIST="/run/user/1000/joyshockmapper.sock;/some/other/jsm.sock" node server.js` if you want the UI field to be allowed to switch between multiple server-approved socket paths

The UI sends plain text JoyShockMapper commands, one per line, through a small local HTTP bridge because browsers cannot connect directly to UNIX domain sockets.

## Example commands

```text
E = LMOUSE
GYRO_SENS = 2 2
MIN_GYRO_SENS = 1
MAX_GYRO_SENS = 4
MIN_GYRO_THRESHOLD = 0
MAX_GYRO_THRESHOLD = 75
STICK_ACCELERATION_RATE = 1
STICK_ACCELERATION_CAP = 2
```
