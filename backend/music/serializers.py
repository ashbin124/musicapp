import os

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Max, Sum
from rest_framework import serializers

from .metadata import extract_audio_metadata
from .models import (
    Album,
    Artist,
    LikedSong,
    PlaybackState,
    Playlist,
    PlaylistSong,
    RecentlyPlayed,
    Song,
    normalize_label,
)


User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "is_staff"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["id", "username", "password"]

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data["username"], password=validated_data["password"]
        )


class ArtistSerializer(serializers.ModelSerializer):
    song_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Artist
        fields = ["id", "name", "song_count", "created_at", "updated_at"]


class AlbumSerializer(serializers.ModelSerializer):
    artist = ArtistSerializer(read_only=True)
    artist_id = serializers.PrimaryKeyRelatedField(
        queryset=Artist.objects.all(), source="artist", write_only=True, required=False
    )
    artist_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    song_count = serializers.IntegerField(read_only=True)
    total_duration_seconds = serializers.SerializerMethodField()
    artwork_url = serializers.SerializerMethodField()

    class Meta:
        model = Album
        fields = [
            "id",
            "title",
            "artist",
            "artist_id",
            "artist_name",
            "year",
            "artwork_url",
            "song_count",
            "total_duration_seconds",
            "created_at",
            "updated_at",
        ]

    def get_total_duration_seconds(self, obj):
        return obj.songs.aggregate(total=Sum("duration_seconds"))["total"] or 0

    def get_artwork_url(self, obj):
        request = self.context.get("request")
        if obj.artwork and request:
            return request.build_absolute_uri(obj.artwork.url)
        return None

    def validate(self, attrs):
        if not attrs.get("artist") and not attrs.get("artist_name"):
            raise serializers.ValidationError("Choose an artist or provide artist_name.")
        return attrs

    def create(self, validated_data):
        artist_name = validated_data.pop("artist_name", "")
        if not validated_data.get("artist"):
            validated_data["artist"], _ = Artist.objects.get_or_create(
                normalized_name=normalize_label(artist_name),
                defaults={"name": artist_name.strip()},
            )
        return super().create(validated_data)

    def update(self, instance, validated_data):
        artist_name = validated_data.pop("artist_name", "")
        if artist_name and not validated_data.get("artist"):
            validated_data["artist"], _ = Artist.objects.get_or_create(
                normalized_name=normalize_label(artist_name),
                defaults={"name": artist_name.strip()},
            )
        return super().update(instance, validated_data)


class SongSerializer(serializers.ModelSerializer):
    artist = ArtistSerializer(read_only=True)
    album = AlbumSerializer(read_only=True)
    audio_url = serializers.SerializerMethodField()
    artwork_url = serializers.SerializerMethodField()
    liked = serializers.SerializerMethodField()

    class Meta:
        model = Song
        fields = [
            "id",
            "title",
            "artist",
            "album",
            "audio_url",
            "artwork_url",
            "duration_seconds",
            "release_year",
            "liked",
            "created_at",
            "updated_at",
        ]

    def get_audio_url(self, obj):
        request = self.context.get("request")
        if obj.audio_file and request:
            return request.build_absolute_uri(obj.audio_file.url)
        return None

    def get_artwork_url(self, obj):
        request = self.context.get("request")
        artwork = obj.artwork or (obj.album.artwork if obj.album_id else None)
        if artwork and request:
            return request.build_absolute_uri(artwork.url)
        return None

    def get_liked(self, obj):
        user = self.context.get("request").user if self.context.get("request") else None
        if not user or not user.is_authenticated:
            return False
        return LikedSong.objects.filter(user=user, song=obj).exists()


