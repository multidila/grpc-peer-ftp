# Decentralized File Sharing over gRPC

A decentralized file-sharing system built with gRPC and TypeScript. File servers register with a tracker (tracks active nodes only). The client discovers files by querying servers directly and downloads data chunk-by-chunk with SHA-256 integrity verification.

## How It Works

1. **Tracker** stores only which file servers are online (ID, host, port). It has no knowledge of files, hashes, or content.
2. **File Server** scans its local directory at startup and computes SHA-256 hashes for every file and every chunk.
3. **File Client** queries the tracker for the list of active servers, then contacts each server directly and aggregates results.
4. The user selects a file and a source server.
5. Download proceeds chunk-by-chunk directly from the chosen server. Each chunk is verified by its SHA-256 hash.
6. After all chunks are assembled, the full-file SHA-256 hash is verified.

## Prerequisites

- **Node.js** >= 18
- **npm**
- **Docker** and **Docker Compose** (for containerized deployment)

## Running with Docker Compose (recommended)

The simplest way to run the entire system is Docker Compose. It starts the tracker, 3 file servers with test files, and 1 client.

```bash
cd install
docker compose up --build
```

Once running, attach to the interactive client:

```bash
docker compose attach file-client
```

To stop the entire system:

```bash
docker compose down
```

Test files are mounted from `test-data/peer{1,2,3}-shared/`. Downloaded files are saved to `test-data/client-downloads/`.

## Running Locally (without Docker)

### Step 1 — Build the `protocol` package (must be built first)

```bash
cd protocol
npm install
npm run build
cd ..
```

### Step 2 — Build and start the tracker

```bash
cd tracker
npm install
npm run build
npm start -- --port 50050
```

The tracker will output:
```
Tracker server listening on 0.0.0.0:50050
Heartbeat timeout: 15000ms
```

### Step 3 — Build and start file servers

In separate terminals (building only needs to be done once):

```bash
cd file-server
npm install
npm run build
```

**Server 1:**
```bash
npm start -- --peer-id server-1 --port 50101 --host 127.0.0.1 \
  --tracker 127.0.0.1:50050 --shared-dir ../test-data/peer1-shared
```

**Server 2:**
```bash
npm start -- --peer-id server-2 --port 50102 --host 127.0.0.1 \
  --tracker 127.0.0.1:50050 --shared-dir ../test-data/peer2-shared
```

**Server 3:**
```bash
npm start -- --peer-id server-3 --port 50103 --host 127.0.0.1 \
  --tracker 127.0.0.1:50050 --shared-dir ../test-data/peer3-shared
```

Each server will output something like (file count varies per server):
```
Scanned 3 file(s) in /path/to/shared
File server gRPC listening on 0.0.0.0:50101
Registered with tracker as server-1 (127.0.0.1:50101)
File server is running. Press Ctrl+C to stop.
```

> **Note (Windows):** Use `127.0.0.1` instead of `localhost`, as Node.js on Windows may resolve `localhost` to the IPv6 address `::1`, causing an `ECONNREFUSED` error.

### Step 4 — Build and start the client

In a separate terminal:

```bash
cd file-client
npm install
npm run build
npm start -- --tracker 127.0.0.1:50050 --download-dir ../test-data/client-downloads
```

## Using the Client (interactive menu)

After startup, the client displays an interactive menu:

```
=== Decentralized File Sharing ===

? What would you like to do?
❯ Discover files on the network
  Show active peers
  ──────────────
  Quit
```

### "Show active peers" command

Displays a list of all registered file servers:

```
Active peers (3):
┌───────────┬───────────┬───────┐
│ Peer ID   │ Host      │ Port  │
├───────────┼───────────┼───────┤
│ server-1  │ 127.0.0.1 │ 50101 │
│ server-2  │ 127.0.0.1 │ 50102 │
│ server-3  │ 127.0.0.1 │ 50103 │
└───────────┴───────────┴───────┘
```

### "Discover files on the network" command

Queries all active servers and displays an aggregated file table:

```
Querying tracker for active peers...
Found 3 peer(s). Querying for files...

Discovered 5 file(s):
┌─────┬──────────────────────────────┬────────────┬─────────┬─────────┬────────────────────┐
│ #   │ Name                         │ Size       │ Sources │ Chunks  │ Hash (short)       │
├─────┼──────────────────────────────┼────────────┼─────────┼─────────┼────────────────────┤
│ 1   │ largefile.bin                │ 262 kB     │ 2       │ 4       │ ea71685e098f35c5...│
│ 2   │ shared-doc.txt               │ 59 B       │ 2       │ 1       │ 902fbeba148a9825...│
│ 3   │ peer1-only.txt               │ 29 B       │ 1       │ 1       │ 3f98690eae4f27f0...│
│ 4   │ peer2-only.txt               │ 29 B       │ 1       │ 1       │ bf92aac04e103862...│
│ 5   │ peer3-only.txt               │ 29 B       │ 1       │ 1       │ bcd4dec1ab86bc7a...│
└─────┴──────────────────────────────┴────────────┴─────────┴─────────┴────────────────────┘
```

Then you are prompted to select a file and a source server:

