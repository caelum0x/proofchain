/**
 * Layout shells (WD §2). Pages compose one of these frames:
 *   import { AppShell, DetailShell } from "@/components/shells";
 *
 * `AppShell` wraps every authenticated route (applied in app/layout.tsx via
 * AppFrame); `MarketingShell` wraps landing/docs/onboarding; `DetailShell`
 * is used inside a page for `[id]` detail views.
 */
export { AppShell, type AppShellProps } from "./AppShell";
export { AppFrame } from "./AppFrame";
export { MarketingShell, type MarketingShellProps } from "./MarketingShell";
export { DetailShell, type DetailShellProps } from "./DetailShell";
export { Sidebar } from "./Sidebar";
export { TopBar } from "./TopBar";
export { GlobalSearch } from "./GlobalSearch";
