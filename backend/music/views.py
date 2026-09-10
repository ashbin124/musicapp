from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from django.db.models.deletion import ProtectedError
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .metadata import extract_audio_metadata
from .models import Album, Artist, LikedSong, PlaybackState, Playlist, PlaylistSong, RecentlyPlayed, Song
from .permissions import IsAdminOrReadOnly
from .serializers import (
    AlbumSerializer,
    ArtistSerializer,
    LikedSongSerializer,
    MetadataPreviewSerializer,
    PlaybackStateSerializer,
    PlaylistAddSongSerializer,
    PlaylistDetailSerializer,
    PlaylistReorderSerializer,
    PlaylistSerializer,
    PlaylistSongSerializer,
    RecentlyPlayedSerializer,
    RecordPlaybackSerializer,
    RegisterSerializer,
    SongSerializer,
    SongWriteSerializer,
    UserSerializer,
)


User = get_user_model()


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)


class ArtistViewSet(viewsets.ModelViewSet):
    serializer_class = ArtistSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = Artist.objects.annotate(song_count=Count("songs"))
        query = self.request.query_params.get("q")
        if query:
            queryset = queryset.filter(name__icontains=query)
        return queryset

    def destroy(self, request, *args, **kwargs):
        artist = self.get_object()
        if artist.songs.exists():
            return Response(
                {"detail": "Delete or reassign this artist's songs before deleting the artist."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": "This artist is still used by songs."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=["get"])
    def songs(self, request, pk=None):
        artist = self.get_object()
        serializer = SongSerializer(
            artist.songs.select_related("artist", "album"), many=True, context={"request": request}
        )
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def albums(self, request, pk=None):
        artist = self.get_object()
        serializer = AlbumSerializer(
            artist.albums.annotate(song_count=Count("songs")), many=True, context={"request": request}
        )
        return Response(serializer.data)


class AlbumViewSet(viewsets.ModelViewSet):
    serializer_class = AlbumSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = Album.objects.select_related("artist").annotate(song_count=Count("songs"))
        query = self.request.query_params.get("q")
        if query:
            queryset = queryset.filter(
                Q(title__icontains=query) | Q(artist__name__icontains=query)
            )
        return queryset

    @action(detail=True, methods=["get"])
    def tracks(self, request, pk=None):
        album = self.get_object()
        serializer = SongSerializer(
            album.songs.select_related("artist", "album").order_by("created_at"),
            many=True,
            context={"request": request},
        )
        return Response(serializer.data)


class SongViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]

    def get_permissions(self):
        if self.action in ["like", "unlike"]:
            return [IsAuthenticated()]
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return SongWriteSerializer
        return SongSerializer

    def get_queryset(self):
        queryset = Song.objects.select_related("artist", "album").order_by("-created_at")
        query = self.request.query_params.get("q")
        if query:
            queryset = queryset.filter(
                Q(title__icontains=query)
                | Q(artist__name__icontains=query)
                | Q(album__title__icontains=query)
            )
        return queryset

    @action(detail=False, methods=["post"], permission_classes=[IsAuthenticated])
    def metadata(self, request):
        if not request.user.is_staff:
            return Response({"detail": "Admin access required."}, status=status.HTTP_403_FORBIDDEN)
        serializer = MetadataPreviewSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        metadata = extract_audio_metadata(serializer.validated_data["audio_file"])
        metadata.pop("artwork_file", None)
        return Response(metadata)

    @action(detail=False, methods=["post"], permission_classes=[IsAuthenticated])
    def bulk_upload(self, request):
        if not request.user.is_staff:
            return Response({"detail": "Admin access required."}, status=status.HTTP_403_FORBIDDEN)
        files = request.FILES.getlist("audio_files")
        if not files:
            return Response({"audio_files": ["Select at least one file."]}, status=status.HTTP_400_BAD_REQUEST)

        created = []
        errors = []
        for index, uploaded_file in enumerate(files):
            payload = {
                "audio_file": uploaded_file,
                "title": request.data.get(f"items[{index}][title]", ""),
                "artist_name": request.data.get(f"items[{index}][artist_name]", ""),
                "album_title": request.data.get(f"items[{index}][album_title]", ""),
                "release_year": request.data.get(f"items[{index}][release_year]", ""),
            }
            serializer = SongWriteSerializer(data=payload, context={"request": request})
            if serializer.is_valid():
                created.append(serializer.save())
            else:
                errors.append({"file": uploaded_file.name, "errors": serializer.errors})

        status_code = status.HTTP_207_MULTI_STATUS if errors else status.HTTP_201_CREATED
        return Response(
            {
                "created": SongSerializer(created, many=True, context={"request": request}).data,
                "errors": errors,
            },
            status=status_code,
        )

    @action(detail=True, methods=["post"])
    def like(self, request, pk=None):
        song = self.get_object()
        LikedSong.objects.get_or_create(user=request.user, song=song)
        return Response({"liked": True})

    @action(detail=True, methods=["delete", "post"])
    def unlike(self, request, pk=None):
        song = self.get_object()
        LikedSong.objects.filter(user=request.user, song=song).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class LikedSongViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = LikedSongSerializer

    def get_queryset(self):
        sort = self.request.query_params.get("sort", "recent")
        queryset = LikedSong.objects.filter(user=self.request.user).select_related(
            "song", "song__artist", "song__album"
        )
        if sort == "title":
            return queryset.order_by("song__title")
        if sort == "artist":
            return queryset.order_by("song__artist__name", "song__title")
        return queryset.order_by("-created_at")


class PlaylistViewSet(viewsets.ModelViewSet):
    def get_serializer_class(self):
        if self.action == "retrieve":
            return PlaylistDetailSerializer
        return PlaylistSerializer

    def get_queryset(self):
        return (
            Playlist.objects.filter(user=self.request.user)
            .annotate(track_count=Count("entries"))
            .prefetch_related("entries__song__artist", "entries__song__album")
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["post"])
    def add_song(self, request, pk=None):
        playlist = self.get_object()
        serializer = PlaylistAddSongSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entry = serializer.save(playlist=playlist)
        playlist.save(update_fields=["updated_at"])
        return Response(
            PlaylistSongSerializer(entry, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["delete"], url_path=r"entries/(?P<entry_id>\d+)")
    def remove_entry(self, request, pk=None, entry_id=None):
        playlist = self.get_object()
        deleted, _ = PlaylistSong.objects.filter(playlist=playlist, id=entry_id).delete()
        if not deleted:
            return Response(status=status.HTTP_404_NOT_FOUND)
        for order, entry in enumerate(playlist.entries.order_by("order", "added_at")):
            if entry.order != order:
                entry.order = order
                entry.save(update_fields=["order"])
        playlist.save(update_fields=["updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def reorder(self, request, pk=None):
        playlist = self.get_object()
        serializer = PlaylistReorderSerializer(
            data=request.data, context={"playlist": playlist}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(playlist=playlist)
        return Response(PlaylistDetailSerializer(playlist, context={"request": request}).data)


class RecentlyPlayedViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = RecentlyPlayedSerializer

    def get_queryset(self):
        return RecentlyPlayed.objects.filter(user=self.request.user).select_related(
            "song", "song__artist", "song__album"
        )[:25]

    def create(self, request):
        serializer = RecordPlaybackSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        recent, _ = RecentlyPlayed.objects.update_or_create(
            user=request.user,
            song=serializer.validated_data["song"],
            defaults={"position_seconds": serializer.validated_data["position_seconds"]},
        )
        return Response(
            RecentlyPlayedSerializer(recent, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class PlaybackStateView(APIView):
    def get(self, request):
        state, _ = PlaybackState.objects.get_or_create(user=request.user)
        return Response(PlaybackStateSerializer(state, context={"request": request}).data)

    def put(self, request):
        state, _ = PlaybackState.objects.get_or_create(user=request.user)
        serializer = PlaybackStateSerializer(
            state, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class SearchView(APIView):
    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if not query:
            return Response({"songs": [], "artists": [], "albums": [], "playlists": []})

        songs = Song.objects.select_related("artist", "album").filter(
            Q(title__icontains=query)
            | Q(artist__name__icontains=query)
            | Q(album__title__icontains=query)
        )[:20]
        artists = Artist.objects.annotate(song_count=Count("songs")).filter(name__icontains=query)[:20]
        albums = (
            Album.objects.select_related("artist")
            .annotate(song_count=Count("songs"))
            .filter(Q(title__icontains=query) | Q(artist__name__icontains=query))[:20]
        )
        playlists = (
            Playlist.objects.filter(user=request.user, name__icontains=query)
            .annotate(track_count=Count("entries"))[:20]
        )
        context = {"request": request}
        return Response(
            {
                "songs": SongSerializer(songs, many=True, context=context).data,
                "artists": ArtistSerializer(artists, many=True, context=context).data,
                "albums": AlbumSerializer(albums, many=True, context=context).data,
                "playlists": PlaylistSerializer(playlists, many=True, context=context).data,
            }
        )


class HomeView(APIView):
    def get(self, request):
        context = {"request": request}
        state, _ = PlaybackState.objects.get_or_create(user=request.user)
        recently = RecentlyPlayed.objects.filter(user=request.user).select_related(
            "song", "song__artist", "song__album"
        )[:12]
        liked = LikedSong.objects.filter(user=request.user).select_related(
            "song", "song__artist", "song__album"
        )[:12]
        playlists = Playlist.objects.filter(user=request.user).annotate(track_count=Count("entries"))[:12]
        recent_added = Song.objects.select_related("artist", "album").order_by("-created_at")[:12]
        suggestions = Song.objects.select_related("artist", "album").order_by("?")[:12]

        return Response(
            {
                "continue_listening": PlaybackStateSerializer(state, context=context).data,
                "recently_played": RecentlyPlayedSerializer(recently, many=True, context=context).data,
                "liked_songs": LikedSongSerializer(liked, many=True, context=context).data,
                "playlists": PlaylistSerializer(playlists, many=True, context=context).data,
                "recently_added": SongSerializer(recent_added, many=True, context=context).data,
                "suggestions": SongSerializer(suggestions, many=True, context=context).data,
            }
        )
