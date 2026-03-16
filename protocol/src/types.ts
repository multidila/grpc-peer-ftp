import * as grpc from "@grpc/grpc-js";

// --- Tracker types ---

export interface PeerInfo {
  peer_id: string;
  host: string;
  port: number;
}

export interface RegisterRequest {
  peer_id: string;
  host: string;
  port: number;
}

export interface RegisterResponse {
  success: boolean;
}

export interface HeartbeatRequest {
  peer_id: string;
}

export interface HeartbeatResponse {
  acknowledged: boolean;
}

export interface UnregisterRequest {
  peer_id: string;
}

export interface UnregisterResponse {
  success: boolean;
}

export interface GetPeersRequest {}

export interface GetPeersResponse {
  peers: PeerInfo[];
}

export interface TrackerServiceClient extends grpc.Client {
  Register(
    request: RegisterRequest,
    callback: (err: grpc.ServiceError | null, response: RegisterResponse) => void
  ): void;
  Heartbeat(
    request: HeartbeatRequest,
    callback: (err: grpc.ServiceError | null, response: HeartbeatResponse) => void
  ): void;
  Unregister(
    request: UnregisterRequest,
    callback: (err: grpc.ServiceError | null, response: UnregisterResponse) => void
  ): void;
  GetPeers(
    request: GetPeersRequest,
    callback: (err: grpc.ServiceError | null, response: GetPeersResponse) => void
  ): void;
}

export interface TrackerServiceDefinition {
  TrackerService: {
    service: grpc.ServiceDefinition;
  } & (new (address: string, credentials: grpc.ChannelCredentials) => TrackerServiceClient);
}

// --- File service types ---

export interface FileMetadata {
  file_id: string;
  file_name: string;
  file_size: string; // int64 loaded as string
  file_hash: string;
  chunk_size: number;
  chunk_count: number;
  chunk_hashes: string[];
}

export interface GetFileListRequest {}

export interface GetFileListResponse {
  files: FileMetadata[];
}

export interface GetFileMetadataRequest {
  file_id: string;
}

export interface GetFileMetadataResponse {
  metadata: FileMetadata;
}

export interface GetChunkRequest {
  file_id: string;
  chunk_index: number;
}

export interface GetChunkResponse {
  chunk_index: number;
  data: Buffer;
  chunk_hash: string;
}

export interface FileServiceClient extends grpc.Client {
  GetFileList(
    request: GetFileListRequest,
    callback: (err: grpc.ServiceError | null, response: GetFileListResponse) => void
  ): void;
  GetFileMetadata(
    request: GetFileMetadataRequest,
    callback: (err: grpc.ServiceError | null, response: GetFileMetadataResponse) => void
  ): void;
  GetChunk(
    request: GetChunkRequest,
    callback: (err: grpc.ServiceError | null, response: GetChunkResponse) => void
  ): void;
}

export interface FileServiceDefinition {
  FileService: {
    service: grpc.ServiceDefinition;
  } & (new (address: string, credentials: grpc.ChannelCredentials) => FileServiceClient);
}
