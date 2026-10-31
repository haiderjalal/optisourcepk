// Label printer helper.
//
// Runs on the shop PC next to the TSC printer. The back-office page in the
// browser posts a finished TSPL label job to it, and it hands the job to the
// Windows print queue as raw data. No dependencies — only Node.
//
//   node server.mjs
//
// Setup and troubleshooting: docs/label-printing.md

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const here = path.dirname(fileURLToPath(import.meta.url));
const rawPrintScript = path.join(here, "raw-print.ps1");
const configPath = path.join(here, "config.json");
const outDir = path.join(here, "out");

const MAX_BODY_BYTES = 64 * 1024;
const PRINT_TIMEOUT_MS = 20_000;

const DEFAULT_CONFIG = {
  port: 9777,
  printerName: "TSC TE244",
  allowedOrigins: [
    "https://optisource.pk",
    "https://www.optisource.pk",
    "http://localhost:3000",
  ],
  // Write the job to out/last-job.tspl instead of printing it.
  dryRun: false,
};

function log(message) {
  console.log(`[${new Date().toLocaleString("en-GB")}] ${message}`);
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function loadConfig() {
  if (!existsSync(configPath)) return DEFAULT_CONFIG;

  let overrides;
  try {
    overrides = JSON.parse(await readFile(configPath, "utf8"));
  } catch (error) {
    throw new Error(`config.json is not valid JSON: ${error.message}`);
  }

  const config = { ...DEFAULT_CONFIG, ...overrides };
  if (!Number.isInteger(config.port) || config.port < 1024) {
    throw new Error("config.json: port must be a whole number from 1024 up.");
  }
  if (typeof config.printerName !== "string" || !config.printerName.trim()) {
    throw new Error("config.json: printerName must be the printer's name.");
  }
  if (
    !Array.isArray(config.allowedOrigins) ||
    !config.allowedOrigins.every((origin) => typeof origin === "string")
  ) {
    throw new Error("config.json: allowedOrigins must be a list of origins.");
  }
  return config;
}

/** Names of the printers Windows knows about, to catch a wrong printerName. */
async function listPrinters() {
  const { stdout } = await execFileAsync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "Get-Printer | ForEach-Object { $_.Name }",
    ],
    { timeout: 15_000, windowsHide: true },
  );
  return stdout
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;

    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (tooLarge) reject(new HttpError(413, "That label job is too large."));
      else resolve(Buffer.concat(chunks).toString("utf8"));
    });
    request.on("error", reject);
  });
}

/** The job must be plain printable text: TSPL has no use for anything else. */
function parseJob(rawBody) {
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new HttpError(400, "The request body must be JSON.");
  }

  const tspl = body?.tspl;
  if (typeof tspl !== "string" || tspl.trim() === "") {
    throw new HttpError(400, "The request has no label to print.");
  }
  if (!/^[\x20-\x7e\r\n]+$/.test(tspl)) {
    throw new HttpError(400, "A label may only contain plain text.");
  }
  return tspl.replace(/\r?\n/g, "\r\n");
}

async function printRaw(config, tspl) {
  if (config.dryRun) {
    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(outDir, "last-job.tspl"), tspl, "latin1");
    return;
  }

  const dir = await mkdtemp(path.join(os.tmpdir(), "label-job-"));
  const file = path.join(dir, "job.tspl");
  try {
    await writeFile(file, tspl, "latin1");
    await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        rawPrintScript,
        "-PrinterName",
        config.printerName,
        "-Path",
        file,
      ],
      { timeout: PRINT_TIMEOUT_MS, windowsHide: true },
    );
  } catch (error) {
    log(`Print failed: ${error.stderr?.trim() || error.message}`);
    throw new HttpError(
      502,
      "The printer did not accept the label. Check that it is on, connected and not paused.",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function sendJson(response, status, headers, body) {
  response.writeHead(status, {
    ...headers,
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

async function main() {
  const config = await loadConfig();

  if (process.platform !== "win32" && !config.dryRun) {
    throw new Error(
      "Printing needs Windows. Set dryRun in config.json to test.",
    );
  }

  // Only the helper's own address is a valid Host. A page cannot reach it by
  // pointing some other domain name at this PC.
  const validHosts = new Set([
    `127.0.0.1:${config.port}`,
    `localhost:${config.port}`,
    `[::1]:${config.port}`,
  ]);

  // Jobs go through one at a time so two clicks cannot interleave on the printer.
  let queue = Promise.resolve();
  const enqueue = (task) => {
    const run = queue.then(task);
    queue = run.catch(() => undefined);
    return run;
  };

  const server = http.createServer(async (request, response) => {
    const origin = request.headers.origin;
    const originAllowed =
      origin !== undefined && config.allowedOrigins.includes(origin);
    const headers = originAllowed
      ? {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "600",
          Vary: "Origin",
        }
      : { Vary: "Origin" };

    try {
      if (!validHosts.has(request.headers.host ?? "")) {
        throw new HttpError(403, "Unknown host.");
      }

      const { pathname } = new URL(request.url ?? "/", "http://127.0.0.1");

      if (request.method === "OPTIONS") {
        if (!originAllowed)
          throw new HttpError(403, "This site may not print.");
        response.writeHead(204, headers);
        response.end();
        return;
      }

      if (request.method === "GET" && pathname === "/health") {
        sendJson(response, 200, headers, {
          ok: true,
          printer: config.printerName,
          dryRun: config.dryRun,
        });
        return;
      }

      if (request.method === "POST" && pathname === "/print") {
        if (!originAllowed)
          throw new HttpError(403, "This site may not print.");
        const tspl = parseJob(await readBody(request));
        await enqueue(() => printRaw(config, tspl));
        log(`Printed a job of ${tspl.length} characters.`);
        sendJson(response, 200, headers, { ok: true });
        return;
      }

      throw new HttpError(404, "Not found.");
    } catch (error) {
      if (error instanceof HttpError) {
        sendJson(response, error.status, headers, {
          ok: false,
          message: error.message,
        });
        return;
      }
      log(`Unexpected error: ${error.stack ?? error}`);
      sendJson(response, 500, headers, {
        ok: false,
        message: "The label printer helper hit an unexpected error.",
      });
    }
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      log(
        `Port ${config.port} is already in use. Is the helper already running?`,
      );
    } else {
      log(`Server error: ${error.message}`);
    }
    process.exit(1);
  });

  server.listen(config.port, "127.0.0.1", () => {
    log(
      `Label printer helper ready on http://127.0.0.1:${config.port} ` +
        (config.dryRun
          ? "(dry run: not printing)"
          : `-> "${config.printerName}"`),
    );
    log(`Allowing: ${config.allowedOrigins.join(", ")}`);
  });

  if (!config.dryRun) {
    try {
      const printers = await listPrinters();
      if (printers.includes(config.printerName)) {
        log(`Found printer "${config.printerName}".`);
      } else {
        log(
          `WARNING: no printer named "${config.printerName}". ` +
            `Set printerName in config.json to one of: ${printers.join(", ") || "(none found)"}`,
        );
      }
    } catch (error) {
      log(`Could not list printers: ${error.message}`);
    }
  }
}

main().catch((error) => {
  log(error.message);
  process.exit(1);
});
