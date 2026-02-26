import { FormEvent, useEffect, useMemo, useState } from 'react'

import { api, getErrorMessage } from '../api'

type Subject = {
  id: number
  code: string
  title: string
  units: string
}

type AcademicTerm = {
  id: number
  year_label: string
  semester: number
  is_active: boolean
}

type ProspectusEntry = {
  id: number
  program: number
  subject: number
  year_level: number
  semester: number
  academic_year: string
  section: number | null
  prerequisite: number | null
}

type Program = {
  id: number
  code: string
  name: string
  program_adviser: string
  school_dean: string
}

type Section = {
  id: number
  name: string
  program: number
  year_level: number
  semester: number
}

type StudentLoad = {
  id: number
  status: string
  term_id: number
  term_label: string
  subject_id: number
  subject_code: string
  subject_title: string
}

type StudentDetail = {
  id: number
  student_id: string
  first_name: string
  last_name: string
  middle_name: string
  extension_name: string
  gender: string
  sex: string
  date_of_birth: string | null
  age: number | null
  civil_status: string
  nationality: string
  admission_date: string | null
  scholarship: string
  course: string
  program: number
  section: number | null
  year_level: number
  academic_year: string
  semester: number | null
  home_address: string
  postal_code: string
  email_address: string
  contact_number: string
  mother_maiden_name: string
  mother_contact_number: string
  father_name: string
  father_contact_number: string
  elementary_school: string
  junior_high_school: string
  senior_high_school: string
  senior_high_track_strand: string
  subject_load_schedule: string
  adviser_name: string
  adviser_approval_status: string
  dean_name: string
  dean_approval_status: string
  loads: StudentLoad[]
}

type PreviewResponse = {
  subjects: Subject[]
}

type StudentCreateForm = {
  student_id: string
  last_name: string
  first_name: string
  middle_name: string
  extension_name: string
  gender: string
  date_of_birth: string
  civil_status: string
  nationality: string
  admission_date: string
  scholarship: string
  program: string
  section: string
  year_level: string
  academic_year: string
  semester: string
  home_address: string
  postal_code: string
  email_address: string
  contact_number: string
  mother_maiden_name: string
  mother_contact_number: string
  father_name: string
  father_contact_number: string
  elementary_school: string
  junior_high_school: string
  senior_high_school: string
  senior_high_track_strand: string
  subject_load_schedule: string
  adviser_name: string
  adviser_approval_status: string
  dean_name: string
  dean_approval_status: string
}

type ScheduleRow = {
  mwfTime: string
  mwfSubject: string
  mwfSubjectTitle?: string
  mwfUnits: string
  tthTime: string
  tthSubject: string
  tthUnits: string
  tthSaturdayHeader?: boolean
}

const MWF_SLOTS = ['7:00-8:00', '8:01-9:00', '9:01-10:00', '10:01-11:00', '11:01-12:00', '1:01-2:00', '2:01-3:00', '3:01-4:00', '4:01-5:00', '5:30-6:30']
const TTH_SLOTS = ['7:00-8:30', '8:31-10:00', '10:01-11:30', '1:00-2:30', '2:31-4:00', '4:01-5:30', '5:31-7:00', '7:01-8:30', 'SATURDAY_HEADER', '', '', '']

const initialStudentForm: StudentCreateForm = {
  student_id: '',
  last_name: '',
  first_name: '',
  middle_name: '',
  extension_name: '',
  gender: '',
  date_of_birth: '',
  civil_status: '',
  nationality: 'Filipino',
  admission_date: '',
  scholarship: '',
  program: '',
  section: '',
  year_level: '1',
  academic_year: '',
  semester: '1',
  home_address: '',
  postal_code: '',
  email_address: '',
  contact_number: '',
  mother_maiden_name: '',
  mother_contact_number: 'n/a',
  father_name: '',
  father_contact_number: 'n/a',
  elementary_school: '',
  junior_high_school: '',
  senior_high_school: '',
  senior_high_track_strand: '',
  subject_load_schedule: '',
  adviser_name: '',
  adviser_approval_status: 'pending',
  dean_name: '',
  dean_approval_status: 'pending',
}

