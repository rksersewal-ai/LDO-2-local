import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

// ─────────────────────────────────────────────────────────────────────────────
// Optional Mock API Plugin
// Only enabled when VITE_ENABLE_DEV_MOCK_API=true.
// The real EDMS runtime should use the backend API proxy instead.
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_USERS: Record<string, { password: string; user: object }> = {
  admin: {
    password: "admin123",
    user: {
      id: "user-admin-001",
      username: "admin",
      name: "System Administrator",
      designation: "Administrator",
      role: "admin",
      department: "IT",
      email: "admin@ldo2.local",
    },
  },
  "a.kowalski": {
    password: "ldo2pass",
    user: {
      id: "user-ak-001",
      username: "a.kowalski",
      name: "Adam Kowalski",
      designation: "Senior Engineer",
      role: "engineer",
      department: "Engineering",
      email: "a.kowalski@ldo2.local",
    },
  },
  "m.chen": {
    password: "ldo2pass",
    user: {
      id: "user-mc-001",
      username: "m.chen",
      name: "Ming Chen",
      designation: "Supervisor",
      role: "supervisor",
      department: "Operations",
      email: "m.chen@ldo2.local",
    },
  },
  "s.patel": {
    password: "ldo2pass",
    user: {
      id: "user-sp-001",
      username: "s.patel",
      name: "Sandeep Patel",
      designation: "Reviewer",
      role: "reviewer",
      department: "Quality",
      email: "s.patel@ldo2.local",
    },
  },
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", () => resolve("{}"));
  });
}

function jsonResponse(res: ServerResponse, status: number, data: object) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(JSON.stringify(data));
}

function createMockApiMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const rawUrl = req.url ?? "";
    // Strip query string for route matching
    const url = rawUrl.split("?")[0];

    // Only handle /api/ routes
    if (!url.startsWith("/api/")) {
      return next();
    }

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      });
      return res.end();
    }

    // POST /api/auth/login/
    if (url === "/api/auth/login/" && req.method === "POST") {
      const body = await readBody(req);
      let creds: { username?: string; password?: string } = {};
      try {
        creds = JSON.parse(body);
      } catch {
        return jsonResponse(res, 400, { detail: "Invalid JSON" });
      }

      const { username = "", password = "" } = creds;
      const record = MOCK_USERS[username];

      if (!record || record.password !== password) {
        return jsonResponse(res, 401, {
          detail: "Invalid credentials. Please verify your username and password.",
        });
      }

      return jsonResponse(res, 200, {
        access: `mock_access_${username}_${Date.now()}`,
        refresh: `mock_refresh_${username}_${Date.now()}`,
        user: record.user,
      });
    }

    // POST /api/auth/logout/
    if (url === "/api/auth/logout/" && req.method === "POST") {
      return jsonResponse(res, 200, {
        message: "Logged out successfully",
      });
    }

    // POST /api/auth/token/refresh/
    if (url === "/api/auth/token/refresh/" && req.method === "POST") {
      const body = await readBody(req);
      let payload: { refresh?: string } = {};
      try {
        payload = JSON.parse(body);
      } catch {
        return jsonResponse(res, 400, { detail: "Invalid JSON" });
      }

      const refresh = payload.refresh ?? "";
      const usernameMatch = refresh.match(/^mock_refresh_(.+?)_\d+$/);
      const username = usernameMatch?.[1] ?? "";
      const record = MOCK_USERS[username];

      if (!record) {
        return jsonResponse(res, 401, {
          detail: "Invalid refresh token",
        });
      }

      return jsonResponse(res, 200, {
        access: `mock_access_${username}_${Date.now()}`,
        refresh,
      });
    }

    // GET /api/auth/me/
    if (url === "/api/auth/me/" && req.method === "GET") {
      const authHeader = req.headers.authorization ?? "";
      const token = authHeader.replace(/^bearer\s+/i, "");
      const usernameMatch = token.match(/^mock_access_(.+?)_\d+$/);
      const username = usernameMatch?.[1] ?? "";
      const record = MOCK_USERS[username];

      if (!record) {
        return jsonResponse(res, 401, { detail: "Invalid token" });
      }

      return jsonResponse(res, 200, { user: record.user });
    }

    // Default: 404 for unknown /api/ routes
    return jsonResponse(res, 404, {
      detail: `API endpoint not found: ${req.method} ${url}`,
    });
  };
}

function mockApiPlugin(): Plugin {
  const middleware = createMockApiMiddleware();

  return {
    name: "mock-api",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  } as Plugin;
}

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, "");
  const rawPort = env.PORT ?? env.VITE_PORT ?? "4173";
  const port = Number(rawPort);
  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  const basePath = env.BASE_PATH ?? "/";
  const apiProxyTarget = env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:8420";
  const enableMockApi = env.VITE_ENABLE_DEV_MOCK_API === "true";
  const apiProxy = enableMockApi
    ? undefined
    : {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
      };

  return {
    base: basePath,
    plugins: [
      ...(enableMockApi ? [mockApiPlugin()] : []),
      react(),
      tailwindcss(),
      runtimeErrorOverlay(),
      ...(process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined
        ? [
            await import("@replit/vite-plugin-cartographer").then((m) =>
              m.cartographer({
                root: path.resolve(import.meta.dirname, ".."),
              }),
            ),
            await import("@replit/vite-plugin-dev-banner").then((m) => m.devBanner()),
          ]
        : []),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            "react-vendor": ["react", "react-dom", "react-router"],
            "radix-vendor": [
              "@radix-ui/react-dialog",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-popover",
              "@radix-ui/react-select",
              "@radix-ui/react-tabs",
              "@radix-ui/react-tooltip",
              "@radix-ui/react-scroll-area",
              "@radix-ui/react-checkbox",
              "@radix-ui/react-switch",
              "@radix-ui/react-accordion",
              "@radix-ui/react-collapsible",
            ],
            motion: ["framer-motion"],
            charts: ["recharts"],
          },
        },
      },
    },
    server: {
      port,
      strictPort: true,
      host: "0.0.0.0",
      allowedHosts: true,
      proxy: apiProxy,
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
    preview: {
      port,
      strictPort: true,
      host: "0.0.0.0",
      allowedHosts: true,
      proxy: apiProxy,
    },
  };
});
