from io import BytesIO
import os
import re

from django.core.files.base import ContentFile
from mutagen import File as MutagenFile


def first_tag(tags, keys):
    if not tags:
        return ""
    for key in keys:
        value = tags.get(key)
        if isinstance(value, list) and value:
            return str(value[0])
        if value:
            return str(value)
    return ""


def parse_year(raw):
    if not raw:
        return None
    match = re.search(r"(19|20)\d{2}", str(raw))
    return int(match.group(0)) if match else None


def file_to_buffer(uploaded_file):
    position = uploaded_file.tell() if hasattr(uploaded_file, "tell") else None
    try:
        uploaded_file.seek(0)
        return BytesIO(uploaded_file.read())
    finally:
        if position is not None:
            uploaded_file.seek(position)


def extract_artwork(audio):
    if not audio or not audio.tags:
        return None

    tags = audio.tags
    for key in tags.keys():
        if key.startswith("APIC"):
            artwork = tags[key]
            return getattr(artwork, "data", None)

    covr = tags.get("covr")
    if covr:
        return bytes(covr[0])

    pictures = getattr(audio, "pictures", None)
    if pictures:
        return pictures[0].data

    return None


def extract_audio_metadata(uploaded_file):
    filename = os.path.basename(uploaded_file.name or "")
    fallback_title = os.path.splitext(filename)[0].replace("_", " ").replace("-", " ").strip()

    data = file_to_buffer(uploaded_file)
    audio = MutagenFile(data, easy=True)
    full_audio = MutagenFile(file_to_buffer(uploaded_file), easy=False)

    duration = 0
    if audio and getattr(audio, "info", None) and getattr(audio.info, "length", None):
        duration = max(0, round(audio.info.length))

    tags = audio.tags if audio else {}
    artwork_bytes = extract_artwork(full_audio)
    title = first_tag(tags, ["title"]) or fallback_title or "Untitled"
    artist = first_tag(tags, ["artist", "albumartist", "composer"]) or "Unknown Artist"
    album = first_tag(tags, ["album"]) or "Singles"
    year = parse_year(first_tag(tags, ["date", "year", "originaldate"]))

    return {
        "title": title,
        "artist": artist,
        "album": album,
        "duration_seconds": duration,
        "release_year": year,
        "has_artwork": bool(artwork_bytes),
        "artwork_file": ContentFile(artwork_bytes, name=f"{fallback_title or 'cover'}.jpg")
        if artwork_bytes
        else None,
    }
