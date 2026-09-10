import os
from uuid import uuid4

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import models
from django.utils.text import slugify


User = get_user_model()


def normalize_label(value):
    return " ".join((value or "").strip().casefold().split())


def safe_upload_path(prefix, filename):
    _, ext = os.path.splitext(filename)
    return f"{prefix}/{uuid4().hex}{ext.lower()}"


def song_audio_upload_path(instance, filename):
    return safe_upload_path("songs", filename)


def artwork_upload_path(instance, filename):
    base = slugify(getattr(instance, "title", "") or getattr(instance, "name", "artwork"))
    return f"artwork/{base or 'cover'}-{uuid4().hex}.jpg"


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Artist(TimeStampedModel):
    name = models.CharField(max_length=180)
    normalized_name = models.CharField(max_length=180, unique=True, editable=False)

    class Meta:
        ordering = ["name"]

    def save(self, *args, **kwargs):
        self.name = " ".join(self.name.strip().split())
        self.normalized_name = normalize_label(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Album(TimeStampedModel):
    title = models.CharField(max_length=220)
    normalized_title = models.CharField(max_length=220, editable=False)
    artist = models.ForeignKey(
        Artist, related_name="albums", on_delete=models.CASCADE
    )
    year = models.PositiveIntegerField(null=True, blank=True)
    artwork = models.ImageField(upload_to=artwork_upload_path, null=True, blank=True)

    class Meta:
        ordering = ["artist__name", "title"]
        constraints = [
            models.UniqueConstraint(
                fields=["artist", "normalized_title"], name="unique_album_per_artist"
            )
        ]

    def save(self, *args, **kwargs):
        self.title = " ".join(self.title.strip().split())
        self.normalized_title = normalize_label(self.title)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.title} - {self.artist.name}"


class Song(TimeStampedModel):
    title = models.CharField(max_length=220)
    artist = models.ForeignKey(Artist, related_name="songs", on_delete=models.PROTECT)
    album = models.ForeignKey(
        Album, related_name="songs", on_delete=models.SET_NULL, null=True, blank=True
    )
    audio_file = models.FileField(upload_to=song_audio_upload_path)
    duration_seconds = models.PositiveIntegerField(default=0)
    artwork = models.ImageField(upload_to=artwork_upload_path, null=True, blank=True)
    release_year = models.PositiveIntegerField(null=True, blank=True)
    original_filename = models.CharField(max_length=255, blank=True)
    uploaded_by = models.ForeignKey(
        User, related_name="uploaded_songs", on_delete=models.SET_NULL, null=True
    )

    class Meta:
        ordering = ["title"]
        indexes = [
            models.Index(fields=["title"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"{self.title} - {self.artist.name}"


class LikedSong(models.Model):
    user = models.ForeignKey(User, related_name="liked_songs", on_delete=models.CASCADE)
    song = models.ForeignKey(Song, related_name="likes", on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "song"], name="unique_liked_song")
        ]

    def __str__(self):
        return f"{self.user} likes {self.song}"


class Playlist(TimeStampedModel):
    user = models.ForeignKey(User, related_name="playlists", on_delete=models.CASCADE)
    name = models.CharField(max_length=140)

    class Meta:
        ordering = ["-updated_at", "name"]
        constraints = [
            models.UniqueConstraint(fields=["user", "name"], name="unique_playlist_name")
        ]

    def __str__(self):
        return f"{self.name} ({self.user})"


class PlaylistSong(models.Model):
    playlist = models.ForeignKey(
        Playlist, related_name="entries", on_delete=models.CASCADE
    )
    song = models.ForeignKey(Song, related_name="playlist_entries", on_delete=models.CASCADE)
    order = models.PositiveIntegerField(default=0)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "added_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["playlist", "order"], name="unique_playlist_order"
            )
        ]

    def __str__(self):
        return f"{self.playlist.name}: {self.order} - {self.song.title}"


class RecentlyPlayed(models.Model):
    user = models.ForeignKey(User, related_name="recently_played", on_delete=models.CASCADE)
    song = models.ForeignKey(Song, related_name="recent_plays", on_delete=models.CASCADE)
    position_seconds = models.PositiveIntegerField(default=0)
    played_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-played_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "song"], name="unique_recent_song")
        ]

    def __str__(self):
        return f"{self.user} played {self.song}"


class PlaybackState(models.Model):
    user = models.OneToOneField(
        User, related_name="playback_state", on_delete=models.CASCADE
    )
    song = models.ForeignKey(
        Song, related_name="playback_states", on_delete=models.SET_NULL, null=True, blank=True
    )
    position_seconds = models.PositiveIntegerField(default=0)
    context_type = models.CharField(max_length=40, blank=True)
    context_id = models.CharField(max_length=80, blank=True)
    context_label = models.CharField(max_length=180, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user} playback state"
