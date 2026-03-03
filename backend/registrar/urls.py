from rest_framework.routers import DefaultRouter

from .views import (
    AcademicHistoryViewSet,
    AcademicTermViewSet,
    AuditLogViewSet,
    ContinuingViewSet,
    DepartmentViewSet,
    ProgramViewSet,
    ProspectusViewSet,
    SectionViewSet,
    StudentLoadViewSet,
    StudentViewSet,
    SubjectViewSet,
)

router = DefaultRouter()
router.register('departments', DepartmentViewSet, basename='departments')
router.register('programs', ProgramViewSet, basename='programs')
router.register('terms', AcademicTermViewSet, basename='terms')
router.register('sections', SectionViewSet, basename='sections')
router.register('subjects', SubjectViewSet, basename='subjects')
router.register('prospectus', ProspectusViewSet, basename='prospectus')
router.register('students', StudentViewSet, basename='students')
router.register('student-loads', StudentLoadViewSet, basename='student-loads')
router.register('academic-history', AcademicHistoryViewSet, basename='academic-history')
router.register('continuing', ContinuingViewSet, basename='continuing')
router.register('audit-logs', AuditLogViewSet, basename='audit-logs')

urlpatterns = router.urls
