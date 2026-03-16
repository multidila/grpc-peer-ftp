import * as grpc from "@grpc/grpc-js";
import * as path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { fileServiceProto, createTrackerClient, FileMetadata, getErrorMessage } from "protocol";
import { FileProvider } from "./file-provider";
import { FileScanner } from "./file-scanner";
import { TrackerRegistration } from "./tracker-registration";

const argv = yargs(hideBin(process.argv))
  .usage("Usage: $0 [options]")
  .option("peer-id", {
    description: "Unique peer identifier",
    type: "string",
    default: process.env.PEER_ID || `peer-${process.pid}`,
  })
  .option("port", {
    alias: "p",
    description: "Port for the file server gRPC",
    type: "number",
    default: Number(process.env.PEER_PORT) || 50101,
  })
  .option("host", {
    description: "Hostname to advertise to other peers",
    type: "string",
    default: process.env.PEER_HOST || "localhost",
  })
  .option("tracker", {
    alias: "t",
    description: "Tracker server address (host:port)",
    type: "string",
    default: process.env.TRACKER_ADDR || "localhost:50050",
  })
  .option("shared-dir", {
    alias: "s",
    description: "Directory with files to share",
    type: "string",
    default: process.env.SHARED_DIR || path.join(__dirname, "..", "shared"),
  })
  .option("chunk-size", {
    alias: "c",
    description: "Chunk size in KB",
    type: "number",
    default: Number(process.env.CHUNK_SIZE_KB) || 64,
  })
  .option("heartbeat-interval", {
    description: "Heartbeat interval in milliseconds",
    type: "number",
    default: Number(process.env.HEARTBEAT_INTERVAL_MS) || 5000,
  })
  .help()
  .alias("help", "h")
  .parseSync();

const PEER_ID: string = argv.peerId;
const PORT: number = argv.port;
const HOST: string = argv.host;
const TRACKER_ADDR: string = argv.tracker;
const SHARED_DIR: string = path.resolve(argv.sharedDir);
const CHUNK_SIZE: number = argv.chunkSize * 1024;
const HEARTBEAT_INTERVAL: number = argv.heartbeatInterval;

let localFiles: FileMetadata[] = [];

async function main(): Promise<void> {
  console.log(`Starting file server: ${PEER_ID}`);
  console.log(`Shared dir: ${SHARED_DIR}`);
  console.log(`Tracker: ${TRACKER_ADDR}`);

  // 1. Scan local files
  const scanner = new FileScanner(SHARED_DIR, CHUNK_SIZE);
  localFiles = await scanner.scan();

  // 2. Start gRPC server
  const server = new grpc.Server();
  const provider = new FileProvider(SHARED_DIR, () => localFiles);
  server.addService(fileServiceProto.FileService.service, provider.handlers);

  const address = `0.0.0.0:${PORT}`;
  await new Promise<void>((resolve, reject) => {
    server.bindAsync(address, grpc.ServerCredentials.createInsecure(), (err: Error | null) => {
      if (err) {
        return reject(err);
      }
      console.log(`File server gRPC listening on ${address}`);
      resolve();
    });
  });

  // 3. Register with the tracker
  const trackerClient = createTrackerClient(TRACKER_ADDR);
  const registration = new TrackerRegistration(trackerClient, PEER_ID);
  try {
    await registration.register(HOST, PORT);
    console.log(`Registered with tracker as ${PEER_ID} (${HOST}:${PORT})`);
  } catch (err) {
    console.error("Failed to register with tracker:", getErrorMessage(err));
    console.error("Continuing without tracker — discovery may not work.");
  }

  // 4. Start heartbeat loop
  registration.startHeartbeat(HEARTBEAT_INTERVAL);

  // 5. Graceful shutdown
  const shutdown = async (): Promise<void> => {
    console.log("\nShutting down file server...");
    registration.stopHeartbeat();
    try {
      await registration.unregister();
      console.log("Unregistered from tracker.");
    } catch {
      // tracker might be down
    }
    trackerClient.close();
    server.tryShutdown((err) => {
      if (err) {
        console.error("Server shutdown error:", err);
      }
      console.log("File server stopped.");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log("File server is running. Press Ctrl+C to stop.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
