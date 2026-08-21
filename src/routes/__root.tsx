import {
  createRootRoute,
  HeadContent,
  Outlet,
  redirect,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "sonner";
import { HintsProvider } from "@/components/ui/hints";
import { Shell } from "@/components/shell";
import { TipProvider } from "@/components/ui/tip";
import { getAuthState } from "@/lib/server/auth";
import appCss from "../styles.css?url";

const APP_NAME = "Patrimonio";
const LOGIN_PATH = "/login";

export const Route = createRootRoute({
  // Gate every page server-side: with the PIN lock on and no session cookie,
  // nothing below the root renders (and no loader runs) until /login succeeds.
  beforeLoad: async ({ location }) => {
    const auth = await getAuthState();
    const onLogin = location.pathname === LOGIN_PATH;
    if (!auth.authenticated && !onLogin) throw redirect({ to: LOGIN_PATH });
    if (auth.authenticated && onLogin) throw redirect({ to: "/" });
    return { auth };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: APP_NAME },
      {
        name: "description",
        content:
          "Tracker de patrimonio: crypto, acciones, bonos, real estate y cash.",
      },
      { name: "theme-color", content: "#000000" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black" },
      { name: "apple-mobile-web-app-title", content: APP_NAME },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  const { auth } = Route.useRouteContext();
  return (
    <html lang="es" className="antialiased">
      <head>
        <HeadContent />
      </head>
      <body className="bg-bg text-fg">
        <HintsProvider>
        <TipProvider>
          {auth.authenticated ? (
            <Shell pinEnabled={auth.pinEnabled}>
              <Outlet />
            </Shell>
          ) : (
            <Outlet />
          )}
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              unstyled: true,
              classNames: {
                toast:
                  "flex w-full items-center gap-2 border border-accent bg-black px-3 py-2 font-mono text-xs text-fg",
                error: "border-loss",
                success: "border-gain",
              },
            }}
          />
        </TipProvider>
        </HintsProvider>
        <Scripts />
      </body>
    </html>
  );
}
