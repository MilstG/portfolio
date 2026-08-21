import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    scrollRestoration: true,
    // Every page loads the same portfolio payload; keep it fresh for 30s so
    // tab switches are instant and preload on hover/touch.
    defaultStaleTime: 30_000,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 30_000,
  });
}
