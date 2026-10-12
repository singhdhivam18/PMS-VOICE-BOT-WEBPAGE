"""Read/write mappings for the existing PostgreSQL schema.

These models intentionally use managed=False: Django must not create, alter,
rename, or delete the existing production tables through migrations.
"""
from django.db import models
from django.db.models.expressions import RawSQL
from django.db.models.functions import Now


class Language(models.Model):
    id = models.SmallAutoField(primary_key=True)
    name = models.CharField(max_length=50, unique=True)
    code = models.CharField(max_length=5, unique=True)
    created_at = models.DateTimeField(db_default=Now(), editable=False)

    class Meta:
        managed = False
        db_table = "language"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.code})"


class Driver(models.Model):
    id = models.BigAutoField(primary_key=True)
    external_id = models.UUIDField(db_default=RawSQL("gen_random_uuid()", []), editable=False, unique=True)
    name = models.CharField(max_length=100)
    phone = models.CharField(max_length=20, unique=True)
    preferred_language = models.ForeignKey(
        Language, models.DO_NOTHING, db_column="preferred_language_id",
        related_name="drivers", db_constraint=False,
    )
    language_source = models.CharField(max_length=10, default="default")
    do_not_call = models.BooleanField(default=False)
    created_at = models.DateTimeField(db_default=Now(), editable=False)
    updated_at = models.DateTimeField(db_default=Now(), editable=False)

    class Meta:
        managed = False
        db_table = "driver"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.phone})"


class Vehicle(models.Model):
    id = models.BigAutoField(primary_key=True)
    external_id = models.UUIDField(db_default=RawSQL("gen_random_uuid()", []), editable=False)
    registration_no = models.CharField(max_length=20, unique=True)
    created_at = models.DateTimeField(db_default=Now(), editable=False)
    driver = models.ForeignKey(
        Driver, models.DO_NOTHING, db_column="driver_id", null=True, blank=True,
        related_name="vehicles", db_constraint=False,
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = "vehicle"
        ordering = ["registration_no"]

    def __str__(self):
        return self.registration_no


class VehicleService(models.Model):
    id = models.BigAutoField(primary_key=True)
    external_id = models.UUIDField(db_default=RawSQL("gen_random_uuid()", []), editable=False)
    vehicle = models.ForeignKey(
        Vehicle, models.DO_NOTHING, db_column="vehicle_id", related_name="services", db_constraint=False,
    )
    due_maintenance_date = models.DateField()
    maintenance_type = models.CharField(max_length=50)
    service_status = models.CharField(max_length=20, default="DUE")
    created_at = models.DateTimeField(db_default=Now(), editable=False)
    call_attempts = models.IntegerField(default=0)

    class Meta:
        managed = False
        db_table = "vehicle_service"
        ordering = ["due_maintenance_date"]


class VoiceBotCallJob(models.Model):
    id = models.BigAutoField(primary_key=True)
    external_id = models.UUIDField(db_default=RawSQL("gen_random_uuid()", []), editable=False)
    # The supplied DDL declares this column INTEGER while vehicle_service.id is BIGINT.
    # Keep it as IntegerField to mirror the physical schema exactly.
    service_id = models.IntegerField()
    correlation_id = models.UUIDField()
    job_status = models.CharField(max_length=30, default="PENDING")
    callback_received = models.BooleanField(default=False)
    created_at = models.DateTimeField(db_default=Now(), editable=False)
    updated_at = models.DateTimeField(db_default=Now(), editable=False)

    class Meta:
        managed = False
        db_table = "voice_bot_call_job"
        ordering = ["-created_at"]


class VoiceBotCallJobEvent(models.Model):
    id = models.BigAutoField(primary_key=True)
    job = models.ForeignKey(
        VoiceBotCallJob, models.DO_NOTHING, db_column="job_id", related_name="events", db_constraint=False,
    )
    event_status = models.CharField(max_length=20)
    system_message = models.CharField(max_length=500, null=True, blank=True)
    event_occurred_at = models.DateTimeField(db_default=Now(), editable=False)

    class Meta:
        managed = False
        db_table = "voice_bot_call_job_event"
        ordering = ["-event_occurred_at"]


class AppointmentRecord(models.Model):
    id = models.BigAutoField(primary_key=True)
    job = models.OneToOneField(
        VoiceBotCallJob, models.DO_NOTHING, db_column="job_id", related_name="appointment", db_constraint=False,
    )
    appointment_date = models.DateField()
    appointment_time = models.TimeField()
    vehicle_registration_no = models.CharField(max_length=50)
    depot = models.CharField(max_length=150, null=True, blank=True)
    created_at = models.DateTimeField(db_default=Now(), editable=False)
    updated_at = models.DateTimeField(db_default=Now(), editable=False)

    class Meta:
        managed = False
        db_table = "appointment_record"
        ordering = ["appointment_date", "appointment_time"]


class VoiceCallJobDocument(models.Model):
    id = models.BigAutoField(primary_key=True)
    job = models.ForeignKey(
        VoiceBotCallJob, models.DO_NOTHING, db_column="job_id", related_name="documents", db_constraint=False,
    )
    document_type = models.CharField(max_length=30)
    document_path = models.TextField()
    created_at = models.DateTimeField(db_default=Now(), editable=False)

    class Meta:
        managed = False
        db_table = "voice_call_job_document"
        ordering = ["-created_at"]
