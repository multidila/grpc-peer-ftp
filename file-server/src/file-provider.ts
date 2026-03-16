import * as grpc from "@grpc/grpc-js";
import * as fs from "fs";
import * as path from "path";
import {
  FileMetadata,
  GetFileListRequest,
  GetFileListResponse,
  GetFileMetadataRequest,
  GetFileMetadataResponse,
  GetChunkRequest,
  GetChunkResponse,
} from "protocol";

export class FileProvider {
  private _sharedDir: string;
  private _resolvedSharedDir: string;
  private _getLocalFiles: () => FileMetadata[];

  constructor(sharedDir: string, getLocalFiles: () => FileMetadata[]) {
    this._sharedDir = sharedDir;
    this._resolvedSharedDir = path.resolve(sharedDir);
    this._getLocalFiles = getLocalFiles;
  }

  private _findFile(fileId: string): FileMetadata | undefined {
    return this._getLocalFiles().find((f) => f.file_id === fileId);
  }

  private _createError(code: grpc.status, message: string) {
    return {
      code,
      message,
      name: grpc.status[code],
      details: "",
      metadata: new grpc.Metadata(),
    };
  }

  private _getFileList(
    call: grpc.ServerUnaryCall<GetFileListRequest, GetFileListResponse>,
    callback: grpc.sendUnaryData<GetFileListResponse>
  ): void {
    callback(null, { files: this._getLocalFiles() });
  }

  private _getFileMetadata(
    call: grpc.ServerUnaryCall<GetFileMetadataRequest, GetFileMetadataResponse>,
    callback: grpc.sendUnaryData<GetFileMetadataResponse>
  ): void {
    const file = this._findFile(call.request.file_id);
    if (!file) {
      callback(this._createError(grpc.status.NOT_FOUND, `File not found: ${call.request.file_id}`));
      return;
    }
    callback(null, { metadata: file });
  }

  private async _getChunk(
    call: grpc.ServerUnaryCall<GetChunkRequest, GetChunkResponse>,
    callback: grpc.sendUnaryData<GetChunkResponse>
  ): Promise<void> {
    const file = this._findFile(call.request.file_id);
    if (!file) {
      callback(this._createError(grpc.status.NOT_FOUND, `File not found: ${call.request.file_id}`));
      return;
    }

    const chunkIndex = call.request.chunk_index;
    if (chunkIndex < 0 || chunkIndex >= file.chunk_count) {
      callback(this._createError(grpc.status.INVALID_ARGUMENT, `Invalid chunk index: ${chunkIndex} (total: ${file.chunk_count})`));
      return;
    }

    const filePath = path.join(this._sharedDir, file.file_name);
    if (!path.resolve(filePath).startsWith(this._resolvedSharedDir)) {
      callback(this._createError(grpc.status.PERMISSION_DENIED, `Access denied: ${file.file_name}`));
      return;
    }

    const offset = chunkIndex * file.chunk_size;
    const length = Math.min(file.chunk_size, Number(file.file_size) - offset);

    try {
      const handle = await fs.promises.open(filePath, "r");
      try {
        const buffer = Buffer.alloc(length);
        await handle.read(buffer, 0, length, offset);
        callback(null, {
          chunk_index: chunkIndex,
          data: buffer,
          chunk_hash: file.chunk_hashes[chunkIndex],
        });
      } finally {
        await handle.close();
      }
    } catch {
      callback(this._createError(grpc.status.NOT_FOUND, `File no longer available: ${file.file_name}`));
    }
  }

  public get handlers() {
    return {
      GetFileList: (call: grpc.ServerUnaryCall<GetFileListRequest, GetFileListResponse>, cb: grpc.sendUnaryData<GetFileListResponse>) =>
        this._getFileList(call, cb),
      GetFileMetadata: (call: grpc.ServerUnaryCall<GetFileMetadataRequest, GetFileMetadataResponse>, cb: grpc.sendUnaryData<GetFileMetadataResponse>) =>
        this._getFileMetadata(call, cb),
      GetChunk: (call: grpc.ServerUnaryCall<GetChunkRequest, GetChunkResponse>, cb: grpc.sendUnaryData<GetChunkResponse>) =>
        this._getChunk(call, cb),
    };
  }
}
