import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import adminEn from "./locales/en/admin.json";
import automationsEn from "./locales/en/automations.json";
import bundlesEn from "./locales/en/bundles.json";
import calendarEn from "./locales/en/calendar.json";
import checklistEn from "./locales/en/checklist.json";
import clientsEn from "./locales/en/clients.json";
import commonEn from "./locales/en/common.json";
import contactsEn from "./locales/en/contacts.json";
import costsEn from "./locales/en/costs.json";
import dashboardEn from "./locales/en/dashboard.json";
import inventoryEn from "./locales/en/inventory.json";
import kanbanEn from "./locales/en/kanban.json";
import notificationsEn from "./locales/en/notifications.json";
import profileEn from "./locales/en/profile.json";
import scriptsEn from "./locales/en/scripts.json";
import ticketsEn from "./locales/en/tickets.json";
import adminIt from "./locales/it/admin.json";
import automationsIt from "./locales/it/automations.json";
import bundlesIt from "./locales/it/bundles.json";
import calendarIt from "./locales/it/calendar.json";
import checklistIt from "./locales/it/checklist.json";
import clientsIt from "./locales/it/clients.json";
import commonIt from "./locales/it/common.json";
import contactsIt from "./locales/it/contacts.json";
import costsIt from "./locales/it/costs.json";
import dashboardIt from "./locales/it/dashboard.json";
import inventoryIt from "./locales/it/inventory.json";
import kanbanIt from "./locales/it/kanban.json";
import notificationsIt from "./locales/it/notifications.json";
import profileIt from "./locales/it/profile.json";
import scriptsIt from "./locales/it/scripts.json";
import ticketsIt from "./locales/it/tickets.json";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      it: {
        common: commonIt,
        tickets: ticketsIt,
        dashboard: dashboardIt,
        inventory: inventoryIt,
        kanban: kanbanIt,
        clients: clientsIt,
        contacts: contactsIt,
        costs: costsIt,
        checklist: checklistIt,
        automations: automationsIt,
        bundles: bundlesIt,
        scripts: scriptsIt,
        notifications: notificationsIt,
        calendar: calendarIt,
        admin: adminIt,
        profile: profileIt,
      },
      en: {
        common: commonEn,
        tickets: ticketsEn,
        dashboard: dashboardEn,
        inventory: inventoryEn,
        kanban: kanbanEn,
        clients: clientsEn,
        contacts: contactsEn,
        costs: costsEn,
        checklist: checklistEn,
        automations: automationsEn,
        bundles: bundlesEn,
        scripts: scriptsEn,
        notifications: notificationsEn,
        calendar: calendarEn,
        admin: adminEn,
        profile: profileEn,
      },
    },
    fallbackLng: "it",
    supportedLngs: ["it", "en"],
    ns: [
      "common",
      "tickets",
      "dashboard",
      "inventory",
      "kanban",
      "clients",
      "contacts",
      "costs",
      "checklist",
      "automations",
      "bundles",
      "scripts",
      "notifications",
      "calendar",
      "admin",
      "profile",
    ],
    defaultNS: "common",
    interpolation: {
      escapeValue: false, // React already protects against XSS
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "i18nextLng",
    },
  });

export default i18n;
