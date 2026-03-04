import { DragEvent, FormEvent, useEffect, useMemo, useState } from 'react'

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

type ContinuingScheduleGridRow = {
  mwfTime: string
  mwfSubject: string
  mwfUnits: string
  mwfCode?: string
  mwfTitle?: string
  tthTime: string
  tthSubject: string
  tthUnits: string
  tthCode?: string
  tthTitle?: string
  tthSaturdayHeader?: boolean
}

type ScheduleColumn = 'mwf' | 'tth'
type ScheduleDragCell = {
  rowIndex: number
  column: ScheduleColumn
}

const DEFAULT_SCHOLARSHIP_LABEL = 'Non-Scholar'
const PREPARED_BY_NAME = 'KRISTIN LILIA J. RUELO'
const PREPARED_BY_TITLE = 'College Registrar'
const CONTINUING_MWF_SLOTS = ['7:00-8:00', '8:01-9:00', '9:01-10:00', '10:01-11:00', '11:01-12:00', '1:01-2:00', '2:01-3:00', '3:01-4:00', '4:01-5:00', '5:30-6:30', '6:31-7:30', '', '']
const CONTINUING_TTH_SLOTS = ['7:00-8:30', '8:31-10:00', '10:01-11:30', '1:00-2:30', '2:31-4:00', '4:01-5:30', '5:31-7:00', '7:01-8:30', 'SATURDAY_HEADER', '1:00-4:30', '', '', '']

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

const hasSpecificSubject = (value: string): boolean => {
  const normalized = value.trim()
  if (!normalized) return false
  if (normalized.toUpperCase() === 'SATURDAY') return false
  return /[A-Za-z]/.test(normalized)
}

