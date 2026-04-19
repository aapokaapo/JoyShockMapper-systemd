#include "linux/LinuxNotificationManager.h"

#ifdef HAVE_GIO_NOTIFICATIONS

#include <gio/gio.h>
#include <iostream>

namespace LinuxNotifications
{

bool sendNotification(
  const std::string &summary,
  const std::string &body,
  Urgency urgency,
  int expireTimeoutMs)
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

	// Actions array with a "default" action to prevent GNOME from launching the app on click.
	// When the actions list is empty, GNOME 49+ treats a notification click as a request to
	// activate the application's default action (i.e. launch it).  Adding a "default" action
	// tells the notification server what to do on click (dismiss) without executing any code.
	// Actions are specified as alternating (action-id, label) string pairs per the spec.
	GVariantBuilder actionsBuilder;
	g_variant_builder_init(&actionsBuilder, G_VARIANT_TYPE("as"));
	g_variant_builder_add(&actionsBuilder, "s", "default"); // action ID recognised by GNOME
	g_variant_builder_add(&actionsBuilder, "s", "Dismiss"); // human-readable label (display is server-dependent)

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

	g_variant_unref(result);
	return true;
}

} // namespace LinuxNotifications

#endif // HAVE_GIO_NOTIFICATIONS
