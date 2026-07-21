import sidebarTranslationsXml from "./sidebar-translations.xml?raw";
import { createContext, useContext } from "react";

export type AppLanguage = "en" | "vi";

export type SidebarMenuKey =
  | "dashboard"
  | "controlRoom"
  | "machines"
  | "machineDetail"
  | "alerts"
  | "riskAnalytics"
  | "dataQuality"
  | "energyConsistency"
  | "maintenance"
  | "aiModelMonitor"
  | "reports"
  | "settings";

type StatusKey = "Operational" | "Degraded" | "Offline" | "Healthy" | "Delayed";

type SidebarCopy = {
  menu: Record<SidebarMenuKey, string>;
  tooltips: Record<SidebarMenuKey, string>;
  plantSystemStatus: string;
  activeMachines: string;
  dataPipeline: string;
  lastUpdated: string;
  statuses: Record<StatusKey, string>;
};

export const AppLanguageContext = createContext<AppLanguage>("en");

export function useAppLanguage() {
  return useContext(AppLanguageContext);
}

const menuKeys: SidebarMenuKey[] = [
  "dashboard", "controlRoom", "machines", "machineDetail", "alerts", "riskAnalytics",
  "dataQuality", "energyConsistency", "maintenance", "aiModelMonitor", "reports", "settings",
];
const statusKeys: StatusKey[] = ["Operational", "Degraded", "Offline", "Healthy", "Delayed"];

function text(element: Element | null, fallback = "") {
  return element?.textContent?.trim() || fallback;
}

function itemMap(root: Element, section: "menu" | "tooltips") {
  return Object.fromEntries(
    menuKeys.map((key) => [key, text(root.querySelector(`${section} > item[key="${key}"]`), key)]),
  ) as Record<SidebarMenuKey, string>;
}

function parseLanguage(document: XMLDocument, language: AppLanguage): SidebarCopy {
  const root = document.querySelector(`language[code="${language}"]`);
  if (!root) throw new Error(`Missing sidebar translation for ${language}`);

  return {
    menu: itemMap(root, "menu"),
    tooltips: itemMap(root, "tooltips"),
    plantSystemStatus: text(root.querySelector("labels > plantSystemStatus")),
    activeMachines: text(root.querySelector("labels > activeMachines")),
    dataPipeline: text(root.querySelector("labels > dataPipeline")),
    lastUpdated: text(root.querySelector("labels > lastUpdated")),
    statuses: Object.fromEntries(
      statusKeys.map((key) => [key, text(root.querySelector(`statuses > status[key="${key}"]`), key)]),
    ) as Record<StatusKey, string>,
  };
}

const xmlDocument = new DOMParser().parseFromString(sidebarTranslationsXml, "application/xml");

// Local XML keeps UI copy concise, domain-specific, and independent of machine translation.
export const sidebarCopy: Record<AppLanguage, SidebarCopy> = {
  en: parseLanguage(xmlDocument, "en"),
  vi: parseLanguage(xmlDocument, "vi"),
};

const infoTooltipCopy = new Map(
  Array.from(xmlDocument.querySelectorAll("tooltipTranslations > tooltip")).map((tooltip) => [
    text(tooltip.querySelector("source")),
    { en: text(tooltip.querySelector("en")), vi: text(tooltip.querySelector("vi")) },
  ]),
);

export function translateInfoTooltip(source: string, language: AppLanguage) {
  return infoTooltipCopy.get(source)?.[language] || source;
}
