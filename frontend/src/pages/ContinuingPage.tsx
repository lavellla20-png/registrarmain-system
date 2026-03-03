import { FormEvent, useEffect, useMemo, useState } from 'react'

import { api, getErrorMessage } from '../api'
import { ContinuingIcon, SearchIcon } from '../components/Icons'

type Program = {
  id: number
  code: string
  name: string
  department: number
  program_adviser: string
  school_dean: string
}

type Department = {
  id: number
  name: string
  code: string
}

type Section = {
  id: number
  name: string
  program: number
  year_level: number
  semester: number
}

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
  last_name: string
  first_name: string
  middle_name: string
  extension_name: string
  gender: string
  date_of_birth: string | null
  age: number | null
  civil_status: string
  nationality: string
  admission_date: string | null
  scholarship: string
  course: string
  program: number
  year_level: number
  academic_year: string
  semester: number | null
  section: number | null
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
  adviser_name?: string
  dean_name?: string
  adviser_approval_status?: string
  dean_approval_status?: string
  subject_load_schedule?: string
  loads: StudentLoad[]
}

type StudentSummary = {
  id: number
  student_id: string
  first_name: string
  last_name: string
  middle_name: string
}

type AcademicHistoryRecord = {
  id: number
  student: number
  academic_year: string
  semester: number
  status: string
  scholarship: string
  date_of_birth: string | null
}

type SlipScheduleRow = {
  code: string
  title: string
  units: string
  schedule: string
}

const DEFAULT_SCHOLARSHIP_LABEL = 'Non-Scholar'
const PREPARED_BY_NAME = 'KRISTIN LILIA J. RUELO'
const PREPARED_BY_TITLE = 'College Registrar'

const formatDateValue = (value: string | null): string => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString()
}

const formatStatusForSlip = (status: string): string => {
  const normalized = status.trim().toLowerCase()
  if (!normalized) return 'ON-GOING'
  if (normalized === 'ongoing') return 'ON-GOING'
  return normalized.toUpperCase().replace(/_/g, ' ')
}

const buildAcademicYearOptions = () => {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: 21 }, (_, i) => {
    const start = currentYear - 10 + i
    return `${start}-${start + 1}`
  })
}

