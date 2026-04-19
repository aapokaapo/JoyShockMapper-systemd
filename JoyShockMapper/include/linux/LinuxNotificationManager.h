#pragma once

#ifdef __linux__

#include <string>
#include <vector>

namespace LinuxNotifications
{

enum class Urgency
{
	Low = 0,
	Normal = 1,
	Critical = 2,
};

// An action button shown in a desktop notification.
// When the user clicks the button, the notification daemon emits an
// ActionInvoked D-Bus signal; JSM's action listener thread intercepts it
// and pushes "command" into the command queue (via WriteToConsole).
struct NotificationAction
{
	std::string actionKey; // Unique opaque key sent back by the notification daemon
	std::string label;     // Human-readable text shown on the button
	std::string command;   // JSM command executed when the button is clicked
};

// Send a desktop notification via the org.freedesktop.Notifications D-Bus interface.
// Returns true on success, false if the notification service is unavailable or an
// error occurs (failure is non-fatal; the caller should not abort on false).
// If "actions" is non-empty the notification will show action buttons; clicking one
// routes the associated command through the command queue (requires
// initNotificationActionListener() to have been called first).
bool sendNotification(
  const std::string &summary,
  const std::string &body = "",
  Urgency urgency = Urgency::Normal,
  int expireTimeoutMs = 7000,
  const std::vector<NotificationAction> &actions = {});

// Start a background thread that subscribes to the D-Bus ActionInvoked and
// NotificationClosed signals and routes action commands through the JSM command
// queue.  Call once during JSM initialisation, before sending any notifications
// that carry action buttons.
void initNotificationActionListener();

} // namespace LinuxNotifications

#endif // __linux__
