import * as fs from "fs";
import * as path from "path";
import { FileMetadata, hashFile, hashBuffer } from "protocol";

export class FileScanner {
  private _sharedDir: string;
  private _chunkSizeBytes: number;

  constructor(sharedDir: string, chunkSizeBytes: number) {
    this._sharedDir = sharedDir;
    this._chunkSizeBytes = chunkSizeBytes;
  }

  private async _scanFile(filePath: string, fileName: string): Promise<FileMetadata> {
    const stat = await fs.promises.stat(filePath);
    const fileHash = await hashFile(filePath);
    const chunkHashes = await this._computeChunkHashes(filePath);
    const chunkCount = Math.ceil(stat.size / this._chunkSizeBytes) || 1;

    return {
      file_id: fileHash,
      file_name: fileName,
      file_size: String(stat.size),
      file_hash: fileHash,
      chunk_size: this._chunkSizeBytes,
      chunk_count: chunkCount,
      chunk_hashes: chunkHashes,
    };
  }

  private _computeChunkHashes(filePath: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const hashes: string[] = [];
      const stream = fs.createReadStream(filePath, { highWaterMark: this._chunkSizeBytes });
      stream.on("data", (chunk: Buffer) => {
        hashes.push(hashBuffer(chunk));
      });
      stream.on("end", () => resolve(hashes));
      stream.on("error", reject);
    });
  }

  public async scan(): Promise<FileMetadata[]> {
    if (!fs.existsSync(this._sharedDir)) {
      fs.mkdirSync(this._sharedDir, { recursive: true });
      return [];
    }

    const entries = await fs.promises.readdir(this._sharedDir, { withFileTypes: true });
    const files: FileMetadata[] = [];

    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }

      try {
        const metadata = await this._scanFile(path.join(this._sharedDir, entry.name), entry.name);
        files.push(metadata);
      } catch {
        // file may have been removed during scan — skip
      }
    }

    console.log(`Scanned ${files.length} file(s) in ${this._sharedDir}`);
    return files;
  }
}