class SongWriteSerializer(serializers.ModelSerializer):
    artist_id = serializers.PrimaryKeyRelatedField(
        queryset=Artist.objects.all(), source="artist", required=False
    )
    artist_name = serializers.CharField(required=False, allow_blank=True)
    album_id = serializers.PrimaryKeyRelatedField(
        queryset=Album.objects.all(), source="album", required=False, allow_null=True
    )
    album_title = serializers.CharField(required=False, allow_blank=True)
    audio_file = serializers.FileField(required=False)

    class Meta:
        model = Song
        fields = [
            "id",
            "title",
            "artist_id",
            "artist_name",
            "album_id",
            "album_title",
            "audio_file",
            "duration_seconds",
            "release_year",
        ]
        extra_kwargs = {
            "title": {"required": False},
            "duration_seconds": {"required": False},
        }

    def validate_audio_file(self, uploaded_file):
        ext = os.path.splitext(uploaded_file.name)[1].lower()
        if ext not in settings.MUSIC_ALLOWED_AUDIO_EXTENSIONS:
            allowed = ", ".join(sorted(settings.MUSIC_ALLOWED_AUDIO_EXTENSIONS))
            raise serializers.ValidationError(f"Unsupported file type. Use {allowed}.")
        max_bytes = settings.MUSIC_MAX_UPLOAD_SIZE_MB * 1024 * 1024
        if uploaded_file.size > max_bytes:
            raise serializers.ValidationError(
                f"Audio file exceeds {settings.MUSIC_MAX_UPLOAD_SIZE_MB} MB."
            )
        return uploaded_file

    def validate(self, attrs):
        creating = self.instance is None
        if creating and not attrs.get("audio_file"):
            raise serializers.ValidationError("audio_file is required.")
        if creating and not attrs.get("title"):
            raise serializers.ValidationError({"title": "Title is required."})
        if creating and not attrs.get("artist") and not attrs.get("artist_name"):
            raise serializers.ValidationError({"artist_name": "Artist is required."})
        return attrs

    def resolve_artist(self, artist, artist_name):
        if artist:
            return artist
        name = (artist_name or "Unknown Artist").strip() or "Unknown Artist"
        return Artist.objects.get_or_create(
            normalized_name=normalize_label(name), defaults={"name": name}
        )[0]

    def resolve_album(self, album, album_title, artist, year=None):
        if album:
            return album
        title = (album_title or "").strip()
        if not title:
            return None
        return Album.objects.get_or_create(
            artist=artist,
            normalized_title=normalize_label(title),
            defaults={"title": title, "year": year},
        )[0]

    @transaction.atomic
    def create(self, validated_data):
        request = self.context["request"]
        artist_name = validated_data.pop("artist_name", "")
        album_title = validated_data.pop("album_title", "")
        uploaded_file = validated_data.get("audio_file")
        metadata = extract_audio_metadata(uploaded_file)

        title = validated_data["title"]
        duration = validated_data.get("duration_seconds") or metadata["duration_seconds"]
        year = validated_data.get("release_year")
        artist = self.resolve_artist(validated_data.pop("artist", None), artist_name)
        album = self.resolve_album(
            validated_data.pop("album", None), album_title, artist, year
        )

        song = Song.objects.create(
            title=title,
            artist=artist,
            album=album,
            duration_seconds=duration or 0,
            release_year=year,
            original_filename=os.path.basename(uploaded_file.name),
            uploaded_by=request.user,
            audio_file=uploaded_file,
        )
        if metadata["artwork_file"]:
            artwork_name = metadata["artwork_file"].name
            artwork_bytes = metadata["artwork_file"].read()
            song.artwork.save(artwork_name, ContentFile(artwork_bytes), save=True)
            if album and not album.artwork:
                album.artwork.save(artwork_name, ContentFile(artwork_bytes), save=True)
        return song

    @transaction.atomic
    def update(self, instance, validated_data):
        artist_name = validated_data.pop("artist_name", "")
        album_title = validated_data.pop("album_title", "")
        uploaded_file = validated_data.get("audio_file")
        metadata = None
        if uploaded_file:
            metadata = extract_audio_metadata(uploaded_file)
            instance.original_filename = os.path.basename(uploaded_file.name)
            if not validated_data.get("duration_seconds"):
                validated_data["duration_seconds"] = metadata["duration_seconds"]
            if metadata["artwork_file"]:
                instance.artwork.save(metadata["artwork_file"].name, metadata["artwork_file"], save=False)

        if artist_name and not validated_data.get("artist"):
            validated_data["artist"] = self.resolve_artist(None, artist_name)
        if album_title and not validated_data.get("album"):
            artist = validated_data.get("artist") or instance.artist
            validated_data["album"] = self.resolve_album(None, album_title, artist)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance

    def to_representation(self, instance):
        return SongSerializer(instance, context=self.context).data


