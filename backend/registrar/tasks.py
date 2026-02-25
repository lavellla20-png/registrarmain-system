from celery import shared_task

from .services import auto_load_students


@shared_task(bind=True, max_retries=3, default_retry_delay=10)
def auto_load_students_task(self, student_ids, term_id):
    return auto_load_students(student_ids=student_ids, term_id=term_id)
