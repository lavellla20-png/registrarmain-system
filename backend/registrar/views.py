from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from .models import AcademicTerm, AuditLog, Department, Program, ProspectusEntry, Section, Student, StudentLoad, Subject
from .permissions import IsRegistrarOrStaff
from .serializers import (
    AcademicTermSerializer,
    AuditLogSerializer,
    DepartmentSerializer,
    ProgramSerializer,
    ProspectusEntrySerializer,
    SectionSerializer,
    StudentDetailSerializer,
    StudentLoadSerializer,
    StudentSerializer,
    SubjectSerializer,
)
from .services import auto_load_students, get_eligible_subjects
from .tasks import auto_load_students_task


class BaseRegistrarViewSet(ModelViewSet):
    permission_classes = [IsRegistrarOrStaff]

    def _write_audit_log(self, action_name, instance, payload):
        if not getattr(self.request, 'user', None) or not self.request.user.is_authenticated:
            return
        AuditLog.objects.create(
            actor=self.request.user,
            action=action_name,
            entity=instance.__class__.__name__,
            entity_id=str(instance.pk),
            payload=payload or {},
        )

    def perform_create(self, serializer):
        instance = serializer.save()
        self._write_audit_log('create', instance, self.request.data)

    def perform_update(self, serializer):
        instance = serializer.save()
        self._write_audit_log('update', instance, self.request.data)

    def perform_destroy(self, instance):
        instance.delete()
        self._write_audit_log('delete', instance, {})


class DepartmentViewSet(BaseRegistrarViewSet):
    queryset = Department.objects.all().order_by('name')
    serializer_class = DepartmentSerializer


class ProgramViewSet(BaseRegistrarViewSet):
    queryset = Program.objects.select_related('department').all().order_by('name', 'id')
    serializer_class = ProgramSerializer


class AcademicTermViewSet(BaseRegistrarViewSet):
    queryset = AcademicTerm.objects.all().order_by('-year_label', 'semester')
    serializer_class = AcademicTermSerializer


class SectionViewSet(BaseRegistrarViewSet):
    queryset = Section.objects.select_related('program').all().order_by('name', 'program_id', 'year_level', 'semester', 'id')
    serializer_class = SectionSerializer


class SubjectViewSet(BaseRegistrarViewSet):
    queryset = Subject.objects.all().order_by('code')
    serializer_class = SubjectSerializer


class ProspectusViewSet(BaseRegistrarViewSet):
    queryset = ProspectusEntry.objects.select_related('program', 'subject', 'prerequisite').all()
    serializer_class = ProspectusEntrySerializer


class StudentViewSet(BaseRegistrarViewSet):
    queryset = Student.objects.select_related('program', 'section').prefetch_related('loads').filter(is_active=True)
    serializer_class = StudentSerializer
    lookup_field = 'student_id'

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return StudentDetailSerializer
        return StudentSerializer

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active', 'updated_at'])
        self._write_audit_log('soft_delete', instance, {'is_active': False})

    @action(detail=True, methods=['get'], url_path='auto-load-preview')
    def auto_load_preview(self, request, student_id=None):
        term_id = request.query_params.get('term_id')
        if not term_id:
            return Response({'detail': 'term_id query parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            term = AcademicTerm.objects.get(pk=term_id)
        except AcademicTerm.DoesNotExist:
            return Response({'detail': 'Specified term does not exist.'}, status=status.HTTP_400_BAD_REQUEST)

        student = self.get_object()
        subjects = get_eligible_subjects(student, term)
        return Response({'subjects': SubjectSerializer(subjects, many=True).data}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='auto-load')
    def auto_load(self, request, student_id=None):
        term_id = request.data.get('term_id')
        if not term_id:
            return Response({'detail': 'term_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        student = self.get_object()
        result = auto_load_students([student.student_id], term_id)
        self._write_audit_log('auto_load', student, {'term_id': term_id, 'result': result})
        return Response(result, status=status.HTTP_200_OK)


class StudentLoadViewSet(BaseRegistrarViewSet):
    queryset = StudentLoad.objects.select_related('student', 'term', 'subject').all()
    serializer_class = StudentLoadSerializer


class ContinuingViewSet(BaseRegistrarViewSet):
    queryset = Student.objects.none()
    serializer_class = StudentSerializer

    @action(detail=False, methods=['post'], url_path='promote')
    def promote(self, request):
        student_ids = request.data.get('student_ids', [])
        target_year_level = request.data.get('target_year_level')
        term_id = request.data.get('term_id')

        if not student_ids or not target_year_level or not term_id:
            return Response({'detail': 'student_ids, target_year_level, and term_id are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            term = AcademicTerm.objects.get(pk=term_id)
        except AcademicTerm.DoesNotExist:
            return Response({'detail': 'Specified term does not exist.'}, status=status.HTTP_400_BAD_REQUEST)

        if not term.is_active:
            return Response({'detail': 'Promotion is only allowed for the active term.'}, status=status.HTTP_400_BAD_REQUEST)

        students = Student.objects.filter(student_id__in=student_ids, is_active=True)
        students.update(year_level=target_year_level)

        job_result = None
        try:
            auto_load_students_task.delay(student_ids, term_id)
            mode = 'queued'
        except Exception:
            job_result = auto_load_students(student_ids, term_id)
            mode = 'sync_fallback'

        for student in students:
            self._write_audit_log(
                'promote',
                student,
                {'target_year_level': target_year_level, 'term_id': term_id, 'mode': mode},
            )

        return Response(
            {
                'detail': f'Promoted {students.count()} students.',
                'auto_load_mode': mode,
                'auto_load_result': job_result,
            },
            status=status.HTTP_200_OK,
        )


class AuditLogViewSet(ReadOnlyModelViewSet):
    permission_classes = [IsRegistrarOrStaff]
    queryset = AuditLog.objects.select_related('actor').all().order_by('-created_at')
    serializer_class = AuditLogSerializer
