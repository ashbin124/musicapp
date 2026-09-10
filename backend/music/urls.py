from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import (
    AlbumViewSet,
    ArtistViewSet,
    HomeView,
    LikedSongViewSet,
    MeView,
    PlaybackStateView,
    PlaylistViewSet,
    RecentlyPlayedViewSet,
    RegisterView,
    SearchView,
    SongViewSet,
)


router = DefaultRouter()
router.register("artists", ArtistViewSet, basename="artist")
router.register("albums", AlbumViewSet, basename="album")
router.register("songs", SongViewSet, basename="song")
router.register("liked-songs", LikedSongViewSet, basename="liked-song")
router.register("playlists", PlaylistViewSet, basename="playlist")
router.register("recently-played", RecentlyPlayedViewSet, basename="recently-played")


urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/me/", MeView.as_view(), name="me"),
    path("home/", HomeView.as_view(), name="home"),
    path("search/", SearchView.as_view(), name="search"),
    path("playback-state/", PlaybackStateView.as_view(), name="playback-state"),
    path("", include(router.urls)),
]
