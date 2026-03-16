import * as grpc from "@grpc/grpc-js";
import { TrackerServiceClient, getErrorMessage } from "protocol";

export class TrackerRegistration {
  private _client: TrackerServiceClient;
  private _peerId: string;
  private _heartbeatTimer?: NodeJS.Timeout;

  constructor(client: TrackerServiceClient, peerId: string) {
    this._client = client;
    this._peerId = peerId;
  }

  private _sendHeartbeat(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this._client.Heartbeat({ peer_id: this._peerId }, (err: grpc.ServiceError | null, res) => {
        if (err) {
          return reject(err);
        }
        resolve(res.acknowledged);
      });
    });
  }

  public async register(host: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this._client.Register({ peer_id: this._peerId, host, port }, (err: grpc.ServiceError | null) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  }

  public async unregister(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._client.Unregister({ peer_id: this._peerId }, (err: grpc.ServiceError | null) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  }

  public startHeartbeat(intervalMs: number): void {
    this._heartbeatTimer = setInterval(async () => {
      try {
        const ack = await this._sendHeartbeat();
        if (!ack) {
          console.warn("Heartbeat not acknowledged — peer may have been expired from tracker");
        }
      } catch (err) {
        console.warn("Heartbeat failed:", getErrorMessage(err));
      }
    }, intervalMs);
  }

  public stopHeartbeat(): void {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
    }
  }
}
