import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import { syncBuiltinESMExports } from "node:module";

// CI checks compile and test with fixtures. A real request must fail even if
// application fallback code would catch a network error and render empty data.
function rejectNetwork() {
  process.stderr.write(new Error("[ci] Unexpected network request during isolated application checks. Use an explicit test mock.").stack + "\n");
  process.exit(1);
}

globalThis.fetch = rejectNetwork;
http.request = rejectNetwork;
http.get = rejectNetwork;
https.request = rejectNetwork;
https.get = rejectNetwork;
const originalSocketConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const options = Array.isArray(args[0]) ? args[0][0] : args[0];
  const isIpcPath = (typeof options === "string" && Number.isNaN(Number(options))) ||
    (options !== null && typeof options === "object" && typeof options.path === "string");
  if (isIpcPath) return originalSocketConnect.apply(this, args);
  return rejectNetwork();
};
tls.connect = rejectNetwork;
syncBuiltinESMExports();
