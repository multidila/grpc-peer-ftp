import { PeerInfo } from "protocol";

export interface DiscoveredFile {
  file_id: string;
  file_name: string;
  file_size: number;
  file_hash: string;
  chunk_size: number;
  chunk_count: number;
  chunk_hashes: string[];
  sources: PeerInfo[];
}
