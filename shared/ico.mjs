/** Validate the ICO directory and each embedded PNG or Windows bitmap frame. */
export function inspectIco(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const invalid = () => {
    throw new Error(
      "This ICO file is damaged or contains an unsupported frame.",
    );
  };
  if (
    bytes.length < 6 ||
    view.getUint16(0, true) !== 0 ||
    view.getUint16(2, true) !== 1
  )
    invalid();
  const count = view.getUint16(4, true),
    directoryEnd = 6 + count * 16;
  if (!count || count > 256 || directoryEnd > bytes.length) invalid();
  const frames = [];
  for (let i = 0; i < count; i++) {
    const entry = 6 + i * 16,
      width = bytes[entry] || 256,
      height = bytes[entry + 1] || 256;
    const length = view.getUint32(entry + 8, true),
      offset = view.getUint32(entry + 12, true);
    if (
      bytes[entry + 3] !== 0 ||
      offset < directoryEnd ||
      length < 16 ||
      offset + length > bytes.length
    )
      invalid();
    const frame = bytes.subarray(offset, offset + length);
    const data = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
    const png = [137, 80, 78, 71, 13, 10, 26, 10].every(
      (value, index) => frame[index] === value,
    );
    if (png) {
      if (
        length < 33 ||
        data.getUint32(8) !== 13 ||
        data.getUint32(12) !== 0x49484452 ||
        data.getUint32(16) !== width ||
        data.getUint32(20) !== height
      )
        invalid();
    } else {
      if (length < 40) invalid();
      const header = data.getUint32(0, true),
        depth = data.getUint16(14, true),
        compression = data.getUint32(16, true);
      if (
        header < 40 ||
        header > length ||
        data.getInt32(4, true) !== width ||
        Math.abs(data.getInt32(8, true)) !== height * 2 ||
        data.getUint16(12, true) !== 1 ||
        ![1, 4, 8, 16, 24, 32].includes(depth) ||
        ![0, 3].includes(compression)
      )
        invalid();
      const palette =
        depth <= 8 ? (data.getUint32(32, true) || 2 ** depth) * 4 : 0;
      const masks = compression === 3 && header === 40 ? 12 : 0;
      const pixels = Math.ceil((width * depth) / 32) * 4 * height;
      const alphaMask = depth < 32 ? Math.ceil(width / 32) * 4 * height : 0;
      if (header + masks + palette + pixels + alphaMask > length) invalid();
    }
    frames.push({ width, height, format: png ? "png" : "dib", bytes: frame });
  }
  return frames.sort((a, b) => b.width * b.height - a.width * a.height);
}
