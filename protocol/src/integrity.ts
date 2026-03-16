import * as crypto from "crypto";
import * as fs from "fs";

export function hashBuffer(data: Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export async function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk: Buffer) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}
