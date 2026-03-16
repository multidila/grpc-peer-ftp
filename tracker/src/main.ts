import * as grpc from "@grpc/grpc-js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { trackerProto } from "protocol";
import { TrackerService } from "./tracker-service";

const argv = yargs(hideBin(process.argv))
  .usage("Usage: $0 [options]")
  .option("port", {
    alias: "p",
    description: "Port to listen on",
    type: "number",
    default: Number(process.env.PORT) || 50050,
  })
  .option("heartbeat-timeout", {
    description: "Heartbeat timeout in milliseconds",
    type: "number",
    default: Number(process.env.HEARTBEAT_TIMEOUT_MS) || 15000,
  })
  .help()
  .alias("help", "h")
  .parseSync();

const PORT: number = argv.port;
const HEARTBEAT_TIMEOUT: number = argv.heartbeatTimeout;

function main(): void {
  const service = new TrackerService(HEARTBEAT_TIMEOUT);
  const server = new grpc.Server();
  server.addService(trackerProto.TrackerService.service, service.handlers);

  const address = `0.0.0.0:${PORT}`;
  server.bindAsync(address, grpc.ServerCredentials.createInsecure(), (err: Error | null) => {
    if (err) {
      console.error("Failed to start tracker:", err);
      process.exit(1);
    }
    console.log(`Tracker server listening on ${address}`);
    console.log(`Heartbeat timeout: ${HEARTBEAT_TIMEOUT}ms`);
  });

  const shutdown = (): void => {
    console.log("\nShutting down tracker...");
    service.shutdown();
    server.tryShutdown((err) => {
      if (err) {
        console.error("Forced shutdown:", err);
        process.exit(1);
      }
      console.log("Tracker stopped.");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
