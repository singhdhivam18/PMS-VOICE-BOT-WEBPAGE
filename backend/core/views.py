import mimetypes
import posixpath
import re
import socket
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urljoin

import paramiko
import requests
from django.conf import settings
from django.db import connection
from django.http import StreamingHttpResponse
from rest_framework import permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action
from .models import (
    Language, Driver, Vehicle, VehicleService, VoiceBotCallJob,
    VoiceBotCallJobEvent, AppointmentRecord, VoiceCallJobDocument,
)
from .serializers import (
    LanguageSerializer, DriverSerializer, VehicleSerializer, VehicleServiceSerializer,
    VoiceBotCallJobSerializer, VoiceBotCallJobEventSerializer,
    AppointmentRecordSerializer, VoiceCallJobDocumentSerializer,
)


class HealthView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
            return Response({"status": "ok", "database": "connected"})
        except Exception:
            # Do not return credentials or internal exception details from health check.
            return Response({"status": "error", "database": "unavailable"}, status=503)


class DashboardView(APIView):
    def get(self, request):
        recent_jobs = VoiceBotCallJob.objects.order_by("-created_at").values(
            "id", "service_id", "job_status", "callback_received", "created_at"
        )[:6]
        return Response({
            "counts": {
                "languages": Language.objects.count(),
                "drivers": Driver.objects.count(),
                "vehicles": Vehicle.objects.count(),
                "active_vehicles": Vehicle.objects.filter(is_active=True).count(),
                "vehicle_services": VehicleService.objects.count(),
                "due_services": VehicleService.objects.filter(service_status__iexact="DUE").count(),
                "call_jobs": VoiceBotCallJob.objects.count(),
                "pending_jobs": VoiceBotCallJob.objects.filter(job_status__iexact="PENDING").count(),
                "appointments": AppointmentRecord.objects.count(),
            },
            "recent_jobs": list(recent_jobs),
        })


class NoDeleteModelViewSet(viewsets.ModelViewSet):
    """Allow create/read/update in the admin API; protect referenced history from deletion."""
    http_method_names = ["get", "post", "patch", "put", "head", "options"]


class LanguageViewSet(NoDeleteModelViewSet):
    queryset = Language.objects.all()
    serializer_class = LanguageSerializer
    search_fields = ["name", "code"]
    ordering_fields = ["id", "name", "code", "created_at"]


class DriverViewSet(NoDeleteModelViewSet):
    queryset = Driver.objects.select_related("preferred_language").all()
    serializer_class = DriverSerializer
    search_fields = ["name", "phone", "language_source"]
    ordering_fields = ["id", "name", "phone", "created_at"]


class VehicleViewSet(NoDeleteModelViewSet):
    queryset = Vehicle.objects.select_related("driver").all()
    serializer_class = VehicleSerializer
    search_fields = ["registration_no"]
    ordering_fields = ["id", "registration_no", "created_at"]


class VehicleServiceViewSet(NoDeleteModelViewSet):
    queryset = VehicleService.objects.select_related("vehicle").all()
    serializer_class = VehicleServiceSerializer
    search_fields = ["maintenance_type", "service_status", "vehicle__registration_no"]
    ordering_fields = ["id", "due_maintenance_date", "maintenance_type", "service_status", "call_attempts"]


class VoiceBotCallJobViewSet(viewsets.ReadOnlyModelViewSet):
    """Job state is produced by the call workflow; dashboard initially exposes read-only access."""
    queryset = VoiceBotCallJob.objects.all()
    serializer_class = VoiceBotCallJobSerializer
    search_fields = ["job_status"]
    ordering_fields = ["id", "job_status", "created_at", "updated_at"]


class VoiceBotCallJobEventViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = VoiceBotCallJobEvent.objects.select_related("job").all()
    serializer_class = VoiceBotCallJobEventSerializer
    search_fields = ["event_status", "system_message"]
    ordering_fields = ["id", "event_status", "event_occurred_at"]


