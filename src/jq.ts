import { environment } from "@raycast/api";
import { execFile } from "child_process";
import { createWriteStream } from "fs";
import { unlink } from "fs/promises";
import fetch from "node-fetch";
import * as path from "path";
import { finished } from "stream/promises";
import { promisify } from "util";

const noop = () => { };
const execAsync = promisify(execFile);
const unlinkSilent = (p: string) => unlink(p).catch(noop);

const JQ_VERSION = "jq-1.7.1";
const jqUrl = `https://github.com/jqlang/jq/releases/download/${JQ_VERSION}/jq-macos-amd64`;

export const JQ_EXEC = path.join(environment.supportPath, "jq");

export async function ensureJq(): Promise<string> {
  try {
    // TODO: merge with logic within command into useJq hook
    await execAsync(JQ_EXEC, ["-V"]);
    return JQ_VERSION;
  } catch {
    await unlinkSilent(JQ_EXEC);
    const res = await fetch(jqUrl, { redirect: "follow" });
    if (!res.ok || !res.body) {
      throw new Error(`Failed to download jq: ${res.statusText}`);
    }

    const fileStream = createWriteStream(JQ_EXEC, { flags: "w", mode: 0o755 });
    try {
      await finished(res.body.pipe(fileStream), {});
      return JQ_VERSION;
    } catch (error) {
      await unlink(JQ_EXEC).catch(noop);
      throw error;
    }
  }
}
