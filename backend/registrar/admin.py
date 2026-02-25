from django.contrib import admin

from .models import AcademicTerm, AuditLog, Department, Program, ProspectusEntry, Section, Student, StudentLoad, Subject

admin.site.register(Department)
admin.site.register(Program)
admin.site.register(AcademicTerm)
admin.site.register(Section)
admin.site.register(Subject)
admin.site.register(ProspectusEntry)
admin.site.register(Student)
admin.site.register(StudentLoad)
admin.site.register(AuditLog)
