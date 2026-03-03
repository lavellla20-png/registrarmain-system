from datetime import date

from django.db import transaction
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from .models import AcademicHistory, AcademicTerm, AuditLog, Department, Program, ProspectusEntry, Section, Student, StudentLoad, Subject
from .permissions import IsRegistrarOrStaff
from .serializers import (
    AcademicHistorySerializer,
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

    @action(detail=False, methods=['post'], url_path='copy-section')
    def copy_section(self, request):
        required_fields = ['program', 'year_level', 'semester', 'academic_year', 'source_section', 'target_section']
        missing = [field for field in required_fields if request.data.get(field) in [None, '']]
        if missing:
            return Response(
                {'detail': f"Missing required fields: {', '.join(missing)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            program_id = int(request.data['program'])
            year_level = int(request.data['year_level'])
            semester = int(request.data['semester'])
            source_section_id = int(request.data['source_section'])
            target_section_id = int(request.data['target_section'])
        except (TypeError, ValueError):
            return Response({'detail': 'Invalid numeric value in request payload.'}, status=status.HTTP_400_BAD_REQUEST)

        academic_year = str(request.data['academic_year']).strip()
        if not academic_year:
            return Response({'detail': 'academic_year cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)

        if source_section_id == target_section_id:
            return Response({'detail': 'Source and target sections must be different.'}, status=status.HTTP_400_BAD_REQUEST)

        source_entries = ProspectusEntry.objects.filter(
            program_id=program_id,
            year_level=year_level,
            semester=semester,
            academic_year=academic_year,
            section_id=source_section_id,
        ).values('subject_id', 'prerequisite_id')

        if not source_entries.exists():
            return Response({'detail': 'No source prospectus entries found for the provided filters.'}, status=status.HTTP_400_BAD_REQUEST)

        created = 0
        skipped = 0
        with transaction.atomic():
            for entry in source_entries:
                _, was_created = ProspectusEntry.objects.get_or_create(
                    program_id=program_id,
                    subject_id=entry['subject_id'],
                    year_level=year_level,
                    semester=semester,
                    academic_year=academic_year,
                    section_id=target_section_id,
                    defaults={'prerequisite_id': entry['prerequisite_id']},
                )
                if was_created:
                    created += 1
                else:
                    skipped += 1

        if getattr(request, 'user', None) and request.user.is_authenticated:
            AuditLog.objects.create(
                actor=request.user,
                action='copy_section',
                entity='ProspectusEntry',
                entity_id='bulk-copy',
                payload={
                    'program': program_id,
                    'year_level': year_level,
                    'semester': semester,
                    'academic_year': academic_year,
                    'source_section': source_section_id,
                    'target_section': target_section_id,
                    'created': created,
                    'skipped': skipped,
                },
            )
        return Response(
            {'detail': 'Section prospectus copy completed.', 'created': created, 'skipped': skipped},
            status=status.HTTP_200_OK,
        )


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


class AcademicHistoryViewSet(BaseRegistrarViewSet):
    queryset = AcademicHistory.objects.select_related('student', 'program', 'section').all()
    serializer_class = AcademicHistorySerializer


class ContinuingViewSet(BaseRegistrarViewSet):
    queryset = Student.objects.none()
    serializer_class = StudentSerializer

    @action(detail=False, methods=['post'], url_path='promote')
    def promote(self, request):
        student_ids = request.data.get('student_ids', [])
        target_year_level = request.data.get('target_year_level')
        target_academic_year = request.data.get('target_academic_year')
        target_semester = request.data.get('target_semester')
        target_program = request.data.get('target_program')
        target_section = request.data.get('target_section', None)
        subject_load_schedule = request.data.get('subject_load_schedule', '')
        adviser_name = request.data.get('adviser_name', '')
        dean_name = request.data.get('dean_name', '')
        term_id = request.data.get('term_id')

        if not student_ids:
            return Response({'detail': 'student_ids are required.'}, status=status.HTTP_400_BAD_REQUEST)

        required_fields = [target_year_level, target_academic_year, target_semester, target_program]
        if any(field in [None, ''] for field in required_fields):
            return Response(
                {'detail': 'target_year_level, target_academic_year, target_semester, and target_program are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        term = None
        if term_id:
            try:
                term = AcademicTerm.objects.get(pk=term_id)
            except AcademicTerm.DoesNotExist:
                return Response({'detail': 'Specified term does not exist.'}, status=status.HTTP_400_BAD_REQUEST)

            if not term.is_active:
                return Response({'detail': 'Promotion is only allowed for the active term.'}, status=status.HTTP_400_BAD_REQUEST)

        students = Student.objects.select_related('program', 'section').filter(student_id__in=student_ids, is_active=True)
        if not students.exists():
            return Response({'detail': 'No active students found for the provided student_ids.'}, status=status.HTTP_400_BAD_REQUEST)

        today = date.today()
        processed_student_ids = []

        with transaction.atomic():
            for student in students.select_for_update():
                current_semester = student.semester or 1
                current_academic_year = student.academic_year or target_academic_year

                # Save previous semester snapshot before mutating the Student row.
                AcademicHistory.objects.update_or_create(
                    student=student,
                    academic_year=current_academic_year,
                    semester=current_semester,
                    defaults={
                        'year_level': student.year_level,
                        'program': student.program,
                        'section': student.section,
                        'first_name': student.first_name,
                        'last_name': student.last_name,
                        'middle_name': student.middle_name,
                        'extension_name': student.extension_name,
                        'gender': student.gender,
                        'sex': student.sex,
                        'date_of_birth': student.date_of_birth,
                        'age': student.age,
                        'civil_status': student.civil_status,
                        'nationality': student.nationality,
                        'admission_date': student.admission_date,
                        'scholarship': student.scholarship,
                        'course': student.course,
                        'home_address': student.home_address,
                        'postal_code': student.postal_code,
                        'email_address': student.email_address,
                        'contact_number': student.contact_number,
                        'mother_maiden_name': student.mother_maiden_name,
                        'mother_contact_number': student.mother_contact_number,
                        'father_name': student.father_name,
                        'father_contact_number': student.father_contact_number,
                        'elementary_school': student.elementary_school,
                        'junior_high_school': student.junior_high_school,
                        'senior_high_school': student.senior_high_school,
                        'senior_high_track_strand': student.senior_high_track_strand,
                        'subject_load_schedule': student.subject_load_schedule,
                        'adviser_name': student.adviser_name,
                        'adviser_approval_status': student.adviser_approval_status,
                        'dean_name': student.dean_name,
                        'dean_approval_status': student.dean_approval_status,
                        'status': 'completed',
                        'start_date': student.admission_date or today,
                        'end_date': today,
                    },
                )

                student.program_id = int(target_program)
                student.year_level = int(target_year_level)
                student.academic_year = target_academic_year
                student.semester = int(target_semester)
                student.section_id = int(target_section) if target_section not in [None, ''] else None
                student.subject_load_schedule = subject_load_schedule
                student.adviser_name = adviser_name
                student.adviser_approval_status = 'pending'
                student.dean_name = dean_name
                student.dean_approval_status = 'pending'
                student.save()

                # Keep an up-to-date record for the target semester as ongoing.
                AcademicHistory.objects.update_or_create(
                    student=student,
                    academic_year=student.academic_year,
                    semester=student.semester,
                    defaults={
                        'year_level': student.year_level,
                        'program': student.program,
                        'section': student.section,
                        'first_name': student.first_name,
                        'last_name': student.last_name,
                        'middle_name': student.middle_name,
                        'extension_name': student.extension_name,
                        'gender': student.gender,
                        'sex': student.sex,
                        'date_of_birth': student.date_of_birth,
                        'age': student.age,
                        'civil_status': student.civil_status,
                        'nationality': student.nationality,
                        'admission_date': student.admission_date,
                        'scholarship': student.scholarship,
                        'course': student.course,
                        'home_address': student.home_address,
                        'postal_code': student.postal_code,
                        'email_address': student.email_address,
                        'contact_number': student.contact_number,
                        'mother_maiden_name': student.mother_maiden_name,
                        'mother_contact_number': student.mother_contact_number,
                        'father_name': student.father_name,
                        'father_contact_number': student.father_contact_number,
                        'elementary_school': student.elementary_school,
                        'junior_high_school': student.junior_high_school,
                        'senior_high_school': student.senior_high_school,
                        'senior_high_track_strand': student.senior_high_track_strand,
                        'subject_load_schedule': student.subject_load_schedule,
                        'adviser_name': student.adviser_name,
                        'adviser_approval_status': student.adviser_approval_status,
                        'dean_name': student.dean_name,
                        'dean_approval_status': student.dean_approval_status,
                        'status': 'ongoing',
                        'start_date': today,
                        'end_date': None,
                    },
                )

                self._write_audit_log(
                    'promote',
                    student,
                    {
                        'target_year_level': target_year_level,
                        'target_academic_year': target_academic_year,
                        'target_semester': target_semester,
                        'target_program': target_program,
                        'target_section': target_section,
                        'term_id': term_id,
                    },
                )
                processed_student_ids.append(student.student_id)

        job_result = None
        mode = 'skipped'
        if term:
            try:
                auto_load_students_task.delay(processed_student_ids, term.id)
                mode = 'queued'
            except Exception:
                job_result = auto_load_students(processed_student_ids, term.id)
                mode = 'sync_fallback'

        return Response(
            {
                'detail': f'Processed {len(processed_student_ids)} students with academic history tracking.',
                'auto_load_mode': mode,
                'auto_load_result': job_result,
                'processed_student_ids': processed_student_ids,
            },
            status=status.HTTP_200_OK,
        )


class AuditLogViewSet(ReadOnlyModelViewSet):
    permission_classes = [IsRegistrarOrStaff]
    queryset = AuditLog.objects.select_related('actor').all().order_by('-created_at')
    serializer_class = AuditLogSerializer
