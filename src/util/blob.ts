export function toBlobPart<T extends ArrayBufferLike>(u8: Uint8Array<T>): ArrayBuffer {
  // If it's a normal ArrayBuffer and covers the whole buffer, reuse without copy.
  if (u8.buffer instanceof ArrayBuffer && u8.byteOffset === 0 && u8.byteLength === u8.buffer.byteLength) {
    return u8.buffer;
  }

  // Otherwise, copy the exact range into a fresh ArrayBuffer (ensures ArrayBuffer, not SharedArrayBuffer).
  const out = new Uint8Array(u8.byteLength);
  out.set(u8);
  return out.buffer;
}

