from django.contrib import admin

from .models import Album, Artist, LikedSong, PlaybackState, Playlist, PlaylistSong, RecentlyPlayed, Song


@admin.register(Artist)
class ArtistAdmin(admin.ModelAdmin):
    list_display = ["name", "created_at"]
    search_fields = ["name"]


@admin.register(Album)
class AlbumAdmin(admin.ModelAdmin):
    list_display = ["title", "artist", "year", "created_at"]
    list_filter = ["year"]
    search_fields = ["title", "artist__name"]


@admin.register(Song)
class SongAdmin(admin.ModelAdmin):
    list_display = ["title", "artist", "album", "duration_seconds", "created_at"]
    list_filter = ["artist", "album"]
    search_fields = ["title", "artist__name", "album__title"]


class PlaylistSongInline(admin.TabularInline):
    model = PlaylistSong
    extra = 0


@admin.register(Playlist)
class PlaylistAdmin(admin.ModelAdmin):
    list_display = ["name", "user", "updated_at"]
    search_fields = ["name", "user__username"]
    inlines = [PlaylistSongInline]


admin.site.register(LikedSong)
admin.site.register(RecentlyPlayed)
admin.site.register(PlaybackState)
