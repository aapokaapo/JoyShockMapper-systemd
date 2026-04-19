#include "linux/LinuxNotificationManager.h"

#ifdef HAVE_LIBNOTIFY

#include <libnotify/notify.h>
#include <iostream>
#include <mutex>

namespace LinuxNotifications
{

namespace
{

// Ensure notify_init() is called exactly once across all threads.
void ensure_initialized()
{
	static std::once_flag flag;
	std::call_once(flag, []() {
		notify_init("JoyShockMapper");
	});
}

// Callback for notification dismiss action.
// Does nothing – its mere presence tells GNOME 49+ that the action was
// handled locally, which prevents the startup-notification spinner from
// appearing when the user clicks a desktop notification.
static void on_notification_action(NotifyNotification * /*notification*/,
                                   char * /*action*/,
                                   gpointer /*user_data*/)
{
	// Intentionally empty – acknowledges the action immediately.
}

} // anonymous namespace

bool sendNotification(
  const std::string &summary,
  const std::string &body,
  Urgency urgency,
  int expireTimeoutMs)
{
	ensure_initialized();

	NotifyNotification *notification = notify_notification_new(
	  summary.c_str(),
	  body.empty() ? nullptr : body.c_str(),
	  "jsm-status-dark");

	if (!notification)
	{
		std::cerr << "[Notifications] Failed to create notification\n";
		return false;
	}

	notify_notification_set_urgency(notification, static_cast<NotifyUrgency>(urgency));
	notify_notification_set_timeout(notification, expireTimeoutMs);

	// Add a "default" action with an explicit (empty) callback.
	// Without this, GNOME 49+ shows a startup-notification spinner while
	// waiting for an action acknowledgement after the user clicks.
	notify_notification_add_action(
	  notification,
	  "default",
	  "Dismiss",
	  on_notification_action,
	  nullptr,  // user data
	  nullptr); // free function

	GError *error = nullptr;
	bool ok = notify_notification_show(notification, &error);
	if (!ok && error)
	{
		std::cerr << "[Notifications] Failed to show notification: " << error->message << '\n';
		g_error_free(error);
	}

	g_object_unref(notification);
	return ok;
}

} // namespace LinuxNotifications

#endif // HAVE_LIBNOTIFY