export function ContinuingPage() {
  const [searchId, setSearchId] = useState('')
  const [student, setStudent] = useState<StudentDetail | null>(null)

  const [allStudents, setAllStudents] = useState<StudentDetail[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false)
  const [slipStudent, setSlipStudent] = useState<StudentDetail | null>(null)
  const [isSlipLoading, setIsSlipLoading] = useState(false)
  const [slipStatus, setSlipStatus] = useState('ON-GOING')
  const [slipScholarship, setSlipScholarship] = useState(DEFAULT_SCHOLARSHIP_LABEL)
  const [slipDateOfBirth, setSlipDateOfBirth] = useState<string | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [prospectusEntries, setProspectusEntries] = useState<ProspectusEntry[]>([])
  const [terms, setTerms] = useState<AcademicTerm[]>([])

  const [selectedProgram, setSelectedProgram] = useState('')
  const [selectedYearLevel, setSelectedYearLevel] = useState('1')
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('')
  const [selectedSemester, setSelectedSemester] = useState('1')
  const [selectedSection, setSelectedSection] = useState('')

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const academicYearOptions = useMemo(buildAcademicYearOptions, [])

  const loadReferenceData = async () => {
    const [departmentResp, programResp, sectionResp, subjectResp, prospectusResp, termResp, studentsResp] = await Promise.all([
      api.get<Department[]>('/departments/'),
      api.get<Program[]>('/programs/'),
      api.get<Section[]>('/sections/'),
      api.get<Subject[]>('/subjects/'),
      api.get<ProspectusEntry[]>('/prospectus/'),
      api.get<AcademicTerm[]>('/terms/'),
      api.get<StudentDetail[]>('/students/'), // Load detailed student data to check continuing status
    ])
    setDepartments(departmentResp.data)
    setPrograms(programResp.data)
    setSections(sectionResp.data)
    setSubjects(subjectResp.data)
    setProspectusEntries(prospectusResp.data)
    setTerms(termResp.data)
    
    // Filter to show only students who have undergone continuing process
    // Exclude 1st Year - 1st Semester students and only show actual continuing students
    console.log('All students data:', studentsResp.data)
    
    const continuingStudents = studentsResp.data.filter(student => {
      // Exclude 1st Year - 1st Semester students
      const isFirstYearFirstSem = student.year_level === 1 && student.semester === 1
      
      // Only show students who are NOT in 1st Year - 1st Semester
      // These are the actual continuing students
      const isContinuingStudent = !isFirstYearFirstSem
      
      console.log(`Student ${student.student_id} (${student.last_name}, ${student.first_name}):`, {
        year_level: student.year_level,
        semester: student.semester,
        isFirstYearFirstSem,
        isContinuingStudent,
        adviser_status: student.adviser_approval_status,
        dean_status: student.dean_approval_status,
        schedule: student.subject_load_schedule
      })
      
      return isContinuingStudent
    })
    
    console.log('Filtered continuing students:', continuingStudents)
    setAllStudents(continuingStudents)
  }

  useEffect(() => {
    loadReferenceData().catch((err) => setError(getErrorMessage(err)))
  }, [])

  const searchStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    try {
      const response = await api.get<StudentDetail>(`/students/${searchId}/`)
      const found = response.data
      setStudent(found)

      setSelectedProgram(String(found.program))
      setSelectedYearLevel(String(found.year_level))
      setSelectedAcademicYear(found.academic_year || '')
      setSelectedSemester(String(found.semester ?? 1))
      setSelectedSection(found.section ? String(found.section) : '')

      setSuccess('Student found.')
    } catch (err) {
      setStudent(null)
      setError(getErrorMessage(err))
    }
  }

  const selectedProgramData = programs.find((program) => String(program.id) === selectedProgram)
  const selectedSectionData = sections.find((section) => String(section.id) === selectedSection)
  const resolvedAdviserName = selectedProgramData?.program_adviser || student?.adviser_name || ''
  const resolvedDeanName = selectedProgramData?.school_dean || student?.dean_name || ''

  const filteredSections = selectedProgram
    ? sections.filter(
        (section) =>
          String(section.program) === selectedProgram &&
          String(section.year_level) === selectedYearLevel &&
          String(section.semester) === selectedSemester,
      )
    : sections

  const subjectMap = useMemo(() => {
    const map = new Map<number, Subject>()
    subjects.forEach((subject) => map.set(subject.id, subject))
    return map
  }, [subjects])

  const scheduleFromCurrentLoads = useMemo(() => {
    if (!student || !selectedAcademicYear || !selectedSemester) return [] as Array<{ code: string; title: string }>
    const semNeedle = `Sem ${selectedSemester}`
    return student.loads
      .filter((load) => load.term_label.includes(selectedAcademicYear) && load.term_label.includes(semNeedle))
      .map((load) => ({ code: load.subject_code, title: load.subject_title }))
  }, [student, selectedAcademicYear, selectedSemester])

  const scheduleFromProspectus = useMemo(() => {
    if (!selectedProgram || !selectedYearLevel || !selectedSemester || !selectedAcademicYear || !selectedSection) {
      return [] as Array<{ code: string; title: string }>
    }
    const exact = prospectusEntries
      .filter(
        (entry) =>
          String(entry.program) === selectedProgram &&
          String(entry.year_level) === selectedYearLevel &&
          String(entry.semester) === selectedSemester &&
          entry.academic_year === selectedAcademicYear &&
          String(entry.section ?? '') === selectedSection,
      )
    const resolvedEntries =
      exact.length > 0
        ? exact
        : prospectusEntries.filter(
            (entry) =>
              String(entry.program) === selectedProgram &&
              String(entry.year_level) === selectedYearLevel &&
              String(entry.semester) === selectedSemester &&
              entry.academic_year === '' &&
              entry.section === null,
          )
    return resolvedEntries
      .map((entry) => {
        const subject = subjectMap.get(entry.subject)
        return {
          code: subject?.code ?? String(entry.subject),
          title: subject?.title ?? 'Unknown Subject',
        }
      })
  }, [prospectusEntries, selectedProgram, selectedYearLevel, selectedSemester, selectedAcademicYear, selectedSection, subjectMap])

  const scheduleRows = scheduleFromCurrentLoads.length ? scheduleFromCurrentLoads : scheduleFromProspectus

  const buildScheduleText = () => scheduleRows.map((row) => `${row.code} - ${row.title}`).join('\n')

  const saveChanges = async () => {
    if (!student) return
    setError('')
    setSuccess('')
    try {
      await api.post('/continuing/promote/', {
        student_ids: [student.student_id],
        target_program: Number(selectedProgram),
        target_year_level: Number(selectedYearLevel),
        target_academic_year: selectedAcademicYear,
        target_semester: Number(selectedSemester),
        target_section: selectedSection ? Number(selectedSection) : null,
        subject_load_schedule: buildScheduleText(),
        adviser_name: resolvedAdviserName,
        dean_name: resolvedDeanName,
      })
      const refreshed = await api.get<StudentDetail>(`/students/${student.student_id}/`)
      setStudent(refreshed.data)
      setSuccess('Student changes saved with academic history tracking.')
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  const promoteStudent = async () => {
    if (!student) return
    setError('')
    setSuccess('')

    if (!selectedYearLevel || !selectedProgram || !selectedAcademicYear || !selectedSemester || !selectedSection) {
      setError('Please fill all target academic details.')
      return
    }

    try {
      const matchedTerm = terms.find(
        (term) => term.year_label === selectedAcademicYear && Number(term.semester) === Number(selectedSemester)
      )
      if (!matchedTerm) {
        setError('No matching Academic Term found. Create/activate term first in Admin.')
        return
      }

      await api.post('/continuing/promote/', {
        student_ids: [student.student_id],
        target_program: Number(selectedProgram),
        target_year_level: Number(selectedYearLevel),
        target_academic_year: selectedAcademicYear,
        target_semester: Number(selectedSemester),
        target_section: selectedSection ? Number(selectedSection) : null,
        subject_load_schedule: buildScheduleText(),
        adviser_name: resolvedAdviserName,
        dean_name: resolvedDeanName,
        term_id: matchedTerm.id,
      })

      const refreshed = await api.get<StudentDetail>(`/students/${student.student_id}/`)
      setStudent(refreshed.data)
      setSuccess('Student promoted with academic history tracking.')
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  const approveAndFinalizeSchedule = async () => {
    if (!student) return
    setError('')
    setSuccess('')
    try {
      const scheduleText = buildScheduleText()
      await api.patch(`/students/${student.student_id}/`, {
        adviser_name: resolvedAdviserName,
        adviser_approval_status: 'approved',
        dean_name: resolvedDeanName,
        dean_approval_status: 'approved',
        subject_load_schedule: scheduleText,
        academic_year: selectedAcademicYear,
        semester: Number(selectedSemester),
      })

      // Keep current semester history in sync with finalized schedule/approvals.
      try {
        const historyResponse = await api.get<AcademicHistoryRecord[]>('/academic-history/')
        const matchedHistory = historyResponse.data.find(
          (history) =>
            history.student === student.id &&
            history.academic_year === selectedAcademicYear &&
            Number(history.semester) === Number(selectedSemester),
        )
        if (matchedHistory) {
          await api.patch(`/academic-history/${matchedHistory.id}/`, {
            adviser_name: resolvedAdviserName,
            adviser_approval_status: 'approved',
            dean_name: resolvedDeanName,
            dean_approval_status: 'approved',
            subject_load_schedule: scheduleText,
            status: 'ongoing',
          })
        }
      } catch (historySyncErr) {
        // Non-blocking: student update remains the source of truth if history sync fails.
      }

      const refreshed = await api.get<StudentDetail>(`/students/${student.student_id}/`)
      setStudent(refreshed.data)
      setSuccess('Schedule approved and finalized.')
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  const openModal = () => {
    setIsModalOpen(true)
    setStudent(null)
    setSearchId('')
    setSuccess('')
    setError('')
  }

  const closeModal = () => {
    setIsModalOpen(false)
  }

  const handleSelectStudent = async (studentId: string) => {
    setError('')
    setSuccess('')
    setIsSlipLoading(true)
    try {
      const response = await api.get<StudentDetail>(`/students/${studentId}/`)
      const selected = response.data
      setSlipStudent(selected)

      let resolvedStatus = 'ON-GOING'
      let resolvedScholarship = selected.scholarship || ''
      let resolvedDateOfBirth = selected.date_of_birth
      try {
        const historyResponse = await api.get<AcademicHistoryRecord[]>('/academic-history/')
        const matchedHistory = historyResponse.data.find(
          (history) =>
            history.student === selected.id &&
            history.academic_year === selected.academic_year &&
            Number(history.semester) === Number(selected.semester),
        )
        if (matchedHistory) {
          resolvedStatus = formatStatusForSlip(matchedHistory.status)
          if (!resolvedScholarship) resolvedScholarship = matchedHistory.scholarship || ''
          if (!resolvedDateOfBirth) resolvedDateOfBirth = matchedHistory.date_of_birth
        }
      } catch (historyErr) {
        resolvedStatus = 'ON-GOING'
      }

      setSlipStatus(resolvedStatus)
      setSlipScholarship(resolvedScholarship || DEFAULT_SCHOLARSHIP_LABEL)
      setSlipDateOfBirth(resolvedDateOfBirth)
      setIsSlipModalOpen(true)
    } catch (err) {
      setSlipStudent(null)
      setError(getErrorMessage(err))
    } finally {
      setIsSlipLoading(false)
    }
  }

  const slipProgram = useMemo(
    () => (slipStudent ? programs.find((program) => program.id === slipStudent.program) : null),
    [slipStudent, programs],
  )

  const slipDepartment = useMemo(
    () => (slipProgram ? departments.find((department) => department.id === slipProgram.department) : null),
    [slipProgram, departments],
  )

  const slipCurrentSemesterLoads = useMemo(() => {
    if (!slipStudent || !slipStudent.academic_year || !slipStudent.semester) return [] as StudentLoad[]
    const currentTermLabel = `${slipStudent.academic_year} - Sem ${slipStudent.semester}`
    return slipStudent.loads.filter((load) => load.term_label === currentTermLabel && load.status === 'enrolled')
  }, [slipStudent])

  const slipRowsFromSavedSchedule = useMemo(() => {
    if (!slipStudent?.subject_load_schedule) return [] as SlipScheduleRow[]
    return slipStudent.subject_load_schedule
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^(.+?)\s*-\s*(.+)$/)
        const code = match ? match[1].trim() : line
        const title = match ? match[2].trim() : ''
        const matchedSubject = subjects.find((subject) => subject.code === code || subject.title === title)
        return {
          code,
          title: title || matchedSubject?.title || '-',
          units: matchedSubject?.units || '-',
          schedule: '-',
        }
      })
  }, [slipStudent, subjects])

  const slipDisplayRows = useMemo(() => {
    if (slipCurrentSemesterLoads.length) {
      return slipCurrentSemesterLoads.map((load) => {
        const matchedSubject = subjects.find((subject) => subject.id === load.subject_id || subject.code === load.subject_code)
        return {
          code: load.subject_code,
          title: load.subject_title,
          units: matchedSubject?.units || '-',
          schedule: '-',
        } as SlipScheduleRow
      })
    }
    return slipRowsFromSavedSchedule
  }, [slipCurrentSemesterLoads, slipRowsFromSavedSchedule, subjects])

  const slipTotalUnits = useMemo(() => {
    return slipDisplayRows.reduce((total, row) => {
      const units = Number(row.units)
      return total + (Number.isFinite(units) ? units : 0)
    }, 0)
  }, [slipDisplayRows])

  const renderLoadSlip = (copyLabel: string) => (
    <div className="load-slip">
      <div className="load-slip-top">
        <div className="load-slip-title">Enrollment Load Slip</div>
        <div className="load-slip-campus">City College of Bayawan</div>
        <div className="load-slip-office">Office of the College Registrar</div>
      </div>

      <div className="load-slip-section-title">Student General Information</div>
      <div className="load-slip-grid">
        <div><span>Student ID Number:</span> {slipStudent?.student_id || '-'}</div>
        <div><span>Department:</span> {slipDepartment?.name || '-'}</div>
        <div><span>School Year:</span> {slipStudent?.academic_year || '-'}</div>
        <div><span>Name:</span> {slipStudent ? `${slipStudent.last_name}, ${slipStudent.first_name} ${slipStudent.middle_name || ''}` : '-'}</div>
        <div><span>Program:</span> {slipProgram?.name || '-'}</div>
        <div><span>Semester:</span> {slipStudent?.semester || '-'}</div>
        <div><span>Date of Birth:</span> {formatDateValue(slipDateOfBirth)}</div>
        <div><span>Year Level:</span> {slipStudent?.year_level || '-'}</div>
        <div><span>Scholarship:</span> {slipScholarship || '-'}</div>
        <div><span>Gender:</span> {slipStudent?.gender || '-'}</div>
        <div><span>Section:</span> {slipStudent ? (sections.find((s) => s.id === slipStudent.section)?.name || '-') : '-'}</div>
        <div><span>Status:</span> {slipStatus}</div>
      </div>

      <div className="table-wrap load-slip-table-wrap">
        <table className="load-slip-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Course Title</th>
              <th>Section</th>
              <th>Units</th>
              <th>Schedule</th>
              <th>Room</th>
            </tr>
          </thead>
          <tbody>
            {slipDisplayRows.map((row, index) => {
              return (
                <tr key={`${copyLabel}-${row.code}-${index}`}>
                  <td>{row.code}</td>
                  <td>{row.title}</td>
                  <td>{slipStudent ? (sections.find((s) => s.id === slipStudent.section)?.name || '-') : '-'}</td>
                  <td>{row.units}</td>
                  <td>{row.schedule}</td>
                  <td>-</td>
                </tr>
              )
            })}
            {!slipDisplayRows.length && (
              <tr>
                <td colSpan={6}>No current enrolled subjects found for this student.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="load-slip-summary">
        <div><span>Total Subjects:</span> {slipDisplayRows.length}</div>
        <div><span>Total Units:</span> {slipTotalUnits}</div>
        <div><span>Date Enrolled:</span> {slipStudent?.admission_date || '-'}</div>
      </div>

      <div className="load-slip-footer">
        <div className="load-slip-sign-area">
          <div className="load-slip-sign-line" />
          <div>Student or Parent/Guardian</div>
        </div>
        <div className="load-slip-sign-meta">
          <div><span>Stamped by:</span> ____________________</div>
          <div className="load-slip-prepared-label"><span>Prepared by:</span></div>
          <div className="load-slip-prepared-name">{PREPARED_BY_NAME}</div>
          <div className="load-slip-prepared-title">{PREPARED_BY_TITLE}</div>
        </div>
      </div>
      <div className="load-slip-copy-tag">{copyLabel}</div>
    </div>
  )

  return (
    <section className="card">
      <h1>Continuing Module</h1>
      <p>Manage continuing students and subject loads.</p>

      {error && <p className="error-text">{error}</p>}
      {success && <p className="success-text">{success}</p>}

      <div className="enroll-actions">
        <button type="button" onClick={openModal} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <ContinuingIcon /> Process Continuing Student
        </button>
      </div>

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
        <button type="submit" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <SearchIcon /> Search
        </button>
      </form>

      <h2 className="section-title">Student List</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student ID</th>
              <th>Name</th>
              <th>Program</th>
              <th>Semester</th>
              <th>Year Level</th>
              <th>Section</th>
              <th>Academic Year</th>
              <th>Gender</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {allStudents.slice(0, 10).map((s) => (
              <tr key={s.id}>
                <td>{s.student_id}</td>
                <td>{s.last_name}, {s.first_name} {s.middle_name || ''}.</td>
                <td>{programs.find((p) => p.id === s.program)?.name || '-'}</td>
                <td>{s.semester || '-'}</td>
                <td>{s.year_level}</td>
                <td>{sections.find((sec) => sec.id === s.section)?.name || '-'}</td>
                <td>{s.academic_year || '-'}</td>
                <td>{s.gender || '-'}</td>
                <td>
                  <button type="button" onClick={() => { void handleSelectStudent(s.student_id) }} disabled={isSlipLoading}>
                    Select
                  </button>
                  <button type="button" onClick={() => { setSearchId(s.student_id); }}>
                    Edit
                  </button>
                  <button type="button" onClick={() => { /* TODO: Implement delete functionality */ }}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {allStudents.length === 0 && <tr><td colSpan={9}>No continuing students found.</td></tr>}
          </tbody>
        </table>
      </div>

      {isSlipModalOpen && (
        <div className="enroll-modal-overlay" onClick={() => setIsSlipModalOpen(false)}>
          <div className="enroll-modal load-slip-modal" onClick={(e) => e.stopPropagation()}>
            <div className="enroll-modal-header">
              <h2>Enrollment Load Slip</h2>
              <button type="button" onClick={() => setIsSlipModalOpen(false)}>
                Close
              </button>
            </div>
            {!slipStudent ? (
              <div className="enroll-sheet-form">No student selected.</div>
            ) : (
              <>
                {renderLoadSlip("Registrar's copy")}
                <div className="load-slip-divider" />
                {renderLoadSlip("Student's copy")}
              </>
            )}
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="enroll-modal-overlay" onClick={closeModal}>
          <div className="enroll-modal" style={{ overflowY: 'auto', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="enroll-modal-header">
              <h2>Continuing Student Form</h2>
              <button type="button" onClick={closeModal}>
                Close
              </button>
            </div>

            <div className="enroll-sheet-form">
              <div className="sheet-section-title">Search Student</div>
              <form onSubmit={searchStudent} style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    list="student-list"
                    placeholder="Search or Select Student ID"
                    value={searchId}
                    onChange={(e) => setSearchId(e.target.value)}
                    required
                    style={{ width: '100%' }}
                  />
                  <datalist id="student-list">
                    {allStudents.map((s) => (
                      <option key={s.id} value={s.student_id}>
                        {s.last_name}, {s.first_name} {s.middle_name || ''}.
                      </option>
                    ))}
                  </datalist>
                </div>
                <button type="submit" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
                  <SearchIcon /> Load
                </button>
              </form>

              {student && (
                <>
                  <div className="sheet-section-title">Student Details</div>
                  <div className="sheet-grid">
                    <div className="field-inline-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>Name</span>
                      <div className="readonly-field" style={{ flex: 1 }}>{`${student.last_name}, ${student.first_name} ${student.middle_name || ''}.`}</div>
                    </div>
                    <div className="field-inline-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>Student ID</span>
                      <div className="readonly-field" style={{ flex: 1 }}>{student.student_id}</div>
                    </div>
                    <div className="field-inline-label" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>Current Program</span>
                      <div className="readonly-field" style={{ flex: 1 }}>{selectedProgramData ? selectedProgramData.name : '-'}</div>
                    </div>
                    <div className="field-inline-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>Current Year</span>
                      <div className="readonly-field" style={{ flex: 1 }}>{student.year_level}</div>
                    </div>
                    <div className="field-inline-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>Current Semester</span>
                      <div className="readonly-field" style={{ flex: 1 }}>{student.semester || '-'}</div>
                    </div>
                  </div>

                  <div className="sheet-section-title">Schedule Basis Selection</div>
                  <div className="sheet-grid" style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="field-inline-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '250px' }}>
                      <span style={{ minWidth: '120px' }}>Target Program</span>
                      <select value={selectedProgram} onChange={(e) => setSelectedProgram(e.target.value)} style={{ flex: 1 }}>
                        <option value="">Select Program</option>
                        {programs.map((program) => (
                          <option key={program.id} value={program.id}>
                            {program.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="field-inline-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '200px' }}>
                      <span style={{ minWidth: '120px' }}>Target Year Level</span>
                      <select value={selectedYearLevel} onChange={(e) => setSelectedYearLevel(e.target.value)} style={{ flex: 1 }}>
                        <option value="1">Year 1</option>
                        <option value="2">Year 2</option>
                        <option value="3">Year 3</option>
                        <option value="4">Year 4</option>
                      </select>
                    </div>

                    <div className="field-inline-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '200px' }}>
                      <span style={{ minWidth: '120px' }}>Target Academic Year</span>
                      <select value={selectedAcademicYear} onChange={(e) => setSelectedAcademicYear(e.target.value)} style={{ flex: 1 }}>
                        <option value="">Select Academic Year</option>
                        {academicYearOptions.map((yearLabel) => (
                          <option key={yearLabel} value={yearLabel}>
                            {yearLabel}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="field-inline-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '200px' }}>
                      <span style={{ minWidth: '120px' }}>Target Semester</span>
                      <select value={selectedSemester} onChange={(e) => setSelectedSemester(e.target.value)} style={{ flex: 1 }}>
                        <option value="1">1st Semester</option>
                        <option value="2">2nd Semester</option>
                        <option value="3">Summer</option>
                      </select>
                    </div>

                    <div className="field-inline-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '200px' }}>
                      <span style={{ minWidth: '120px' }}>Target Section</span>
                      <select value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} style={{ flex: 1 }}>
                        <option value="">Select Section</option>
                        {filteredSections.map((section) => (
                          <option key={section.id} value={section.id}>
                            {section.name} (Year {section.year_level}, Sem {section.semester})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="sheet-section-title">Subject Load Schedule</div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Subject Code</th>
                          <th>Subject Title</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scheduleRows.map((row, index) => (
                          <tr key={`${row.code}-${index}`}>
                            <td>{row.code}</td>
                            <td>{row.title}</td>
                          </tr>
                        ))}
                        {!scheduleRows.length && (
                          <tr>
                            <td colSpan={2}>No schedule found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {student && (
              <div className="enroll-modal-footer">
                <button type="button" onClick={saveChanges}>
                  Save Changes
                </button>
                <button type="button" onClick={promoteStudent}>
                  Promote Student
                </button>
                <button type="button" onClick={approveAndFinalizeSchedule}>
                  Approve & Finalize
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
