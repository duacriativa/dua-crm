"use client";
import { useAsaasNotifications } from "@/hooks/useAsaasNotifications";

export function AsaasNotificationsProvider() {
  useAsaasNotifications();
  return null;
}
