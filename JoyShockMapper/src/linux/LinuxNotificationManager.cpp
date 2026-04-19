#include "linux/LinuxNotificationManager.h"
#include "InputHelpers.h"

#include <gio/gio.h>
#include <iostream>
#include <map>
#include <mutex>
#include <string>
#include <thread>

namespace LinuxNotifications
{

// Maps notification ID → (action_key → JSM command).
// Populated by sendNotification() when actions are provided; entries are
// removed when the notification daemon reports the notification is closed.
static std::mutex g_actionsMutex;
static std::map<guint32, std::map<std::string, std::string>> g_pendingActions;

// ---------------------------------------------------------------------------
// D-Bus signal callbacks (run on the action-listener GLib main loop thread)
// ---------------------------------------------------------------------------

static void onActionInvoked(GDBusConnection * /*conn*/,
  const gchar * /*sender*/,
  const gchar * /*object_path*/,
  const gchar * /*interface_name*/,
  const gchar * /*signal_name*/,
  GVariant *parameters,
  gpointer /*user_data*/)
{
	guint32 notifId = 0;
	const gchar *actionKey = nullptr;
	g_variant_get(parameters, "(u&s)", &notifId, &actionKey);
	if (!actionKey)
		return;

	std::lock_guard<std::mutex> lock(g_actionsMutex);
	const auto it = g_pendingActions.find(notifId);
	if (it != g_pendingActions.end())
	{
		const auto actionIt = it->second.find(actionKey);
		if (actionIt != it->second.end() && !actionIt->second.empty())
		{
			// Route through the existing command queue; WriteToConsole is thread-safe.
			WriteToConsole(actionIt->second);
		}
	}
}

static void onNotificationClosed(GDBusConnection * /*conn*/,
  const gchar * /*sender*/,
  const gchar * /*object_path*/,
  const gchar * /*interface_name*/,
  const gchar * /*signal_name*/,
  GVariant *parameters,
  gpointer /*user_data*/)
{
	guint32 notifId = 0;
	guint32 reason = 0;
	g_variant_get(parameters, "(uu)", &notifId, &reason);

	std::lock_guard<std::mutex> lock(g_actionsMutex);
	g_pendingActions.erase(notifId);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

void initNotificationActionListener()
{
	std::thread([]()
	{
		// Use a private GLib main context so this thread does not interfere
		// with the GTK main loop running in the StatusNotifierItem thread.
		GMainContext *ctx = g_main_context_new();
		g_main_context_push_thread_default(ctx);

		GError *error = nullptr;
		GDBusConnection *conn = g_bus_get_sync(G_BUS_TYPE_SESSION, nullptr, &error);
		if (!conn)
		{
			if (error)
			{
				std::cerr << "[Notifications] Action listener cannot connect to session bus: "
				          << error->message << '\n';
				g_error_free(error);
			}
			g_main_context_pop_thread_default(ctx);
			g_main_context_unref(ctx);
			return;
		}

		g_dbus_connection_signal_subscribe(
		  conn,
		  "org.freedesktop.Notifications",
		  "org.freedesktop.Notifications",
		  "ActionInvoked",
		  "/org/freedesktop/Notifications",
		  nullptr,
		  G_DBUS_SIGNAL_FLAGS_NONE,
		  &onActionInvoked,
		  nullptr,
		  nullptr);

		g_dbus_connection_signal_subscribe(
		  conn,
		  "org.freedesktop.Notifications",
		  "org.freedesktop.Notifications",
		  "NotificationClosed",
		  "/org/freedesktop/Notifications",
		  nullptr,
		  G_DBUS_SIGNAL_FLAGS_NONE,
		  &onNotificationClosed,
		  nullptr,
		  nullptr);

		GMainLoop *loop = g_main_loop_new(ctx, FALSE);
		g_main_loop_run(loop); // blocks until g_main_loop_quit() is called

		g_main_loop_unref(loop);
		g_object_unref(conn);
		g_main_context_pop_thread_default(ctx);
		g_main_context_unref(ctx);
	}).detach();
}

bool sendNotification(
  const std::string &summary,
  const std::string &body,
  Urgency urgency,
  int expireTimeoutMs,
  const std::vector<NotificationAction> &actions)
{
	GError *error = nullptr;

	GDBusConnection *conn = g_bus_get_sync(G_BUS_TYPE_SESSION, nullptr, &error);
	if (!conn)
	{
		if (error)
		{
			std::cerr << "[Notifications] Cannot connect to session bus: " << error->message << '\n';
			g_error_free(error);
		}
		return false;
	}

	// Build the hints dictionary containing urgency level
	GVariantBuilder hintsBuilder;
	g_variant_builder_init(&hintsBuilder, G_VARIANT_TYPE("a{sv}"));
	g_variant_builder_add(&hintsBuilder, "{sv}", "urgency",
	  g_variant_new_byte(static_cast<guint8>(urgency)));

	// Build actions array: alternating (action_key, label) pairs as required by
	// the org.freedesktop.Notifications spec.
	GVariantBuilder actionsBuilder;
	g_variant_builder_init(&actionsBuilder, G_VARIANT_TYPE("as"));
	for (const auto &action : actions)
	{
		g_variant_builder_add(&actionsBuilder, "s", action.actionKey.c_str());
		g_variant_builder_add(&actionsBuilder, "s", action.label.c_str());
	}

	// org.freedesktop.Notifications.Notify signature:
	// (STRING app_name, UINT32 replaces_id, STRING app_icon,
	//  STRING summary, STRING body, ARRAY actions, DICT hints, INT32 expire_timeout)
	GVariant *params = g_variant_new(
	  "(susssasa{sv}i)",
	  "JoyShockMapper",        // app_name
	  static_cast<guint32>(0), // replaces_id (0 = new notification)
	  "jsm-status-dark",       // app_icon
	  summary.c_str(),         // summary
	  body.c_str(),            // body
	  &actionsBuilder,         // actions
	  &hintsBuilder,           // hints
	  expireTimeoutMs);        // expire_timeout (-1 = server default)

	GVariant *result = g_dbus_connection_call_sync(
	  conn,
	  "org.freedesktop.Notifications",
	  "/org/freedesktop/Notifications",
	  "org.freedesktop.Notifications",
	  "Notify",
	  params,
	  G_VARIANT_TYPE("(u)"),
	  G_DBUS_CALL_FLAGS_NONE,
	  -1,
	  nullptr,
	  &error);

	g_object_unref(conn);

	if (!result)
	{
		if (error)
		{
			std::cerr << "[Notifications] D-Bus Notify failed: " << error->message << '\n';
			g_error_free(error);
		}
		return false;
	}

	// Store action mappings keyed by the notification ID returned by the daemon
	// so that onActionInvoked() can route button clicks to the correct command.
	if (!actions.empty())
	{
		guint32 notifId = 0;
		g_variant_get(result, "(u)", &notifId);

		std::lock_guard<std::mutex> lock(g_actionsMutex);
		auto &actionMap = g_pendingActions[notifId];
		for (const auto &action : actions)
		{
			actionMap[action.actionKey] = action.command;
		}
	}

	g_variant_unref(result);
	return true;
}

} // namespace LinuxNotifications
