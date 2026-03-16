import * as grpc from "@grpc/grpc-js";
import {
  TrackerServiceClient,
  PeerInfo,
  FileServiceClient,
  FileMetadata,
  GetChunkResponse,
  createFileServiceClient,
  getErrorMessage,
} from "protocol";
import { DiscoveredFile } from "./types";

export class DiscoveryService {
  private _trackerClient: TrackerServiceClient;

  constructor(trackerClient: TrackerServiceClient) {
    this._trackerClient = trackerClient;
  }

  private _queryFileList(client: FileServiceClient): Promise<FileMetadata[]> {
    return new Promise((resolve, reject) => {
      client.GetFileList({}, (err: grpc.ServiceError | null, res) => {
        if (err) {
          return reject(err);
        }
        resolve(res.files);
      });
    });
  }

  public async getPeers(): Promise<PeerInfo[]> {
    return new Promise((resolve, reject) => {
      this._trackerClient.GetPeers({}, (err: grpc.ServiceError | null, res) => {
        if (err) {
          return reject(err);
        }
        resolve(res.peers);
      });
    });
  }

  public async discoverFiles(peers: PeerInfo[]): Promise<DiscoveredFile[]> {
    const fileMap: Map<string, DiscoveredFile> = new Map();

    const queryPromises = peers.map(async (peer) => {
      const client = createFileServiceClient(`${peer.host}:${peer.port}`);
      try {
        const files = await this._queryFileList(client);
        for (const f of files) {
          const existing = fileMap.get(f.file_id);
          if (existing) {
            if (!existing.sources.find((s) => s.peer_id === peer.peer_id)) {
              existing.sources.push(peer);
            }
          } else {
            fileMap.set(f.file_id, {
              file_id: f.file_id,
              file_name: f.file_name,
              file_size: Number(f.file_size),
              file_hash: f.file_hash,
              chunk_size: f.chunk_size,
              chunk_count: f.chunk_count,
              chunk_hashes: f.chunk_hashes,
              sources: [peer],
            });
          }
        }
      } catch (err) {
        console.warn(`Could not reach peer ${peer.peer_id} (${peer.host}:${peer.port}): ${getErrorMessage(err)}`);
      } finally {
        client.close();
      }
    });

    await Promise.all(queryPromises);
    return Array.from(fileMap.values());
  }

  public queryChunk(client: FileServiceClient, fileId: string, chunkIndex: number): Promise<GetChunkResponse> {
    return new Promise((resolve, reject) => {
      client.GetChunk({ file_id: fileId, chunk_index: chunkIndex }, (err: grpc.ServiceError | null, res) => {
        if (err) {
          return reject(err);
        }
        resolve(res);
      });
    });
  }
}
