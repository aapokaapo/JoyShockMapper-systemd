# JoyShockMapper Socket UI

This folder is a self-contained UI project for talking to the running `joyshockmapper.socket` service over the per-user UNIX socket.

## Features

- controller SVG with clickable JoyShockMapper button IDs
- per-button mapping composer that sends `BUTTON = ASSIGNMENT` commands
- gyro sensitivity editor that sends `GYRO_SENS = X Y`
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

- the Socket path field in the UI, or
- `JSM_SOCKET_PATH=/custom/path node server.js`

The UI sends plain text JoyShockMapper commands, one per line, through a small local HTTP bridge because browsers cannot connect directly to UNIX domain sockets.

## Example commands

```text
E = LMOUSE
GYRO_SENS = 2 2
STICK_ACCELERATION_RATE = 1
STICK_ACCELERATION_CAP = 2
```
