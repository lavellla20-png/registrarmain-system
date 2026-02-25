from rest_framework import serializers

from .models import AcademicTerm, AuditLog, Department, Program, ProspectusEntry, Section, Student, StudentLoad, Subject
from .services import _prospectus_entries_for_student


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = '__all__'


class ProgramSerializer(serializers.ModelSerializer):
    class Meta:
        model = Program
        fields = '__all__'


class AcademicTermSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicTerm
        fields = '__all__'


class SectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Section
        fields = '__all__'


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = '__all__'


class ProspectusEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProspectusEntry
        fields = '__all__'


class StudentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Student
        fields = '__all__'


class StudentLoadSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentLoad
        fields = '__all__'

    def validate(self, attrs):
        student = attrs.get('student') or getattr(self.instance, 'student', None)
        term = attrs.get('term') or getattr(self.instance, 'term', None)
        subject = attrs.get('subject') or getattr(self.instance, 'subject', None)

        if not student or not term or not subject:
            return attrs

        if not term.is_active:
            raise serializers.ValidationError('Loads can only be created or updated for the active term.')

        prospectus_entry = _prospectus_entries_for_student(student, term, subject=subject).select_related('prerequisite').first()
        if not prospectus_entry:
            raise serializers.ValidationError('Selected subject is not available in student prospectus mapping for this term.')

        prerequisite = prospectus_entry.prerequisite
        if prerequisite:
            passed = StudentLoad.objects.filter(
                student=student,
                subject=prerequisite,
                status__in=['passed', 'completed'],
            ).exists()
            if not passed:
                raise serializers.ValidationError(
                    f'Prerequisite not satisfied. Complete {prerequisite.code} before enrolling this subject.'
                )

        return attrs


class StudentDetailSerializer(serializers.ModelSerializer):
    loads = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = '__all__'

    def get_loads(self, obj):
        load_qs = obj.loads.select_related('subject', 'term').all().order_by('-term__year_label', 'subject__code')
        result = []
        for load in load_qs:
            result.append(
                {
                    'id': load.id,
                    'status': load.status,
                    'term_id': load.term_id,
                    'term_label': f'{load.term.year_label} - Sem {load.term.semester}',
                    'subject_id': load.subject_id,
                    'subject_code': load.subject.code,
                    'subject_title': load.subject.title,
                }
            )
        return result


class AuditLogSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source='actor.username', read_only=True)

    class Meta:
        model = AuditLog
        fields = '__all__'
