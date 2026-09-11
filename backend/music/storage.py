import json
import mimetypes
import posixpath
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.exceptions import SuspiciousFileOperation
from django.core.files.base import ContentFile
from django.core.files.storage import Storage
from django.utils.deconstruct import deconstructible


@deconstructible
class SupabaseStorage(Storage):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.base_url = settings.SUPABASE_URL.rstrip("/")
        self.bucket = settings.SUPABASE_STORAGE_BUCKET
        self.service_key = settings.SUPABASE_SERVICE_ROLE_KEY
        public_url = getattr(settings, "SUPABASE_STORAGE_PUBLIC_URL", "")
        self.public_url = public_url.rstrip("/") if public_url else (
            f"{self.base_url}/storage/v1/object/public/{self.bucket}"
        )

    def _normalize_name(self, name):
        name = str(name).replace("\\", "/").lstrip("/")
        normalized = posixpath.normpath(name)
        if normalized in {"", "."} or normalized == ".." or normalized.startswith("../"):
            raise SuspiciousFileOperation(f"Invalid storage path: {name}")
        return normalized

    def _object_url(self, name):
        encoded_name = quote(self._normalize_name(name), safe="/")
        return f"{self.base_url}/storage/v1/object/{self.bucket}/{encoded_name}"

    def _request(self, method, url, data=None, content_type=None, extra_headers=None):
        headers = {
            "Authorization": f"Bearer {self.service_key}",
            "apikey": self.service_key,
        }
        if content_type:
            headers["Content-Type"] = content_type
        if extra_headers:
            headers.update(extra_headers)
        request = Request(url, data=data, headers=headers, method=method)
        return urlopen(request, timeout=60)

    def _save(self, name, content):
        name = self._normalize_name(name)
        if hasattr(content, "open"):
            content.open()
        data = content.read()
        content_type = getattr(content, "content_type", None)
        if not content_type:
            content_type = mimetypes.guess_type(name)[0] or "application/octet-stream"
        self._request(
            "POST",
            self._object_url(name),
            data=data,
            content_type=content_type,
            extra_headers={"x-upsert": "true"},
        ).close()
        return name

    def _open(self, name, mode="rb"):
        response = self._request("GET", self._object_url(name))
        try:
            return ContentFile(response.read(), name=self._normalize_name(name))
        finally:
            response.close()

    def delete(self, name):
        name = self._normalize_name(name)
        data = json.dumps({"prefixes": [name]}).encode("utf-8")
        try:
            self._request(
                "DELETE",
                f"{self.base_url}/storage/v1/object/{self.bucket}",
                data=data,
                content_type="application/json",
            ).close()
        except HTTPError as error:
            if error.code != 404:
                raise

    def exists(self, name):
        try:
            self._request("HEAD", self._object_url(name)).close()
            return True
        except HTTPError as error:
            if error.code == 404:
                return False
            raise

    def url(self, name):
        encoded_name = quote(self._normalize_name(name), safe="/")
        return f"{self.public_url}/{encoded_name}"
