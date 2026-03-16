import * as grpc from "@grpc/grpc-js";
import {
  PeerInfo,
  RegisterRequest,
  RegisterResponse,
  HeartbeatRequest,
  HeartbeatResponse,
  UnregisterRequest,
  UnregisterResponse,
  GetPeersRequest,
  GetPeersResponse,
} from "protocol";

interface PeerRecord {
  peer_id: string;
  host: string;
  port: number;
  lastHeartbeat: number;
}

export class TrackerService {
  private _peers: Map<string, PeerRecord> = new Map();
  private _expiryInterval: NodeJS.Timeout;
  private _heartbeatTimeoutMs: number;

  constructor(heartbeatTimeoutMs: number) {
    this._heartbeatTimeoutMs = heartbeatTimeoutMs;
    this._expiryInterval = setInterval(
      () => this._expireStalePeers(),
      heartbeatTimeoutMs / 2
    );
  }

  private _register(
    call: grpc.ServerUnaryCall<RegisterRequest, RegisterResponse>,
    callback: grpc.sendUnaryData<RegisterResponse>
  ): void {
    const { peer_id, host, port } = call.request;
    this._peers.set(peer_id, { peer_id, host, port, lastHeartbeat: Date.now() });
    console.log(`Peer registered: ${peer_id} at ${host}:${port} (total: ${this._peers.size})`);
    callback(null, { success: true });
  }

  private _heartbeat(
    call: grpc.ServerUnaryCall<HeartbeatRequest, HeartbeatResponse>,
    callback: grpc.sendUnaryData<HeartbeatResponse>
  ): void {
    const record = this._peers.get(call.request.peer_id);
    if (record) {
      record.lastHeartbeat = Date.now();
      callback(null, { acknowledged: true });
    } else {
      callback(null, { acknowledged: false });
    }
  }

  private _unregister(
    call: grpc.ServerUnaryCall<UnregisterRequest, UnregisterResponse>,
    callback: grpc.sendUnaryData<UnregisterResponse>
  ): void {
    const { peer_id } = call.request;
    const deleted = this._peers.delete(peer_id);
    if (deleted) {
      console.log(`Peer unregistered: ${peer_id} (total: ${this._peers.size})`);
    }
    callback(null, { success: deleted });
  }

  private _getPeers(
    call: grpc.ServerUnaryCall<GetPeersRequest, GetPeersResponse>,
    callback: grpc.sendUnaryData<GetPeersResponse>
  ): void {
    const peerList: PeerInfo[] = Array.from(this._peers.values()).map((r) => ({
      peer_id: r.peer_id,
      host: r.host,
      port: r.port,
    }));
    callback(null, { peers: peerList });
  }

  private _expireStalePeers(): void {
    const now = Date.now();
    for (const [id, record] of this._peers) {
      if (now - record.lastHeartbeat > this._heartbeatTimeoutMs) {
        console.log(`Peer expired: ${id}`);
        this._peers.delete(id);
      }
    }
  }

  public get handlers() {
    return {
      Register: (call: grpc.ServerUnaryCall<RegisterRequest, RegisterResponse>, cb: grpc.sendUnaryData<RegisterResponse>) =>
        this._register(call, cb),
      Heartbeat: (call: grpc.ServerUnaryCall<HeartbeatRequest, HeartbeatResponse>, cb: grpc.sendUnaryData<HeartbeatResponse>) =>
        this._heartbeat(call, cb),
      Unregister: (call: grpc.ServerUnaryCall<UnregisterRequest, UnregisterResponse>, cb: grpc.sendUnaryData<UnregisterResponse>) =>
        this._unregister(call, cb),
      GetPeers: (call: grpc.ServerUnaryCall<GetPeersRequest, GetPeersResponse>, cb: grpc.sendUnaryData<GetPeersResponse>) =>
        this._getPeers(call, cb),
    };
  }

  public shutdown(): void {
    clearInterval(this._expiryInterval);
  }
}
