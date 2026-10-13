from django.utils import timezone
from pathlib import PurePosixPath
from urllib.parse import unquote
from rest_framework import serializers
from .models import (
    Language, Driver, Vehicle, VehicleService, VoiceBotCallJob,
    VoiceBotCallJobEvent, AppointmentRecord, VoiceCallJobDocument,
)


class TimestampUpdateMixin:
    """Maintain the schema's updated_at columns without relying on DB triggers."""
    def update(self, instance, validated_data):
        if hasattr(instance, "updated_at"):
            instance.updated_at = timezone.now()
        return super().update(instance, validated_data)


class LanguageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Language
        fields = ["id", "name", "code", "created_at"]
        read_only_fields = ["id", "created_at"]


class DriverSerializer(TimestampUpdateMixin, serializers.ModelSerializer):
    preferred_language_id = serializers.PrimaryKeyRelatedField(
        source="preferred_language", queryset=Language.objects.all()
    )
    language_name = serializers.CharField(source="preferred_language.name", read_only=True)
    class Meta:
        model = Driver
        fields = ["id", "external_id", "name", "phone", "preferred_language_id", "language_name",
                  "language_source", "do_not_call", "created_at", "updated_at"]
        read_only_fields = ["id", "external_id", "created_at", "updated_at", "language_name"]

    def validate_phone(self, value):
        import re
        if not re.fullmatch(r"\+[1-9][0-9]{7,14}", value):
            raise serializers.ValidationError("Enter an international phone number, e.g. +919876543210.")
        return value

    def validate_language_source(self, value):
        if value not in {"default", "manual", "detected"}:
            raise serializers.ValidationError("Choose default, manual, or detected.")
        return value


class VehicleSerializer(TimestampUpdateMixin, serializers.ModelSerializer):
    driver_id = serializers.PrimaryKeyRelatedField(
        source="driver", queryset=Driver.objects.all(), allow_null=True, required=False
    )
    driver_name = serializers.CharField(source="driver.name", read_only=True, allow_null=True)
    class Meta:
        model = Vehicle
        fields = ["id", "external_id", "registration_no", "driver_id", "driver_name", "is_active", "created_at"]
        read_only_fields = ["id", "external_id", "created_at", "driver_name"]


class VehicleServiceSerializer(serializers.ModelSerializer):
    vehicle_id = serializers.PrimaryKeyRelatedField(source="vehicle", queryset=Vehicle.objects.all())
    vehicle_registration_no = serializers.CharField(source="vehicle.registration_no", read_only=True)
    # The create form intentionally omits call_attempts; keep API creation backwards-compatible
    # and initialize the existing database column to zero without a schema change.
    call_attempts = serializers.IntegerField(required=False, default=0, min_value=0)

    class Meta:
        model = VehicleService
        fields = ["id", "external_id", "vehicle_id", "vehicle_registration_no", "due_maintenance_date",
                  "maintenance_type", "service_status", "created_at", "call_attempts"]
        read_only_fields = ["id", "external_id", "created_at", "vehicle_registration_no"]


class VoiceBotCallJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = VoiceBotCallJob
        fields = ["id", "external_id", "service_id", "correlation_id", "job_status", "callback_received",
                  "created_at", "updated_at"]
        read_only_fields = ["id", "external_id", "created_at", "updated_at"]


class VoiceBotCallJobEventSerializer(serializers.ModelSerializer):
    job_id = serializers.PrimaryKeyRelatedField(source="job", queryset=VoiceBotCallJob.objects.all())
    class Meta:
        model = VoiceBotCallJobEvent
        fields = ["id", "job_id", "event_status", "system_message", "event_occurred_at"]
        read_only_fields = ["id", "event_occurred_at"]


class AppointmentRecordSerializer(TimestampUpdateMixin, serializers.ModelSerializer):
    job_id = serializers.PrimaryKeyRelatedField(source="job", queryset=VoiceBotCallJob.objects.all())
    class Meta:
        model = AppointmentRecord
        fields = ["id", "job_id", "appointment_date", "appointment_time", "vehicle_registration_no",
                  "depot", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class VoiceCallJobDocumentSerializer(serializers.ModelSerializer):
    job_id = serializers.PrimaryKeyRelatedField(source="job", queryset=VoiceBotCallJob.objects.all())
    file_name = serializers.SerializerMethodField()

    class Meta:
        model = VoiceCallJobDocument
        # Do not expose the raw storage path in API responses. The content endpoint
        # streams the file after applying authentication and path validation.
        fields = ["id", "job_id", "document_type", "file_name", "created_at"]
        read_only_fields = ["id", "created_at", "file_name"]

    def get_file_name(self, obj):
        raw_path = unquote(obj.document_path or "")
        return PurePosixPath(raw_path.replace("\\", "/")).name or "document"

    def validate_document_type(self, value):
        if value not in {"TRANSCRIPT", "RECORDING"}:
            raise serializers.ValidationError("Document type must be TRANSCRIPT or RECORDING.")
        return value
