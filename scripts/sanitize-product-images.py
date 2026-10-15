"""Strip image metadata without decoding or recompressing pixels."""
import struct


def clean_png(data):
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError('Invalid PNG')
    out = bytearray(data[:8]); pos = 8
    keep = {b'IHDR', b'PLTE', b'IDAT', b'IEND', b'tRNS', b'cHRM', b'gAMA', b'sRGB', b'iCCP', b'acTL', b'fcTL', b'fdAT'}
    while pos + 12 <= len(data):
        size = struct.unpack('>I', data[pos:pos+4])[0]
        tag = data[pos+4:pos+8]; end = pos + size + 12
        if end > len(data): raise ValueError('Truncated PNG')
        if tag in keep: out.extend(data[pos:end])
        pos = end
        if tag == b'IEND': return bytes(out)
    raise ValueError('Missing PNG end')


def clean_jpeg(data):
    if data[:2] != b'\xff\xd8': raise ValueError('Invalid JPEG')
    out = bytearray(data[:2]); pos = 2
    while pos < len(data):
        start = pos
        if data[pos] != 255: raise ValueError('Invalid JPEG marker')
        while data[pos] == 255: pos += 1
        marker = data[pos]; pos += 1
        if marker == 0xD9:
            out.extend(data[start:pos]); return bytes(out)
        if marker in (0x01, 0xD8) or 0xD0 <= marker <= 0xD7:
            out.extend(data[start:pos]); continue
        size = struct.unpack('>H', data[pos:pos+2])[0]
        end = pos + size
        if size < 2 or end > len(data): raise ValueError('Truncated JPEG')
        payload = data[pos+2:end]
        metadata = 0xE0 <= marker <= 0xEF or marker == 0xFE
        if not metadata or (marker == 0xEE and len(payload) == 12 and payload.startswith(b'Adobe')):
            out.extend(data[start:end])
        pos = end
        if marker == 0xDA:
            start = pos
            while True:
                at = data.find(b'\xff', pos)
                if at < 0: raise ValueError('Missing JPEG end')
                next_pos = at + 1
                while data[next_pos] == 255: next_pos += 1
                if data[next_pos] == 0 or 0xD0 <= data[next_pos] <= 0xD7:
                    pos = next_pos + 1; continue
                out.extend(data[start:at]); pos = at; break
    raise ValueError('Missing JPEG end')
