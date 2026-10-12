from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import (
    HealthView, DashboardView, LanguageViewSet, DriverViewSet, VehicleViewSet,
    VehicleServiceViewSet, VoiceBotCallJobViewSet, VoiceBotCallJobEventViewSet,
    AppointmentRecordViewSet, VoiceCallJobDocumentViewSet,
)

router = DefaultRouter()
router.register("languages", LanguageViewSet, basename="language")
router.register("drivers", DriverViewSet, basename="driver")
router.register("vehicles", VehicleViewSet, basename="vehicle")
router.register("vehicle-services", VehicleServiceViewSet, basename="vehicle-service")
router.register("call-jobs", VoiceBotCallJobViewSet, basename="call-job")
router.register("call-job-events", VoiceBotCallJobEventViewSet, basename="call-job-event")
router.register("appointments", AppointmentRecordViewSet, basename="appointment")
router.register("documents", VoiceCallJobDocumentViewSet, basename="document")

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("", include(router.urls)),
]