const nullableNumber = (value: string): number | null => (value ? Number(value) : null)

const calculateAgeFromDob = (dob: string): number | null => {
  if (!dob) return null
  const birthDate = new Date(dob)
  if (Number.isNaN(birthDate.getTime())) return null

  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  const dayDiff = today.getDate() - birthDate.getDate()

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1
  }
  return age >= 0 ? age : null
}

const buildInitialScheduleRows = (): ScheduleRow[] => {
  const totalRows = Math.max(MWF_SLOTS.length, TTH_SLOTS.length)
  return Array.from({ length: totalRows }, (_, index) => {
    const tthSlot = TTH_SLOTS[index] ?? ''
    const isSaturdayHeader = tthSlot === 'SATURDAY_HEADER'
    return {
      mwfTime: MWF_SLOTS[index] ?? '',
      mwfSubject: '',
      mwfUnits: '',
      tthTime: isSaturdayHeader ? 'TIME' : tthSlot,
      tthSubject: isSaturdayHeader ? 'SATURDAY' : '',
      tthUnits: '',
      tthSaturdayHeader: isSaturdayHeader,
    }
  })
}

const buildScheduleRowsFromProspectus = (
  entries: ProspectusEntry[],
  subjectMap: Map<number, Subject>,
  sectionLabel: string,
): ScheduleRow[] => {
  const minRows = Math.max(MWF_SLOTS.length, TTH_SLOTS.length)
  const rowCount = Math.max(minRows, entries.length)
  return Array.from({ length: rowCount }, (_, index) => {
    const tthSlot = TTH_SLOTS[index] ?? ''
    const isSaturdayHeader = tthSlot === 'SATURDAY_HEADER'
    const entry = entries[index]
    const subject = entry ? subjectMap.get(entry.subject) : null
    const mwfSubjectLabel = subject
      ? `${subject.code} ${subject.title}${sectionLabel ? ` - ${sectionLabel}` : ''}`
      : ''
    return {
      mwfTime: MWF_SLOTS[index] ?? '',
      mwfSubject: mwfSubjectLabel,
      mwfUnits: subject ? String(subject.units) : '',
      tthTime: isSaturdayHeader ? 'TIME' : tthSlot,
      tthSubject: isSaturdayHeader ? 'SATURDAY' : '',
      tthUnits: '',
      tthSaturdayHeader: isSaturdayHeader,
    }
  })
}

const buildAcademicYearOptions = () => {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: 21 }, (_, i) => {
    const start = currentYear - 10 + i
    return `${start}-${start + 1}`
  })
}