class AppointmentRecordViewSet(NoDeleteModelViewSet):
    queryset = AppointmentRecord.objects.select_related("job").all()
    serializer_class = AppointmentRecordSerializer
    search_fields = ["vehicle_registration_no", "depot"]
    ordering_fields = ["id", "appointment_date", "appointment_time", "created_at"]


class VoiceCallJobDocumentViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only artifact metadata with authenticated, allow-listed content streaming."""
    queryset = VoiceCallJobDocument.objects.select_related("job").all()
    serializer_class = VoiceCallJobDocumentSerializer
    search_fields = ["document_type", "document_path"]
    ordering_fields = ["id", "document_type", "created_at"]

    @action(detail=True, methods=["get"], url_path="content")
    def content(self, request, pk=None):
        document = self.get_object()

        # The database stores paths such as /upload/recording/example.mp3.
        # Never treat database content as an arbitrary URL or filesystem path.
        raw_path = unquote(document.document_path or "")
        posix_path = PurePosixPath(raw_path)
        if (
            not raw_path.startswith("/upload/")
            or raw_path.startswith("//")
            or "\\" in raw_path
            or "?" in raw_path
            or "#" in raw_path
            or "\x00" in raw_path
            or any(part in {".", ".."} for part in posix_path.parts)
        ):
            return Response(
                {"detail": "This document path is not in the permitted upload directory."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        file_name = posix_path.name
        extension = PurePosixPath(file_name).suffix.lower()
        if document.document_type == "RECORDING":
            allowed_extensions = {".mp3", ".wav", ".m4a", ".ogg", ".webm", ".mp4", ".aac"}
            if extension not in allowed_extensions:
                return Response(
                    {"detail": "This recording format is not supported for browser playback."},
                    status=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                )
            content_type = mimetypes.guess_type(file_name)[0] or "audio/mpeg"
            if not content_type.startswith("audio/") and content_type != "video/mp4":
                content_type = "audio/mpeg"
        else:
            # Transcripts are displayed as text in the browser, never executed as HTML.
            content_type = "application/json; charset=utf-8" if extension == ".json" else "text/plain; charset=utf-8"

        backend = getattr(settings, "VOICEOPS_DOCUMENT_STORAGE_BACKEND", "filesystem").lower()
        safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", file_name)[:180] or "document"

        if backend == "filesystem":
            # Production: the Django process runs on the VM that holds /upload.
            media_root = Path(settings.VOICEOPS_MEDIA_ROOT).resolve()
            relative_path = PurePosixPath(*posix_path.parts[2:])  # strip leading '/' and 'upload'
            target_path = (media_root / Path(*relative_path.parts)).resolve()
            try:
                target_path.relative_to(media_root)
            except ValueError:
                return Response(
                    {"detail": "This document path is not in the permitted upload directory."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                file_handle = target_path.open("rb")
                file_length = target_path.stat().st_size
            except FileNotFoundError:
                return Response({"detail": "The requested file was not found on the VM."}, status=status.HTTP_404_NOT_FOUND)
            except PermissionError:
                return Response(
                    {"detail": "The Django service account does not have permission to read this file."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            except OSError:
                return Response({"detail": "The file could not be opened on the VM."}, status=status.HTTP_502_BAD_GATEWAY)

            response = _stream_file_response(file_handle, content_type, safe_name, file_length)
            return response

        if backend == "sftp":
            # Development: Django runs on a different machine and reads through SFTP.
            if not settings.VOICEOPS_SFTP_HOST or not settings.VOICEOPS_SFTP_USERNAME:
                return Response(
                    {"detail": "SFTP storage is selected but VOICEOPS_SFTP_HOST or VOICEOPS_SFTP_USERNAME is missing."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            ssh = paramiko.SSHClient()
            try:
                ssh.load_system_host_keys()
                known_hosts = getattr(settings, "VOICEOPS_SFTP_KNOWN_HOSTS", "")
                if known_hosts and Path(known_hosts).expanduser().is_file():
                    ssh.load_host_keys(str(Path(known_hosts).expanduser()))
                # Do not silently trust unknown server keys.
                ssh.set_missing_host_key_policy(paramiko.RejectPolicy())
                private_key = getattr(settings, "VOICEOPS_SFTP_PRIVATE_KEY_FILE", "")
                password = getattr(settings, "VOICEOPS_SFTP_PASSWORD", "")
                ssh.connect(
                    hostname=settings.VOICEOPS_SFTP_HOST,
                    port=settings.VOICEOPS_SFTP_PORT,
                    username=settings.VOICEOPS_SFTP_USERNAME,
                    password=password or None,
                    key_filename=private_key or None,
                    timeout=8,
                    banner_timeout=8,
                    auth_timeout=8,
                    allow_agent=True,
                    look_for_keys=True,
                )
                sftp = ssh.open_sftp()
                relative_path = "/".join(posix_path.parts[2:])
                remote_root = getattr(settings, "VOICEOPS_SFTP_REMOTE_ROOT", "/upload").rstrip("/") or "/"
                remote_path = posixpath.join(remote_root, relative_path)
                file_handle = sftp.open(remote_path, "rb")
                file_length = sftp.stat(remote_path).st_size
            except (paramiko.SSHException, OSError, socket.timeout, KeyError, ValueError):
                try:
                    ssh.close()
                except Exception:
                    pass
                return Response(
                    {"detail": "Django could not retrieve the file through SFTP. Check SFTP host, port, credentials, host key, path and permissions."},
                    status=status.HTTP_502_BAD_GATEWAY,
                )

            def close_sftp():
                try:
                    sftp.close()
                finally:
                    ssh.close()

            return _stream_file_response(file_handle, content_type, safe_name, file_length, close_sftp)

        if backend == "http":
            # Optional legacy mode, only when the artifact server actually serves HTTP.
            media_base = getattr(settings, "VOICEOPS_MEDIA_BASE_URL", "").rstrip("/")
            if not media_base:
                return Response(
                    {"detail": "HTTP document storage is selected, but VOICEOPS_MEDIA_BASE_URL is not configured."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            upstream_url = urljoin(media_base + "/", raw_path.lstrip("/"))
            try:
                upstream = requests.get(
                    upstream_url,
                    stream=True,
                    timeout=(5, 60),
                    allow_redirects=False,
                    headers={"Accept": "*/*"},
                )
            except requests.RequestException:
                return Response({"detail": "The HTTP artifact server could not be reached."}, status=status.HTTP_502_BAD_GATEWAY)
            if upstream.status_code != 200:
                upstream.close()
                response_status = status.HTTP_404_NOT_FOUND if upstream.status_code == 404 else status.HTTP_502_BAD_GATEWAY
                return Response({"detail": "The requested file could not be retrieved from the HTTP artifact server."}, status=response_status)

            def stream_http_file():
                try:
                    for chunk in upstream.iter_content(chunk_size=64 * 1024):
                        if chunk:
                            yield chunk
                finally:
                    upstream.close()

            response = StreamingHttpResponse(stream_http_file(), content_type=content_type)
            length = upstream.headers.get("Content-Length")
            if length and length.isdigit():
                response["Content-Length"] = length
            response["Content-Disposition"] = f'inline; filename="{safe_name}"'
            response["X-Content-Type-Options"] = "nosniff"
            response["Cache-Control"] = "private, no-store"
            return response

        return Response(
            {"detail": "Invalid document storage backend. Choose filesystem, sftp, or http."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


def _stream_file_response(file_handle, content_type, safe_name, file_length=None, close_extra=None):
    def chunks():
        try:
            while True:
                chunk = file_handle.read(64 * 1024)
                if not chunk:
                    break
                yield chunk
        finally:
            try:
                file_handle.close()
            finally:
                if close_extra:
                    close_extra()

    response = StreamingHttpResponse(chunks(), content_type=content_type)
    if file_length is not None:
        response["Content-Length"] = str(file_length)
    response["Content-Disposition"] = f'inline; filename="{safe_name}"'
    response["X-Content-Type-Options"] = "nosniff"
    response["Cache-Control"] = "private, no-store"
    return response
