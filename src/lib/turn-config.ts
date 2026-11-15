/** Returned only to verified appointment participants. Credentials stay server-side until then. */
export function videoIceServers(env: Readonly<Record<string,string|undefined>> = process.env): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
  const urls = env.TURN_URLS?.split(",").map(url => url.trim()).filter(Boolean) ?? [];
  if (!urls.length) return servers;
  if (urls.length > 8 || urls.some(url => !/^turns?:[^\s@]+$/i.test(url)) || !env.TURN_USERNAME || !env.TURN_CREDENTIAL) {
    throw new Error("Invalid TURN configuration");
  }
  return [...servers, { urls, username: env.TURN_USERNAME, credential: env.TURN_CREDENTIAL }];
}
