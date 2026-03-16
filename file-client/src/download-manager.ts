import * as fs from "fs";
import * as path from "path";
import prettyBytes from "pretty-bytes";
import { PeerInfo, createFileServiceClient, hashBuffer, hashFile, getErrorMessage } from "protocol";
import { DiscoveredFile } from "./types";
import { DiscoveryService } from "./discovery-service";

export interface DownloadResult {
  success: boolean;
  filePath: string;
  error?: string;
}

export class DownloadManager {
  private _downloadDir: string;
  private _discoveryService: DiscoveryService;

  constructor(downloadDir: string, discoveryService: DiscoveryService) {
    this._downloadDir = downloadDir;
    this._discoveryService = discoveryService;
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }
  }

  private _verifyChunkHash(data: Buffer, expected: string, index: number): string | null {
    const computed = hashBuffer(data);
    if (computed !== expected) {
      return `Chunk ${index} hash mismatch (expected ${expected.substring(0, 8)}..., got ${computed.substring(0, 8)}...)`;
    }
    return null;
  }

  private async _verifyFileHash(filePath: string, expected: string): Promise<string | null> {
    const computed = await hashFile(filePath);
    if (computed !== expected) {
      return `File integrity check failed (expected ${expected.substring(0, 16)}..., got ${computed.substring(0, 16)}...)`;
    }
    return null;
  }

  private _reportProgress(source: PeerInfo, received: number, total: number, chunk: number, totalChunks: number): void {
    process.stdout.write(
      `\r  Downloading from ${source.peer_id}: ${prettyBytes(received)} / ${prettyBytes(total)} ` +
      `[${chunk}/${totalChunks} chunks]`
    );
  }

  public async download(file: DiscoveredFile, source: PeerInfo): Promise<DownloadResult> {
    const savePath = path.join(this._downloadDir, file.file_name);
    const tempPath = savePath + ".part";

    const writeStream = fs.createWriteStream(tempPath);
    const client = createFileServiceClient(`${source.host}:${source.port}`);
    let bytesReceived = 0;

    try {
      for (let i = 0; i < file.chunk_count; i++) {
        const response = await this._discoveryService.queryChunk(client, file.file_id, i);

        const error = this._verifyChunkHash(response.data, file.chunk_hashes[i], i);
        if (error) {
          writeStream.destroy();
          return { success: false, filePath: savePath, error };
        }

        writeStream.write(response.data);
        bytesReceived += response.data.length;
        this._reportProgress(source, bytesReceived, file.file_size, i + 1, file.chunk_count);
      }
    } catch (err) {
      writeStream.destroy();
      return { success: false, filePath: savePath, error: `Download failed: ${getErrorMessage(err)}` };
    } finally {
      client.close();
    }

    writeStream.end();
    await new Promise<void>((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    const hashError = await this._verifyFileHash(tempPath, file.file_hash);
    if (hashError) {
      fs.unlinkSync(tempPath);
      return { success: false, filePath: savePath, error: hashError };
    }

    fs.renameSync(tempPath, savePath);

    console.log(`\n  Integrity verified (SHA-256: ${file.file_hash.substring(0, 16)}...)`);
    console.log(`  Saved to: ${savePath}`);

    return { success: true, filePath: savePath };
  }
}
