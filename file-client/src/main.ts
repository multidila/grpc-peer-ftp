import * as path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { createTrackerClient } from "protocol";
import { DiscoveryService } from "./discovery-service";
import { DownloadManager } from "./download-manager";
import { runCli } from "./cli";

const argv = yargs(hideBin(process.argv))
  .usage("Usage: $0 [options]")
  .option("tracker", {
    alias: "t",
    description: "Tracker server address (host:port)",
    type: "string",
    default: process.env.TRACKER_ADDR || "localhost:50050",
  })
  .option("download-dir", {
    alias: "d",
    description: "Directory to save downloaded files",
    type: "string",
    default: process.env.DOWNLOAD_DIR || path.join(__dirname, "..", "downloads"),
  })
  .help()
  .alias("help", "h")
  .parseSync();

const TRACKER_ADDR: string = argv.tracker;
const DOWNLOAD_DIR: string = path.resolve(argv.downloadDir);

async function main(): Promise<void> {
  console.log(`Tracker: ${TRACKER_ADDR}`);
  console.log(`Download dir: ${DOWNLOAD_DIR}`);

  const trackerClient = createTrackerClient(TRACKER_ADDR);
  const discoveryService = new DiscoveryService(trackerClient);
  const downloadManager = new DownloadManager(DOWNLOAD_DIR, discoveryService);

  const shutdown = (): void => {
    trackerClient.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await runCli(discoveryService, downloadManager);

  trackerClient.close();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
