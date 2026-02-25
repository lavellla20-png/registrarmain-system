import { FormEvent, useEffect, useState } from 'react'

import { api, getErrorMessage } from '../api'

type Program = {
  id: number
  code: string
  name: string
}

type Subject = {
  id: number
  code: string
  title: string
  units: string
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

type Section = {
  id: number
  name: string
  program: number
  year_level: number
  semester: number
}

const buildAcademicYearOptions = () => {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: 21 }, (_, i) => {
    const start = currentYear - 10 + i
    return `${start}-${start + 1}`
  })
}

export function ProspectusPage() {
  const [programs, setPrograms] = useState<Program[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [entries, setEntries] = useState<ProspectusEntry[]>([])

  const [subjectCode, setSubjectCode] = useState('')
  const [subjectTitle, setSubjectTitle] = useState('')
  const [subjectUnits, setSubjectUnits] = useState('3.0')
  const [editingSubjectId, setEditingSubjectId] = useState<number | null>(null)

  const [entryProgram, setEntryProgram] = useState('')
  const [entrySubject, setEntrySubject] = useState('')
  const [entryYearLevel, setEntryYearLevel] = useState('1')
  const [entrySemester, setEntrySemester] = useState('1')
  const [entryAcademicYear, setEntryAcademicYear] = useState('')
  const [entrySection, setEntrySection] = useState('')
  const [entryPrerequisite, setEntryPrerequisite] = useState('')
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [viewDetails, setViewDetails] = useState('')

  const academicYearOptions = buildAcademicYearOptions()

  const loadData = async () => {
    const [programResp, subjectResp, sectionResp, entryResp] = await Promise.all([
      api.get<Program[]>('/programs/'),
      api.get<Subject[]>('/subjects/'),
      api.get<Section[]>('/sections/'),
      api.get<ProspectusEntry[]>('/prospectus/'),
    ])
    setPrograms(programResp.data)
    setSubjects(subjectResp.data)
    setSections(sectionResp.data)
    setEntries(entryResp.data)
  }

  useEffect(() => {
    loadData().catch((err) => setError(getErrorMessage(err)))
  }, [])

  const withFeedback = async (action: () => Promise<void>, message: string) => {
    setError('')
    setSuccess('')
    try {
      await action()
      await loadData()
      setSuccess(message)
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  const resetSubjectForm = () => {
    setSubjectCode('')
    setSubjectTitle('')
    setSubjectUnits('3.0')
    setEditingSubjectId(null)
  }

  const resetEntryForm = () => {
    setEntryProgram('')
    setEntrySubject('')
    setEntryYearLevel('1')
    setEntrySemester('1')
    setEntryAcademicYear('')
    setEntrySection('')
    setEntryPrerequisite('')
    setEditingEntryId(null)
  }

  const submitSubject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await withFeedback(async () => {
      const payload = { code: subjectCode, title: subjectTitle, units: subjectUnits }
      if (editingSubjectId) {
        await api.put(`/subjects/${editingSubjectId}/`, payload)
      } else {
        await api.post('/subjects/', payload)
      }
      resetSubjectForm()
    }, editingSubjectId ? 'Subject updated.' : 'Subject created.')
  }

  const submitEntry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await withFeedback(async () => {
      const payload = {
        program: Number(entryProgram),
        subject: Number(entrySubject),
        year_level: Number(entryYearLevel),
        semester: Number(entrySemester),
        academic_year: entryAcademicYear,
        section: entrySection ? Number(entrySection) : null,
        prerequisite: entryPrerequisite ? Number(entryPrerequisite) : null,
      }
      if (editingEntryId) {
        await api.put(`/prospectus/${editingEntryId}/`, payload)
      } else {
        await api.post('/prospectus/', payload)
      }
      resetEntryForm()
    }, editingEntryId ? 'Prospectus mapping updated.' : 'Prospectus mapping created.')
  }

  const handleDelete = async (resource: 'subjects' | 'prospectus', id: number, label: string) => {
    const confirmed = window.confirm(`Delete ${label}?`)
    if (!confirmed) return
    await withFeedback(async () => {
      await api.delete(`/${resource}/${id}/`)
    }, `${label} deleted.`)
  }

  const handleView = (title: string, details: Record<string, unknown>) => {
    setViewDetails(`${title}: ${Object.entries(details)
      .map(([k, v]) => `${k}=${String(v)}`)
      .join(' | ')}`)
  }

  const startEditSubject = (subject: Subject) => {
    setSubjectCode(subject.code)
    setSubjectTitle(subject.title)
    setSubjectUnits(subject.units)
    setEditingSubjectId(subject.id)
  }

  const startEditEntry = (entry: ProspectusEntry) => {
    setEntryProgram(String(entry.program))
    setEntrySubject(String(entry.subject))
    setEntryYearLevel(String(entry.year_level))
    setEntrySemester(String(entry.semester))
    setEntryAcademicYear(entry.academic_year || '')
    setEntrySection(entry.section ? String(entry.section) : '')
    setEntryPrerequisite(entry.prerequisite ? String(entry.prerequisite) : '')
    setEditingEntryId(entry.id)
  }

  const subjectLabel = (id: number | null) => {
    if (!id) return '-'
    const subject = subjects.find((item) => item.id === id)
    return subject ? subject.code : String(id)
  }

  const programLabel = (id: number) => {
    const program = programs.find((item) => item.id === id)
    return program ? program.name : String(id)
  }

  const sectionLabel = (id: number | null) => {
    if (!id) return '-'
    const section = sections.find((item) => item.id === id)
    return section ? `${section.name} (Year ${section.year_level}, Sem ${section.semester})` : String(id)
  }

  const filteredSections = sections.filter(
    (section) =>
      (!entryProgram || String(section.program) === entryProgram) &&
      (!entryYearLevel || String(section.year_level) === entryYearLevel) &&
      (!entrySemester || String(section.semester) === entrySemester),
  )

  return (
    <section className="card">
      <h1>Prospectus Module</h1>
      <p>Define subjects, prerequisites, and semester mapping.</p>

      {error && <p className="error-text">{error}</p>}
      {success && <p className="success-text">{success}</p>}
      {viewDetails && <p>{viewDetails}</p>}

      <h2 className="section-title">Create Subject</h2>
      <form className="form-grid" onSubmit={submitSubject}>
        <input placeholder="Subject Code" value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)} required />
        <input placeholder="Subject Title" value={subjectTitle} onChange={(e) => setSubjectTitle(e.target.value)} required />
        <input placeholder="Units" value={subjectUnits} onChange={(e) => setSubjectUnits(e.target.value)} required />
        <button type="submit">{editingSubjectId ? 'Update Subject' : 'Save Subject'}</button>
        {editingSubjectId && (
          <button type="button" onClick={resetSubjectForm}>
            Cancel Edit
          </button>
        )}
      </form>

      <h2 className="section-title">Create Prospectus Mapping</h2>
      <form className="form-grid" onSubmit={submitEntry}>
        <select value={entryProgram} onChange={(e) => setEntryProgram(e.target.value)} required>
          <option value="">Select Program</option>
          {programs.map((program) => (
            <option key={program.id} value={program.id}>
              {program.name}
            </option>
          ))}
        </select>

        <select value={entrySubject} onChange={(e) => setEntrySubject(e.target.value)} required>
          <option value="">Select Subject</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.code} - {subject.title}
            </option>
          ))}
        </select>

        <select value={entryYearLevel} onChange={(e) => setEntryYearLevel(e.target.value)}>
          <option value="1">Year 1</option>
          <option value="2">Year 2</option>
          <option value="3">Year 3</option>
          <option value="4">Year 4</option>
        </select>

        <select value={entrySemester} onChange={(e) => setEntrySemester(e.target.value)}>
          <option value="1">1st Semester</option>
          <option value="2">2nd Semester</option>
          <option value="3">Summer</option>
        </select>

        <select value={entryAcademicYear} onChange={(e) => setEntryAcademicYear(e.target.value)} required>
          <option value="">Select Academic Year</option>
          {academicYearOptions.map((yearLabel) => (
            <option key={yearLabel} value={yearLabel}>
              {yearLabel}
            </option>
          ))}
        </select>

        <select value={entrySection} onChange={(e) => setEntrySection(e.target.value)} required>
          <option value="">Select Section</option>
          {filteredSections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name} (Year {section.year_level}, Sem {section.semester})
            </option>
          ))}
        </select>

        <select value={entryPrerequisite} onChange={(e) => setEntryPrerequisite(e.target.value)}>
          <option value="">No Prerequisite</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.code} - {subject.title}
            </option>
          ))}
        </select>

        <button type="submit">{editingEntryId ? 'Update Mapping' : 'Save Mapping'}</button>
        {editingEntryId && (
          <button type="button" onClick={resetEntryForm}>
            Cancel Edit
          </button>
        )}
      </form>

      <h2 className="section-title">Subject Catalog</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Title</th>
              <th>Units</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((subject) => (
              <tr key={subject.id}>
                <td>{subject.code}</td>
                <td>{subject.title}</td>
                <td>{subject.units}</td>
                <td>
                  <button type="button" onClick={() => handleView('Subject', subject)}>
                    View
                  </button>
                  <button type="button" onClick={() => startEditSubject(subject)}>
                    Edit
                  </button>
                  <button type="button" onClick={() => handleDelete('subjects', subject.id, `Subject ${subject.code}`)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="section-title">Prospectus Entries</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Program</th>
              <th>Subject</th>
              <th>Year</th>
              <th>Sem</th>
              <th>Academic Year</th>
              <th>Section</th>
              <th>Prerequisite</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{programLabel(entry.program)}</td>
                <td>{subjectLabel(entry.subject)}</td>
                <td>{entry.year_level}</td>
                <td>{entry.semester}</td>
                <td>{entry.academic_year || '-'}</td>
                <td>{sectionLabel(entry.section)}</td>
                <td>{subjectLabel(entry.prerequisite)}</td>
                <td>
                  <button type="button" onClick={() => handleView('ProspectusEntry', entry)}>
                    View
                  </button>
                  <button type="button" onClick={() => startEditEntry(entry)}>
                    Edit
                  </button>
                  <button type="button" onClick={() => handleDelete('prospectus', entry.id, `Prospectus entry ${entry.id}`)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
