import "server-only";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { getEdgeTtsVoice } from "../../../lib/env";

// Unlike piperClient.js's persistent process, each call here opens its own short-lived
// WebSocket to Microsoft's Edge TTS endpoint and closes it when done — no globalThis
// caching, since there's no cross-request state worth (or safe to) keeping on a serverless
// platform where consecutive requests may land on different instances anyway.
export async function synthesize(text) {
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(getEdgeTtsVoice(), OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text);

    const chunks = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } finally {
    tts.close();
  }
}