export function EnrollmentPage() {
  const [searchId, setSearchId] = useState('')
  const [student, setStudent] = useState<StudentDetail | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [terms, setTerms] = useState<AcademicTerm[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [prospectusEntries, setProspectusEntries] = useState<ProspectusEntry[]>([])
  const [previewSubjects, setPreviewSubjects] = useState<Subject[]>([])

  const [studentForm, setStudentForm] = useState<StudentCreateForm>(initialStudentForm)
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>(buildInitialScheduleRows)
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false)

  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedTerm, setSelectedTerm] = useState('')
  const [statusValue, setStatusValue] = useState('enrolled')

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const computedAge = calculateAgeFromDob(studentForm.date_of_birth)
  const academicYearOptions = useMemo(buildAcademicYearOptions, [])

  const loadReferenceData = async () => {
    const [subjectResp, termResp, programResp, sectionResp, prospectusResp] = await Promise.all([
      api.get<Subject[]>('/subjects/'),
      api.get<AcademicTerm[]>('/terms/'),
      api.get<Program[]>('/programs/'),
      api.get<Section[]>('/sections/'),
      api.get<ProspectusEntry[]>('/prospectus/'),
    ])
    setSubjects(subjectResp.data)
    setTerms(termResp.data)
    setPrograms(programResp.data)
    setSections(sectionResp.data)
    setProspectusEntries(prospectusResp.data)

    const activeTerm = termResp.data.find((term) => term.is_active)
    if (activeTerm) {
      setSelectedTerm(String(activeTerm.id))
      setStudentForm((prev) => ({ ...prev, semester: String(activeTerm.semester), academic_year: activeTerm.year_label }))
    }
  }

  useEffect(() => {
    loadReferenceData().catch((err) => setError(getErrorMessage(err)))
  }, [])

  const refreshStudent = async (studentId: string) => {
    const studentResp = await api.get<StudentDetail>(`/students/${studentId}/`)
    setStudent(studentResp.data)
  }

  const searchStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    setPreviewSubjects([])
    try {
      await refreshStudent(searchId)
    } catch (err) {
      setStudent(null)
      setError(getErrorMessage(err))
    }
  }

  const onStudentFieldChange = (field: keyof StudentCreateForm, value: string) => {
    setStudentForm((prev) => ({ ...prev, [field]: value }))
  }

  const onProgramChange = (programId: string) => {
    const selected = programs.find((program) => String(program.id) === programId)
    setStudentForm((prev) => ({
      ...prev,
      program: programId,
      section: '',
      adviser_name: selected?.program_adviser || '',
      dean_name: selected?.school_dean || '',
    }))
  }

  const onScheduleRowChange = (index: number, key: keyof ScheduleRow, value: string) => {
    setScheduleRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)))
  }

  const subjectMap = useMemo(() => {
    const map = new Map<number, Subject>()
    subjects.forEach((subject) => map.set(subject.id, subject))
    return map
  }, [subjects])

  useEffect(() => {
    const { program, year_level, semester, academic_year, section } = studentForm
    if (!program || !year_level || !semester || !academic_year || !section) {
      setScheduleRows(buildInitialScheduleRows())
      return
    }

    const exactMatched = prospectusEntries
      .filter(
        (entry) =>
          entry.program === Number(program) &&
          entry.year_level === Number(year_level) &&
          entry.semester === Number(semester) &&
          entry.academic_year === academic_year &&
          entry.section === Number(section),
      )
      .sort((a, b) => a.id - b.id)
    const matched =
      exactMatched.length > 0
        ? exactMatched
        : prospectusEntries
            .filter(
              (entry) =>
                entry.program === Number(program) &&
                entry.year_level === Number(year_level) &&
                entry.semester === Number(semester) &&
                entry.academic_year === '' &&
                entry.section === null,
            )
            .sort((a, b) => a.id - b.id)

    const selectedSection = sections.find((item) => item.id === Number(section))
    const sectionLabel = selectedSection?.name || ''
    setScheduleRows(buildScheduleRowsFromProspectus(matched, subjectMap, sectionLabel))
  }, [studentForm.program, studentForm.year_level, studentForm.semester, studentForm.academic_year, studentForm.section, prospectusEntries, sections, subjectMap])

  const closeEnrollModal = () => {
    setIsEnrollModalOpen(false)
    setStudentForm(initialStudentForm)
    setScheduleRows(buildInitialScheduleRows())
  }

  const createStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    try {
      const scheduleText = scheduleRows
        .map((row) => `MWF ${row.mwfTime}: ${row.mwfSubject} (${row.mwfUnits}) | TTH ${row.tthTime}: ${row.tthSubject} (${row.tthUnits})`)
        .join('\n')

      await api.post('/students/', {
        student_id: studentForm.student_id,
        last_name: studentForm.last_name,
        first_name: studentForm.first_name,
        middle_name: studentForm.middle_name,
        extension_name: studentForm.extension_name,
        gender: studentForm.gender,
        date_of_birth: studentForm.date_of_birth || null,
        age: computedAge,
        civil_status: studentForm.civil_status,
        nationality: studentForm.nationality,
        admission_date: studentForm.admission_date || null,
        scholarship: studentForm.scholarship,
        program: Number(studentForm.program),
        section: nullableNumber(studentForm.section),
        year_level: Number(studentForm.year_level),
        academic_year: studentForm.academic_year,
        semester: nullableNumber(studentForm.semester),
        home_address: studentForm.home_address,
        postal_code: studentForm.postal_code,
        email_address: studentForm.email_address,
        contact_number: studentForm.contact_number,
        mother_maiden_name: studentForm.mother_maiden_name,
        mother_contact_number: studentForm.mother_contact_number,
        father_name: studentForm.father_name,
        father_contact_number: studentForm.father_contact_number,
        elementary_school: studentForm.elementary_school,
        junior_high_school: studentForm.junior_high_school,
        senior_high_school: studentForm.senior_high_school,
        senior_high_track_strand: studentForm.senior_high_track_strand,
        subject_load_schedule: scheduleText,
        adviser_name: studentForm.adviser_name,
        adviser_approval_status: studentForm.adviser_approval_status,
        dean_name: studentForm.dean_name,
        dean_approval_status: studentForm.dean_approval_status,
        is_active: true,
      })

      setSearchId(studentForm.student_id)
      await refreshStudent(studentForm.student_id)
      closeEnrollModal()
      setSuccess('Student successfully registered/enrolled.')
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  const saveLoad = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (!student) {
      setError('Search for a student first.')
      return
    }

    try {
      await api.post('/student-loads/', {
        student: student.id,
        term: Number(selectedTerm),
        subject: Number(selectedSubject),
        status: statusValue,
      })
      await refreshStudent(student.student_id)
      setSuccess('Student load saved.')
      setSelectedSubject('')
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  const previewAutoLoad = async () => {
    if (!student) {
      setError('Search for a student first.')
      return
    }
    if (!selectedTerm) {
      setError('Select term for preview.')
      return
    }

    setError('')
    setSuccess('')
    try {
      const response = await api.get<PreviewResponse>(`/students/${student.student_id}/auto-load-preview/`, {
        params: { term_id: Number(selectedTerm) },
      })
      setPreviewSubjects(response.data.subjects)
      setSuccess(`Preview loaded ${response.data.subjects.length} subjects.`)
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  const triggerAutoLoad = async () => {
    if (!student) {
      setError('Search for a student first.')
      return
    }
    if (!selectedTerm) {
      setError('Select term for auto-load.')
      return
    }

    setError('')
    setSuccess('')
    try {
      const response = await api.post<{ created_load_rows: number }>(`/students/${student.student_id}/auto-load/`, {
        term_id: Number(selectedTerm),
      })
      await refreshStudent(student.student_id)
      setSuccess(`Auto-load created ${response.data.created_load_rows} load rows.`)
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  const filteredSections = studentForm.program
    ? sections.filter(
        (s) =>
          s.program === Number(studentForm.program) &&
          s.year_level === Number(studentForm.year_level) &&
          s.semester === Number(studentForm.semester)
      )
    : sections

  return (
    <section className="card">
      <h1>Enrollment Module</h1>
      <p>Register students, search profiles, and manage subject loads.</p>

      {error && <p className="error-text">{error}</p>}
      {success && <p className="success-text">{success}</p>}

      <div className="enroll-actions">
        <button type="button" onClick={() => setIsEnrollModalOpen(true)}>
          Enroll Student
        </button>
      </div>

      {isEnrollModalOpen && (
        <div className="enroll-modal-overlay" onClick={closeEnrollModal}>
          <div className="enroll-modal" onClick={(e) => e.stopPropagation()}>
            <div className="enroll-modal-header">
              <h2>Enrollment Form</h2>
              <button type="button" onClick={closeEnrollModal}>
                Close
              </button>
            </div>

            <form onSubmit={createStudent} className="enroll-sheet-form">
              <div className="sheet-section-title">Student Information</div>
              <div className="sheet-grid">
                <input placeholder="Last Name" value={studentForm.last_name} onChange={(e) => onStudentFieldChange('last_name', e.target.value)} required />
                <input placeholder="First Name" value={studentForm.first_name} onChange={(e) => onStudentFieldChange('first_name', e.target.value)} required />
                <input placeholder="Middle Name" value={studentForm.middle_name} onChange={(e) => onStudentFieldChange('middle_name', e.target.value)} />
                <input placeholder="Name Ext." value={studentForm.extension_name} onChange={(e) => onStudentFieldChange('extension_name', e.target.value)} />
                <select value={studentForm.gender} onChange={(e) => onStudentFieldChange('gender', e.target.value)}>
                  <option value="">Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
                <div className="field-inline-label">
                  <span>Date of Birth</span>
                  <input type="date" value={studentForm.date_of_birth} onChange={(e) => onStudentFieldChange('date_of_birth', e.target.value)} />
                </div>
                <input placeholder="Age (Auto)" value={computedAge ?? ''} readOnly />
                <select value={studentForm.civil_status} onChange={(e) => onStudentFieldChange('civil_status', e.target.value)}>
                  <option value="">Status</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Separated">Separated</option>
                  <option value="Widowed">Widowed</option>
                  <option value="Annulled">Annulled</option>
                  <option value="Divorced">Divorced</option>
                </select>
                <input placeholder="ID Number" value={studentForm.student_id} onChange={(e) => onStudentFieldChange('student_id', e.target.value)} required />
                <select value={studentForm.program} onChange={(e) => onProgramChange(e.target.value)} required>
                  <option value="">Program</option>
                  {programs.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.name}
                    </option>
                  ))}
                </select>
                <select value={studentForm.year_level} onChange={(e) => onStudentFieldChange('year_level', e.target.value)}>
                  <option value="1">Year 1</option>
                  <option value="2">Year 2</option>
                  <option value="3">Year 3</option>
                  <option value="4">Year 4</option>
                </select>
                <select value={studentForm.academic_year} onChange={(e) => onStudentFieldChange('academic_year', e.target.value)}>
                  <option value="">Academic Year</option>
                  {academicYearOptions.map((yearLabel) => (
                    <option key={yearLabel} value={yearLabel}>
                      {yearLabel}
                    </option>
                  ))}
                </select>
                <select value={studentForm.semester} onChange={(e) => onStudentFieldChange('semester', e.target.value)}>
                  <option value="1">1st Semester</option>
                  <option value="2">2nd Semester</option>
                  <option value="3">Summer</option>
                </select>
                <select value={studentForm.section} onChange={(e) => onStudentFieldChange('section', e.target.value)}>
                  <option value="">Section</option>
                  {filteredSections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name} (Year {section.year_level}, Sem {section.semester})
                    </option>
                  ))}
                </select>
                <select value={studentForm.scholarship} onChange={(e) => onStudentFieldChange('scholarship', e.target.value)}>
                  <option value="">Scholarship</option>
                  <option value="Non-Scholar">Non-Scholar</option>
                  <option value="PAGLAMBO">PAGLAMBO</option>
                </select>
                <input placeholder="Nationality" value={studentForm.nationality} onChange={(e) => onStudentFieldChange('nationality', e.target.value)} />
                <div className="field-inline-label">
                  <span>Date Enrolled</span>
                  <input type="date" value={studentForm.admission_date} onChange={(e) => onStudentFieldChange('admission_date', e.target.value)} />
                </div>
                <input placeholder="Complete Home Address" value={studentForm.home_address} onChange={(e) => onStudentFieldChange('home_address', e.target.value)} />
                <input placeholder="Email Address" value={studentForm.email_address} onChange={(e) => onStudentFieldChange('email_address', e.target.value)} />
                <input placeholder="Mobile Number" value={studentForm.contact_number} onChange={(e) => onStudentFieldChange('contact_number', e.target.value)} />
              </div>

              <div className="sheet-section-title">Parent or Guardian Information</div>
              <div className="sheet-grid">
                <input placeholder="Mother's Maiden Name" value={studentForm.mother_maiden_name} onChange={(e) => onStudentFieldChange('mother_maiden_name', e.target.value)} />
                <input placeholder="Mother Mobile No." value={studentForm.mother_contact_number} onChange={(e) => onStudentFieldChange('mother_contact_number', e.target.value)} />
                <input placeholder="Father's Name" value={studentForm.father_name} onChange={(e) => onStudentFieldChange('father_name', e.target.value)} />
                <input placeholder="Father Mobile No." value={studentForm.father_contact_number} onChange={(e) => onStudentFieldChange('father_contact_number', e.target.value)} />
              </div>

              <div className="sheet-section-title">Educational Record</div>
              <div className="sheet-grid">
                <input placeholder="Elementary" value={studentForm.elementary_school} onChange={(e) => onStudentFieldChange('elementary_school', e.target.value)} />
                <input placeholder="Junior High School" value={studentForm.junior_high_school} onChange={(e) => onStudentFieldChange('junior_high_school', e.target.value)} />
                <input placeholder="Senior High School" value={studentForm.senior_high_school} onChange={(e) => onStudentFieldChange('senior_high_school', e.target.value)} />
                <input placeholder="Track / Strand" value={studentForm.senior_high_track_strand} onChange={(e) => onStudentFieldChange('senior_high_track_strand', e.target.value)} />
              </div>

              <div className="sheet-section-title">Subject Load Schedule</div>
              <div className="table-wrap schedule-sheet-wrap">
                <table className="schedule-sheet-table">
                  <thead>
                    <tr>
                      <th>MWF TIME</th>
                      <th>SUBJECT CODE &amp; SECTION</th>
                      <th>Units</th>
                      <th>TTH TIME</th>
                      <th>SUBJECT CODE &amp; SECTION</th>
                      <th>Units</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleRows.map((row, index) => (
                      <tr key={index}>
                        <td>
                          <input className="schedule-time-input" value={row.mwfTime} onChange={(e) => onScheduleRowChange(index, 'mwfTime', e.target.value)} />
                        </td>
                        <td>
                          <span title={row.mwfSubjectTitle || ''}>
                            <input value={row.mwfSubject} onChange={(e) => onScheduleRowChange(index, 'mwfSubject', e.target.value)} />
                          </span>
                        </td>
                        <td>
                          <input value={row.mwfUnits} onChange={(e) => onScheduleRowChange(index, 'mwfUnits', e.target.value)} />
                        </td>
                        <td className={row.tthSaturdayHeader ? 'schedule-sat-cell' : ''}>
                          {row.tthSaturdayHeader ? (
                            <span>TIME</span>
                          ) : (
                            <input className="schedule-time-input" value={row.tthTime} onChange={(e) => onScheduleRowChange(index, 'tthTime', e.target.value)} />
                          )}
                        </td>
                        <td className={row.tthSaturdayHeader ? 'schedule-sat-cell' : ''}>
                          {row.tthSaturdayHeader ? (
                            <span>SATURDAY</span>
                          ) : (
                            <input value={row.tthSubject} onChange={(e) => onScheduleRowChange(index, 'tthSubject', e.target.value)} />
                          )}
                        </td>
                        <td>
                          {row.tthSaturdayHeader ? null : (
                            <input value={row.tthUnits} onChange={(e) => onScheduleRowChange(index, 'tthUnits', e.target.value)} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="sheet-section-title">Approval</div>
              <div className="sheet-grid">
                <input placeholder="Program Adviser Name" value={studentForm.adviser_name} onChange={(e) => onStudentFieldChange('adviser_name', e.target.value)} />
                <select value={studentForm.adviser_approval_status} onChange={(e) => onStudentFieldChange('adviser_approval_status', e.target.value)}>
                  <option value="pending">Adviser Pending</option>
                  <option value="approved">Adviser Approved</option>
                  <option value="rejected">Adviser Rejected</option>
                </select>
                <input placeholder="School Dean Name" value={studentForm.dean_name} onChange={(e) => onStudentFieldChange('dean_name', e.target.value)} />
                <select value={studentForm.dean_approval_status} onChange={(e) => onStudentFieldChange('dean_approval_status', e.target.value)}>
                  <option value="pending">Dean Pending</option>
                  <option value="approved">Dean Approved</option>
                  <option value="rejected">Dean Rejected</option>
                </select>
              </div>

              <div className="enroll-modal-footer">
                <button type="submit">Save Enrollment</button>
                <button type="button" onClick={closeEnrollModal}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <h2 className="section-title">Search Existing Student</h2>
      <form className="form-grid" onSubmit={searchStudent}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span
            style={{
              position: 'absolute',
              left: '10px',
              cursor: searchId ? 'pointer' : 'default',
              userSelect: 'none',
            }}
            onClick={() => searchId && setSearchId('')}
          >
            {searchId ? '✕' : '🔍'}
          </span>
          <input
            placeholder="Student ID"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            required
            style={{ paddingLeft: '30px', width: '100%' }}
          />
        </div>
        <button type="submit">Search</button>
      </form>

      {student && (
        <>  
          <h2 className="section-title">Student Profile</h2>
          <div className="table-wrap">
            <table>
              <tbody>
                <tr>
                  <th>Student ID</th>
                  <td>{student.student_id}</td>
                  <th>Program</th>
                  <td>{programs.find((p) => p.id === student.program)?.name || student.program}</td>
                </tr>
                <tr>
                  <th>Name</th>
                  <td>{`${student.last_name}, ${student.first_name} ${student.middle_name || ''} ${student.extension_name || ''}`}</td>
                  <th>Year Level</th>
                  <td>{student.year_level}</td>
                </tr>
                <tr>
                  <th>Gender</th>
                  <td>{student.gender}</td>
                  <th>Section</th>
                  <td>{sections.find((s) => s.id === student.section)?.name || '-'}</td>
                </tr>
                <tr>
                  <th>Academic Year</th>
                  <td>{student.academic_year}</td>
                  <th>Semester</th>
                  <td>{student.semester || '-'}</td>
                </tr>
                <tr>
                  <th>Email</th>
                  <td>{student.email_address || '-'}</td>
                  <th>Contact No.</th>
                  <td>{student.contact_number || '-'}</td>
                </tr>
                <tr>
                  <th>Address</th>
                  <td colSpan={3}>{student.home_address || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 className="section-title">Create Student Load</h2>
          <form className="form-grid" onSubmit={saveLoad}>
            <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} required>
              <option value="">Select Term</option>
              {terms.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.year_label} - Sem {term.semester} {term.is_active ? '(Active)' : ''}
                </option>
              ))}
            </select>

            <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} required>
              <option value="">Select Subject</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.code} - {subject.title}
                </option>
              ))}
            </select>

            <select value={statusValue} onChange={(e) => setStatusValue(e.target.value)}>
              <option value="enrolled">enrolled</option>
              <option value="passed">passed</option>
              <option value="completed">completed</option>
            </select>

            <button type="submit">Save Load</button>
          </form>

          <div className="form-grid">
            <button type="button" onClick={previewAutoLoad}>
              Preview Auto-Load
            </button>
            <button type="button" onClick={triggerAutoLoad}>
              Run Auto-Load
            </button>
          </div>

          {!!previewSubjects.length && (
            <>
              <h2 className="section-title">Auto-Load Preview</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Subject Code</th>
                      <th>Title</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewSubjects.map((subject) => (
                      <tr key={subject.id}>
                        <td>{subject.code}</td>
                        <td>{subject.title}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <h2 className="section-title">Current Loads</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Term</th>
                  <th>Subject</th>
                  <th>Title</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {student.loads.map((load) => (
                  <tr key={load.id}>
                    <td>{load.term_label}</td>
                    <td>{load.subject_code}</td>
                    <td>{load.subject_title}</td>
                    <td>{load.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}