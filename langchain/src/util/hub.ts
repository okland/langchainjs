import { backOff } from "exponential-backoff";

import { fetchWithTimeout, extname, FileLoader, LoadValues } from "./index.js";

const HUB_PATH_REGEX = /lc(@[^:]+)?:\/\/(.*)/;

const URL_PATH_SEPARATOR = "/";

export const loadFromHub = async <T>(
  uri: string,
  loader: FileLoader<T>,
  validPrefix: string,
  validSuffixes: Set<string>,
  values: LoadValues = {}
): Promise<T | undefined> => {
  const match = uri.match(HUB_PATH_REGEX);
  if (!match) {
    return undefined;
  }
  const [rawRef, remotePath] = match.slice(1);
  const ref = rawRef
    ? rawRef.slice(1)
    : process.env.LANGCHAIN_HUB_DEFAULT_REF ?? "master";
  const parts = remotePath.split(URL_PATH_SEPARATOR);
  if (parts[0] !== validPrefix) {
    return undefined;
  }

  if (!validSuffixes.has(extname(remotePath).slice(1))) {
    throw new Error("Unsupported file type.");
  }

  const url = [
    process.env.LANGCHAIN_HUB_URL_BASE ??
      "https://raw.githubusercontent.com/hwchase17/langchain-hub/",
    ref,
    remotePath,
  ].join("/");
  const res = await backOff(() => fetchWithTimeout(url, { timeout: 5000 }), {
    numOfAttempts: 6,
  });
  if (res.status !== 200) {
    throw new Error(`Could not find file at ${url}`);
  }

  return loader(await res.text(), remotePath, values);
};
