from django.db import transaction

from .models import AcademicTerm, ProspectusEntry, Student, StudentLoad


def _has_passed_prerequisite(student, prerequisite_subject):
    if not prerequisite_subject:
        return True
    return StudentLoad.objects.filter(
        student=student,
        subject=prerequisite_subject,
        status__in=['passed', 'completed'],
    ).exists()


def _prospectus_entries_for_student(student, term, subject=None):
    base_qs = ProspectusEntry.objects.filter(
        program=student.program,
        year_level=student.year_level,
        semester=term.semester,
    )
    if subject is not None:
        base_qs = base_qs.filter(subject=subject)

    year = student.academic_year or ''
    section_id = student.section_id

    if year and section_id:
        qs = base_qs.filter(academic_year=year, section_id=section_id)
        if qs.exists():
            return qs
    if year:
        qs = base_qs.filter(academic_year=year, section__isnull=True)
        if qs.exists():
            return qs
    if section_id:
        qs = base_qs.filter(academic_year='', section_id=section_id)
        if qs.exists():
            return qs
    return base_qs.filter(academic_year='', section__isnull=True)


def get_eligible_subjects(student, term):
    entries = _prospectus_entries_for_student(student, term).select_related('subject', 'prerequisite')

    eligible = []
    for entry in entries:
        if _has_passed_prerequisite(student, entry.prerequisite):
            eligible.append(entry.subject)
    return eligible


def auto_load_students(student_ids, term_id):
    created = 0
    with transaction.atomic():
        term = AcademicTerm.objects.get(pk=term_id)
        students = Student.objects.filter(student_id__in=student_ids, is_active=True).select_related('program')
        for student in students:
            subjects = get_eligible_subjects(student, term)
            for subject in subjects:
                _, was_created = StudentLoad.objects.get_or_create(
                    student=student,
                    term_id=term_id,
                    subject=subject,
                    defaults={'status': 'enrolled'},
                )
                if was_created:
                    created += 1
    return {'created_load_rows': created}
