import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import * as path from "path";
import * as fs from "fs";
import {
  TrackerServiceDefinition,
  TrackerServiceClient,
  FileServiceDefinition,
  FileServiceClient,
} from "./types";

const loaderOptions: protoLoader.Options = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};

function findProto(filename: string): string {
  const protoPath = path.join(__dirname, "..", "..", "proto", filename);
  if (fs.existsSync(protoPath)) {
    return protoPath;
  }
  throw new Error(`Proto file not found: ${filename} (searched ${protoPath})`);
}

// Tracker proto
const trackerPackageDef = protoLoader.loadSync(findProto("tracker.proto"), loaderOptions);
export const trackerProto = grpc.loadPackageDefinition(trackerPackageDef).tracker as unknown as TrackerServiceDefinition;

// File service proto
const fileServicePackageDef = protoLoader.loadSync(findProto("file-service.proto"), loaderOptions);
export const fileServiceProto = grpc.loadPackageDefinition(fileServicePackageDef).fileservice as unknown as FileServiceDefinition;

export function createTrackerClient(address: string): TrackerServiceClient {
  return new trackerProto.TrackerService(address, grpc.credentials.createInsecure());
}

export function createFileServiceClient(address: string): FileServiceClient {
  return new fileServiceProto.FileService(address, grpc.credentials.createInsecure());
}
