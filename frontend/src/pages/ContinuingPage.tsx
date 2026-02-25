import { FormEvent, useEffect, useMemo, useState } from 'react'

import { api, getErrorMessage } from '../api'

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

type Subject = {
  id: number
  code: string
  title: string
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
  program: number
  year_level: number
  academic_year: string
  semester: number | null
  section: number | null
  adviser_name?: string
  dean_name?: string
  adviser_approval_status?: string
  dean_approval_status?: string
  subject_load_schedule?: string
  loads: StudentLoad[]
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
    const [programResp, sectionResp, subjectResp, prospectusResp, termResp] = await Promise.all([
      api.get<Program[]>('/programs/'),
      api.get<Section[]>('/sections/'),
      api.get<Subject[]>('/subjects/'),
      api.get<ProspectusEntry[]>('/prospectus/'),
      api.get<AcademicTerm[]>('/terms/'),
    ])
    setPrograms(programResp.data)
    setSections(sectionResp.data)
    setSubjects(subjectResp.data)
    setProspectusEntries(prospectusResp.data)
    setTerms(termResp.data)
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

  const saveChanges = async () => {
    if (!student) return
    setError('')
    setSuccess('')
    try {
      await api.patch(`/students/${student.student_id}/`, {
        program: Number(selectedProgram),
        year_level: Number(selectedYearLevel),
        academic_year: selectedAcademicYear,
        semester: Number(selectedSemester),
        section: selectedSection ? Number(selectedSection) : null,
        adviser_name: resolvedAdviserName,
        dean_name: resolvedDeanName,
      })
      const refreshed = await api.get<StudentDetail>(`/students/${student.student_id}/`)
      setStudent(refreshed.data)
      setSuccess('Student changes saved.')
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  const promoteStudent = async () => {
    if (!student) return
    setError('')
    setSuccess('')
    try {
      const matchedTerm = terms.find(
        (term) => term.year_label === selectedAcademicYear && String(term.semester) === selectedSemester,
      )
      if (!matchedTerm) {
        setError('No matching Academic Term found. Create/activate term first in Admin.')
        return
      }
      await api.post('/continuing/promote/', {
        student_ids: [student.student_id],
        target_year_level: Number(selectedYearLevel),
        term_id: matchedTerm.id,
      })
      const refreshed = await api.get<StudentDetail>(`/students/${student.student_id}/`)
      setStudent(refreshed.data)
      setSuccess('Student promoted and auto-load triggered.')
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  const approveAndFinalizeSchedule = async () => {
    if (!student) return
    setError('')
    setSuccess('')
    try {
      const scheduleText = scheduleRows.map((row) => `${row.code} - ${row.title}`).join('\n')
      await api.patch(`/students/${student.student_id}/`, {
        adviser_name: resolvedAdviserName,
        adviser_approval_status: 'approved',
        dean_name: resolvedDeanName,
        dean_approval_status: 'approved',
        subject_load_schedule: scheduleText,
        academic_year: selectedAcademicYear,
        semester: Number(selectedSemester),
      })
      const refreshed = await api.get<StudentDetail>(`/students/${student.student_id}/`)
      setStudent(refreshed.data)
      setSuccess('Schedule approved and finalized.')
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  return (
    <section className="card">
      <h1>Continuing Module</h1>
      <p>Search a student and review current progression details.</p>

      {error && <p className="error-text">{error}</p>}
      {success && <p className="success-text">{success}</p>}

      <form className="form-grid" onSubmit={searchStudent}>
        <input placeholder="Search Student ID Number" value={searchId} onChange={(e) => setSearchId(e.target.value)} required />
        <button type="submit">Search Student</button>
      </form>

      {student && (
        <>
          <h2 className="section-title">Student Details</h2>
          <div className="table-wrap">
            <table>
              <tbody>
                <tr>
                  <th>Lastname</th>
                  <td>{student.last_name}</td>
                  <th>Firstname</th>
                  <td>{student.first_name}</td>
                </tr>
                <tr>
                  <th>Middlename</th>
                  <td>{student.middle_name || '-'}</td>
                  <th>Extension Name</th>
                  <td>{student.extension_name || '-'}</td>
                </tr>
                <tr>
                  <th>Program</th>
                  <td>{selectedProgramData ? selectedProgramData.name : '-'}</td>
                  <th>Year Level</th>
                  <td>{selectedYearLevel}</td>
                </tr>
                <tr>
                  <th>Academic Year</th>
                  <td>{selectedAcademicYear || '-'}</td>
                  <th>Semester</th>
                  <td>{selectedSemester}</td>
                </tr>
                <tr>
                  <th>Section</th>
                  <td>{selectedSectionData ? `${selectedSectionData.name} (Year ${selectedSectionData.year_level})` : '-'}</td>
                  <th>Student ID Number</th>
                  <td>{student.student_id}</td>
                </tr>
                <tr>
                  <th>Program Adviser</th>
                  <td>{resolvedAdviserName || '-'}</td>
                  <th>School Dean</th>
                  <td>{resolvedDeanName || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 className="section-title">Schedule Basis Selection</h2>
          <form className="form-grid" onSubmit={(e) => e.preventDefault()}>
            <select value={selectedProgram} onChange={(e) => setSelectedProgram(e.target.value)}>
              <option value="">Select Program</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>

            <select value={selectedYearLevel} onChange={(e) => setSelectedYearLevel(e.target.value)}>
              <option value="1">Year 1</option>
              <option value="2">Year 2</option>
              <option value="3">Year 3</option>
              <option value="4">Year 4</option>
            </select>

            <select value={selectedAcademicYear} onChange={(e) => setSelectedAcademicYear(e.target.value)}>
              <option value="">Select Academic Year</option>
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

            <select value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)}>
              <option value="">Select Section</option>
              {filteredSections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name} (Year {section.year_level}, Sem {section.semester})
                </option>
              ))}
            </select>
          </form>

          <div className="form-grid">
            <button type="button" onClick={saveChanges}>
              Save Changes
            </button>
            <button type="button" onClick={promoteStudent}>
              Promote Student
            </button>
            <button type="button" onClick={approveAndFinalizeSchedule}>
              Approve and Finalize Schedule
            </button>
          </div>

          <h2 className="section-title">Subject Load Schedule</h2>
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
                    <td colSpan={2}>No schedule found for selected Program/Year Level/Academic Year/Semester/Section.</td>
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
