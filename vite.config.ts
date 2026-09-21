import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env };
  const publicKey = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  if (command === "build") {
    const url = new URL(env.VITE_SUPABASE_URL ?? "");
    if (
      url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      )
    )
      throw new Error("Public backend must use HTTPS");
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    )
      throw new Error("Invalid public backend origin");
    let role = "";
    try {
      role =
        JSON.parse(Buffer.from(publicKey.split(".")[1], "base64url").toString())
          .role ?? "";
    } catch {}
    if (publicKey.startsWith("sb_secret_") || role === "service_role")
      throw new Error("A server credential cannot be included in the frontend");
    if (!publicKey) throw new Error("Configure a public backend key");
  }
  return {
    server: {
      host: "127.0.0.1",
      port: 8080,
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
