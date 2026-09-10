from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from .models import Album, Artist, LikedSong, Playlist, PlaylistSong, Song


User = get_user_model()


@override_settings(MEDIA_ROOT="/tmp/musicapp-test-media")
class ApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="listener", password="password123")
        self.admin = User.objects.create_user(
            username="admin", password="password123", is_staff=True
        )
        self.artist = Artist.objects.create(name="Demo Artist")
        self.album = Album.objects.create(title="Demo Album", artist=self.artist, year=2026)
        self.song_a = Song.objects.create(
            title="A Song",
            artist=self.artist,
            album=self.album,
            duration_seconds=180,
            audio_file="songs/a.mp3",
            uploaded_by=self.admin,
        )
        self.song_b = Song.objects.create(
            title="B Song",
            artist=self.artist,
            album=self.album,
            duration_seconds=200,
            audio_file="songs/b.mp3",
            uploaded_by=self.admin,
        )

    def authenticate(self, user=None):
        self.client.force_authenticate(user=user or self.user)

    def test_register_and_login(self):
        response = self.client.post(
            "/api/auth/register/",
            {"username": "newuser", "password": "strongpass123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        response = self.client.post(
            "/api/auth/login/",
            {"username": "newuser", "password": "strongpass123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_normal_user_cannot_upload_song(self):
        self.authenticate()
        upload = SimpleUploadedFile("song.mp3", b"not real audio", content_type="audio/mpeg")
        response = self.client.post(
            "/api/songs/",
            {"title": "Blocked", "audio_file": upload},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_like_and_unlike_song(self):
        self.authenticate()
        response = self.client.post(f"/api/songs/{self.song_a.id}/like/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(LikedSong.objects.filter(user=self.user, song=self.song_a).exists())

        response = self.client.get("/api/liked-songs/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["results"][0]["song"]["id"], self.song_a.id)

        response = self.client.delete(f"/api/songs/{self.song_a.id}/unlike/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(LikedSong.objects.filter(user=self.user, song=self.song_a).exists())

    def test_playlist_crud_and_ordering(self):
        self.authenticate()
        response = self.client.post("/api/playlists/", {"name": "Driving"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        playlist_id = response.data["id"]

        first = self.client.post(
            f"/api/playlists/{playlist_id}/add_song/",
            {"song_id": self.song_a.id},
            format="json",
        )
        second = self.client.post(
            f"/api/playlists/{playlist_id}/add_song/",
            {"song_id": self.song_b.id},
            format="json",
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)

        response = self.client.post(
            f"/api/playlists/{playlist_id}/reorder/",
            {"entry_ids": [second.data["id"], first.data["id"]]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        entries = PlaylistSong.objects.filter(playlist_id=playlist_id).order_by("order")
        self.assertEqual([entry.song_id for entry in entries], [self.song_b.id, self.song_a.id])

        response = self.client.delete(
            f"/api/playlists/{playlist_id}/entries/{second.data['id']}/"
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        response = self.client.delete(f"/api/playlists/{playlist_id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Playlist.objects.filter(id=playlist_id).exists())
