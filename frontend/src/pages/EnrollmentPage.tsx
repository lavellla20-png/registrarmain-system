import { DragEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react'

import { api, getErrorMessage } from '../api'
import { AddUserIcon, SearchIcon } from '../components/Icons'

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

type EnrolledStudent = {
  id: number
  student_id: string
  first_name: string
  last_name: string
  program: number
  section: number | null
  year_level: number
  academic_year: string
  gender: string
  middle_name: string
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

type AcademicHistoryRecord = {
  id: number
  student: number
  academic_year: string
  semester: number
  status: string
  scholarship: string
  date_of_birth: string | null
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

type ScheduleColumn = 'mwf' | 'tth'
type ScheduleDragCell = {
  rowIndex: number
  column: ScheduleColumn
}

const MWF_SLOTS = ['7:00-8:00', '8:01-9:00', '9:01-10:00', '10:01-11:00', '11:01-12:00', '1:01-2:00', '2:01-3:00', '3:01-4:00', '4:01-5:00', '5:30-6:30']
const TTH_SLOTS = ['7:00-8:30', '8:31-10:00', '10:01-11:30', '1:00-2:30', '2:31-4:00', '4:01-5:30', '5:31-7:00', '7:01-8:30', 'SATURDAY_HEADER', '1:00-4:30', '', '']

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
  adviser_approval_status: 'approved',
  dean_name: '',
  dean_approval_status: 'approved',
}

const nullableNumber = (value: string): number | null => (value ? Number(value) : null)

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

const DEFAULT_SCHOLARSHIP_LABEL = 'Non-Scholar'
const PREPARED_BY_NAME = 'KRISTIN LILIA J. RUELO'
const PREPARED_BY_TITLE = 'College Registrar'
const PROPER_CASE_FIELDS: (keyof StudentCreateForm)[] = [
  'nationality',
  'home_address',
  'mother_maiden_name',
  'father_name',
  'elementary_school',
  'junior_high_school',
  'senior_high_school',
  'senior_high_track_strand',
]
const UPPERCASE_FIELDS: (keyof StudentCreateForm)[] = ['last_name', 'first_name', 'middle_name', 'extension_name']

const toProperCase = (value: string): string =>
  value
    .toLowerCase()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase())

const hasSpecificSubject = (value: string): boolean => {
  const normalized = value.trim()
  if (!normalized) return false
  if (normalized.toUpperCase() === 'SATURDAY') return false
  return /[A-Za-z]/.test(normalized)
}

const formatUnitsForView = (value: string): string => {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return value
  return Number.isInteger(numericValue) ? String(numericValue) : String(numericValue)
}

const resolvePrintedByUser = (): string => {
  const storedUsername = localStorage.getItem('auth_username')
  if (storedUsername && storedUsername.trim()) return storedUsername.trim()

  const accessToken = localStorage.getItem('access_token')
  if (!accessToken) return 'Unknown User'
  const parts = accessToken.split('.')
  if (parts.length < 2) return 'Unknown User'

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const paddedBase64 = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const payload = JSON.parse(window.atob(paddedBase64)) as Record<string, unknown>
    const usernameCandidate =
      payload.username ?? payload.user_name ?? payload.preferred_username ?? payload.email ?? payload.sub

    if (typeof usernameCandidate === 'string' && usernameCandidate.trim()) {
      const normalized = usernameCandidate.trim()
      localStorage.setItem('auth_username', normalized)
      return normalized
    }
  } catch {
    // Ignore decode errors and fall back to unknown.
  }

  return 'Unknown User'
}

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
  const [departments, setDepartments] = useState<Department[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [prospectusEntries, setProspectusEntries] = useState<ProspectusEntry[]>([])
  const [previewSubjects, setPreviewSubjects] = useState<Subject[]>([])
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([])

  const [studentForm, setStudentForm] = useState<StudentCreateForm>(initialStudentForm)
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>(buildInitialScheduleRows)
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [viewStudent, setViewStudent] = useState<StudentDetail | null>(null)
  const [isViewLoading, setIsViewLoading] = useState(false)
  const [viewStatus, setViewStatus] = useState('ON-GOING')
  const [viewScholarship, setViewScholarship] = useState('')
  const [viewDateOfBirth, setViewDateOfBirth] = useState<string | null>(null)

  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedTerm, setSelectedTerm] = useState('')
  const [statusValue, setStatusValue] = useState('enrolled')
  const [draggingCell, setDraggingCell] = useState<ScheduleDragCell | null>(null)
  const [dropTarget, setDropTarget] = useState<ScheduleDragCell | null>(null)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const computedAge = calculateAgeFromDob(studentForm.date_of_birth)
  const academicYearOptions = useMemo(buildAcademicYearOptions, [])
  const [approvalDate, setApprovalDate] = useState(() => new Date().toISOString().split('T')[0])
  const enrollmentScheduleSummary = useMemo(() => {
    return scheduleRows.reduce(
      (acc, row) => {
        const append = (subject: string, units: string) => {
          if (!hasSpecificSubject(subject)) return
          acc.totalSubjects += 1
          const parsedUnits = Number(units)
          if (Number.isFinite(parsedUnits)) acc.totalUnits += parsedUnits
        }
        append(row.mwfSubject, row.mwfUnits)
        append(row.tthSubject, row.tthUnits)
        return acc
      },
      { totalSubjects: 0, totalUnits: 0 },
    )
  }, [scheduleRows])

  const loadEnrolledStudents = useCallback(async () => {
    try {
      const response = await api.get<EnrolledStudent[]>('/students/')
      const newlyEnrolledStudents = response.data.filter(
        (student) => student.year_level === 1 && Number(student.semester) === 1,
      )
      setEnrolledStudents(newlyEnrolledStudents)
    } catch (error) {
      setError(getErrorMessage(error))
    }
  }, [])

  const loadReferenceData = async () => {
    const [subjectResp, termResp, departmentResp, programResp, sectionResp, prospectusResp] = await Promise.all([
      api.get<Subject[]>('/subjects/'),
      api.get<AcademicTerm[]>('/terms/'),
      api.get<Department[]>('/departments/'),
      api.get<Program[]>('/programs/'),
      api.get<Section[]>('/sections/'),
      api.get<ProspectusEntry[]>('/prospectus/'),
    ])
    setSubjects(subjectResp.data)
    setTerms(termResp.data)
    setDepartments(departmentResp.data)
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
    loadEnrolledStudents().catch((err) => setError(getErrorMessage(err)))
  }, [])

  const refreshStudent = async (studentId: string) => {
    const studentResp = await api.get<StudentDetail>(`/students/${studentId}/`)
    setStudent(studentResp.data)
  }

  const handleViewStudent = async (studentId: string) => {
    setError('')
    setSuccess('')
    setIsViewLoading(true)
    try {
      const studentResp = await api.get<StudentDetail>(`/students/${studentId}/`)
      const selectedStudent = studentResp.data
      setViewStudent(selectedStudent)

      let resolvedStatus = 'ON-GOING'
      let resolvedScholarship = selectedStudent.scholarship || ''
      let resolvedDateOfBirth = selectedStudent.date_of_birth

      try {
        const historyResp = await api.get<AcademicHistoryRecord[]>('/academic-history/')
        const matchedHistory = historyResp.data.find(
          (history) =>
            history.student === selectedStudent.id &&
            history.academic_year === selectedStudent.academic_year &&
            Number(history.semester) === Number(selectedStudent.semester),
        )
        if (matchedHistory) {
          resolvedStatus = formatStatusForSlip(matchedHistory.status)
          if (!resolvedScholarship) resolvedScholarship = matchedHistory.scholarship || ''
          if (!resolvedDateOfBirth) resolvedDateOfBirth = matchedHistory.date_of_birth
        }
      } catch (historyErr) {
        resolvedStatus = 'ON-GOING'
      }

      setViewStatus(resolvedStatus)
      setViewScholarship(resolvedScholarship || DEFAULT_SCHOLARSHIP_LABEL)
      setViewDateOfBirth(resolvedDateOfBirth)
      setIsViewModalOpen(true)
    } catch (err) {
      setViewStudent(null)
      setError(getErrorMessage(err))
    } finally {
      setIsViewLoading(false)
    }
  }

  const searchStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    setPreviewSubjects([])
    try {
      setError('')
      await refreshStudent(searchId)
    } catch (err) {
      setStudent(null)
      setError(getErrorMessage(err))
    }
  }

  const onStudentFieldChange = (field: keyof StudentCreateForm, value: string) => {
    const formattedValue = UPPERCASE_FIELDS.includes(field)
      ? value.toUpperCase()
      : PROPER_CASE_FIELDS.includes(field)
        ? toProperCase(value)
        : value
    setStudentForm((prev) => ({ ...prev, [field]: formattedValue }))
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

  const getScheduleCellKeys = (column: ScheduleColumn) =>
    column === 'mwf'
      ? ({ subjectKey: 'mwfSubject', unitsKey: 'mwfUnits' } as const)
      : ({ subjectKey: 'tthSubject', unitsKey: 'tthUnits' } as const)

  const isScheduleCellDraggable = (rowIndex: number, column: ScheduleColumn): boolean => {
    const row = scheduleRows[rowIndex]
    if (!row) return false
    if (column === 'tth' && row.tthSaturdayHeader) return false
    const { subjectKey } = getScheduleCellKeys(column)
    return Boolean(row[subjectKey]?.trim())
  }

  const onScheduleDragStart = (event: DragEvent<HTMLInputElement>, rowIndex: number, column: ScheduleColumn) => {
    if (!isScheduleCellDraggable(rowIndex, column)) {
      event.preventDefault()
      return
    }
    setDraggingCell({ rowIndex, column })
    setDropTarget(null)
    event.dataTransfer.effectAllowed = 'move'
  }

  const onScheduleDragOver = (event: DragEvent<HTMLInputElement>, rowIndex: number, column: ScheduleColumn) => {
    const row = scheduleRows[rowIndex]
    if (!draggingCell || !row) return
    if (column === 'tth' && row.tthSaturdayHeader) return
    event.preventDefault()
    setDropTarget({ rowIndex, column })
    event.dataTransfer.dropEffect = 'move'
  }

  const onScheduleDrop = (event: DragEvent<HTMLInputElement>, rowIndex: number, column: ScheduleColumn) => {
    event.preventDefault()
    const row = scheduleRows[rowIndex]
    if (!draggingCell || !row) return
    if (column === 'tth' && row.tthSaturdayHeader) return

    const source = draggingCell
    setScheduleRows((current) => {
      const sourceRow = current[source.rowIndex]
      const targetRow = current[rowIndex]
      if (!sourceRow || !targetRow) return current
      if (source.rowIndex === rowIndex && source.column === column) return current
      if (column === 'tth' && targetRow.tthSaturdayHeader) return current
      if (source.column === 'tth' && sourceRow.tthSaturdayHeader) return current

      const sourceKeys = getScheduleCellKeys(source.column)
      const targetKeys = getScheduleCellKeys(column)
      const sourceSubject = sourceRow[sourceKeys.subjectKey]
      const sourceUnits = sourceRow[sourceKeys.unitsKey]
      const targetSubject = targetRow[targetKeys.subjectKey]
      const targetUnits = targetRow[targetKeys.unitsKey]

      // Same-row drag (MWF <-> TTH) must update both columns in one object;
      // otherwise one side can be overwritten and appear to "disappear".
      if (source.rowIndex === rowIndex) {
        return current.map((rowItem, idx) => {
          if (idx !== rowIndex) return rowItem
          return {
            ...rowItem,
            [sourceKeys.subjectKey]: targetSubject,
            [sourceKeys.unitsKey]: targetUnits,
            [targetKeys.subjectKey]: sourceSubject,
            [targetKeys.unitsKey]: sourceUnits,
          }
        })
      }

      return current.map((rowItem, idx) => {
        if (idx === source.rowIndex) {
          return {
            ...rowItem,
            [sourceKeys.subjectKey]: targetSubject,
            [sourceKeys.unitsKey]: targetUnits,
          }
        }
        if (idx === rowIndex) {
          return {
            ...rowItem,
            [targetKeys.subjectKey]: sourceSubject,
            [targetKeys.unitsKey]: sourceUnits,
          }
        }
        return rowItem
      })
    })

    setDraggingCell(null)
    setDropTarget(null)
  }

  const onScheduleDragEnd = () => {
    setDraggingCell(null)
    setDropTarget(null)
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
    setDraggingCell(null)
    setDropTarget(null)
    setApprovalDate(new Date().toISOString().split('T')[0])
    setStudentForm(initialStudentForm)
    setScheduleRows(buildInitialScheduleRows())
  }

  const createStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    try {
      const saturdayHeaderIndex = scheduleRows.findIndex((row) => row.tthSaturdayHeader)
      const hasSaturdaySubjects =
        saturdayHeaderIndex >= 0 &&
        scheduleRows.slice(saturdayHeaderIndex + 1).some((row) => hasSpecificSubject(row.tthSubject))

      const scheduleText = scheduleRows
        .flatMap((row) => {
          const mwfHasSubject = hasSpecificSubject(row.mwfSubject)
          const tthHasSubject = hasSpecificSubject(row.tthSubject)

          if (row.tthSaturdayHeader) {
            if (!hasSaturdaySubjects) return []
            return [`MWF ${row.mwfTime}: ${row.mwfSubject.trim()} (${row.mwfUnits.trim()}) | TTH ${row.tthTime}: SATURDAY ()`]
          }

          if (!mwfHasSubject && !tthHasSubject) return []

          if (mwfHasSubject && tthHasSubject) {
            return [`MWF ${row.mwfTime}: ${row.mwfSubject.trim()} (${row.mwfUnits.trim()}) | TTH ${row.tthTime}: ${row.tthSubject.trim()} (${row.tthUnits.trim()})`]
          }

          if (mwfHasSubject) {
            return [`MWF ${row.mwfTime}: ${row.mwfSubject.trim()} (${row.mwfUnits.trim()})`]
          }

          return [`MWF ${row.mwfTime}:  () | TTH ${row.tthTime}: ${row.tthSubject.trim()} (${row.tthUnits.trim()})`]
        })
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
        scholarship: studentForm.scholarship || DEFAULT_SCHOLARSHIP_LABEL,
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
      })

      // Create AcademicHistory record for 1st Year - 1st Semester
      try {
        const studentResponse = await api.get(`/students/${studentForm.student_id}/`)
        const createdStudent = studentResponse.data
        
        await api.post('/academic-history/', {
          student: createdStudent.id,
          academic_year: studentForm.academic_year,
          year_level: 1,  // Always 1st Year for new enrollment
          semester: 1,    // Always 1st Semester for new enrollment
          program: Number(studentForm.program),
          section: nullableNumber(studentForm.section),
          
          // Personal Information (snapshot)
          first_name: studentForm.first_name,
          last_name: studentForm.last_name,
          middle_name: studentForm.middle_name,
          extension_name: studentForm.extension_name,
          gender: studentForm.gender,
          date_of_birth: studentForm.date_of_birth || null,
          age: computedAge,
          civil_status: studentForm.civil_status,
          nationality: studentForm.nationality,
          admission_date: studentForm.admission_date || null,
          scholarship: studentForm.scholarship || DEFAULT_SCHOLARSHIP_LABEL,
          course: '',  // Will be populated from program if needed
          
          // Contact Information (snapshot)
          home_address: studentForm.home_address,
          postal_code: studentForm.postal_code,
          email_address: studentForm.email_address,
          contact_number: studentForm.contact_number,
          
          // Family Information (snapshot)
          mother_maiden_name: studentForm.mother_maiden_name,
          mother_contact_number: studentForm.mother_contact_number,
          father_name: studentForm.father_name,
          father_contact_number: studentForm.father_contact_number,
          
          // Educational Background (snapshot)
          elementary_school: studentForm.elementary_school,
          junior_high_school: studentForm.junior_high_school,
          senior_high_school: studentForm.senior_high_school,
          senior_high_track_strand: studentForm.senior_high_track_strand,
          
          // Academic Information for this Semester
          subject_load_schedule: scheduleText,
          adviser_name: studentForm.adviser_name,
          adviser_approval_status: studentForm.adviser_approval_status,
          dean_name: studentForm.dean_name,
          dean_approval_status: studentForm.dean_approval_status,
          
          // Status and Dates
          status: 'ongoing',
          start_date: new Date().toISOString().split('T')[0],  // Today's date
          end_date: null,
        })
      } catch (historyErr) {
        // If academic-history endpoint doesn't exist, show warning but continue
        console.warn('AcademicHistory endpoint not implemented yet, proceeding with enrollment only')
      }

      setSearchId(studentForm.student_id)
      await refreshStudent(studentForm.student_id)
      await loadEnrolledStudents()
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

  const hasRequiredSectionFilters = Boolean(
    studentForm.program && studentForm.year_level && studentForm.academic_year && studentForm.semester,
  )
  const hasMatchingAcademicTerm = terms.some(
    (term) => term.year_label === studentForm.academic_year && String(term.semester) === studentForm.semester,
  )
  const prospectusSectionIds = new Set(
    prospectusEntries
      .filter(
        (entry) =>
          entry.program === Number(studentForm.program) &&
          entry.year_level === Number(studentForm.year_level) &&
          entry.semester === Number(studentForm.semester) &&
          entry.academic_year === studentForm.academic_year &&
          entry.section !== null,
      )
      .map((entry) => entry.section as number),
  )
  const filteredSections =
    hasRequiredSectionFilters && hasMatchingAcademicTerm
      ? sections.filter(
          (s) =>
            s.program === Number(studentForm.program) &&
            s.year_level === Number(studentForm.year_level) &&
            s.semester === Number(studentForm.semester) &&
            prospectusSectionIds.has(s.id),
        )
      : []
  const sectionPlaceholder = !hasRequiredSectionFilters
    ? 'Select Program, Year Level, Academic Year, and Semester first'
    : !hasMatchingAcademicTerm
      ? 'No matching academic term for selected year/semester'
      : filteredSections.length
        ? 'Section'
        : 'No sections with prospectus schedule available'

  useEffect(() => {
    setStudentForm((prev) => {
      if (!prev.section) return prev
      const isStillValid =
        hasRequiredSectionFilters &&
        hasMatchingAcademicTerm &&
        filteredSections.some((section) => String(section.id) === prev.section)
      if (isStillValid) return prev
      return { ...prev, section: '' }
    })
  }, [
    studentForm.program,
    studentForm.year_level,
    studentForm.academic_year,
    studentForm.semester,
    hasRequiredSectionFilters,
    hasMatchingAcademicTerm,
    filteredSections,
  ])

  const currentSemesterLoads = useMemo(() => {
    if (!student || !student.academic_year || !student.semester) return [] as StudentLoad[]
    const currentTermLabel = `${student.academic_year} - Sem ${student.semester}`
    return student.loads.filter((load) => load.term_label === currentTermLabel && load.status === 'enrolled')
  }, [student])

  const viewCurrentSemesterLoads = useMemo(() => {
    if (!viewStudent || !viewStudent.academic_year || !viewStudent.semester) return [] as StudentLoad[]
    const currentTermLabel = `${viewStudent.academic_year} - Sem ${viewStudent.semester}`
    return viewStudent.loads.filter((load) => load.term_label === currentTermLabel && load.status === 'enrolled')
  }, [viewStudent])

  const viewSlipRows = useMemo(() => {
    if (!viewStudent?.subject_load_schedule) return [] as Array<{
      code: string
      courseTitle: string
      section: string
      units: string
      schedule: string
      room: string
    }>

    const rowMap = new Map<string, {
      code: string
      courseTitle: string
      section: string
      units: string
      schedule: string[]
      room: string
    }>()
    const sectionLabel = viewStudent ? (sections.find((s) => s.id === viewStudent.section)?.name || '-') : '-'
    let inSaturdayBlock = false
    const parseScheduleSide = (rawSide: string) => {
      const unitsMatch = rawSide.match(/\(([^()]*)\)\s*$/)
      const units = unitsMatch ? unitsMatch[1].trim() : '-'
      const withoutUnits =
        unitsMatch && unitsMatch.index !== undefined
          ? rawSide.slice(0, unitsMatch.index).trim()
          : rawSide.trim()
      const separatorIndex = withoutUnits.indexOf(': ')
      if (separatorIndex < 0) {
        return { time: '-', subject: withoutUnits.trim(), units }
      }
      const time = withoutUnits.slice(0, separatorIndex).trim()
      const subject = withoutUnits.slice(separatorIndex + 2).trim()
      return { time, subject, units }
    }

    const toSubjectParts = (rawSubject: string) => {
      const subjectText = rawSubject.trim()
      if (!subjectText) {
        return { code: '-', courseTitle: '-', keyText: '' }
      }
      const normalizedSubject = subjectText
        .replace(/^\d{1,2}:\d{2}(?:-\d{1,2}:\d{2}(?:\s?(?:AM|PM))?)?:\s*/i, '')
        .replace(/\s*-\s*[A-Za-z0-9]+$/, '')
        .trim()

      let matched = subjects
        .filter((subject) => normalizedSubject.startsWith(`${subject.code} `) || normalizedSubject === subject.code)
        .sort((a, b) => b.code.length - a.code.length)[0]

      if (matched) {
        return {
          code: matched.code,
          courseTitle: matched.title,
          keyText: `${matched.code}|${matched.title}`,
        }
      }

      const fallbackTokens = normalizedSubject.split(/\s+/)
      const fallbackCode = fallbackTokens.slice(0, 2).join(' ') || '-'
      const fallbackTitle = fallbackTokens.slice(2).join(' ') || normalizedSubject
      return {
        code: fallbackCode,
        courseTitle: fallbackTitle,
        keyText: `${fallbackCode}|${fallbackTitle}`,
      }
    }

    const upsertScheduleRow = (dayLabel: 'MWF' | 'TTH' | 'SATURDAY', time: string, subjectRaw: string, unitsRaw: string) => {
      const subjectText = subjectRaw.trim()
      if (!hasSpecificSubject(subjectText)) return

      const { code, courseTitle, keyText } = toSubjectParts(subjectText)
      if (!keyText) return

      const key = `${keyText}|${unitsRaw.trim()}`
      const scheduleLabel = `${dayLabel} ${time.trim()}`
      const existing = rowMap.get(key)
      if (existing) {
        if (!existing.schedule.includes(scheduleLabel)) {
          existing.schedule.push(scheduleLabel)
        }
        return
      }

      rowMap.set(key, {
        code,
        courseTitle,
        section: sectionLabel,
        units: unitsRaw.trim() || '-',
        schedule: [scheduleLabel],
        room: '-',
      })
    }

    viewStudent.subject_load_schedule
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const normalizedLine = line.replace(/\s+/g, ' ').trim()
        const mwfPrefixMatch = normalizedLine.match(/^MWF\s+/i)
        if (!mwfPrefixMatch) return
        const splitMatch = normalizedLine.match(/\s\|\sTTH\s/i)
        if (!splitMatch || splitMatch.index === undefined) {
          const mwfOnlyRaw = normalizedLine.replace(/^MWF\s+/i, '')
          const mwfOnly = parseScheduleSide(mwfOnlyRaw)
          if (mwfOnly) {
            upsertScheduleRow('MWF', mwfOnly.time, mwfOnly.subject, mwfOnly.units)
          }
          return
        }

        const splitIndex = splitMatch.index
        const splitTokenLength = splitMatch[0].length
        const mwfSideRaw = normalizedLine.slice(mwfPrefixMatch[0].length, splitIndex).trim()
        const tthSideRaw = normalizedLine.slice(splitIndex + splitTokenLength).trim()
        const mwfSide = parseScheduleSide(mwfSideRaw)
        const tthSide = parseScheduleSide(tthSideRaw)
        if (!mwfSide) return

        upsertScheduleRow('MWF', mwfSide.time, mwfSide.subject, mwfSide.units)
        if (!tthSide) return

        const tthTime = tthSide.time.trim()
        const tthSubject = tthSide.subject.trim()
        if (tthTime.toUpperCase() === 'TIME' && tthSubject.toUpperCase() === 'SATURDAY') {
          inSaturdayBlock = true
          return
        }

        const tthDayLabel: 'TTH' | 'SATURDAY' = inSaturdayBlock ? 'SATURDAY' : 'TTH'
        upsertScheduleRow(tthDayLabel, tthSide.time, tthSide.subject, tthSide.units)
      })

    return Array.from(rowMap.values()).map((row) => ({
      code: row.code,
      courseTitle: row.courseTitle,
      section: row.section,
      units: row.units,
      schedule: row.schedule.join(', '),
      room: row.room,
    }))
  }, [viewStudent, sections, subjects])

  const viewTotalUnits = useMemo(() => {
    return viewSlipRows.reduce((total, row) => {
      const units = Number(row.units)
      return total + (Number.isFinite(units) ? units : 0)
    }, 0)
  }, [viewSlipRows])

  const viewProgram = useMemo(
    () => (viewStudent ? programs.find((program) => program.id === viewStudent.program) : null),
    [viewStudent, programs],
  )

  const viewDepartment = useMemo(
    () => (viewProgram ? departments.find((department) => department.id === viewProgram.department) : null),
    [viewProgram, departments],
  )
  const printedByUser = resolvePrintedByUser()
  const getLoadSlipValueClassName = (value: string | number | null | undefined) => {
    const text = String(value ?? '').trim()
    return text.length > 40 ? 'load-slip-grid-value load-slip-grid-value--compact' : 'load-slip-grid-value'
  }
  const getLoadSlipCellClassName = (value: string | number | null | undefined) => {
    const text = String(value ?? '').trim()
    return text.length > 40 ? 'load-slip-grid-cell load-slip-grid-cell--wide' : 'load-slip-grid-cell'
  }

  const renderLoadSlip = (copyLabel: string) => (
    <div className="load-slip">
      <img className="load-slip-watermark" src="/Picture2.png" alt="" aria-hidden="true" />
      <div className="load-slip-header">
        <div className="load-slip-header-row">
          <div className="load-slip-header-tag">ENROLLMENT LOAD SLIP</div>
          <div className="load-slip-header-main">
            <div className="load-slip-top-logos load-slip-top-logos-left" aria-hidden="true">
              <img src="/Picture2.png" alt="" />
            </div>
            <div className="load-slip-header-center">
              <div className="load-slip-campus">CITY COLLEGE OF BAYAWAN</div>
              <div className="load-slip-contact-line">Government Center, Cabcabon, Banga, Bayawan City</div>
              <div className="load-slip-contact-line">Negros Oriental (035) 430-0263 local 1120</div>
              <div className="load-slip-contact-line load-slip-email">citycollegeofbayawan@gmail.com</div>
              <div className="load-slip-office">OFFICE OF THE COLLEGE REGISTRAR</div>
            </div>
            <div className="load-slip-top-logos load-slip-top-logos-right" aria-hidden="true">
              <img src="/ccb_registrar_logo.png" alt="" />
            </div>
          </div>
        </div>
      </div>

      <div className="load-slip-section-title">Student General Information</div>
      <div className="load-slip-grid">
        <div className={getLoadSlipCellClassName(viewStudent?.student_id)}>
          <span>Student ID Number:</span>{' '}
          <span className="load-slip-student-id-value">{viewStudent?.student_id || '-'}</span>
        </div>
        <div className={getLoadSlipCellClassName(viewDepartment?.name)}><span>Department:</span> <span className={getLoadSlipValueClassName(viewDepartment?.name)}>{viewDepartment?.name || '-'}</span></div>
        <div className={getLoadSlipCellClassName(viewStudent?.academic_year)}><span>School Year:</span> <span className={getLoadSlipValueClassName(viewStudent?.academic_year)}>{viewStudent?.academic_year || '-'}</span></div>
        <div className={getLoadSlipCellClassName(viewStudent ? `${viewStudent.last_name}, ${viewStudent.first_name} ${viewStudent.middle_name || ''}` : '-')}><span>Name:</span> <span className={getLoadSlipValueClassName(viewStudent ? `${viewStudent.last_name}, ${viewStudent.first_name} ${viewStudent.middle_name || ''}` : '-')}>{viewStudent ? `${viewStudent.last_name}, ${viewStudent.first_name} ${viewStudent.middle_name || ''}` : '-'}</span></div>
        <div className={getLoadSlipCellClassName(viewProgram?.name)}><span>Program:</span> <span className={getLoadSlipValueClassName(viewProgram?.name)}>{viewProgram?.name || '-'}</span></div>
        <div className={getLoadSlipCellClassName(viewStudent?.semester)}><span>Semester:</span> <span className={getLoadSlipValueClassName(viewStudent?.semester)}>{viewStudent?.semester || '-'}</span></div>
        <div className={getLoadSlipCellClassName(formatDateValue(viewDateOfBirth))}><span>Date of Birth:</span> <span className={getLoadSlipValueClassName(formatDateValue(viewDateOfBirth))}>{formatDateValue(viewDateOfBirth)}</span></div>
        <div className={getLoadSlipCellClassName(viewStudent?.year_level)}><span>Year Level:</span> <span className={getLoadSlipValueClassName(viewStudent?.year_level)}>{viewStudent?.year_level || '-'}</span></div>
        <div className={getLoadSlipCellClassName(viewScholarship)}><span>Scholarship:</span> <span className={getLoadSlipValueClassName(viewScholarship)}>{viewScholarship || '-'}</span></div>
        <div className={getLoadSlipCellClassName(viewStudent?.gender)}><span>Gender:</span> <span className={getLoadSlipValueClassName(viewStudent?.gender)}>{viewStudent?.gender || '-'}</span></div>
        <div className={getLoadSlipCellClassName(viewStudent ? (sections.find((s) => s.id === viewStudent.section)?.name || '-') : '-')}><span>Section:</span> <span className={getLoadSlipValueClassName(viewStudent ? (sections.find((s) => s.id === viewStudent.section)?.name || '-') : '-')}>{viewStudent ? (sections.find((s) => s.id === viewStudent.section)?.name || '-') : '-'}</span></div>
        <div className={getLoadSlipCellClassName(viewStatus)}><span>Status:</span> <span className={getLoadSlipValueClassName(viewStatus)}>{viewStatus}</span></div>
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
            {viewSlipRows.map((row, index) => {
              return (
                <tr key={`${copyLabel}-${row.code}-${index}`}>
                  <td><span className="load-slip-table-value">{row.code}</span></td>
                  <td><span className="load-slip-table-value">{row.courseTitle}</span></td>
                  <td><span className="load-slip-table-value">{row.section}</span></td>
                  <td><span className="load-slip-table-value">{formatUnitsForView(row.units)}</span></td>
                  <td><span className="load-slip-table-value">{row.schedule}</span></td>
                  <td><span className="load-slip-table-value">{row.room}</span></td>
                </tr>
              )
            })}
            {!viewSlipRows.length && (
              <tr>
                <td colSpan={6}>No subject load schedule found for this student.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="load-slip-summary">
        <div><span>Total Subjects:</span> {viewSlipRows.length}</div>
        <div><span>Total Units:</span> {viewTotalUnits}</div>
        <div><span>Date Enrolled:</span> {viewStudent?.admission_date || '-'}</div>
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
      <div className="load-slip-copy-footer">
        <div className="load-slip-copy-tag">{copyLabel}</div>
        <div className="load-slip-copy-printed-by"><span>Printed by:</span> {printedByUser}</div>
      </div>
    </div>
  )

  const printLoadSlip = () => {
    const styleId = 'load-slip-legal-print-style'
    document.getElementById(styleId)?.remove()
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = '@media print { @page { size: 8.5in 13in; margin: 0.2in; } }'
    document.head.appendChild(style)
    window.print()
  }

  return (
    <section className="card">
      <h1>Enrollment Module</h1>
      <p>Register students, search profiles, and manage subject loads.</p>

      {error && <p className="error-text">{error}</p>}
      {success && <p className="success-text">{success}</p>}

      <div className="enroll-actions">
        <button type="button" onClick={() => setIsEnrollModalOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <AddUserIcon /> Enroll Student
        </button>
      </div>

      {isEnrollModalOpen && (
        <div className="enroll-modal-overlay">
          <div className="enroll-modal" style={{ overflowY: 'auto', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
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
                <select
                  value={studentForm.section}
                  onChange={(e) => onStudentFieldChange('section', e.target.value)}
                  disabled={!hasRequiredSectionFilters || !hasMatchingAcademicTerm || !filteredSections.length}
                >
                  <option value="">{sectionPlaceholder}</option>
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
                    {scheduleRows.map((row, index) => {
                      const mwfDropActive = dropTarget?.rowIndex === index && dropTarget.column === 'mwf'
                      const tthDropActive = dropTarget?.rowIndex === index && dropTarget.column === 'tth'
                      return (
                      <tr key={index}>
                        <td>
                          <input className="schedule-time-input" value={row.mwfTime} onChange={(e) => onScheduleRowChange(index, 'mwfTime', e.target.value)} />
                        </td>
                        <td>
                          <span title={row.mwfSubjectTitle || ''}>
                            <input
                              className={mwfDropActive ? 'schedule-drag-over' : ''}
                              value={row.mwfSubject}
                              onChange={(e) => onScheduleRowChange(index, 'mwfSubject', e.target.value)}
                              draggable={isScheduleCellDraggable(index, 'mwf')}
                              onDragStart={(e) => onScheduleDragStart(e, index, 'mwf')}
                              onDragOver={(e) => onScheduleDragOver(e, index, 'mwf')}
                              onDrop={(e) => onScheduleDrop(e, index, 'mwf')}
                              onDragEnd={onScheduleDragEnd}
                            />
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
                            <input
                              className={tthDropActive ? 'schedule-drag-over' : ''}
                              value={row.tthSubject}
                              onChange={(e) => onScheduleRowChange(index, 'tthSubject', e.target.value)}
                              draggable={isScheduleCellDraggable(index, 'tth')}
                              onDragStart={(e) => onScheduleDragStart(e, index, 'tth')}
                              onDragOver={(e) => onScheduleDragOver(e, index, 'tth')}
                              onDrop={(e) => onScheduleDrop(e, index, 'tth')}
                              onDragEnd={onScheduleDragEnd}
                            />
                          )}
                        </td>
                        <td>
                          {row.tthSaturdayHeader ? null : (
                            <input value={row.tthUnits} onChange={(e) => onScheduleRowChange(index, 'tthUnits', e.target.value)} />
                          )}
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>

              <div className="continuing-summary-row">
                <span><strong>Remarks:</strong></span>
                <span><strong>Total Units:</strong> {enrollmentScheduleSummary.totalUnits}</span>
                <span><strong>Total Subject/s:</strong> {enrollmentScheduleSummary.totalSubjects}</span>
              </div>

              <div className="sheet-section-title">Approval</div>
              <table className="continuing-approval-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Name</th>
                    <th>Signature</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>PROGRAM ADVISER</strong></td>
                    <td>
                      <input
                        placeholder="Program Adviser Name"
                        value={studentForm.adviser_name}
                        onChange={(e) => onStudentFieldChange('adviser_name', e.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        value={studentForm.adviser_approval_status}
                        onChange={(e) => onStudentFieldChange('adviser_approval_status', e.target.value)}
                      >
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </td>
                    <td><input type="date" value={approvalDate} onChange={(e) => setApprovalDate(e.target.value)} /></td>
                  </tr>
                  <tr>
                    <td><strong>SCHOOL DEAN</strong></td>
                    <td>
                      <input
                        placeholder="School Dean Name"
                        value={studentForm.dean_name}
                        onChange={(e) => onStudentFieldChange('dean_name', e.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        value={studentForm.dean_approval_status}
                        onChange={(e) => onStudentFieldChange('dean_approval_status', e.target.value)}
                      >
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </td>
                    <td><input type="date" value={approvalDate} onChange={(e) => setApprovalDate(e.target.value)} /></td>
                  </tr>
                </tbody>
              </table>

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
        <button type="submit" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <SearchIcon /> Search
        </button>
      </form>

      <h2 className="section-title">Enrolled Students</h2>
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
            {enrolledStudents.map((student) => (
              <tr key={student.id}>
                <td>{student.student_id}</td>
                <td>{`${student.last_name}, ${student.first_name} ${student.middle_name}.`}</td>
                <td>{programs.find((p) => p.id === student.program)?.name || '-'}</td>
                <td>{student.semester}</td>
                <td>{student.year_level}</td>
                <td>{sections.find((s) => s.id === student.section)?.name || '-'}</td>
                <td>{student.academic_year}</td>
                <td>{student.gender}</td>
                <td>
                  <button type="button" onClick={() => { void handleViewStudent(student.student_id) }} disabled={isViewLoading}>
                    View
                  </button>
                  <button type="button" onClick={() => { setSearchId(student.student_id); }}>
                    Edit
                  </button>
                  <button type="button" onClick={() => { /* TODO: Implement delete functionality */ }}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isViewModalOpen && (
        <div className="enroll-modal-overlay">
          <div className="enroll-modal load-slip-modal" onClick={(e) => e.stopPropagation()}>
            <div className="enroll-modal-header">
              <h2>Enrollment Load Slip</h2>
              <div className="modal-header-actions">
                <button type="button" onClick={printLoadSlip}>
                  Print
                </button>
                <button type="button" onClick={() => setIsViewModalOpen(false)}>
                  Close
                </button>
              </div>
            </div>

            {!viewStudent ? (
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




      {student && !isViewModalOpen && (
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

          <h2 className="section-title">Current Semester Loads</h2>
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
                {currentSemesterLoads.map((load) => (
                  <tr key={load.id}>
                    <td>{load.term_label}</td>
                    <td>{load.subject_code}</td>
                    <td>{load.subject_title}</td>
                    <td>{load.status}</td>
                  </tr>
                ))}
                {!currentSemesterLoads.length && (
                  <tr>
                    <td colSpan={4}>No enrolled subjects found for the current semester.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
