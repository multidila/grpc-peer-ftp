import inquirer from "inquirer";
import prettyBytes from "pretty-bytes";
import Table from "cli-table3";
import { PeerInfo, getErrorMessage } from "protocol";
import { DiscoveredFile } from "./types";
import { DiscoveryService } from "./discovery-service";
import { DownloadManager } from "./download-manager";

export async function runCli(
  discoveryService: DiscoveryService,
  downloadManager: DownloadManager
): Promise<void> {
  console.log("\n=== Decentralized File Sharing ===\n");

  let running = true;
  while (running) {
    let action: string;
    try {
      const answer = await inquirer.prompt<{ action: string }>([
        {
          type: "list",
          name: "action",
          message: "What would you like to do?",
          choices: [
            { name: "Discover files on the network", value: "discover" },
            { name: "Show active peers", value: "peers" },
            new inquirer.Separator(),
            { name: "Quit", value: "quit" },
          ],
        },
      ]);
      action = answer.action;
    } catch (err) {
      if (err instanceof Error && err.message.includes("force closed")) {
        break;
      }
      console.error("Prompt error:", getErrorMessage(err));
      break;
    }

    if (action === "quit") {
      running = false;
      continue;
    }

    if (action === "peers") {
      await showPeers(discoveryService);
      continue;
    }

    if (action === "discover") {
      await discoverAndDownload(discoveryService, downloadManager);
    }
  }
}

async function showPeers(discoveryService: DiscoveryService): Promise<void> {
  try {
    const peers = await discoveryService.getPeers();
    if (peers.length === 0) {
      console.log("\nNo active peers.\n");
      return;
    }
    const table = new Table({ head: ["Peer ID", "Host", "Port"] });
    for (const p of peers) {
      table.push([p.peer_id, p.host, String(p.port)]);
    }
    console.log(`\nActive peers (${peers.length}):`);
    console.log(table.toString());
    console.log("");
  } catch (err) {
    console.error("Failed to query tracker:", getErrorMessage(err));
  }
}

async function discoverAndDownload(
  discoveryService: DiscoveryService,
  downloadManager: DownloadManager
): Promise<void> {
  const peers = await fetchPeers(discoveryService);
  if (!peers) {
    return;
  }

  const files = await fetchFiles(discoveryService, peers);
  if (!files) {
    return;
  }

  displayFileTable(files);

  const file = await selectFile(files);
  if (!file) {
    return;
  }

  const source = await selectSource(file);
  if (!source) {
    return;
  }

  console.log(`\nDownloading "${file.file_name}" from ${source.peer_id}...`);

  const result = await downloadManager.download(file, source);
  if (!result.success) {
    console.error(`\n  Download failed: ${result.error}`);
  }
  console.log("");
}

async function fetchPeers(discoveryService: DiscoveryService): Promise<PeerInfo[] | null> {
  console.log("\nQuerying tracker for active peers...");
  try {
    const peers = await discoveryService.getPeers();
    if (peers.length === 0) {
      console.log("No peers available.\n");
      return null;
    }
    console.log(`Found ${peers.length} peer(s). Querying for files...`);
    return peers;
  } catch (err) {
    console.error("Failed to query tracker:", getErrorMessage(err));
    return null;
  }
}

async function fetchFiles(discoveryService: DiscoveryService, peers: PeerInfo[]): Promise<DiscoveredFile[] | null> {
  try {
    const files = await discoveryService.discoverFiles(peers);
    if (files.length === 0) {
      console.log("No files found on the network.\n");
      return null;
    }
    return files;
  } catch (err) {
    console.error("Discovery failed:", getErrorMessage(err));
    return null;
  }
}

function displayFileTable(files: DiscoveredFile[]): void {
  const table = new Table({
    head: ["#", "Name", "Size", "Sources", "Chunks", "Hash (short)"],
    colWidths: [5, 30, 12, 9, 9, 20],
  });

  files.forEach((f, i) => {
    table.push([
      i + 1,
      f.file_name.length > 26 ? f.file_name.substring(0, 23) + "..." : f.file_name,
      prettyBytes(f.file_size),
      String(f.sources.length),
      String(f.chunk_count),
      f.file_hash.substring(0, 16) + "...",
    ]);
  });

  console.log(`\nDiscovered ${files.length} file(s):`);
  console.log(table.toString());
}

async function selectFile(files: DiscoveredFile[]): Promise<DiscoveredFile | null> {
  try {
    const answer = await inquirer.prompt<{ choice: string }>([
      {
        type: "list",
        name: "choice",
        message: "Select a file to download:",
        choices: [
          ...files.map((f, i) => ({
            name: `${f.file_name} (${prettyBytes(f.file_size)}) [${f.sources.length} source(s)]`,
            value: String(i),
          })),
          new inquirer.Separator(),
          { name: "Back", value: "back" },
        ],
      },
    ]);
    if (answer.choice === "back") {
      return null;
    }
    return files[parseInt(answer.choice, 10)];
  } catch (err) {
    if (!(err instanceof Error && err.message.includes("force closed"))) {
      console.error("Prompt error:", getErrorMessage(err));
    }
    return null;
  }
}

async function selectSource(file: DiscoveredFile): Promise<PeerInfo | null> {
  if (file.sources.length === 1) {
    return file.sources[0];
  }

  try {
    const answer = await inquirer.prompt<{ source: string }>([
      {
        type: "list",
        name: "source",
        message: "Select source peer:",
        choices: [
          ...file.sources.map((s, i) => ({
            name: `${s.peer_id} (${s.host}:${s.port})`,
            value: String(i),
          })),
          new inquirer.Separator(),
          { name: "Back", value: "back" },
        ],
      },
    ]);
    if (answer.source === "back") {
      return null;
    }
    return file.sources[parseInt(answer.source, 10)];
  } catch (err) {
    if (!(err instanceof Error && err.message.includes("force closed"))) {
      console.error("Prompt error:", getErrorMessage(err));
    }
    return null;
  }
}
