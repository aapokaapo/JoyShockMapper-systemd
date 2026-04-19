#pragma once

#ifdef __linux__

#include <string>

namespace LinuxNotifications
{

enum class Urgency
{
	Low = 0,
	Normal = 1,
	Critical = 2,
};

// Default notification timeout in milliseconds.
static constexpr int kDefaultExpireMs = 7000;

#ifdef HAVE_LIBNOTIFY
// Send a desktop notification via libnotify.
// Returns true on success, false if libnotify is unavailable or an error
// occurs (failure is non-fatal; the caller should not abort on false).
// A "default" action is included with an explicit (empty) callback so that
// GNOME 49+ dismisses the notification on click without showing a
// startup-notification spinner.
bool sendNotification(
  const std::string &summary,
  const std::string &body = "",
  Urgency urgency = Urgency::Normal,
  int expireTimeoutMs = kDefaultExpireMs);
#else
// libnotify unavailable at build time – notifications silently disabled.
inline bool sendNotification(
  const std::string & /*summary*/,
  const std::string & /*body*/ = "",
  Urgency /*urgency*/ = Urgency::Normal,
  int /*expireTimeoutMs*/ = kDefaultExpireMs)
{
	return false;
}
#endif // HAVE_LIBNOTIFY

} // namespace LinuxNotifications

#endif // __linux__