const formatUnitsForDisplay = (value: string): string => {
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
  const [selectedYearLevel, setSelectedYearLevel] = useState('')
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('')
  const [selectedSemester, setSelectedSemester] = useState('1')
  const [selectedSection, setSelectedSection] = useState('')
  const [selectedAdviserStatus, setSelectedAdviserStatus] = useState('approved')
  const [selectedDeanStatus, setSelectedDeanStatus] = useState('approved')
  const [continuingFormDate, setContinuingFormDate] = useState(new Date().toISOString().split('T')[0])
  const [continuingScheduleGrid, setContinuingScheduleGrid] = useState<ContinuingScheduleGridRow[]>([])
  const [draggingCell, setDraggingCell] = useState<ScheduleDragCell | null>(null)
  const [dropTarget, setDropTarget] = useState<ScheduleDragCell | null>(null)

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
      setSelectedAdviserStatus(found.adviser_approval_status || 'approved')
      setSelectedDeanStatus(found.dean_approval_status || 'approved')

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

  const hasRequiredSectionFilters = Boolean(
    selectedProgram && selectedYearLevel && selectedAcademicYear && selectedSemester,
  )
  const hasMatchingAcademicTerm = terms.some(
    (term) => term.year_label === selectedAcademicYear && String(term.semester) === selectedSemester,
  )
  const filteredSections =
    hasRequiredSectionFilters && hasMatchingAcademicTerm
      ? sections.filter(
          (section) =>
            String(section.program) === selectedProgram &&
            String(section.year_level) === selectedYearLevel &&
            String(section.semester) === selectedSemester,
        )
      : []
  const sectionPlaceholder = !hasRequiredSectionFilters
    ? 'Select Program, Year Level, Academic Year, and Semester first'
    : !hasMatchingAcademicTerm
      ? 'No matching academic term for selected year/semester'
      : filteredSections.length
        ? 'Section'
        : 'No sections available for selected criteria'

  const subjectMap = useMemo(() => {
    const map = new Map<number, Subject>()
    subjects.forEach((subject) => map.set(subject.id, subject))
    return map
  }, [subjects])

  useEffect(() => {
    setSelectedSection((currentSection) => {
      if (!currentSection) return currentSection
      const isStillValid =
        hasRequiredSectionFilters &&
        hasMatchingAcademicTerm &&
        filteredSections.some((section) => String(section.id) === currentSection)
      return isStillValid ? currentSection : ''
    })
  }, [
    selectedProgram,
    selectedYearLevel,
    selectedAcademicYear,
    selectedSemester,
    hasRequiredSectionFilters,
    hasMatchingAcademicTerm,
    filteredSections,
  ])

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

  const buildScheduleText = () => {
    const saturdayHeaderIndex = continuingScheduleGrid.findIndex((row) => row.tthSaturdayHeader)
    const hasSaturdaySubjects =
      saturdayHeaderIndex >= 0 &&
      continuingScheduleGrid.slice(saturdayHeaderIndex + 1).some((row) => hasSpecificSubject(row.tthSubject))

    return continuingScheduleGrid
      .flatMap((row) => {
        const mwfHasSubject = hasSpecificSubject(row.mwfSubject)
        const tthHasSubject = hasSpecificSubject(row.tthSubject)

        // Write Saturday marker only when there is a real Saturday subject.
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

        // TTH-only line keeps Enrollment-compatible parser token ("| TTH ...").
        return [`MWF ${row.mwfTime}:  () | TTH ${row.tthTime}: ${row.tthSubject.trim()} (${row.tthUnits.trim()})`]
      })
      .join('\n')
  }

  const continuingTotalUnits = useMemo(() => {
    return scheduleRows.reduce((total, row) => {
      const matched = subjects.find((subject) => subject.code === row.code)
      const units = matched ? Number(matched.units) : 0
      return total + (Number.isFinite(units) ? units : 0)
    }, 0)
  }, [scheduleRows, subjects])

  const continuingTotalSubjects = useMemo(() => {
    return continuingScheduleGrid.reduce((total, row) => {
      const mwfCount = row.mwfCode ? 1 : 0
      const tthCount = !row.tthSaturdayHeader && row.tthCode ? 1 : 0
      return total + mwfCount + tthCount
    }, 0)
  }, [continuingScheduleGrid])

  const computedContinuingScheduleGrid = useMemo(() => {
    const rowCount = Math.max(CONTINUING_MWF_SLOTS.length, CONTINUING_TTH_SLOTS.length)
    const grid: ContinuingScheduleGridRow[] = Array.from({ length: rowCount }, (_, index) => {
      const tthSlot = CONTINUING_TTH_SLOTS[index] ?? ''
      const saturdayHeader = tthSlot === 'SATURDAY_HEADER'
      return {
        mwfTime: CONTINUING_MWF_SLOTS[index] ?? '',
        mwfSubject: '',
        mwfUnits: '',
        tthTime: saturdayHeader ? 'TIME' : tthSlot,
        tthSubject: saturdayHeader ? 'SATURDAY' : '',
        tthUnits: '',
        tthSaturdayHeader: saturdayHeader,
      }
    })

    const targetCells: Array<{ rowIndex: number; column: 'mwf' | 'tth' }> = []
    grid.forEach((row, rowIndex) => {
      targetCells.push({ rowIndex, column: 'mwf' })
      if (!row.tthSaturdayHeader) targetCells.push({ rowIndex, column: 'tth' })
    })

    scheduleRows.forEach((row, index) => {
      const cell = targetCells[index]
      if (!cell) return
      const matched = subjects.find((subject) => subject.code === row.code)
      const sectionSuffix = selectedSectionData?.name ? ` - ${selectedSectionData.name}` : ''
      const subjectLabel = `${row.code} ${row.title}${sectionSuffix}`.trim()
      const unitsLabel = matched?.units ? formatUnitsForDisplay(String(matched.units)) : ''
      if (cell.column === 'mwf') {
        grid[cell.rowIndex].mwfSubject = subjectLabel
        grid[cell.rowIndex].mwfUnits = unitsLabel
        grid[cell.rowIndex].mwfCode = row.code
        grid[cell.rowIndex].mwfTitle = row.title
      } else {
        grid[cell.rowIndex].tthSubject = subjectLabel
        grid[cell.rowIndex].tthUnits = unitsLabel
        grid[cell.rowIndex].tthCode = row.code
        grid[cell.rowIndex].tthTitle = row.title
      }
    })

    return grid
  }, [scheduleRows, selectedSectionData, subjects])

  useEffect(() => {
    setContinuingScheduleGrid(computedContinuingScheduleGrid)
    setDraggingCell(null)
    setDropTarget(null)
  }, [computedContinuingScheduleGrid])

  const getScheduleCellKeys = (column: ScheduleColumn) =>
    column === 'mwf'
      ? ({ subjectKey: 'mwfSubject', unitsKey: 'mwfUnits', codeKey: 'mwfCode', titleKey: 'mwfTitle' } as const)
      : ({ subjectKey: 'tthSubject', unitsKey: 'tthUnits', codeKey: 'tthCode', titleKey: 'tthTitle' } as const)

  const isScheduleCellDraggable = (rowIndex: number, column: ScheduleColumn): boolean => {
    const row = continuingScheduleGrid[rowIndex]
    if (!row) return false
    if (column === 'tth' && row.tthSaturdayHeader) return false
    const { codeKey, titleKey } = getScheduleCellKeys(column)
    return Boolean(row[codeKey] && row[titleKey])
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
    const row = continuingScheduleGrid[rowIndex]
    if (!draggingCell || !row) return
    if (column === 'tth' && row.tthSaturdayHeader) return
    event.preventDefault()
    setDropTarget({ rowIndex, column })
    event.dataTransfer.dropEffect = 'move'
  }

  const onScheduleDrop = (event: DragEvent<HTMLInputElement>, rowIndex: number, column: ScheduleColumn) => {
    event.preventDefault()
    const row = continuingScheduleGrid[rowIndex]
    if (!draggingCell || !row) return
    if (column === 'tth' && row.tthSaturdayHeader) return

    const source = draggingCell
    setContinuingScheduleGrid((current) => {
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
      const sourceCode = sourceRow[sourceKeys.codeKey]
      const sourceTitle = sourceRow[sourceKeys.titleKey]
      const targetSubject = targetRow[targetKeys.subjectKey]
      const targetUnits = targetRow[targetKeys.unitsKey]
      const targetCode = targetRow[targetKeys.codeKey]
      const targetTitle = targetRow[targetKeys.titleKey]

      if (source.rowIndex === rowIndex) {
        return current.map((rowItem, idx) => {
          if (idx !== rowIndex) return rowItem
          return {
            ...rowItem,
            [sourceKeys.subjectKey]: targetSubject,
            [sourceKeys.unitsKey]: targetUnits,
            [sourceKeys.codeKey]: targetCode,
            [sourceKeys.titleKey]: targetTitle,
            [targetKeys.subjectKey]: sourceSubject,
            [targetKeys.unitsKey]: sourceUnits,
            [targetKeys.codeKey]: sourceCode,
            [targetKeys.titleKey]: sourceTitle,
          }
        })
      }

      return current.map((rowItem, idx) => {
        if (idx === source.rowIndex) {
          return {
            ...rowItem,
            [sourceKeys.subjectKey]: targetSubject,
            [sourceKeys.unitsKey]: targetUnits,
            [sourceKeys.codeKey]: targetCode,
            [sourceKeys.titleKey]: targetTitle,
          }
        }
        if (idx === rowIndex) {
          return {
            ...rowItem,
            [targetKeys.subjectKey]: sourceSubject,
            [targetKeys.unitsKey]: sourceUnits,
            [targetKeys.codeKey]: sourceCode,
            [targetKeys.titleKey]: sourceTitle,
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
        adviser_approval_status: selectedAdviserStatus,
        dean_name: resolvedDeanName,
        dean_approval_status: selectedDeanStatus,
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
        adviser_approval_status: selectedAdviserStatus,
        dean_name: resolvedDeanName,
        dean_approval_status: selectedDeanStatus,
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
    setSelectedAdviserStatus('approved')
    setSelectedDeanStatus('approved')
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
    const rowMap = new Map<string, {
      code: string
      title: string
      units: string
      schedule: string[]
    }>()
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
      if (!subjectText) return { code: '-', title: '-', keyText: '' }

      const normalizedSubject = subjectText
        .replace(/^\d{1,2}:\d{2}(?:-\d{1,2}:\d{2}(?:\s?(?:AM|PM))?)?:\s*/i, '')
        .replace(/\s*-\s*[A-Za-z0-9]+$/, '')
        .trim()

      const matched = subjects
        .filter((subject) => normalizedSubject.startsWith(`${subject.code} `) || normalizedSubject === subject.code)
        .sort((a, b) => b.code.length - a.code.length)[0]

      if (matched) {
        return { code: matched.code, title: matched.title, keyText: `${matched.code}|${matched.title}` }
      }

      const fallbackTokens = normalizedSubject.split(/\s+/)
      const fallbackCode = fallbackTokens.slice(0, 2).join(' ') || '-'
      const fallbackTitle = fallbackTokens.slice(2).join(' ') || normalizedSubject
      return { code: fallbackCode, title: fallbackTitle, keyText: `${fallbackCode}|${fallbackTitle}` }
    }

    const upsertScheduleRow = (dayLabel: 'MWF' | 'TTH' | 'SATURDAY', time: string, subjectRaw: string, unitsRaw: string) => {
      const subjectText = subjectRaw.trim()
      if (!hasSpecificSubject(subjectText)) return

      const { code, title, keyText } = toSubjectParts(subjectText)
      if (!keyText) return

      const key = `${keyText}|${unitsRaw.trim()}`
      const scheduleLabel = `${dayLabel} ${time.trim()}`
      const existing = rowMap.get(key)
      if (existing) {
        if (!existing.schedule.includes(scheduleLabel)) existing.schedule.push(scheduleLabel)
        return
      }

      rowMap.set(key, {
        code,
        title,
        units: unitsRaw.trim() ? formatUnitsForDisplay(unitsRaw.trim()) : '-',
        schedule: [scheduleLabel],
      })
    }

    slipStudent.subject_load_schedule
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const normalizedLine = line.replace(/\s+/g, ' ').trim()
        const mwfPrefixMatch = normalizedLine.match(/^MWF\s+/i)
        if (!mwfPrefixMatch) {
          const legacyMatch = normalizedLine.match(/^(.+?)\s*-\s*(.+)$/)
          const code = legacyMatch ? legacyMatch[1].trim() : normalizedLine
          const title = legacyMatch ? legacyMatch[2].trim() : ''
          const matchedSubject = subjects.find((subject) => subject.code === code || subject.title === title)
          rowMap.set(`${code}|${title}|legacy`, {
            code,
            title: title || matchedSubject?.title || '-',
            units: matchedSubject?.units ? formatUnitsForDisplay(String(matchedSubject.units)) : '-',
            schedule: ['-'],
          })
          return
        }

        const splitMatch = normalizedLine.match(/\s\|\sTTH\s/i)
        if (!splitMatch || splitMatch.index === undefined) {
          const mwfOnlyRaw = normalizedLine.replace(/^MWF\s+/i, '')
          const mwfOnly = parseScheduleSide(mwfOnlyRaw)
          upsertScheduleRow('MWF', mwfOnly.time, mwfOnly.subject, mwfOnly.units)
          return
        }

        const splitIndex = splitMatch.index
        const splitTokenLength = splitMatch[0].length
        const mwfSideRaw = normalizedLine.slice(mwfPrefixMatch[0].length, splitIndex).trim()
        const tthSideRaw = normalizedLine.slice(splitIndex + splitTokenLength).trim()
        const mwfSide = parseScheduleSide(mwfSideRaw)
        const tthSide = parseScheduleSide(tthSideRaw)
        upsertScheduleRow('MWF', mwfSide.time, mwfSide.subject, mwfSide.units)

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
      title: row.title,
      units: row.units,
      schedule: row.schedule.join(', '),
    }))
  }, [slipStudent, subjects])

  const slipDisplayRows = useMemo(() => {
    if (slipRowsFromSavedSchedule.length) {
      return slipRowsFromSavedSchedule
    }
    if (slipCurrentSemesterLoads.length) {
      return slipCurrentSemesterLoads.map((load) => {
        const matchedSubject = subjects.find((subject) => subject.id === load.subject_id || subject.code === load.subject_code)
        return {
          code: load.subject_code,
          title: load.subject_title,
          units: matchedSubject?.units ? formatUnitsForDisplay(String(matchedSubject.units)) : '-',
          schedule: '-',
        } as SlipScheduleRow
      })
    }
    return []
  }, [slipCurrentSemesterLoads, slipRowsFromSavedSchedule, subjects])

  const slipTotalUnits = useMemo(() => {
    return slipDisplayRows.reduce((total, row) => {
      const units = Number(row.units)
      return total + (Number.isFinite(units) ? units : 0)
    }, 0)
  }, [slipDisplayRows])
  const printedByUser = resolvePrintedByUser()

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
        <div>
          <span>Student ID Number:</span>{' '}
          <span className="load-slip-student-id-value">{slipStudent?.student_id || '-'}</span>
        </div>
        <div><span>Department:</span> <span className="load-slip-grid-value">{slipDepartment?.name || '-'}</span></div>
        <div><span>School Year:</span> <span className="load-slip-grid-value">{slipStudent?.academic_year || '-'}</span></div>
        <div><span>Name:</span> <span className="load-slip-grid-value">{slipStudent ? `${slipStudent.last_name}, ${slipStudent.first_name} ${slipStudent.middle_name || ''}` : '-'}</span></div>
        <div><span>Program:</span> <span className="load-slip-grid-value">{slipProgram?.name || '-'}</span></div>
        <div><span>Semester:</span> <span className="load-slip-grid-value">{slipStudent?.semester || '-'}</span></div>
        <div><span>Date of Birth:</span> <span className="load-slip-grid-value">{formatDateValue(slipDateOfBirth)}</span></div>
        <div><span>Year Level:</span> <span className="load-slip-grid-value">{slipStudent?.year_level || '-'}</span></div>
        <div><span>Scholarship:</span> <span className="load-slip-grid-value">{slipScholarship || '-'}</span></div>
        <div><span>Gender:</span> <span className="load-slip-grid-value">{slipStudent?.gender || '-'}</span></div>
        <div><span>Section:</span> <span className="load-slip-grid-value">{slipStudent ? (sections.find((s) => s.id === slipStudent.section)?.name || '-') : '-'}</span></div>
        <div><span>Status:</span> <span className="load-slip-grid-value">{slipStatus}</span></div>
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
                  <td><span className="load-slip-table-value">{row.code}</span></td>
                  <td><span className="load-slip-table-value">{row.title}</span></td>
                  <td><span className="load-slip-table-value">{slipStudent ? (sections.find((s) => s.id === slipStudent.section)?.name || '-') : '-'}</span></td>
                  <td><span className="load-slip-table-value">{row.units}</span></td>
                  <td><span className="load-slip-table-value">{row.schedule}</span></td>
                  <td><span className="load-slip-table-value">-</span></td>
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
              <div className="modal-header-actions">
                <button type="button" onClick={printLoadSlip}>
                  Print
                </button>
                <button type="button" onClick={() => setIsSlipModalOpen(false)}>
                  Close
                </button>
              </div>
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
        <div className="enroll-modal-overlay">
          <div className="enroll-modal" style={{ overflowY: 'auto', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="enroll-modal-header">
              <h2>Continuing Student Form</h2>
              <button type="button" onClick={closeModal}>
                Close
              </button>
            </div>

            <div className="enroll-sheet-form continuing-sheet-form">
              <div className="continuing-date-row">
                <strong>DATE:</strong>
                <input type="date" value={continuingFormDate} onChange={(e) => setContinuingFormDate(e.target.value)} />
              </div>

              <div className="continuing-form-title">
                <h3>ENROLLMENT FORM</h3>
                <p>(FOR CONTINUING STUDENTS)</p>
              </div>

              <div className="sheet-section-title">Search Student</div>
              <form onSubmit={searchStudent} className="continuing-search-row">
                <input
                  list="student-list"
                  placeholder="Search or Select Student ID"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  required
                />
                <datalist id="student-list">
                  {allStudents.map((s) => (
                    <option key={s.id} value={s.student_id}>
                      {s.last_name}, {s.first_name} {s.middle_name || ''}.
                    </option>
                  ))}
                </datalist>
                <button type="submit" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
                  <SearchIcon /> Load
                </button>
              </form>

              {student && (
                <>
                  <div className="sheet-section-title">Student's Information</div>
                  <div className="continuing-grid">
                    <input placeholder="Last Name" value={student.last_name || ''} readOnly />
                    <input placeholder="First Name" value={student.first_name || ''} readOnly />
                    <input placeholder="Middle Name" value={student.middle_name || ''} readOnly />
                    <input placeholder="Name Ext. (e.g. Jr.)" value={student.extension_name || ''} readOnly />

                    <select value={selectedProgram} onChange={(e) => setSelectedProgram(e.target.value)}>
                      <option value="">Course/Program</option>
                      {programs.map((program) => (
                        <option key={program.id} value={program.id}>
                          {program.name}
                        </option>
                      ))}
                    </select>
                    <input placeholder="ID Number" value={student.student_id} readOnly />

                    <select value={selectedYearLevel} onChange={(e) => setSelectedYearLevel(e.target.value)}>
                      <option value="">Year Level</option>
                      <option value="1">Year 1</option>
                      <option value="2">Year 2</option>
                      <option value="3">Year 3</option>
                      <option value="4">Year 4</option>
                    </select>
                    <select value={selectedAcademicYear} onChange={(e) => setSelectedAcademicYear(e.target.value)}>
                      <option value="">Academic Year</option>
                      {academicYearOptions.map((yearLabel) => (
                        <option key={yearLabel} value={yearLabel}>
                          {yearLabel}
                        </option>
                      ))}
                    </select>

                    <select value={selectedSemester} onChange={(e) => setSelectedSemester(e.target.value)}>
                      <option value="1">1st Semester</option>
                      <option value="2">2nd Semester</option>
                      <option value="3">Summer</option>
                    </select>
                    <select
                      value={selectedSection}
                      onChange={(e) => setSelectedSection(e.target.value)}
                      disabled={!hasRequiredSectionFilters || !hasMatchingAcademicTerm || !filteredSections.length}
                    >
                      <option value="">{sectionPlaceholder}</option>
                      {filteredSections.map((section) => (
                        <option key={section.id} value={section.id}>
                          {section.name} (Year {section.year_level}, Sem {section.semester})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="continuing-notes">
                    <p>
                      I promise to comply with the requirements in/on or before the end of the next semester in compliance with the
                      prescribed period under the Student Handbook. Incomplete marks will automatically result to a failing mark if not
                      complied with within the prescribed period.
                    </p>
                    <div className="continuing-sign-row">
                      <span>Signature over printed Name of Student</span>
                      <span>Date</span>
                      <span>Adviser</span>
                    </div>
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
                        {continuingScheduleGrid.map((row, index) => {
                          const mwfDropActive = dropTarget?.rowIndex === index && dropTarget.column === 'mwf'
                          const tthDropActive = dropTarget?.rowIndex === index && dropTarget.column === 'tth'
                          return (
                            <tr key={`continuing-row-${index}`}>
                              <td><input className="schedule-time-input" value={row.mwfTime} readOnly /></td>
                              <td>
                                <input
                                  className={mwfDropActive ? 'schedule-drag-over' : ''}
                                  value={row.mwfSubject}
                                  readOnly
                                  draggable={isScheduleCellDraggable(index, 'mwf')}
                                  onDragStart={(e) => onScheduleDragStart(e, index, 'mwf')}
                                  onDragOver={(e) => onScheduleDragOver(e, index, 'mwf')}
                                  onDrop={(e) => onScheduleDrop(e, index, 'mwf')}
                                  onDragEnd={onScheduleDragEnd}
                                />
                              </td>
                              <td><input value={row.mwfUnits} readOnly /></td>
                              <td className={row.tthSaturdayHeader ? 'schedule-sat-cell' : ''}>
                                {row.tthSaturdayHeader ? <span>TIME</span> : <input className="schedule-time-input" value={row.tthTime} readOnly />}
                              </td>
                              <td className={row.tthSaturdayHeader ? 'schedule-sat-cell' : ''}>
                                {row.tthSaturdayHeader ? (
                                  <span>SATURDAY</span>
                                ) : (
                                  <input
                                    className={tthDropActive ? 'schedule-drag-over' : ''}
                                    value={row.tthSubject}
                                    readOnly
                                    draggable={isScheduleCellDraggable(index, 'tth')}
                                    onDragStart={(e) => onScheduleDragStart(e, index, 'tth')}
                                    onDragOver={(e) => onScheduleDragOver(e, index, 'tth')}
                                    onDrop={(e) => onScheduleDrop(e, index, 'tth')}
                                    onDragEnd={onScheduleDragEnd}
                                  />
                                )}
                              </td>
                              <td>{row.tthSaturdayHeader ? null : <input value={row.tthUnits} readOnly />}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="continuing-summary-row">
                    <span><strong>Remarks:</strong></span>
                    <span><strong>Total Units:</strong> {continuingTotalUnits}</span>
                    <span><strong>Total Subject/s:</strong> {continuingTotalSubjects}</span>
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
                        <td>{resolvedAdviserName || '-'}</td>
                        <td>
                          <select value={selectedAdviserStatus} onChange={(e) => setSelectedAdviserStatus(e.target.value)}>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </td>
                        <td><input type="date" value={continuingFormDate} onChange={(e) => setContinuingFormDate(e.target.value)} /></td>
                      </tr>
                      <tr>
                        <td><strong>SCHOOL DEAN</strong></td>
                        <td>{resolvedDeanName || '-'}</td>
                        <td>
                          <select value={selectedDeanStatus} onChange={(e) => setSelectedDeanStatus(e.target.value)}>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </td>
                        <td><input type="date" value={continuingFormDate} onChange={(e) => setContinuingFormDate(e.target.value)} /></td>
                      </tr>
                    </tbody>
                  </table>
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
                <button type="button" onClick={closeModal}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