class MetadataPreviewSerializer(serializers.Serializer):
    audio_file = serializers.FileField()

    def validate_audio_file(self, uploaded_file):
        return SongWriteSerializer(context=self.context).validate_audio_file(uploaded_file)


class LikedSongSerializer(serializers.ModelSerializer):
    song = SongSerializer(read_only=True)

    class Meta:
        model = LikedSong
        fields = ["id", "song", "created_at"]


class PlaylistSongSerializer(serializers.ModelSerializer):
    song = SongSerializer(read_only=True)

    class Meta:
        model = PlaylistSong
        fields = ["id", "song", "order", "added_at"]


class PlaylistSerializer(serializers.ModelSerializer):
    track_count = serializers.IntegerField(read_only=True)
    total_duration_seconds = serializers.SerializerMethodField()

    class Meta:
        model = Playlist
        fields = [
            "id",
            "name",
            "track_count",
            "total_duration_seconds",
            "created_at",
            "updated_at",
        ]

    def get_total_duration_seconds(self, obj):
        return obj.entries.aggregate(total=Sum("song__duration_seconds"))["total"] or 0


class PlaylistDetailSerializer(PlaylistSerializer):
    entries = PlaylistSongSerializer(many=True, read_only=True)

    class Meta(PlaylistSerializer.Meta):
        fields = PlaylistSerializer.Meta.fields + ["entries"]


class PlaylistAddSongSerializer(serializers.Serializer):
    song_id = serializers.PrimaryKeyRelatedField(queryset=Song.objects.all(), source="song")

    def save(self, playlist):
        max_order = playlist.entries.aggregate(max_order=Max("order"))["max_order"]
        return PlaylistSong.objects.create(
            playlist=playlist,
            song=self.validated_data["song"],
            order=0 if max_order is None else max_order + 1,
        )


class PlaylistReorderSerializer(serializers.Serializer):
    entry_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1), allow_empty=False
    )

    def validate_entry_ids(self, entry_ids):
        playlist = self.context["playlist"]
        existing_ids = set(playlist.entries.values_list("id", flat=True))
        if set(entry_ids) != existing_ids:
            raise serializers.ValidationError("entry_ids must include every playlist entry once.")
        if len(entry_ids) != len(set(entry_ids)):
            raise serializers.ValidationError("Duplicate entry ids are not allowed.")
        return entry_ids

    def save(self, playlist):
        for offset, entry_id in enumerate(self.validated_data["entry_ids"]):
            PlaylistSong.objects.filter(playlist=playlist, id=entry_id).update(
                order=10_000 + offset
            )
        for order, entry_id in enumerate(self.validated_data["entry_ids"]):
            PlaylistSong.objects.filter(playlist=playlist, id=entry_id).update(order=order)
        playlist.save(update_fields=["updated_at"])


class RecentlyPlayedSerializer(serializers.ModelSerializer):
    song = SongSerializer(read_only=True)

    class Meta:
        model = RecentlyPlayed
        fields = ["id", "song", "position_seconds", "played_at"]


class RecordPlaybackSerializer(serializers.Serializer):
    song_id = serializers.PrimaryKeyRelatedField(queryset=Song.objects.all(), source="song")
    position_seconds = serializers.IntegerField(min_value=0, required=False, default=0)


class PlaybackStateSerializer(serializers.ModelSerializer):
    song = SongSerializer(read_only=True)
    song_id = serializers.PrimaryKeyRelatedField(
        queryset=Song.objects.all(), source="song", required=False, allow_null=True
    )

    class Meta:
        model = PlaybackState
        fields = [
            "song",
            "song_id",
            "position_seconds",
            "context_type",
            "context_id",
            "context_label",
            "updated_at",
        ]
