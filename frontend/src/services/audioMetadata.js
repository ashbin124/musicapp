function textDecoderForEncoding(encoding) {
  if (encoding === 1 || encoding === 2) return new TextDecoder('utf-16')
  if (encoding === 3) return new TextDecoder('utf-8')
  return new TextDecoder('latin1')
}

function decodeTextFrame(bytes) {
  if (!bytes?.length) return ''
  const encoding = bytes[0]
  let payload = bytes.slice(1)
  if (encoding === 1 && payload[0] === 0xff && payload[1] === 0xfe) payload = payload.slice(2)
  if (encoding === 1 && payload[0] === 0xfe && payload[1] === 0xff) payload = payload.slice(2)
  return textDecoderForEncoding(encoding)
    .decode(payload)
    .replace(/\0/g, '')
    .trim()
}

function synchsafe(bytes, offset) {
  return (
    ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f)
  )
}

function uint32(bytes, offset) {
  return (
    (bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0
}

function findTextTerminator(bytes, start, encoding) {
  if (encoding === 1 || encoding === 2) {
    for (let index = start; index < bytes.length - 1; index += 2) {
      if (bytes[index] === 0 && bytes[index + 1] === 0) return index + 2
    }
    return bytes.length
  }
  const index = bytes.indexOf(0, start)
  return index >= 0 ? index + 1 : bytes.length
}

function parseArtwork(bytes) {
  const encoding = bytes[0]
  let index = 1
  const mimeEnd = bytes.indexOf(0, index)
  if (mimeEnd < 0) return null
  const mime = new TextDecoder('latin1').decode(bytes.slice(index, mimeEnd)) || 'image/jpeg'
  index = mimeEnd + 2
  index = findTextTerminator(bytes, index, encoding)
  const imageBytes = bytes.slice(index)
  if (!imageBytes.length) return null

  return new Promise((resolve) => {
    const blob = new Blob([imageBytes], { type: mime })
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(blob)
  })
}

async function parseId3(file) {
  const header = new Uint8Array(await file.slice(0, 10).arrayBuffer())
  if (
    header[0] !== 0x49 ||
    header[1] !== 0x44 ||
    header[2] !== 0x33 ||
    header[3] < 3 ||
    header[3] > 4
  ) {
    return {}
  }

  const version = header[3]
  const tagSize = synchsafe(header, 6)
  const bytes = new Uint8Array(await file.slice(0, Math.min(tagSize + 10, 5 * 1024 * 1024)).arrayBuffer())
  const values = {}
  let offset = 10

  while (offset + 10 <= bytes.length) {
    const frameId = new TextDecoder('latin1').decode(bytes.slice(offset, offset + 4))
    if (!/^[A-Z0-9]{4}$/.test(frameId)) break
    const size = version === 4 ? synchsafe(bytes, offset + 4) : uint32(bytes, offset + 4)
    if (!size || offset + 10 + size > bytes.length) break
    const payload = bytes.slice(offset + 10, offset + 10 + size)

    if (frameId === 'TIT2') values.title = decodeTextFrame(payload)
    if (frameId === 'TPE1') values.artist = decodeTextFrame(payload)
    if (frameId === 'TALB') values.album = decodeTextFrame(payload)
    if (frameId === 'TDRC' || frameId === 'TYER') values.year = decodeTextFrame(payload).slice(0, 4)
    if (frameId === 'APIC' && !values.artworkDataUrl) {
      values.artworkDataUrl = await parseArtwork(payload)
    }

    offset += 10 + size
  }

  return values
}

function filenameTitle(file) {
  return file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function readDuration(file) {
  return new Promise((resolve) => {
    const audio = document.createElement('audio')
    const url = URL.createObjectURL(file)
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) ? Math.round(audio.duration) : 0
      URL.revokeObjectURL(url)
      resolve(duration)
    }
    audio.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(0)
    }
    audio.src = url
  })
}

export async function readAudioMetadata(file) {
  const [tags, duration] = await Promise.all([
    parseId3(file).catch(() => ({})),
    readDuration(file),
  ])

  return {
    title: tags.title || filenameTitle(file),
    artist: tags.artist || '',
    album: tags.album || '',
    year: tags.year || '',
    duration_seconds: duration,
    artworkDataUrl: tags.artworkDataUrl || '',
  }
}
