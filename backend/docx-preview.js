const fs = require('fs');
const zlib = require('zlib');
const { execFileSync } = require('child_process');

function decodeXml(value) {
  return value.replace(/&#(x[0-9a-f]+|\d+);|&(amp|lt|gt|quot|apos);/gi, (match, numeric, named) => {
    if (numeric) return String.fromCodePoint(parseInt(numeric[0].toLowerCase() === 'x' ? numeric.slice(1) : numeric, numeric[0].toLowerCase() === 'x' ? 16 : 10));
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[named] || match;
  });
}

function readDocxText(filePath) {
  const buffer = fs.readFileSync(filePath);
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new Error('Invalid DOCX archive');
  let cursor = buffer.readUInt32LE(end + 16);
  const entries = buffer.readUInt16LE(end + 10);
  for (let index = 0; index < entries; index++) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Invalid DOCX entry');
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const name = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength);
    if (name === 'word/document.xml') {
      const local = buffer.readUInt32LE(cursor + 42);
      if (buffer.readUInt32LE(local) !== 0x04034b50) throw new Error('Invalid DOCX entry');
      const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
      const packed = buffer.subarray(start, start + compressedSize);
      const xml = (method === 8 ? zlib.inflateRawSync(packed) : method === 0 ? packed : (() => { throw new Error('Unsupported DOCX compression'); })()).toString('utf8');
      return decodeXml(xml.replace(/<w:tab\b[^>]*\/?\s*>/g, '\t').replace(/<w:br\b[^>]*\/?\s*>/g, '\n').replace(/<\/w:p>/g, '\n').replace(/<\/w:tr>/g, '\n').replace(/<\/w:tc>/g, '\t').replace(/<[^>]+>/g, '')).trim();
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error('DOCX text not found');
}

function readLegacyDocText(filePath) {
  const options = { encoding: 'utf8', timeout: 10000, maxBuffer: 4 * 1024 * 1024 };
  const commands = process.platform === 'darwin'
    ? [['textutil', ['-convert', 'txt', '-stdout', filePath]], ['antiword', [filePath]]]
    : [['antiword', [filePath]]];
  for (const [command, args] of commands) {
    try {
      return execFileSync(command, args, options).trim();
    } catch (_) { /* Try the next available converter. */ }
  }
  throw new Error('Legacy DOC converter unavailable');
}

module.exports = { readDocxText, readLegacyDocText };