```
? Select a file to download:
❯ largefile.bin (262 kB) [2 source(s)]
  shared-doc.txt (59 B) [2 source(s)]
  peer1-only.txt (29 B) [1 source(s)]
  peer2-only.txt (29 B) [1 source(s)]
  peer3-only.txt (29 B) [1 source(s)]
  ──────────────
  Back

? Select source peer:
❯ server-1 (127.0.0.1:50101)
  server-2 (127.0.0.1:50102)
  Back
```

After selection, the download begins with progress reporting:

```
Downloading "largefile.bin" from server-1...
  Downloading from server-1: 262 kB / 262 kB [4/4 chunks]
  Integrity verified (SHA-256: ea71685e098f35c5...)
  Saved to: /path/to/downloads/largefile.bin
```

If a chunk or file hash does not match, the download is aborted with an error:

```
  Download failed: Chunk 2 hash mismatch (expected a1b2c3d4..., got e5f6g7h8...)
```

### "Quit" command

Exits the client.

## Command-Line Arguments

### Tracker

```bash
cd tracker && npm start -- [options]
```

| Argument | Short | Environment Variable | Default | Description |
|---|---|---|---|---|
| `--port` | `-p` | `PORT` | `50050` | gRPC server listen port |
| `--heartbeat-timeout` | — | `HEARTBEAT_TIMEOUT_MS` | `15000` | Time (ms) after which a server is considered inactive if no heartbeat is received |
| `--help` | `-h` | — | — | Show help |

### File Server

```bash
cd file-server && npm start -- [options]
```

| Argument | Short | Environment Variable | Default | Description |
|---|---|---|---|---|
| `--peer-id` | — | `PEER_ID` | `peer-<pid>` | Unique server identifier |
| `--port` | `-p` | `PEER_PORT` | `50101` | gRPC server port |
| `--host` | — | `PEER_HOST` | `localhost` | Hostname advertised to clients via the tracker |
| `--tracker` | `-t` | `TRACKER_ADDR` | `localhost:50050` | Tracker address (host:port) |
| `--shared-dir` | `-s` | `SHARED_DIR` | `./shared` | Directory with files to share |
| `--chunk-size` | `-c` | `CHUNK_SIZE_KB` | `64` | Chunk size in KB |
| `--heartbeat-interval` | — | `HEARTBEAT_INTERVAL_MS` | `5000` | Heartbeat interval (ms) |
| `--help` | `-h` | — | — | Show help |

### File Client

```bash
cd file-client && npm start -- [options]
```

| Argument | Short | Environment Variable | Default | Description |
|---|---|---|---|---|
| `--tracker` | `-t` | `TRACKER_ADDR` | `localhost:50050` | Tracker address (host:port) |
| `--download-dir` | `-d` | `DOWNLOAD_DIR` | `./downloads` | Directory for saving downloaded files |
| `--help` | `-h` | — | — | Show help |

## gRPC Protocol

### Tracker Service (`proto/tracker.proto`)

| Method | Type | Description |
|---|---|---|
| `Register` | Unary | Register a file server (ID, host, port) |
| `Heartbeat` | Unary | Keep-alive signal from a file server |
| `Unregister` | Unary | Remove a file server from the tracker |
| `GetPeers` | Unary | Get the list of all active file servers |

### File Service (`proto/file-service.proto`)

| Method | Type | Description |
|---|---|---|
| `GetFileList` | Unary | Get metadata for all files on the server |
| `GetFileMetadata` | Unary | Get metadata for a specific file by `file_id` |
| `GetChunk` | Unary | Get one chunk of a file (by `file_id` + `chunk_index`) |

File metadata includes: `file_id` (SHA-256 of the full file), name, size, chunk size, chunk count, file hash, and per-chunk hashes.

## Verifying System Operation

### Scenario 1 — Server Registration

1. Start the tracker and several file servers.
2. In the client, select "Show active peers".
3. Verify that all running servers appear in the table.
4. Stop one of the servers (Ctrl+C).
5. Wait for the `heartbeat-timeout` period (15 seconds by default).
6. Check peers again — the stopped server should disappear from the list.

### Scenario 2 — File Discovery

1. Start the system with test data (Docker Compose or locally).
2. In the client, select "Discover files on the network".
3. Verify that files from all servers are displayed.
4. Shared files (`largefile.bin`, `shared-doc.txt`) should show a source count > 1.
5. Unique files (`peer1-only.txt`, `peer2-only.txt`, `peer3-only.txt`) should have 1 source.

### Scenario 3 — File Download

1. Select "Discover files on the network".
2. Choose a file from the list (e.g., `shared-doc.txt`).
3. If the file is available on multiple servers — select a source.
4. Wait for the download to complete.
5. Verify that the message "Integrity verified (SHA-256: ...)" appears.
6. Check that the file is saved in the download directory.

### Scenario 4 — Integrity Verification

The system automatically verifies integrity at two levels:
- **Per-chunk:** The SHA-256 hash of each chunk is verified upon receipt. If the hash does not match, the download is immediately aborted.
- **Full-file:** After all chunks are assembled, the full-file SHA-256 hash is verified. If it does not match, the file is deleted.

### Scenario 5 — Cross-Server Consistency

1. Download the same file (e.g., `largefile.bin`) first from `server-1`, then from `server-2`.
2. Both downloads should pass verification successfully.
3. The file contents will be identical, since `file_id` = SHA-256 of the full file.
